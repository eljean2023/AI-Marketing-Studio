const { ipcMain, dialog, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { getBrandKit, saveBrandKit } = require('../../brand/brand-store');
const { getLastFolder, setLastFolder } = require('../../brand/brand-folder-store');
const { getMusicTracks } = require('../../brand/music-library');

const LOGO_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
const OVERLAY_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
const OVERLAY_VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm'];
const VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm'];

const IMAGE_MIME_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};

async function pickFile(event, { kind, title, extensions, filterName }) {
  const win = BrowserWindow.fromWebContents(event.sender);

  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title,
    defaultPath: getLastFolder(kind) || undefined,
    properties: ['openFile'],
    filters: [{ name: filterName, extensions }],
  });

  if (canceled || filePaths.length === 0) {
    return { canceled: true };
  }

  const filePath = filePaths[0];
  setLastFolder(kind, path.dirname(filePath));

  return { canceled: false, filePath };
}

function registerBrandHandlers() {
  ipcMain.handle('brand:get', async () => ({
    brandKit: getBrandKit(),
    musicTracks: await getMusicTracks(),
  }));

  ipcMain.handle('brand:save', async (event, brandKit) => {
    saveBrandKit(brandKit);
    return { success: true };
  });

  ipcMain.handle('brand:pick-logo', async (event) => pickFile(event, {
    kind: 'logo',
    title: 'Choose Logo',
    extensions: LOGO_EXTENSIONS,
    filterName: 'Images',
  }));

  ipcMain.handle('brand:pick-overlay', async (event) => {
    const result = await pickFile(event, {
      kind: 'overlay',
      title: 'Choose Overlay',
      extensions: [...OVERLAY_IMAGE_EXTENSIONS, ...OVERLAY_VIDEO_EXTENSIONS],
      filterName: 'Images and Videos',
    });

    if (result.canceled) return result;

    const ext = path.extname(result.filePath).slice(1).toLowerCase();
    const fileType = OVERLAY_IMAGE_EXTENSIONS.includes(ext) ? 'image' : 'video';

    return { ...result, fileType };
  });

  ipcMain.handle('brand:pick-intro', async (event) => pickFile(event, {
    kind: 'intro',
    title: 'Choose Intro Video',
    extensions: VIDEO_EXTENSIONS,
    filterName: 'Videos',
  }));

  ipcMain.handle('brand:pick-outro', async (event) => pickFile(event, {
    kind: 'outro',
    title: 'Choose Outro Video',
    extensions: VIDEO_EXTENSIONS,
    filterName: 'Videos',
  }));

  // Logo/overlay-image previews go through this rather than a raw
  // file:// <img src>, since the renderer's CSP img-src only allows
  // 'self' data: (unlike media-src, which already allows file: for
  // <video>/<audio>).
  ipcMain.handle('brand:read-image-as-data-url', async (event, filePath) => {
    try {
      const ext = path.extname(filePath).slice(1).toLowerCase();
      const mime = IMAGE_MIME_TYPES[ext] || 'application/octet-stream';
      const buffer = fs.readFileSync(filePath);
      return `data:${mime};base64,${buffer.toString('base64')}`;
    } catch (error) {
      return null;
    }
  });
}

module.exports = { registerBrandHandlers };
