// MultiBlox - Application Controller (Black & White Premium Edition)
document.addEventListener('DOMContentLoaded', async () => {
  // Application State
  const state = {
    settings: {},
    installedVersions: [],
    catalog: [],
    accounts: [],
    runningPids: [],
    liveInfo: {},
    activeVersion: ''
  };

  // Window Controls
  const btnMinimize = document.getElementById('btn-minimize');
  const btnMaximize = document.getElementById('btn-maximize');
  const btnClose = document.getElementById('btn-close');

  btnMinimize?.addEventListener('click', () => window.api.minimize());
  btnMaximize?.addEventListener('click', () => window.api.maximize());
  btnClose?.addEventListener('click', () => window.api.close());

  // Navigation & Sub-Deck Tabs
  const navItems = document.querySelectorAll('.nav-item[data-tab]');
  const pages = document.querySelectorAll('.page');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetId = item.dataset.tab;
      navItems.forEach(n => n.classList.remove('active'));
      pages.forEach(p => p.classList.remove('active'));
      item.classList.add('active');
      const targetPage = document.getElementById(targetId);
      if (targetPage) targetPage.classList.add('active');
    });
  });

  const deckTabs = document.querySelectorAll('.deck-tab[data-view]');
  const deckViews = document.querySelectorAll('.deck-view');

  deckTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.dataset.view;
      deckTabs.forEach(t => t.classList.remove('active'));
      deckViews.forEach(v => v.classList.remove('active'));
      tab.classList.add('active');
      const targetView = document.getElementById(targetId);
      if (targetView) targetView.classList.add('active');
    });
  });

  // Header Elements
  const mutexPill = document.getElementById('mutex-pill');
  const mutexLabel = document.getElementById('mutex-label');
  const instanceCountLabel = document.getElementById('instance-count-label');
  const headerActiveVer = document.getElementById('header-active-ver');
  const badgeActiveVer = document.getElementById('badge-active-ver');
  const sidebarActiveVersion = document.getElementById('sidebar-active-version');
  const badgeAccountCount = document.getElementById('badge-account-count');
  const badgePidsCount = document.getElementById('badge-pids-count');
  const activePidsBadge = document.getElementById('active-pids-badge');

  // Cockpit Flight Deck Elements
  const cockpitActiveHash = document.getElementById('cockpit-active-hash');
  const btnCopyActiveHash = document.getElementById('btn-copy-active-hash');
  const cockpitSizeVal = document.getElementById('cockpit-size-val');
  const cockpitPidsVal = document.getElementById('cockpit-pids-val');
  const btnCockpitLaunch = document.getElementById('btn-cockpit-launch');
  const btnCockpitSpawn = document.getElementById('btn-cockpit-spawn');
  const cockpitPlaceId = document.getElementById('cockpit-place-id');
  const btnCockpitSaveTarget = document.getElementById('btn-cockpit-save-target');
  const cockpitToggleAfk = document.getElementById('cockpit-toggle-afk');
  const cockpitAfkLabel = document.getElementById('cockpit-afk-label');
  const cockpitBtnTile = document.getElementById('cockpit-btn-tile');
  const cockpitBtnSplit = document.getElementById('cockpit-btn-split');
  const cockpitBtnKill = document.getElementById('cockpit-btn-kill');
  const badgeInstalledCount = document.getElementById('badge-installed-count');
  const badgeDeckAccounts = document.getElementById('badge-deck-accounts');

  // Version Manager Elements
  const btnQuickLaunch = document.getElementById('btn-quick-launch');
  const btnDowngradeLaunch = document.getElementById('btn-downgrade-launch');
  const btnLaunchMore = document.getElementById('btn-launch-more');
  const customHashInput = document.getElementById('custom-hash-input');
  const btnInstallCustom = document.getElementById('btn-install-custom');
  const installedVersionsContainer = document.getElementById('installed-versions-container');
  const btnRefreshInstalled = document.getElementById('btn-refresh-installed');
  const catalogSearch = document.getElementById('catalog-search');
  const catalogTableBody = document.getElementById('catalog-table-body');

  // Modals
  const downloadModal = document.getElementById('download-modal');
  const dlStatusText = document.getElementById('dl-status-text');
  const dlPercentText = document.getElementById('dl-percent-text');
  const dlProgressBar = document.getElementById('dl-progress-bar');
  const dlPkgText = document.getElementById('dl-pkg-text');
  const btnCancelDownload = document.getElementById('btn-cancel-download');

  const addAccountModal = document.getElementById('add-account-modal');
  const btnOpenAddAccount = document.getElementById('btn-open-add-account');
  const btnCloseAccountModal = document.getElementById('btn-close-account-modal');
  const btnCancelAccount = document.getElementById('btn-cancel-account');
  const btnSaveAccount = document.getElementById('btn-save-account');
  const cookieInput = document.getElementById('cookie-input');
  const nicknameInput = document.getElementById('nickname-input');
  const accountValidateStatus = document.getElementById('account-validate-status');

  // Accounts Elements
  const accountsContainer = document.getElementById('accounts-container');
  const globalGameTarget = document.getElementById('global-game-target');
  const btnSaveTarget = document.getElementById('btn-save-target');
  const btnLaunchAllAccounts = document.getElementById('btn-launch-all-accounts');
  const btnKillAll = document.getElementById('btn-kill-all');
  const navKillAll = document.getElementById('nav-kill-all');

  // Mixer Elements
  const volumeSlider = document.getElementById('volume-slider');
  const volValue = document.getElementById('vol-value');
  const antiAfkToggle = document.getElementById('anti-afk-toggle');
  const afkSlider = document.getElementById('afk-slider');
  const afkCadenceLabel = document.getElementById('afk-cadence-label');
  const btnArrangeGrid = document.getElementById('btn-arrange-grid');
  const btnArrangeSplit = document.getElementById('btn-arrange-split');
  const pidsTableBody = document.getElementById('pids-table-body');
  const btnKillAllMixer = document.getElementById('btn-kill-all-mixer');
  const fpsButtons = document.querySelectorAll('.fps-btn');

  // Settings Elements
  const versionsDirDisplay = document.getElementById('versions-dir-display');
  const btnOpenVersionsDir = document.getElementById('btn-open-versions-dir');
  const logConsole = document.getElementById('log-console');
  const btnClearLogs = document.getElementById('btn-clear-logs');

  // Monospace Logger
  function log(msg, type = 'info') {
    if (!logConsole) return;
    const el = document.createElement('div');
    el.className = `log-line ${type === 'err' ? 'err' : type === 'ok' ? 'ok' : ''}`;
    const time = new Date().toLocaleTimeString([], { hour12: false });
    el.textContent = `[${time}] ${msg}`;
    logConsole.appendChild(el);
    logConsole.scrollTop = logConsole.scrollHeight;
  }

  // App Initialization
  async function init() {
    try {
      state.settings = await window.api.getSettings();
      state.activeVersion = state.settings.activeVersion || '';
      if (state.settings.gameTarget) {
        if (globalGameTarget) globalGameTarget.value = state.settings.gameTarget;
        if (cockpitPlaceId) cockpitPlaceId.value = state.settings.gameTarget;
      }

      log('Initializing EternityBlox Black & White Edition...');
      await loadInstalledVersions();
      await fetchLiveDeployData();
      await loadAccounts();
      await loadStatus();
      loadVersionCatalog(); // background fetch
      updateActiveVersionDisplay();
    } catch (err) {
      log(`Initialization error: ${err.message}`, 'err');
    }
  }

  // Load Installed Builds
  async function loadInstalledVersions() {
    try {
      const list = await window.api.listInstalledVersions();
      state.installedVersions = list;
      renderInstalledVersions();

      if (list.length > 0 && !state.activeVersion) {
        state.activeVersion = list[0].hash;
        updateActiveVersionDisplay();
      }

      if (versionsDirDisplay) {
        if (list.length > 0) {
          versionsDirDisplay.textContent = list[0].path.split(list[0].hash)[0];
        } else {
          versionsDirDisplay.textContent = '%LOCALAPPDATA%\\Roblox\\Versions';
        }
      }
      if (badgeInstalledCount) badgeInstalledCount.textContent = list.length;
    } catch (err) {
      log(`Failed to list installed versions: ${err.message}`, 'err');
    }
  }

  function renderInstalledVersions() {
    if (!installedVersionsContainer) return;
    if (state.installedVersions.length === 0) {
      installedVersionsContainer.innerHTML = '<div style="color:var(--t3); padding:24px; text-align:center; font-size:12.5px; grid-column:1/-1;">No Roblox builds found on disk. Download one with 1-Click Downgrade or install a version from the catalog!</div>';
      return;
    }

    installedVersionsContainer.innerHTML = state.installedVersions.map(v => {
      const isActive = v.hash === state.activeVersion;
      const sizeMB = (v.sizeBytes / (1024 * 1024)).toFixed(1);
      return `
        <div class="ver-card ${isActive ? 'active-build' : ''}">
          <div>
            <div class="ver-card-top">
              <span class="ver-card-hash">${v.hash}</span>
              ${isActive ? '<span class="badge b-white">ACTIVE</span>' : ''}
            </div>
            <div class="ver-card-meta">
              <span>${v.dateStr}</span>
              <span>${sizeMB} MB</span>
            </div>
          </div>
          <div class="ver-card-actions">
            <button class="btn ${isActive ? 'btn-primary' : 'btn-ghost'} btn-sm" onclick="window.setActiveVersion('${v.hash}')">
              ${isActive ? 'Active Target' : 'Set Active'}
            </button>
            <button class="btn btn-ghost btn-sm" onclick="window.launchSpecificVersion('${v.hash}')">
              <span class="material-icons-round">play_arrow</span>
              <span>Launch</span>
            </button>
            <button class="btn btn-ghost btn-sm" title="Delete build" onclick="window.deleteVersionPrompt('${v.hash}')">
              <span class="material-icons-round" style="color:var(--red);">delete</span>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  window.setActiveVersion = (hash) => {
    state.activeVersion = hash;
    window.api.saveSettings({ activeVersion: hash });
    updateActiveVersionDisplay();
    renderInstalledVersions();
    log(`Selected build target: ${hash}`, 'ok');
  };

  window.launchSpecificVersion = async (hash) => {
    try {
      const target = (cockpitPlaceId?.value || globalGameTarget?.value || '').trim();
      log(`Launching instance of ${hash}...`);
      const res = await window.api.launchInstance({ versionHash: hash, target });
      log(`Launched Roblox (PID: ${res.pid}) with build ${res.version}!`, 'ok');
    } catch (err) {
      log(`Launch failed: ${err.message}`, 'err');
    }
  };

  window.deleteVersionPrompt = async (hash) => {
    if (confirm(`Are you sure you want to delete ${hash} from your disk?`)) {
      try {
        await window.api.deleteVersion(hash);
        log(`Deleted build ${hash}`, 'ok');
        await loadInstalledVersions();
      } catch (err) {
        log(`Delete failed: ${err.message}`, 'err');
      }
    }
  };

  function updateActiveVersionDisplay() {
    const disp = state.activeVersion || 'Default';
    if (headerActiveVer) headerActiveVer.textContent = disp.startsWith('version-') ? disp.slice(0, 16) : disp;
    if (badgeActiveVer) badgeActiveVer.textContent = state.activeVersion ? 'Pinned' : 'Target';
    if (sidebarActiveVersion) sidebarActiveVersion.textContent = state.activeVersion || 'Auto (Latest)';
    if (cockpitActiveHash) cockpitActiveHash.textContent = state.activeVersion || 'Auto (Latest)';

    const matched = state.installedVersions.find(v => v.hash === state.activeVersion);
    if (cockpitSizeVal) {
      if (matched && matched.sizeBytes) {
        cockpitSizeVal.textContent = (matched.sizeBytes / (1024 * 1024)).toFixed(1) + ' MB';
      } else {
        cockpitSizeVal.textContent = state.installedVersions.length > 0 ? 'Ready' : '-- MB';
      }
    }
    if (badgeInstalledCount) badgeInstalledCount.textContent = state.installedVersions.length;
    if (badgeDeckAccounts) badgeDeckAccounts.textContent = state.accounts.length;
  }

  // Fetch Live Deploy Data
  async function fetchLiveDeployData() {
    try {
      const live = await window.api.fetchLiveVersions();
      state.liveInfo = live;
      if (live.tirexRecommendedHash) {
        state.recommendedVersion = live.tirexRecommendedHash;
        if (recommendedVer) recommendedVer.textContent = live.tirexRecommendedHash;
      }

      if (currentLiveVer) currentLiveVer.textContent = live.liveClientVersion || '0.737.x';
      if (currentLiveHash) currentLiveHash.textContent = live.liveHash || 'version-e7d81637d42c4b23';
      log(`Live Roblox: ${live.liveClientVersion || 'Online'} (${live.liveHash || ''})`);
    } catch (err) {
      log(`Failed to fetch live version info: ${err.message}`, 'err');
    }
  }

  // Version Catalog Browser
  async function loadVersionCatalog() {
    try {
      const catalog = await window.api.fetchVersionCatalog();
      state.catalog = catalog;
      renderCatalogTable(catalog);
    } catch (err) {
      log(`Catalog load warning: ${err.message}`, 'err');
    }
  }

  function renderCatalogTable(list) {
    if (!catalogTableBody) return;
    if (!list || list.length === 0) {
      catalogTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px; color: var(--t3);">Catalog loading...</td></tr>';
      return;
    }

    const installedSet = new Set(state.installedVersions.map(v => v.hash));
    const query = (catalogSearch?.value || '').trim().toLowerCase();
    const filtered = list.filter(item => {
      if (!query) return true;
      return item.versionString.toLowerCase().includes(query) || item.hash.toLowerCase().includes(query);
    }).slice(0, 35);

    catalogTableBody.innerHTML = filtered.map(item => {
      const isInstalled = installedSet.has(item.hash);
      const isActive = item.hash === state.activeVersion;
      return `
        <tr>
          <td><strong style="color:#fff; font-family:'JetBrains Mono',monospace;">${item.versionString}</strong></td>
          <td class="table-hash">${item.hash}</td>
          <td>
            ${isInstalled
              ? `<span class="badge b-white">${isActive ? 'ACTIVE' : 'INSTALLED'}</span>`
              : `<span class="badge b-dark">REMOTE CDN</span>`}
          </td>
          <td style="text-align: right;">
            ${isInstalled
              ? `<button class="btn btn-ghost btn-sm" onclick="window.launchSpecificVersion('${item.hash}')">Launch</button>`
              : `<button class="btn btn-primary btn-sm" onclick="window.downloadBuild('${item.hash}')">Download & Use</button>`}
          </td>
        </tr>
      `;
    }).join('');
  }

  catalogSearch?.addEventListener('input', () => {
    renderCatalogTable(state.catalog);
  });

  // Download Build Engine
  window.downloadBuild = async (hash) => {
    if (!downloadModal) return;
    downloadModal.classList.add('active');
    dlProgressBar.style.width = '0%';
    dlPercentText.textContent = '0%';
    dlStatusText.textContent = `Connecting to Roblox CDN for ${hash}...`;
    dlPkgText.textContent = 'Preparing manifest...';

    log(`Starting download for ${hash}...`);
    try {
      const res = await window.api.installVersion(hash);
      log(`Installed ${hash} successfully!`, 'ok');
      downloadModal.classList.remove('active');
      await loadInstalledVersions();
      window.setActiveVersion(hash);
      return res;
    } catch (err) {
      log(`Download failed: ${err.message}`, 'err');
      alert(`Installation failed: ${err.message}`);
      downloadModal.classList.remove('active');
      throw err;
    }
  };

  window.api.onInstallProgress((progress) => {
    if (dlProgressBar) dlProgressBar.style.width = `${progress.percent}%`;
    if (dlPercentText) dlPercentText.textContent = `${progress.percent}%`;
    if (dlStatusText) dlStatusText.textContent = progress.status;
    if (dlPkgText) dlPkgText.textContent = `Package: ${progress.pkg} (${progress.done + 1}/${progress.total})`;
  });

  btnCancelDownload?.addEventListener('click', () => {
    window.api.cancelInstall();
    downloadModal.classList.remove('active');
    log('Download cancelled by user.', 'err');
  });

  // Launch Active Build (Shared Handler)
  async function launchActiveBuild() {
    let targetHash = state.activeVersion;
    if (!targetHash && state.installedVersions.length > 0) {
      targetHash = state.installedVersions[0].hash;
      state.activeVersion = targetHash;
      window.api.saveSettings({ activeVersion: targetHash });
      updateActiveVersionDisplay();
      renderInstalledVersions();
    }

    if (!targetHash) {
      log('No Roblox build selected. Please install or select a build below.', 'err');
      alert('No active Roblox build selected. Please install or choose a version from the installed list or catalog below.');
      return;
    }

    const target = (cockpitPlaceId?.value || globalGameTarget?.value || '').trim();
    log(`Spawning active Roblox build (${targetHash})...`);
    try {
      const res = await window.api.launchInstance({ versionHash: targetHash, target });
      log(`Launched Roblox (PID: ${res.pid}) with build ${res.version}!`, 'ok');
    } catch (err) {
      log(`Launch failed: ${err.message}`, 'err');
    }
  }

  // Launch More Instances (Shared Handler)
  async function spawnMultiInstance() {
    let targetHash = state.activeVersion;
    if (!targetHash && state.installedVersions.length > 0) {
      targetHash = state.installedVersions[0].hash;
      state.activeVersion = targetHash;
      window.api.saveSettings({ activeVersion: targetHash });
      updateActiveVersionDisplay();
      renderInstalledVersions();
    }

    const target = (cockpitPlaceId?.value || globalGameTarget?.value || '').trim();
    log('Spawning additional Roblox instance...');
    try {
      const res = await window.api.launchMultiple({ count: 1, versionHash: targetHash, target });
      if (res && res[0] && res[0].success) {
        log(`Spawned instance (PID: ${res[0].pid})!`, 'ok');
      }
    } catch (err) {
      log(`Launch more error: ${err.message}`, 'err');
    }
  }

  btnCockpitLaunch?.addEventListener('click', launchActiveBuild);
  btnQuickLaunch?.addEventListener('click', launchActiveBuild);
  btnCockpitSpawn?.addEventListener('click', spawnMultiInstance);
  btnLaunchMore?.addEventListener('click', spawnMultiInstance);

  // Cockpit Action Tools
  btnCopyActiveHash?.addEventListener('click', () => {
    if (state.activeVersion) {
      navigator.clipboard.writeText(state.activeVersion);
      log(`Copied build hash to clipboard: ${state.activeVersion}`, 'ok');
    }
  });

  btnCockpitSaveTarget?.addEventListener('click', () => {
    const t = (cockpitPlaceId?.value || '').trim();
    window.api.saveSettings({ gameTarget: t });
    if (globalGameTarget) globalGameTarget.value = t;
    log(`Saved default target: ${t || 'Home'}`, 'ok');
  });

  cockpitToggleAfk?.addEventListener('click', () => {
    if (!antiAfkToggle) return;
    antiAfkToggle.checked = !antiAfkToggle.checked;
    antiAfkToggle.dispatchEvent(new Event('change'));
  });

  function syncCockpitAfkState(enabled) {
    if (!cockpitToggleAfk || !cockpitAfkLabel) return;
    if (enabled) {
      cockpitToggleAfk.classList.add('active');
      cockpitAfkLabel.textContent = 'Anti-AFK: ON';
    } else {
      cockpitToggleAfk.classList.remove('active');
      cockpitAfkLabel.textContent = 'Anti-AFK: OFF';
    }
  }

  cockpitBtnTile?.addEventListener('click', () => {
    window.api.arrangeWindows('grid');
    log('Arranged Roblox windows in 2x2 grid.', 'ok');
  });

  cockpitBtnSplit?.addEventListener('click', () => {
    window.api.arrangeWindows('split');
    log('Arranged Roblox windows side-by-side.', 'ok');
  });

  cockpitBtnKill?.addEventListener('click', () => {
    window.api.killAllRoblox();
    log('Terminated all Roblox processes.', 'err');
  });

  // Custom Hash Input Button
  btnInstallCustom?.addEventListener('click', async () => {
    const val = customHashInput?.value.trim();
    if (!val) {
      alert('Please enter a 16-hex version hash (e.g. version-e380c8edc8f6477c)');
      return;
    }
    let norm = val.toLowerCase();
    if (!norm.startsWith('version-')) norm = 'version-' + norm;
    if (!/^version-[0-9a-f]{16}$/i.test(norm)) {
      alert('Invalid version hash format. Expected 16 hexadecimal characters.');
      return;
    }
    await window.downloadBuild(norm);
  });

  btnRefreshInstalled?.addEventListener('click', async () => {
    await loadInstalledVersions();
    log('Refreshed local version list.', 'ok');
  });

  // --- ACCOUNTS TAB ---
  async function loadAccounts() {
    try {
      const list = await window.api.listAccounts();
      state.accounts = list || [];
      if (badgeAccountCount) badgeAccountCount.textContent = state.accounts.length;
      renderAccounts();
    } catch (err) {
      log(`Failed to load accounts: ${err.message}`, 'err');
    }
  }

  function renderAccounts() {
    if (!accountsContainer) return;
    if (state.accounts.length === 0) {
      accountsContainer.innerHTML = '<div style="color:var(--t3); padding:32px; text-align:center; font-size:12.5px; grid-column:1/-1;">No accounts saved yet. Click "Add Account" to paste a .ROBLOSECURITY cookie!</div>';
      return;
    }

    accountsContainer.innerHTML = state.accounts.map(acc => {
      const avatarSrc = acc.avatarUrl || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="%2352525b"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>';
      return `
        <div class="acc-card">
          <div class="acc-head">
            <div class="acc-av">
              <img src="${avatarSrc}" alt="Avatar">
            </div>
            <div class="acc-info">
              <h4>${acc.nickname || acc.displayName || acc.username || 'Roblox User'}</h4>
              <span>@${acc.username || 'unknown'} • ID: ${acc.userId || 'N/A'}</span>
            </div>
          </div>
          <div class="acc-foot">
            <button class="btn btn-primary btn-sm" style="flex: 1;" onclick="window.launchAccount('${acc.id}')">
              <span class="material-icons-round">play_arrow</span>
              <span>Launch</span>
            </button>
            <button class="btn btn-ghost btn-sm" title="Remove account" onclick="window.removeAccount('${acc.id}')">
              <span class="material-icons-round">delete</span>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  window.launchAccount = async (id) => {
    const acc = state.accounts.find(a => a.id === id);
    if (!acc) return;
    const target = (globalGameTarget?.value || '').trim();
    log(`Launching account ${acc.username} with build ${state.activeVersion || 'default'}...`);
    try {
      const res = await window.api.launchInstance({
        versionHash: state.activeVersion,
        cookie: acc.cookie,
        target
      });
      log(`Launched ${acc.username} (PID: ${res.pid})!`, 'ok');
    } catch (err) {
      log(`Failed to launch ${acc.username}: ${err.message}`, 'err');
    }
  };

  window.removeAccount = async (id) => {
    if (confirm('Remove this account?')) {
      state.accounts = state.accounts.filter(a => a.id !== id);
      await window.api.saveAccounts(state.accounts);
      if (badgeAccountCount) badgeAccountCount.textContent = state.accounts.length;
      renderAccounts();
      log('Account removed.', 'ok');
    }
  };

  btnOpenAddAccount?.addEventListener('click', () => {
    addAccountModal?.classList.add('active');
    if (cookieInput) cookieInput.value = '';
    if (nicknameInput) nicknameInput.value = '';
    if (accountValidateStatus) accountValidateStatus.textContent = '';
  });

  btnCloseAccountModal?.addEventListener('click', () => addAccountModal?.classList.remove('active'));
  btnCancelAccount?.addEventListener('click', () => addAccountModal?.classList.remove('active'));

  btnSaveAccount?.addEventListener('click', async () => {
    const rawCookie = cookieInput?.value.trim();
    if (!rawCookie) {
      accountValidateStatus.style.color = 'var(--red)';
      accountValidateStatus.textContent = 'Please paste your .ROBLOSECURITY cookie';
      return;
    }

    accountValidateStatus.style.color = '#ffffff';
    accountValidateStatus.textContent = 'Validating cookie with Roblox API...';

    const check = await window.api.validateCookie(rawCookie);
    if (!check.valid) {
      accountValidateStatus.style.color = 'var(--red)';
      accountValidateStatus.textContent = `Validation failed: ${check.error}`;
      return;
    }

    const newAcc = {
      id: String(Date.now()),
      userId: check.userId,
      username: check.username,
      displayName: check.displayName,
      nickname: nicknameInput?.value.trim() || check.displayName || check.username,
      avatarUrl: check.avatarUrl,
      cookie: check.cookie,
      addedAt: Date.now()
    };

    state.accounts.push(newAcc);
    await window.api.saveAccounts(state.accounts);
    if (badgeAccountCount) badgeAccountCount.textContent = state.accounts.length;
    renderAccounts();
    addAccountModal?.classList.remove('active');
    log(`Added account: ${newAcc.username} (ID: ${newAcc.userId})`, 'ok');
  });

  btnLaunchAllAccounts?.addEventListener('click', async () => {
    if (state.accounts.length === 0) {
      alert('Add accounts first!');
      return;
    }
    const target = (globalGameTarget?.value || '').trim();
    log(`Launching all ${state.accounts.length} accounts in staggered sequence...`);
    for (let i = 0; i < state.accounts.length; i++) {
      const acc = state.accounts[i];
      if (i > 0) await new Promise(r => setTimeout(r, 1400));
      try {
        await window.api.launchInstance({
          versionHash: state.activeVersion,
          cookie: acc.cookie,
          target
        });
        log(`Launched account ${acc.username} (${i + 1}/${state.accounts.length})`, 'ok');
      } catch (err) {
        log(`Error launching ${acc.username}: ${err.message}`, 'err');
      }
    }
  });

  const killAction = () => {
    window.api.killAllRoblox();
    log('Terminated all Roblox processes.', 'err');
  };

  btnKillAll?.addEventListener('click', killAction);
  btnKillAllMixer?.addEventListener('click', killAction);
  navKillAll?.addEventListener('click', killAction);

  btnSaveTarget?.addEventListener('click', () => {
    const t = (globalGameTarget?.value || '').trim();
    window.api.saveSettings({ gameTarget: t });
    if (quickPlaceId) quickPlaceId.value = t;
    log(`Saved target place: ${t || 'Home'}`, 'ok');
  });

  // --- MIXER TAB ---
  volumeSlider?.addEventListener('input', () => {
    const val = volumeSlider.value;
    if (volValue) volValue.textContent = `${val}%`;
    window.api.setVolume(Number(val));
  });

  antiAfkToggle?.addEventListener('change', () => {
    const enabled = antiAfkToggle.checked;
    const sec = enabled ? Number(afkSlider?.value || 1080) : 0;
    window.api.setAntiAfk(sec);
    syncCockpitAfkState(enabled);
    log(`Anti-AFK ${enabled ? 'enabled' : 'disabled'}`, enabled ? 'ok' : 'err');
  });

  afkSlider?.addEventListener('input', () => {
    const mins = Math.round(afkSlider.value / 60);
    if (afkCadenceLabel) afkCadenceLabel.textContent = `${mins} mins`;
    if (antiAfkToggle?.checked) {
      window.api.setAntiAfk(Number(afkSlider.value));
    }
  });

  btnArrangeGrid?.addEventListener('click', () => {
    window.api.arrangeWindows('grid');
    log('Arranged Roblox windows in 2x2 grid.', 'ok');
  });

  btnArrangeSplit?.addEventListener('click', () => {
    window.api.arrangeWindows('split');
    log('Arranged Roblox windows side-by-side.', 'ok');
  });

  fpsButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      fpsButtons.forEach(b => {
        b.classList.remove('btn-primary', 'active');
        b.classList.add('btn-ghost');
      });
      btn.classList.remove('btn-ghost');
      btn.classList.add('btn-primary', 'active');
      const fps = parseInt(btn.dataset.fps, 10);
      if (state.activeVersion) {
        await window.api.applyFpsCap({ versionHash: state.activeVersion, fpsCap: fps });
        log(`Applied ${fps === 0 ? 'Uncapped' : fps + ' FPS'} to ${state.activeVersion}`, 'ok');
      }
    });
  });

  // --- SETTINGS TAB ---
  btnOpenVersionsDir?.addEventListener('click', () => {
    const dir = versionsDirDisplay?.textContent;
    if (dir && !dir.includes('%')) window.api.openExternal(dir);
  });

  btnClearLogs?.addEventListener('click', () => {
    if (logConsole) logConsole.innerHTML = '';
  });

  // --- STATUS UPDATES ---
  async function loadStatus() {
    try {
      const st = await window.api.getStatus();
      updatePidsUI(st.pids);
      updateMutexUI(st.mutexHeld);
    } catch {}
  }

  function updatePidsUI(pids) {
    state.runningPids = pids;
    const count = pids.length;
    if (instanceCountLabel) instanceCountLabel.textContent = `${count} Running`;
    if (activePidsBadge) activePidsBadge.textContent = `${count} PIDs`;
    if (badgePidsCount) badgePidsCount.textContent = `${count}`;
    if (cockpitPidsVal) cockpitPidsVal.textContent = `${count} PIDs`;
    const cockpitRunningCount = document.getElementById('cockpit-running-count');
    if (cockpitRunningCount) cockpitRunningCount.textContent = `${count} Running`;

    if (!pidsTableBody) return;
    if (count === 0) {
      pidsTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px; color: var(--t3);">No active Roblox instances running.</td></tr>';
      return;
    }

    pidsTableBody.innerHTML = pids.map(pid => `
      <tr>
        <td style="font-family:'JetBrains Mono',monospace; color:#fff; font-weight:600;">${pid}</td>
        <td>RobloxPlayerBeta.exe</td>
        <td><span class="badge b-white">RUNNING</span></td>
        <td style="text-align: right;">
          <button class="btn btn-danger btn-sm" onclick="window.killSpecificPid(${pid})">Kill</button>
        </td>
      </tr>
    `).join('');
  }

  window.killSpecificPid = (pid) => {
    window.api.killPid(pid);
    log(`Killed Roblox process PID ${pid}`, 'err');
  };

  function updateMutexUI(held) {
    if (!mutexPill || !mutexLabel) return;
    if (held) {
      mutexPill.className = 'tb-pill live';
      mutexLabel.textContent = 'Multi-Instance Active';
    } else {
      mutexPill.className = 'tb-pill';
      mutexLabel.textContent = 'Multi-Instance Standby';
    }
  }

  window.api.onPidsUpdated((pids) => {
    updatePidsUI(pids);
  });

  window.api.onMutexStatus((held) => {
    updateMutexUI(held);
  });

  // Initialize
  init();
});
