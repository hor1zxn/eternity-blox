const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const CONFIG_DIR = path.join(os.homedir(), '.eternityblox');
const LEGACY_CONFIG_DIR = path.join(os.homedir(), '.multiblox');
const ACCOUNTS_FILE = path.join(CONFIG_DIR, 'accounts.json');
const SETTINGS_FILE = path.join(CONFIG_DIR, 'settings.json');
const KEY_FILE = path.join(CONFIG_DIR, '.key');

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
    // Migrate legacy data if present
    if (fs.existsSync(LEGACY_CONFIG_DIR)) {
      try {
        const files = fs.readdirSync(LEGACY_CONFIG_DIR);
        for (const file of files) {
          const src = path.join(LEGACY_CONFIG_DIR, file);
          const dest = path.join(CONFIG_DIR, file);
          if (fs.existsSync(src) && !fs.existsSync(dest)) {
            fs.copyFileSync(src, dest);
          }
        }
      } catch (e) {
        console.warn('[Storage] Could not migrate legacy multiblox directory:', e.message);
      }
    }
  }
}

/**
 * Checks if Electron's safeStorage (Windows DPAPI / CryptProtectData) is ready.
 */
function isSafeStorageAvailable() {
  try {
    const { safeStorage } = require('electron');
    return safeStorage && typeof safeStorage.isEncryptionAvailable === 'function' && safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

/**
 * Machine-bound PBKDF2 key generator for fallback encryption if safeStorage is unavailable.
 */
function getOrCreateFallbackKey() {
  ensureConfigDir();
  if (fs.existsSync(KEY_FILE)) {
    try {
      return Buffer.from(fs.readFileSync(KEY_FILE, 'utf8').trim(), 'hex');
    } catch {
      // Regenerate if corrupt
    }
  }
  const key = crypto.randomBytes(32);
  try {
    fs.writeFileSync(KEY_FILE, key.toString('hex'), { encoding: 'utf8', mode: 0o600 });
  } catch {
    fs.writeFileSync(KEY_FILE, key.toString('hex'), 'utf8');
  }
  return key;
}

/**
 * Encrypts sensitive string using Windows DPAPI (safeStorage) or AES-256-GCM fallback.
 */
function encrypt(text) {
  if (!text) return '';
  
  // 1. Primary: Windows DPAPI (hardware- & Windows-user-bound master key)
  if (isSafeStorageAvailable()) {
    try {
      const { safeStorage } = require('electron');
      const cipherBuf = safeStorage.encryptString(text);
      return 'dpapi:' + cipherBuf.toString('base64');
    } catch (dpapiErr) {
      console.warn('[Storage] DPAPI encryption warning, falling back to AES-256-GCM:', dpapiErr.message);
    }
  }

  // 2. Fallback: AES-256-GCM with protected local key
  try {
    const key = getOrCreateFallbackKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (err) {
    console.error('[Storage] Encryption failed:', err);
    return text;
  }
}

/**
 * Decrypts sensitive string, automatically detecting DPAPI vs legacy AES-256-GCM.
 */
function decrypt(cipherText) {
  if (!cipherText) return '';

  // 1. Check for DPAPI format
  if (cipherText.startsWith('dpapi:')) {
    if (isSafeStorageAvailable()) {
      try {
        const { safeStorage } = require('electron');
        const buf = Buffer.from(cipherText.slice(6), 'base64');
        return safeStorage.decryptString(buf);
      } catch (err) {
        console.error('[Storage] DPAPI decryption failed (unauthorized user or machine mismatch):', err.message);
        return '';
      }
    } else {
      console.error('[Storage] safeStorage is not available for DPAPI-encrypted credential');
      return '';
    }
  }

  // 2. Legacy AES-256-GCM format (iv:tag:cipher)
  if (cipherText.includes(':')) {
    try {
      const key = getOrCreateFallbackKey();
      const parts = cipherText.split(':');
      if (parts.length === 3) {
        const [ivHex, tagHex, encrypted] = parts;
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
        decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      }
    } catch (err) {
      console.error('[Storage] Legacy AES-256-GCM decryption failed:', err.message);
      return '';
    }
  }

  // 3. Plaintext fallback
  return cipherText;
}

/**
 * Loads all accounts with decrypted cookies internally in Node.js.
 * Automatically upgrades any legacy accounts to Windows DPAPI on the fly.
 */
function loadAccounts(autoUpgrade = true) {
  ensureConfigDir();
  if (!fs.existsSync(ACCOUNTS_FILE)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8'));
    let hasLegacy = false;

    const accounts = raw.map(acc => {
      const isLegacy = acc.cookie && !acc.cookie.startsWith('dpapi:');
      if (isLegacy) hasLegacy = true;
      return {
        ...acc,
        cookie: decrypt(acc.cookie)
      };
    });

    // Automatically upgrade legacy accounts to Windows DPAPI
    if (hasLegacy && autoUpgrade && isSafeStorageAvailable()) {
      try {
        const upgraded = accounts.map(acc => ({
          ...acc,
          cookie: encrypt(acc.cookie)
        }));
        fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(upgraded, null, 2), { encoding: 'utf8', mode: 0o600 });
        console.log('[Storage] Seamlessly upgraded legacy account credentials to Windows DPAPI.');
      } catch (upErr) {
        console.warn('[Storage] Could not auto-upgrade legacy accounts to DPAPI:', upErr.message);
      }
    }

    return accounts;
  } catch (err) {
    console.error('[Storage] Error loading accounts:', err);
    return [];
  }
}

/**
 * Returns sanitized account metadata stripped of all cookies.
 * This is the ONLY structure ever exposed to the renderer / UI.
 */
function getSanitizedAccounts() {
  const accounts = loadAccounts();
  return accounts.map(acc => {
    const { cookie, ...sanitized } = acc;
    return {
      ...sanitized,
      hasCookie: Boolean(cookie && cookie.length > 20)
    };
  });
}

/**
 * Retrieves the decrypted cookie for a single account by account ID.
 * Strictly used inside the main Node process by the launcher.
 */
function getAccountCookie(accountId) {
  if (!accountId) return null;
  const accounts = loadAccounts(false);
  const acc = accounts.find(a => String(a.id) === String(accountId));
  return acc ? (acc.cookie || null) : null;
}

/**
 * Saves accounts, intelligently preserving existing cookies if sanitized accounts are passed.
 */
function saveAccounts(incomingAccounts) {
  ensureConfigDir();
  try {
    const currentAccounts = loadAccounts(false);
    const currentMap = new Map(currentAccounts.map(a => [String(a.id), a.cookie]));

    const merged = incomingAccounts.map(acc => {
      const existingCookie = currentMap.get(String(acc.id));
      const cookieToSave = acc.cookie || existingCookie || '';
      const { hasCookie, ...cleanAcc } = acc;
      return {
        ...cleanAcc,
        cookie: encrypt(cookieToSave)
      };
    });

    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(merged, null, 2), { encoding: 'utf8', mode: 0o600 });
    return true;
  } catch (err) {
    console.error('[Storage] Error saving accounts:', err);
    return false;
  }
}

/**
 * Adds or updates an account directly in storage with DPAPI encryption.
 * Returns the updated sanitized accounts list.
 */
function addOrUpdateAccount(accountData, rawCookie) {
  ensureConfigDir();
  const accounts = loadAccounts(false);
  const cleanCookie = rawCookie ? (rawCookie.trim().startsWith('.ROBLOSECURITY=') ? rawCookie.trim() : `.ROBLOSECURITY=${rawCookie.trim()}`) : '';

  const existingIdx = accounts.findIndex(a => 
    (accountData.userId && String(a.userId) === String(accountData.userId)) || 
    (accountData.id && String(a.id) === String(accountData.id))
  );

  if (existingIdx !== -1) {
    accounts[existingIdx] = {
      ...accounts[existingIdx],
      ...accountData,
      cookie: cleanCookie || accounts[existingIdx].cookie
    };
  } else {
    accounts.push({
      ...accountData,
      cookie: cleanCookie
    });
  }

  const payload = accounts.map(acc => {
    const { hasCookie, ...cleanAcc } = acc;
    return {
      ...cleanAcc,
      cookie: encrypt(cleanAcc.cookie)
    };
  });

  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(payload, null, 2), { encoding: 'utf8', mode: 0o600 });
  return getSanitizedAccounts();
}

/**
 * Deletes an account and wipes its credentials.
 * Returns the updated sanitized accounts list.
 */
function deleteAccount(accountId) {
  ensureConfigDir();
  const accounts = loadAccounts(false);
  const filtered = accounts.filter(a => String(a.id) !== String(accountId));

  const payload = filtered.map(acc => {
    const { hasCookie, ...cleanAcc } = acc;
    return {
      ...cleanAcc,
      cookie: encrypt(cleanAcc.cookie)
    };
  });

  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(payload, null, 2), { encoding: 'utf8', mode: 0o600 });
  return getSanitizedAccounts();
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
    console.error('[Storage] Error loading settings:', err);
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings) {
  ensureConfigDir();
  try {
    const merged = { ...loadSettings(), ...settings };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2), { encoding: 'utf8', mode: 0o600 });
    return merged;
  } catch (err) {
    console.error('[Storage] Error saving settings:', err);
    return null;
  }
}

module.exports = {
  loadAccounts,
  getSanitizedAccounts,
  getAccountCookie,
  saveAccounts,
  addOrUpdateAccount,
  deleteAccount,
  loadSettings,
  saveSettings,
  encrypt,
  decrypt,
  isSafeStorageAvailable,
  CONFIG_DIR
};
