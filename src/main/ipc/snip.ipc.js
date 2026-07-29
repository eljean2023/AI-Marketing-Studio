const { ipcMain, dialog, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { processVideo } = require('../../snip/process');
const { getRecentFiles, addRecentFile } = require('../../snip/recent-files');

function registerSnipHandlers() {
  ipcMain.handle('snip:open', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);

    const result = await dialog.showOpenDialog(win, {
      title: 'Open Video',
      properties: ['openFile'],
      filters: [{ name: 'Video Files', extensions: ['mp4', 'mov', 'mkv', 'webm'] }],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }

    return { canceled: false, filePath: result.filePaths[0] };
  });

  ipcMain.handle('snip:cut', async (event, { inputPath, start, end, crop, removeSegments }) => {
    const win = BrowserWindow.fromWebContents(event.sender);

    const parsed = path.parse(inputPath);
    const defaultPath = path.join(parsed.dir, `${parsed.name}-cut.mp4`);

    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Save Cut Video',
      defaultPath,
      filters: [{ name: 'MP4 Video', extensions: ['mp4'] }],
    });

    if (canceled || !filePath) {
      return { canceled: true };
    }

    if (path.resolve(filePath) === path.resolve(inputPath)) {
      throw new Error('The output file must be different from the original file. Please choose a different name or location.');
    }

    // Same reasoning as export.ipc.js: FFmpeg writes for the entire length
    // of the cut, which can be a real amount of time for the re-encode
    // fallback / crop / remove-segments paths. Render to a temp name in the
    // same folder first, then rename to the real filename only once FFmpeg
    // has fully finished, so the chosen filename never exists mid-write.
    const tempOutputPath = filePath.replace(/(\.[^./\\]+)$/, '.cutting$1');

    const sendProgress = (percent, phase) => {
      event.sender.send('snip:progress', { percent, phase });
    };

    try {
      sendProgress(0, 'preparing');
      await processVideo({
        inputPath,
        outputPath: tempOutputPath,
        start,
        end,
        crop,
        removeSegments,
        onProgress: ({ percent, phase }) => sendProgress(percent, phase),
      });
      sendProgress(100, 'finalizing');
      fs.renameSync(tempOutputPath, filePath);
    } catch (error) {
      fs.rmSync(tempOutputPath, { force: true });
      throw error;
    }

    return { canceled: false, outputPath: filePath };
  });

  ipcMain.handle('snip:get-recent-files', () => getRecentFiles());

  ipcMain.handle('snip:add-recent-file', (event, filePath) => addRecentFile(filePath));
}

module.exports = { registerSnipHandlers };
