const { ipcMain, dialog, app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { VOICES } = require('../../shorts/voices');
const { getMusicTracks, OVERLAYS } = require('../../shorts/assets');
const { renderShort, concatenateSegments } = require('../../shorts/render');
const { getLastOverlayFolder, setLastOverlayFolder } = require('../../shorts/overlay-folder-store');

const OVERLAY_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
const OVERLAY_VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm'];

function registerShortsHandlers() {
  // Each generated preview is a full rendered MP4 written to temp. Unlike
  // the Recorder's own temp recordings (which accumulate indefinitely --
  // a known gap), clear this specific temp folder on every app start,
  // since anything left in it is always regeneratable, never the user's
  // only copy of anything (the only durable copy is wherever they Export
  // to).
  const workDir = path.join(app.getPath('temp'), 'demo-recorder-shorts');
  fs.rmSync(workDir, { recursive: true, force: true });
  fs.mkdirSync(workDir, { recursive: true });

  ipcMain.handle('shorts:get-options', async () => ({
    voices: VOICES.map(({ id, name }) => ({ id, label: name })),
    musicTracks: (await getMusicTracks()).map(({ id, label }) => ({ id, label })),
    overlays: OVERLAYS.map(({ id, label }) => ({ id, label })),
  }));

  ipcMain.handle('shorts:pick-overlay', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);

    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Choose Overlay',
      defaultPath: getLastOverlayFolder() || undefined,
      properties: ['openFile'],
      filters: [
        { name: 'Images and Videos', extensions: [...OVERLAY_IMAGE_EXTENSIONS, ...OVERLAY_VIDEO_EXTENSIONS] },
        { name: 'Images', extensions: OVERLAY_IMAGE_EXTENSIONS },
        { name: 'Videos', extensions: OVERLAY_VIDEO_EXTENSIONS },
      ],
    });

    if (canceled || filePaths.length === 0) {
      return { canceled: true };
    }

    const filePath = filePaths[0];
    setLastOverlayFolder(path.dirname(filePath));

    const ext = path.extname(filePath).slice(1).toLowerCase();
    const fileType = OVERLAY_IMAGE_EXTENSIONS.includes(ext) ? 'image' : 'video';

    return { canceled: false, filePath, fileType };
  });

  let nextRenderId = 1;

  // Renders a single segment (one script -> one MP4). Used both for a
  // per-segment Preview and, once accepted, that same file is reused
  // directly as the segment's contribution to the final concatenated video.
  ipcMain.handle('shorts:generate', async (event, { scriptText, voiceId, musicTrackId, musicVolume, overlayId, customOverlay }) => {
    const outputPath = path.join(workDir, `segment-${Date.now()}-${nextRenderId++}.mp4`);
    return renderShort({ scriptText, voiceId, musicTrackId, musicVolume, overlayId, customOverlay, outputPath });
  });

  ipcMain.handle('shorts:generate-final', async (event, { segmentPaths }) => {
    const outputPath = path.join(workDir, `short-final-${Date.now()}.mp4`);
    return concatenateSegments(segmentPaths, outputPath);
  });

  ipcMain.handle('shorts:export', async (event, { tempPath }) => {
    const win = BrowserWindow.fromWebContents(event.sender);

    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Export Short',
      defaultPath: path.join(app.getAppPath(), 'output', `short-${Date.now()}.mp4`),
      filters: [{ name: 'MP4 Video', extensions: ['mp4'] }],
    });

    if (canceled || !filePath) {
      return { canceled: true };
    }

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.copyFileSync(tempPath, filePath);
    fs.rmSync(tempPath, { force: true });

    return { canceled: false, outputPath: filePath };
  });
}

module.exports = { registerShortsHandlers };
