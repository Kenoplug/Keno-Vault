// ═══════════════════════════════════════════════════════════════
// app.js — Keno Vault Core Application Logic
// ═══════════════════════════════════════════════════════════════

// ══ CONFIG ══════════════════════════════════════════════════════
// Shared constants (SUPA_URL, SUPA_KEY, ADMIN_EMAIL, SITE_URL) are in js/config.js
// Load that file before this one.
const FREE_LIMIT = 10;

// ══ GLOBAL HELPERS (used by inline HTML oninput handlers) ═══════
function curSym()  { return (Calculators && Calculators.getCurrencySymbol) ? Calculators.getCurrencySymbol(Calculators.getBaseCurrency()) : '$'; }
function toDisplay(v) {
  // Convert a stored (native) value to the display (base) currency
  var native = Calculators.getNativeCurrency();
  var base   = Calculators.getBaseCurrency();
  if (native !== base) return Calculators.convertCurrency(v || 0, native, base);
  return v || 0;
}
function toStored(v) {
  // Convert a display (base) value to the storage (native) currency
  var native = Calculators.getNativeCurrency();
  var base   = Calculators.getBaseCurrency();
  if (native !== base) return Calculators.convertCurrency(v || 0, base, native);
  return v || 0;
}
function fmtAmt(v) {
  return curSym() + Math.round(Math.abs(toDisplay(v))).toLocaleString();
}

// ══ STYLED CONFIRM DIALOG ═════════════════════════════════════════
function showConfirm(title, msg, okText, icon) {
  return new Promise(function(resolve) {
    document.getElementById('confirmIcon').textContent = icon || '⚠️';
    document.getElementById('confirmTitle').textContent = title || 'Are you sure?';
    document.getElementById('confirmMsg').textContent = msg || '';
    document.getElementById('confirmOk').textContent = okText || 'Confirm';
    var okBtn = document.getElementById('confirmOk');
    okBtn.style.background = (okText === 'Delete' || okText === 'Sign Out') ? 'var(--red)' : 'var(--red)';
    okBtn.style.color = '#fff';
    okBtn.style.border = 'none';
    function cleanup(val) {
      closeModal('confirmModal');
      document.getElementById('confirmCancel').onclick = null;
      document.getElementById('confirmOk').onclick = null;
      resolve(val);
    }
    document.getElementById('confirmCancel').onclick = function() { cleanup(false); };
    document.getElementById('confirmOk').onclick = function() { cleanup(true); };
    openModal('confirmModal');
  });
}

// ══ VERSION CHECK ════════════════════════════════════════════════
function checkAppVersion() {
  if (typeof APP_VERSION === 'undefined') { console.warn('[Version] APP_VERSION not loaded — skipping check'); return; }
  var stored = localStorage.getItem('kv-version');
  if (stored === APP_VERSION) return;
  localStorage.setItem('kv-version', APP_VERSION);
  // Show update popup
  setTimeout(function() {
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);backdrop-filter:blur(8px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.id = 'versionPopup';
    overlay.innerHTML =
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:32px 28px;text-align:center;max-width:380px;width:100%;box-shadow:0 24px 60px rgba(0,0,0,0.5);">' +
        '<div style="font-size:40px;margin-bottom:12px;">⬡</div>' +
        '<div class="serif" style="font-size:20px;margin-bottom:8px;">Keno Vault Updated</div>' +
        '<p style="font-size:13px;color:var(--text-dim);line-height:1.7;margin-bottom:8px;">A new version is available with improvements, fixes, and fresh features to keep your vault running smoothly.</p>' +
        '<p style="font-size:11px;color:var(--text-muted);margin-bottom:20px;">Version ' + APP_VERSION + ' · Refresh to apply changes</p>' +
        '<button onclick="location.reload()" style="width:100%;padding:12px;background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;border:none;border-radius:10px;font-family:\'DM Sans\',sans-serif;font-size:14px;font-weight:600;cursor:pointer;">Update Now →</button>' +
        '<button onclick="document.getElementById(\'versionPopup\').remove()" style="width:100%;margin-top:8px;padding:10px;background:transparent;color:var(--text-dim);border:none;border-radius:10px;font-family:\'DM Sans\',sans-serif;font-size:13px;cursor:pointer;">Later</button>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
  }, 800);
}

// ══ CURRENCY HELPERS ══════════════════════════════════════════════
function toNativeAmount(amount) {
  var native = Calculators.getNativeCurrency();
  var base   = Calculators.getBaseCurrency();
  if (native !== base) {
    return Calculators.convertCurrency(amount, base, native);
  }
  return amount;
}
function updateCurrencyLabels() {
  var sym = curSym();
  var labels = { lblEValue: 'Value ('+sym+')', lblESalvage: 'Salvage Value ('+sym+')', lblEPrincipal: 'Principal ('+sym+')', lblFValue: 'Current Value ('+sym+')', lblFSalvage: 'Salvage Value ('+sym+')', lblFPrincipal: 'Principal ('+sym+')' };
  Object.keys(labels).forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.textContent = labels[id];
  });
}

// ══ EMAIL NOTIFICATIONS ═══════════════════════════════════════════
var NOTIFY_URL = 'https://soxqotattmhahzpehycz.supabase.co/functions/v1/send-notification';

function getNotifPrefs() {
  try {
    return JSON.parse(localStorage.getItem('kv-notif-prefs') || '{}');
  } catch(e) { return {}; }
}

function notifEnabled(key) {
  var p = getNotifPrefs();
  // Defaults: login_alerts=true, security_alerts=true, welcome_emails=true, digests=false
  if (p[key] === undefined) return key !== 'weekly_digest' && key !== 'monthly_digest';
  return !!p[key];
}

function getDeviceInfo() {
  var ua = navigator.userAgent || '';
  var browser = 'Unknown', os = 'Unknown';
  if (ua.includes('Firefox/'))    { browser = 'Firefox '    + (ua.match(/Firefox\/(\d+)/)    || [])[1]; }
  else if (ua.includes('Edg/'))   { browser = 'Edge '       + (ua.match(/Edg\/(\d+)/)       || [])[1]; }
  else if (ua.includes('Chrome/')){ browser = 'Chrome '     + (ua.match(/Chrome\/(\d+)/)    || [])[1]; }
  else if (ua.includes('Safari/')){ browser = 'Safari '     + (ua.match(/Version\/(\d+)/)   || [])[1]; }
  if (ua.includes('Windows'))     { os = 'Windows'; }
  else if (ua.includes('Mac OS')) { os = 'macOS'; }
  else if (ua.includes('Linux'))  { os = 'Linux'; }
  else if (ua.includes('Android')){ os = 'Android'; }
  else if (ua.includes('iPhone') || ua.includes('iPad')) { os = 'iOS'; }
  return {
    browser: browser,
    os: os,
    timestamp: new Date().toLocaleString(),
    ip: '(not collected)',
    country: '(not collected)'
  };
}

async function sendNotification(type, data) {
  if (!currentUser || !currentUser.email) return;
  var key = type === 'login_alert' ? 'login_alerts' :
            type === 'security_alert' ? 'security_alerts' :
            type === 'welcome' ? 'welcome_emails' :
            type === 'digest' ? (data && data.period === 'Monthly' ? 'monthly_digest' : 'weekly_digest') : null;
  if (key && !notifEnabled(key)) return;
  try {
    await fetch(NOTIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: type, email: currentUser.email, data: data || {} }),
    });
  } catch(e) { /* fire-and-forget — don't block UI */ }
}

async function sendLoginAlert() {
  if (!notifEnabled('login_alerts')) return;
  await sendNotification('login_alert', getDeviceInfo());
}

async function sendWelcomeEmail(name) {
  if (!notifEnabled('welcome_emails')) return;
  await sendNotification('welcome', { name: name || currentUser.email.split('@')[0] });
}

async function sendSecurityAlert(changeDescription) {
  if (!notifEnabled('security_alerts')) return;
  var info = getDeviceInfo();
  info.change_description = changeDescription;
  await sendNotification('security_alert', info);
}

// ══ SLIDER TRACK FILL ═════════════════════════════════════════════
function fillSliderTrack(slider) {
  var pct = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
  var accent = '#f97316';
  var track = document.documentElement.getAttribute('data-theme') === 'light' ? '#e2e2e6' : '#1A1A1E';
  slider.style.background = 'linear-gradient(to right, ' + accent + ' 0%, ' + accent + ' ' + pct + '%, ' + track + ' ' + pct + '%, ' + track + ' 100%) center/100% 6px no-repeat';
}

function initAllSliderTracks() {
  document.querySelectorAll('input[type=range]').forEach(function(s) { fillSliderTrack(s); });
}

// ══ BACHS UPGRADE ════════════════════════════════════════════════
var EDGE_URL = 'https://soxqotattmhahzpehycz.supabase.co/functions/v1/create-checkout';

async function upgradeTo(plan) {
  if (!currentUser) { UI.toast('Sign in first', 'error'); return; }
  try {
    var btn = document.querySelector('#upgradeModal .btn-primary');
    if (btn) { btn.disabled = true; btn.textContent = 'Connecting to checkout…'; }
    var resp = await fetch(EDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SUPA_KEY },
      body: JSON.stringify({ email: currentUser.email, plan: plan }),
    });
    var data = await resp.json();
    console.log('[Bachs]', data);
    if (data.url) {
      window.location.href = data.url;
    } else {
      UI.toast('Payment service unavailable. Try again or contact support.', 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'Pay — Card · Bank · Crypto'; }
    }
  } catch(e) {
    UI.toast('Payment service error: ' + e.message, 'error');
    var btn = document.querySelector('#upgradeModal .btn-primary');
    if (btn) { btn.disabled = false; btn.textContent = 'Pay — Card · Bank · Crypto'; }
  }
}

// ══ DEBT MULTIPLIER ═══════════════════════════════════════════════
var _debtMul = 1;
function setDebtMul(mul, btn) {
  _debtMul = mul;
  document.querySelectorAll('#debtMulChips .toggle-chip').forEach(function(c) { c.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  updateDebtDisplay();
  runDebt();
}
function getDebtExtra() {
  var sl = document.getElementById('debtExtraSlider');
  var displayVal = (parseInt(sl ? sl.value : 500) || 0) * _debtMul;
  // Convert display currency → native for consistent simulation with asset values
  return Math.round(toStored(displayVal));
}
function updateDebtDisplay() {
  var sv = document.getElementById('debtExtraVal');
  if (sv) sv.textContent = curSym() + Math.round(toDisplay(getDebtExtra())).toLocaleString();
  var mn = document.getElementById('debtMinLabel');
  var mx = document.getElementById('debtMaxLabel');
  if (mn) mn.textContent = curSym() + '0';
  if (mx) mx.textContent = curSym() + Math.round(toDisplay(100000 * _debtMul)).toLocaleString();
  var debtSlider = document.getElementById('debtExtraSlider');
  if (debtSlider) fillSliderTrack(debtSlider);
}

const sb = createSupabaseClient();

// ══ CHART GLOBAL DEFAULTS ══════════════════════════════════════════
if (typeof Chart !== 'undefined') {
  Chart.defaults.font.family = "'DM Sans', sans-serif";
  Chart.defaults.font.size = 11;
  Chart.defaults.plugins.tooltip.titleFont = { family: "'DM Sans', sans-serif", weight: '600', size: 12 };
  Chart.defaults.plugins.tooltip.bodyFont = { family: "'JetBrains Mono', monospace", size: 11 };
  Chart.defaults.plugins.tooltip.displayColors = false;
  Chart.defaults.plugins.tooltip.padding = 12;
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.pointStyle = 'rectRounded';
  Chart.defaults.plugins.legend.labels.pointStyleWidth = 10;
  Chart.defaults.plugins.legend.labels.padding = 16;
  Chart.defaults.plugins.legend.labels.font = { size: 11 };
  Chart.defaults.scales.xy = { grid: { drawBorder: false }, border: { display: false } };
}

// ══ STATE ════════════════════════════════════════════════════════
let assets = [], nwHistory = [], currentUser = null, userPlan = 'free', bootDone = false;
let editId = null, activity = [];
let donutChart = null, barChart = null, historyChart = null;
let fireChart = null, debtChart = null, investChart2 = null;

// ══ CONSTANTS ════════════════════════════════════════════════════
const CAT = {
  cash:       { l: 'Liquid Cash',      i: '💵' },
  physical:   { l: 'Physical Assets',  i: '📦' },
  investment: { l: 'Investments',      i: '📈' },
  liability:  { l: 'Liability',        i: '⚠️'  },
};
const BADGE_DARK = {
  cash:       'background:rgba(79,142,247,0.15);color:#7eb3fa;',
  physical:   'background:rgba(52,211,153,0.15);color:#6ee7b7;',
  investment: 'background:rgba(244,197,83,0.15);color:#fcd34d;',
  liability:  'background:rgba(248,113,113,0.15);color:#fca5a5;',
};
const BADGE_LIGHT = {
  cash:       'background:rgba(79,142,247,0.15);color:#2563eb;',
  physical:   'background:rgba(22,163,74,0.1);color:#16a34a;',
  investment: 'background:rgba(217,119,6,0.1);color:#d97706;',
  liability:  'background:rgba(220,38,38,0.1);color:#dc2626;',
};

// ══ HELPERS ══════════════════════════════════════════════════════
const isGrowth   = () => userPlan === 'growth' || userPlan === 'pro';
const isPro      = () => userPlan === 'pro';
const isAdmin    = () => currentUser?.email === ADMIN_EMAIL;
const fmt        = n  => Calculators.formatCurrency(Math.abs(toDisplay(n)));
const fmtSigned  = n  => (n < 0 ? '-' : '') + fmt(n);
const fmtShort   = n  => {
  var a = Math.abs(toDisplay(n));
  var s = curSym();
  if (a >= 1e9) return s + (a / 1e9).toFixed(1) + 'B';
  if (a >= 1e6) return s + (a / 1e6).toFixed(1) + 'M';
  if (a >= 1e3) return s + (a / 1e3).toFixed(0) + 'k';
  return s + a.toFixed(0);
};
const getBadge   = () => getTheme() === 'light' ? BADGE_LIGHT : BADGE_DARK;

// ══ TOAST ════════════════════════════════════════════════════════
const UI = {
  toast(msg, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast-item ${type}`;
    el.innerHTML = `<span>${{ success: '✓', error: '✕', info: 'ℹ' }[type]}</span> ${msg}`;
    document.getElementById('toast').appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }
};

// ══ SYNC STATE ═══════════════════════════════════════════════════
function setSyncState(state, label) {
  const dot = document.getElementById('syncDot');
  const lbl = document.getElementById('syncLabel');
  if (dot) { dot.className = 'sync-dot'; dot.classList.add(state); }
  if (lbl) lbl.textContent = label;
}

// ══ SCREEN MANAGEMENT ════════════════════════════════════════════
function showLoading(msg = 'Loading…') {
  document.getElementById('loadingScreen').style.display = 'flex';
  document.getElementById('loadingMsg').textContent = msg;
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('appLayout').style.display = 'none';
}
function showAuth() {
  document.getElementById('loadingScreen').style.display = 'none';
  document.getElementById('authScreen').style.display = 'flex';
  document.getElementById('appLayout').style.display = 'none';
}
function showApp() {
  document.getElementById('loadingScreen').style.display = 'none';
  document.getElementById('authScreen').style.display = 'none';
  const layout = document.getElementById('appLayout');
  layout.style.display = window.innerWidth < 900 ? 'flex' : 'grid';
  layout.style.flexDirection = 'column';
  showMobileNav();
}

// ══ MODAL ════════════════════════════════════════════════════════
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.modal-overlay').forEach(o =>
  o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); })
);

// ══ THEME ════════════════════════════════════════════════════════
function getTheme() { return localStorage.getItem('kv-theme') || 'dark'; }
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('kv-theme', t);
}
function toggleTheme() {
  applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
  var btn = document.getElementById('themeToggleBtn');
  if (btn) btn.innerHTML = getTheme() === 'dark' ? '<i class=\"fas fa-moon\"></i> Dark' : '<i class=\"fas fa-sun\"></i> Light';
  rerenderCharts();
}
applyTheme(getTheme());

// ══ PRIVACY BLUR ═════════════════════════════════════════════════
let _blurred = false;
function toggleBlur() {
  if (!isPro()) { UI.toast('Privacy Shield is a Pro feature', 'info'); return; }
  _blurred = !_blurred;
  document.body.classList.toggle('privacy-blur', _blurred);
  const btn = document.getElementById('blurToggleBtn');
  if (btn) { btn.innerHTML = _blurred ? '<i class="fas fa-eye"></i> Reveal' : '<i class="fas fa-shield-halved"></i> Shield'; btn.classList.toggle('active', _blurred); }
}
document.addEventListener('keydown', e => {
  if ((e.key === 'b' || e.key === 'B') && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) {
    toggleBlur();
  }
});

// ══ NAVIGATION ═══════════════════════════════════════════════════
function switchPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.mob-nav-btn').forEach(n => n.classList.remove('active'));
  const page = document.getElementById('page-' + name);
  if (page) page.classList.add('active');
  const navEl = document.getElementById('nav-' + name);
  if (navEl) navEl.classList.add('active');
  const mobNavEl = document.getElementById('mob-' + name);
  if (mobNavEl) mobNavEl.classList.add('active');
  const titleEl = document.getElementById('pageTitle');
  if (titleEl) titleEl.textContent = name.charAt(0).toUpperCase() + name.slice(1);
  // Scroll to top on mobile page switch
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (name === 'investments') renderInvestmentPage();
}

// Explicit lock/content ID mapping (IDs differ between pages)
var PRO_PAGE_IDS = {
  // Growth tier unlocks
  score:     { lock: 'scoreLockPage', content: 'scoreContent',     tier: 'growth' },
  currency:  { lock: 'currencyLock',  content: 'currencyContent',  tier: 'growth' },
  optimizer: { lock: 'optimizerLock', content: 'optimizerContent', tier: 'growth' },
  goals:     { lock: 'goalsLock',     content: 'goalsContent',     tier: 'growth' },
  // Pro tier unlocks
  fire:      { lock: 'fireLock',      content: 'fireContent',      tier: 'pro' },
  debt:      { lock: 'debtLock',      content: 'debtContent',      tier: 'pro' },
  tax:       { lock: 'taxLock',       content: 'taxContent',       tier: 'pro' },
};

function switchProPage(name) {
  switchPage(name);
  var ids = PRO_PAGE_IDS[name];
  if (ids) {
    var neededTier = ids.tier || 'pro';
    var unlocked = (neededTier === 'growth') ? isGrowth() : isPro();
    var lockEl    = document.getElementById(ids.lock);
    var contentEl = document.getElementById(ids.content);
    if (lockEl)    lockEl.style.display    = unlocked ? 'none'  : 'block';
    if (contentEl) contentEl.style.display = unlocked ? 'block' : 'none';
    if (!unlocked) { openModal('upgradeModal'); return; }
  }
  if (name === 'fire')      { runFire();        initAllSliderTracks(); return; }
  if (name === 'debt')      { runDebt();        initAllSliderTracks(); return; }
  if (name === 'tax')       { runTax();         return; }
  if (name === 'optimizer') { runOptimizer();   return; }
  if (name === 'score')     { renderScore();    return; }
  if (name === 'currency')  { renderCurrency(); return; }
  if (name === 'goals')     { renderGoals();    return; }
}

function togglePanel(panelId, chipId) {
  const panel = document.getElementById(panelId);
  const chip  = document.getElementById(chipId);
  if (!panel || !chip) return;
  panel.classList.toggle('open');
  chip.classList.toggle('active');
}

// ══ AUTH ═════════════════════════════════════════════════════════
// ── Email/Password Auth ───────────────────────────────────────
function switchAuthTab(tab) {
  var isSignIn = tab === 'signin';
  var isForgot = tab === 'forgot';
  document.getElementById('signInForm').style.display  = isSignIn ? 'block' : 'none';
  document.getElementById('signUpForm').style.display  = tab === 'signup' ? 'block' : 'none';
  document.getElementById('forgotForm').style.display  = isForgot ? 'block' : 'none';
  var tabSI = document.getElementById('tabSignIn');
  var tabSU = document.getElementById('tabSignUp');
  if (tabSI) {
    tabSI.style.color = isSignIn ? 'var(--text)' : 'var(--text-dim)';
    tabSI.style.borderBottomColor = isSignIn ? 'var(--accent)' : 'transparent';
  }
  if (tabSU) {
    tabSU.style.color = tab === 'signup' ? 'var(--text)' : 'var(--text-dim)';
    tabSU.style.borderBottomColor = tab === 'signup' ? 'var(--accent)' : 'transparent';
  }
  clearAuthMessages();
}

function showForgotPassword() {
  document.getElementById('signInForm').style.display = 'none';
  document.getElementById('signUpForm').style.display = 'none';
  document.getElementById('forgotForm').style.display = 'block';
  clearAuthMessages();
}

function clearAuthMessages() {
  const e = document.getElementById('authError');   if (e) e.textContent = '';
  const s = document.getElementById('authSuccess'); if (s) s.textContent = '';
}

function setAuthError(msg) {
  const e = document.getElementById('authError'); if (e) e.textContent = msg;
}
function setAuthSuccess(msg) {
  const s = document.getElementById('authSuccess'); if (s) s.textContent = msg;
}

async function signInEmail() {
  const email    = (document.getElementById('siEmail')?.value    || '').trim();
  const password = (document.getElementById('siPassword')?.value || '').trim();
  clearAuthMessages();
  if (!email || !password) { setAuthError('Please enter your email and password.'); return; }
  const btn = document.getElementById('signInBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Signing in…'; }
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    setAuthError(error.message === 'Invalid login credentials'
      ? 'Incorrect email or password. Please try again.'
      : error.message);
    if (btn) { btn.disabled = false; btn.textContent = 'Sign In →'; }
    return;
  }
  // Success — onAuthStateChange will handle the rest
  if (btn) { btn.disabled = false; btn.textContent = 'Sign In →'; }
}

async function signUpEmail() {
  const name     = (document.getElementById('suName')?.value     || '').trim();
  const email    = (document.getElementById('suEmail')?.value    || '').trim();
  const password = (document.getElementById('suPassword')?.value || '').trim();
  clearAuthMessages();
  if (!name)             { setAuthError('Please enter your name.'); return; }
  if (!email)            { setAuthError('Please enter your email.'); return; }
  if (password.length < 8) { setAuthError('Password must be at least 8 characters.'); return; }
  const btn = document.getElementById('signUpBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Creating account…'; }
  const { data, error } = await sb.auth.signUp({
    email, password,
    options: { data: { full_name: name, display_name: name } }
  });
  if (error) {
    setAuthError(error.message);
    if (btn) { btn.disabled = false; btn.textContent = 'Create Account →'; }
    return;
  }
  // Check if email confirmation is needed
  if (data.user && !data.session) {
    setAuthSuccess('Account created! Check your email to confirm your account, then sign in.');
    if (btn) { btn.disabled = false; btn.textContent = 'Create Account →'; }
    setTimeout(() => switchAuthTab('signin'), 3000);
    // Send welcome email — fire and forget
    if (data.user.email) {
      fetch(NOTIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'welcome', email: data.user.email, data: { name: name } }),
      }).catch(function(){});
    }
  }
  // If no confirmation needed, onAuthStateChange handles login
  if (btn) { btn.disabled = false; btn.textContent = 'Create Account →'; }
}

async function sendPasswordReset() {
  const email = (document.getElementById('forgotEmail')?.value || '').trim();
  clearAuthMessages();
  if (!email) { setAuthError('Please enter your email address.'); return; }
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/pages/dashboard.html'
  });
  if (error) { setAuthError(error.message); return; }
  setAuthSuccess('Reset link sent! Check your inbox (and spam folder).');
}

async function signInWithGoogle() {
  const btn = document.getElementById('googleSignInBtn');
  clearAuthMessages();
  if (btn) { btn.disabled = true; btn.textContent = 'Redirecting to Google…'; }
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.href,
      queryParams: { prompt: 'select_account' },
    }
  });
  if (error) {
    setAuthError(error.message);
    if (btn) { btn.disabled = false; btn.textContent = 'Continue with Google'; }
  }
}

async function signOut() {
  var confirmed = await showConfirm('Sign Out', 'You will need to sign in again to access your vault.', 'Sign Out', '👋'); if (!confirmed) return;
  bootDone = false;
  currentUser = null;
  userPlan = 'free';
  assets = [];
  nwHistory = [];
  await sb.auth.signOut();
  // Redirect to landing page — ensures clean state for next login
  window.location.href = SITE_URL;
}

function setUserUI(user) {
  const m = user.user_metadata || {};
  const name = m.given_name || m.full_name || user.email || 'there';
  const greetEl = document.getElementById('greetName');
  const sidebarEl = document.getElementById('sidebarName');
  const subEl = document.getElementById('greetSub');
  if (greetEl) greetEl.textContent = name;
  if (sidebarEl) sidebarEl.textContent = m.full_name || user.email || 'User';
  if (subEl) subEl.textContent = `Here's your financial snapshot for ${new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}.`;
  const av = document.getElementById('sidebarAvatar');
  const pic = m.avatar_url || m.picture;
  if (pic && av) {
    av.src = pic; av.style.display = 'block';
    const fb = document.getElementById('sidebarAvatarFallback');
    if (fb) fb.style.display = 'none';
  }
}

// ══ SUBSCRIPTION ═════════════════════════════════════════════════
async function loadSubscription() {
  try {
    // Check by email first
    const { data: byEmail } = await sb.from('subscriptions')
      .select('plan, status').eq('email', currentUser.email).maybeSingle();

    if (byEmail?.plan === 'pro') {
      userPlan = 'pro';
      console.log('[Sub] Pro confirmed by email:', currentUser.email);
      return;
    }
    if (byEmail?.plan === 'growth') {
      userPlan = 'growth';
      console.log('[Sub] Growth confirmed by email:', currentUser.email);
      return;
    }

    // Fallback: check by user_id
    const { data: byId } = await sb.from('subscriptions')
      .select('plan, status').eq('user_id', currentUser.id).maybeSingle();

    if (byId?.plan === 'pro') {
      userPlan = 'pro';
      console.log('[Sub] Pro confirmed by user_id');
      sb.from('subscriptions').update({ email: currentUser.email })
        .eq('user_id', currentUser.id).then(function(){});
      return;
    }
    if (byId?.plan === 'growth') {
      userPlan = 'growth';
      console.log('[Sub] Growth confirmed by user_id');
      sb.from('subscriptions').update({ email: currentUser.email })
        .eq('user_id', currentUser.id).then(function(){});
      return;
    }

    userPlan = 'free';
  } catch(e) {
    console.warn('[Subscription] Load error:', e.message);
    userPlan = 'free';
  }
}

function updatePlanUI() {
  var planEl = document.getElementById('sidebarPlan');
  var banner = document.getElementById('proBanner');
  if (planEl) {
    if (isPro()) planEl.textContent = 'Pro Plan ⬡';
    else if (isGrowth()) planEl.textContent = 'Growth Plan ⬡';
    else planEl.textContent = 'Free Plan';
  }
  // Show upgrade banner for free users only
  if (banner) banner.style.display = (userPlan === 'free') ? 'flex' : 'none';

  // Score KPI overlay — visible to free, hidden for growth+
  var scoreLockOverlay = document.getElementById('scoreLockOverlay');
  if (scoreLockOverlay) scoreLockOverlay.style.display = isGrowth() ? 'none' : 'flex';

  // Lock icons — hide based on actual tier, not blanket
  document.querySelectorAll('.pro-lock').forEach(function(el) {
    var tier = el.getAttribute('data-tier') || 'growth';
    if (tier === 'growth') el.style.display = isGrowth() ? 'none' : 'inline';
    else el.style.display = isPro() ? 'none' : 'inline';
  });

  // Gated pages
  Object.keys(PRO_PAGE_IDS).forEach(function(n) {
    var activePg = document.getElementById('page-' + n);
    if (!activePg || !activePg.classList.contains('active')) return;
    var ids   = PRO_PAGE_IDS[n];
    var lockEl = document.getElementById(ids.lock);
    var contEl = document.getElementById(ids.content);
    var neededTier = ids.tier || 'pro';
    var unlocked = (neededTier === 'growth') ? isGrowth() : isPro();
    if (lockEl) lockEl.style.display = unlocked ? 'none'  : 'block';
    if (contEl) contEl.style.display = unlocked ? 'block' : 'none';
  });

  // Update score KPI card
  if (isGrowth()) {
    var s = Calculators.netWorthScore(assets);
    var scoreEl = document.getElementById('kpiScore');
    var lblEl   = document.getElementById('kpiScoreLabel');
    if (scoreEl) { scoreEl.textContent = s.score + '/100'; scoreEl.style.color = s.color; }
    if (lblEl)   lblEl.textContent = s.label;
  }
}

// ══ DATA ═════════════════════════════════════════════════════════
async function loadAssets() {
  setSyncState('syncing', 'Loading…');
  const { data, error } = await sb.from('assets').select('*').order('created_at', { ascending: true });
  if (error) { setSyncState('error', 'Error'); UI.toast('Load error: ' + error.message, 'error'); return; }
  assets = data.map(r => ({
    id: r.id, name: r.name, cat: r.cat, value: parseFloat(r.value) || 0,
    notes: r.notes || '', principal: r.principal ? parseFloat(r.principal) : null,
    rate: r.rate ? parseFloat(r.rate) : null, years: r.years ? parseFloat(r.years) : null,
    fv: parseFloat(r.fv) || 0, interest: parseFloat(r.interest) || 0,
    depreciationType: r.depreciation_type || null, depreciationRate: r.depreciation_rate || null,
    usefulLife: r.useful_life || null, salvageValue: r.salvage_value || null,
    originalCost: r.original_cost || null, depreciationStart: r.depreciation_start || null,
  }));
  setSyncState('synced', 'Synced');
}

async function loadHistory() {
  const limit = isGrowth() ? 500 : 30;
  const { data } = await sb.from('nw_history').select('*')
    .order('created_at', { ascending: true }).limit(limit);
  if (data) nwHistory = data.map(r => ({ id: r.id, nw: parseFloat(r.nw) || 0, ts: r.label }));
}

async function dbInsert(a) {
  const { data, error } = await sb.from('assets').insert({
    user_id: currentUser.id, name: a.name, cat: a.cat, value: a.value,
    notes: a.notes || null, principal: a.principal || null, rate: a.rate || null,
    years: a.years || null, fv: a.fv || 0, interest: a.interest || 0,
    depreciation_type: a.depreciationType || null, depreciation_rate: a.depreciationRate || null,
    useful_life: a.usefulLife || null, salvage_value: a.salvageValue || null,
    original_cost: a.originalCost || null, depreciation_start: a.depreciationStart || null,
  }).select().single();
  if (error) throw error;
  return data.id;
}

async function dbUpdate(a) {
  const { error } = await sb.from('assets').update({
    name: a.name, cat: a.cat, value: a.value, notes: a.notes || null,
    principal: a.principal || null, rate: a.rate || null, years: a.years || null,
    fv: a.fv || 0, interest: a.interest || 0,
    depreciation_type: a.depreciationType || null,
    depreciation_rate: a.depreciationRate || null,
    useful_life: a.usefulLife || null,
    salvage_value: a.salvageValue || null,
    original_cost: a.originalCost || null,
    depreciation_start: a.depreciationStart || null,
  }).eq('id', a.id).eq('user_id', currentUser.id);
  if (error) throw error;
}

async function dbDelete(id) {
  const { error } = await sb.from('assets').delete().eq('id', id).eq('user_id', currentUser.id);
  if (error) throw error;
}

async function snapHistory() {
  let ta = 0, tl = 0;
  assets.forEach(a => { if (a.cat === 'liability') tl += a.value; else ta += a.value; });
  const nw = ta - tl;
  const label = new Date().toLocaleDateString('en-NG', { month: 'short', day: 'numeric' });
  const { data } = await sb.from('nw_history')
    .insert({ user_id: currentUser.id, nw, label }).select().single();
  if (data) {
    nwHistory.push({ id: data.id, nw, ts: label });
    if (!isGrowth() && nwHistory.length > 30) nwHistory = nwHistory.slice(-30);
  }
}

// ══ FORM HELPERS ═════════════════════════════════════════════════
function handleCatChange() {
  var cat = document.getElementById('fCategory').value;
  var investWrap  = document.getElementById('investToggleWrap');
  var deprecWrap  = document.getElementById('deprecToggleWrap');
  if (investWrap) investWrap.style.display = cat === 'investment' ? 'block' : 'none';
  if (deprecWrap) deprecWrap.style.display = (cat === 'physical' && isPro()) ? 'block' : 'none';
  // Collapse panels when category changes away
  if (cat !== 'investment') {
    var p = document.getElementById('investPanel'); if (p) p.classList.remove('open');
    var c = document.getElementById('investToggle'); if (c) c.classList.remove('active');
    var prev = document.getElementById('fPreview'); if (prev) prev.style.display = 'none';
  }
  if (cat !== 'physical') {
    var dp = document.getElementById('deprecPanel'); if (dp) dp.classList.remove('open');
    var dc = document.getElementById('deprecToggle'); if (dc) dc.classList.remove('active');
  }
}

function calcPreview() {
  const p = parseFloat(document.getElementById('fPrincipal').value);
  const r = parseFloat(document.getElementById('fRate').value) / 100;
  const t = parseFloat(document.getElementById('fYears').value);
  const prev = document.getElementById('fPreview');
  if (!prev) return;
  if (!p || !r || !t || p <= 0) { prev.style.display = 'none'; return; }
  const fv = p * Math.pow(1 + r, t);
  prev.style.display = 'flex';
  document.getElementById('prevFV').textContent   = fmt(fv);
  document.getElementById('prevInt').textContent  = fmt(fv - p);
  document.getElementById('prevMult').textContent = (fv / p).toFixed(2) + 'x';
}

// ══ ADD ASSET ════════════════════════════════════════════════════
async function addAsset() {
  if (!currentUser) { UI.toast('Sign in first', 'error'); return; }
  if (!isGrowth() && assets.length >= FREE_LIMIT) { openModal('upgradeModal'); return; }

  const name  = document.getElementById('fName').value.trim();
  const cat   = document.getElementById('fCategory').value;
  const value = parseFloat(document.getElementById('fValue').value);
  const notes = document.getElementById('fNotes').value.trim();
  const errEl = document.getElementById('formError');
  if (errEl) errEl.textContent = '';

  if (!name)                { if (errEl) errEl.textContent = '⚠ Please enter a name.'; return; }
  if (isNaN(value)||value<0){ if (errEl) errEl.textContent = '⚠ Enter a valid value.'; return; }

  // Convert display currency → native (storage) currency
  var storedValue = Math.round(toStored(value));

  let principal = null, rate = null, years = null, fv = 0, interest = 0;
  if (cat === 'investment') {
    principal = parseFloat(document.getElementById('fPrincipal').value) || null;
    rate      = parseFloat(document.getElementById('fRate').value)      || null;
    years     = parseFloat(document.getElementById('fYears').value)     || null;
    if (principal && rate && years) {
      var storedPrincipal = Math.round(toStored(principal));
      const p = Calculators.compoundInterest(storedPrincipal, rate, years);
      fv = p.fv; interest = p.interest;
    }
  }

  let depreciationType = null, depreciationRate = null, usefulLife = null;
  let salvageValue = null, originalCost = null, depreciationStart = null;
  if (cat === 'physical' && isPro()) {
    depreciationType = document.getElementById('fDeprecType').value || null;
    if (depreciationType) {
      usefulLife       = parseFloat(document.getElementById('fUsefulLife').value) || 5;
      salvageValue     = parseFloat(document.getElementById('fSalvage').value)    || 0;
      depreciationRate = parseFloat(document.getElementById('fDeprecRate').value) || 20;
      originalCost     = value;
      depreciationStart = new Date().toISOString();
    }
  }

  const btn = document.getElementById('addBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  setSyncState('syncing', 'Saving…');

  try {
    var savedPrincipal = (principal && rate && years) ? storedPrincipal : null;
    const asset = { name, cat, value: storedValue, notes, principal: savedPrincipal, rate, years, fv, interest,
      depreciationType, depreciationRate, usefulLife, salvageValue: Math.round(toStored(salvageValue || 0)), originalCost: storedValue, depreciationStart };
    const newId = await dbInsert(asset);
    asset.id = newId;
    assets.push(asset);
    addActivity(`Added "${name}"`, cat);
    logAudit('created', 'asset', name, 'Value: ' + fmt(value));
    await snapHistory();
    renderAll();
    setSyncState('synced', 'Saved ✓');
    UI.toast(`"${name}" added`, 'success');
    ['fName','fValue','fNotes','fPrincipal','fRate','fYears','fUsefulLife','fSalvage','fDeprecRate'].forEach(function(id) { var el = document.getElementById(id); if(el) el.value = ''; });
    // Collapse and reset panels
    document.getElementById('fCategory').value = 'cash';
    handleCatChange();
    ['investPanel','deprecPanel'].forEach(function(id) { var p = document.getElementById(id); if(p) p.classList.remove('open'); });
    ['investToggle','deprecToggle'].forEach(function(id) { var c = document.getElementById(id); if(c) c.classList.remove('active'); });
    document.getElementById('fPreview').style.display = 'none';
  } catch(e) {
    setSyncState('error', 'Error');
    UI.toast('Error: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '+ Add to Vault'; }
  }
}

// ══ DELETE ═══════════════════════════════════════════════════════
async function deleteAsset(id) {
  const a = assets.find(x => x.id === id);
  if (!a) return;
  var confirmed = await showConfirm('Delete Asset', '"' + a.name + '" (' + fmt(a.value) + ')\nThis cannot be undone.', 'Delete', '🗑'); if (!confirmed) return;
  setSyncState('syncing', 'Deleting…');
  try {
    await dbDelete(id);
    assets = assets.filter(x => x.id !== id);
    addActivity(`Removed "${a.name}"`, a.cat, 'red');
    logAudit('deleted', 'asset', a.name, 'Was: ' + fmt(a.value));
    await snapHistory();
    renderAll();
    setSyncState('synced', 'Synced');
    UI.toast(`"${a.name}" removed`, 'error');
  } catch(e) {
    setSyncState('error', 'Error');
    UI.toast('Error: ' + e.message, 'error');
  }
}

// ══ EDIT ═════════════════════════════════════════════════════════
function openEditModal(id) {
  var a = assets.find(function(x) { return x.id === id; });
  if (!a) return;
  editId = id;
  document.getElementById('eName').value  = a.name;
  document.getElementById('eCat').value   = a.cat;
  document.getElementById('eValue').value = Math.round(toDisplay(a.value));
  document.getElementById('eNotes').value = a.notes || '';
  document.getElementById('ePrincipal').value = a.principal ? Math.round(toDisplay(a.principal)) : '';
  document.getElementById('eRate').value     = a.rate  || '';
  document.getElementById('eYears').value    = a.years || '';
  // Depreciation fields
  var depType = document.getElementById('eDeprecType');
  var depLife = document.getElementById('eUsefulLife');
  var depSalv = document.getElementById('eSalvage');
  var depRate = document.getElementById('eDeprecRate');
  if (depType) depType.value = a.depreciationType || '';
  if (depLife) depLife.value = a.usefulLife || '';
  if (depSalv) depSalv.value = a.salvageValue ? Math.round(toDisplay(a.salvageValue)) : '';
  if (depRate) depRate.value = a.depreciationRate || '';
  // Collapse depreciation panel unless it has a type set
  var depPanel = document.getElementById('editDeprecPanel');
  var depChip  = document.getElementById('editDeprecToggle');
  if (depPanel && depChip) {
    if (a.depreciationType) {
      depPanel.classList.add('open');
      depChip.classList.add('active');
    } else {
      depPanel.classList.remove('open');
      depChip.classList.remove('active');
    }
  }
  handleEditCat();
  calcEditProj();
  openModal('editModal');
}

function handleEditCat() {
  const cat = document.getElementById('eCat').value;
  const investWrap = document.getElementById('eInvestWrap');
  const deprecWrap = document.getElementById('eDeprecWrap');
  if (investWrap) investWrap.style.display = cat === 'investment' ? 'block' : 'none';
  if (deprecWrap) deprecWrap.style.display = (cat === 'physical' && isPro()) ? 'block' : 'none';
}

function calcEditProj() {
  const p = parseFloat(document.getElementById('ePrincipal').value);
  const r = parseFloat(document.getElementById('eRate').value) / 100;
  const t = parseFloat(document.getElementById('eYears').value);
  const prev = document.getElementById('eProj');
  if (!prev) return;
  if (!p || !r || !t) { prev.style.display = 'none'; return; }
  const fv = p * Math.pow(1 + r, t);
  prev.style.display = 'block';
  prev.innerHTML = `FV: <span style="color:var(--gold);">${fmt(fv)}</span> &nbsp;·&nbsp; Interest: <span style="color:var(--green);">${fmt(fv - p)}</span>`;
}

async function saveEdit() {
  const a = assets.find(x => x.id === editId);
  if (!a) return;
  const name  = document.getElementById('eName').value.trim();
  const cat   = document.getElementById('eCat').value;
  const value = parseFloat(document.getElementById('eValue').value);
  if (!name || isNaN(value) || value < 0) { UI.toast('Fill required fields', 'error'); return; }

  // Convert display currency → native (storage) currency
  var storedValue = Math.round(toStored(value));

  const notes     = document.getElementById('eNotes').value.trim();
  var rawPrincipal = parseFloat(document.getElementById('ePrincipal').value) || null;
  const rate      = parseFloat(document.getElementById('eRate').value)      || null;
  const years     = parseFloat(document.getElementById('eYears').value)     || null;
  var principal = null;
  let fv = 0, interest = 0;
  if (cat === 'investment' && rawPrincipal && rate && years) {
    principal = Math.round(toStored(rawPrincipal));
    const p = Calculators.compoundInterest(principal, rate, years);
    fv = p.fv; interest = p.interest;
  }

  // Read depreciation fields
  var depreciationType = null, depreciationRate = null, usefulLife = null;
  var salvageValue = null, originalCost = null, depreciationStart = null;
  if (cat === 'physical' && isPro()) {
    depreciationType = document.getElementById('eDeprecType')?.value || null;
    if (depreciationType) {
      usefulLife       = parseFloat(document.getElementById('eUsefulLife')?.value) || 5;
      salvageValue     = Math.round(toStored(parseFloat(document.getElementById('eSalvage')?.value) || 0));
      depreciationRate = parseFloat(document.getElementById('eDeprecRate')?.value) || 20;
      originalCost     = a.originalCost || storedValue; // preserve original cost if already set
      if (!a.depreciationStart) depreciationStart = new Date().toISOString();
      else depreciationStart = a.depreciationStart;
    }
  }

  const btn = document.getElementById('saveEditBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  setSyncState('syncing', 'Saving…');
  try {
    Object.assign(a, {
      name, cat, value: storedValue, notes, principal, rate, years, fv, interest,
      depreciationType, depreciationRate, usefulLife, salvageValue,
      originalCost, depreciationStart
    });
    await dbUpdate(a);
    addActivity(`Updated "${name}"`, cat, 'blue');
    logAudit('updated', 'asset', name, 'New value: ' + fmt(storedValue));
    await snapHistory();
    renderAll();
    closeModal('editModal');
    setSyncState('synced', 'Saved ✓');
    UI.toast(`"${name}" updated`, 'success');
  } catch(e) {
    setSyncState('error', 'Error');
    UI.toast('Error: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }
  }
}

// ══ CLEAR ALL ════════════════════════════════════════════════════
async function confirmClear() {
  if (!assets.length) { UI.toast('Vault is empty', 'info'); return; }
  var confirmed = await showConfirm('Clear All Entries', 'Delete all ' + assets.length + ' entries? This cannot be undone.', 'Clear All', '🗑'); if (!confirmed) return;
  setSyncState('syncing', 'Clearing…');
  try {
    await sb.from('assets').delete().eq('user_id', currentUser.id);
    await sb.from('nw_history').delete().eq('user_id', currentUser.id);
    assets = []; nwHistory = [];
    renderAll();
    setSyncState('synced', 'Synced');
    UI.toast('Vault cleared', 'info');
  } catch(e) {
    setSyncState('error', 'Error');
    UI.toast('Error: ' + e.message, 'error');
  }
}

// ══ CSV EXPORT ═══════════════════════════════════════════════════
function exportCSV() {
  if (!assets.length) { UI.toast('No data to export', 'info'); return; }
  var h = ['Name','Category','Notes','Value','Principal','Rate (%)','Years','FV','Interest'];
  var rows = assets.map(function(a) {
    var catObj = CAT[a.cat] || { l: a.cat || 'Unknown' };
    return [
      '"' + a.name + '"', catObj.l, '"' + (a.notes||'') + '"',
      a.value, a.principal||'', a.rate||'', a.years||'',
      a.fv ? a.fv.toFixed(2) : '', a.interest ? a.interest.toFixed(2) : '',
    ].join(',');
  });
  var url = URL.createObjectURL(new Blob([[h.join(','), ...rows].join('\n')], { type: 'text/csv' }));
  var lnk = document.createElement('a');
  lnk.href = url; lnk.download = 'keno-vault-' + new Date().toISOString().slice(0,10) + '.csv';
  lnk.click(); URL.revokeObjectURL(url);
  UI.toast('CSV exported', 'success');
}

// ══ ACTIVITY FEED ════════════════════════════════════════════════
function addActivity(msg, cat, color = 'green') {
  activity.unshift({
    msg, cat, color,
    time: new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })
  });
  if (activity.length > 20) activity = activity.slice(0, 20);
}

function renderActivity() {
  const feed = document.getElementById('activityFeed');
  if (!feed) return;
  if (!activity.length) {
    feed.innerHTML = '<div class="empty"><div class="empty-icon" style="font-size:24px;"><i class="fas fa-clipboard-list"></i></div>No activity yet</div>';
    return;
  }
  feed.innerHTML = activity.map(a => `
    <div style="display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid var(--border);">
      <div style="width:7px;height:7px;border-radius:50%;flex-shrink:0;margin-top:5px;background:var(--${a.color||'green'});"></div>
      <div>
        <div style="font-size:12px;font-weight:500;">${a.msg}</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">${a.time}</div>
      </div>
    </div>`).join('');
}

async function showActivityTab(tab) {
  document.getElementById('actTabFeed').classList.toggle('active', tab === 'feed');
  document.getElementById('actTabAudit').classList.toggle('active', tab === 'audit');
  if (tab === 'feed') { renderActivity(); return; }
  // Load audit log from Supabase
  var feed = document.getElementById('activityFeed');
  if (!feed) return;
  if (!isGrowth()) { feed.innerHTML = '<div class="empty"><div class="empty-icon" style="font-size:24px;">🔒</div>Audit log is a Growth feature</div>'; return; }
  feed.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-dim);"><div class="spinner" style="margin:0 auto 8px;width:20px;height:20px;border-width:2px;"></div>Loading audit log…</div>';
  try {
    var { data } = await sb.from('audit_log').select('*').order('created_at', { ascending: false }).limit(50);
    if (!data || !data.length) { feed.innerHTML = '<div class="empty"><div class="empty-icon" style="font-size:24px;"><i class="fas fa-clipboard-list"></i></div>No audit entries yet</div>'; return; }
    var icons = { created:'➕', updated:'✎', deleted:'🗑', login:'🔑' };
    feed.innerHTML = data.map(function(e) {
      var dt = new Date(e.created_at);
      var ts = dt.toLocaleDateString('en',{month:'short',day:'numeric'}) + ' ' + dt.toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'});
      return '<div style="display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid var(--border);">' +
        '<div style="font-size:14px;flex-shrink:0;">' + (icons[e.action] || '📌') + '</div>' +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:12px;font-weight:500;">' + (e.entity_name || e.action) + '</div>' +
          '<div style="font-size:11px;color:var(--text-dim);">' + e.action + ' · ' + (e.entity_type || '') + (e.details ? ' · ' + e.details : '') + '</div>' +
          '<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">' + ts + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  } catch(e) { feed.innerHTML = '<div class="empty" style="color:var(--red);">Error: ' + e.message + '</div>'; }
}

// ══ KPIs ═════════════════════════════════════════════════════════
function renderKPIs() {
  let ta = 0, tl = 0, tp = 0, ti = 0, tint = 0;
  assets.forEach(a => {
    if (a.cat === 'liability') tl += a.value;
    else {
      ta += a.value;
      if (a.cat === 'cash' || a.cat === 'physical') tp += a.value;
      if (a.cat === 'investment') { ti += a.value; tint += a.interest || 0; }
    }
  });
  const nw = ta - tl;
  const nwEl = document.getElementById('kpiNetWorth');
  if (nwEl) { nwEl.innerHTML = '<span class="sensitive">' + fmtSigned(nw) + '</span>'; nwEl.style.color = nw < 0 ? 'var(--red)' : 'var(--accent)'; }
  const subEl = document.getElementById('kpiNetSub');
  if (subEl) { subEl.innerHTML = 'Assets <span class="sensitive">' + fmt(ta) + '</span> — Liabilities <span class="sensitive">' + fmt(tl) + '</span>'; subEl.className = 'kpi-change ' + (nw >= 0 ? 'up' : 'down'); }
  const physEl = document.getElementById('kpiPhysical'); if (physEl) physEl.innerHTML = '<span class="sensitive">' + fmt(tp) + '</span>';
  const invEl  = document.getElementById('kpiInvest');   if (invEl)  invEl.innerHTML  = '<span class="sensitive">' + fmt(ti) + '</span>';
  const intEl  = document.getElementById('kpiInterest'); if (intEl)  intEl.innerHTML  = '<span class="sensitive">' + fmt(tint) + '</span>';

  if (isGrowth()) {
    var s = Calculators.netWorthScore(assets);
    var scoreEl = document.getElementById('kpiScore'); if (scoreEl) { scoreEl.textContent = s.score + '/100'; scoreEl.style.color = s.color; }
    var lblEl   = document.getElementById('kpiScoreLabel'); if (lblEl) lblEl.textContent = s.label;
    var lockEl  = document.getElementById('scoreLockOverlay'); if (lockEl) lockEl.style.display = 'none';
  }

  var lw = document.getElementById('limitWarning');
  if (lw) lw.style.display = (!isGrowth() && assets.length >= FREE_LIMIT) ? 'block' : 'none';
  const ec = document.getElementById('entryCount');
  if (ec) ec.textContent = `(${assets.length} entr${assets.length === 1 ? 'y' : 'ies'})`;
}

// ══ TABLE ════════════════════════════════════════════════════════
function renderTable() {
  const tbody = document.getElementById('tableBody');
  const tfoot = document.getElementById('tableFoot');
  if (!tbody) return;
  if (!assets.length) {
    tbody.innerHTML = '<tr><td colspan="8"><div class="empty"><div class="empty-icon"><i class="fas fa-coins"></i></div>No entries yet. Add your first asset above.</div></td></tr>';
    if (tfoot) tfoot.style.display = 'none';
    return;
  }
  const BADGE = getBadge();
  const order = { cash: 0, physical: 1, investment: 2, liability: 3 };
  const sorted = [...assets].sort((a, b) => order[a.cat] - order[b.cat]);
  tbody.innerHTML = sorted.map(a => {
    const isLiab = a.cat === 'liability';
    const depStr = a.depreciationType ? `<span style="font-size:10px;color:var(--text-muted);">[${a.depreciationType}]</span>` : '';
    const proj   = a.fv > 0 ? `<span class="mono sensitive" style="color:var(--gold);">${fmt(a.fv)}</span>` : '<span style="color:var(--muted);">—</span>';
    const intc   = a.interest > 0 ? `<span class="gain-pill sensitive">+${fmt(a.interest)}</span>` : '<span style="color:var(--muted);">—</span>';
    const ratec  = a.rate && a.years ? `<span class="mono" style="color:var(--text-dim);font-size:11px;">${a.rate}%/${a.years}yr</span>` : '<span style="color:var(--muted);">—</span>';
    return `<tr class="animate-in">
      <td style="font-weight:500;">${a.name} ${depStr}</td>
      <td><span class="badge" style="${(BADGE[a.cat] || '')}">${(CAT[a.cat] || {i:'📦',l:a.cat}).i} ${(CAT[a.cat] || {l:a.cat}).l}</span></td>
      <td style="color:var(--text-dim);font-size:12px;">${a.notes || '—'}</td>
      <td><span class="mono sensitive" style="color:${isLiab ? 'var(--red)' : 'var(--text)'};">${isLiab ? '-' : ''}${fmt(a.value)}</span></td>
      <td>${proj}</td><td>${intc}</td><td>${ratec}</td>
      <td><div style="display:flex;gap:4px;justify-content:center;">
        <button class="icon-btn edit" onclick="openEditModal('${a.id}')">✎</button>
        <button class="icon-btn del"  onclick="deleteAsset('${a.id}')">✕</button>
      </div></td></tr>`;
  }).join('');

  let tc = 0, tfv = 0, ti = 0;
  assets.forEach(a => { tc += a.cat !== 'liability' ? a.value : -a.value; tfv += a.fv || 0; ti += a.interest || 0; });
  if (tfoot) {
    tfoot.style.display = '';
    const fv = document.getElementById('footVal'); if (fv) fv.textContent = fmtSigned(tc);
    const ff = document.getElementById('footFV');  if (ff) ff.textContent = tfv > 0 ? fmt(tfv) : '—';
    const fi = document.getElementById('footInt'); if (fi) fi.textContent = ti > 0 ? '+' + fmt(ti) : '—';
  }
}

// ══ CHARTS ═══════════════════════════════════════════════════════
Chart.defaults.font.family = "'DM Sans', sans-serif";

function getCC() {
  var l = getTheme() === 'light';
  return {
    grid:  l ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.04)',
    text:  l ? '#525252' : '#777',
    muted: l ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.02)',
    tt: {
      backgroundColor: l ? '#ffffff' : '#1a1a1a',
      borderColor:     l ? '#e5e5e2' : '#2a2a2a',
      borderWidth: 1,
      titleColor:  l ? '#171717' : '#f0f0f0',
      bodyColor:   l ? '#404040' : '#a0a0a0',
      padding: 12,
      cornerRadius: 6,
      titleFont: { weight: '600' },
      bodyFont:  { weight: '500' },
    },
  };
}

function renderDonut() {
  const ctx = document.getElementById('donutChart');
  const emp = document.getElementById('donutEmpty');
  if (!ctx) return;
  const t = { cash: 0, physical: 0, investment: 0, liability: 0 };
  assets.forEach(a => t[a.cat] += a.value);
  const vals = [t.cash, t.physical, t.investment, t.liability];
  const total = vals.reduce((s, v) => s + v, 0);
  if (!total) { ctx.style.display = 'none'; if (emp) emp.style.display = ''; if (donutChart) { donutChart.destroy(); donutChart = null; } return; }
  ctx.style.display = ''; if (emp) emp.style.display = 'none';
  const isL = getTheme() === 'light';
  const bgs = isL ? ['rgba(79,142,247,0.85)', 'rgba(22,163,74,0.8)', 'rgba(217,119,6,0.8)', 'rgba(220,38,38,0.8)'] : ['rgba(79,142,247,0.85)', 'rgba(52,211,153,0.85)', 'rgba(244,197,83,0.85)', 'rgba(248,113,113,0.85)'];
  const bds = isL ? ['#4f8ef7', '#16a34a', '#d97706', '#dc2626'] : ['#4f8ef7', '#34d399', '#f4c553', '#f87171'];
  const cc = getCC(); Chart.defaults.color = cc.text;
  var data = { labels: ['Cash', 'Physical', 'Investments', 'Liabilities'], datasets: [{ data: vals, backgroundColor: bgs, borderWidth: 0, hoverOffset: 4 }] };
  if (donutChart) { donutChart.data = data; donutChart.update(); return; }
  donutChart = new Chart(ctx, { type: 'doughnut', data, options: { cutout: '45%', responsive: true, maintainAspectRatio: false, borderRadius: 5, spacing: 3, plugins: { legend: { position: 'bottom', labels: { padding: 14, usePointStyle: true, pointStyle: 'rectRounded', pointStyleWidth: 10, font: { size: 11 } } }, tooltip: { ...cc.tt, callbacks: { label: function(c) { return ' ' + fmt(c.parsed) + ' (' + ((c.parsed / total) * 100).toFixed(1) + '%)'; } } } } } });
}

function renderHistory() {
  const ctx = document.getElementById('historyChart');
  const emp = document.getElementById('historyEmpty');
  if (!ctx) return;
  if (nwHistory.length < 2) { ctx.style.display = 'none'; if (emp) emp.style.display = ''; if (historyChart) { historyChart.destroy(); historyChart = null; } return; }
  ctx.style.display = ''; if (emp) emp.style.display = 'none';
  const cc = getCC();
  var data = { labels: nwHistory.map(function(h) { return h.ts; }), datasets: [{ label: 'Net Worth', data: nwHistory.map(function(h) { return h.nw; }), borderColor: '#f97316', backgroundColor: function(ctx) { var g = ctx.chart.ctx.createLinearGradient(0,0,0,ctx.chart.height); g.addColorStop(0,'rgba(249,115,22,0.12)'); g.addColorStop(1,'rgba(249,115,22,0.0)'); return g; }, borderWidth: 1.5, pointBackgroundColor: '#f97316', pointRadius: 0, pointHoverRadius: 4, pointHoverBackgroundColor: '#f97316', fill: true, tension: 0.4 }] };
  if (historyChart) { historyChart.data = data; historyChart.update(); return; }
  historyChart = new Chart(ctx, { type: 'line', data, options: { responsive: true, maintainAspectRatio: false, interaction: { intersect: false, mode: 'index' }, plugins: { legend: { display: false }, tooltip: { ...cc.tt, callbacks: { label: function(c) { return ' ' + fmtSigned(c.parsed.y); } } } }, scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 6, font: { size: 10 }, color: cc.text } }, y: { grid: { color: cc.grid }, border: { display: false }, ticks: { callback: function(v) { return fmtShort(v); }, font: { size: 10 }, color: cc.text } } } } });
}

function renderBar() {
  const ctx = document.getElementById('barChart');
  const emp = document.getElementById('barEmpty');
  if (!ctx) return;
  const inv = assets.filter(a => a.cat === 'investment' && a.fv > 0);
  if (!inv.length) { ctx.style.display = 'none'; if (emp) emp.style.display = ''; if (barChart) { barChart.destroy(); barChart = null; } return; }
  ctx.style.display = ''; if (emp) emp.style.display = 'none';
  const cc = getCC();
  const data = { labels: inv.map(a => a.name.length > 14 ? a.name.slice(0, 13) + '…' : a.name), datasets: [{ label: 'Current Value', data: inv.map(a => a.value), backgroundColor: 'rgba(249,115,22,0.7)', borderColor: '#f97316', borderWidth: 2, borderRadius: 6 }, { label: 'Projected FV', data: inv.map(a => a.fv), backgroundColor: 'rgba(244,197,83,0.7)', borderColor: '#f4c553', borderWidth: 2, borderRadius: 6 }] };
  if (barChart) { barChart.data = data; barChart.update(); return; }
  barChart = new Chart(ctx, { type: 'bar', data, options: { responsive: true, maintainAspectRatio: false, borderRadius: 4, borderSkipped: false, plugins: { legend: { position: 'bottom', labels: { padding: 14, usePointStyle: true, pointStyle: 'rectRounded', pointStyleWidth: 10, font: { size: 11 } } }, tooltip: { ...cc.tt, callbacks: { label: function(c) { return ' ' + c.dataset.label + ': ' + fmt(c.parsed.y); } } } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 10 }, color: cc.text } }, y: { grid: { color: cc.grid }, border: { display: false }, ticks: { callback: function(v) { return fmtShort(v); }, font: { size: 10 }, color: cc.text } } } } });
}

function rerenderCharts() {
  [donutChart, barChart, historyChart, fireChart, debtChart, investChart2].forEach(function(c) { if (c) { c.destroy(); } });
  donutChart = barChart = historyChart = fireChart = debtChart = investChart2 = null;
  renderAll();
  // Re-run active gated page renders
  if (document.getElementById('page-investments')?.classList.contains('active')) renderInvestmentPage();
  if (document.getElementById('page-debt')?.classList.contains('active')) runDebt();
  if (document.getElementById('page-fire')?.classList.contains('active')) runFire();
}

// ══ INVESTMENTS PAGE ══════════════════════════════════════════════
var _investActivePill = 'all'; // 'all' or asset index

function renderInvestmentPage() {
  const inv = assets.filter(a => a.cat === 'investment');
  const ctx = document.getElementById('investChart2');
  const emp = document.getElementById('investEmpty');
  const isMobile = window.innerWidth < 768;
  if (!ctx) return;

  if (!inv.length) {
    ctx.style.display = 'none';
    if (emp) emp.style.display = '';
    if (investChart2) { investChart2.destroy(); investChart2 = null; }
    document.getElementById('investPills').innerHTML = '';
    document.getElementById('investTableBody').innerHTML = '<tr><td colspan="8"><div class="empty">No investments logged</div></td></tr>';
    document.getElementById('investCards').innerHTML = '<div class="empty">No investments logged</div>';
    return;
  }

  ctx.style.display = ''; if (emp) emp.style.display = 'none';

  // ── Build chart data ──────────────────────────────────
  var chartLabels, chartValues, chartFV, chartInt;
  var heading = document.getElementById('investChartHeading');

  var totalVal = inv.reduce((s, a) => s + a.value, 0);
  var totalFV  = inv.reduce((s, a) => s + (a.fv || 0), 0);
  var totalInt = inv.reduce((s, a) => s + (a.interest || 0), 0);

  if (isMobile && _investActivePill === 'all') {
    // Aggregated view
    chartLabels = ['Total'];
    chartValues = [totalVal];
    chartFV     = [totalFV];
    chartInt    = [totalInt];
    if (heading) heading.textContent = 'Aggregated: Current vs FV vs Interest';
  } else if (isMobile && _investActivePill !== 'all') {
    // Single asset view
    var idx = parseInt(_investActivePill);
    var a = inv[idx];
    var name = a.name.length > 14 ? a.name.slice(0, 13) + '…' : a.name;
    chartLabels = [name];
    chartValues = [a.value];
    chartFV     = [a.fv || 0];
    chartInt    = [a.interest || 0];
    if (heading) heading.textContent = a.name;
  } else {
    // Desktop — all assets side by side
    chartLabels = inv.map(a => a.name.length > 10 ? a.name.slice(0, 9) + '…' : a.name);
    chartValues = inv.map(a => a.value);
    chartFV     = inv.map(a => a.fv || 0);
    chartInt    = inv.map(a => a.interest || 0);
    if (heading) heading.textContent = 'Current vs Future Value vs Interest';
  }

  const cc = getCC();
  const data = {
    labels: chartLabels,
    datasets: [
      { label: 'Current', data: chartValues, backgroundColor: 'rgba(249,115,22,0.65)', borderColor: '#f97316', borderWidth: 2, borderRadius: 8, maxBarThickness: 48 },
      { label: 'FV', data: chartFV, backgroundColor: 'rgba(244,197,83,0.65)', borderColor: '#f4c553', borderWidth: 2, borderRadius: 8, maxBarThickness: 48 },
      { label: 'Interest', data: chartInt, backgroundColor: 'rgba(52,211,153,0.65)', borderColor: '#34d399', borderWidth: 2, borderRadius: 8, maxBarThickness: 48 }
    ]
  };
  if (investChart2) { investChart2.data = data; investChart2.update(); }
  else investChart2 = new Chart(ctx, { type: 'bar', data, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { padding: 12, usePointStyle: true, pointStyle: 'rectRounded', pointStyleWidth: 10, font: { size: 11 } } }, tooltip: { ...cc.tt, callbacks: { label: c => ' ' + c.dataset.label + ': ' + fmt(c.parsed.y) } } }, scales: { x: { grid: { color: cc.grid }, ticks: { font: { size: 10 } } }, y: { grid: { color: cc.grid }, ticks: { callback: v => fmtShort(v) } } } } });

  // ── Pill tabs (mobile) ────────────────────────────────
  var pillsEl = document.getElementById('investPills');
  if (pillsEl) {
    pillsEl.style.display = isMobile ? 'flex' : 'none';
    var pillsHTML = '<button class="invest-pill' + (_investActivePill === 'all' ? ' active' : '') + '" data-idx="all">All Assets</button>';
    inv.forEach(function(a, i) {
      var label = a.name.length > 10 ? a.name.slice(0, 9) + '…' : a.name;
      pillsHTML += '<button class="invest-pill' + (_investActivePill === '' + i ? ' active' : '') + '" data-idx="' + i + '">' + label + '</button>';
    });
    pillsEl.innerHTML = pillsHTML;
    // Wire click handlers
    pillsEl.querySelectorAll('.invest-pill').forEach(function(btn) {
      btn.onclick = function() {
        _investActivePill = btn.getAttribute('data-idx');
        renderInvestmentPage();
      };
    });
  }

  // ── Desktop Table ─────────────────────────────────────
  var tbody = document.getElementById('investTableBody');
  if (tbody) {
    tbody.innerHTML = inv.map(a => '<tr>' +
      '<td style="font-weight:500;">' + a.name + '</td>' +
      '<td class="mono sensitive">' + (a.principal ? fmt(a.principal) : '—') + '</td>' +
      '<td class="mono">' + (a.rate ? a.rate + '%' : '—') + '</td>' +
      '<td class="mono">' + (a.years ? a.years + 'yr' : '—') + '</td>' +
      '<td class="mono sensitive">' + fmt(a.value) + '</td>' +
      '<td class="mono sensitive" style="color:var(--gold);">' + (a.fv > 0 ? fmt(a.fv) : '—') + '</td>' +
      '<td>' + (a.interest > 0 ? '<span class="gain-pill">+' + fmt(a.interest) + '</span>' : '—') + '</td>' +
      '<td class="mono">' + (a.principal && a.fv ? (a.fv / a.principal).toFixed(2) + 'x' : '—') + '</td>' +
    '</tr>').join('');
  }

  // ── Mobile Cards ──────────────────────────────────────
  var cardsEl = document.getElementById('investCards');
  if (cardsEl) {
    cardsEl.innerHTML = inv.map(function(a) {
      return '<div class="invest-card">' +
        '<div class="invest-card-top">' +
          '<span class="invest-card-name">' + a.name + '</span>' +
          '<span class="invest-card-rate">' + (a.rate ? a.rate + '%' : '—') + '</span>' +
        '</div>' +
        '<div class="invest-card-grid">' +
          '<div class="invest-card-item"><span class="invest-card-label">Principal</span><span class="invest-card-val">' + (a.principal ? fmt(a.principal) : '—') + '</span></div>' +
          '<div class="invest-card-item"><span class="invest-card-label">Term</span><span class="invest-card-val mono">' + (a.years ? a.years + 'yr' : '—') + '</span></div>' +
          '<div class="invest-card-item"><span class="invest-card-label">Current Value</span><span class="invest-card-val">' + fmt(a.value) + '</span></div>' +
          '<div class="invest-card-item"><span class="invest-card-label">Projected FV</span><span class="invest-card-val" style="color:var(--gold);">' + (a.fv > 0 ? fmt(a.fv) : '—') + '</span></div>' +
        '</div>' +
        (a.interest > 0 ? '<div class="invest-card-gain"><span class="gain-pill">+' + fmt(a.interest) + ' interest</span></div>' : '') +
      '</div>';
    }).join('');
  }
}

// ══ PRO ENGINES ═══════════════════════════════════════════════════
var _fireSaveMul = 1;
var _fireExpMul  = 1;

function setFireSaveMul(mul, btn) {
  // Rescale slider so effective value stays constant
  var oldMul = _fireSaveMul;
  var slider = document.getElementById('fireSavings');
  var oldEffective = (parseInt(slider.value) || 0) * oldMul;
  _fireSaveMul = mul;
  slider.value = Math.round(oldEffective / mul);
  fillSliderTrack(slider);
  document.querySelectorAll('#fireSaveMulChips .toggle-chip').forEach(function(c) { c.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  runFire();
}
function setFireExpMul(mul, btn) {
  var oldMul = _fireExpMul;
  var slider = document.getElementById('fireExpenses');
  var oldEffective = (parseInt(slider.value) || 0) * oldMul;
  _fireExpMul = mul;
  slider.value = Math.round(oldEffective / mul);
  fillSliderTrack(slider);
  document.querySelectorAll('#fireExpMulChips .toggle-chip').forEach(function(c) { c.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  runFire();
}

function runFire() {
  if (!isPro()) return;
  // Refresh slider displays — use display currency (no native conversion)
  var sSl = document.getElementById('fireSavings');
  var sSv = document.getElementById('savingsVal');
  if (sSl && sSv) sSv.textContent = curSym() + (Math.round(parseInt(sSl.value) || 500) * _fireSaveMul).toLocaleString();
  var eSl = document.getElementById('fireExpenses');
  var eSv = document.getElementById('expensesVal');
  if (eSl && eSv) eSv.textContent = curSym() + (Math.round(parseInt(eSl.value) || 500) * _fireExpMul).toLocaleString();

  const nw = assets.filter(a => a.cat !== 'liability').reduce((s, a) => s + a.value, 0) - assets.filter(a => a.cat === 'liability').reduce((s, a) => s + a.value, 0);
  // Convert slider (display currency) values to native for simulation — apply multipliers
  var monthlySavings = Math.round(toStored((parseInt(document.getElementById('fireSavings').value) || 500) * _fireSaveMul));
  var annualExpenses = Math.round(toStored((parseInt(document.getElementById('fireExpenses').value) || 500) * _fireExpMul));
  var retirementAge = parseInt(document.getElementById('fireRetire').value) || 55;
  var inflationRate = parseInt(document.getElementById('fireInflation').value) || 18;
  var returnRate   = parseInt(document.getElementById('fireReturn').value) || 10;

  var res = Calculators.fireSimulation({
    currentAge:       parseInt(document.getElementById('fireAge').value),
    retirementAge:    retirementAge,
    currentNetWorth:  nw,
    monthlySavings:   monthlySavings,
    annualReturnRate: returnRate,
    inflationRate:    inflationRate,
    annualExpenses:   annualExpenses,
  });

  // ═══════════════════════════════════════════════════════════
  // Hero Card — Projected Wealth
  // ═══════════════════════════════════════════════════════════
  var heroAge = document.getElementById('fireHeroAge');
  if (heroAge) heroAge.textContent = retirementAge;

  var pwEl = document.getElementById('fireProjNW');
  if (pwEl) pwEl.textContent = fmtShort(res.projectedNW);

  // Progress bar (% of FI target)
  var pct = res.fiNumber > 0 ? Math.round((res.projectedNW / res.fiNumber) * 100) : 0;
  var pctEl = document.getElementById('fireProgressPct');
  var barEl = document.getElementById('fireProgressBar');
  var noteEl = document.getElementById('fireProgressNote');
  if (pctEl) pctEl.textContent = pct + '%';
  if (barEl) {
    barEl.style.width = Math.min(pct, 100) + '%';
    if (pct >= 100) {
      barEl.classList.add('over-100');
      barEl.style.width = '100%';
    } else {
      barEl.classList.remove('over-100');
    }
  }
  if (noteEl) {
    noteEl.textContent = pct >= 100 ? 'FI target achieved — you\'re financially independent!' : 'of your FI target';
  }

  // ═══════════════════════════════════════════════════════════
  // Anchor Card — FI Target
  // ═══════════════════════════════════════════════════════════
  var fiEl = document.getElementById('fireFINum');
  if (fiEl) {
    fiEl.textContent = fmtShort(res.fiNumber);
    fiEl.style.color = res.isFIReady ? 'var(--green)' : 'var(--text-dim)';
  }

  // Surplus badge
  var badge = document.getElementById('fireSurplusBadge');
  var badgeText = document.getElementById('fireSurplusText');
  if (badge && badgeText) {
    if (res.isFIReady && res.surplus > 0) {
      badge.style.display = 'inline-flex';
      badgeText.textContent = '+' + fmtShort(res.surplus) + ' Surplus';
    } else {
      badge.style.display = 'none';
    }
  }

  // Years to retire
  var yrEl = document.getElementById('fireYearsToRetire');
  if (yrEl) yrEl.textContent = res.yearsToRetirement + ' years to retirement';

  // ═══════════════════════════════════════════════════════════
  // Insight Banners
  // ═══════════════════════════════════════════════════════════
  var milestoneBanner = document.getElementById('fireMilestoneBanner');
  var milestoneText  = document.getElementById('fireMilestoneText');
  if (milestoneBanner && milestoneText) {
    // Scan trajectory for crossing point
    var crossAge = null;
    for (var i = 0; i < res.trajectory.length; i++) {
      if (res.trajectory[i].netWorth >= res.trajectory[i].fiNumber) {
        crossAge = res.trajectory[i].age;
        break;
      }
    }
    if (crossAge !== null && crossAge <= retirementAge) {
      var yearsEarly = retirementAge - crossAge;
      milestoneBanner.style.display = 'flex';
      milestoneText.textContent = 'You will cross your financial independence threshold at Age ' + crossAge + ' — allowing you to retire ' + yearsEarly + ' years earlier than planned.';
    } else {
      milestoneBanner.style.display = 'none';
    }
  }

  // Inflation warning
  var inflBanner = document.getElementById('fireInflationBanner');
  if (inflBanner) {
    if (inflationRate >= returnRate) {
      inflBanner.style.display = 'flex';
    } else {
      inflBanner.style.display = 'none';
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Chart
  // ═══════════════════════════════════════════════════════════
  var ctx = document.getElementById('fireChart'); if (!ctx) return;
  var cc = getCC();
  var data = {
    labels: res.trajectory.map(function(t) { return '' + t.age; }),
    datasets: [
      {
        label: 'Projected NW',
        data: res.trajectory.map(function(t) { return t.netWorth; }),
        borderColor: '#f97316',
        backgroundColor: 'rgba(249,115,22,0.08)',
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: '#f97316'
      },
      {
        label: 'FI Number',
        data: res.trajectory.map(function(t) { return t.fiNumber; }),
        borderColor: '#34d399',
        borderDash: [6, 4],
        tension: 0,
        borderWidth: 2,
        pointRadius: 0,
        fill: false
      }
    ]
  };
  if (fireChart) { fireChart.data = data; fireChart.update(); return; }
  fireChart = new Chart(ctx, {
    type: 'line', data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { padding: 14, usePointStyle: true, pointStyle: 'rectRounded', pointStyleWidth: 10, font: { size: 11 } }
        },
        tooltip: {
          ...cc.tt,
          callbacks: { label: function(c) { return ' ' + c.dataset.label + ': ' + fmtShort(c.parsed.y); } }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 }, color: cc.text } },
        y: {
          grid: { color: cc.grid },
          border: { display: false },
          ticks: { callback: function(v) { return fmtShort(v); }, font: { size: 10 }, color: cc.text } }
        }
      }
    }
  );
  // Refresh slider track fills
  ['fireAge','fireRetire','fireSavings','fireReturn','fireInflation','fireExpenses'].forEach(function(id) {
    var s = document.getElementById(id); if (s) fillSliderTrack(s);
  });

}

function runDebt() {
  if (!isPro()) return;
  updateDebtDisplay();
  var debts = assets.filter(function(a) { return a.cat === 'liability'; }).map(function(a) {
    return {
      name: a.name, balance: a.value,
      minPayment: Math.max(a.value * 0.02, 1),
      interestRate: a.rate || 18
    };
  });

  // ══ No debts — show placeholder, keep DOM intact ══
  if (!debts.length) {
    ['debtTotalBal','debtMinPmt','debtAvgRate','debtTotalPmt'].forEach(function(id) {
      var el = document.getElementById(id); if (el) el.textContent = '—';
    });
    var cnt = document.getElementById('debtCount'); if (cnt) cnt.textContent = 'No debts yet';
    var grid = document.getElementById('debtStrategyGrid'); if (grid) grid.innerHTML =
      '<div class="chart-card wide" style="text-align:center;padding:40px;">' +
        '<div class="empty-icon" style="font-size:28px;"><i class="fas fa-clipboard-list"></i></div>' +
        '<div style="font-size:14px;font-weight:600;color:var(--text-dim);margin-top:8px;">No liabilities logged yet</div>' +
        '<div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Add a liability entry (e.g. GTBank loan, car finance) from the Assets page to unlock the Debt Optimizer.</div>' +
      '</div>';
    var body = document.getElementById('debtBreakdownBody'); if (body) body.innerHTML = '';
    var rec  = document.getElementById('debtRecommendation'); if (rec) rec.innerHTML = '';
    var ctx  = document.getElementById('debtChart'); if (ctx) { ctx.style.display = 'none'; if (debtChart) { debtChart.destroy(); debtChart = null; } }
    return;
  }

  try {
  var extraPmt = getDebtExtra();
  var aval = Calculators.debtPaydown(debts, extraPmt, 'avalanche');
  var snow = Calculators.debtPaydown(debts, extraPmt, 'snowball');

  // ══ Summary Cards ══
  var totalBal = debts.reduce(function(s, d) { return s + d.balance; }, 0);
  var totalMin = debts.reduce(function(s, d) { return s + d.minPayment; }, 0);
  var sumRb = 0;
  debts.forEach(function(d) { sumRb += d.balance * d.interestRate; });
  var avgRate = totalBal > 0 ? (sumRb / totalBal).toFixed(1) : '0';

  document.getElementById('debtTotalBal').textContent = fmt(totalBal);
  document.getElementById('debtCount').textContent = debts.length + ' debt' + (debts.length !== 1 ? 's' : '');
  document.getElementById('debtMinPmt').textContent = fmt(totalMin);
  document.getElementById('debtAvgRate').textContent = avgRate + '%';
  document.getElementById('debtTotalPmt').textContent = fmt(totalMin + extraPmt);

  // ══ Strategy Comparison ══
  // Avalanche
  document.getElementById('avalTime').textContent = aval.months + ' mo (' + aval.years + ' yr)';
  document.getElementById('avalInterest').textContent = fmt(aval.totalInterestPaid);
  var avalOrderEl = document.getElementById('avalPayoffOrder');
  avalOrderEl.innerHTML = aval.payoffOrder.map(function(d, i) {
    var monthsStr = d.month + ' mo (' + (d.month / 12).toFixed(1) + ' yr)';
    return '<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--surface2);border-radius:6px;">' +
      '<span style="width:20px;height:20px;border-radius:50%;background:rgba(52,211,153,0.15);color:#34d399;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;">' + (i + 1) + '</span>' +
      '<span style="flex:1;font-weight:500;">' + d.name + '</span>' +
      '<span style="font-size:10px;color:var(--text-muted);">' + monthsStr + '</span>' +
    '</div>';
  }).join('');

  // Snowball
  document.getElementById('snowTime').textContent = snow.months + ' mo (' + snow.years + ' yr)';
  document.getElementById('snowInterest').textContent = fmt(snow.totalInterestPaid);
  var snowOrderEl = document.getElementById('snowPayoffOrder');
  snowOrderEl.innerHTML = snow.payoffOrder.map(function(d, i) {
    var monthsStr = d.month + ' mo (' + (d.month / 12).toFixed(1) + ' yr)';
    return '<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--surface2);border-radius:6px;">' +
      '<span style="width:20px;height:20px;border-radius:50%;background:rgba(244,197,83,0.15);color:#f4c553;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;">' + (i + 1) + '</span>' +
      '<span style="flex:1;font-weight:500;">' + d.name + '</span>' +
      '<span style="font-size:10px;color:var(--text-muted);">' + monthsStr + '</span>' +
    '</div>';
  }).join('');

  // ══ Chart ══
  var ctx = document.getElementById('debtChart');
  if (ctx) {
    ctx.style.display = '';
    var cc = getCC();
    var maxM = Math.max(aval.timeline.length, snow.timeline.length);
    var data = {
      labels: Array.from({ length: maxM }, function(_, i) { return i + 1; }),
      datasets: [
        { label: 'Avalanche', data: aval.timeline.map(function(t) { return t.totalDebt; }), borderColor: '#34d399', tension: 0.4, borderWidth: 2, pointRadius: 0, fill: false },
        { label: 'Snowball', data: snow.timeline.map(function(t) { return t.totalDebt; }), borderColor: '#f4c553', tension: 0.4, borderWidth: 2, pointRadius: 0, fill: false }
      ]
    };
    // Destroy stale chart before recreating
    try { if (debtChart) { debtChart.destroy(); } } catch(e) {}
    debtChart = null;
    // Build new chart on a fresh canvas
    var parent = ctx.parentNode;
    if (parent) {
      var fresh = document.createElement('canvas');
      fresh.id = 'debtChart';
      parent.replaceChild(fresh, ctx);
      ctx = fresh;
    }
    debtChart = new Chart(ctx, { type: 'line', data: data, options: { responsive: true, maintainAspectRatio: false, interaction: { intersect: false, mode: 'index' }, plugins: { legend: { position: 'bottom', labels: { padding: 14, usePointStyle: true, pointStyle: 'rectRounded', pointStyleWidth: 10, font: { size: 11 } } }, tooltip: { ...cc.tt, callbacks: { label: function(c) { return ' ' + c.dataset.label + ': ' + fmtShort(c.parsed.y); } } } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 10 }, color: cc.text }, title: { display: true, text: 'Month', font: { size: 10 }, color: cc.text } }, y: { grid: { color: cc.grid }, border: { display: false }, ticks: { callback: function(v) { return fmtShort(v); }, font: { size: 10 }, color: cc.text } } } } });
  }

  // ══ Per-Debt Breakdown Table ══
  var tbody = document.getElementById('debtBreakdownBody');
  if (tbody) {
    // Build a map from debt name to its perDebt info for each strategy
    var avalMap = {}; aval.perDebt.forEach(function(d) { avalMap[d.name] = d; });
    var snowMap = {}; snow.perDebt.forEach(function(d) { snowMap[d.name] = d; });

    tbody.innerHTML = debts.map(function(d) {
      var aInfo = avalMap[d.name];
      var sInfo = snowMap[d.name];
      var aMonth = aInfo ? aInfo.payoffMonth : '—';
      var sMonth = sInfo ? sInfo.payoffMonth : '—';
      var aStr = aMonth !== '—' ? aMonth + ' mo (' + (aMonth / 12).toFixed(1) + ' yr)' : '—';
      var sStr = sMonth !== '—' ? sMonth + ' mo (' + (sMonth / 12).toFixed(1) + ' yr)' : '—';
      var faster = aMonth !== '—' && sMonth !== '—' ? (aMonth < sMonth ? 'aval' : aMonth > sMonth ? 'snow' : 'tie') : null;
      return '<tr>' +
        '<td style="font-weight:500;">' + d.name + '</td>' +
        '<td class="mono sensitive">' + fmt(d.balance) + '</td>' +
        '<td class="mono">' + d.interestRate + '%</td>' +
        '<td class="mono">' + fmt(d.minPayment) + '</td>' +
        '<td class="mono" style="color:' + (faster === 'aval' ? '#34d399' : 'var(--text-dim)') + ';">' + aStr + (faster === 'aval' ? ' ✓' : '') + '</td>' +
        '<td class="mono" style="color:' + (faster === 'snow' ? '#f4c553' : 'var(--text-dim)') + ';">' + sStr + (faster === 'snow' ? ' ✓' : '') + '</td>' +
      '</tr>';
    }).join('');
  }

  // ══ Recommendation ══
  var recEl = document.getElementById('debtRecommendation');
  if (recEl) {
    var interestSaved = Math.abs(aval.totalInterestPaid - snow.totalInterestPaid);
    var avalWins = aval.totalInterestPaid < snow.totalInterestPaid;
    var firstAvalMonth = aval.payoffOrder.length > 0 ? aval.payoffOrder[0].month : 999;
    var firstSnowMonth = snow.payoffOrder.length > 0 ? snow.payoffOrder[0].month : 999;
    var snowClearsFirstFaster = firstSnowMonth < firstAvalMonth;

    var winnerMethod, winnerColor, winnerIcon;
    if (avalWins) {
      winnerMethod = 'Avalanche saves you ' + fmt(interestSaved) + ' in interest. That\'s the mathematically optimal choice.';
      winnerColor = '#34d399';
      winnerIcon = '❄️';
    } else if (interestSaved > 0) {
      winnerMethod = 'Snowball saves you ' + fmt(interestSaved) + ' in interest — unusual, but it can happen when your highest-rate debt is also your smallest.';
      winnerColor = '#f4c553';
      winnerIcon = '⛄';
    } else {
      winnerMethod = 'Both strategies cost the same in interest. Choose based on psychology.';
      winnerColor = 'var(--text-dim)';
      winnerIcon = '⚖️';
    }

    recEl.innerHTML =
      '<div class="chart-card wide" style="padding:20px;">' +
        '<div style="font-size:13px;font-weight:600;margin-bottom:10px;">💡 Personalized Recommendation</div>' +
        '<div style="display:flex;align-items:flex-start;gap:14px;padding:16px;background:var(--surface2);border:1px solid ' + winnerColor + '44;border-radius:12px;margin-bottom:14px;">' +
          '<div style="font-size:28px;flex-shrink:0;">' + winnerIcon + '</div>' +
          '<div>' +
            '<div style="font-size:14px;font-weight:600;color:' + winnerColor + ';margin-bottom:4px;">' + winnerMethod + '</div>' +
            '<div style="font-size:12px;color:var(--text-dim);line-height:1.7;">' +
              '<strong>Avalanche</strong> targets the highest-interest debt first — mathematically optimal, saves the most money.<br/>' +
              '<strong>Snowball</strong> targets the smallest balance first — quick wins boost motivation and adherence.' +
              (snowClearsFirstFaster ? '<br/><br/>⛄ Snowball clears your first debt ' + (firstAvalMonth - firstSnowMonth) + ' months earlier — a motivational win.' : '') +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:12px;color:var(--text-dim);line-height:1.6;">' +
          '<div style="background:var(--surface2);border-radius:10px;padding:14px;">' +
            '<div style="font-weight:600;color:#34d399;margin-bottom:4px;">❄️ Choose Avalanche if:</div>' +
            'You want to minimize total interest paid. You\'re disciplined and don\'t need quick wins to stay motivated. Your highest-rate debts are significantly more expensive than your others.' +
          '</div>' +
          '<div style="background:var(--surface2);border-radius:10px;padding:14px;">' +
            '<div style="font-weight:600;color:#f4c553;margin-bottom:4px;">⛄ Choose Snowball if:</div>' +
            'You need momentum and early progress to stay on track. Your smallest debts stress you out more than high-rate ones. Behavioral psychology matters more to you than pure math.' +
          '</div>' +
        '</div>' +
      '</div>';
  }
  } catch (e) {
    console.error('[Debt] runDebt error:', e.message);
    var grid = document.getElementById('debtStrategyGrid');
    if (grid) grid.innerHTML = '<div class="chart-card wide" style="text-align:center;padding:40px;color:var(--red);">Error: ' + e.message + '</div>';
  }
}

function runTax() {
  if (!isPro()) return;
  const cgt = parseFloat(document.getElementById('taxCGT')?.value || 10);
  const wht = parseFloat(document.getElementById('taxWithholding')?.value || 10);
  const res = Calculators.taxDragSimulation(assets, { cgt, withholding: wht });
  const ptEl = document.getElementById('taxPreTax');  if (ptEl) ptEl.textContent = fmt(res.totalPreTax);
  const txEl = document.getElementById('taxAmount');  if (txEl) txEl.textContent = fmt(res.totalTax);
  const poEl = document.getElementById('taxPostTax'); if (poEl) poEl.textContent = fmt(res.totalPostTax);
  const rtEl = document.getElementById('taxRate');    if (rtEl) rtEl.textContent = `Effective rate: ${res.effectiveTaxRate}%`;
  const tbody = document.getElementById('taxTableBody');
  if (tbody) tbody.innerHTML = res.breakdown.map(b => `
    <tr><td style="font-weight:500;">${b.name}</td>
    <td class="mono sensitive">${fmt(b.preValue)}</td>
    <td class="mono" style="color:var(--red);">-${fmt(b.taxAmount)}</td>
    <td class="mono sensitive" style="color:var(--green);">${fmt(b.postValue)}</td>
    <td class="mono">${b.effectiveRate}%</td></tr>`).join('');
}

function runOptimizer() {
  if (!isGrowth()) return;
  var res = Calculators.allocationOptimizer(assets);
  var el  = document.getElementById('optimizerRecs');
  if (!el) return;

  // Compute detailed stats
  var total = 0;
  var bycat = { cash:0, physical:0, investment:0, liability:0 };
  assets.forEach(function(a) { bycat[a.cat] = (bycat[a.cat]||0) + a.value; });
  var totalAssets = bycat.cash + bycat.physical + bycat.investment;
  total = totalAssets;

  var cashPct   = total > 0 ? ((bycat.cash       / total)*100).toFixed(1) : '0';
  var physPct   = total > 0 ? ((bycat.physical   / total)*100).toFixed(1) : '0';
  var invPct    = total > 0 ? ((bycat.investment / total)*100).toFixed(1) : '0';
  var debtRatio = total > 0 ? ((bycat.liability  / total)*100).toFixed(1) : '0';

  var totalInvested = assets.filter(function(a){ return a.cat==='investment'; })
                            .reduce(function(s,a){ return s + (a.principal||0); }, 0);
  var totalFV       = assets.filter(function(a){ return a.cat==='investment'; })
                            .reduce(function(s,a){ return s + (a.fv||0); }, 0);
  var projGain      = totalFV - totalInvested;

  var riskScore  = res.riskScore;
  var riskColor  = riskScore === 'High' ? '#f87171' : riskScore === 'Medium' ? '#f4c553' : '#34d399';
  var riskIcon   = riskScore === 'High' ? '🔴' : riskScore === 'Medium' ? '🟡' : '🟢';

  // Build allocation donut using SVG (includes liabilities for full picture)
  var totalWithLiab = total + (bycat.liability || 0);
  var donutCash  = totalWithLiab > 0 ? (bycat.cash       / totalWithLiab * 100) : 0;
  var donutPhys  = totalWithLiab > 0 ? (bycat.physical   / totalWithLiab * 100) : 0;
  var donutInv   = totalWithLiab > 0 ? (bycat.investment / totalWithLiab * 100) : 0;
  var donutLiab  = totalWithLiab > 0 ? (bycat.liability  / totalWithLiab * 100) : 0;
  var segments = [
    { label:'Cash',         pct: donutCash, color:'#60a5fa' },
    { label:'Physical',     pct: donutPhys, color:'#34d399' },
    { label:'Investments',  pct: donutInv,  color:'#f97316' },
    { label:'Liabilities',  pct: donutLiab, color:'#f87171' },
  ].filter(function(s){ return s.pct > 0; });

  var donutSVG = buildMiniDonut(segments, 60);

  // Build rich HTML
  var html = '';

  // ── Top overview row ────────────────────────────────────────
  html +=
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:20px;">' +
      buildStatCard('Total Assets', fmt(total), getTheme() === 'light' ? '#c2410c' : '#f97316', '') +
      buildStatCard('Risk Level', riskIcon + ' ' + riskScore, riskColor, 'Based on concentration & debt') +
      buildStatCard('Cash %', cashPct + '%', parseFloat(cashPct) > 35 ? '#f4c553' : parseFloat(cashPct) < 5 ? '#f87171' : '#34d399', 'Ideal: 10–30%') +
      buildStatCard('Investment %', invPct + '%', parseFloat(invPct) < 15 ? '#f87171' : parseFloat(invPct) >= 30 ? '#34d399' : '#f4c553', 'Ideal: >30%') +
      buildStatCard('Debt Ratio', debtRatio + '%', parseFloat(debtRatio) > 40 ? '#f87171' : parseFloat(debtRatio) > 20 ? '#f4c553' : '#34d399', 'Ideal: <30%') +
      (projGain > 0 ? buildStatCard('Projected Gain', '+' + fmt(projGain), '#34d399', 'At investment maturity') : '') +
    '</div>';

  // ── Allocation chart + breakdown ────────────────────────────
  html +=
    '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:14px;padding:20px;margin-bottom:16px;">' +
      '<div style="font-size:13px;font-weight:600;margin-bottom:16px;">📊 Portfolio Allocation</div>' +
      '<div style="display:flex;flex-direction:column;gap:10px;">' +
        buildAllocBar('💵 Liquid Cash',    cashPct, '#60a5fa', bycat.cash,       '10–30%') +
        buildAllocBar('📦 Physical Assets',physPct, '#34d399', bycat.physical,   '<60%') +
        buildAllocBar('📈 Investments',    invPct,  '#f97316', bycat.investment, '>30%') +
        (bycat.liability > 0 ? buildAllocBar('⚠️ Liabilities', debtRatio, '#f87171', bycat.liability, '<30%') : '') +
      '</div>' +
    '</div>';

  // ── Concentration risk analysis ──────────────────────────────
  var topAsset = assets
    .filter(function(a){ return a.cat !== 'liability'; })
    .sort(function(a,b){ return b.value - a.value; })[0];
  var topPct = topAsset && total > 0 ? ((topAsset.value / total)*100).toFixed(1) : 0;

  html +=
    '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:14px;padding:20px;margin-bottom:16px;">' +
      '<div style="font-size:13px;font-weight:600;margin-bottom:14px;">🎯 Concentration Risk Analysis</div>' +
      '<div style="display:flex;flex-direction:column;gap:12px;">' +
        buildRiskItem(
          'Largest Single Asset',
          topAsset ? '"' + topAsset.name + '" (' + topPct + '% of portfolio)' : 'N/A',
          parseFloat(topPct) > 50 ? 'High — Over 50% in one asset is dangerous. Diversify.' :
          parseFloat(topPct) > 30 ? 'Medium — Consider spreading across more assets.' :
          'Low — Good single-asset diversification.',
          parseFloat(topPct) > 50 ? '#f87171' : parseFloat(topPct) > 30 ? '#f4c553' : '#34d399'
        ) +
        buildRiskItem(
          'Asset Category Spread',
          assets.length > 0 ? new Set(assets.filter(function(a){return a.cat!=='liability';}).map(function(a){return a.cat;})).size + ' of 3 categories used' : '0 categories',
          new Set(assets.map(function(a){return a.cat;})).size >= 3 ? "Good — You're spread across multiple categories." :
          "Poor — You're concentrated in fewer than 3 categories.",
          new Set(assets.map(function(a){return a.cat;})).size >= 3 ? '#34d399' : '#f87171'
        ) +
        buildRiskItem(
          'Currency Exposure',
          'Single currency (NGN)',
          'Consider adding USD or GBP-denominated assets to hedge naira devaluation risk. Unlock Multi-Currency for full FX analysis.',
          '#f4c553'
        ) +
        buildRiskItem(
          'Liquidity Risk',
          cashPct + '% readily accessible',
          parseFloat(cashPct) < 10 ? 'High — Less than 10% liquid. A financial emergency could force asset sales at a loss.' :
          parseFloat(cashPct) > 40 ? 'Opportunity Cost — Too much cash sitting idle, losing value to inflation.' :
          'Acceptable — Your liquid buffer is within the healthy range.',
          parseFloat(cashPct) < 10 ? '#f87171' : parseFloat(cashPct) > 40 ? '#f4c553' : '#34d399'
        ) +
      '</div>' +
    '</div>';

  // ── Recommendations ──────────────────────────────────────────
  html +=
    '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:14px;padding:20px;margin-bottom:16px;">' +
      '<div style="font-size:13px;font-weight:600;margin-bottom:14px;">💡 Personalized Recommendations</div>' +
      '<div style="display:flex;flex-direction:column;gap:10px;">';

  var recColor = { success:'#34d399', warning:'#f4c553', danger:'#f87171', info:'#60a5fa' };
  var recIcon  = { success:'✓', warning:'⚠', danger:'!', info:'i' };
  for (var ri = 0; ri < res.recommendations.length; ri++) {
    var rec = res.recommendations[ri];
    var rc  = recColor[rec.type] || '#888';
    html +=
      '<div style="display:flex;align-items:flex-start;gap:12px;padding:14px;' +
        'background:var(--surface);border:1px solid ' + rc + '25;border-radius:10px;">' +
        '<div style="width:28px;height:28px;border-radius:50%;background:' + rc + '18;' +
          'color:' + rc + ';display:flex;align-items:center;justify-content:center;' +
          'font-size:12px;font-weight:700;flex-shrink:0;">' + (recIcon[rec.type]||'i') + '</div>' +
        '<div style="font-size:13px;color:var(--text);line-height:1.7;">' + rec.msg + '</div>' +
      '</div>';
  }

  html += '</div></div>';

  // ── Ideal target allocation guide ────────────────────────────
  html +=
    '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:14px;padding:20px;">' +
      '<div style="font-size:13px;font-weight:600;margin-bottom:14px;"><i class="fas fa-clipboard-list"></i> Ideal Target Allocation (by wealth stage)</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">' +
        buildTargetCard('Early Stage', 'Net Worth < $50K', ['50% Cash (emergency buffer) 💰', '30% Investments (start early) 📈', '20% Physical (essentials) 🏡']) +
        buildTargetCard('Building Stage', 'Net Worth $50K–$300K', ['30% Cash (build flexibility) 💰', '50% Investments (compound momentum) 📈', '20% Physical (entry assets) 🏡']) +
        buildTargetCard('Growth Stage', 'Net Worth $300K–$1M', ['20% Cash (opportunistic) 💰', '55% Investments (accelerated growth) 📈', '25% Physical (real estate focus) 🏡']) +
        buildTargetCard('Wealth Stage', 'Net Worth > $1M', ['10% Cash (operational) 💰', '60% Investments (preservation + growth) 📈', '30% Physical (premium assets) 🏡']) +
      '</div>' +
    '</div>';

  el.innerHTML = html;
}

function buildStatCard(label, value, color, sub) {
  return '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px;">' +
    '<div style="font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--text-dim);margin-bottom:6px;">' + label + '</div>' +
    '<div class="sensitive" style="font-size:18px;font-weight:700;color:' + color + ';margin-bottom:3px;">' + value + '</div>' +
    (sub ? '<div style="font-size:11px;color:var(--text-muted);">' + sub + '</div>' : '') +
  '</div>';
}

function buildAllocBar(label, pct, color, amount, ideal) {
  var barW = Math.min(parseFloat(pct), 100);
  return '<div>' +
    '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">' +
      '<span style="font-weight:500;">' + label + '</span>' +
      '<span style="color:var(--text-dim);">' +
        '<span style="font-weight:700;color:' + color + ';">' + pct + '%</span>' +
        ' · <span class="sensitive">' + fmt(amount) + '</span>' +
        ' <span style="font-size:10px;color:var(--text-muted);">(ideal ' + ideal + ')</span>' +
      '</span>' +
    '</div>' +
    '<div style="height:8px;background:var(--surface);border-radius:4px;overflow:hidden;">' +
      '<div style="height:100%;width:' + barW + '%;background:' + color + ';border-radius:4px;transition:width 1s ease;"></div>' +
    '</div>' +
  '</div>';
}

function buildRiskItem(label, value, desc, color) {
  return '<div style="display:grid;grid-template-columns:180px 1fr;gap:12px;padding:12px 0;border-bottom:1px solid var(--border);">' +
    '<div>' +
      '<div style="font-size:12px;font-weight:600;color:var(--text-dim);margin-bottom:2px;">' + label + '</div>' +
      '<div style="font-size:13px;font-weight:600;color:' + color + ';">' + value + '</div>' +
    '</div>' +
    '<div style="font-size:12px;color:var(--text-dim);line-height:1.6;">' + desc + '</div>' +
  '</div>';
}

function buildTargetCard(stage, range, items) {
  var rows = items.map(function(item){
    return '<div style="font-size:12px;color:var(--text-dim);display:flex;align-items:center;gap:6px;margin-bottom:4px;">' +
      '<span style="color:var(--accent);font-size:10px;">▸</span>' + item +
    '</div>';
  }).join('');
  return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px;">' +
    '<div style="font-size:13px;font-weight:600;margin-bottom:2px;">' + stage + '</div>' +
    '<div style="font-size:11px;color:var(--text-muted);margin-bottom:10px;">' + range + '</div>' +
    rows +
  '</div>';
}

function buildMiniDonut(segments, size) {
  var strokeW = 10;
  var r = size/2 - strokeW;
  var cx = size/2; var cy = size/2;
  var circ = 2 * Math.PI * r;
  var gapSize = 1.5; // gap between segments in px
  var offset = 0;
  var paths = '';
  var total = segments.reduce(function(s,seg){ return s + seg.pct; }, 0) || 1;
  for (var i=0; i<segments.length; i++) {
    var seg = segments[i];
    var dash = (seg.pct / total) * circ - gapSize;
    var gap  = circ - dash;
    paths += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" ' +
      'stroke="' + seg.color + '" stroke-width="' + strokeW + '" stroke-linecap="round" ' +
      'stroke-dasharray="' + dash.toFixed(1) + ' ' + gap.toFixed(1) + '" ' +
      'stroke-dashoffset="' + (-offset).toFixed(1) + '" />';
    offset += dash + gapSize;
  }
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" ' +
    'style="display:block;overflow:visible;transform:rotate(-90deg);flex-shrink:0;" xmlns="http://www.w3.org/2000/svg">' + paths + '</svg>';
}









function renderScore() {
  if (!isGrowth()) return;
  var s   = Calculators.netWorthScore(assets);
  var opt = Calculators.allocationOptimizer(assets);

  // Animate ring (circumference = 2 * pi * 68 = ~427)
  var ring = document.getElementById('scoreRing');
  if (ring) {
    setTimeout(function() {
      ring.style.strokeDashoffset = String(427 - (427 * s.score / 100));
      ring.style.stroke = s.color;
    }, 150);
  }

  var numEl = document.getElementById('scoreNum');
  if (numEl) { numEl.textContent = String(s.score); numEl.style.color = s.color; }
  var lblEl = document.getElementById('scoreLabel');
  if (lblEl) { lblEl.textContent = s.label; lblEl.style.color = s.color; }

  // Grade badge
  var gradeEl = document.getElementById('scoreGrade');
  if (gradeEl) {
    var grades = [
      { min:80, label:'A — Excellent',  bg:'rgba(52,211,153,0.15)',  color:'#34d399' },
      { min:60, label:'B — Good',       bg:'rgba(96,165,250,0.15)',  color:'#60a5fa' },
      { min:40, label:'C — Fair',       bg:'rgba(244,197,83,0.15)',  color:'#f4c553' },
      { min:0,  label:'D — Needs Work', bg:'rgba(248,113,113,0.15)', color:'#f87171' }
    ];
    var g = grades.find(function(x){ return s.score >= x.min; }) || grades[3];
    gradeEl.style.background = g.bg;
    gradeEl.style.color      = g.color;
    gradeEl.textContent      = g.label;
  }

  // Metric bar values
  var dEl = document.getElementById('scoreDebt');
  if (dEl) { dEl.textContent = s.debtRatio + '%'; }
  var lEl = document.getElementById('scoreLiquid');
  if (lEl) { lEl.textContent = s.liquidRatio + '%'; }
  var iEl = document.getElementById('scoreInvest');
  if (iEl) { iEl.textContent = s.investRatio + '%'; }

  renderScoreBar('debtBar',   parseFloat(s.debtRatio),   100, '#f87171', s.debtRatio + '% debt-to-asset');
  renderScoreBar('liquidBar', parseFloat(s.liquidRatio), 100, '#60a5fa', s.liquidRatio + '% liquid cash');
  renderScoreBar('investBar', parseFloat(s.investRatio), 100, '#34d399', s.investRatio + '% invested');

  // ── Card footnotes (desktop) ─────────────────────────────
  var totalLiab = assets.filter(function(a){return a.cat==='liability';}).reduce(function(sum,a){return sum+a.value;},0);
  var totalCash = assets.filter(function(a){return a.cat==='cash';}).reduce(function(sum,a){return sum+a.value;},0);
  var totalInv  = assets.filter(function(a){return a.cat==='investment';}).reduce(function(sum,a){return sum+a.value;},0);
  var invCount  = assets.filter(function(a){return a.cat==='investment';}).length;
  var liabCount = assets.filter(function(a){return a.cat==='liability';}).length;
  var investGains = assets.filter(function(a){return a.cat==='investment';}).reduce(function(sum,a){return sum+(a.interest||0);},0);

  document.getElementById('scoreMicroDebt').innerHTML   = liabCount ? '<div class="kpi-change">' + fmt(totalLiab) + ' across ' + liabCount + ' debt' + (liabCount!==1?'s':'') + '</div>' : '';
  document.getElementById('scoreMicroLiquid').innerHTML  = '<div class="kpi-change">' + fmt(totalCash) + ' in cash &amp; equivalents</div>';
  document.getElementById('scoreMicroInvest').innerHTML  = invCount ? '<div class="kpi-change">' + fmt(totalInv) + ' across ' + invCount + ' position' + (invCount!==1?'s':'') + (investGains>0?' · +'+fmt(investGains)+' projected':'') + '</div>' : '';

  renderScoreBreakdown(s);
  renderScoreHistory();
  renderScoreRecommendations(s, opt);
}

function renderScoreBar(id, value, max, color, label) {
  var el = document.getElementById(id);
  if (!el) return;
  var pct = Math.min((value / max) * 100, 100).toFixed(1);
  el.innerHTML =
    '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-dim);margin-bottom:5px;">' +
      '<span>' + label + '</span>' +
      '<span style="color:' + color + ';font-weight:600;">' + value + '%</span>' +
    '</div>' +
    '<div style="height:6px;background:var(--surface3);border-radius:3px;overflow:hidden;">' +
      '<div style="height:100%;width:' + pct + '%;background:' + color + ';border-radius:3px;transition:width 1s ease;"></div>' +
    '</div>';
}

function renderScoreBreakdown(s) {
  var el = document.getElementById('scoreBreakdown');
  if (!el) return;
  var cats = new Set(assets.map(function(a){ return a.cat; })).size;
  var totalAssets = assets.filter(function(a){ return a.cat !== 'liability'; }).reduce(function(sum,a){ return sum+a.value; }, 0);
  var totalLiab   = assets.filter(function(a){ return a.cat === 'liability'; }).reduce(function(sum,a){ return sum+a.value; }, 0);
  var netPositive = totalAssets > totalLiab;

  var factors = [
    {
      label: 'Debt-to-Asset Ratio',
      value: s.debtRatio + '%',
      target: '< 30%',
      pts: parseFloat(s.debtRatio) < 10 ? 30 : parseFloat(s.debtRatio) < 30 ? 22 : parseFloat(s.debtRatio) < 50 ? 14 : 6,
      maxPts: 30,
      status: parseFloat(s.debtRatio) < 30 ? 'good' : parseFloat(s.debtRatio) < 50 ? 'warn' : 'bad',
      desc: 'Measures how much of your total assets are financed by debt. Keep this below 30% for a healthy score.'
    },
    {
      label: 'Liquid Cash Buffer',
      value: s.liquidRatio + '%',
      target: '10 – 30%',
      pts: (parseFloat(s.liquidRatio) >= 10 && parseFloat(s.liquidRatio) <= 30) ? 20 : parseFloat(s.liquidRatio) >= 5 ? 14 : 8,
      maxPts: 20,
      status: (parseFloat(s.liquidRatio) >= 10 && parseFloat(s.liquidRatio) <= 30) ? 'good' : parseFloat(s.liquidRatio) >= 5 ? 'warn' : 'bad',
      desc: 'Emergency fund coverage. Aim for 10–30% of your portfolio in accessible liquid cash (3–6 months expenses).'
    },
    {
      label: 'Investment Allocation',
      value: s.investRatio + '%',
      target: '> 30%',
      pts: parseFloat(s.investRatio) >= 50 ? 25 : parseFloat(s.investRatio) >= 30 ? 18 : parseFloat(s.investRatio) >= 15 ? 10 : 5,
      maxPts: 25,
      status: parseFloat(s.investRatio) >= 30 ? 'good' : parseFloat(s.investRatio) >= 15 ? 'warn' : 'bad',
      desc: 'Percentage of your wealth actively growing through investments. Higher allocation drives long-term wealth.'
    },
    {
      label: 'Portfolio Diversification',
      value: cats + ' categor' + (cats === 1 ? 'y' : 'ies'),
      target: '3 – 4 categories',
      pts: Math.min(cats * 4, 15),
      maxPts: 15,
      status: cats >= 3 ? 'good' : cats >= 2 ? 'warn' : 'bad',
      desc: 'How spread your wealth is across Cash, Physical, Investments, and Liabilities. More categories = lower risk.'
    },
    {
      label: 'Net Worth Position',
      value: netPositive ? 'Positive (<span class="sensitive">' + fmt(totalAssets - totalLiab) + '</span>)' : 'Negative',
      target: 'Positive',
      pts: netPositive ? 10 : 0,
      maxPts: 10,
      status: netPositive ? 'good' : 'bad',
      desc: 'Assets must exceed liabilities. A positive net worth is the most fundamental measure of financial health.'
    }
  ];

  var statusColor = { good: '#34d399', warn: '#f4c553', bad: '#f87171' };
  var statusIcon  = { good: '✓', warn: '⚠', bad: '✕' };

  var html = '';
  for (var f of factors) {
    var barPct = Math.round((f.pts / f.maxPts) * 100);
    html +=
      '<div style="padding:16px 20px;border-bottom:1px solid var(--border);">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:8px;">' +
          '<div style="display:flex;align-items:center;gap:10px;">' +
            '<span style="width:24px;height:24px;border-radius:50%;background:' + statusColor[f.status] + '22;' +
              'color:' + statusColor[f.status] + ';display:inline-flex;align-items:center;justify-content:center;' +
              'font-size:11px;font-weight:700;flex-shrink:0;">' + statusIcon[f.status] + '</span>' +
            '<span style="font-size:13px;font-weight:600;">' + f.label + '</span>' +
          '</div>' +
          '<div style="text-align:right;flex-shrink:0;">' +
            '<span style="font-size:13px;font-weight:700;color:' + statusColor[f.status] + ';">' + f.value + '</span>' +
            '<span style="font-size:11px;color:var(--text-muted);margin-left:8px;">Target: ' + f.target + '</span>' +
          '</div>' +
        '</div>' +
        '<div style="margin-bottom:8px;padding-left:34px;">' +
          '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted);margin-bottom:4px;">' +
            '<span>Score contribution</span>' +
            '<span style="font-weight:600;color:' + statusColor[f.status] + ';">' + f.pts + ' / ' + f.maxPts + ' pts</span>' +
          '</div>' +
          '<div style="height:4px;background:var(--surface3);border-radius:2px;overflow:hidden;">' +
            '<div style="height:100%;width:' + barPct + '%;background:' + statusColor[f.status] + ';border-radius:2px;transition:width 1s ease;"></div>' +
          '</div>' +
        '</div>' +
        '<div style="font-size:12px;color:var(--text-dim);line-height:1.6;padding-left:34px;">' + f.desc + '</div>' +
      '</div>';
  }
  el.innerHTML = html;
}

function renderScoreHistory() {
  var el = document.getElementById('scoreHistoryArea');
  if (!el || nwHistory.length < 2) {
    if (el) el.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:12px;">Add more entries over time to see your trend.</div>';
    return;
  }
  var vals = nwHistory.slice(-12).map(function(h){ return h.nw; });
  var max  = Math.max.apply(null, vals);
  var min  = Math.min.apply(null, vals);
  var range = max - min || 1;
  var W = 400; var H = 50;
  var points = vals.map(function(v, i) {
    var x = (i / (vals.length - 1)) * W;
    var y = H - ((v - min) / range) * (H - 4);
    return x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');
  var trend    = vals[vals.length-1] > vals[0];
  var trendCol = trend ? '#34d399' : '#f87171';
  var trendPct = vals[0] !== 0 ? (((vals[vals.length-1] - vals[0]) / Math.abs(vals[0])) * 100).toFixed(1) : '0';
  var firstTs  = nwHistory[Math.max(0, nwHistory.length-12)].ts;
  var lastTs   = nwHistory[nwHistory.length-1].ts;

  el.innerHTML =
    '<svg width="100%" height="50" viewBox="0 0 400 50" preserveAspectRatio="none" style="display:block;">' +
      '<polyline points="' + points + '" fill="none" stroke="' + trendCol + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>' +
    '<div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--text-muted);margin-top:6px;flex-wrap:wrap;gap:4px;">' +
      '<span>' + firstTs + '</span>' +
      '<span style="font-weight:600;color:' + trendCol + ';">' + (trend ? '↑' : '↓') + ' ' + (trend ? '+' : '') + trendPct + '% since first snapshot</span>' +
      '<span>' + lastTs + '</span>' +
    '</div>';
}

function renderScoreRecommendations(s, opt) {
  var el = document.getElementById('scoreRecommendations');
  if (!el) return;

  var recs      = [];
  var debt      = parseFloat(s.debtRatio);
  var liquid    = parseFloat(s.liquidRatio);
  var invest    = parseFloat(s.investRatio);
  var cats      = new Set(assets.map(function(a){ return a.cat; })).size;
  var hasInvest   = assets.some(function(a){ return a.cat === 'investment'; });
  var hasCompound = assets.some(function(a){ return a.cat === 'investment' && a.fv > 0; });
  var hasLiab     = assets.some(function(a){ return a.cat === 'liability'; });

  if (debt > 50)
    recs.push({ priority:'high', icon:'🔥', title:'Reduce debt urgently',
      desc:'Debt ratio is ' + debt + '% — above 50% is a danger zone. Prioritise debt paydown before new asset purchases. Use the Debt Optimizer to compare Snowball vs Avalanche strategies.' });
  else if (debt > 30)
    recs.push({ priority:'med', icon:'⚡', title:'Work on debt reduction',
      desc:'At ' + debt + '% debt ratio, you\'re above the 30% threshold. A focused repayment plan could improve your score by up to 16 points.' });

  if (liquid < 5)
    recs.push({ priority:'high', icon:'💧', title:'Build emergency fund immediately',
      desc:'Only ' + liquid + '% is liquid — that\'s dangerously low. Aim for at least 10% in accessible cash before expanding any other category. A financial shock could destabilise your portfolio.' });
  else if (liquid < 10)
    recs.push({ priority:'med', icon:'💧', title:'Increase liquid reserves',
      desc:'At ' + liquid + '% liquidity, you\'re below the recommended 10–30% range. Top up your liquid cash to cover 3–6 months of expenses as a safety buffer.' });
  else if (liquid > 40)
    recs.push({ priority:'med', icon:'📊', title:'Put excess cash to work',
      desc:'Over 40% in cash (' + liquid + '%) is losing real value to inflation daily. Consider deploying 10–20% into investments to improve long-term returns.' });

  if (!hasInvest)
    recs.push({ priority:'high', icon:'📈', title:'Start investing — your wealth is not growing',
      desc:'You have zero investment exposure. Even modest allocations to index funds, fixed income, or crypto can compound significantly over time. Start with as little as ' + Calculators.formatCurrency(Calculators.convertCurrency(100, 'USD', Calculators.getBaseCurrency()), Calculators.getBaseCurrency()) + '.' });
  else if (invest < 15)
    recs.push({ priority:'high', icon:'📈', title:'Critically low investment allocation',
      desc:'Only ' + invest + '% in investments is well below the 30%+ target. Increasing this is the single biggest lever to raise your Net Worth Score.' });
  else if (invest < 30)
    recs.push({ priority:'med', icon:'📈', title:'Grow your investment allocation',
      desc:'At ' + invest + '%, you\'re making progress but falling short of the 30–50% target for serious long-term wealth building.' });

  if (!hasCompound)
    recs.push({ priority:'med', icon:'⚙', title:'Add compound interest projections',
      desc:'Log principal, interest rate, and duration on your investments to unlock the Projected Future Value column and see how your money grows over time.' });

  if (cats < 3)
    recs.push({ priority:'med', icon:'🎯', title:'Diversify across more asset categories',
      desc:'You only track ' + cats + ' asset type' + (cats === 1 ? '' : 's') + '. A balanced portfolio should span Cash, Physical Assets, and Investments to reduce concentration risk and earn up to 15 bonus points.' });

  if (hasLiab && invest > 0)
    recs.push({ priority:'med', icon:'⚖️', title:'Balance debt paydown with investment',
      desc:'You have both liabilities and investments. Compare your debt interest rate vs your investment returns — if debt costs more than investments earn, prioritise paying it off first.' });

  if (s.score >= 70)
    recs.push({ priority:'good', icon:'🏆', title:'Strong financial position — keep it up',
      desc:'Your score of ' + s.score + '/100 is excellent. Maintain discipline, review monthly, and consider the FIRE Simulator to model early retirement scenarios.' });

  if (recs.length === 0)
    recs.push({ priority:'good', icon:'✅', title:'Portfolio looks healthy',
      desc:'No critical issues detected. Continue updating your values monthly and explore the FIRE Simulator and Tax Drag Simulator for deeper analysis.' });

  var priorityColor = { high:'#f87171', med:'#f4c553', good:'#34d399' };
  var priorityLabel = { high:'High Priority', med:'Recommended', good:'Optimal' };

  var html = '';
  for (var idx = 0; idx < recs.length; idx++) {
    var r = recs[idx];
    html +=
      '<div style="display:flex;align-items:flex-start;gap:14px;padding:14px 16px;' +
        'background:var(--surface2);border:1px solid var(--border);border-radius:10px;">' +
        '<div style="width:40px;height:40px;border-radius:10px;flex-shrink:0;' +
          'background:' + priorityColor[r.priority] + '18;' +
          'display:flex;align-items:center;justify-content:center;font-size:20px;">' + r.icon + '</div>' +
        '<div style="flex:1;min-width:0;">' +
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;flex-wrap:wrap;">' +
            '<span style="font-size:13px;font-weight:600;">' + r.title + '</span>' +
            '<span style="padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;' +
              'background:' + priorityColor[r.priority] + '18;' +
              'color:' + priorityColor[r.priority] + ';">' + priorityLabel[r.priority] + '</span>' +
          '</div>' +
          '<div style="font-size:12px;color:var(--text-dim);line-height:1.7;">' + r.desc + '</div>' +
        '</div>' +
        '<div style="font-size:14px;font-weight:700;color:var(--text-muted);flex-shrink:0;' +
          'width:22px;height:22px;border-radius:50%;background:var(--surface3);' +
          'display:flex;align-items:center;justify-content:center;">' + (idx+1) + '</div>' +
      '</div>';
  }
  el.innerHTML = html;
}


async function renderCurrency() {
  if (!isGrowth()) return;

  // Show loading while fetching
  var kpiEl = document.getElementById('currencyKPIs');
  var rateEl = document.getElementById('fxRateDisplay');
  if (kpiEl) kpiEl.innerHTML = '<div class="kpi-card" style="grid-column:span 5;text-align:center;padding:28px;"><div class="spinner" style="margin:0 auto 12px;"></div><div style="font-size:13px;color:var(--text-dim);">Fetching live exchange rates…</div></div>';
  if (rateEl) rateEl.innerHTML = '';

  // Fetch fresh rates
  await Calculators.fetchFXRates();

  var baseCur = Calculators.getBaseCurrency();
  var total = assets.filter(function(a) { return a.cat !== 'liability'; }).reduce(function(s, a) { return s + a.value; }, 0)
              - assets.filter(function(a) { return a.cat === 'liability'; }).reduce(function(s, a) { return s + a.value; }, 0);

  // Show net worth in 6 major currencies
  var displayCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'INR', 'CAD', 'AUD', 'NGN', 'ZAR'];
  // Remove base currency from list (it's already shown), keep unique and limited
  displayCurrencies = displayCurrencies.filter(function(c) { return c !== baseCur; }).slice(0, 9);

  if (kpiEl) kpiEl.innerHTML = displayCurrencies.map(function(c) {
    var converted = Calculators.convertCurrency(total, baseCur, c);
    return '<div class="kpi-card"><div class="kpi-label">' + c + '</div><div class="kpi-value sensitive">' + Calculators.formatCurrency(converted, c) + '</div><div class="kpi-change">Net Worth</div></div>';
  }).join('');

  // Rates display — show popular currencies grouped by region
  var lastFetched = Calculators.ratesLastFetched;
  var timeAgo = lastFetched ? Math.floor((Date.now() - lastFetched) / 60000) + ' min ago' : 'just now';
  var rateCount = Object.keys(Calculators.rates).length;

  // Popular rates to display (1 USD = X)
  var popularRates = ['EUR','GBP','JPY','CNY','INR','AUD','CAD','CHF','NZD','MXN','BRL','KRW','SGD','HKD','NGN','ZAR','KES','GHS','EGP','AED','SAR','TRY','RUB','SEK','NOK','DKK','PLN','THB','MYR','IDR','PHP','VND','PKR','BDT','ILS','ARS','CLP','COP','PEN'];

  if (rateEl) rateEl.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px;">' +
      '<span style="font-size:11px;color:var(--text-muted);">🕐 Updated ' + timeAgo + ' · ' + rateCount + ' currencies</span>' +
      '<button class="btn btn-secondary btn-sm" onclick="renderCurrency()">↻ Refresh Rates</button>' +
    '</div>' +
    '<div style="display:flex;flex-wrap:wrap;gap:8px;">' +
      popularRates.map(function(k) {
        var v = Calculators.rates[k];
        if (!v) return '';
        return '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:7px 12px;">' +
          '<div style="font-size:9px;color:var(--text-muted);">1 USD =</div>' +
          '<div class="mono" style="font-size:13px;font-weight:600;">' + Calculators.getCurrencySymbol(k) + ' ' + (typeof v === 'number' ? v.toFixed(2) : v) + '</div>' +
          '<div style="font-size:9px;color:var(--text-dim);">' + k + '</div>' +
        '</div>';
      }).join('') +
    '</div>';
}

// ══ GOALS ═════════════════════════════════════════════════════════
var _goals = [];

async function loadGoals() {
  if (!isGrowth()) return;
  try {
    var { data } = await sb.from('goals').select('*').order('created_at', { ascending: true });
    _goals = (data || []).map(function(g) { return { id: g.id, name: g.name, target: parseFloat(g.target_amount)||0, current: parseFloat(g.current_amount)||0, deadline: g.deadline, emoji: g.emoji, fundingSource: g.funding_source || 'total_nw', createdAt: g.created_at }; });
  } catch(e) { console.warn('[Goals] Load error:', e.message); }
}

async function saveGoal() {
  var editId = document.getElementById('gEditId').value;
  var name   = document.getElementById('gName').value.trim();
  var target = parseFloat(document.getElementById('gTarget').value) || 0;
  var deadline = document.getElementById('gDeadline').value || null;
  var emoji  = (document.getElementById('gEmoji').value || '').trim() || '🎯';
  var fundingSource = document.getElementById('gFundingSource').value || 'total_nw';
  if (!name || target <= 0) { UI.toast('Enter a name and target amount', 'error'); return; }
  try {
    var payload = { name: name, target_amount: target, deadline: deadline || null };
    payload.emoji = emoji;
    payload.funding_source = fundingSource;
    if (editId) {
      payload.updated_at = new Date().toISOString();
      await sb.from('goals').update(payload).eq('id', editId);
      UI.toast('Goal updated', 'success');
    } else {
      var nw = assets.filter(function(a) { return a.cat !== 'liability'; }).reduce(function(s,a){return s+a.value;},0) - assets.filter(function(a){return a.cat==='liability';}).reduce(function(s,a){return s+a.value;},0);
      payload.user_id = currentUser.id;
      payload.current_amount = nw;
      await sb.from('goals').insert(payload);
      UI.toast('Goal created', 'success');
      logAudit('created', 'goal', name, 'Target: ' + fmt(target));
    }
    closeModal('goalModal');
    await loadGoals();
    renderGoals();
  } catch(e) {
    // If emoji column doesn't exist yet, retry without it
    if (e.message && (e.message.indexOf('emoji') > -1 || e.message.indexOf('funding_source') > -1)) {
      try {
        var fallback = { name: name, target_amount: target, deadline: deadline || null };
        // Only include columns that exist
        if (e.message.indexOf('funding_source') === -1) fallback.funding_source = fundingSource;
        if (editId) {
          fallback.updated_at = new Date().toISOString();
          await sb.from('goals').update(fallback).eq('id', editId);
        } else {
          var nw2 = assets.filter(function(a) { return a.cat !== 'liability'; }).reduce(function(s,a){return s+a.value;},0) - assets.filter(function(a){return a.cat==='liability';}).reduce(function(s,a){return s+a.value;},0);
          fallback.user_id = currentUser.id;
          fallback.current_amount = nw2;
          await sb.from('goals').insert(fallback);
        }
        closeModal('goalModal');
        await loadGoals();
        renderGoals();
        UI.toast(editId ? 'Goal updated' : 'Goal created', 'success');
        return;
      } catch(e2) { UI.toast('Error: ' + e2.message, 'error'); return; }
    }
    UI.toast('Error: ' + e.message, 'error');
  }
}

async function deleteGoal(id) {
  var confirmed = await showConfirm('Delete Goal', 'This goal and its progress will be permanently removed.', 'Delete', '🗑'); if (!confirmed) return;
  try {
    await sb.from('goals').delete().eq('id', id);
    await loadGoals();
    renderGoals();
    UI.toast('Goal deleted', 'info');
  } catch(e) { UI.toast('Error: ' + e.message, 'error'); }
}

function openGoalModal(id) {
  document.getElementById('gEditId').value = '';
  document.getElementById('goalModalTitle').textContent = 'New Goal';
  document.getElementById('gName').value = '';
  document.getElementById('gTarget').value = '';
  document.getElementById('gDeadline').value = '';
  document.getElementById('gEmoji').value = '';
  document.getElementById('gFundingSource').value = 'total_nw';
  if (id) {
    var g = _goals.find(function(x) { return x.id === id; });
    if (g) {
      document.getElementById('gEditId').value = g.id;
      document.getElementById('goalModalTitle').textContent = 'Edit Goal';
      document.getElementById('gName').value = g.name;
      document.getElementById('gTarget').value = g.target;
      document.getElementById('gDeadline').value = g.deadline ? g.deadline.slice(0,10) : '';
      document.getElementById('gEmoji').value = g.emoji || '';
      document.getElementById('gFundingSource').value = g.fundingSource || 'total_nw';
    }
  }
  openModal('goalModal');
}

function quickStartGoal(title, target, emoji, fundingSource) {
  document.getElementById('gName').value = title;
  document.getElementById('gTarget').value = target;
  document.getElementById('gEmoji').value = emoji;
  document.getElementById('gFundingSource').value = fundingSource || 'total_nw';
  document.getElementById('gDeadline').value = '';
  document.getElementById('gEditId').value = '';
  document.getElementById('goalModalTitle').textContent = 'New Goal';
  openModal('goalModal');
}

async function renderGoals() {
  if (!isGrowth()) return;
  await loadGoals();
  var listEl = document.getElementById('goalsList');
  var emptyState = document.getElementById('goalsEmptyState');
  if (!listEl) return;
  if (!_goals.length) {
    listEl.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }
  listEl.style.display = 'flex';
  if (emptyState) emptyState.style.display = 'none';
  // Compute both funding sources
  var totalNw = assets.filter(function(a){return a.cat!=='liability';}).reduce(function(s,a){return s+a.value;},0) - assets.filter(function(a){return a.cat==='liability';}).reduce(function(s,a){return s+a.value;},0);
  var liquidCash = assets.filter(function(a){return a.cat==='cash';}).reduce(function(s,a){return s+a.value;},0);
  var now = new Date();

  listEl.innerHTML = _goals.map(function(g) {
    // Use the appropriate funding source for current progress
    var currentAmount = g.fundingSource === 'liquid_only' ? liquidCash : totalNw;
    var pct = g.target > 0 ? Math.min(Math.round((currentAmount / g.target) * 100), 100) : 0;
    var barColor = pct >= 100 ? '#34d399' : pct >= 50 ? '#f4c553' : pct >= 25 ? '#f97316' : '#f87171';
    var remaining = Math.max(0, g.target - currentAmount);
    var fundingLabel = g.fundingSource === 'liquid_only' ? 'Tracking: Liquid Cash' : 'Tracking: Net Worth';

    // ── Time countdown ──────────────────────────────────
    var deadlineText = '';
    var pacingHTML = '';
    if (g.deadline) {
      var dl = new Date(g.deadline);
      var diffMs = dl - now;
      var totalDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      var totalMonths = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24 * 30.44)));
      var countdownStr = totalMonths > 0
        ? totalMonths + ' month' + (totalMonths !== 1 ? 's' : '') + ' left'
        : totalDays > 0
          ? totalDays + ' day' + (totalDays !== 1 ? 's' : '') + ' left'
          : 'Overdue';
      deadlineText = ' · Due ' + dl.toLocaleDateString('en', { month:'short', day:'numeric', year:'numeric' }) + ' <span style="color:var(--text-muted);">· ' + countdownStr + '</span>';

      // ── Pacing insight ──────────────────────────────────
      if (remaining > 0 && totalMonths > 0) {
        var monthlyPace = Math.round(remaining / totalMonths);
        pacingHTML = '<div class="goal-pacing"><i class="fas fa-gauge-high"></i> Target Pace: Save <span class="sensitive">' + fmtAmt(monthlyPace) + '</span>/month to stay on track.</div>';
      } else if (remaining > 0 && totalDays > 0) {
        var dailyPace = Math.round(remaining / totalDays);
        pacingHTML = '<div class="goal-pacing"><i class="fas fa-gauge-high"></i> Target Pace: Save <span class="sensitive">' + fmtAmt(dailyPace) + '</span>/day to stay on track.</div>';
      }
    }

    // ── Emoji badge ──────────────────────────────────────
    var emoji = g.emoji || '🎯';

    return '<div class="kpi-card goal-card">' +
      // Emoji badge + actions (top-right cluster)
      '<div class="goal-card-header">' +
        '<span class="goal-badge">' + emoji + '</span>' +
        '<div class="goal-card-actions">' +
          '<span class="mono goal-pct" style="color:' + barColor + ';">' + pct + '%</span>' +
          '<button class="icon-btn edit" onclick="openGoalModal(\'' + g.id + '\')"><i class="fas fa-pen-to-square"></i></button>' +
          '<button class="icon-btn del" onclick="deleteGoal(\'' + g.id + '\')"><i class="fas fa-trash"></i></button>' +
        '</div>' +
      '</div>' +
      // Title + amounts
      '<div class="goal-card-body">' +
        '<div class="goal-card-name">' + g.name + '</div>' +
        '<div class="goal-card-amounts"><span class="sensitive">' + fmt(currentAmount) + '</span> of <span class="sensitive">' + fmt(g.target) + '</span>' + deadlineText + '</div>' +
      '</div>' +
      // Progress bar
      '<div class="goal-bar-track"><div class="goal-bar-fill" style="width:' + pct + '%;background:' + barColor + ';"></div></div>' +
      // Remaining + pacing
      '<div class="goal-card-footer">' +
        (remaining > 0
          ? '<div class="goal-remaining"><span class="sensitive">' + fmt(remaining) + '</span> remaining to reach goal</div>'
          : '<div class="goal-remaining" style="color:#34d399;"><i class="fas fa-circle-check"></i> Goal reached!</div>') +
        pacingHTML +
        '<div class="goal-funding-source">' + fundingLabel + '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

// ══ AUDIT LOG ══════════════════════════════════════════════════════
async function logAudit(action, entityType, entityName, details) {
  if (!isGrowth()) return;
  // Debounce login audit: only log once per 30 minutes (persists across page loads)
  if (action === 'login') {
    var last = parseInt(localStorage.getItem('kv-last-login-audit') || '0');
    if (Date.now() - last < 30 * 60 * 1000) return;
    localStorage.setItem('kv-last-login-audit', Date.now().toString());
  }
  try {
    await sb.from('audit_log').insert({ user_id: currentUser.id, action: action, entity_type: entityType, entity_name: entityName, details: details || null });
  } catch(e) { /* silent */ }
}

// ══ RENDER ALL ════════════════════════════════════════════════════
function renderAll() {
  renderKPIs();
  renderTable();
  renderDonut();
  renderBar();
  renderHistory();
  renderActivity();
  updatePlanUI();
}


// ══ MOBILE NAV ════════════════════════════════════════════════
let _pageHistory = ['dashboard'];

function goBackMobile() {
  if (_pageHistory.length > 1) {
    _pageHistory.pop(); // remove current
    const prev = _pageHistory[_pageHistory.length - 1];
    _pageHistory.pop(); // switchPage will re-push it
    switchPage(prev);
  } else {
    switchPage('dashboard');
  }
}

function openMobileMenu()  { document.getElementById('mobileMenu').style.display = 'flex'; document.body.style.overflow = 'hidden'; }
function closeMobileMenu() { document.getElementById('mobileMenu').style.display = 'none'; document.body.style.overflow = ''; }

// Patch switchPage to track history and show/hide back button
const _origSwitchPage = switchPage;
window.switchPage = function(name) {
  _pageHistory.push(name);
  if (_pageHistory.length > 10) _pageHistory.shift();
  _origSwitchPage(name);
  // Show back button on mobile when not on dashboard
  const backBtn = document.getElementById('mobileBackBtn');
  if (backBtn) {
    backBtn.style.display = (window.innerWidth < 900 && name !== 'dashboard') ? 'flex' : 'none';
  }
};

// Show mobile nav after app loads
function showMobileNav() {
  if (window.innerWidth < 900) {
    const nav = document.getElementById('mobileBottomNav');
    if (nav) nav.style.display = 'block';
  }
}

// ══ BOOT ══════════════════════════════════════════════════════════
handleCatChange();
Security.injectStyles();
Calculators.init();

// Inject auth UI styles
(function() {
  const s = document.createElement('style');
  s.textContent = `
    .auth-input {
      width:100%;background:var(--surface2);border:1px solid var(--border);
      border-radius:8px;color:var(--text);padding:10px 13px;
      font-family:'DM Sans',sans-serif;font-size:14px;outline:none;
      transition:border-color .2s;box-sizing:border-box;
    }
    .auth-input:focus { border-color:var(--accent); }
    .auth-input::placeholder { color:var(--muted); }
    .auth-btn-primary {
      width:100%;padding:12px;background:linear-gradient(135deg,#f97316,#ea580c);
      color:#fff;border:none;border-radius:10px;font-family:'DM Sans',sans-serif;
      font-size:14px;font-weight:600;cursor:pointer;transition:opacity .2s;display:block;
    }
    .auth-btn-primary:hover { opacity:.9; }
    .auth-btn-primary:disabled { opacity:.6;cursor:not-allowed; }
    .auth-btn-secondary {
      width:100%;padding:10px;background:transparent;border:1px solid var(--border);
      border-radius:10px;font-family:'DM Sans',sans-serif;font-size:13px;
      color:var(--text-dim);cursor:pointer;display:block;
    }
    .auth-btn-google {
      width:100%;display:flex;align-items:center;justify-content:center;gap:10px;
      padding:11px;background:var(--surface2);border:1px solid var(--border);
      border-radius:10px;color:var(--text);font-family:'DM Sans',sans-serif;
      font-size:14px;font-weight:500;cursor:pointer;transition:all .2s;
    }
    .auth-btn-google:hover { border-color:var(--accent); }
    .auth-btn-google:disabled { opacity:.6;cursor:not-allowed; }
    .auth-divider {
      display:flex;align-items:center;gap:12px;margin:16px 0;
    }
    .auth-divider::before,.auth-divider::after {
      content:'';flex:1;height:1px;background:var(--border);
    }
    .auth-divider span { font-size:12px;color:var(--muted); }
  `;
  document.head.appendChild(s);
})();

// ── Session boot — simple and reliable ──────────────────────
// Show loading immediately
showLoading('Loading…');

async function doBootWithSession(session, source) {
  if (bootDone) return;
  console.log('[Boot]', source, session?.user?.email || 'no session');

  if (!session?.user) {
    showAuth();
    return;
  }

  bootDone = true;
  currentUser = session.user;
  setUserUI(currentUser);
  showLoading('Loading your vault…');

  try {
    await Promise.all([loadSubscription(), loadAssets(), loadHistory()]);
    loadGoals(); // Non-blocking
    console.log('[Boot] userPlan after load:', userPlan, '| email:', currentUser.email);
    Security.init(isPro());
    renderAll();
    showApp();
    initAllSliderTracks();
    updateCurrencyLabels();
    checkAppVersion();
    if (source === 'SIGNED_IN') {
      const name = currentUser.user_metadata?.full_name ||
                   currentUser.user_metadata?.given_name ||
                   currentUser.email?.split('@')[0] || 'there';
      UI.toast('Welcome back, ' + name + '! \uD83D\uDC4B', 'success');
      logAudit('login', 'session', currentUser.email, '');
      sendLoginAlert();
    }
  } catch (err) {
    console.error('[Boot] Error:', err);
    bootDone = false;
    showAuth();
    setAuthError('Failed to load vault. Please sign in again.');
  }
}

// Step 1 — Try getSession() directly (most reliable, works on all browsers)
sb.auth.getSession().then(({ data: { session }, error }) => {
  if (error) console.warn('[Boot] getSession error:', error.message);
  if (!bootDone) doBootWithSession(session, 'getSession');
}).catch(err => {
  console.warn('[Boot] getSession threw:', err.message);
  if (!bootDone) showAuth();
});

// Step 2 — Safety net: if still spinning after 10s, give up and show login
setTimeout(function() {
  if (!bootDone) {
    console.warn('[Boot] 6s timeout — showing auth');
    showAuth();
  }
}, 6000);

// Step 3 — Auth state listener for sign-in / sign-out events
sb.auth.onAuthStateChange((event, session) => {
  console.log('[Auth event]', event);
  if (event === 'SIGNED_IN' && !bootDone) {
    doBootWithSession(session, 'SIGNED_IN');
  }
  if (event === 'SIGNED_IN' && bootDone) {
    // Already booted — just refresh user info
    currentUser = session.user;
    setUserUI(currentUser);
  }
  if (event === 'TOKEN_REFRESHED') {
    setSyncState('synced', 'Session active');
  }
  if (event === 'SIGNED_OUT') {
    bootDone = false;
    currentUser = null;
    assets = []; nwHistory = [];
    renderAll();
    showAuth();
  }
  if (event === 'PASSWORD_RECOVERY') {
    // User clicked reset link — show them a password update UI
    UI.toast('Enter your new password in Settings after signing in.', 'info');
  }
});

// Step 4 — Re-check when tab becomes visible (fixes "20 min idle" bug)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && bootDone && currentUser) {
    sb.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        bootDone = false;
        currentUser = null;
        showAuth();
        UI.toast('Session expired. Please sign in again.', 'info');
      } else {
        setSyncState('synced', 'Active');
      }
    }).catch(() => {});
  }
});

// Step 5 — Keep-alive every 8 minutes
setInterval(() => {
  if (bootDone && currentUser) {
    sb.auth.getSession().catch(() => {});
  }
}, 8 * 60 * 1000);

// Step 6 — Refresh slider tracks on theme change
(function() {
  var _orig = applyTheme;
  applyTheme = function(t) {
    _orig(t);
    setTimeout(function() { initAllSliderTracks(); }, 80);
  };
})();

// Step 7 — Re-render investments page on resize (mobile/desktop switch)
var _investResizeTimer;
window.addEventListener('resize', function() {
  clearTimeout(_investResizeTimer);
  _investResizeTimer = setTimeout(function() {
    var invPage = document.getElementById('page-investments');
    if (invPage && invPage.classList.contains('active')) {
      _investActivePill = 'all'; // reset to aggregated when crossing breakpoint
      renderInvestmentPage();
    }
  }, 250);
});