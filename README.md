# ⚡ EternityBlox: Roblox Version Downgrader, Selector & Multi-Instance Manager

**EternityBlox** combines the best of **Roblox Version Management** and **High-Performance Multi-Instance Orchestration** into a unified, obsidian-dark desktop application for Windows.

---

## 🌟 Key Features

### 👥 High-Speed Multi-Instance & Account Manager
- **Active Singleton Handshake**: Native daemon actively hooks and clears `ROBLOX_singletonEvent` within ~2.5 seconds of process launch, allowing batch account launches in rapid succession without singleton collision crashes.
- **Strict 2x2 Quadrant Window Grid**: Automatically snaps clients into a clean 2x2 quadrant layout in normal windowed mode across your primary display (`Screen.WorkingArea`), respecting taskbars.
- **Zero-Trust Security Architecture**: Account `.ROBLOSECURITY` cookies are encrypted with AES-256-GCM via machine-bound hardware keys and strictly isolated in the Electron Main process. Raw credentials are never exposed to renderer processes or external networks.
- **Direct Place / Job ID Launcher**: Join games directly via Place ID, VIP server links, or Job IDs with authenticated session tickets.

### 🦖 Roblox Version Downgrader & Selector
- **1-Click Downgrade & Launch**: Detects installed Roblox versions and compares against the recommended stable downgraded build. Downloads and deploys in a single click.
- **Official Release Catalog**: Browse over 370+ official historical Roblox releases with release dates and version hashes.
- **Custom Version Hash Input**: Directly paste any `version-xxxxxxxxxxxxxxxx` 16-hex hash to install and run.
- **Native Package Extractor (RDD)**: High-speed extraction of all game packages (`RobloxApp.zip`, `shaders.zip`, `ssl.zip`, textures, terrain, models) directly with automated `AppSettings.xml` generation.

### 🎛️ Performance Mixer, Anti-AFK & FastFlags
- **Live Process Monitor**: Real-time list of all running `RobloxPlayerBeta.exe` processes with PID tracking and individual kill controls.
- **Roblox Master Volume**: Adjusts CoreAudio volume exclusively for Roblox audio sessions without affecting other Windows applications.
- **Anti-AFK Protection**: Prevents Roblox's 20-minute idle disconnect by simulating safe background input on a customizable timer.
- **FPS Unlocker & FastFlags**: Easily set `DFIntTaskSchedulerTargetFps` in `ClientAppSettings.json` for 15, 30, 60, Uncapped, or Custom FPS presets.

### 🚀 Sleek Startup Loader & Auto-Updater
- **Obsidian Startup Splash**: Frameless, GPU-accelerated splash screen with animated branding, version badges, and real-time initialization telemetry.
- **Automated Update Checking**: Verifies GitHub Releases on every launch. If a new version is detected, it downloads and prepares the update seamlessly before launching the dashboard.
- **Offline & Timeout Protection**: Strict 4-second timeout ensures the app opens immediately even when offline or experiencing network latency.

---

## 🚀 Quick Start

### 1. Run in Development
```bash
npm install
npm start
```

### 2. Build Production Installers
```bash
# Build standard NSIS Windows installer (.exe)
npm run dist

# Build standalone portable executable (.exe)
npm run dist:portable
```

### 3. Recompile Native Helper (Optional)
If you modify `resources/RobloxNative.cs`:
```bash
npm run compile-native
```
*(Uses Windows' built-in .NET Framework compiler `csc.exe` — no Visual Studio installation required)*

---

## 📂 Project Structure

```
eternity-blox/
├── package.json               # Node/Electron package manifest & build targets
├── README.md                  # Project documentation & release guide
├── resources/
│   ├── RobloxNative.cs        # C# Native Mutex, handle closer, 2x2 grid engine
│   ├── RobloxNative.exe       # Precompiled 64-bit native helper executable
│   ├── arrange-windows.ps1    # High-reliability PowerShell window tiling fallback
│   └── icon.ico               # Windows application icon
└── src/
    ├── main/
    │   ├── main.js            # Electron lifecycle, window manager & IPC router
    │   ├── updater.js         # Auto-updater engine with dual electron-updater & GitHub API checks
    │   ├── native-helper.js   # RobloxNative daemon supervisor & fast mutex handshake
    │   ├── rdd-downloader.js  # Roblox Deployment Downloader engine
    │   ├── version-manager.js # Version scanner & catalog retriever
    │   ├── roblox-launcher.js # Direct process spawner & auth-ticket redeemer
    │   └── storage.js         # AES-256-GCM zero-trust encrypted account storage
    ├── preload/
    │   ├── preload.js         # Secure context bridge for main dashboard
    │   └── splash-preload.js  # Sandboxed IPC bridge for startup splash window
    └── renderer/
        ├── index.html         # Modern obsidian gaming cockpit & sub-deck layout
        ├── styles.css         # Modern typography, glassmorphism & responsive layouts
        ├── app.js             # Client controller, accounts & live telemetry
        └── splash.html        # Frameless luxury startup loader window
```

---

## 🔒 Security Notice
All account session cookies (`.ROBLOSECURITY`) are encrypted locally with AES-256-GCM using machine-specific keys. No cookies or account credentials are ever transmitted to third-party servers.

---

## 📄 License
This project is licensed under the MIT License.
