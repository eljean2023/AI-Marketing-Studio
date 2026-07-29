const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const MUSIC_DIR = path.join(__dirname, '..', '..', 'assets', 'shorts', 'music');

// Own copy of Shorts Creator's bundled-music scan (src/shorts/assets.js +
// src/shorts/run-ffmpeg.js's probeTitle) -- duplicated rather than imported,
// since Brand Kit stays isolated from src/shorts/ (see CLAUDE.md's Module
// Architecture: "own copy, not shared, by design"). Reads from the same
// assets/shorts/music/ folder -- sharing the bundled asset files across
// modules is fine, it's the module code that must stay isolated.

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

function humanizeFilename(baseName) {
  const spaced = baseName
    .replace(/[-_]+/g, ' ')
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .trim();
  return spaced.replace(/\S+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}

function slugify(baseName) {
  return baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

let musicTracksPromise = null;

function loadMusicTracks() {
  if (!musicTracksPromise) {
    musicTracksPromise = (async () => {
      const files = fs.readdirSync(MUSIC_DIR).filter((name) => name.toLowerCase().endsWith('.mp3'));

      const tracks = await Promise.all(files.map(async (fileName) => {
        const filePath = path.join(MUSIC_DIR, fileName);
        const baseName = path.basename(fileName, path.extname(fileName));
        const title = await probeTitle(filePath);

        return {
          id: slugify(baseName),
          label: title || humanizeFilename(baseName),
        };
      }));

      tracks.sort((a, b) => a.label.localeCompare(b.label));
      return tracks;
    })();
  }

  return musicTracksPromise;
}

async function getMusicTracks() {
  return loadMusicTracks();
}

module.exports = { getMusicTracks };
