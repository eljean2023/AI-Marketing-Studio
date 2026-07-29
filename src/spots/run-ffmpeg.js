const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

// Ceiling so a stalled FFmpeg process fails with a clear error instead of
// leaving the UI stuck on "Generating..." forever.
const TIMEOUT_MS = 10 * 60 * 1000;

function runFFmpeg(args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, {
      stdio: ['ignore', 'ignore', 'pipe'],
      timeout: TIMEOUT_MS,
      cwd: options.cwd,
    });

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

function probeDimensions(filePath) {
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
      const match = stderr.match(/Video:.*?(\d{2,5})x(\d{2,5})/);
      resolve(match ? { width: Number(match[1]), height: Number(match[2]) } : null);
    });

    proc.on('error', () => resolve(null));
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

module.exports = { runFFmpeg, probeDuration, probeDimensions, probeHasAudio };
