const ffmpegPath = require('ffmpeg-static');
const { spawn } = require('child_process');
const { runFFmpeg } = require('./run-ffmpeg');

// Input-side "-ss" seeking snaps to the nearest keyframe at or before the
// requested start, and stream copy can't trim into that gap without
// decoding — so a stream-copy cut is NEVER shorter than requested, only
// ever padded with extra, unwanted footage at the front. Comparing output
// duration against the requested duration therefore directly measures that
// front-padding error. The tolerance has to stay near one frame: anything
// looser (the previous 0.75s) silently accepted cuts with visible unwanted
// footage prepended, which is exactly the bug this guards against.
const DURATION_TOLERANCE_SECONDS = 0.05;

function probeDuration(filePath) {
  return new Promise((resolve) => {
    const proc = spawn(ffmpegPath, ['-i', filePath], {
      stdio: ['ignore', 'ignore', 'pipe'],
      timeout: 30000,
    });

    let stderr = '';
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('close', () => {
      const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
      if (!match) {
        resolve(null);
        return;
      }

      const [, hh, mm, ss] = match;
      resolve(Number(hh) * 3600 + Number(mm) * 60 + Number(ss));
    });

    proc.on('error', () => resolve(null));
  });
}

async function cutVideo({ inputPath, outputPath, start, end, onProgress = () => {} }) {
  const expectedDuration = end - start;
  const reportCutting = (percent) => onProgress({ phase: 'cutting', percent });

  // Fast path: stream copy preserves the original quality exactly, with no
  // re-encode. Input-side seeking snaps to the nearest keyframe, so it isn't
  // always frame-accurate, and some containers (e.g. VP9/Opus in WEBM) can't
  // be stream-copied into an MP4 at all.
  try {
    await runFFmpeg([
      '-y',
      '-ss', String(start),
      '-to', String(end),
      '-i', inputPath,
      '-c', 'copy',
      '-avoid_negative_ts', 'make_zero',
      '-progress', 'pipe:1',
      outputPath,
    ], { onProgress: reportCutting, totalDurationSeconds: expectedDuration });

    // Real, if not incremental: this is the post-copy duration check below,
    // not an estimate -- it's the actual step that decides whether the copy
    // is frame-accurate enough to keep.
    onProgress({ phase: 'analyzing', percent: 99 });
    const actualDuration = await probeDuration(outputPath);
    if (actualDuration !== null && Math.abs(actualDuration - expectedDuration) <= DURATION_TOLERANCE_SECONDS) {
      return { reencoded: false };
    }
  } catch (error) {
    // Stream copy failed outright (incompatible codec/container) — fall
    // through to the re-encode path below.
  }

  // Fallback: re-encoding after decoding gives a frame-accurate cut. crf 16
  // is visually near-lossless, the closest we can get once a re-encode is
  // unavoidable.
  await runFFmpeg([
    '-y',
    '-i', inputPath,
    '-ss', String(start),
    '-to', String(end),
    '-c:v', 'libx264',
    '-crf', '16',
    '-preset', 'medium',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-progress', 'pipe:1',
    outputPath,
  ], { onProgress: reportCutting, totalDurationSeconds: expectedDuration });

  return { reencoded: true };
}

module.exports = { cutVideo, probeDuration };
