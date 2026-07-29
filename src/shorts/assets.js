const fs = require('fs');
const path = require('path');

const { probeTitle } = require('./run-ffmpeg');

const ASSETS_DIR = path.join(__dirname, '..', '..', 'assets', 'shorts');
const MUSIC_DIR = path.join(ASSETS_DIR, 'music');

const OVERLAYS = [
  { id: 'aurora', label: 'Aurora (blue/violet)', file: path.join(ASSETS_DIR, 'overlays', 'aurora.mp4') },
  { id: 'ember', label: 'Ember (orange/red)', file: path.join(ASSETS_DIR, 'overlays', 'ember.mp4') },
  { id: 'pulse', label: 'Pulse (teal/navy)', file: path.join(ASSETS_DIR, 'overlays', 'pulse.mp4') },
];

// Turns a bare filename like "music1" or "corporate" into a readable label
// ("Music 1", "Corporate") when the file has no embedded ID3 title.
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

// Music tracks are discovered from assets/shorts/music/ at runtime rather
// than hardcoded per file, so dropping a new mp3 in that folder is enough
// to make it selectable -- no code change needed. Cached for the process
// lifetime since the bundled folder doesn't change while the app is running.
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
          file: filePath,
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

async function getMusicTrack(id) {
  const tracks = await loadMusicTracks();
  return tracks.find((track) => track.id === id) || null;
}

function getOverlay(id) {
  return OVERLAYS.find((overlay) => overlay.id === id) || null;
}

module.exports = {
  OVERLAYS,
  getMusicTracks,
  getMusicTrack,
  getOverlay,
};
