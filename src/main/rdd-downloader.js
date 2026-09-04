const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');
const AdmZip = require('adm-zip');

const HOST = 'https://setup-aws.rbxcdn.com';

const PLAYER_ROOTS = {
  'RobloxApp.zip': '',
  'redist.zip': '',
  'shaders.zip': 'shaders',
  'ssl.zip': 'ssl',
  'WebView2.zip': '',
  'WebView2RuntimeInstaller.zip': 'WebView2RuntimeInstaller',
  'content-avatar.zip': path.join('content', 'avatar'),
  'content-configs.zip': path.join('content', 'configs'),
  'content-fonts.zip': path.join('content', 'fonts'),
  'content-sky.zip': path.join('content', 'sky'),
  'content-sounds.zip': path.join('content', 'sounds'),
  'content-textures2.zip': path.join('content', 'textures'),
  'content-models.zip': path.join('content', 'models'),
  'content-platform-fonts.zip': path.join('PlatformContent', 'pc', 'fonts'),
  'content-platform-dictionaries.zip': path.join('PlatformContent', 'pc', 'shared_compression_dictionaries'),
  'content-terrain.zip': path.join('PlatformContent', 'pc', 'terrain'),
  'content-textures3.zip': path.join('PlatformContent', 'pc', 'textures'),
  'extracontent-luapackages.zip': path.join('ExtraContent', 'LuaPackages'),
  'extracontent-translations.zip': path.join('ExtraContent', 'translations'),
  'extracontent-models.zip': path.join('ExtraContent', 'models'),
  'extracontent-textures.zip': path.join('ExtraContent', 'textures'),
  'extracontent-places.zip': path.join('ExtraContent', 'places'),
};

const APP_SETTINGS = `<?xml version="1.0" encoding="UTF-8"?>
<Settings>
    <ContentFolder>content</ContentFolder>
    <BaseUrl>http://www.roblox.com</BaseUrl>
</Settings>
`;

function getRobloxVersionsDir() {
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  return path.join(localAppData, 'Roblox', 'Versions');
}

function normalizeHash(raw) {
  if (!raw) return null;
  let h = raw.trim().toLowerCase();
  if (!h.startsWith('version-')) h = 'version-' + h;
  return /^version-[0-9a-f]{16}$/i.test(h) ? h : null;
}

let activeDownloadController = null;

async function downloadAndInstallVersion(rawHash, onProgress) {
  const hash = normalizeHash(rawHash);
  if (!hash) {
    throw new Error('Invalid version hash format. Expected 16 hex characters (e.g. version-xxxxxxxxxxxxxxxx)');
  }

  const versionsDir = getRobloxVersionsDir();
  const destDir = path.join(versionsDir, hash);
  const exePath = path.join(destDir, 'RobloxPlayerBeta.exe');

  if (fs.existsSync(exePath)) {
    return { success: true, version: hash, alreadyInstalled: true, path: exePath };
  }

  activeDownloadController = new AbortController();
  const signal = activeDownloadController.signal;

  try {
    if (onProgress) onProgress({ done: 0, total: 1, pkg: 'Manifest', percent: 0, status: 'Fetching package manifest...' });

    const manifestUrl = `${HOST}/${hash}-rbxPkgManifest.txt`;
    const manifestRes = await axios.get(manifestUrl, {
      timeout: 25000,
      signal,
      responseType: 'text'
    });

    if (manifestRes.status !== 200 || !manifestRes.data) {
      throw new Error(`Failed to fetch manifest for ${hash} (HTTP ${manifestRes.status})`);
    }

    const lines = manifestRes.data.split(/\r?\n/);
    const availableZips = new Set(lines.map(l => l.trim()).filter(l => l.endsWith('.zip')));

    const packagesToDownload = Object.keys(PLAYER_ROOTS).filter(pkg => availableZips.has(pkg));
    if (packagesToDownload.length === 0) {
      throw new Error('Manifest contains no matching Windows Player packages.');
    }

    fs.mkdirSync(destDir, { recursive: true });
    const totalCount = packagesToDownload.length;

    for (let i = 0; i < totalCount; i++) {
      const pkg = packagesToDownload[i];
      const subDir = PLAYER_ROOTS[pkg];
      const targetDir = subDir ? path.join(destDir, subDir) : destDir;
      fs.mkdirSync(targetDir, { recursive: true });

      const pkgUrl = `${HOST}/${hash}-${pkg}`;
      const percent = Math.round((i / totalCount) * 100);

      if (onProgress) {
        onProgress({
          done: i,
          total: totalCount,
          pkg,
          percent,
          status: `Downloading ${pkg} (${i + 1}/${totalCount})...`
        });
      }

      const res = await axios.get(pkgUrl, {
        responseType: 'arraybuffer',
        timeout: 120000,
        signal,
        onDownloadProgress: (progressEvent) => {
          if (progressEvent.total && onProgress) {
            const currentPkgFraction = progressEvent.loaded / progressEvent.total;
            const overallPercent = Math.round(((i + currentPkgFraction) / totalCount) * 100);
            onProgress({
              done: i,
              total: totalCount,
              pkg,
              percent: Math.min(99, overallPercent),
              status: `Downloading ${pkg} (${Math.round(currentPkgFraction * 100)}%)...`
            });
          }
        }
      });

      if (onProgress) {
        onProgress({
          done: i,
          total: totalCount,
          pkg,
          percent: Math.round(((i + 0.8) / totalCount) * 100),
          status: `Extracting ${pkg}...`
        });
      }

      const zip = new AdmZip(Buffer.from(res.data));
      zip.extractAllTo(targetDir, true);
    }

    // Write AppSettings.xml
    fs.writeFileSync(path.join(destDir, 'AppSettings.xml'), APP_SETTINGS, 'utf8');

    if (!fs.existsSync(exePath)) {
      throw new Error('Installation completed, but RobloxPlayerBeta.exe was not found.');
    }

    if (onProgress) {
      onProgress({ done: totalCount, total: totalCount, pkg: 'Done', percent: 100, status: 'Installation complete!' });
    }

    return { success: true, version: hash, alreadyInstalled: false, path: exePath };
  } catch (err) {
    if (signal.aborted) {
      throw new Error('Download cancelled by user.');
    }
    throw err;
  } finally {
    activeDownloadController = null;
  }
}

function cancelDownload() {
  if (activeDownloadController) {
    activeDownloadController.abort();
    activeDownloadController = null;
    return true;
  }
  return false;
}

module.exports = {
  getRobloxVersionsDir,
  normalizeHash,
  downloadAndInstallVersion,
  cancelDownload
};
