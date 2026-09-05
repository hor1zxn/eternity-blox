const { app } = require('electron');
const axios = require('axios');

let autoUpdater = null;
try {
  const updaterModule = require('electron-updater');
  autoUpdater = updaterModule.autoUpdater;
  if (autoUpdater) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowPrerelease = false;
  }
} catch (err) {
  console.log('[Updater] electron-updater not initialized, using cloud API fallback:', err.message);
}

function compareSemver(v1, v2) {
  const clean1 = (v1 || '').replace(/^v/i, '').trim();
  const clean2 = (v2 || '').replace(/^v/i, '').trim();
  const parts1 = clean1.split('.').map(x => parseInt(x, 10) || 0);
  const parts2 = clean2.split('.').map(x => parseInt(x, 10) || 0);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const n1 = parts1[i] || 0;
    const n2 = parts2[i] || 0;
    if (n1 > n2) return 1;
    if (n1 < n2) return -1;
  }
  return 0;
}

class AppUpdater {
  constructor(notifyCallback) {
    this.notify = notifyCallback || (() => {});
    this.currentVersion = app.getVersion();
    this.repoOwner = 'hor1zxn';
    this.repoName = 'eternity-blox';
  }

  async check() {
    this.notify({
      state: 'checking',
      message: 'Checking for updates...',
      version: this.currentVersion
    });

    const checkPromise = new Promise(async (resolve) => {
      // 1. Packaged electron-updater path (Production installer updates)
      if (app.isPackaged && autoUpdater) {
        let updateHandled = false;

        const onChecking = () => {
          this.notify({ state: 'checking', message: 'Querying GitHub releases...' });
        };

        const onAvailable = (info) => {
          updateHandled = true;
          this.notify({
            state: 'downloading',
            message: `Downloading v${info.version}...`,
            percent: 0
          });
        };

        const onNotAvailable = () => {
          if (!updateHandled) {
            cleanup();
            resolve({ hasUpdate: false });
          }
        };

        const onProgress = (prog) => {
          this.notify({
            state: 'downloading',
            message: `Downloading update (${Math.round(prog.percent)}%)...`,
            percent: prog.percent,
            speed: prog.bytesPerSecond
          });
        };

        const onDownloaded = (info) => {
          cleanup();
          this.notify({
            state: 'ready',
            message: `Update v${info.version} ready. Restarting...`,
            percent: 100
          });
          setTimeout(() => {
            try {
              autoUpdater.quitAndInstall(false, true);
            } catch {
              resolve({ hasUpdate: true, downloaded: true });
            }
          }, 1200);
          resolve({ hasUpdate: true, downloaded: true });
        };

        const onError = (err) => {
          console.warn('[Updater] autoUpdater error:', err?.message || err);
          cleanup();
          // Fallback to GitHub API check on error
          this.checkViaGitHubApi().then(resolve);
        };

        const cleanup = () => {
          autoUpdater.removeListener('checking-for-update', onChecking);
          autoUpdater.removeListener('update-available', onAvailable);
          autoUpdater.removeListener('update-not-available', onNotAvailable);
          autoUpdater.removeListener('download-progress', onProgress);
          autoUpdater.removeListener('update-downloaded', onDownloaded);
          autoUpdater.removeListener('error', onError);
        };

        autoUpdater.on('checking-for-update', onChecking);
        autoUpdater.on('update-available', onAvailable);
        autoUpdater.on('update-not-available', onNotAvailable);
        autoUpdater.on('download-progress', onProgress);
        autoUpdater.on('update-downloaded', onDownloaded);
        autoUpdater.on('error', onError);

        try {
          await autoUpdater.checkForUpdates();
        } catch (err) {
          cleanup();
          this.checkViaGitHubApi().then(resolve);
        }
        return;
      }

      // 2. Direct GitHub Releases API path (Development / unbundled / standalone)
      const res = await this.checkViaGitHubApi();
      resolve(res);
    });

    // 4-Second Maximum Timeout Guard: never hang the splash screen
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => {
        resolve({ hasUpdate: false, timeout: true });
      }, 4000);
    });

    try {
      const result = await Promise.race([checkPromise, timeoutPromise]);
      if (result.hasUpdate && result.downloaded) {
        return result;
      }

      this.notify({
        state: 'ready',
        message: 'Up to date • Launching',
        version: this.currentVersion
      });
      await new Promise(r => setTimeout(r, 650));
      return result;
    } catch (err) {
      console.warn('[Updater] Unexpected error during update check:', err.message);
      this.notify({
        state: 'ready',
        message: 'Engine Ready • Launching',
        version: this.currentVersion
      });
      await new Promise(r => setTimeout(r, 500));
      return { hasUpdate: false, error: err.message };
    }
  }

  async checkViaGitHubApi() {
    try {
      const url = `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/releases/latest`;
      const res = await axios.get(url, {
        timeout: 3200,
        headers: {
          'User-Agent': `EternityBlox/${this.currentVersion}`
        }
      });

      if (!res || !res.data) {
        return { hasUpdate: false };
      }

      const latestTag = res.data.tag_name || res.data.name || '';
      const hasNewer = compareSemver(latestTag, this.currentVersion) > 0;

      if (hasNewer) {
        console.log(`[Updater] New version detected: ${latestTag} (current: ${this.currentVersion})`);
        this.notify({
          state: 'downloading',
          message: `New version ${latestTag} available!`,
          percent: 50
        });

        // Find binary installer asset if available
        const assets = res.data.assets || [];
        const installerAsset = assets.find(a => a.name && (a.name.endsWith('.exe') || a.name.endsWith('.zip')));
        return {
          hasUpdate: true,
          version: latestTag,
          releaseNotes: res.data.body,
          downloadUrl: installerAsset ? installerAsset.browser_download_url : res.data.html_url
        };
      }

      return { hasUpdate: false, latestVersion: latestTag };
    } catch (err) {
      // 404 means no releases published yet on repo; network error means offline
      if (err.response && err.response.status === 404) {
        console.log('[Updater] No GitHub releases found yet on repository. Clean build.');
      } else {
        console.log('[Updater] GitHub check skipped/offline:', err.message);
      }
      return { hasUpdate: false };
    }
  }
}

module.exports = {
  AppUpdater
};
