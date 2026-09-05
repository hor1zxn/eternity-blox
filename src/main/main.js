const { app, BrowserWindow, ipcMain, shell, nativeImage } = require('electron');
const path = require('path');
const axios = require('axios');
const nativeHelper = require('./native-helper');
const storage = require('./storage');
const { downloadAndInstallVersion, cancelDownload } = require('./rdd-downloader');
const {
  listInstalledVersions,
  fetchLiveVersions,
  fetchVersionCatalog,
  deleteInstalledVersion,
  writeFpsCapToVersion
} = require('./version-manager');
const { launchRobloxInstance, launchMultipleInstances } = require('./roblox-launcher');

// Ensure Windows Taskbar registers the unique AppUserModelID and icon
app.setAppUserModelId('com.eternityblox.launcher');

let mainWindow = null;

// Track active instance sessions mapped to accounts & targets
const runningInstances = new Map();

function trackInstance(pid, data) {
  runningInstances.set(pid, {
    pid,
    accountId: data.accountId || null,
    username: data.username || 'Roblox Instance',
    displayName: data.displayName || data.username || 'Roblox Instance',
    avatarUrl: data.avatarUrl || null,
    version: data.version || 'Default',
    target: data.target || null,
    startTime: Date.now()
  });
  broadcastInstances();
}

function broadcastInstances() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('instances-updated', Array.from(runningInstances.values()));
  }
}

function createWindow() {
  const iconPath = path.join(__dirname, '..', '..', 'resources', 'icon.ico');
  const appIcon = nativeImage.createFromPath(iconPath);

  mainWindow = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 980,
    minHeight: 640,
    frame: false,
    title: 'EternityBlox',
    backgroundColor: '#090a0f',
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  if (!appIcon.isEmpty()) {
    mainWindow.setIcon(appIcon);
  }

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  if (process.argv.includes('--smoke-test')) {
    mainWindow.webContents.on('did-finish-load', () => {
      console.log('[SMOKE-TEST] Window & DOM loaded successfully!');
      setTimeout(() => {
        app.quit();
      }, 1000);
    });
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  createWindow();

  // Start the native helper daemon to own singleton mutex
  try {
    nativeHelper.start();
  } catch (err) {
    console.error('Failed to start native helper:', err);
  }

  // Broadcast events to renderer
  nativeHelper.on('pids', (pids) => {
    const pidSet = new Set(pids);
    for (const trackedPid of runningInstances.keys()) {
      if (!pidSet.has(trackedPid)) {
        runningInstances.delete(trackedPid);
      }
    }
    for (const pid of pids) {
      if (!runningInstances.has(pid)) {
        runningInstances.set(pid, {
          pid,
          accountId: null,
          username: 'Roblox Client',
          displayName: `PID ${pid}`,
          avatarUrl: null,
          version: 'Active',
          target: null,
          startTime: Date.now()
        });
      }
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('pids-updated', pids);
      mainWindow.webContents.send('instances-updated', Array.from(runningInstances.values()));
    }
  });

  nativeHelper.on('mutex-status', (held) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('mutex-status', held);
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  nativeHelper.stop();
});

// Window controls
ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.handle('window:close', () => mainWindow?.close());

// Version & Downgrader IPC
ipcMain.handle('versions:list-installed', () => {
  return listInstalledVersions();
});

ipcMain.handle('versions:fetch-live', async () => {
  return await fetchLiveVersions();
});

ipcMain.handle('versions:fetch-catalog', async () => {
  return await fetchVersionCatalog();
});

ipcMain.handle('versions:install', async (event, versionHash) => {
  return await downloadAndInstallVersion(versionHash, (progress) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('install-progress', progress);
    }
  });
});

ipcMain.handle('versions:cancel-install', () => {
  return cancelDownload();
});

ipcMain.handle('versions:delete', (event, versionHash) => {
  return deleteInstalledVersion(versionHash);
});

ipcMain.handle('versions:apply-fps-cap', (event, { versionHash, fpsCap }) => {
  return writeFpsCapToVersion(versionHash, fpsCap);
});

// Launch IPC
ipcMain.handle('launcher:spawn', async (event, options) => {
  const settings = storage.loadSettings();
  const activeVersion = options.versionHash || settings.activeVersion;
  const target = options.target || settings.gameTarget;
  const res = await launchRobloxInstance({
    versionHash: activeVersion,
    cookie: options.cookie,
    target
  });

  if (res && res.pid) {
    trackInstance(res.pid, {
      pid: res.pid,
      accountId: options.accountId || null,
      username: options.username || (options.cookie ? 'Account Session' : 'Guest Instance'),
      displayName: options.displayName || options.username || 'Roblox Instance',
      avatarUrl: options.avatarUrl || null,
      version: res.version,
      target
    });
  }

  return res;
});

ipcMain.handle('launcher:spawn-multiple', async (event, { count = 1, versionHash = null, target = null }) => {
  const settings = storage.loadSettings();
  const activeVersion = versionHash || settings.activeVersion;
  const t = target || settings.gameTarget;
  const results = await launchMultipleInstances(count, {
    versionHash: activeVersion,
    target: t
  });

  for (const r of results) {
    if (r && r.pid) {
      trackInstance(r.pid, {
        pid: r.pid,
        accountId: null,
        username: 'Multi Instance',
        displayName: `Multi Instance #${r.pid}`,
        avatarUrl: null,
        version: r.version,
        target: t
      });
    }
  }

  return results;
});

ipcMain.handle('instances:list', () => {
  return Array.from(runningInstances.values());
});

ipcMain.handle('launcher:kill-all', () => {
  runningInstances.clear();
  broadcastInstances();
  return nativeHelper.killAllRoblox();
});

ipcMain.handle('launcher:kill-pid', (event, pid) => {
  runningInstances.delete(pid);
  broadcastInstances();
  return nativeHelper.killPid(pid);
});

// Native & Mixer IPC
ipcMain.handle('native:set-volume', async (event, percent) => {
  return await nativeHelper.setVolume(percent);
});

ipcMain.handle('native:set-antiafk', async (event, seconds) => {
  return await nativeHelper.setAntiAfk(seconds);
});

ipcMain.handle('native:get-status', async () => {
  const pids = await nativeHelper.getPids();
  return {
    mutexHeld: nativeHelper.mutexHeld,
    pids,
    runningCount: pids.length
  };
});

ipcMain.handle('native:arrange-windows', (event, mode = 'grid') => {
  const { exec } = require('child_process');
  // Simple powershell window tile script
  const psScript = `
    Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      public class WinPos {
        [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);
        [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
      }
"@
    $procs = Get-Process -Name "RobloxPlayerBeta" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 }
    $count = $procs.Count
    if ($count -eq 0) { exit }

    $screenW = [System.Windows.Forms.SystemInformation]::VirtualScreen.Width
    $screenH = [System.Windows.Forms.SystemInformation]::VirtualScreen.Height
    if ($screenW -eq 0) { $screenW = 1920; $screenH = 1080 }

    if ($count -eq 1) {
      [WinPos]::MoveWindow($procs[0].MainWindowHandle, 50, 50, [int]($screenW * 0.7), [int]($screenH * 0.7), $true)
    } elseif ($count -eq 2) {
      $w = [int]($screenW / 2)
      [WinPos]::MoveWindow($procs[0].MainWindowHandle, 0, 0, $w, $screenH, $true)
      [WinPos]::MoveWindow($procs[1].MainWindowHandle, $w, 0, $w, $screenH, $true)
    } else {
      $cols = 2
      $rows = [Math]::Ceiling($count / 2)
      $w = [int]($screenW / $cols)
      $h = [int]($screenH / $rows)
      for ($i = 0; $i -lt $count; $i++) {
        $c = $i % $cols
        $r = [Math]::Floor($i / $cols)
        [WinPos]::MoveWindow($procs[$i].MainWindowHandle, $c * $w, $r * $h, $w, $h, $true)
      }
    }
  `;
  exec(`powershell -Command "${psScript.replace(/\r?\n/g, ' ')}"`, () => {});
  return true;
});

// Accounts IPC
ipcMain.handle('accounts:list', () => {
  return storage.loadAccounts();
});

ipcMain.handle('accounts:save', (event, accounts) => {
  return storage.saveAccounts(accounts);
});

ipcMain.handle('accounts:validate-cookie', async (event, rawCookie) => {
  if (!rawCookie) return { valid: false, error: 'Empty cookie' };
  const cookie = rawCookie.trim().startsWith('.ROBLOSECURITY=') ? rawCookie.trim() : `.ROBLOSECURITY=${rawCookie.trim()}`;

  try {
    const res = await axios.get('https://users.roblox.com/v1/users/authenticated', {
      headers: { Cookie: cookie },
      timeout: 8000
    });

    if (res.data && res.data.id) {
      const { id, name, displayName } = res.data;
      let avatarUrl = '';
      try {
        const thumbRes = await axios.get(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=150x150&format=Png&isCircular=true`, { timeout: 5000 });
        if (thumbRes.data && thumbRes.data.data && thumbRes.data.data[0]) {
          avatarUrl = thumbRes.data.data[0].imageUrl;
        }
      } catch {}

      return {
        valid: true,
        userId: id,
        username: name,
        displayName: displayName || name,
        avatarUrl,
        cookie
      };
    }
    return { valid: false, error: 'Invalid response from Roblox' };
  } catch (err) {
    return { valid: false, error: err.response?.data?.message || err.message || 'Cookie expired or invalid' };
  }
});

// Settings IPC
ipcMain.handle('settings:get', () => {
  return storage.loadSettings();
});

ipcMain.handle('settings:save', (event, settings) => {
  return storage.saveSettings(settings);
});

ipcMain.handle('shell:open-external', (event, url) => {
  shell.openExternal(url);
});
