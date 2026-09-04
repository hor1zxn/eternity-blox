const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { getRobloxVersionsDir, normalizeHash } = require('./rdd-downloader');

const CLIENT_SETTINGS_URL = 'https://clientsettings.roblox.com/v2/client-version/WindowsPlayer';
const SETUP_VERSION_URL = 'https://setup.rbxcdn.com/version';
const TIREX_VERSION_URL = 'https://raw.githubusercontent.com/dyr14n/tirex-downgrader/main/version.txt';
const HISTORY_URL = 'https://raw.githubusercontent.com/MaximumADHD/Roblox-Client-Tracker/roblox/version-history.json';

let cachedCatalog = null;
let lastCatalogFetch = 0;

function listInstalledVersions() {
  const base = getRobloxVersionsDir();
  if (!fs.existsSync(base)) return [];

  try {
    const entries = fs.readdirSync(base, { withFileTypes: true });
    const versions = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const name = entry.name.toLowerCase();
      if (!name.startsWith('version-')) continue;

      const fullPath = path.join(base, entry.name);
      const exePath = path.join(fullPath, 'RobloxPlayerBeta.exe');
      if (!fs.existsSync(exePath)) continue;

      try {
        const stat = fs.statSync(exePath);
        versions.push({
          hash: name,
          path: fullPath,
          exePath,
          installedAt: stat.mtimeMs,
          sizeBytes: stat.size,
          dateStr: new Date(stat.mtimeMs).toLocaleDateString() + ' ' + new Date(stat.mtimeMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
      } catch {}
    }

    versions.sort((a, b) => b.installedAt - a.installedAt);
    return versions;
  } catch (err) {
    console.error('Failed to list installed versions:', err);
    return [];
  }
}

async function fetchLiveVersions() {
  const result = {
    liveClientVersion: '',
    liveHash: '',
    setupHash: '',
    tirexRecommendedHash: 'version-e380c8edc8f6477c' // default fallback
  };

  try {
    const res = await axios.get(CLIENT_SETTINGS_URL, { timeout: 8000 });
    if (res.data) {
      result.liveClientVersion = res.data.version || '';
      result.liveHash = res.data.clientVersionUpload || '';
    }
  } catch (err) {
    console.warn('Failed to fetch clientsettings version:', err.message);
  }

  try {
    const res = await axios.get(SETUP_VERSION_URL, { timeout: 6000 });
    if (res.data && typeof res.data === 'string') {
      result.setupHash = res.data.trim();
      if (!result.liveHash) result.liveHash = result.setupHash;
    }
  } catch (err) {
    console.warn('Failed to fetch setup version:', err.message);
  }

  try {
    const res = await axios.get(TIREX_VERSION_URL, { timeout: 6000 });
    if (res.data && typeof res.data === 'string' && res.data.trim()) {
      result.tirexRecommendedHash = res.data.trim();
    }
  } catch (err) {
    console.warn('Failed to fetch TiRex recommended version:', err.message);
  }

  return result;
}

async function fetchVersionCatalog() {
  const now = Date.now();
  if (cachedCatalog && now - lastCatalogFetch < 10 * 60 * 1000) {
    return cachedCatalog;
  }

  try {
    const res = await axios.get(HISTORY_URL, { timeout: 12000 });
    if (res.data && typeof res.data === 'object') {
      const list = [];
      for (const [ver, hash] of Object.entries(res.data)) {
        list.push({
          versionString: ver,
          hash: hash.trim()
        });
      }
      // Reverse to have newest first
      list.reverse();
      cachedCatalog = list;
      lastCatalogFetch = now;
      return list;
    }
  } catch (err) {
    console.warn('Failed to fetch version history catalog:', err.message);
  }

  return cachedCatalog || [];
}

function deleteInstalledVersion(rawHash) {
  const hash = normalizeHash(rawHash);
  if (!hash) throw new Error('Invalid version hash');
  const base = getRobloxVersionsDir();
  const targetDir = path.join(base, hash);

  if (!fs.existsSync(targetDir)) {
    throw new Error('That version directory does not exist.');
  }

  fs.rmSync(targetDir, { recursive: true, force: true });
  return true;
}

function writeFpsCapToVersion(rawHash, fpsCap = 0) {
  const hash = normalizeHash(rawHash);
  if (!hash) return false;
  const base = getRobloxVersionsDir();
  const settingsDir = path.join(base, hash, 'ClientSettings');
  const settingsFile = path.join(settingsDir, 'ClientAppSettings.json');

  try {
    fs.mkdirSync(settingsDir, { recursive: true });
    let current = {};
    if (fs.existsSync(settingsFile)) {
      try {
        current = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
      } catch {}
    }

    if (fpsCap > 0) {
      current.DFIntTaskSchedulerTargetFps = fpsCap;
    } else {
      current.DFIntTaskSchedulerTargetFps = 9999; // uncapped
    }

    fs.writeFileSync(settingsFile, JSON.stringify(current, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Failed to write FPS cap:', err);
    return false;
  }
}

module.exports = {
  listInstalledVersions,
  fetchLiveVersions,
  fetchVersionCatalog,
  deleteInstalledVersion,
  writeFpsCapToVersion
};
