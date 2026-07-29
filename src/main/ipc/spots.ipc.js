const { ipcMain, dialog, app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { renderSpot } = require('../../spots/render');

// gif is included here (categorized as an "image" for picker/preview
// purposes, same as Shorts' overlay picker) even though render.js treats it
// as a video-like stream internally for ffmpeg looping -- see
// STILL_IMAGE_EXTENSIONS in src/spots/render.js for that distinction.
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
// Matches the Video Snipping Tool's already-established "common video
// formats" set (see CLAUDE.md), rather than inventing a separate list.
const VIDEO_EXTENSIONS = ['mp4', 'mov', 'mkv', 'webm'];
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'];

const IMAGE_MIME_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};

function registerSpotsHandlers() {
  // Each generated preview is a full rendered MP4 written to temp, same
  // lifecycle as Shorts' own scratch dir -- cleared on every app start since
  // anything left in it is always regeneratable, never the user's only copy.
  const workDir = path.join(app.getPath('temp'), 'demo-recorder-spots');
  fs.rmSync(workDir, { recursive: true, force: true });
  fs.mkdirSync(workDir, { recursive: true });

  ipcMain.handle('spots:pick-background', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);

    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Choose Background',
      properties: ['openFile'],
      filters: [
        { name: 'Images and Videos', extensions: [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS] },
        { name: 'Images', extensions: IMAGE_EXTENSIONS },
        { name: 'Videos', extensions: VIDEO_EXTENSIONS },
      ],
    });

    if (canceled || filePaths.length === 0) {
      return { canceled: true };
    }

    const filePath = filePaths[0];
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const fileType = IMAGE_EXTENSIONS.includes(ext) ? 'image' : 'video';

    return { canceled: false, filePath, fileType };
  });

  // Own tiny copy of Brand Kit's identical helper -- the renderer's CSP
  // img-src only allows 'self' data:, not file:, so a picked background
  // image needs to be read and handed back as a data: URL to preview it.
  ipcMain.handle('spots:read-image-as-data-url', async (event, filePath) => {
    try {
      const ext = path.extname(filePath).slice(1).toLowerCase();
      const mime = IMAGE_MIME_TYPES[ext] || 'application/octet-stream';
      const buffer = fs.readFileSync(filePath);
      return `data:${mime};base64,${buffer.toString('base64')}`;
    } catch (error) {
      return null;
    }
  });

  ipcMain.handle('spots:pick-audio', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);

    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Choose Background Music',
      properties: ['openFile'],
      filters: [{ name: 'Audio Files', extensions: AUDIO_EXTENSIONS }],
    });

    if (canceled || filePaths.length === 0) {
      return { canceled: true };
    }

    return { canceled: false, filePath: filePaths[0] };
  });

  let nextRenderId = 1;

  ipcMain.handle('spots:generate-preview', async (event, {
    backgroundPath, backgroundType, mainMessage, supportingText, cta, logoPath, primaryColor, musicPath,
  }) => {
    const outputPath = path.join(workDir, `spot-${Date.now()}-${nextRenderId++}.mp4`);
    return renderSpot({
      backgroundPath, backgroundType, mainMessage, supportingText, cta, logoPath, primaryColor, musicPath, outputPath,
    });
  });

  ipcMain.handle('spots:export', async (event, { tempPath }) => {
    const win = BrowserWindow.fromWebContents(event.sender);

    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Export Spot',
      defaultPath: path.join(app.getAppPath(), 'output', `spot-${Date.now()}.mp4`),
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

module.exports = { registerSpotsHandlers };
