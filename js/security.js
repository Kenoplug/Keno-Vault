// ═══════════════════════════════════════════════════════════════
// security.js — Keno Vault Security Manager
// Handles: Privacy Shield, Auto-Lock PIN, AES Encryption, Legacy
// ═══════════════════════════════════════════════════════════════

const Security = (() => {
  // ── State ──────────────────────────────────────────────────────
  let _blurred        = false;
  let _locked         = false;
  let _pin            = null;
  let _lockTimer      = null;
  let _lockTimeout    = 5 * 60 * 1000; // 5 minutes
  let _isPro          = false;
  let _onLockCallback = null;

  // ── Privacy Shield ─────────────────────────────────────────────
  function toggleBlur(force) {
    if (!_isPro) { UI.toast('Privacy Shield is a Pro feature', 'info'); return; }
    _blurred = force !== undefined ? force : !_blurred;
    document.body.classList.toggle('privacy-blur', _blurred);
    localStorage.setItem('kv-blur', _blurred ? '1' : '0');
    const btn = document.getElementById('blurToggleBtn');
    if (btn) {
      btn.textContent = _blurred ? '👁 Reveal' : '🛡 Shield';
      btn.classList.toggle('active', _blurred);
    }
  }

  function initBlur() {
    _blurred = localStorage.getItem('kv-blur') === '1';
    if (_blurred) document.body.classList.add('privacy-blur');
    // Keyboard shortcut
    document.addEventListener('keydown', e => {
      if ((e.key === 'b' || e.key === 'B') &&
          !e.ctrlKey && !e.metaKey &&
          !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) {
        toggleBlur();
      }
    });
  }

  // ── Auto-Lock PIN (PBKDF2 via Web Crypto API) ───────────────────
  async function setPin(pin) {
    if (!_isPro) return false;
    try {
      const enc = new TextEncoder();
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const keyMaterial = await crypto.subtle.importKey(
        'raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']
      );
      const hash = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        keyMaterial, 256
      );
      const stored = {
        salt: Array.from(new Uint8Array(salt)),
        hash: Array.from(new Uint8Array(hash)),
      };
      localStorage.setItem('kv-pin', JSON.stringify(stored));
      _pin = stored;
      localStorage.setItem('kv-autolock', '1');
      resetLockTimer();
      return true;
    } catch (e) {
      console.warn('[Security] setPin failed:', e.message);
      return false;
    }
  }

  async function verifyPin(input) {
    const raw = localStorage.getItem('kv-pin');
    if (!raw) return true; // no pin set
    try {
      // Handle legacy Base64-encoded PINs — clear and require re-setup
      const stored = JSON.parse(raw);
      if (!stored || !stored.salt || !stored.hash) {
        // Old format — clear it
        localStorage.removeItem('kv-pin');
        localStorage.removeItem('kv-autolock');
        _pin = null;
        return false;
      }
      const enc = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        'raw', enc.encode(input), 'PBKDF2', false, ['deriveBits']
      );
      const hash = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: new Uint8Array(stored.salt), iterations: 100000, hash: 'SHA-256' },
        keyMaterial, 256
      );
      const inputBytes = new Uint8Array(hash);
      const storedBytes = new Uint8Array(stored.hash);
      if (inputBytes.length !== storedBytes.length) return false;
      return inputBytes.every(function(b, i) { return b === storedBytes[i]; });
    } catch (e) {
      // Corrupt or legacy format — clear
      console.warn('[Security] verifyPin error:', e.message);
      localStorage.removeItem('kv-pin');
      localStorage.removeItem('kv-autolock');
      _pin = null;
      return false;
    }
  }

  function clearPin() {
    localStorage.removeItem('kv-pin');
    localStorage.removeItem('kv-autolock');
    _pin = null;
    clearTimeout(_lockTimer);
  }

  function lock() {
    if (!_isPro || !localStorage.getItem('kv-pin')) return;
    _locked = true;
    _showLockScreen();
  }

  async function unlock(pin) {
    if (await verifyPin(pin)) {
      _locked = false;
      _hideLockScreen();
      resetLockTimer();
      return true;
    }
    return false;
  }

  function resetLockTimer() {
    if (!_isPro || !localStorage.getItem('kv-autolock')) return;
    clearTimeout(_lockTimer);
    _lockTimer = setTimeout(lock, _lockTimeout);
  }

  function initAutoLock() {
    if (!_isPro) return;
    _pin = localStorage.getItem('kv-pin');
    if (!_pin) return;
    // Reset timer on any interaction
    ['mousemove','keydown','click','scroll','touchstart'].forEach(ev => {
      document.addEventListener(ev, resetLockTimer, { passive: true });
    });
    resetLockTimer();
    // Lock when tab becomes hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && _isPro && _pin) lock();
    });
  }

  function _showLockScreen() {
    let screen = document.getElementById('lockScreen');
    if (!screen) {
      screen = document.createElement('div');
      screen.id = 'lockScreen';
      screen.innerHTML = `
        <div class="lock-card">
          <div class="lock-logo">⬡</div>
          <h2>Keno Vault Locked</h2>
          <p>Enter your PIN to continue</p>
          <div class="pin-dots" id="pinDots">
            <div class="pin-dot"></div><div class="pin-dot"></div>
            <div class="pin-dot"></div><div class="pin-dot"></div>
          </div>
          <div class="pin-pad">
            ${[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(k => `
              <button class="pin-key" data-key="${k}" onclick="Security.pinKeyPress('${k}')">${k}</button>
            `).join('')}
          </div>
          <div id="pinError" style="color:#f87171;font-size:13px;min-height:18px;margin-top:8px;text-align:center;"></div>
        </div>`;
      document.body.appendChild(screen);
    }
    screen.style.display = 'flex';
    _enteredPin = '';
    _updatePinDots();
  }

  function _hideLockScreen() {
    const screen = document.getElementById('lockScreen');
    if (screen) screen.style.display = 'none';
  }

  let _enteredPin = '';
  async function pinKeyPress(key) {
    if (key === '⌫') {
      _enteredPin = _enteredPin.slice(0, -1);
    } else if (_enteredPin.length < 4 && key !== '') {
      _enteredPin += key;
    }
    _updatePinDots();
    if (_enteredPin.length === 4) {
      setTimeout(async () => {
        if (!(await unlock(_enteredPin))) {
          document.getElementById('pinError').textContent = 'Incorrect PIN. Try again.';
          _enteredPin = '';
          _updatePinDots();
          // Shake animation
          const card = document.querySelector('.lock-card');
          card.style.animation = 'shake .4s ease';
          setTimeout(() => card.style.animation = '', 400);
        } else {
          document.getElementById('pinError').textContent = '';
        }
      }, 150);
    }
  }

  function _updatePinDots() {
    const dots = document.querySelectorAll('.pin-dot');
    dots.forEach((d, i) => d.classList.toggle('filled', i < _enteredPin.length));
  }

  // ── AES Encryption ─────────────────────────────────────────────
  async function encryptData(data, password) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key  = await crypto.subtle.deriveKey(
      { name:'PBKDF2', salt, iterations:100000, hash:'SHA-256' },
      keyMaterial, { name:'AES-GCM', length:256 }, false, ['encrypt']
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name:'AES-GCM', iv }, key, enc.encode(JSON.stringify(data)));
    return {
      encrypted: Array.from(new Uint8Array(encrypted)),
      iv: Array.from(iv),
      salt: Array.from(salt),
      version: '1.0',
      app: 'keno-vault',
      exportedAt: new Date().toISOString(),
    };
  }

  async function decryptData(payload, password) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
      { name:'PBKDF2', salt:new Uint8Array(payload.salt), iterations:100000, hash:'SHA-256' },
      keyMaterial, { name:'AES-GCM', length:256 }, false, ['decrypt']
    );
    const decrypted = await crypto.subtle.decrypt(
      { name:'AES-GCM', iv:new Uint8Array(payload.iv) }, key, new Uint8Array(payload.encrypted)
    );
    return JSON.parse(new TextDecoder().decode(decrypted));
  }

  async function exportEncrypted(assets, history, password) {
    if (!_isPro) { UI.toast('Encrypted backups are a Pro feature', 'info'); return; }
    try {
      const payload = await encryptData({ assets, history, exportedAt: new Date().toISOString() }, password);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
      const url  = URL.createObjectURL(blob);
      const lnk  = document.createElement('a');
      lnk.href = url;
      lnk.download = `keno-vault-backup-${new Date().toISOString().slice(0,10)}.enc.json`;
      lnk.click(); URL.revokeObjectURL(url);
      UI.toast('Encrypted backup downloaded ✓', 'success');
    } catch(e) { UI.toast('Encryption failed: ' + e.message, 'error'); }
  }

  async function importEncrypted(file, password) {
    if (!_isPro) { UI.toast('Encrypted imports are a Pro feature', 'info'); return null; }
    try {
      const text    = await file.text();
      const payload = JSON.parse(text);
      const data    = await decryptData(payload, password);
      UI.toast('Backup decrypted successfully ✓', 'success');
      return data;
    } catch(e) { UI.toast('Decryption failed — wrong password?', 'error'); return null; }
  }

  // ── Legacy Mode ────────────────────────────────────────────────
  function getLegacySettings() {
    return JSON.parse(localStorage.getItem('kv-legacy') || 'null');
  }
  function saveLegacySettings(settings) {
    localStorage.setItem('kv-legacy', JSON.stringify(settings));
    localStorage.setItem('kv-last-login', new Date().toISOString());
  }
  function updateLastLogin() {
    localStorage.setItem('kv-last-login', new Date().toISOString());
  }
  function checkLegacyStatus() {
    const settings = getLegacySettings();
    if (!settings || !settings.enabled || !settings.heirEmail) return;
    const lastLogin = localStorage.getItem('kv-last-login');
    if (!lastLogin) return;
    const daysSince = (Date.now() - new Date(lastLogin).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince >= (settings.timeoutDays || 180)) {
      console.warn('[Legacy Mode] Threshold reached — would trigger heir notification');
      // In production: call Supabase Edge Function to send heir email
    }
  }

  // ── Init ───────────────────────────────────────────────────────
  function init(isPro) {
    _isPro = isPro;
    initBlur();
    if (isPro) {
      initAutoLock();
      checkLegacyStatus();
      updateLastLogin();
    }
  }

  // ── CSS Injection ──────────────────────────────────────────────
  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* Privacy Shield */
      body.privacy-blur .sensitive { filter:blur(8px); transition:filter .3s; user-select:none; }
      body.privacy-blur .sensitive:hover { filter:blur(4px); }

      /* Lock Screen */
      #lockScreen {
        position:fixed;inset:0;background:rgba(10,10,10,0.95);backdrop-filter:blur(20px);
        z-index:9999;display:flex;align-items:center;justify-content:center;
      }
      .lock-card {
        background:#111;border:1px solid #222;border-radius:24px;padding:48px 40px;
        width:min(380px,95vw);text-align:center;
      }
      .lock-logo {
        width:56px;height:56px;background:linear-gradient(135deg,#f97316,#ea580c);
        border-radius:16px;display:flex;align-items:center;justify-content:center;
        font-size:26px;margin:0 auto 20px;
      }
      .lock-card h2 { font-family:'DM Serif Display',serif;font-size:24px;margin-bottom:8px; }
      .lock-card p  { color:#888;font-size:14px;margin-bottom:28px; }
      .pin-dots { display:flex;justify-content:center;gap:16px;margin-bottom:28px; }
      .pin-dot  { width:14px;height:14px;border-radius:50%;border:2px solid #444;transition:all .15s; }
      .pin-dot.filled { background:#f97316;border-color:#f97316; }
      .pin-pad  { display:grid;grid-template-columns:repeat(3,1fr);gap:10px;max-width:240px;margin:0 auto; }
      .pin-key  {
        background:#1a1a1a;border:1px solid #222;border-radius:10px;padding:16px;
        font-size:18px;font-weight:600;cursor:pointer;color:#f0f0f0;
        transition:all .15s;
      }
      .pin-key:hover  { background:#f97316;border-color:#f97316; }
      .pin-key:active { transform:scale(.95); }
      @keyframes shake {
        0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}
      }
    `;
    document.head.appendChild(style);
  }

  // Public API
  return {
    init, toggleBlur, setPin, verifyPin, clearPin, lock, unlock, pinKeyPress,
    exportEncrypted, importEncrypted, getLegacySettings, saveLegacySettings,
    updateLastLogin, injectStyles,
    get isBlurred() { return _blurred; },
    get isLocked()  { return _locked;  },
  };
})();