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

async function resolveShareLink(code, type = 'ExperienceInvite', cookie = null) {
  let authCookie = cookie;
  if (!authCookie) {
    try {
      const storage = require('./storage');
      const accounts = storage.loadAccounts();
      if (accounts && accounts.length > 0 && accounts[0].cookie) {
        authCookie = accounts[0].cookie;
      }
    } catch (e) {
      console.warn('[ShareLinks] Error loading fallback account cookie:', e.message);
    }
  }

  const cookieHeader = authCookie ? (authCookie.trim().startsWith('.ROBLOSECURITY=') ? authCookie.trim() : `.ROBLOSECURITY=${authCookie.trim()}`) : '';

  try {
    const res1 = await fetch('https://apis.roblox.com/sharelinks/v1/resolve-link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader ? { 'Cookie': cookieHeader } : {})
      },
      body: JSON.stringify({ linkId: code, linkType: type })
    });

    const csrf = res1.headers.get('x-csrf-token');
    if (!csrf) return null;

    const res2 = await fetch('https://apis.roblox.com/sharelinks/v1/resolve-link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrf,
        ...(cookieHeader ? { 'Cookie': cookieHeader } : {})
      },
      body: JSON.stringify({ linkId: code, linkType: type })
    });

    if (!res2.ok) return null;
    const data = await res2.json();

    if (data.experienceInviteData && data.experienceInviteData.placeId) {
      const { placeId, instanceId } = data.experienceInviteData;
      if (instanceId) {
        return {
          placeId: String(placeId),
          gameId: String(instanceId),
          requestType: 'RequestGameJob'
        };
      }
      return {
        placeId: String(placeId),
        requestType: 'RequestGame'
      };
    }

    if (data.privateServerInviteData && data.privateServerInviteData.placeId) {
      const { placeId, linkCode, accessCode } = data.privateServerInviteData;
      return {
        placeId: String(placeId),
        linkCode: linkCode || undefined,
        accessCode: accessCode || undefined,
        requestType: 'RequestPrivateGame'
      };
    }
  } catch (err) {
    console.error('[ShareLinks] Failed to resolve share link:', err.message);
  }

  return null;
}

async function parseGameTarget(target, cookie = null) {
  if (!target) return null;
  target = String(target).trim();
  if (!target) return null;

  // Check if target is a Roblox share link (e.g. /share?code=...&type=ExperienceInvite or /share-links?code=...)
  const codeMatch = target.match(/[?&]code=([a-zA-Z0-9_-]+)/i);
  if (codeMatch) {
    const typeMatch = target.match(/[?&]type=([a-zA-Z0-9_-]+)/i);
    const linkType = typeMatch ? typeMatch[1] : 'ExperienceInvite';
    const linkId = codeMatch[1];
    console.log(`[Launcher] Detected share link (Code: ${linkId}, Type: ${linkType}). Resolving via Roblox API...`);
    const resolved = await resolveShareLink(linkId, linkType, cookie);
    if (resolved) {
      console.log(`[Launcher] Successfully resolved share link to placeId ${resolved.placeId}!`);
      return resolved;
    }
    console.warn(`[Launcher] Could not resolve share link with code: ${linkId}`);
  }

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

let lastSpawnPid = null;
let lastSpawnTime = 0;

async function launchRobloxInstance({ versionHash = null, cookie = null, target = null }) {
  const resolved = resolveExecutable(versionHash);
  if (!resolved) {
    throw new Error('No installed Roblox version found. Please download or select a version first.');
  }

  const { exePath, version } = resolved;
  console.log(`[Launcher] Launching Roblox (${version}) at ${exePath}`);

  let ticket = null;
  if (cookie) {
    ticket = await getAuthTicket(cookie);
    if (!ticket) {
      throw new Error('Failed to acquire Roblox authentication ticket. The account session/cookie may have expired or is invalid.');
    }
  }

  const parsedTarget = await parseGameTarget(target, cookie);
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

  // Fast Mutex Handshake: If another instance was spawned recently (< 15s ago),
  // actively poll until its singleton event is registered & closed (takes only ~2s instead of 15s!)
  if (lastSpawnPid && (Date.now() - lastSpawnTime < 15000)) {
    console.log(`[Launcher] Previous instance PID ${lastSpawnPid} spawned recently. Running fast singleton handshake...`);
    await nativeHelper.fastSingletonHandshake(4500);
  } else {
    // Ensure singleton handles across running clients are cleared
    await nativeHelper.closeHandles();
  }

  const child = spawn(exePath, [launchArg], {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();

  lastSpawnPid = child.pid;
  lastSpawnTime = Date.now();

  // Automatically snap window into 2x2 layout tile the instant its game window appears
  nativeHelper.waitForWindow(child.pid, 12000).then(ready => {
    if (ready) {
      nativeHelper.tile2x2();
    }
  }).catch(() => {});

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
    try {
      const res = await launchRobloxInstance(options);
      results.push(res);
      if (res && res.pid && i < count - 1) {
        await nativeHelper.fastSingletonHandshake(4500);
      }
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
