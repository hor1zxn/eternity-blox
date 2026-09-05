const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('splashApi', {
  onStatus: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('updater:status', listener);
    return () => ipcRenderer.removeListener('updater:status', listener);
  },
  onClosing: (callback) => {
    const listener = (event) => callback();
    ipcRenderer.on('splash:closing', listener);
    return () => ipcRenderer.removeListener('splash:closing', listener);
  }
});
