const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const MAX_RECENT_FILES = 10;

function getStorePath() {
  return path.join(app.getPath('userData'), 'recent-files.json');
}

function readAll() {
  try {
    const raw = fs.readFileSync(getStorePath(), 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function writeAll(entries) {
  fs.mkdirSync(path.dirname(getStorePath()), { recursive: true });
  fs.writeFileSync(getStorePath(), JSON.stringify(entries, null, 2));
}

// Prunes entries whose file no longer exists on disk, persisting the pruned
// result so a stale entry is only ever reported once.
function getRecentFiles() {
  const entries = readAll();
  const pruned = entries.filter((entry) => fs.existsSync(entry.path));

  if (pruned.length !== entries.length) {
    writeAll(pruned);
  }

  return pruned;
}

function addRecentFile(filePath) {
  const deduped = readAll().filter((entry) => entry.path !== filePath);
  deduped.unshift({ path: filePath, openedAt: Date.now() });

  const trimmed = deduped.slice(0, MAX_RECENT_FILES);
  writeAll(trimmed);

  return trimmed;
}

module.exports = { getRecentFiles, addRecentFile, getStorePath };
