const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

// Ceiling so a stalled FFmpeg process fails with a clear error instead of
// leaving the UI stuck on "Generating..." forever.
const TIMEOUT_MS = 10 * 60 * 1000;

function runFFmpeg(args, options = {}) {
  return new Promise((resolve, reject) => {
    // stdin/stdout are ignored rather than piped: FFmpeg never reads stdin
    // or writes meaningful data to stdout for these commands, and an unread
    // piped stream can prevent Node's 'close' event from ever firing even
    // after the process has actually exited -- silently hanging this promise.
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

// Reads the embedded ID3 "title" tag, if any -- used to derive a real
// display name for bundled music tracks instead of showing their filename.
function probeTitle(filePath) {
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
      const match = stderr.match(/^\s*title\s*:\s*(.+)$/m);
      resolve(match ? match[1].trim() : null);
    });

    proc.on('error', () => resolve(null));
  });
}

// Detects silence gaps (real pauses between sentences) in a narration
// track, so background music can duck only while the voice is actually
// speaking and restore between sentences, rather than for the whole clip.
function probeSilences(filePath, { noiseDb = -30, minDurationSeconds = 0.3 } = {}) {
  return new Promise((resolve) => {
    const proc = spawn(ffmpegPath, [
      '-i', filePath,
      '-af', `silencedetect=noise=${noiseDb}dB:d=${minDurationSeconds}`,
      '-f', 'null', '-',
    ], {
      stdio: ['ignore', 'ignore', 'pipe'],
      timeout: 30000,
    });

    let stderr = '';
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('close', () => {
      const silences = [];
      const startMatches = [...stderr.matchAll(/silence_start:\s*(-?\d+(?:\.\d+)?)/g)];
      const endMatches = [...stderr.matchAll(/silence_end:\s*(-?\d+(?:\.\d+)?)/g)];

      for (let i = 0; i < startMatches.length; i++) {
        const start = Number(startMatches[i][1]);
        const end = endMatches[i] ? Number(endMatches[i][1]) : null;
        if (end !== null) silences.push({ start, end });
      }

      resolve(silences);
    });

    proc.on('error', () => resolve([]));
  });
}

module.exports = { runFFmpeg, probeDuration, probeTitle, probeSilences };
