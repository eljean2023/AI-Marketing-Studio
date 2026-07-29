const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const MIN_SEGMENT_SECONDS = 0.1;

// Ceiling so a stalled FFmpeg process fails with a clear error instead of
// leaving the UI stuck on "Exporting..." forever.
const TIMEOUT_MS = 10 * 60 * 1000;

function buildFilterGraph({ edit, resolution, hasAudio }) {
  const { trimStart, trimEnd, deleteSegment } = edit;
  const padFilter = `scale=${resolution.width}:${resolution.height}:force_original_aspect_ratio=decrease,pad=${resolution.width}:${resolution.height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1`;

  let before = null;
  let after = null;

  if (deleteSegment) {
    if (deleteSegment.start - trimStart > MIN_SEGMENT_SECONDS) {
      before = { start: trimStart, end: deleteSegment.start };
    }
    if (trimEnd - deleteSegment.end > MIN_SEGMENT_SECONDS) {
      after = { start: deleteSegment.end, end: trimEnd };
    }
  } else {
    before = { start: trimStart, end: trimEnd };
  }

  const segments = [before, after].filter(Boolean);

  if (segments.length === 0) {
    throw new Error('The selected edit removes the entire recording. Adjust the trim or delete range.');
  }

  const totalDurationSeconds = segments.reduce((sum, segment) => sum + (segment.end - segment.start), 0);

  if (segments.length === 1) {
    const { start, end } = segments[0];
    const parts = [`[0:v]trim=start=${start}:end=${end},setpts=PTS-STARTPTS,${padFilter}[vout]`];

    if (hasAudio) {
      parts.push(`[0:a]atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS[aout]`);
    }

    return {
      filterComplex: parts.join(';'),
      videoMap: '[vout]',
      audioMap: hasAudio ? '[aout]' : null,
      totalDurationSeconds,
    };
  }

  const parts = [];
  segments.forEach((segment, index) => {
    parts.push(`[0:v]trim=start=${segment.start}:end=${segment.end},setpts=PTS-STARTPTS[v${index}]`);
    if (hasAudio) {
      parts.push(`[0:a]atrim=start=${segment.start}:end=${segment.end},asetpts=PTS-STARTPTS[a${index}]`);
    }
  });

  if (hasAudio) {
    const concatInputs = segments.map((_, index) => `[v${index}][a${index}]`).join('');
    parts.push(`${concatInputs}concat=n=${segments.length}:v=1:a=1[vcat][aout]`);
  } else {
    const concatInputs = segments.map((_, index) => `[v${index}]`).join('');
    parts.push(`${concatInputs}concat=n=${segments.length}:v=1:a=0[vcat]`);
  }
  parts.push(`[vcat]${padFilter}[vout]`);

  return {
    filterComplex: parts.join(';'),
    videoMap: '[vout]',
    audioMap: hasAudio ? '[aout]' : null,
    totalDurationSeconds,
  };
}

// FFmpeg's "-progress pipe:1" emits repeated blocks of key=value lines,
// each block terminated by a "progress=continue"/"progress=end" line.
// out_time_us is genuine microseconds; out_time_ms is -- despite its name
// -- also microseconds, a long-standing FFmpeg quirk. Confirmed directly
// against a real run rather than assumed, so this only reads out_time_us.
function watchProgress(stdoutStream, totalDurationSeconds, onProgress) {
  let buffer = '';
  let block = {};

  stdoutStream.on('data', (chunk) => {
    buffer += chunk.toString();

    let newlineIndex;
    while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (!line) continue;

      const eqIndex = line.indexOf('=');
      if (eqIndex === -1) continue;

      const key = line.slice(0, eqIndex);
      const value = line.slice(eqIndex + 1);
      block[key] = value;

      if (key === 'progress') {
        const outTimeUs = Number(block.out_time_us);
        if (Number.isFinite(outTimeUs) && totalDurationSeconds > 0) {
          const percent = Math.max(0, Math.min(99, (outTimeUs / 1e6 / totalDurationSeconds) * 100));
          onProgress(percent);
        }
        block = {};
      }
    }
  });
}

function runExport({ inputPath, outputPath, edit, resolution, hasAudio, onProgress = () => {} }) {
  const { filterComplex, videoMap, audioMap, totalDurationSeconds } = buildFilterGraph({ edit, resolution, hasAudio });

  const args = [
    '-y',
    '-i', inputPath,
    '-filter_complex', filterComplex,
    '-map', videoMap,
  ];

  if (audioMap) {
    args.push('-map', audioMap);
  }

  args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '20');

  if (audioMap) {
    args.push('-c:a', 'aac', '-b:a', '160k');
  }

  args.push('-movflags', '+faststart', '-progress', 'pipe:1', outputPath);

  return new Promise((resolve, reject) => {
    onProgress(0);

    // stdout is now actively read (see watchProgress below) to parse
    // progress, so piping it is safe -- the earlier fix for this class of
    // command was specifically about piping a stream nothing ever reads,
    // which can stall the child process. stdin stays ignored; FFmpeg never
    // reads it here.
    const ffmpeg = spawn(ffmpegPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: TIMEOUT_MS,
    });

    watchProgress(ffmpeg.stdout, totalDurationSeconds, onProgress);

    let stderr = '';
    ffmpeg.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    ffmpeg.on('error', reject);

    ffmpeg.on('close', (code, signal) => {
      if (code === 0) {
        resolve();
      } else if (signal) {
        reject(new Error(`FFmpeg was terminated (${signal}), possibly due to a timeout: ${stderr.slice(-2000)}`));
      } else {
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-2000)}`));
      }
    });
  });
}

module.exports = { runExport, buildFilterGraph };
