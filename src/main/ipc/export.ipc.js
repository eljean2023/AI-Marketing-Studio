const { ipcMain, dialog, app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { runExport } = require('../../export/ffmpeg');

function registerExportHandlers() {
  ipcMain.handle('export:save-and-run', async (event, { inputPath, edit, resolution, hasAudio }) => {
    const win = BrowserWindow.fromWebContents(event.sender);

    const outputDir = path.join(app.getAppPath(), 'output');
    fs.mkdirSync(outputDir, { recursive: true });

    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Export MP4',
      defaultPath: path.join(outputDir, `demo-${Date.now()}.mp4`),
      filters: [{ name: 'MP4 Video', extensions: ['mp4'] }],
    });

    if (canceled || !filePath) {
      return { canceled: true };
    }

    // FFmpeg writes for the entire length of the encode, which can be a
    // real amount of time. Writing straight to the user's chosen filename
    // would leave that exact file visible and double-clickable in Explorer
    // the whole time it's still open for writing, so opening it early fails
    // with a sharing-violation error. Render to a temp name in the same
    // folder instead, then rename to the real filename only once FFmpeg has
    // fully finished -- the chosen filename never exists until it's done.
    // The temp name keeps the real .mp4 extension -- FFmpeg picks its
    // output container from the extension, so renaming it away (e.g. to
    // ".tmp") makes muxer selection fail.
    const tempOutputPath = filePath.replace(/(\.[^./\\]+)$/, '.exporting$1');

    const sendProgress = (percent, phase) => {
      event.sender.send('export:progress', { percent, phase });
    };

    try {
      sendProgress(0, 'preparing');
      await runExport({
        inputPath,
        outputPath: tempOutputPath,
        edit,
        resolution,
        hasAudio,
        onProgress: (percent) => sendProgress(percent, 'encoding'),
      });
      sendProgress(100, 'finalizing');
      fs.renameSync(tempOutputPath, filePath);
    } catch (error) {
      fs.rmSync(tempOutputPath, { force: true });
      throw error;
    }

    return { canceled: false, outputPath: filePath };
  });
}

module.exports = { registerExportHandlers };
