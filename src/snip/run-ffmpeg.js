const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

// Ceiling so a stalled FFmpeg process fails with a clear error instead of
// leaving the UI stuck on "Exporting..."/"Cutting..." forever.
const TIMEOUT_MS = 10 * 60 * 1000;

// Mirrors src/export/ffmpeg.js's own progress parser -- a deliberate
// separate copy rather than a shared import, matching this project's
// existing per-module FFmpeg isolation (see src/shorts/run-ffmpeg.js for the
// same pattern). FFmpeg's "-progress pipe:1" emits repeated blocks of
// key=value lines, each terminated by a "progress=continue"/"progress=end"
// line; out_time_us is genuine microseconds.
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

// Callers that want progress must already include '-progress', 'pipe:1' in
// args themselves (positioned before the trailing output path, exactly like
// src/export/ffmpeg.js does) -- this function only decides whether to pipe
// and parse stdout, it never rewrites the caller's args.
function runFFmpeg(args, { onProgress, totalDurationSeconds } = {}) {
  return new Promise((resolve, reject) => {
    const trackProgress = typeof onProgress === 'function' && totalDurationSeconds > 0;

    // stdout is only piped (and actively read, via watchProgress) when a
    // caller wants progress; otherwise it stays ignored exactly as before --
    // an unread piped stream can prevent Node's 'close' event from ever
    // firing even after the process has actually exited, silently hanging
    // this promise.
    const proc = spawn(ffmpegPath, args, {
      stdio: ['ignore', trackProgress ? 'pipe' : 'ignore', 'pipe'],
      timeout: TIMEOUT_MS,
    });

    if (trackProgress) {
      watchProgress(proc.stdout, totalDurationSeconds, onProgress);
    }

    let stderr = '';
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('error', reject);

    proc.on('close', (code, signal) => {
      if (code === 0) {
        resolve(stderr);
      } else if (signal) {
        reject(new Error(`FFmpeg was terminated (${signal}), possibly due to a timeout: ${stderr.slice(-2000)}`));
      } else {
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-2000)}`));
      }
    });
  });
}

function probeHasAudio(filePath) {
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
      resolve(/Stream #\d+:\d+.*Audio:/.test(stderr));
    });

    proc.on('error', () => resolve(false));
  });
}

module.exports = { runFFmpeg, probeHasAudio };
