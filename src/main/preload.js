const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('recorderAPI', {
  getSources: () => ipcRenderer.invoke('recording:get-sources'),
  saveRecording: (arrayBuffer) => ipcRenderer.invoke('recording:save', arrayBuffer),
  exportVideo: (payload) => ipcRenderer.invoke('export:save-and-run', payload),
  // Returns an unsubscribe function so callers can stop listening once the
  // export finishes, instead of accumulating listeners across exports.
  onExportProgress: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('export:progress', listener);
    return () => ipcRenderer.removeListener('export:progress', listener);
  },
});

contextBridge.exposeInMainWorld('snipAPI', {
  openVideo: () => ipcRenderer.invoke('snip:open'),
  cutVideo: (payload) => ipcRenderer.invoke('snip:cut', payload),
  getRecentFiles: () => ipcRenderer.invoke('snip:get-recent-files'),
  addRecentFile: (filePath) => ipcRenderer.invoke('snip:add-recent-file', filePath),
  // Returns an unsubscribe function so callers can stop listening once the
  // cut finishes, instead of accumulating listeners across cuts.
  onCutProgress: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('snip:progress', listener);
    return () => ipcRenderer.removeListener('snip:progress', listener);
  },
});

contextBridge.exposeInMainWorld('shortsAPI', {
  getOptions: () => ipcRenderer.invoke('shorts:get-options'),
  pickOverlay: () => ipcRenderer.invoke('shorts:pick-overlay'),
  generate: (payload) => ipcRenderer.invoke('shorts:generate', payload),
  generateFinal: (payload) => ipcRenderer.invoke('shorts:generate-final', payload),
  exportShort: (payload) => ipcRenderer.invoke('shorts:export', payload),
});

contextBridge.exposeInMainWorld('brandAPI', {
  get: () => ipcRenderer.invoke('brand:get'),
  save: (payload) => ipcRenderer.invoke('brand:save', payload),
  pickLogo: () => ipcRenderer.invoke('brand:pick-logo'),
  pickOverlay: () => ipcRenderer.invoke('brand:pick-overlay'),
  pickIntro: () => ipcRenderer.invoke('brand:pick-intro'),
  pickOutro: () => ipcRenderer.invoke('brand:pick-outro'),
  readImageAsDataUrl: (filePath) => ipcRenderer.invoke('brand:read-image-as-data-url', filePath),
});

contextBridge.exposeInMainWorld('spotsAPI', {
  pickBackground: () => ipcRenderer.invoke('spots:pick-background'),
  pickAudio: () => ipcRenderer.invoke('spots:pick-audio'),
  readImageAsDataUrl: (filePath) => ipcRenderer.invoke('spots:read-image-as-data-url', filePath),
  generatePreview: (payload) => ipcRenderer.invoke('spots:generate-preview', payload),
  export: (payload) => ipcRenderer.invoke('spots:export', payload),
});
