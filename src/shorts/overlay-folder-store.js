const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// Remembers the last folder the user picked a custom overlay from, so the
// file dialog reopens there next time instead of always starting fresh.
// Its own small store, independent from the Video Snipping Tool's
// recent-files.js -- Shorts Creator does not depend on snip/.
function getStorePath() {
  return path.join(app.getPath('userData'), 'shorts-overlay-folder.json');
}

function getLastOverlayFolder() {
  try {
    const raw = fs.readFileSync(getStorePath(), 'utf-8');
    const parsed = JSON.parse(raw);
    return typeof parsed.folder === 'string' ? parsed.folder : null;
  } catch (error) {
    return null;
  }
}

function setLastOverlayFolder(folderPath) {
  fs.mkdirSync(path.dirname(getStorePath()), { recursive: true });
  fs.writeFileSync(getStorePath(), JSON.stringify({ folder: folderPath }, null, 2));
}

module.exports = { getLastOverlayFolder, setLastOverlayFolder };
