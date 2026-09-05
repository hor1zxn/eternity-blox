const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const EventEmitter = require('events');

class NativeHelper extends EventEmitter {
  constructor() {
    super();
    this.child = null;
    this.reqId = 1;
    this.pendingRequests = new Map();
    this.runningPids = [];
    this.mutexHeld = false;
    this.isShuttingDown = false;
    this.exePath = this.resolveExecutablePath();
    this.csPath = path.join(__dirname, '..', '..', 'resources', 'RobloxNative.cs');
  }

  resolveExecutablePath() {
    const candidates = [
      path.join(__dirname, '..', '..', 'resources', 'RobloxNative.exe'),
      path.join(process.resourcesPath || '', 'RobloxNative.exe'),
      path.join(process.resourcesPath || '', 'resources', 'RobloxNative.exe'),
      path.join(process.resourcesPath || '', 'app.asar.unpacked', 'resources', 'RobloxNative.exe')
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return candidates[0];
  }

  ensureExecutable() {
    this.exePath = this.resolveExecutablePath();
    if (fs.existsSync(this.exePath)) return true;
    const cscPath = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';
    if (!fs.existsSync(cscPath)) {
      throw new Error(`C# compiler not found at ${cscPath}`);
    }
    if (!fs.existsSync(this.csPath)) {
      throw new Error(`Native source not found at ${this.csPath}`);
    }
    console.log('[NativeHelper] Compiling RobloxNative.exe...');
    const cmd = `"${cscPath}" /nologo /optimize+ /platform:x64 /target:exe /r:System.Drawing.dll /out:"${this.exePath}" "${this.csPath}"`;
    execSync(cmd, { stdio: 'pipe' });
    return fs.existsSync(this.exePath);
  }

  sweepStrayHelpers() {
    try {
      execSync('taskkill /F /IM RobloxNative.exe /T', { stdio: 'ignore' });
    } catch {}
  }

  start() {
    if (this.child) return;
    this.ensureExecutable();
    this.sweepStrayHelpers();

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

      // Auto-restart if not shutting down
      if (!this.isShuttingDown) {
        setTimeout(() => this.start(), 1500);
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
      await this.send('closehandles');
      return true;
    } catch (err) {
      console.warn('[NativeHelper] closehandles warning:', err.message);
      return false;
    }
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
