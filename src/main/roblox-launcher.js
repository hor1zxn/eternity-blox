const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const nativeHelper = require('./native-helper');
const { listInstalledVersions } = require('./version-manager');
const { getRobloxVersionsDir, normalizeHash } = require('./rdd-downloader');

async function getAuthTicket(cookie) {
  if (!cookie) return null;
  const cleanCookie = cookie.trim().startsWith('.ROBLOSECURITY=') ? cookie.trim() : `.ROBLOSECURITY=${cookie.trim()}`;

  try {
    // Step 1: obtain CSRF token
    let csrfToken = '';
    try {
      await axios.post('https://auth.roblox.com/v2/login', {}, {
        headers: { Cookie: cleanCookie }
      });
    } catch (err) {
      if (err.response && err.response.headers['x-csrf-token']) {
        csrfToken = err.response.headers['x-csrf-token'];
      }
    }

    if (!csrfToken) {
      console.warn('Could not acquire CSRF token for authentication ticket');
      return null;
    }

    // Step 2: request authentication ticket
    const ticketRes = await axios.post('https://auth.roblox.com/v1/authentication-ticket', {}, {
      headers: {
        Cookie: cleanCookie,
        'x-csrf-token': csrfToken,
        'Referer': 'https://www.roblox.com/'
      }
    });

    const ticket = ticketRes.headers['rbx-authentication-ticket'];
    return ticket || null;
  } catch (err) {
    console.error('Failed to get auth ticket:', err.response ? err.response.data : err.message);
    return null;
  }
}

function parseGameTarget(target) {
  if (!target) return null;
  target = String(target).trim();
  if (!target) return null;

  // 1. Raw numeric placeId
  if (/^\d+$/.test(target)) {
    return {
      placeId: target,
      requestType: 'RequestGame'
    };
  }

  // 2. Extract placeId from /games/123456/... or placeId=123456
  let placeId = null;
  const matchPath = target.match(/\/games\/(\d+)/i);
  if (matchPath) placeId = matchPath[1];
  if (!placeId) {
    const matchParam = target.match(/[?&]placeId=(\d+)/i);
    if (matchParam) placeId = matchParam[1];
  }

  // 3. Extract private server linkCode or accessCode
  const linkCodeMatch = target.match(/[?&](?:privateServerLinkCode|linkCode)=([a-zA-Z0-9_-]+)/i);
  const accessCodeMatch = target.match(/[?&]accessCode=([a-zA-Z0-9_-]+)/i);

  // 4. Extract gameInstanceId or jobId
  const jobMatch = target.match(/[?&](?:gameInstanceId|gameId|jobId)=([a-zA-Z0-9_-]+)/i);

  if (!placeId) {
    const digitMatch = target.match(/\b(\d{5,12})\b/);
    if (digitMatch) placeId = digitMatch[1];
  }

  if (!placeId) return null;

  if (linkCodeMatch) {
    return {
      placeId,
      linkCode: linkCodeMatch[1],
      requestType: 'RequestPrivateGame'
    };
  }

  if (accessCodeMatch) {
    return {
      placeId,
      accessCode: accessCodeMatch[1],
      requestType: 'RequestPrivateGame'
    };
  }

  if (jobMatch) {
    return {
      placeId,
      gameId: jobMatch[1],
      requestType: 'RequestGameJob'
    };
  }

  return {
    placeId,
    requestType: 'RequestGame'
  };
}

function buildPlaceLauncherUrl(parsedTarget) {
  if (!parsedTarget || !parsedTarget.placeId) return '';
  const { placeId, requestType, linkCode, accessCode, gameId } = parsedTarget;

  if (requestType === 'RequestPrivateGame' && linkCode) {
    return `https://assetgame.roblox.com/game/placelauncher.ashx?request=RequestPrivateGame&placeId=${placeId}&linkCode=${linkCode}`;
  }
  if (requestType === 'RequestPrivateGame' && accessCode) {
    return `https://assetgame.roblox.com/game/placelauncher.ashx?request=RequestPrivateGame&placeId=${placeId}&accessCode=${accessCode}`;
  }
  if (requestType === 'RequestGameJob' && gameId) {
    return `https://assetgame.roblox.com/game/placelauncher.ashx?request=RequestGameJob&placeId=${placeId}&gameId=${gameId}`;
  }

  return `https://assetgame.roblox.com/game/placelauncher.ashx?request=RequestGame&placeId=${placeId}&isPlayTogetherGame=false`;
}

function resolveExecutable(versionHash) {
  const versionsDir = getRobloxVersionsDir();
  if (versionHash) {
    const norm = normalizeHash(versionHash);
    if (norm) {
      const candidate = path.join(versionsDir, norm, 'RobloxPlayerBeta.exe');
      if (fs.existsSync(candidate)) return { exePath: candidate, version: norm };
    }
  }

  // Fallback to newest installed version
  const installed = listInstalledVersions();
  if (installed.length > 0) {
    return { exePath: installed[0].exePath, version: installed[0].hash };
  }

  return null;
}

async function launchRobloxInstance({ versionHash = null, cookie = null, target = null }) {
  const resolved = resolveExecutable(versionHash);
  if (!resolved) {
    throw new Error('No installed Roblox version found. Please download or select a version first.');
  }

  const { exePath, version } = resolved;
  console.log(`[Launcher] Launching Roblox (${version}) at ${exePath}`);

  // CRITICAL: Close singleton handles in all running instances right before spawn!
  await nativeHelper.closeHandles();

  let ticket = null;
  if (cookie) {
    ticket = await getAuthTicket(cookie);
  }

  const parsedTarget = parseGameTarget(target);
  const launcherUrl = buildPlaceLauncherUrl(parsedTarget);
  const launchTime = Date.now();
  const browserId = Math.floor(1000000000000 + Math.random() * 9000000000000);

  let launchArg = '--app';
  if (launcherUrl) {
    launchArg = `roblox-player:1+launchmode:play+gameinfo:${ticket || ''}+launchtime:${launchTime}+placelauncherurl:${encodeURIComponent(launcherUrl)}+browsertrackerid:${browserId}+robloxLocale:en_us+gameLocale:en_us+channel:`;
    console.log(`[Launcher] Joining game: ${parsedTarget.placeId} (Request: ${parsedTarget.requestType})`);
  } else if (ticket) {
    launchArg = `roblox-player:1+launchmode:app+gameinfo:${ticket}+launchtime:${launchTime}+browsertrackerid:${browserId}+robloxLocale:en_us+gameLocale:en_us+channel:`;
    console.log('[Launcher] Opening authenticated App Home');
  }

  const child = spawn(exePath, [launchArg], {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();

  return {
    success: true,
    pid: child.pid,
    version,
    exePath
  };
}

async function launchMultipleInstances(count = 1, options = {}) {
  const results = [];
  for (let i = 0; i < count; i++) {
    if (i > 0) {
      // Stagger launches
      await new Promise(r => setTimeout(r, 1200));
    }
    try {
      const res = await launchRobloxInstance(options);
      results.push(res);
    } catch (err) {
      results.push({ success: false, error: err.message });
    }
  }
  return results;
}

module.exports = {
  launchRobloxInstance,
  launchMultipleInstances,
  resolveExecutable,
  parseGameTarget,
  buildPlaceLauncherUrl,
  parsePlaceId: (t) => {
    const p = parseGameTarget(t);
    return p ? p.placeId : null;
  }
};
