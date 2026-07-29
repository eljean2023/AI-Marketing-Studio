const { app, BrowserWindow } = require('electron');
const path = require('path');
const { registerRecordingHandlers } = require('./ipc/recording.ipc');
const { registerExportHandlers } = require('./ipc/export.ipc');
const { registerSnipHandlers } = require('./ipc/snip.ipc');
const { registerShortsHandlers } = require('./ipc/shorts.ipc');
const { registerBrandHandlers } = require('./ipc/brand.ipc');
const { registerSpotsHandlers } = require('./ipc/spots.ipc');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#121212',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  registerRecordingHandlers();
  registerExportHandlers();
  registerSnipHandlers();
  registerShortsHandlers();
  registerBrandHandlers();
  registerSpotsHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
