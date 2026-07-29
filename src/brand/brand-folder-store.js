const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// Remembers the last folder used for each Brand Kit asset picker
// (logo/overlay/intro/outro) independently, so each dialog reopens where
// that specific kind of file was last picked from. Its own small store,
// independent from Shorts's overlay-folder-store.js and Snip's
// recent-files.js -- Brand Kit does not depend on either.
function getStorePath() {
  return path.join(app.getPath('userData'), 'brand-folders.json');
}

function readAll() {
  try {
    const raw = fs.readFileSync(getStorePath(), 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    return {};
  }
}

function getLastFolder(kind) {
  const folders = readAll();
  return typeof folders[kind] === 'string' ? folders[kind] : null;
}

function setLastFolder(kind, folderPath) {
  const folders = readAll();
  folders[kind] = folderPath;
  fs.mkdirSync(path.dirname(getStorePath()), { recursive: true });
  fs.writeFileSync(getStorePath(), JSON.stringify(folders, null, 2));
}

module.exports = { getLastFolder, setLastFolder };
