// MultiBlox - Application Controller (Black & White Premium Edition)
document.addEventListener('DOMContentLoaded', async () => {
  // Application State
  const state = {
    settings: {},
    installedVersions: [],
    accounts: [],
    runningPids: [],
    instances: [],
    liveInfo: {},
    activeVersion: ''
  };

  // Tactile UI Audio Feedback Engine (Web Audio API)
  let uiAudioCtx = null;

  function getAudioCtx() {
    if (!uiAudioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        uiAudioCtx = new AudioContextClass();
      }
    }
    if (uiAudioCtx && uiAudioCtx.state === 'suspended') {
      uiAudioCtx.resume();
    }
    return uiAudioCtx;
  }

  function playUiSound(type = 'button') {
    try {
      const ctx = getAudioCtx();
      if (!ctx) return;

      const now = ctx.currentTime;

      if (type === 'tab') {
        // Smooth, warm acoustic tab transition pop
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1400, now);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.035);

        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.038);
      } else if (type === 'action' || type === 'launch') {
        // Punchy, crisp metallic action snap for launch & terminate
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(920, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.03);

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.035);
      } else {
        // Tactile micro-switch click for standard buttons & controls
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(1050, now);
        osc.frequency.exponentialRampToValueAtTime(260, now + 0.022);

        gain.gain.setValueAtTime(0.085, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.022);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.025);
      }
    } catch {
      // Audio errors fail silently without interrupting UI
    }
  }

  window.playUiSound = playUiSound;

  // Global Delegated Click Listener for All Buttons, Tabs, Nav Items & Controls
  document.addEventListener('click', (e) => {
    const target = e.target;
    if (!target) return;

    const clickable = target.closest('button, .btn, .nav-item, .deck-tab, .tab-btn, .account-select-item, .chip-kill, .btn-acc-tool, .btn-acc-action, .tb-btn, .dialog-btn, input[type="checkbox"]');
    if (!clickable) return;

    if (clickable.classList.contains('nav-item') || clickable.classList.contains('deck-tab') || clickable.classList.contains('tab-btn')) {
      playUiSound('tab');
    } else if (clickable.id === 'btn-cockpit-launch' || clickable.id === 'btn-quick-launch' || clickable.classList.contains('btn-acc-action') || clickable.classList.contains('danger') || clickable.classList.contains('btn-danger')) {
      playUiSound('action');
    } else {
      playUiSound('button');
    }
  }, true);

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
  const cockpitRunningChips = document.getElementById('cockpit-running-chips');
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
  const btnCancelAccountWeb = document.getElementById('btn-cancel-account-web');
  const btnSaveAccount = document.getElementById('btn-save-account');
  const cookieInput = document.getElementById('cookie-input');
  const nicknameInput = document.getElementById('nickname-input');
  const nicknameInputWeb = document.getElementById('nickname-input-web');
  const accountValidateStatus = document.getElementById('account-validate-status');
  const tabBtnRobloxLogin = document.getElementById('tab-btn-roblox-login');
  const tabBtnManualCookie = document.getElementById('tab-btn-manual-cookie');
  const panelRobloxLogin = document.getElementById('panel-roblox-login');
  const panelManualCookie = document.getElementById('panel-manual-cookie');
  const btnLaunchRobloxLogin = document.getElementById('btn-launch-roblox-login');
  const btnLaunchRobloxLoginText = document.getElementById('btn-launch-roblox-login-text');
  const robloxWebLoginStatus = document.getElementById('roblox-web-login-status');

  // Account Select Modal Elements
  const accountSelectModal = document.getElementById('account-select-modal');
  const btnCloseAccountSelect = document.getElementById('btn-close-account-select');
  const accountSelectList = document.getElementById('account-select-list');
  const selectModalBuildDisp = document.getElementById('select-modal-build-disp');
  const selectModalTargetDisp = document.getElementById('select-modal-target-disp');
  const btnSelectLaunchGuest = document.getElementById('btn-select-launch-guest');
  const btnSelectLaunchAll = document.getElementById('btn-select-launch-all');
  const btnSelectAddAccount = document.getElementById('btn-select-add-account');

  // Custom Dialog Modal Elements
  const customDialogModal = document.getElementById('custom-dialog-modal');
  const customDialogBox = document.getElementById('custom-dialog-box');
  const customDialogIconWrap = document.getElementById('custom-dialog-icon-wrap');
  const customDialogIcon = document.getElementById('custom-dialog-icon');
  const customDialogTitle = document.getElementById('custom-dialog-title');
  const customDialogMessage = document.getElementById('custom-dialog-message');
  const btnCustomDialogClose = document.getElementById('btn-custom-dialog-close');
  const btnCustomDialogCancel = document.getElementById('btn-custom-dialog-cancel');
  const btnCustomDialogConfirm = document.getElementById('btn-custom-dialog-confirm');

  let dialogResolver = null;

  function closeCustomDialog(result) {
    if (customDialogModal) {
      customDialogModal.classList.remove('active');
    }
    if (dialogResolver) {
      const resolve = dialogResolver;
      dialogResolver = null;
      resolve(result);
    }
  }

  btnCustomDialogConfirm?.addEventListener('click', () => closeCustomDialog(true));
  btnCustomDialogCancel?.addEventListener('click', () => closeCustomDialog(false));
  btnCustomDialogClose?.addEventListener('click', () => closeCustomDialog(false));
  customDialogModal?.addEventListener('click', (e) => {
    if (e.target === customDialogModal) {
      closeCustomDialog(false);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (customDialogModal?.classList.contains('active')) {
      if (e.key === 'Escape') {
        closeCustomDialog(false);
      } else if (e.key === 'Enter') {
        closeCustomDialog(true);
      }
    }
  });

  window.showConfirm = function(options = {}) {
    const {
      title = 'Confirmation Required',
      message = 'Are you sure you want to proceed?',
      confirmText = 'Confirm',
      cancelText = 'Cancel',
      isDanger = false,
      icon = isDanger ? 'delete_forever' : 'help_outline',
      type = isDanger ? 'danger' : 'info'
    } = typeof options === 'string' ? { message: options } : options;

    return new Promise((resolve) => {
      dialogResolver = resolve;

      if (customDialogTitle) customDialogTitle.textContent = title;
      if (customDialogMessage) customDialogMessage.innerHTML = message;
      if (btnCustomDialogConfirm) {
        btnCustomDialogConfirm.textContent = confirmText;
        if (isDanger) {
          btnCustomDialogConfirm.className = 'btn-danger-confirm';
        } else {
          btnCustomDialogConfirm.className = 'btn btn-primary';
        }
      }
      if (btnCustomDialogCancel) {
        btnCustomDialogCancel.textContent = cancelText;
        btnCustomDialogCancel.style.display = 'inline-flex';
      }

      if (customDialogBox) {
        if (isDanger) {
          customDialogBox.classList.add('danger-dialog');
        } else {
          customDialogBox.classList.remove('danger-dialog');
        }
      }

      if (customDialogIconWrap) {
        customDialogIconWrap.className = `custom-dialog-icon-wrap ${type || (isDanger ? 'danger' : 'info')}`;
      }
      if (customDialogIcon) {
        customDialogIcon.textContent = icon;
      }

      if (customDialogModal) customDialogModal.classList.add('active');
      btnCustomDialogConfirm?.focus();
    });
  };

  window.showAlert = function(options = {}) {
    const {
      title = 'Notification',
      message = '',
      buttonText = 'OK',
      isDanger = false,
      type = isDanger ? 'danger' : 'info',
      icon = isDanger ? 'error_outline' : (type === 'warning' ? 'warning_amber' : 'info')
    } = typeof options === 'string' ? { message: options } : options;

    return new Promise((resolve) => {
      dialogResolver = resolve;

      if (customDialogTitle) customDialogTitle.textContent = title;
      if (customDialogMessage) customDialogMessage.innerHTML = message;
      if (btnCustomDialogConfirm) {
        btnCustomDialogConfirm.textContent = buttonText;
        if (isDanger || type === 'danger') {
          btnCustomDialogConfirm.className = 'btn-danger-confirm';
        } else {
          btnCustomDialogConfirm.className = 'btn btn-primary';
        }
      }
      if (btnCustomDialogCancel) {
        btnCustomDialogCancel.style.display = 'none';
      }

      if (customDialogBox) {
        if (isDanger || type === 'danger') {
          customDialogBox.classList.add('danger-dialog');
        } else {
          customDialogBox.classList.remove('danger-dialog');
        }
      }

      if (customDialogIconWrap) {
        customDialogIconWrap.className = `custom-dialog-icon-wrap ${type || 'info'}`;
      }
      if (customDialogIcon) {
        customDialogIcon.textContent = icon;
      }

      if (customDialogModal) customDialogModal.classList.add('active');
      btnCustomDialogConfirm?.focus();
    });
  };

  // Accounts Elements
  const accountsContainer = document.getElementById('accounts-container');
  const globalGameTarget = document.getElementById('global-game-target');
  const btnSaveTarget = document.getElementById('btn-save-target');
  const btnLaunchAllAccounts = document.getElementById('btn-launch-all-accounts');
  const btnKillAll = document.getElementById('btn-kill-all');
  const navKillAll = document.getElementById('nav-kill-all');

  // Active Processes Tab Elements
  const btnRefreshProcesses = document.getElementById('btn-refresh-processes');
  const btnKillAllProcesses = document.getElementById('btn-kill-all-processes');
  const btnArrangeGridProc = document.getElementById('btn-arrange-grid-proc');
  const btnArrangeSplitProc = document.getElementById('btn-arrange-split-proc');
  const procMutexPill = document.getElementById('proc-mutex-pill');
  const mixerPidsBadge = document.getElementById('mixer-pids-badge');

  // Mixer Elements
  const volumeSlider = document.getElementById('volume-slider');
  const volValue = document.getElementById('vol-value');
  const antiAfkToggle = document.getElementById('anti-afk-toggle');
  const afkSlider = document.getElementById('afk-slider');
  const afkCadenceLabel = document.getElementById('afk-cadence-label');
  const btnArrangeGrid = document.getElementById('btn-arrange-grid');
  const btnArrangeSplit = document.getElementById('btn-arrange-split');
  const pidsTableBody = document.getElementById('pids-table-body');
  const instanceMixerList = document.getElementById('instance-mixer-list');
  const mixerActiveChannelsBadge = document.getElementById('mixer-active-channels-badge');
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

  // Target Synchronization Helpers
  function getTargetGame() {
    return (cockpitPlaceId?.value || globalGameTarget?.value || state.settings?.gameTarget || '').trim();
  }

  function syncGameTarget(val) {
    if (cockpitPlaceId && cockpitPlaceId.value !== val) cockpitPlaceId.value = val;
    if (globalGameTarget && globalGameTarget.value !== val) globalGameTarget.value = val;
    state.settings.gameTarget = val;
    window.api.saveSettings({ gameTarget: val });
  }

  cockpitPlaceId?.addEventListener('input', () => syncGameTarget(cockpitPlaceId.value));
  globalGameTarget?.addEventListener('input', () => syncGameTarget(globalGameTarget.value));

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

      // Load initial instances
      try {
        const initialInstances = await window.api.listInstances();
        if (initialInstances) updateInstancesUI(initialInstances);
      } catch {}

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
      installedVersionsContainer.innerHTML = '<div style="color:var(--t3); padding:24px; text-align:center; font-size:12.5px; grid-column:1/-1;">No Roblox builds found on disk. Paste a version hash above to install!</div>';
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
    const confirmed = await window.showConfirm({
      title: 'Delete Build',
      message: `Are you sure you want to permanently delete build <b style="color: #ffffff;">${hash}</b> from your disk? This cannot be undone.`,
      confirmText: 'Delete Build',
      isDanger: true,
      icon: 'delete_forever'
    });
    if (confirmed) {
      try {
        await window.api.deleteVersion(hash);
        log(`Deleted build ${hash}`, 'ok');
        await loadInstalledVersions();
      } catch (err) {
        log(`Delete failed: ${err.message}`, 'err');
        await window.showAlert({
          title: 'Deletion Failed',
          message: `Unable to delete build: ${err.message}`,
          type: 'danger',
          icon: 'error_outline'
        });
      }
    }
  };

  function updateActiveVersionDisplay() {
    const disp = state.activeVersion || 'Default';
    const clean = disp.startsWith('version-') ? disp.replace('version-', '').slice(0, 10) : disp;
    if (headerActiveVer) headerActiveVer.textContent = clean;
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
      }
      log(`Live Roblox: ${live.liveClientVersion || 'Online'} (${live.liveHash || ''})`);
    } catch (err) {
      log(`Failed to fetch live version info: ${err.message}`, 'err');
    }
  }


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
      downloadModal.classList.remove('active');
      await window.showAlert({
        title: 'Installation Failed',
        message: `Roblox build installation encountered an error: <b style="color: var(--red);">${err.message}</b>`,
        type: 'danger',
        icon: 'cloud_off'
      });
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
      await window.showAlert({
        title: 'No Build Selected',
        message: 'No active Roblox client build selected. Please install a build or choose one from your installed list below.',
        type: 'warning',
        icon: 'layers_clear'
      });
      return;
    }

    const target = getTargetGame();
    log(`Spawning active Roblox build (${targetHash})${target ? ' into ' + target : ''}...`);
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

    const target = getTargetGame();
    log(`Spawning additional Roblox instance${target ? ' into ' + target : ''}...`);
    try {
      const res = await window.api.launchMultiple({ count: 1, versionHash: targetHash, target });
      if (res && res[0] && res[0].success) {
        log(`Spawned instance (PID: ${res[0].pid})!`, 'ok');
      }
    } catch (err) {
      log(`Launch more error: ${err.message}`, 'err');
    }
  }

  // Account Select Modal Handling
  function openAccountSelectModal() {
    if (!accountSelectModal) return;
    const target = getTargetGame();
    if (selectModalBuildDisp) {
      selectModalBuildDisp.textContent = state.activeVersion || 'Default';
    }
    if (selectModalTargetDisp) {
      selectModalTargetDisp.textContent = target ? (target.length > 28 ? target.slice(0, 25) + '...' : target) : 'Home / Default';
    }
    renderAccountSelectList();
    accountSelectModal.classList.add('active');
  }

  function closeAccountSelectModal() {
    accountSelectModal?.classList.remove('active');
  }

  function renderAccountSelectList() {
    if (!accountSelectList) return;
    if (!state.accounts || state.accounts.length === 0) {
      accountSelectList.innerHTML = `
        <div style="text-align: center; padding: 24px 12px; color: var(--t2); font-size: 13px;">
          <span class="material-icons-round" style="font-size: 32px; color: var(--t3); display: block; margin-bottom: 8px;">account_circle</span>
          <strong style="color: #fff; display: block; margin-bottom: 4px;">No accounts saved yet</strong>
          <span style="font-size: 11.5px; color: var(--t3); line-height: 1.4; display: block;">Add your Roblox accounts below, or launch immediately as Guest / Standalone.</span>
        </div>
      `;
      return;
    }

    accountSelectList.innerHTML = state.accounts.map(acc => {
      const avatarSrc = acc.avatarUrl || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="%2352525b"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>';
      const activeInst = (state.instances || []).find(inst => String(inst.accountId) === String(acc.id) && (state.runningPids.length === 0 || state.runningPids.includes(inst.pid)));
      const isRunning = Boolean(activeInst);

      return `
        <div class="account-select-item ${isRunning ? 'is-running' : ''}" onclick="window.launchAccountFromSelect('${acc.id}')">
          <div class="account-select-left">
            <div class="account-select-av">
              <img src="${avatarSrc}" alt="Avatar">
            </div>
            <div>
              <div class="account-select-name">${acc.nickname || acc.displayName || acc.username || 'Roblox User'}</div>
              <div class="account-select-user">@${acc.username || 'unknown'}</div>
            </div>
          </div>
          <div class="account-select-right">
            ${isRunning ? `
              <span class="badge b-white" style="color:var(--green); border-color:rgba(34,197,94,0.3); font-size:10.5px;">
                <span class="tb-dot" style="background:var(--green); width:5px; height:5px; margin-right:4px;"></span>RUNNING (${activeInst.pid})
              </span>
              <button class="btn btn-danger btn-sm" style="padding: 4px 8px;" onclick="event.stopPropagation(); window.killSpecificPid(${activeInst.pid});" title="Kill PID ${activeInst.pid}">
                <span class="material-icons-round" style="font-size: 14px;">power_settings_new</span>
              </button>
            ` : `
              <div class="account-select-action">
                <span class="material-icons-round" style="font-size: 14px;">play_arrow</span>
                <span>Launch</span>
              </div>
            `}
          </div>
        </div>
      `;
    }).join('');
  }

  window.launchAccountFromSelect = async (id) => {
    closeAccountSelectModal();
    await window.launchAccount(id);
  };

  btnCloseAccountSelect?.addEventListener('click', closeAccountSelectModal);
  btnSelectLaunchGuest?.addEventListener('click', () => {
    closeAccountSelectModal();
    launchActiveBuild();
  });
  btnSelectLaunchAll?.addEventListener('click', () => {
    closeAccountSelectModal();
    btnLaunchAllAccounts?.click();
  });
  btnSelectAddAccount?.addEventListener('click', () => {
    closeAccountSelectModal();
    btnOpenAddAccount?.click();
  });
  accountSelectModal?.addEventListener('click', (e) => {
    if (e.target === accountSelectModal) closeAccountSelectModal();
  });

  // Single Unified Cockpit Launch Button opens Account Selection Modal
  btnCockpitLaunch?.addEventListener('click', openAccountSelectModal);
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
    const t = getTargetGame();
    syncGameTarget(t);
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
      await window.showAlert({
        title: 'Missing Build Hash',
        message: 'Please enter a 16-hex Roblox version hash (e.g. <code>version-e380c8edc8f6477c</code>).',
        type: 'warning',
        icon: 'tag'
      });
      return;
    }
    let norm = val.toLowerCase();
    if (!norm.startsWith('version-')) norm = 'version-' + norm;
    if (!/^version-[0-9a-f]{16}$/i.test(norm)) {
      await window.showAlert({
        title: 'Invalid Hash Format',
        message: 'Expected a 16-character hexadecimal hash (e.g. <code>version-e380c8edc8f6477c</code>).',
        type: 'danger',
        icon: 'error_outline'
      });
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
      if (accountSelectModal?.classList.contains('active')) renderAccountSelectList();
    } catch (err) {
      log(`Failed to load accounts: ${err.message}`, 'err');
    }
  }

  window.openProfile = (userId) => {
    if (userId && userId !== 'N/A') {
      window.api.openExternal(`https://www.roblox.com/users/${userId}/profile`);
    }
  };

  window.copyUserId = (userId, e) => {
    if (e) e.stopPropagation();
    if (!userId || userId === 'N/A') return;
    navigator.clipboard.writeText(String(userId));
    log(`Copied Roblox User ID: ${userId}`, 'ok');
  };

  function renderAccounts() {
    if (!accountsContainer) return;
    if (state.accounts.length === 0) {
      accountsContainer.innerHTML = '<div style="color:var(--t3); padding:32px; text-align:center; font-size:12.5px; grid-column:1/-1;">No accounts saved yet. Click "Add Account" to paste a .ROBLOSECURITY cookie!</div>';
      return;
    }

    const currentTarget = getTargetGame();
    const targetDisplay = currentTarget ? (currentTarget.length > 20 ? currentTarget.slice(0, 17) + '...' : currentTarget) : 'Home / Default';

    accountsContainer.innerHTML = state.accounts.map(acc => {
      const avatarSrc = acc.avatarUrl || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="%2352525b"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>';
      const activeInst = (state.instances || []).find(inst => String(inst.accountId) === String(acc.id) && (state.runningPids.length === 0 || state.runningPids.includes(inst.pid)));
      const isRunning = Boolean(activeInst);
      const displayName = acc.nickname || acc.displayName || acc.username || 'Roblox User';

      return `
        <div class="acc-card ${isRunning ? 'is-running' : ''}">
          <div class="acc-card-glow"></div>
          
          <div class="acc-card-inner">
            <div class="acc-head">
              <div class="acc-av-wrap">
                <img src="${avatarSrc}" alt="Avatar" class="acc-av-img">
                <span class="av-status-dot ${isRunning ? 'live' : ''}" title="${isRunning ? 'Active Instance Running' : 'Standby'}"></span>
              </div>

              <div class="acc-info">
                <div class="acc-title-row">
                  <h4 class="acc-display-name" title="${displayName}">${displayName}</h4>
                  ${isRunning ? `
                    <span class="acc-status-tag running">
                      <span class="tag-dot"></span>
                      <span>PID ${activeInst.pid}</span>
                    </span>
                  ` : `
                    <span class="acc-status-tag standby">
                      <span>READY</span>
                    </span>
                  `}
                </div>
                <div class="acc-handle">@${acc.username || 'unknown'}</div>
              </div>
            </div>

            <div class="acc-body">
              <div class="acc-meta-row">
                <div class="acc-meta-item" title="Click to copy User ID" onclick="window.copyUserId('${acc.userId || ''}', event)">
                  <span class="material-icons-round meta-icon">tag</span>
                  <span class="meta-val">${acc.userId || 'N/A'}</span>
                  <span class="material-icons-round meta-copy">content_copy</span>
                </div>

                <div class="acc-meta-item target" title="Current Engine Target">
                  <span class="material-icons-round meta-icon">sports_esports</span>
                  <span class="meta-val">${targetDisplay}</span>
                </div>
              </div>
            </div>

            <div class="acc-foot">
              ${isRunning ? `
                <button class="btn-acc-action danger" onclick="window.killSpecificPid(${activeInst.pid})" title="Kill Instance ${activeInst.pid}">
                  <span class="material-icons-round">power_settings_new</span>
                  <span>TERMINATE</span>
                </button>
              ` : `
                <button class="btn-acc-action primary" onclick="window.launchAccount('${acc.id}')" title="Launch Client">
                  <span class="material-icons-round">play_arrow</span>
                  <span>LAUNCH</span>
                </button>
              `}
              
              <div class="acc-action-tools">
                ${acc.userId ? `
                  <button class="btn-acc-tool" title="Open Roblox Profile in Browser" onclick="window.openProfile('${acc.userId}')">
                    <span class="material-icons-round">open_in_new</span>
                  </button>
                ` : ''}
                <button class="btn-acc-tool delete" title="Remove account" onclick="window.removeAccount('${acc.id}')">
                  <span class="material-icons-round">delete_outline</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  window.launchAccount = async (id) => {
    const acc = state.accounts.find(a => a.id === id);
    if (!acc) return;
    const target = getTargetGame();
    log(`Launching account ${acc.nickname || acc.username}${target ? ' into ' + target : ' into Home'} with build ${state.activeVersion || 'default'}...`);
    try {
      // Zero-Trust: Main process securely resolves cookie from DPAPI storage via accountId
      const res = await window.api.launchInstance({
        versionHash: state.activeVersion,
        target,
        accountId: acc.id,
        username: acc.username,
        displayName: acc.nickname || acc.displayName || acc.username,
        avatarUrl: acc.avatarUrl
      });
      if (res && res.pid) {
        const optInst = {
          pid: res.pid,
          accountId: acc.id,
          username: acc.username,
          displayName: acc.nickname || acc.displayName || acc.username,
          avatarUrl: acc.avatarUrl,
          version: res.version || state.activeVersion || 'Default',
          target,
          startTime: Date.now()
        };
        const existingIdx = state.instances.findIndex(i => i.pid === res.pid || String(i.accountId) === String(acc.id));
        if (existingIdx !== -1) state.instances[existingIdx] = optInst;
        else state.instances.push(optInst);
        if (!state.runningPids.includes(res.pid)) state.runningPids.push(res.pid);
        syncActiveProcesses();
      }
      log(`Launched ${acc.username} (PID: ${res.pid}) into ${target || 'Home'}!`, 'ok');
    } catch (err) {
      log(`Failed to launch ${acc.username}: ${err.message}`, 'err');
    }
  };

  window.removeAccount = async (id) => {
    const acc = (state.accounts || []).find(a => a.id === id);
    const displayName = acc?.nickname || acc?.displayName || acc?.username || 'this account';
    const confirmed = await window.showConfirm({
      title: 'Remove Account',
      message: `Are you sure you want to remove <b style="color: #ffffff;">${displayName}</b>${acc?.username ? ` (@${acc.username})` : ''}?<br><span style="font-size: 12px; color: var(--t3); display: inline-block; margin-top: 6px;">Session keys and authentication tokens will be cleared from local storage.</span>`,
      confirmText: 'Remove Account',
      isDanger: true,
      icon: 'person_remove'
    });
    if (confirmed) {
      try {
        state.accounts = await window.api.deleteAccount(id);
        if (badgeAccountCount) badgeAccountCount.textContent = state.accounts.length;
        renderAccounts();
        if (accountSelectModal?.classList.contains('active')) renderAccountSelectList();
        log('Account removed and credentials wiped.', 'ok');
      } catch (err) {
        log(`Failed to remove account: ${err.message}`, 'err');
      }
    }
  };

  // Add Account Method Tabs Switcher
  tabBtnRobloxLogin?.addEventListener('click', () => {
    tabBtnRobloxLogin.classList.add('active');
    tabBtnManualCookie?.classList.remove('active');
    if (panelRobloxLogin) {
      panelRobloxLogin.style.display = 'block';
      panelRobloxLogin.classList.add('active');
    }
    if (panelManualCookie) {
      panelManualCookie.style.display = 'none';
      panelManualCookie.classList.remove('active');
    }
  });

  tabBtnManualCookie?.addEventListener('click', () => {
    tabBtnManualCookie.classList.add('active');
    tabBtnRobloxLogin?.classList.remove('active');
    if (panelManualCookie) {
      panelManualCookie.style.display = 'block';
      panelManualCookie.classList.add('active');
    }
    if (panelRobloxLogin) {
      panelRobloxLogin.style.display = 'none';
      panelRobloxLogin.classList.remove('active');
    }
  });

  const resetAddAccountModal = () => {
    if (cookieInput) cookieInput.value = '';
    if (nicknameInput) nicknameInput.value = '';
    if (nicknameInputWeb) nicknameInputWeb.value = '';
    if (accountValidateStatus) accountValidateStatus.textContent = '';
    if (robloxWebLoginStatus) robloxWebLoginStatus.textContent = '';
    if (btnLaunchRobloxLogin) {
      btnLaunchRobloxLogin.disabled = false;
      if (btnLaunchRobloxLoginText) btnLaunchRobloxLoginText.textContent = 'Sign In with Roblox';
    }
    // Default to Roblox Web Login tab
    tabBtnRobloxLogin?.click();
  };

  btnOpenAddAccount?.addEventListener('click', () => {
    resetAddAccountModal();
    addAccountModal?.classList.add('active');
  });

  const closeAccountModalAction = () => {
    window.api.cancelWebLogin();
    addAccountModal?.classList.remove('active');
    resetAddAccountModal();
  };

  btnCloseAccountModal?.addEventListener('click', closeAccountModalAction);
  btnCancelAccount?.addEventListener('click', closeAccountModalAction);
  btnCancelAccountWeb?.addEventListener('click', closeAccountModalAction);

  // METHOD 1: Sign in with Roblox Web Window
  btnLaunchRobloxLogin?.addEventListener('click', async () => {
    if (btnLaunchRobloxLogin.disabled) return;

    btnLaunchRobloxLogin.disabled = true;
    if (btnLaunchRobloxLoginText) btnLaunchRobloxLoginText.textContent = 'Waiting for Roblox login...';
    if (robloxWebLoginStatus) {
      robloxWebLoginStatus.style.color = '#ffffff';
      robloxWebLoginStatus.innerHTML = '<span class="material-icons-round" style="font-size:14px; vertical-align:middle; animation:spin 1s linear infinite;">sync</span> Login window opened. Please complete sign in in the Roblox window...';
    }

    log('Opened official Roblox web login window...', 'info');

    try {
      const check = await window.api.loginWeb();

      if (check.cancelled) {
        if (robloxWebLoginStatus) {
          robloxWebLoginStatus.style.color = 'var(--t3)';
          robloxWebLoginStatus.textContent = 'Login window was closed.';
        }
        log('Roblox login cancelled or closed by user.', 'info');
        return;
      }

      if (!check.valid) {
        if (robloxWebLoginStatus) {
          robloxWebLoginStatus.style.color = 'var(--red)';
          robloxWebLoginStatus.textContent = `Login failed: ${check.error || 'Unable to authenticate session'}`;
        }
        log(`Web login authentication failed: ${check.error}`, 'err');
        return;
      }

      // If custom nickname was set in the modal, update it
      const customNick = (nicknameInputWeb?.value || '').trim();
      if (customNick && check.account) {
        const currentList = await window.api.listAccounts();
        const found = currentList.find(a => String(a.id) === String(check.account.id) || String(a.userId) === String(check.account.userId));
        if (found) {
          found.nickname = customNick;
          await window.api.saveAccounts(currentList);
        }
      }

      await loadAccounts();
      addAccountModal?.classList.remove('active');
      log(`Connected account via Roblox Web Login: ${check.account.username} (ID: ${check.account.userId})`, 'ok');

      await window.showAlert({
        title: 'Account Connected & Secured',
        message: `Successfully connected Roblox account <b style="color: #ffffff;">${check.account.displayName}</b> (@${check.account.username})!<br><span style="font-size:12px; color:var(--t3); display:inline-block; margin-top:4px;">Credentials encrypted with Windows DPAPI.</span>`,
        type: 'success',
        icon: 'verified_user'
      });
    } catch (err) {
      if (robloxWebLoginStatus) {
        robloxWebLoginStatus.style.color = 'var(--red)';
        if (err.message.includes('No handler registered')) {
          robloxWebLoginStatus.innerHTML = '<span class="material-icons-round" style="font-size:13px; vertical-align:middle;">info</span> <b>Restart Required:</b> Please restart EternityBlox (run <code>npm start</code>) to load the new web login handler.';
        } else {
          robloxWebLoginStatus.textContent = `Error: ${err.message}`;
        }
      }
      log(`Roblox login exception: ${err.message}`, 'err');
    } finally {
      if (btnLaunchRobloxLogin) {
        btnLaunchRobloxLogin.disabled = false;
        if (btnLaunchRobloxLoginText) btnLaunchRobloxLoginText.textContent = 'Sign In with Roblox';
      }
    }
  });

  // METHOD 2: Manual Cookie Verification & DPAPI Storage
  btnSaveAccount?.addEventListener('click', async () => {
    const rawCookie = cookieInput?.value.trim();
    if (!rawCookie) {
      accountValidateStatus.style.color = 'var(--red)';
      accountValidateStatus.textContent = 'Please paste your .ROBLOSECURITY cookie';
      return;
    }

    accountValidateStatus.style.color = '#ffffff';
    accountValidateStatus.textContent = 'Validating cookie & securing with Windows DPAPI...';

    const nickname = (nicknameInput?.value || '').trim();

    try {
      const result = await window.api.addAccountManual({ rawCookie, nickname });

      // Zero-Trust Security: Immediately wipe raw cookie input field from DOM memory
      if (cookieInput) cookieInput.value = '';

      if (!result.valid) {
        accountValidateStatus.style.color = 'var(--red)';
        accountValidateStatus.textContent = `Validation failed: ${result.error}`;
        return;
      }

      await loadAccounts();
      addAccountModal?.classList.remove('active');
      log(`Added and encrypted account: ${result.account.username} (ID: ${result.account.userId})`, 'ok');

      await window.showAlert({
        title: 'Account Secured',
        message: `Successfully added and encrypted account <b style="color: #ffffff;">${result.account.displayName}</b> (@${result.account.username})!<br><span style="font-size:12px; color:var(--t3); display:inline-block; margin-top:4px;">Credentials are protected by Windows DPAPI hardware-bound encryption.</span>`,
        type: 'success',
        icon: 'verified_user'
      });
    } catch (err) {
      if (cookieInput) cookieInput.value = '';
      accountValidateStatus.style.color = 'var(--red)';
      accountValidateStatus.textContent = `Error: ${err.message}`;
    }
  });

  btnLaunchAllAccounts?.addEventListener('click', async () => {
    if (state.accounts.length === 0) {
      await window.showAlert({
        title: 'No Accounts Configured',
        message: 'Please add at least one Roblox account before launching batch sessions.',
        type: 'warning',
        icon: 'group_off'
      });
      return;
    }
    const target = getTargetGame();
    log(`Launching all ${state.accounts.length} accounts into ${target || 'Home'} in staggered sequence...`);
    for (let i = 0; i < state.accounts.length; i++) {
      const acc = state.accounts[i];
      if (i > 0) await new Promise(r => setTimeout(r, 1400));
      try {
        // Zero-Trust: Main process resolves cookie from DPAPI via accountId
        await window.api.launchInstance({
          versionHash: state.activeVersion,
          target,
          accountId: acc.id,
          username: acc.username,
          displayName: acc.nickname || acc.displayName || acc.username,
          avatarUrl: acc.avatarUrl
        });
        log(`Launched account ${acc.username} (${i + 1}/${state.accounts.length})`, 'ok');
      } catch (err) {
        log(`Error launching ${acc.username}: ${err.message}`, 'err');
      }
    }
  });

  const killAction = () => {
    window.api.killAllRoblox();
    state.instances = [];
    state.runningPids = [];
    updatePidsUI([]);
    updateInstancesUI([]);
    log('Terminated all Roblox processes.', 'err');
  };

  btnKillAll?.addEventListener('click', killAction);
  btnKillAllProcesses?.addEventListener('click', killAction);
  navKillAll?.addEventListener('click', killAction);

  btnRefreshProcesses?.addEventListener('click', async () => {
    await loadStatus();
    log('Refreshed active process list.', 'ok');
  });

  btnArrangeGridProc?.addEventListener('click', () => {
    window.api.arrangeWindows('grid');
    log('Arranged Roblox windows in 2x2 grid.', 'ok');
  });

  btnArrangeSplitProc?.addEventListener('click', () => {
    window.api.arrangeWindows('split');
    log('Arranged Roblox windows side-by-side.', 'ok');
  });

  const switchToProcessesTab = () => {
    const procTab = document.querySelector('.deck-tab[data-view="view-processes"]');
    if (procTab) procTab.click();
  };

  const instancesPill = document.getElementById('instances-pill');
  const activeVerPill = document.getElementById('active-ver-pill');
  cockpitPidsVal?.addEventListener('click', switchToProcessesTab);
  instanceCountLabel?.addEventListener('click', switchToProcessesTab);
  instancesPill?.addEventListener('click', switchToProcessesTab);
  activeVerPill?.addEventListener('click', () => {
    const buildTab = document.querySelector('.deck-tab[data-view="view-installed"]');
    if (buildTab) buildTab.click();
  });

  btnSaveTarget?.addEventListener('click', () => {
    const t = getTargetGame();
    syncGameTarget(t);
    log(`Saved default target: ${t || 'Home'}`, 'ok');
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
    state.runningPids = pids || [];
    const count = state.runningPids.length;
    if (instanceCountLabel) instanceCountLabel.textContent = `${count} Running`;
    if (instancesPill) instancesPill.classList.toggle('live', count > 0);
    if (activePidsBadge) activePidsBadge.textContent = `${count} PIDs`;
    if (mixerPidsBadge) mixerPidsBadge.textContent = `${count} PIDs`;
    if (badgePidsCount) badgePidsCount.textContent = `${count}`;
    if (cockpitPidsVal) cockpitPidsVal.textContent = `${count} PIDs`;
    const cockpitRunningCount = document.getElementById('cockpit-running-count');
    if (cockpitRunningCount) cockpitRunningCount.textContent = `${count} Running`;

    // Ensure all alive PIDs are represented in state.instances
    const existingPids = new Set((state.instances || []).map(i => i.pid));
    for (const pid of state.runningPids) {
      if (!existingPids.has(pid)) {
        state.instances.push({
          pid,
          accountId: null,
          username: 'Roblox Client',
          displayName: `PID ${pid}`,
          avatarUrl: null,
          version: state.activeVersion || 'Active',
          target: getTargetGame() || null,
          startTime: Date.now()
        });
      }
    }

    // Remove stale PIDs that are dead and beyond grace period
    const now = Date.now();
    const aliveSet = new Set(state.runningPids);
    state.instances = (state.instances || []).filter(i => aliveSet.has(i.pid) || (now - (i.startTime || 0) < 6000));

    syncActiveProcesses();
  }

  function updateInstancesUI(instances) {
    if (instances && instances.length > 0) {
      for (const inst of instances) {
        if (!state.runningPids.includes(inst.pid)) state.runningPids.push(inst.pid);
      }
      state.instances = instances;
    }
    syncActiveProcesses();
  }

  function syncActiveProcesses() {
    renderAccounts();
    renderActiveProcessesTable();
    updateCockpitInstanceChips();
    renderInstanceMixer();
    if (accountSelectModal?.classList.contains('active')) {
      renderAccountSelectList();
    }
  }

  function renderActiveProcessesTable() {
    if (!pidsTableBody) return;

    // Combine all unique active PIDs so none are missed
    const allPids = Array.from(new Set([
      ...(state.runningPids || []),
      ...(state.instances || []).map(i => i.pid)
    ])).filter(p => p > 0);

    if (allPids.length === 0) {
      pidsTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 24px; color: var(--t3);">No active Roblox instances running.</td></tr>';
      return;
    }

    pidsTableBody.innerHTML = allPids.map(pid => {
      const inst = (state.instances || []).find(i => i.pid === pid) || {};
      const avatarSrc = inst.avatarUrl || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="%2352525b"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>';
      const targetDisp = inst.target ? (inst.target.length > 28 ? inst.target.slice(0, 25) + '...' : inst.target) : 'Home / Default';
      const displayName = inst.displayName || inst.username || `Roblox Process (${pid})`;

      return `
        <tr>
          <td style="font-family:'JetBrains Mono',monospace; color:#fff; font-weight:600;">${pid}</td>
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              <img src="${avatarSrc}" alt="" style="width: 24px; height: 24px; border-radius: 5px; border: 1px solid rgba(255,255,255,0.12); flex-shrink: 0;">
              <div>
                <strong style="color: #fff; font-size: 12.5px;">${displayName}</strong>
                ${inst.username && inst.displayName !== inst.username ? `<div style="font-size: 10.5px; color: var(--t3);">@${inst.username}</div>` : ''}
              </div>
            </div>
          </td>
          <td style="font-family:'JetBrains Mono',monospace; font-size: 11.5px; color: var(--t2);">${targetDisp}</td>
          <td><span class="badge b-white" style="color:var(--green); border-color:rgba(34,197,94,0.3);"><span class="tb-dot" style="background:var(--green); width:5px; height:5px; margin-right:4px;"></span>RUNNING</span></td>
          <td style="text-align: right;">
            <button class="btn btn-danger btn-sm" onclick="window.killSpecificPid(${pid})" title="Kill PID ${pid}">
              <span class="material-icons-round" style="font-size: 14px;">power_settings_new</span>
              <span>Kill Instance</span>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function updateCockpitInstanceChips() {
    if (!cockpitRunningChips) return;
    const allPids = Array.from(new Set([
      ...(state.runningPids || []),
      ...(state.instances || []).map(i => i.pid)
    ])).filter(p => p > 0);

    if (allPids.length === 0) {
      cockpitRunningChips.innerHTML = '';
      return;
    }

    cockpitRunningChips.innerHTML = allPids.map(pid => {
      const inst = (state.instances || []).find(i => i.pid === pid);
      const name = inst?.username && inst.username !== 'Roblox Client' ? `@${inst.username}` : `PID ${pid}`;
      return `
        <div class="cockpit-instance-chip" title="Account: ${inst?.username || 'Roblox Client'} | PID: ${pid}">
          <span class="chip-dot"></span>
          <span class="chip-name">${name}</span>
          <button class="chip-kill-btn" onclick="window.killSpecificPid(${pid})" title="Kill PID ${pid}">✕</button>
        </div>
      `;
    }).join('');
  }

  function renderInstanceMixer() {
    if (!instanceMixerList) return;
    state.instanceVolumes = state.instanceVolumes || {};

    const allPids = Array.from(new Set([
      ...(state.runningPids || []),
      ...(state.instances || []).map(i => i.pid)
    ])).filter(p => p > 0);

    if (mixerActiveChannelsBadge) {
      mixerActiveChannelsBadge.textContent = `${allPids.length} Active ${allPids.length === 1 ? 'Channel' : 'Channels'}`;
      if (allPids.length > 0) {
        mixerActiveChannelsBadge.className = 'badge b-white';
        mixerActiveChannelsBadge.style.color = 'var(--green)';
        mixerActiveChannelsBadge.style.borderColor = 'rgba(34, 197, 94, 0.3)';
      } else {
        mixerActiveChannelsBadge.className = 'badge b-dark';
        mixerActiveChannelsBadge.style.color = '';
        mixerActiveChannelsBadge.style.borderColor = '';
      }
    }

    if (allPids.length === 0) {
      instanceMixerList.innerHTML = `
        <div class="instance-mixer-empty">
          <span class="material-icons-round">graphic_eq</span>
          <span>No active Roblox instances running. Launch accounts or builds to mix individual volume levels.</span>
        </div>
      `;
      return;
    }

    instanceMixerList.innerHTML = allPids.map(pid => {
      const inst = (state.instances || []).find(i => i.pid === pid) || {};
      const avatarSrc = inst.avatarUrl || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="%2352525b"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>';
      const displayName = inst.displayName || inst.username || `Roblox Client (${pid})`;
      const usernameDisp = inst.username ? `@${inst.username}` : `PID ${pid}`;
      const vol = state.instanceVolumes[pid] !== undefined ? state.instanceVolumes[pid] : 100;
      const isMuted = vol === 0;

      return `
        <div class="instance-mixer-row" data-pid="${pid}">
          <div class="instance-mixer-info">
            <img src="${avatarSrc}" alt="" class="instance-mixer-pfp">
            <div class="instance-mixer-names">
              <div class="instance-mixer-name">${displayName}</div>
              <div class="instance-mixer-sub">
                <span>${usernameDisp}</span>
                <span class="badge b-dark" style="font-size: 9px; padding: 0 4px;">PID ${pid}</span>
              </div>
            </div>
          </div>

          <div class="instance-mixer-controls">
            <button class="instance-mixer-mute-btn ${isMuted ? 'muted' : ''}" onclick="window.toggleInstanceMute(${pid})" title="${isMuted ? 'Unmute' : 'Mute'}">
              <span class="material-icons-round">${isMuted ? 'volume_off' : (vol > 50 ? 'volume_up' : (vol > 0 ? 'volume_down' : 'volume_mute'))}</span>
            </button>
            <div class="slider-wrap" style="flex: 1; max-width: 260px;">
              <input type="range" class="range-slider instance-vol-slider" min="0" max="100" value="${vol}" oninput="window.handleInstanceVolumeChange(${pid}, this.value)">
              <span class="slider-val instance-vol-val">${vol}%</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  window.handleInstanceVolumeChange = async (pid, val) => {
    const num = Number(val);
    state.instanceVolumes = state.instanceVolumes || {};
    state.instanceVolumes[pid] = num;
    const row = document.querySelector(`.instance-mixer-row[data-pid="${pid}"]`);
    if (row) {
      const valLabel = row.querySelector('.instance-vol-val');
      if (valLabel) valLabel.textContent = `${num}%`;
      const muteBtn = row.querySelector('.instance-mixer-mute-btn');
      if (muteBtn) {
        if (num === 0) {
          muteBtn.classList.add('muted');
          muteBtn.querySelector('.material-icons-round').textContent = 'volume_off';
        } else {
          muteBtn.classList.remove('muted');
          muteBtn.querySelector('.material-icons-round').textContent = num > 50 ? 'volume_up' : 'volume_down';
        }
      }
    }
    await window.api.setInstanceVolume(pid, num);
  };

  window.toggleInstanceMute = async (pid) => {
    state.instanceVolumes = state.instanceVolumes || {};
    const current = state.instanceVolumes[pid] !== undefined ? state.instanceVolumes[pid] : 100;
    const newVol = current > 0 ? 0 : (state.instanceLastVolumes?.[pid] || 100);
    if (current > 0) {
      state.instanceLastVolumes = state.instanceLastVolumes || {};
      state.instanceLastVolumes[pid] = current;
    }
    await window.handleInstanceVolumeChange(pid, newVol);
    const row = document.querySelector(`.instance-mixer-row[data-pid="${pid}"]`);
    if (row) {
      const slider = row.querySelector('.instance-vol-slider');
      if (slider) slider.value = newVol;
    }
  };

  window.killSpecificPid = async (pid) => {
    state.instances = (state.instances || []).filter(i => i.pid !== pid);
    state.runningPids = (state.runningPids || []).filter(p => p !== pid);
    syncActiveProcesses();
    await window.api.killPid(pid);
    log(`Killed Roblox process PID ${pid}`, 'err');
  };

  function updateMutexUI(held) {
    if (mutexPill && mutexLabel) {
      if (held) {
        mutexPill.className = 'tb-pill live';
        mutexLabel.textContent = 'Multi-Instance Active';
      } else {
        mutexPill.className = 'tb-pill';
        mutexLabel.textContent = 'Multi-Instance Standby';
      }
    }
    if (procMutexPill) {
      if (held) {
        procMutexPill.className = 'badge b-white';
        procMutexPill.textContent = 'MUTEX ACTIVE';
      } else {
        procMutexPill.className = 'badge b-dark';
        procMutexPill.textContent = 'MUTEX STANDBY';
      }
    }
  }

  window.api.onPidsUpdated((pids) => {
    updatePidsUI(pids);
  });

  window.api.onInstancesUpdated((instances) => {
    updateInstancesUI(instances);
  });

  window.api.onMutexStatus((held) => {
    updateMutexUI(held);
  });

  // Credits & Community Actions
  window.copyDevDiscord = (btn) => {
    navigator.clipboard.writeText('hor1zxn.');
    if (btn) {
      const label = btn.querySelector('.credit-btn-label') || btn;
      const oldText = label.textContent;
      label.textContent = 'Copied hor1zxn.!';
      btn.style.background = 'var(--green)';
      btn.style.borderColor = 'var(--green)';
      btn.style.color = '#000000';
      setTimeout(() => {
        label.textContent = oldText;
        btn.style.background = '';
        btn.style.borderColor = '';
        btn.style.color = '';
      }, 2000);
    }
    log('Copied Developer Discord: hor1zxn.', 'ok');
  };

  window.joinEternityDiscord = () => {
    window.api.openExternal('https://discord.gg/eQFcharHwS');
    log('Opening Project Eternity Discord community invite...', 'ok');
  };

  window.copyEternityInvite = (btn) => {
    navigator.clipboard.writeText('https://discord.gg/eQFcharHwS');
    if (btn) {
      const label = btn.querySelector('span:last-child') || btn;
      const oldText = label.textContent;
      label.textContent = 'Copied Link!';
      btn.style.borderColor = 'var(--green)';
      btn.style.color = 'var(--green)';
      setTimeout(() => {
        label.textContent = oldText;
        btn.style.borderColor = '';
        btn.style.color = '';
      }, 2000);
    }
    log('Copied Project Eternity Discord invite link: https://discord.gg/eQFcharHwS', 'ok');
  };

  // Initialize
  init();
});
