const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),

  // Version management & Downgrader
  listInstalledVersions: () => ipcRenderer.invoke('versions:list-installed'),
  fetchLiveVersions: () => ipcRenderer.invoke('versions:fetch-live'),
  fetchVersionCatalog: () => ipcRenderer.invoke('versions:fetch-catalog'),
  installVersion: (versionHash) => ipcRenderer.invoke('versions:install', versionHash),
  cancelInstall: () => ipcRenderer.invoke('versions:cancel-install'),
  deleteVersion: (versionHash) => ipcRenderer.invoke('versions:delete', versionHash),
  applyFpsCap: (payload) => ipcRenderer.invoke('versions:apply-fps-cap', payload),
  onInstallProgress: (cb) => {
    const listener = (event, progress) => cb(progress);
    ipcRenderer.on('install-progress', listener);
    return () => ipcRenderer.removeListener('install-progress', listener);
  },

  // Launcher & Multi-Instance
  launchInstance: (options) => ipcRenderer.invoke('launcher:spawn', options),
  launchMultiple: (payload) => ipcRenderer.invoke('launcher:spawn-multiple', payload),
  killAllRoblox: () => ipcRenderer.invoke('launcher:kill-all'),
  killPid: (pid) => ipcRenderer.invoke('launcher:kill-pid', pid),
  listInstances: () => ipcRenderer.invoke('instances:list'),
  onInstancesUpdated: (cb) => {
    const listener = (event, instances) => cb(instances);
    ipcRenderer.on('instances-updated', listener);
    return () => ipcRenderer.removeListener('instances-updated', listener);
  },

  // Mixer & Native
  setVolume: (percent) => ipcRenderer.invoke('native:set-volume', percent),
  setAntiAfk: (seconds) => ipcRenderer.invoke('native:set-antiafk', seconds),
  getStatus: () => ipcRenderer.invoke('native:get-status'),
  arrangeWindows: (mode) => ipcRenderer.invoke('native:arrange-windows', mode),
  onPidsUpdated: (cb) => {
    const listener = (event, pids) => cb(pids);
    ipcRenderer.on('pids-updated', listener);
    return () => ipcRenderer.removeListener('pids-updated', listener);
  },
  onMutexStatus: (cb) => {
    const listener = (event, held) => cb(held);
    ipcRenderer.on('mutex-status', listener);
    return () => ipcRenderer.removeListener('mutex-status', listener);
  },

  // Accounts
  listAccounts: () => ipcRenderer.invoke('accounts:list'),
  saveAccounts: (accounts) => ipcRenderer.invoke('accounts:save', accounts),
  validateCookie: (cookie) => ipcRenderer.invoke('accounts:validate-cookie', cookie),
  loginWeb: () => ipcRenderer.invoke('accounts:login-web'),
  cancelWebLogin: () => ipcRenderer.invoke('accounts:cancel-web-login'),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),

  // Shell & Lifecycle
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
  restartApp: () => ipcRenderer.invoke('app:restart')
});
