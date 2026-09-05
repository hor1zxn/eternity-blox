const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const EventEmitter = require('events');
const { app } = require('electron');

class NativeHelper extends EventEmitter {
  constructor() {
    super();
    this.child = null;
    this.reqId = 1;
    this.pendingRequests = new Map();
    this.runningPids = [];
    this.mutexHeld = false;
    this.isShuttingDown = false;
    this.restartAttempts = 0;
    this.lastStartTime = 0;
    this.exePath = this.resolveExecutablePath();
    this.csPath = path.join(__dirname, '..', '..', 'resources', 'RobloxNative.cs');
  }

  resolveExecutablePath() {
    const isPackaged = (app && app.isPackaged) || (__dirname.includes('app.asar'));
    if (isPackaged && process.resourcesPath) {
      const packagedCandidates = [
        path.join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'RobloxNative.exe'),
        path.join(process.resourcesPath, 'resources', 'RobloxNative.exe'),
        path.join(process.resourcesPath, 'RobloxNative.exe')
      ];
      for (const p of packagedCandidates) {
        if (fs.existsSync(p)) return p;
      }
    }

    const devPath = path.join(__dirname, '..', '..', 'resources', 'RobloxNative.exe');
    if (devPath.includes('app.asar') && !devPath.includes('app.asar.unpacked')) {
      const unpacked = devPath.replace('app.asar', 'app.asar.unpacked');
      if (fs.existsSync(unpacked)) return unpacked;
      if (process.resourcesPath) {
        const resCandidate = path.join(process.resourcesPath, 'resources', 'RobloxNative.exe');
        if (fs.existsSync(resCandidate)) return resCandidate;
      }
    }

    return devPath;
  }

  resolvePsScriptPath() {
    const isPackaged = (app && app.isPackaged) || (__dirname.includes('app.asar'));
    if (isPackaged && process.resourcesPath) {
      const packagedCandidates = [
        path.join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'arrange-windows.ps1'),
        path.join(process.resourcesPath, 'resources', 'arrange-windows.ps1'),
        path.join(process.resourcesPath, 'arrange-windows.ps1')
      ];
      for (const p of packagedCandidates) {
        if (fs.existsSync(p)) return p;
      }
    }

    const devPath = path.join(__dirname, '..', '..', 'resources', 'arrange-windows.ps1');
    if (devPath.includes('app.asar') && !devPath.includes('app.asar.unpacked')) {
      const unpacked = devPath.replace('app.asar', 'app.asar.unpacked');
      if (fs.existsSync(unpacked)) return unpacked;
    }
    return devPath;
  }

  ensureExecutable() {
    this.exePath = this.resolveExecutablePath();
    if (fs.existsSync(this.exePath)) return true;
    const sysRoot = process.env.SystemRoot || process.env.windir || 'C:\\Windows';
    const cscCandidates = [
      path.join(sysRoot, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe'),
      path.join(sysRoot, 'Microsoft.NET', 'Framework', 'v4.0.30319', 'csc.exe')
    ];
    const cscPath = cscCandidates.find(p => fs.existsSync(p));
    if (!cscPath) {
      throw new Error('Microsoft .NET Framework 4.0 C# compiler (csc.exe) not found on system.');
    }
    if (!fs.existsSync(this.csPath)) {
      throw new Error(`Native source not found at ${this.csPath}`);
    }
    console.log('[NativeHelper] Compiling RobloxNative.exe...');
    const cmd = `"${cscPath}" /nologo /optimize+ /platform:x64 /target:exe /r:System.Drawing.dll /r:System.Windows.Forms.dll /out:"${this.exePath}" "${this.csPath}"`;
    execSync(cmd, { stdio: 'pipe' });
    return fs.existsSync(this.exePath);
  }

  sweepStrayHelpers() {
    try {
      execSync('taskkill /F /IM RobloxNative.exe /T', { stdio: 'ignore' });
    } catch {}
  }

  start() {
    if (this.child || this.isShuttingDown) return;
    this.ensureExecutable();

    const now = Date.now();
    if (now - this.lastStartTime < 4000) {
      this.restartAttempts++;
    } else {
      this.restartAttempts = 0;
    }
    this.lastStartTime = now;

    if (this.restartAttempts >= 4) {
      console.warn('[NativeHelper] Native helper failed repeatedly. Suspending auto-restart to prevent spam.');
      return;
    }

    if (this.restartAttempts === 0) {
      this.sweepStrayHelpers();
    }

    console.log('[NativeHelper] Spawning RobloxNative.exe daemon...');
    this.child = spawn(this.exePath, ['daemon'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });

    const rl = readline.createInterface({ input: this.child.stdout });
    rl.on('line', (line) => this.handleLine(line));

    this.child.stderr.on('data', (data) => {
      console.error('[NativeHelper stderr]', data.toString().trim());
    });

    this.child.on('exit', (code) => {
      console.log(`[NativeHelper] Daemon exited with code ${code}`);
      this.child = null;
      this.mutexHeld = false;
      this.emit('mutex-status', false);

      if (code === 3) {
        // Exit code 3 is DUPLICATE helper. Do not loop-restart.
        return;
      }

      // Auto-restart with safe backoff if not shutting down
      if (!this.isShuttingDown && this.restartAttempts < 4) {
        const delay = Math.min(2000 * Math.pow(1.5, this.restartAttempts), 10000);
        setTimeout(() => this.start(), delay);
      }
    });

    // Start watching PIDs
    this.startWatch(1500);
  }

  handleLine(line) {
    line = line.trim();
    if (!line) return;

    if (line.startsWith('R|')) {
      const parts = line.split('|');
      const id = parseInt(parts[1], 10);
      const status = parts[2];
      const payload = parts.slice(3).join('|');

      if (this.pendingRequests.has(id)) {
        const { resolve, reject } = this.pendingRequests.get(id);
        this.pendingRequests.delete(id);
        if (status === 'OK') resolve(payload);
        else reject(new Error(payload));
      }
      return;
    }

    if (line.startsWith('E|')) {
      const parts = line.split('|');
      const eventType = parts[1];
      const payload = parts.slice(2).join('|');

      if (eventType === 'PIDS') {
        const pids = payload ? payload.split(',').map(x => parseInt(x, 10)).filter(x => !isNaN(x)) : [];
        this.runningPids = pids;
        this.emit('pids', pids);
      } else if (eventType === 'READY' || eventType === 'MUTEX_HELD') {
        this.mutexHeld = true;
        this.emit('mutex-status', true);
      }
    }
  }

  send(cmd, ...args) {
    if (!this.child || !this.child.stdin.writable) {
      return Promise.reject(new Error('Native helper is not running'));
    }
    const id = this.reqId++;
    const line = [id, cmd, ...args].join('|') + '\n';

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Command ${cmd} timed out`));
        }
      }, 10000);

      this.pendingRequests.set(id, {
        resolve: (val) => { clearTimeout(timer); resolve(val); },
        reject: (err) => { clearTimeout(timer); reject(err); }
      });

      this.child.stdin.write(line, 'utf8');
    });
  }

  async closeHandles() {
    try {
      const res = await this.send('closehandles');
      const count = parseInt(res, 10) || 0;
      console.log(`[NativeHelper] Closed ${count} singleton handle(s)`);
      return count;
    } catch (err) {
      console.warn('[NativeHelper] closehandles warning:', err.message);
      return 0;
    }
  }

  async getWindows() {
    try {
      const res = await this.send('windows');
      if (!res) return [];
      return res.split(',').map(x => parseInt(x.trim(), 10)).filter(x => !isNaN(x));
    } catch {
      return [];
    }
  }

  async isWindowReady(pid) {
    if (!pid) return false;
    const targetPid = parseInt(pid, 10);
    if (isNaN(targetPid) || targetPid <= 0) return false;
    try {
      const wins = await this.getWindows();
      if (wins.includes(targetPid)) return true;
    } catch {}

    try {
      const out = execSync(`powershell -NoProfile -Command "(Get-Process -Id ${targetPid} -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 }).Id"`, {
        timeout: 1000,
        stdio: ['ignore', 'pipe', 'ignore']
      }).toString().trim();
      const matched = parseInt(out, 10);
      if (matched === targetPid) return true;
    } catch {}

    return false;
  }

  async waitForWindow(pid, maxWaitMs = 15000) {
    const start = Date.now();
    const targetPid = Number(pid);
    while (Date.now() - start < maxWaitMs) {
      const ready = await this.isWindowReady(targetPid);
      if (ready) return true;

      const pids = await this.getPids();
      if (!pids.includes(targetPid)) return false;

      await new Promise(r => setTimeout(r, 300));
    }
    return false;
  }

  async tile2x2(targetPid = -1, slot = -1) {
    try {
      let res;
      if (targetPid > 0 && slot >= 0) {
        res = await this.send('tile2x2', String(targetPid), String(slot));
      } else {
        res = await this.send('tile2x2');
      }
      const count = parseInt(res, 10);
      return { success: true, count: isNaN(count) ? 0 : count };
    } catch (err) {
      console.warn('[NativeHelper] tile2x2 error:', err.message);
      try {
        const psScript = this.resolvePsScriptPath();
        if (fs.existsSync(psScript)) {
          const out = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psScript}" -Mode grid`, {
            timeout: 4000,
            stdio: ['ignore', 'pipe', 'ignore']
          }).toString().trim();
          const count = parseInt(out, 10) || 0;
          return { success: true, count, fallback: true };
        }
      } catch (psErr) {
        console.warn('[NativeHelper] PowerShell tile2x2 fallback error:', psErr.message);
      }
      return { success: false, error: err.message, count: 0 };
    }
  }

  async fastSingletonHandshake(timeoutMs = 4500) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const closed = await this.closeHandles();
      if (closed > 0) {
        console.log(`[NativeHelper] Fast handshake cleared ${closed} singleton handle(s) in ${Date.now() - start}ms`);
        await new Promise(r => setTimeout(r, 200));
        return closed;
      }
      await new Promise(r => setTimeout(r, 250));
    }
    // Safety fallback
    return await this.closeHandles();
  }

  async setMutex(enabled) {
    try {
      await this.send('mutex', enabled ? 'on' : 'off');
      this.mutexHeld = enabled;
      this.emit('mutex-status', enabled);
      return true;
    } catch (err) {
      console.error('[NativeHelper] setMutex error:', err);
      return false;
    }
  }

  async setVolume(percent) {
    try {
      const res = await this.send('volume', String(Math.round(percent)));
      return res;
    } catch (err) {
      console.error('[NativeHelper] setVolume error:', err);
      return false;
    }
  }

  async setInstanceVolume(pid, percent) {
    try {
      const res = await this.send('volume', String(Math.round(percent)), String(pid));
      return res;
    } catch (err) {
      console.error('[NativeHelper] setInstanceVolume error:', err);
      return false;
    }
  }

  async setAntiAfk(seconds = 1080) {
    try {
      return await this.send('antiafk', String(seconds), '0');
    } catch (err) {
      console.error('[NativeHelper] antiafk error:', err);
      return false;
    }
  }

  startWatch(intervalMs = 1500) {
    return this.send('watch', String(intervalMs)).catch(() => {});
  }

  async getPids() {
    try {
      const res = await this.send('pids');
      if (!res) return [];
      return res.split(',').map(x => parseInt(x.trim(), 10)).filter(x => !isNaN(x));
    } catch {
      return this.runningPids;
    }
  }

  killPid(pid) {
    try {
      execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
      this.runningPids = (this.runningPids || []).filter(p => p !== pid);
      this.emit('pids', this.runningPids);
      return true;
    } catch {
      return false;
    }
  }

  killAllRoblox() {
    try {
      execSync(`taskkill /F /IM RobloxPlayerBeta.exe /T`, { stdio: 'ignore' });
      this.runningPids = [];
      this.emit('pids', []);
      return true;
    } catch {
      return false;
    }
  }

  stop() {
    this.isShuttingDown = true;
    if (this.child) {
      try {
        this.child.stdin.write('0|shutdown\n');
        setTimeout(() => {
          if (this.child) {
            this.child.kill();
            this.child = null;
          }
        }, 1000);
      } catch {
        if (this.child) this.child.kill();
      }
    }
  }
}

module.exports = new NativeHelper();
