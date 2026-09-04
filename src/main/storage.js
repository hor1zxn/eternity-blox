const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const CONFIG_DIR = path.join(os.homedir(), '.multiblox');
const ACCOUNTS_FILE = path.join(CONFIG_DIR, 'accounts.json');
const SETTINGS_FILE = path.join(CONFIG_DIR, 'settings.json');
const KEY_FILE = path.join(CONFIG_DIR, '.key');

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function getOrCreateKey() {
  ensureConfigDir();
  if (fs.existsSync(KEY_FILE)) {
    try {
      return Buffer.from(fs.readFileSync(KEY_FILE, 'utf8').trim(), 'hex');
    } catch {
      // Regenerate if corrupt
    }
  }
  const key = crypto.randomBytes(32);
  fs.writeFileSync(KEY_FILE, key.toString('hex'), { mode: 0o600 });
  return key;
}

function encrypt(text) {
  if (!text) return '';
  try {
    const key = getOrCreateKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (err) {
    console.error('Encryption failed:', err);
    return text;
  }
}

function decrypt(cipherText) {
  if (!cipherText) return '';
  if (!cipherText.includes(':')) return cipherText; // Plaintext fallback
  try {
    const key = getOrCreateKey();
    const [ivHex, tagHex, encrypted] = cipherText.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Decryption failed:', err);
    return '';
  }
}

function loadAccounts() {
  ensureConfigDir();
  if (!fs.existsSync(ACCOUNTS_FILE)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8'));
    return raw.map(acc => ({
      ...acc,
      cookie: decrypt(acc.cookie)
    }));
  } catch (err) {
    console.error('Error loading accounts:', err);
    return [];
  }
}

function saveAccounts(accounts) {
  ensureConfigDir();
  try {
    const payload = accounts.map(acc => ({
      ...acc,
      cookie: encrypt(acc.cookie)
    }));
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(payload, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error saving accounts:', err);
    return false;
  }
}

const DEFAULT_SETTINGS = {
  activeVersion: '',
  recommendedVersion: '',
  lockChannel: true,
  multiInstance: true,
  antiAfk: true,
  antiAfkInterval: 1080, // 18 mins
  masterVolume: 100,
  fpsCap: 0, // uncapped
  gameTarget: '',
  staggerMs: 1200
};

function loadSettings() {
  ensureConfigDir();
  if (!fs.existsSync(SETTINGS_FILE)) return { ...DEFAULT_SETTINGS };
  try {
    const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    return { ...DEFAULT_SETTINGS, ...data };
  } catch (err) {
    console.error('Error loading settings:', err);
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings) {
  ensureConfigDir();
  try {
    const merged = { ...loadSettings(), ...settings };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2), 'utf8');
    return merged;
  } catch (err) {
    console.error('Error saving settings:', err);
    return null;
  }
}

module.exports = {
  loadAccounts,
  saveAccounts,
  loadSettings,
  saveSettings,
  encrypt,
  decrypt,
  CONFIG_DIR
};
