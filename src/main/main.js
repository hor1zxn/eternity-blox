const { app, BrowserWindow, ipcMain, shell, nativeImage, session } = require('electron');
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
const { AppUpdater } = require('./updater');

// Ensure Windows Taskbar registers the unique AppUserModelID and icon
app.setAppUserModelId('com.eternityblox.launcher');

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
  process.exit(0);
}

let mainWindow = null;
let splashWindow = null;
let appUpdater = null;

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// Track active instance sessions mapped to accounts & targets
const runningInstances = new Map();
const recentLaunches = [];

function trackInstance(pid, data) {
  runningInstances.set(pid, {
    pid,
    accountId: data.accountId || null,
    username: data.username || 'Roblox Instance',
    displayName: data.displayName || data.username || 'Roblox Instance',
    avatarUrl: data.avatarUrl || null,
    version: data.version || 'Default',
    target: data.target || null,
    startTime: data.startTime || Date.now()
  });
  broadcastInstances();
}

function broadcastInstances() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('instances-updated', Array.from(runningInstances.values()));
  }
}

function createSplashWindow() {
  const iconPath = path.join(__dirname, '..', '..', 'resources', 'icon.ico');
  const appIcon = nativeImage.createFromPath(iconPath);

  splashWindow = new BrowserWindow({
    width: 480,
    height: 290,
    frame: false,
    transparent: true,
    resizable: false,
    center: true,
    show: true,
    backgroundColor: '#00000000',
    icon: appIcon,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'splash-preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  if (!appIcon.isEmpty()) {
    splashWindow.setIcon(appIcon);
  }

  splashWindow.loadFile(path.join(__dirname, '..', 'renderer', 'splash.html'));

  splashWindow.on('closed', () => {
    splashWindow = null;
  });
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
    show: false,
    title: 'EternityBlox',
    backgroundColor: '#090a0f',
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
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

  // Security: Prevent navigating away from the local application
  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });

  // Security: Only allow trusted external web links to open in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        shell.openExternal(url);
      }
    } catch (e) {
      console.warn('[Security] Blocked invalid external URL:', url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  const isHeadlessTest = process.argv.includes('--smoke-test');

  if (!isHeadlessTest) {
    createSplashWindow();
  }
  createWindow();

  appUpdater = new AppUpdater((status) => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.webContents.send('updater:status', status);
    }
  });

  // Start the native helper daemon to own singleton mutex
  try {
    nativeHelper.start();
  } catch (err) {
    console.error('Failed to start native helper:', err);
  }

  if (isHeadlessTest) {
    mainWindow.show();
  } else {
    // Perform update check and wait for main window load in parallel
    const updateCheckPromise = appUpdater.check();
    const windowLoadedPromise = new Promise((resolve) => {
      if (mainWindow.webContents.isLoading()) {
        mainWindow.webContents.once('did-finish-load', resolve);
      } else {
        resolve();
      }
    });

    const [updateResult] = await Promise.all([updateCheckPromise, windowLoadedPromise]);

    // If update downloaded and app will restart, keep splash active
    if (updateResult && updateResult.hasUpdate && updateResult.downloaded) {
      return;
    }

    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.webContents.send('splash:closing');
    }

    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.focus();
      }
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
        splashWindow = null;
      }
    }, 400);
  }

  // Broadcast events to renderer
  nativeHelper.on('pids', (pids) => {
    const pidSet = new Set(pids);
    const now = Date.now();

    // 1. Remove stale tracked PIDs that are no longer alive (with a 6-second grace period for newly spawned PIDs)
    for (const [trackedPid, inst] of runningInstances.entries()) {
      if (!pidSet.has(trackedPid) && (now - (inst.startTime || 0) > 6000)) {
        runningInstances.delete(trackedPid);
      }
    }

    // 2. Reconcile alive PIDs
    for (const pid of pids) {
      const existing = runningInstances.get(pid);
      if (!existing || !existing.accountId) {
        // Look for an unmatched recent launch with an accountId
        const activeAccountIds = new Set(
          Array.from(runningInstances.values())
            .filter(i => i.pid !== pid && i.accountId)
            .map(i => String(i.accountId))
        );

        const match = recentLaunches
          .slice()
          .reverse()
          .find(r => r.accountId && !activeAccountIds.has(String(r.accountId)) && (!r.matchedPid || r.matchedPid === pid) && (now - r.timestamp < 60000));

        if (match) {
          match.matchedPid = pid;
          runningInstances.set(pid, {
            pid,
            accountId: match.accountId,
            username: match.username,
            displayName: match.displayName,
            avatarUrl: match.avatarUrl,
            version: match.version || 'Active',
            target: match.target || null,
            startTime: match.timestamp
          });
        } else if (!existing) {
          runningInstances.set(pid, {
            pid,
            accountId: null,
            username: 'Roblox Client',
            displayName: `PID ${pid}`,
            avatarUrl: null,
            version: 'Active',
            target: null,
            startTime: now
          });
        }
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
  storage.updateSettings({ fpsCap });
  return writeFpsCapToVersion(versionHash, fpsCap);
});

// Launch IPC
ipcMain.handle('launcher:spawn', async (event, options) => {
  const settings = storage.loadSettings();
  const activeVersion = options.versionHash || settings.activeVersion;
  const target = options.target || settings.gameTarget;

  // Zero-Trust Security: Resolve account cookie directly in main Node process
  const secureCookie = options.cookie || (options.accountId ? storage.getAccountCookie(options.accountId) : null);

  if (options.accountId && !secureCookie) {
    throw new Error(`Authentication cookie for account "${options.username || options.displayName || 'Account'}" is missing or could not be decrypted. Please re-add or re-login this account.`);
  }

  const res = await launchRobloxInstance({
    versionHash: activeVersion,
    cookie: secureCookie,
    target
  });

  const launchRecord = {
    accountId: options.accountId || null,
    username: options.username || (options.cookie ? 'Account Session' : 'Guest Instance'),
    displayName: options.displayName || options.username || 'Roblox Instance',
    avatarUrl: options.avatarUrl || null,
    version: res.version,
    target,
    initialPid: res.pid,
    timestamp: Date.now(),
    matchedPid: null
  };
  recentLaunches.push(launchRecord);
  if (recentLaunches.length > 50) recentLaunches.shift();

  if (res && res.pid) {
    trackInstance(res.pid, launchRecord);
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

ipcMain.handle('native:set-instance-volume', async (event, pid, percent) => {
  return await nativeHelper.setInstanceVolume(pid, percent);
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

ipcMain.handle('native:is-window-ready', async (event, pid) => {
  return await nativeHelper.isWindowReady(pid);
});

ipcMain.handle('native:close-singleton-handles', async () => {
  return await nativeHelper.closeHandles();
});

ipcMain.handle('native:get-pids', async () => {
  return await nativeHelper.getPids();
});

ipcMain.handle('native:arrange-windows', async (event, mode = 'grid') => {
  return await nativeHelper.tile2x2();
});

ipcMain.handle('native:tile-2x2', async (event, pid, slot) => {
  return await nativeHelper.tile2x2(pid, slot);
});

// Accounts IPC - Zero-Trust Cookie Model
// The renderer process is NEVER sent raw .ROBLOSECURITY cookies
ipcMain.handle('accounts:list', () => {
  return storage.getSanitizedAccounts();
});

ipcMain.handle('accounts:save', (event, accounts) => {
  return storage.saveAccounts(accounts);
});

ipcMain.handle('accounts:delete', (event, accountId) => {
  return storage.deleteAccount(accountId);
});

async function validateRobloxCookie(rawCookie) {
  if (!rawCookie) return { valid: false, error: 'Empty cookie' };
  const trimmed = rawCookie.trim();
  const cookie = trimmed.startsWith('.ROBLOSECURITY=') ? trimmed : `.ROBLOSECURITY=${trimmed}`;

  for (let attempt = 1; attempt <= 3; attempt++) {
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
    } catch (err) {
      if (attempt === 3) {
        return { valid: false, error: err.response?.data?.message || err.message || 'Cookie expired or invalid' };
      }
      await new Promise(r => setTimeout(r, 600));
    }
  }
  return { valid: false, error: 'Invalid response from Roblox API' };
}

ipcMain.handle('accounts:validate-cookie', async (event, rawCookie) => {
  const check = await validateRobloxCookie(rawCookie);
  if (check.valid) {
    // Return sanitized status (without cookie) to validate credentials safely
    const { cookie, ...sanitized } = check;
    return sanitized;
  }
  return check;
});

ipcMain.handle('accounts:add-manual', async (event, { rawCookie, nickname }) => {
  const check = await validateRobloxCookie(rawCookie);
  if (!check.valid) {
    return check;
  }

  const accountData = {
    id: String(Date.now()),
    userId: check.userId,
    username: check.username,
    displayName: check.displayName,
    nickname: (nickname || '').trim() || check.displayName || check.username,
    avatarUrl: check.avatarUrl,
    addedAt: Date.now()
  };

  storage.addOrUpdateAccount(accountData, check.cookie);

  return {
    valid: true,
    account: {
      ...accountData,
      hasCookie: true
    }
  };
});

let loginWebWindow = null;

ipcMain.handle('accounts:login-web', async () => {
  if (loginWebWindow && !loginWebWindow.isDestroyed()) {
    loginWebWindow.focus();
    return { valid: false, error: 'A login window is already open.' };
  }

  return new Promise((resolve) => {
    let finished = false;
    const partition = `roblox_login_${Date.now()}`;
    const loginSession = session.fromPartition(partition);

    loginWebWindow = new BrowserWindow({
      width: 500,
      height: 740,
      minWidth: 420,
      minHeight: 560,
      center: true,
      title: 'Sign In to Roblox - EternityBlox',
      icon: nativeImage.createFromPath(path.join(__dirname, '..', '..', 'resources', 'icon.ico')),
      modal: false,
      autoHideMenuBar: true,
      backgroundColor: '#101014',
      webPreferences: {
        partition,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true
      }
    });

    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
    loginWebWindow.webContents.setUserAgent(userAgent);

    // Security: Domain Whitelist Guard - Only allow official Roblox and auth challenge domains
    const isAllowedAuthDomain = (navUrl) => {
      try {
        const parsed = new URL(navUrl);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
        const host = parsed.hostname.toLowerCase();
        return (
          host.endsWith('.roblox.com') ||
          host === 'roblox.com' ||
          host.endsWith('.rbxcdn.com') ||
          host.endsWith('.arkoselabs.com') ||
          host.endsWith('.funcaptcha.com') ||
          host.endsWith('.google.com') ||
          host.endsWith('.apple.com')
        );
      } catch {
        return false;
      }
    };

    loginWebWindow.webContents.on('will-navigate', (event, navUrl) => {
      if (!isAllowedAuthDomain(navUrl)) {
        console.warn('[Security] Blocked unauthorized navigation in login window:', navUrl);
        event.preventDefault();
      }
    });

    loginWebWindow.webContents.on('will-redirect', (event, navUrl) => {
      if (!isAllowedAuthDomain(navUrl)) {
        console.warn('[Security] Blocked unauthorized redirect in login window:', navUrl);
        event.preventDefault();
      }
    });

    loginWebWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (isAllowedAuthDomain(url)) {
        return { action: 'allow' };
      }
      console.warn('[Security] Blocked unauthorized popup in login window:', url);
      return { action: 'deny' };
    });

    loginWebWindow.loadURL('https://www.roblox.com/login');

    const handleCookieCapture = async (cookieValue) => {
      if (finished) return;
      finished = true;
      try {
        const validated = await validateRobloxCookie(cookieValue);

        // Security: Immediately wipe session storage, cookies, and cache from memory
        try {
          await loginSession.clearStorageData();
          await loginSession.clearCache();
        } catch (clearErr) {
          console.warn('[Security] Error clearing login partition cache:', clearErr.message);
        }

        if (loginWebWindow && !loginWebWindow.isDestroyed()) {
          loginWebWindow.close();
        }

        if (validated.valid) {
          const accountData = {
            id: String(Date.now()),
            userId: validated.userId,
            username: validated.username,
            displayName: validated.displayName,
            nickname: validated.displayName || validated.username,
            avatarUrl: validated.avatarUrl,
            addedAt: Date.now()
          };

          // Save account securely with Windows DPAPI directly in main process
          storage.addOrUpdateAccount(accountData, validated.cookie);

          // Return sanitized account (NO raw cookie sent to renderer!)
          resolve({
            valid: true,
            account: {
              ...accountData,
              hasCookie: true
            }
          });
        } else {
          resolve(validated);
        }
      } catch (err) {
        if (loginWebWindow && !loginWebWindow.isDestroyed()) {
          loginWebWindow.close();
        }
        resolve({ valid: false, error: err.message });
      }
    };

    const checkCookies = async () => {
      if (finished) return;
      try {
        const cookies = await loginSession.cookies.get({ name: '.ROBLOSECURITY' });
        if (cookies && cookies.length > 0) {
          for (const c of cookies) {
            if (c.value && c.value.length > 50) {
              await handleCookieCapture(c.value);
              return;
            }
          }
        }
      } catch {}
    };

    loginSession.cookies.on('changed', (event, cookie, cause, removed) => {
      if (!removed && cookie.name === '.ROBLOSECURITY' && cookie.value && cookie.value.length > 50) {
        handleCookieCapture(cookie.value);
      }
    });

    const pollInterval = setInterval(checkCookies, 1000);

    loginWebWindow.webContents.on('did-navigate', checkCookies);
    loginWebWindow.webContents.on('did-navigate-in-page', checkCookies);

    loginWebWindow.on('closed', async () => {
      clearInterval(pollInterval);
      loginWebWindow = null;
      try {
        await loginSession.clearStorageData();
        await loginSession.clearCache();
      } catch {}
      if (!finished) {
        finished = true;
        resolve({ valid: false, cancelled: true });
      }
    });
  });
});

ipcMain.handle('accounts:cancel-web-login', () => {
  if (loginWebWindow && !loginWebWindow.isDestroyed()) {
    loginWebWindow.close();
    return true;
  }
  return false;
});

ipcMain.handle('app:restart', () => {
  app.relaunch();
  app.exit(0);
});

// Settings IPC
ipcMain.handle('settings:get', () => {
  return storage.loadSettings();
});

ipcMain.handle('settings:save', (event, settings) => {
  return storage.saveSettings(settings);
});

// Security: Enforce strict URL protocol validation before opening in system shell
ipcMain.handle('shell:open-external', (event, url) => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      shell.openExternal(url);
    } else {
      console.warn('[Security] Blocked non-http(s) protocol in shell:open-external:', url);
    }
  } catch (e) {
    console.warn('[Security] Invalid URL passed to shell:open-external:', url);
  }
});

// Updater Manual Check IPC
ipcMain.handle('updater:check', async () => {
  if (!appUpdater) {
    appUpdater = new AppUpdater();
  }
  return await appUpdater.checkViaGitHubApi();
});
