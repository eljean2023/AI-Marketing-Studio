const { ipcMain, desktopCapturer, app } = require('electron');
const fs = require('fs');
const path = require('path');

function registerRecordingHandlers() {
  ipcMain.handle('recording:get-sources', async () => {
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      thumbnailSize: { width: 320, height: 180 },
    });

    return sources.map((source) => ({
      id: source.id,
      name: source.name,
      thumbnailDataUrl: source.thumbnail.toDataURL(),
    }));
  });

  ipcMain.handle('recording:save', async (_event, arrayBuffer) => {
    const dir = path.join(app.getPath('temp'), 'demo-recorder');
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `recording-${Date.now()}.webm`);
    fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
    return filePath;
  });
}

module.exports = { registerRecordingHandlers };
