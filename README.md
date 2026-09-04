# 🦖 MultiBlox: Roblox Version Downgrader / Selector & Multi-Instance Manager

**MultiBlox** combines the best of **TiRex Downgrader** and **MultiRoblox-RAM** into a unified, high-performance Windows desktop application.

---

## 🌟 Key Features

### 🦖 Roblox Version Downgrader & Selector (TiRex Engine)
- **1-Click Downgrade & Launch**: Detects your currently installed Roblox version and compares it against the recommended stable/downgraded version. Downloads and launches in a single click.
- **"Launch More Instances"**: Rapidly spawn additional instances of the active or downgraded build.
- **Official Release Catalog**: Browse through over 370+ official historical Roblox releases with release dates and version hashes.
- **Custom Version Hash Input**: Directly paste any `version-xxxxxxxxxxxxxxxx` 16-hex hash to install and run.
- **Installed Builds Manager**: Inspect downloaded versions in `%LOCALAPPDATA%\Roblox\Versions`, view disk usage, set as active, launch directly, or delete old versions.
- **Native Package Extractor (RDD)**: High-speed extraction of all game packages (`RobloxApp.zip`, `shaders.zip`, `ssl.zip`, textures, terrain, models, etc.) directly into the appropriate folders with `AppSettings.xml`.

### 👥 Multi-Instance Roblox & Account Manager (RAM Engine)
- **Continuous Mutex Bypass**: Native helper (`RobloxNative.exe`) holds the `ROBLOX_singletonMutex` and closes `ROBLOX_singletonEvent` handles before every launch, allowing unlimited concurrent Roblox instances.
- **Encrypted Account Storage**: Save multiple accounts with AES-256-GCM encrypted `.ROBLOSECURITY` cookies. Displays avatars, user IDs, and nicknames.
- **Place Target Launcher**: Launch accounts directly into a specific Place ID, Private Server link, or Job ID with fresh authentication tickets.
- **Launch All / Kill All**: Launch entire groups of accounts in staggered intervals or terminate all Roblox instances with one click.

### 🎛️ Performance Mixer, Anti-AFK & FastFlags
- **Live Process Monitor**: Real-time list of all running `RobloxPlayerBeta.exe` processes with PID tracking and individual kill controls.
- **Roblox Master Volume**: Adjusts CoreAudio volume exclusively for Roblox audio sessions without affecting other Windows applications.
- **Anti-AFK Protection**: Prevents Roblox's 20-minute idle disconnect by simulating safe background input on a customizable timer.
- **Window Grid Arranger**: Automatically tiles multiple Roblox game windows across your screen (2x2 grid or side-by-side split).
- **FPS Unlocker & FastFlags**: Easily set `DFIntTaskSchedulerTargetFps` in `ClientAppSettings.json` for 60, 144, 240, 360, or uncapped FPS.

---

## 🚀 Quick Start

### 1. Run with `start.bat`
Simply double-click `start.bat` in the project folder:
```bat
start.bat
```
Or start via npm:
```bash
npm start
```

### 2. Recompile Native Helper (Optional)
If you ever modify `resources/RobloxNative.cs`, recompile with:
```bash
npm run compile-native
```
*(Uses Windows' built-in .NET Framework compiler `csc.exe` — no Visual Studio installation required)*

---

## 📂 Project Structure

```
multiblox/
├── package.json               # Node/Electron package manifest
├── start.bat                  # One-click desktop launcher
├── resources/
│   ├── RobloxNative.cs        # C# Native Mutex, handle closer & audio controller
│   ├── RobloxNative.exe       # Precompiled 64-bit native helper executable
│   └── icon.ico               # App icon
└── src/
    ├── main/
    │   ├── main.js            # Electron main process & IPC handlers
    │   ├── native-helper.js   # RobloxNative daemon supervisor
    │   ├── rdd-downloader.js  # Roblox Deployment Downloader engine
    │   ├── version-manager.js # Version scanner & catalog retriever
    │   ├── roblox-launcher.js # Direct process spawner & auth-ticket redeemer
    │   └── storage.js         # AES-256-GCM account and settings storage
    ├── preload/
    │   └── preload.js         # Context bridge exposing window.api
    └── renderer/
        ├── index.html         # Cyberpunk/glassmorphism UI layout
        ├── styles.css         # Modern design tokens, gradients & animations
        └── app.js             # Client controller, state & live monitors
```

---

## 🔒 Security Notice
All account session cookies (`.ROBLOSECURITY`) are encrypted locally with AES-256-GCM using an encrypted machine-specific key. No cookies or account credentials are ever transmitted to third-party servers.
