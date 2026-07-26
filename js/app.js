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
  // Remove any lingering prompt input
  var oldInput = document.getElementById('confirmInput');
  if (oldInput) oldInput.remove();
  document.getElementById('confirmMsg').style.display = '';

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

function showPrompt(title, msg, placeholder, okText, icon) {
  // Create a text input inside the confirm modal
  var input = document.createElement('input');
  input.type = 'text';
  input.id = 'confirmInput';
  input.placeholder = placeholder || '';
  input.style.cssText = 'width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:14px;color:var(--text);font-family:inherit;margin-bottom:16px;text-align:center;';
  input.maxLength = 40;

  return new Promise(function(resolve) {
    document.getElementById('confirmIcon').textContent = icon || '✏️';
    document.getElementById('confirmTitle').textContent = title || 'Enter value';
    document.getElementById('confirmMsg').textContent = msg || '';
    document.getElementById('confirmMsg').style.display = msg ? '' : 'none';
    document.getElementById('confirmOk').textContent = okText || 'Save';
    var okBtn = document.getElementById('confirmOk');
    okBtn.style.background = 'var(--accent)';
    okBtn.style.color = '#fff';
    okBtn.style.border = 'none';

    // Insert input before the button row
    var btnRow = document.getElementById('confirmOk').parentNode;
    btnRow.parentNode.insertBefore(input, btnRow);

    function cleanup(val) {
      closeModal('confirmModal');
      document.getElementById('confirmCancel').onclick = null;
      document.getElementById('confirmOk').onclick = null;
      if (input.parentNode) input.remove();
      resolve(val);
    }
    document.getElementById('confirmCancel').onclick = function() { cleanup(null); };
    document.getElementById('confirmOk').onclick = function() { cleanup(input.value.trim() || null); };
    // Submit on Enter
    input.addEventListener('keydown', function(e) { if (e.key === 'Enter') document.getElementById('confirmOk').click(); });
    openModal('confirmModal');
    setTimeout(function() { input.focus(); }, 150);
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
const isGrowth   = () => userPlan === 'growth' || userPlan === 'pro' || userPlan === 'elite';
const isPro      = () => userPlan === 'pro'  || userPlan === 'elite';
const isElite    = () => userPlan === 'elite';
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
  stress:    { lock: 'stressLock',    content: 'stressContent',    tier: 'elite' },
  ai:        { lock: 'aiLock',        content: 'aiContent',        tier: 'elite' },
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
  if (name === 'tax')       { runSavingsRate(); return; }
  if (name === 'optimizer') { runOptimizer();   return; }
  if (name === 'score')     { renderScore();    return; }
  if (name === 'currency')  { renderCurrency(); return; }
  if (name === 'goals')     { renderGoals();    return; }
  if (name === 'stress')    { runStressTest();  return; }
  if (name === 'ai')        { updateAIUsage();  return; }
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

    if (byEmail?.plan === 'elite') {
      userPlan = 'elite';
      console.log('[Sub] Elite confirmed by email:', currentUser.email);
      return;
    }
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

    if (byId?.plan === 'elite') {
      userPlan = 'elite';
      console.log('[Sub] Elite confirmed by user_id');
      sb.from('subscriptions').update({ email: currentUser.email })
        .eq('user_id', currentUser.id).then(function(){});
      return;
    }
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
    if (isElite()) planEl.textContent = 'Elite Plan ⬡';
    else if (isPro()) planEl.textContent = 'Pro Plan ⬡';
    else if (isGrowth()) planEl.textContent = 'Growth Plan ⬡';
    else planEl.textContent = 'Free Plan';
  }
  // Show report button for elite users
  var reportBtn = document.getElementById('reportBtn');
  if (reportBtn) reportBtn.style.display = isElite() ? 'inline-block' : 'none';

  // Apply custom branding (Elite)
  applyBranding();

  // Show upgrade banner for free users only
  if (banner) banner.style.display = (userPlan === 'free') ? 'flex' : 'none';

  // Score KPI overlay — visible to free, hidden for growth+
  var scoreLockOverlay = document.getElementById('scoreLockOverlay');
  if (scoreLockOverlay) scoreLockOverlay.style.display = isGrowth() ? 'none' : 'flex';

  // Lock icons — hide based on actual tier
  document.querySelectorAll('.pro-lock').forEach(function(el) {
    var tier = el.getAttribute('data-tier') || 'growth';
    if (tier === 'elite') el.style.display = isElite() ? 'none' : 'inline';
    else if (tier === 'pro') el.style.display = isPro() ? 'none' : 'inline';
    else el.style.display = isGrowth() ? 'none' : 'inline';
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
  if (!data) { setSyncState('error', 'Error'); console.error('loadAssets: data is null'); return; }
  assets = data.map(r => ({
    id: r.id, name: r.name, cat: r.cat, value: parseFloat(r.value) || 0,
    notes: r.notes || '', principal: r.principal ? parseFloat(r.principal) : null,
    rate: r.rate ? parseFloat(r.rate) : null, years: r.years ? parseFloat(r.years) : null,
    fv: parseFloat(r.fv) || 0, interest: parseFloat(r.interest) || 0,
    custom_cat: r.custom_cat || null, start_date: r.start_date || null,
    depreciationType: r.depreciation_type || null, depreciationRate: r.depreciation_rate || null,
    usefulLife: r.useful_life || null, salvageValue: r.salvage_value || null,
    originalCost: r.original_cost || null, depreciationStart: r.depreciation_start || null,
  }));
  setSyncState('synced', 'Synced');
}

var _historyMonths = null;

async function loadHistory(months) {
  if (months === undefined) months = _historyMonths;
  var query = sb.from('nw_history').select('*').order('created_at', { ascending: false });
  if (months === 'recent') {
    query = query.limit(30);
  } else if (months) {
    var since = new Date();
    since.setMonth(since.getMonth() - months);
    query = query.gte('created_at', since.toISOString());
  } else {
    query = query.limit(isGrowth() ? 10000 : 30);
  }
  var { data } = await query;
  if (data) {
    nwHistory = data.reverse().map(r => ({ id: r.id, nw: parseFloat(r.nw) || 0, ts: r.label }));
  }
  renderHistory();
}

function switchHistoryRange(val) {
  var sel = document.getElementById('historyRange');
  var lbl = document.getElementById('historyRangeLabel');
  if (val === 'recent') {
    _historyMonths = 'recent';
    if (lbl) lbl.textContent = 'Recent (30 entries)';
  } else if (val === 'all') {
    _historyMonths = null;
    if (lbl) lbl.textContent = 'All Time';
  } else {
    _historyMonths = parseInt(val);
    if (lbl) lbl.textContent = 'Last ' + _historyMonths + ' Months';
  }
  loadHistory();
}

function initHistoryUI() {
  var sel = document.getElementById('historyRange');
  var lbl = document.getElementById('historyRangeLabel');
  if (isGrowth()) {
    _historyMonths = 'recent';
    if (sel) { sel.style.display = 'inline-block'; sel.value = 'recent'; }
    if (lbl) lbl.textContent = 'Recent (30 entries)';
  } else {
    if (sel) sel.style.display = 'none';
    if (lbl) lbl.textContent = 'Free: 30 snapshots';
  }
}

async function dbInsert(a) {
  const { data, error } = await sb.from('assets').insert({
    user_id: currentUser.id, name: a.name, cat: a.cat, value: a.value,
    notes: a.notes || null, principal: a.principal || null, rate: a.rate || null,
    years: a.years || null, fv: a.fv || 0, interest: a.interest || 0,
    custom_cat: a.custom_cat || null, start_date: a.start_date || null,
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
    custom_cat: a.custom_cat || null, start_date: a.start_date || null,
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
  var liabWrap    = document.getElementById('liabToggleWrap');
  var deprecWrap  = document.getElementById('deprecToggleWrap');
  var customWrap  = document.getElementById('fCustomCatWrap');
  if (investWrap) investWrap.style.display = cat === 'investment' ? 'block' : 'none';
  if (liabWrap)   liabWrap.style.display   = cat === 'liability'  ? 'block' : 'none';
  if (deprecWrap) deprecWrap.style.display = (cat === 'physical' && isPro()) ? 'block' : 'none';
  if (customWrap) customWrap.style.display = cat === 'custom' ? 'block' : 'none';
  // Collapse panels when category changes away
  if (cat !== 'investment') {
    var p = document.getElementById('investPanel'); if (p) p.classList.remove('open');
    var c = document.getElementById('investToggle'); if (c) c.classList.remove('active');
    var prev = document.getElementById('fPreview'); if (prev) prev.style.display = 'none';
  }
  if (cat !== 'liability') {
    var lp = document.getElementById('liabPanel'); if (lp) lp.classList.remove('open');
    var lc = document.getElementById('liabToggle'); if (lc) lc.classList.remove('active');
  }
  if (cat !== 'physical') {
    var dp = document.getElementById('deprecPanel'); if (dp) dp.classList.remove('open');
    var dc = document.getElementById('deprecToggle'); if (dc) dc.classList.remove('active');
  }
}

function calcPreview() {
  const p = parseFloat(document.getElementById('fPrincipal').value);
  const r = parseFloat(document.getElementById('fRate').value) / 100;
  var tRaw = parseFloat(document.getElementById('fTerm').value) || parseFloat(document.getElementById('fYears')?.value);
  var unit = (document.getElementById('fTermUnit')?.value) || 'years';
  var t = unit === 'months' ? tRaw / 12 : tRaw;
  var startDate = document.getElementById('fStartDate')?.value;

  // ── Maturity countdown ──────────────────────────────────
  var maturityEl = document.getElementById('fMaturity');
  if (maturityEl && startDate && tRaw > 0) {
    var start = new Date(startDate + 'T00:00:00');
    var maturity = new Date(start);
    if (unit === 'months') maturity.setMonth(maturity.getMonth() + tRaw);
    else maturity.setFullYear(maturity.getFullYear() + tRaw);
    var now = new Date();
    maturity.setHours(0,0,0,0);
    now.setHours(0,0,0,0);
    var diffMs = maturity - now;
    var diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    var diffMonths = Math.round(diffDays / 30.44);
    if (diffDays < 0) {
      maturityEl.innerHTML = '<span style="color:#f87171;"><i class="fas fa-circle-check"></i> Matured ' + Math.abs(diffMonths) + ' month' + (Math.abs(diffMonths)!==1?'s':'') + ' ago</span>';
    } else if (diffDays === 0) {
      maturityEl.innerHTML = '<span style="color:#34d399;">Matures today</span>';
    } else {
      var label = diffMonths >= 1
        ? diffMonths + ' month' + (diffMonths!==1?'s':'') + ' remaining'
        : diffDays + ' day' + (diffDays!==1?'s':'') + ' remaining';
      maturityEl.innerHTML = '<span style="color:#60a5fa;"><i class="fas fa-clock"></i> ' + label + '</span>';
    }
  } else if (maturityEl) {
    maturityEl.innerHTML = '';
  }

  var prev = document.getElementById('fPreview');
  if (!prev) return;
  if (!p || !r || !t || p <= 0) { prev.style.display = 'none'; return; }
  var fv = p * Math.pow(1 + r, t);
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
  const customCat = cat === 'custom' ? (document.getElementById('fCustomCat')?.value?.trim() || null) : null;
  const value = parseFloat(document.getElementById('fValue').value);
  const notes = document.getElementById('fNotes').value.trim();
  const errEl = document.getElementById('formError');
  if (errEl) errEl.textContent = '';

  if (!name)                { if (errEl) errEl.textContent = '⚠ Please enter a name.'; return; }
  if (isNaN(value)||value<0){ if (errEl) errEl.textContent = '⚠ Enter a valid value.'; return; }

  // Convert display currency → native (storage) currency
  var storedValue = Math.round(toStored(value));

  let principal = null, rate = null, years = null, fv = 0, interest = 0, startDate = null;
  if (cat === 'investment') {
    principal = parseFloat(document.getElementById('fPrincipal').value) || null;
    rate      = parseFloat(document.getElementById('fRate').value)      || null;
    var tRaw  = parseFloat(document.getElementById('fTerm').value) || parseFloat((document.getElementById('fYears')||{}).value) || null;
    var unit  = (document.getElementById('fTermUnit') || {}).value || 'years';
    years     = tRaw ? (unit === 'months' ? tRaw / 12 : tRaw) : null;
    startDate = document.getElementById('fStartDate')?.value || null;
    if (principal && rate && years) {
      var storedPrincipal = Math.round(toStored(principal));
      const p = Calculators.compoundInterest(storedPrincipal, rate, years);
      fv = p.fv; interest = p.interest;
    }
  } else if (cat === 'liability') {
    var liabRateEl = document.getElementById('fLiabRate');
    rate = liabRateEl ? (parseFloat(liabRateEl.value) || null) : null;
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
    var savedStartDate = startDate || null;
    const asset = { name, cat, value: storedValue, notes, principal: savedPrincipal, rate, years, fv, interest,
      custom_cat: customCat, start_date: savedStartDate,
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
    ['fName','fValue','fNotes','fPrincipal','fRate','fTerm','fStartDate','fUsefulLife','fSalvage','fDeprecRate','fLiabRate'].forEach(function(id) { var el = document.getElementById(id); if(el) el.value = ''; });
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
  var eLiabRate = document.getElementById('eLiabRate');
  if (eLiabRate) eLiabRate.value = a.rate || '';
  var storedYears = a.years || 0;
  if (storedYears > 0 && storedYears < 1) {
    document.getElementById('eTerm').value     = Math.round(storedYears * 12);
    document.getElementById('eTermUnit').value  = 'months';
  } else {
    document.getElementById('eTerm').value     = storedYears || '';
    document.getElementById('eTermUnit').value  = 'years';
  }
  document.getElementById('eStartDate').value = a.start_date ? a.start_date.slice(0,10) : '';
  document.getElementById('eCustomCat').value = a.custom_cat || '';
  if (a.custom_cat) document.getElementById('eCustomCatWrap').style.display = 'block';
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
  const liabWrap   = document.getElementById('eLiabWrap');
  const deprecWrap = document.getElementById('eDeprecWrap');
  const customWrap = document.getElementById('eCustomCatWrap');
  if (investWrap) investWrap.style.display = cat === 'investment' ? 'block' : 'none';
  if (liabWrap)   liabWrap.style.display   = cat === 'liability'  ? 'block' : 'none';
  if (deprecWrap) deprecWrap.style.display = (cat === 'physical' && isPro()) ? 'block' : 'none';
  if (customWrap) customWrap.style.display = cat === 'custom' ? 'block' : 'none';
}

function calcEditProj() {
  const p = parseFloat(document.getElementById('ePrincipal').value);
  const r = parseFloat(document.getElementById('eRate').value) / 100;
  var tRaw = parseFloat(document.getElementById('eTerm').value) || parseFloat((document.getElementById('eYears')||{}).value);
  var unit = (document.getElementById('eTermUnit')||{}).value || 'years';
  var t = unit === 'months' ? tRaw / 12 : tRaw;
  var startDate = (document.getElementById('eStartDate')||{}).value;

  // ── Maturity countdown ──────────────────────────────────
  var maturityEl = document.getElementById('eMaturity');
  if (maturityEl && startDate && tRaw > 0) {
    var start = new Date(startDate + 'T00:00:00');
    var maturity = new Date(start);
    if (unit === 'months') maturity.setMonth(maturity.getMonth() + tRaw);
    else maturity.setFullYear(maturity.getFullYear() + tRaw);
    var now = new Date();
    maturity.setHours(0,0,0,0);
    now.setHours(0,0,0,0);
    var diffMs = maturity - now;
    var diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    var diffMonths = Math.round(diffDays / 30.44);
    if (diffDays < 0) {
      maturityEl.innerHTML = '<span style="color:#f87171;"><i class="fas fa-circle-check"></i> Matured ' + Math.abs(diffMonths) + ' month' + (Math.abs(diffMonths)!==1?'s':'') + ' ago</span>';
    } else if (diffDays === 0) {
      maturityEl.innerHTML = '<span style="color:#34d399;">Matures today</span>';
    } else {
      var label = diffMonths >= 1
        ? diffMonths + ' month' + (diffMonths!==1?'s':'') + ' remaining'
        : diffDays + ' day' + (diffDays!==1?'s':'') + ' remaining';
      maturityEl.innerHTML = '<span style="color:#60a5fa;"><i class="fas fa-clock"></i> ' + label + '</span>';
    }
  } else if (maturityEl) {
    maturityEl.innerHTML = '';
  }

  var prev = document.getElementById('eProj');
  if (!prev) return;
  if (!p || !r || !t) { prev.style.display = 'none'; return; }
  var fv = p * Math.pow(1 + r, t);
  prev.style.display = 'block';
  prev.innerHTML = 'FV: <span style="color:var(--gold);">' + fmt(fv) + '</span> &nbsp;·&nbsp; Interest: <span style="color:var(--green);">' + fmt(fv - p) + '</span>';
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
  let rate        = parseFloat(document.getElementById('eRate').value)        || null;
  var tRaw        = parseFloat(document.getElementById('eTerm').value) || parseFloat((document.getElementById('eYears')||{}).value) || null;
  var unit        = (document.getElementById('eTermUnit')||{}).value || 'years';
  const years     = tRaw ? (unit === 'months' ? tRaw / 12 : tRaw) : null;
  const eStartDate = document.getElementById('eStartDate')?.value || new Date().toISOString().slice(0,10);
  const customCat = cat === 'custom' ? (document.getElementById('eCustomCat')?.value?.trim() || null) : null;
  if (cat === 'liability') {
    var eLiabRate = document.getElementById('eLiabRate');
    rate = eLiabRate ? (parseFloat(eLiabRate.value) || null) : null;
  }
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
    var savedStartDate = eStartDate || new Date().toISOString().slice(0,10);
    Object.assign(a, {
      name, cat, value: storedValue, notes, principal, rate, years, fv, interest,
      custom_cat: customCat, start_date: savedStartDate,
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
    var isCustom = a.cat === 'custom' && a.custom_cat;
    var catObj = isCustom ? { i: '', l: a.custom_cat } : (CAT[a.cat] || { l: a.cat || 'Unknown' });
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
    const isCustom = a.cat === 'custom' && a.custom_cat;
    const catObj   = isCustom ? { i: '', l: a.custom_cat } : (CAT[a.cat] || { l: a.cat || 'Unknown' });
    const isLiab = a.cat === 'liability';
    const depStr = a.depreciationType ? `<span style="font-size:10px;color:var(--text-muted);">[${a.depreciationType}]</span>` : '';
    const proj   = a.fv > 0 ? `<span class="mono sensitive" style="color:var(--gold);">${fmt(a.fv)}</span>` : '<span style="color:var(--muted);">—</span>';
    const intc   = a.interest > 0 ? `<span class="gain-pill sensitive">+${fmt(a.interest)}</span>` : '<span style="color:var(--muted);">—</span>';
    const ratec  = a.rate && a.years ? `<span class="mono" style="color:var(--text-dim);font-size:11px;">${a.rate}%/${a.years}yr</span>` : '<span style="color:var(--muted);">—</span>';
    return `<tr class="animate-in">
      <td style="font-weight:500;">${a.name} ${depStr}</td>
      <td><span class="badge" style="${isCustom ? 'background:rgba(168,85,247,0.12);color:#c084fc;' : (BADGE[a.cat] || '')}">${catObj.i} ${catObj.l}</span></td>
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

  // ── Helper: compute maturity status ────────────────────
  function formatTimeLeft(diffDays) {
    var abs = Math.abs(diffDays);
    var totalMonths = Math.floor(abs / 30.44);
    var d = Math.round(abs - totalMonths * 30.44);
    if (d >= 31) { totalMonths++; d = 0; }
    if (totalMonths >= 24) {
      var y = Math.floor(totalMonths / 12);
      var m = totalMonths % 12;
      var parts = [];
      if (y > 0) parts.push(y + 'yr');
      if (m > 0) parts.push(m + 'mo');
      return parts.join(', ');
    }
    if (totalMonths > 0) {
      return totalMonths + 'mo' + (d > 0 ? ', ' + d + 'd' : '');
    }
    return d + 'd';
  }

  function getMaturityHTML(a) {
    if (!a.years || a.years <= 0) return '—';
    var start = (a.start_date || a.created_at) ? new Date(a.start_date || a.created_at) : new Date();
    var totalMonths = Math.round(a.years * 12); // precise months from stored years
    var maturity = new Date(start);
    maturity.setMonth(maturity.getMonth() + totalMonths);
    var now = new Date();
    // Strip time for day-level comparison
    maturity.setHours(0,0,0,0);
    now.setHours(0,0,0,0);
    var diffMs = maturity - now;
    var diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      return '<span style="font-size:10px;color:#f87171;">Matured ' + formatTimeLeft(diffDays) + ' ago</span>';
    } else if (diffDays === 0) {
      return '<span style="font-size:10px;color:#34d399;">Today</span>';
    } else {
      return '<span style="font-size:10px;color:#60a5fa;">' + formatTimeLeft(diffDays) + ' left</span>';
    }
  }

  // ── Desktop Table ─────────────────────────────────────
  var tbody = document.getElementById('investTableBody');
  if (tbody) {
    tbody.innerHTML = inv.map(a => '<tr>' +
      '<td style="font-weight:500;">' + a.name + '</td>' +
      '<td class="mono sensitive">' + (a.principal ? fmt(a.principal) : '—') + '</td>' +
      '<td class="mono">' + (a.rate ? a.rate + '%' : '—') + '</td>' +
      '<td class="mono">' + (a.years ? a.years + 'yr' : '—') + '</td>' +
      '<td style="white-space:nowrap;">' + getMaturityHTML(a) + '</td>' +
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
          '<div class="invest-card-item"><span class="invest-card-label">Term</span><span class="invest-card-val mono">' + (a.years ? a.years + 'yr' : '—') + ' ' + getMaturityHTML(a) + '</span></div>' +
          '<div class="invest-card-item"><span class="invest-card-label">Current Value</span><span class="invest-card-val">' + fmt(a.value) + '</span></div>' +
          '<div class="invest-card-item"><span class="invest-card-label">Projected FV</span><span class="invest-card-val" style="color:var(--gold);">' + (a.fv > 0 ? fmt(a.fv) : '—') + '</span></div>' +
        '</div>' +
        (a.interest > 0 ? '<div class="invest-card-gain"><span class="gain-pill">+' + fmt(a.interest) + ' interest</span></div>' : '') +
      '</div>';
    }).join('');
  }
}

// ══ SAVINGS RATE ANALYZER ════════════════════════════════════
var _savingsIncMul = 1;
var _savingsExpMul = 1;

function setSavingsIncMul(mul, btn) {
  var slider = document.getElementById('savingsIncome');
  var oldEffective = (parseInt(slider.value) || 0) * _savingsIncMul;
  _savingsIncMul = mul;
  slider.value = Math.round(oldEffective / mul);
  fillSliderTrack(slider);
  document.querySelectorAll('#savingsIncMulChips .toggle-chip').forEach(function(c) { c.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  runSavingsRate();
}
function setSavingsExpMul(mul, btn) {
  var slider = document.getElementById('savingsExpenses');
  var oldEffective = (parseInt(slider.value) || 0) * _savingsExpMul;
  _savingsExpMul = mul;
  slider.value = Math.round(oldEffective / mul);
  fillSliderTrack(slider);
  document.querySelectorAll('#savingsExpMulChips .toggle-chip').forEach(function(c) { c.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  runSavingsRate();
}

function runSavingsRate() {
  if (!isPro()) return;
  var income = (parseInt(document.getElementById('savingsIncome')?.value) || 0) * _savingsIncMul;
  var expenses = (parseInt(document.getElementById('savingsExpenses')?.value) || 0) * _savingsExpMul;
  var savings = Math.max(0, income - expenses);
  var savingsPct = income > 0 ? Math.round((savings / income) * 100) : 0;

  // KPI cards
  var pctColor = savingsPct >= 25 ? '#34d399' : savingsPct >= 15 ? '#f4c553' : '#f87171';
  var pctLabel = savingsPct >= 25 ? 'Aggressive' : savingsPct >= 15 ? 'Solid' : 'Tight';
  var pctEl = document.getElementById('savingsRatePct');
  if (pctEl) { pctEl.textContent = savingsPct + '%'; pctEl.style.color = pctColor; }
  var lblEl = document.getElementById('savingsRateLabel');
  if (lblEl) { lblEl.textContent = pctLabel; lblEl.style.color = pctColor; }
  var monEl = document.getElementById('savingsMonthly'); if (monEl) monEl.textContent = fmt(savings);
  var annEl = document.getElementById('savingsAnnual'); if (annEl) annEl.textContent = fmt(savings * 12);

  // What-If Optimizer
  var opt5pct = expenses * 0.05;
  var optEl = document.getElementById('savingsOptimizer');
  if (optEl) {
    if (expenses > 0) {
      optEl.innerHTML = 'Reducing monthly expenses by <strong style="color:var(--accent);">5%</strong> unlocks an extra <strong style="color:#34d399;">' + fmt(opt5pct) + '/month</strong> (<strong style="color:#34d399;">' + fmt(opt5pct * 12) + '/year</strong>) — that\'s ' + (income > 0 ? Math.round((opt5pct / income) * 100) : 0) + '% more going straight to savings.';
    } else {
      optEl.innerHTML = 'Set your monthly expenses above to see how small cuts can boost your savings rate.';
    }
  }

  // 50/30/20 Budget Bar
  var barEl = document.getElementById('savings503020');
  if (barEl && income > 0) {
    barEl.innerHTML =
      '<div style="display:flex;height:32px;border-radius:8px;overflow:hidden;margin-bottom:8px;">' +
        '<div style="width:' + Math.round((Math.min(savingsPct, 20)/20)*33) + '%;background:#34d399;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;min-width:' + (savingsPct > 0 ? '30px' : '0') + ';">' + (savingsPct > 0 ? savingsPct + '%' : '') + '</div>' +
        '<div style="flex:1;background:#1a1a1e;display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--text-muted);">50% Needs</div>' +
        '<div style="flex:1;background:#222;display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--text-muted);">30% Wants</div>' +
      '</div>' +
      '<div style="font-size:11px;color:var(--text-dim);line-height:1.6;">' +
        (savingsPct >= 20 ? '<span style="color:#34d399;"><i class="fas fa-circle-check"></i> You\'re hitting the 20% savings benchmark!</span>' :
         savingsPct >= 10 ? '<span style="color:#f4c553;">You\'re at ' + savingsPct + '% — 20% is the recommended target.</span>' :
         '<span style="color:#f87171;">At ' + savingsPct + '% you\'re below the 20% benchmark. Reducing expenses by just 5% could get you to ' + (income > 0 ? Math.round(((savings + opt5pct) / income) * 100) : 0) + '%.</span>') +
      '</div>';
  } else if (barEl) {
    barEl.innerHTML = '<div style="font-size:13px;color:var(--text-muted);text-align:center;padding:16px;">Set your income above to see the 50/30/20 breakdown.</div>';
  }

  // Smart Allocation Benchmarks
  updateBenchmarks(income);
}

function updateBenchmarks(income) {
  var benchmarks = {
    'bm-housing':    { val: income * 0.30 },
    'bm-car':        { val: income * 3 },
    'bm-emergency':  { val: income * 4 },
    'bm-essentials': { val: income * 0.55 },
    'bm-invest':     { val: income * 0.10 },
    'bm-fun':        { val: income * 0.05 },
    'bm-replace':    { val: income * 200 },
  };
  Object.keys(benchmarks).forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.textContent = income > 0 ? fmt(benchmarks[id].val) : '—';
  });
}

function toggleBMTooltip(e, tipId) {
  e.stopPropagation();
  var tip = document.getElementById(tipId);
  if (!tip) return;
  var wasOpen = tip.classList.contains('show');
  // Close all tooltips
  document.querySelectorAll('.bm-tip.show').forEach(function(t) { t.classList.remove('show'); });
  if (!wasOpen) tip.classList.add('show');
}
// Close tooltips on outside click
document.addEventListener('click', function() {
  document.querySelectorAll('.bm-tip.show').forEach(function(t) { t.classList.remove('show'); });
});

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
    var r = (a.rate && a.rate > 0 && a.rate <= 100) ? a.rate : 18;
    return {
      name: a.name, balance: a.value,
      minPayment: Math.max(a.value * 0.02, 1),
      interestRate: r
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

  // Build allocation donut using SVG (positive assets only — liabilities shown separately)
  var donutCash  = total > 0 ? (bycat.cash       / total * 100) : 0;
  var donutPhys  = total > 0 ? (bycat.physical   / total * 100) : 0;
  var donutInv   = total > 0 ? (bycat.investment / total * 100) : 0;
  var segments = [
    { label:'Cash',         pct: donutCash, color:'#60a5fa' },
    { label:'Physical',     pct: donutPhys, color:'#34d399' },
    { label:'Investments',  pct: donutInv,  color:'#f97316' },
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
      '</div>' +
      (bycat.liability > 0 ?
        '<div style="margin-top:10px;padding-top:10px;border-top:1px dashed var(--border);">' +
          '<div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);margin-bottom:6px;">Debt Profile — % of Total Assets</div>' +
          buildAllocBar('⚠️ Liabilities', debtRatio, '#f87171', bycat.liability, '<30%') +
        '</div>' : '') +
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
  var cats = new Set(assets.filter(function(a){return a.cat!=='liability';}).map(function(a){return a.cat;})).size;
  var totalAssets = assets.filter(function(a){ return a.cat !== 'liability'; }).reduce(function(sum,a){ return sum+a.value; }, 0);
  var totalLiab   = assets.filter(function(a){ return a.cat === 'liability'; }).reduce(function(sum,a){ return sum+a.value; }, 0);
  var netWorth    = totalAssets - totalLiab;
  var netPositive = netWorth > 0;
  var margin      = totalAssets > 0 ? (netWorth / totalAssets) * 100 : 0;

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
      target: '3 categories',
      pts: Math.min(cats * 5, 15),
      maxPts: 15,
      status: cats >= 3 ? 'good' : cats >= 2 ? 'warn' : 'bad',
      desc: 'How spread your wealth is across Cash, Physical, and Investments. Liabilities are excluded — more positive asset types = lower risk.'
    },
    {
      label: 'Net Worth Position',
      value: netPositive ? 'Positive (<span class="sensitive">' + fmt(netWorth) + '</span>)' : 'Negative (<span class="sensitive">-' + fmt(Math.abs(netWorth)) + '</span>)',
      target: '>20% margin',
      pts: netWorth <= 0 ? 0 : margin < 5 ? 2 : margin < 20 ? 5 : margin < 50 ? 8 : 10,
      maxPts: 10,
      status: netWorth <= 0 ? 'bad' : margin < 5 ? 'bad' : margin < 20 ? 'warn' : 'good',
      desc: netWorth <= 0 ? 'Your liabilities exceed your assets. Prioritise debt reduction immediately.' :
            margin < 5 ? 'Net worth is positive but razor-thin (under 5% of assets). One setback could push you negative.' :
            margin < 20 ? 'You have a modest buffer. Aim for a stronger cushion to weather financial shocks.' :
            'A solid margin between your assets and debts — strong financial footing.'
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
  var cats      = new Set(assets.filter(function(a){return a.cat!=='liability';}).map(function(a){return a.cat;})).size;
  var hasInvest   = assets.some(function(a){ return a.cat === 'investment'; });
  var hasCompound = assets.some(function(a){ return a.cat === 'investment' && a.fv > 0; });
  var hasLiab     = assets.some(function(a){ return a.cat === 'liability'; });

  if (debt > 50)
    recs.push({ priority:'high', icon:'<i class="fas fa-fire"></i>', title:'Reduce debt urgently',
      desc:'Debt ratio is ' + debt + '% — above 50% is a danger zone. Prioritise debt paydown before new asset purchases. Use the Debt Optimizer to compare Snowball vs Avalanche strategies.' });
  else if (debt > 30)
    recs.push({ priority:'med', icon:'<i class="fas fa-bolt"></i>', title:'Work on debt reduction',
      desc:'At ' + debt + '% debt ratio, you\'re above the 30% threshold. A focused repayment plan could improve your score by up to 16 points.' });

  if (liquid < 5)
    recs.push({ priority:'high', icon:'<i class="fas fa-droplet"></i>', title:'Build emergency fund immediately',
      desc:'Only ' + liquid + '% is liquid — that\'s dangerously low. Aim for at least 10% in accessible cash before expanding any other category. A financial shock could destabilise your portfolio.' });
  else if (liquid < 10)
    recs.push({ priority:'med', icon:'<i class="fas fa-droplet"></i>', title:'Increase liquid reserves',
      desc:'At ' + liquid + '% liquidity, you\'re below the recommended 10–30% range. Top up your liquid cash to cover 3–6 months of expenses as a safety buffer.' });
  else if (liquid > 40)
    recs.push({ priority:'med', icon:'<i class="fas fa-chart-simple"></i>', title:'Put excess cash to work',
      desc:'Over 40% in cash (' + liquid + '%) is losing real value to inflation daily. Consider deploying 10–20% into investments to improve long-term returns.' });

  if (!hasInvest)
    recs.push({ priority:'high', icon:'<i class="fas fa-arrow-trend-up"></i>', title:'Start investing — your wealth is not growing',
      desc:'You have zero investment exposure. Even modest allocations to index funds, fixed income, or crypto can compound significantly over time. Start with as little as ' + Calculators.formatCurrency(Calculators.convertCurrency(100, 'USD', Calculators.getBaseCurrency()), Calculators.getBaseCurrency()) + '.' });
  else if (invest < 15)
    recs.push({ priority:'high', icon:'<i class="fas fa-arrow-trend-up"></i>', title:'Critically low investment allocation',
      desc:'Only ' + invest + '% in investments is well below the 30%+ target. Increasing this is the single biggest lever to raise your Net Worth Score.' });
  else if (invest < 30)
    recs.push({ priority:'med', icon:'<i class="fas fa-arrow-trend-up"></i>', title:'Grow your investment allocation',
      desc:'At ' + invest + '%, you\'re making progress but falling short of the 30–50% target for serious long-term wealth building.' });

  if (!hasCompound)
    recs.push({ priority:'med', icon:'<i class="fas fa-gear"></i>', title:'Add compound interest projections',
      desc:'Log principal, interest rate, and duration on your investments to unlock the Projected Future Value column and see how your money grows over time.' });

  if (cats < 3)
    recs.push({ priority:'med', icon:'<i class="fas fa-bullseye"></i>', title:'Diversify across more asset categories',
      desc:'You only track ' + cats + ' asset type' + (cats === 1 ? '' : 's') + '. A balanced portfolio should span Cash, Physical Assets, and Investments to reduce concentration risk and earn up to 15 bonus points.' });

  if (hasLiab && invest > 0)
    recs.push({ priority:'med', icon:'<i class="fas fa-scale-balanced"></i>', title:'Balance debt paydown with investment',
      desc:'You have both liabilities and investments. Compare your debt interest rate vs your investment returns — if debt costs more than investments earn, prioritise paying it off first.' });

  if (s.score >= 70)
    recs.push({ priority:'good', icon:'<i class="fas fa-trophy"></i>', title:'Strong financial position — keep it up',
      desc:'Your score of ' + s.score + '/100 is excellent. Maintain discipline, review monthly, and consider the FIRE Simulator to model early retirement scenarios.' });

  if (recs.length === 0)
    recs.push({ priority:'good', icon:'<i class="fas fa-circle-check"></i>', title:'Portfolio looks healthy',
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


// ══ Multi-Currency Helpers ════════════════════════════════════
var DEFAULT_FX = ['USD','EUR','GBP','JPY','CNY','INR','CAD','AUD','CHF','NGN','ZAR','GHS','KES','EGP','AED'];
var DEFAULT_KPI = ['USD','EUR','GBP','JPY','NGN'];

function getFXCurrencies() {
  try {
    var saved = JSON.parse(localStorage.getItem('kv-fx-currencies') || 'null');
    if (Array.isArray(saved) && saved.length > 0) return saved;
  } catch(e) {}
  return DEFAULT_FX.slice();
}
function getFXKpiCurrencies() {
  try {
    var saved = JSON.parse(localStorage.getItem('kv-fx-kpi-currencies') || 'null');
    if (Array.isArray(saved) && saved.length > 0) return saved;
  } catch(e) {}
  return DEFAULT_KPI.slice();
}

function saveFXCurrencies() {
  var checks = document.querySelectorAll('#fxCheckboxes input[type=checkbox]');
  var selected = [];
  checks.forEach(function(cb) { if (cb.checked) selected.push(cb.value); });
  localStorage.setItem('kv-fx-currencies', JSON.stringify(selected));
  var kpiChecks = document.querySelectorAll('#fxKpiCheckboxes input[type=checkbox]');
  var kpiSelected = [];
  kpiChecks.forEach(function(cb) { if (cb.checked) kpiSelected.push(cb.value); });
  localStorage.setItem('kv-fx-kpi-currencies', JSON.stringify(kpiSelected));
  document.getElementById('fxCustomizePanel').style.display = 'none';
  renderCurrency();
}

function toggleFXCustomize() {
  var panel = document.getElementById('fxCustomizePanel');
  if (!panel) return;
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  if (panel.style.display === 'block') {
    var selected = getFXCurrencies();
    var kpiSelected = getFXKpiCurrencies();
    var allCodes = Object.keys(Calculators.rates).sort();
    var rateContainer = document.getElementById('fxCheckboxes');
    var kpiContainer = document.getElementById('fxKpiCheckboxes');
    if (rateContainer) {
      rateContainer.innerHTML = allCodes.map(function(code) {
        var checked = selected.indexOf(code) >= 0 ? ' checked' : '';
        return '<label style="display:inline-flex;align-items:center;gap:3px;font-size:12px;color:var(--text-dim);cursor:pointer;padding:2px 6px;background:var(--surface);border:1px solid var(--border);border-radius:6px;">' +
          '<input type="checkbox" value="' + code + '"' + checked + ' style="accent-color:#f97316;"/> ' + code +
        '</label>';
      }).join('');
    }
    if (kpiContainer) {
      kpiContainer.innerHTML = allCodes.map(function(code) {
        var checked = kpiSelected.indexOf(code) >= 0 ? ' checked' : '';
        return '<label style="display:inline-flex;align-items:center;gap:3px;font-size:12px;color:var(--text-dim);cursor:pointer;padding:2px 6px;background:var(--surface);border:1px solid var(--border);border-radius:6px;">' +
          '<input type="checkbox" value="' + code + '"' + checked + ' style="accent-color:#f97316;"/> ' + code +
        '</label>';
      }).join('');
    }
  }
}

// ══ SHARED HOUSEHOLD VAULT ══════════════════════════════════
var _household = null;
var _householdView = false;

async function loadHousehold() {
  if (!currentUser) return;
  try {
    var { data: owned } = await sb.from('households').select('*, household_members(*)').eq('owner_id', currentUser.id).maybeSingle();
    if (owned) { _household = owned; _household.role = 'owner'; return; }
    var { data: member } = await sb.from('household_members').select('*, households(*)').eq('user_id', currentUser.id).maybeSingle();
    if (member) { _household = member.households; _household.role = 'member'; _household.members = [{ user_id: member.user_id }]; return; }
    _household = null;
  } catch(e) { console.warn('[Household] Load error (table may not exist):', e.message); _household = null; }
}

async function createHousehold() {
  if (!isElite()) return;
  try {
    var { data, error } = await sb.from('households').insert({ owner_id: currentUser.id }).select().single();
    if (error) throw error;
    _household = data;
    _household.role = 'owner';
    renderHouseholdUI();
    UI.toast('Household created! Share the invite code.', 'success');
  } catch(e) { UI.toast('Error: ' + e.message, 'error'); }
}

async function joinHousehold() {
  if (!isElite()) return;
  var code = (document.getElementById('householdInviteCode')?.value || '').trim().toLowerCase();
  if (!code) { UI.toast('Enter an invite code', 'info'); return; }
  try {
    var { data: hh } = await sb.from('households').select('*').eq('invite_code', code).maybeSingle();
    if (!hh) { UI.toast('Invalid invite code', 'error'); return; }
    var count = await sb.from('household_members').select('*', { count: 'exact', head: true }).eq('household_id', hh.id);
    if (count >= 3) { UI.toast('Household is full (max 3 members)', 'error'); return; }
    var { error } = await sb.from('household_members').insert({ household_id: hh.id, user_id: currentUser.id });
    if (error) throw error;
    _household = hh;
    _household.role = 'member';
    renderHouseholdUI();
    UI.toast('Joined household!', 'success');
  } catch(e) { UI.toast('Error: ' + e.message, 'error'); }
}

async function leaveHousehold() {
  if (!_household) return;
  try {
    if (_household.role === 'owner') {
      await sb.from('household_members').delete().eq('household_id', _household.id);
      await sb.from('households').delete().eq('id', _household.id);
    } else {
      await sb.from('household_members').delete().eq('household_id', _household.id).eq('user_id', currentUser.id);
    }
    _household = null;
    _householdView = false;
    renderHouseholdUI();
    renderAll();
    UI.toast('Left household', 'info');
  } catch(e) { UI.toast('Error: ' + e.message, 'error'); }
}

async function removeHouseholdMember(userId) {
  if (!_household || _household.role !== 'owner') return;
  try {
    await sb.from('household_members').delete().eq('household_id', _household.id).eq('user_id', userId);
    await loadHousehold();
    renderHouseholdUI();
    UI.toast('Member removed', 'info');
  } catch(e) { UI.toast('Error: ' + e.message, 'error'); }
}

function renderHouseholdUI() {
  var none = document.getElementById('householdNone');
  var active = document.getElementById('householdActive');
  var info = document.getElementById('householdInfo');
  if (!_household) {
    if (none) none.style.display = '';
    if (active) active.style.display = 'none';
    return;
  }
  if (none) none.style.display = 'none';
  if (active) active.style.display = '';
  if (info) {
    var code = _household.invite_code || '—';
    info.innerHTML = '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:12px;">' +
      '<div style="font-size:12px;font-weight:600;margin-bottom:4px;">' + (_household.role === 'owner' ? 'Your Household' : 'Shared Household') + '</div>' +
      '<div style="font-size:13px;color:var(--text-dim);">Invite Code: <strong class="mono" style="color:var(--accent);">' + code + '</strong> <button class="btn btn-secondary btn-sm" onclick="navigator.clipboard.writeText(\'' + code + '\');UI.toast(\'Copied!\',\'success\')" style="font-size:10px;padding:2px 8px;">Copy</button></div>' +
      '<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Share this code — up to 3 family members can join.</div>' +
    '</div>' +
    '<button class="btn btn-secondary btn-sm" onclick="leaveHousehold()" style="color:var(--red);"><i class="fas fa-right-from-bracket"></i> ' + (_household.role === 'owner' ? 'Disband Household' : 'Leave Household') + '</button>';
  }
}

async function toggleHouseholdView() {
  if (!_household) return;
  _householdView = !_householdView;
  var btn = document.getElementById('householdToggleBtn');
  if (btn) btn.textContent = _householdView ? 'My Vault' : 'Household View';
  if (_householdView) {
    await loadHouseholdAssets();
  } else {
    // Restore personal assets
    if (window._personalAssets) {
      assets = window._personalAssets;
      window._personalAssets = null;
    }
  }
  renderAll();
}

async function loadHouseholdAssets() {
  if (!_household) return;
  try {
    var memberIds = [_household.owner_id];
    if (_household.household_members) {
      _household.household_members.forEach(function(m) { memberIds.push(m.user_id); });
    }
    // Load assets for all members
    var allAssets = [];
    for (var i = 0; i < memberIds.length; i++) {
      var { data } = await sb.from('assets').select('*').eq('user_id', memberIds[i]);
      if (data) allAssets = allAssets.concat(data);
    }
    // Temporarily swap assets for rendering
    window._personalAssets = assets;
    assets = allAssets.map(function(r) { return { id: r.id, name: r.name, cat: r.cat, value: parseFloat(r.value)||0, notes: r.notes||'', principal: r.principal?parseFloat(r.principal):null, rate: r.rate?parseFloat(r.rate):null, years: r.years?parseFloat(r.years):null, fv: parseFloat(r.fv)||0, interest: parseFloat(r.interest)||0, custom_cat: r.custom_cat||null, start_date: r.start_date||null, created_at: r.created_at, depreciationType: r.depreciation_type||null, depreciationRate: r.depreciation_rate||null, usefulLife: r.useful_life||null, salvageValue: r.salvage_value||null, originalCost: r.original_cost||null, depreciationStart: r.depreciation_start||null }; });
  } catch(e) { console.error('Household load error:', e); }
}

// ══ CUSTOM BRANDING ═══════════════════════════════════════════
function applyBranding() {
  var b = JSON.parse(localStorage.getItem('kv-branding') || '{}');
  var name = b.name || 'Keno Vault';
  var icon = b.icon || '⬡';
  // Sidebar logo
  var logo = document.querySelector('.sidebar-logo');
  if (logo) logo.innerHTML = icon + ' <span>' + name + '</span>';
  // Breadcrumb
  var bc = document.querySelector('.breadcrumb span');
  // Browser title
  document.title = 'Dashboard — ' + name;
}

// ══ AI PORTFOLIO ADVISOR ═══════════════════════════════════════
var AI_URL = 'https://soxqotattmhahzpehycz.supabase.co/functions/v1/ai-advisor';

function getAIWeekKey() {
  var now = new Date();
  var start = new Date(now.getFullYear(), 0, 1);
  return 'kv-ai-' + Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7);
}

function getAIUsage() {
  try {
    var data = JSON.parse(localStorage.getItem('kv-ai-usage') || '{}');
    var key = getAIWeekKey();
    if (data.week !== key) return { week: key, count: 0 };
    return data;
  } catch(e) { return { week: getAIWeekKey(), count: 0 }; }
}

function saveAIUsage(data) {
  localStorage.setItem('kv-ai-usage', JSON.stringify(data));
}

function updateAIUsage() {
  var usage = getAIUsage();
  var label = document.getElementById('aiUsageLabel');
  if (label) label.textContent = usage.count + '/5 used this week';
  var btn = document.getElementById('aiAskBtn');
  if (btn) btn.disabled = usage.count >= 5;
  var input = document.getElementById('aiQuestion');
  if (input) input.disabled = usage.count >= 5;
  renderAIChatHistory();
}

async function askAI() {
  var usage = getAIUsage();
  if (usage.count >= 5) { UI.toast('Weekly limit reached (5/5). Resets next week.', 'info'); return; }
  var input = document.getElementById('aiQuestion');
  var question = input?.value?.trim();
  if (!question) return;

  // Prepare portfolio summary
  var total = assets.filter(function(a){return a.cat!=='liability';}).reduce(function(s,a){return s+a.value;},0);
  var totalLiab = assets.filter(function(a){return a.cat==='liability';}).reduce(function(s,a){return s+a.value;},0);
  var portfolio = {
    netWorth: total - totalLiab,
    assets: assets.map(function(a){ return { name:a.name, cat:a.cat, value:a.value, rate:a.rate, years:a.years, fv:a.fv, interest:a.interest, custom_cat:a.custom_cat }; }),
    allocation: {
      cash: assets.filter(function(a){return a.cat==='cash';}).reduce(function(s,a){return s+a.value;},0),
      physical: assets.filter(function(a){return a.cat==='physical';}).reduce(function(s,a){return s+a.value;},0),
      investment: assets.filter(function(a){return a.cat==='investment';}).reduce(function(s,a){return s+a.value;},0),
      liability: totalLiab
    },
    goals: _goals || [],
    currency: Calculators.getBaseCurrency ? Calculators.getBaseCurrency() : 'USD',
  };

  // Show user message
  appendAIMessage(question, 'user');
  input.value = '';
  input.disabled = true;
  var btn = document.getElementById('aiAskBtn'); if (btn) { btn.disabled = true; btn.textContent = '…'; }

  // Show thinking
  appendAIMessage('<i>Analyzing your portfolio…</i>', 'bot');

  try {
    var resp = await fetch(AI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portfolio: portfolio, question: question }),
    });
    var data = await resp.json();
    // Remove thinking message
    var chat = document.getElementById('aiChat');
    if (chat) chat.removeChild(chat.lastChild);

    if (data.error) {
      appendAIMessage('Sorry, something went wrong: ' + data.error, 'bot');
    } else {
      appendAIMessage(data.reply || 'No response.', 'bot');
      usage.count++;
      saveAIUsage(usage);
      updateAIUsage();
    }
  } catch(e) {
    var chat2 = document.getElementById('aiChat');
    if (chat2) chat2.removeChild(chat2.lastChild);
    appendAIMessage('Network error. Check your connection and try again.', 'bot');
  }

  if (btn) { btn.disabled = false; btn.textContent = 'Ask'; }
  if (input) { input.disabled = false; input.focus(); }
}

function formatAIText(text) {
  // Convert markdown-ish formatting to HTML
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h4 style="margin:10px 0 4px;font-size:14px;color:var(--text);">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="margin:12px 0 4px;font-size:15px;color:var(--text);">$1</h3>')
    .replace(/^- (.+)$/gm, '<li style="margin-left:16px;">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li style="margin-left:16px;">$1. $2</li>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

function getAIChatHistory() {
  try { return JSON.parse(localStorage.getItem('kv-ai-chat') || '[]'); } catch(e) { return []; }
}
function saveAIChatHistory(h) {
  localStorage.setItem('kv-ai-chat', JSON.stringify(h));
}
function renderAIChatHistory() {
  var chat = document.getElementById('aiChat');
  if (!chat) return;
  var history = getAIChatHistory();
  if (!history.length) {
    chat.innerHTML = '<div class="ai-msg ai-msg-bot"><div class="ai-msg-avatar"><i class="fas fa-robot"></i></div><div class="ai-msg-text">Hello! I\'m your AI portfolio advisor. I can see your full portfolio — ask me anything. For example:<br/><br/>• "Am I overexposed to any category?"<br/>• "What should I rebalance?"<br/>• "Is my emergency fund sufficient?"<br/>• "How can I reach my FI target faster?"</div></div>';
    return;
  }
  chat.innerHTML = history.map(function(m) {
    var html = m.role === 'bot' ? formatAIText(m.text) : m.text;
    return m.role === 'user'
      ? '<div class="ai-msg ai-msg-user"><div class="ai-msg-text">' + html + '</div></div>'
      : '<div class="ai-msg ai-msg-bot"><div class="ai-msg-avatar"><i class="fas fa-robot"></i></div><div class="ai-msg-text">' + html + '</div></div>';
  }).join('');
  chat.scrollTop = chat.scrollHeight;
}

function appendAIMessage(text, role) {
  var chat = document.getElementById('aiChat');
  if (!chat) return;
  var formatted = role === 'bot' ? formatAIText(text) : text;
  var div = document.createElement('div');
  div.className = 'ai-msg ' + (role === 'user' ? 'ai-msg-user' : 'ai-msg-bot');
  div.innerHTML = (role === 'user' ? '' : '<div class="ai-msg-avatar"><i class="fas fa-robot"></i></div>') +
    '<div class="ai-msg-text">' + formatted + '</div>';
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  var history = getAIChatHistory();
  history.push({ role: role, text: text, time: Date.now() });
  if (history.length > 50) history = history.slice(-50);
  saveAIChatHistory(history);
}

function clearAIChat() {
  localStorage.removeItem('kv-ai-chat');
  renderAIChatHistory();
}

// ══ PORTFOLIO STRESS TEST ══════════════════════════════════════
var _stressScenario = 'crash';

var SCENARIOS = {
  crash:      { cash: -5,   physical: -15,  investment: -30,  liability: 5   },
  inflation:  { cash: -20,  physical: -10,  investment: -25,  liability: 10  },
  realestate: { cash: -5,   physical: -35,  investment: -10,  liability: 0   },
  crypto:     { cash: -5,   physical: -10,  investment: -60,  liability: 5   },
};

function setStressScenario(name, btn) {
  _stressScenario = name;
  document.querySelectorAll('#stressPresets .toggle-chip').forEach(function(c) { c.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  var custom = document.getElementById('stressCustomSliders');
  if (custom) custom.style.display = name === 'custom' ? 'block' : 'none';
  if (name !== 'custom' && SCENARIOS[name]) {
    var s = SCENARIOS[name];
    document.getElementById('stressCash').value  = s.cash;
    document.getElementById('stressPhys').value  = s.physical;
    document.getElementById('stressInv').value   = s.investment;
    document.getElementById('stressLiab').value  = s.liability;
    document.getElementById('stressCashVal').textContent  = s.cash + '%';
    document.getElementById('stressPhysVal').textContent  = s.physical + '%';
    document.getElementById('stressInvVal').textContent   = s.investment + '%';
    document.getElementById('stressLiabVal').textContent  = (s.liability > 0 ? '+' : '') + s.liability + '%';
  }
  runStressTest();
}

function runStressTest() {
  var el = document.getElementById('stressResults');
  if (!el) return;

  var shockCash = parseInt(document.getElementById('stressCash')?.value) || 0;
  var shockPhys = parseInt(document.getElementById('stressPhys')?.value) || 0;
  var shockInv  = parseInt(document.getElementById('stressInv')?.value)  || 0;
  var shockLiab = parseInt(document.getElementById('stressLiab')?.value) || 0;

  var bycat = { cash:0, physical:0, investment:0, liability:0 };
  assets.forEach(function(a) { bycat[a.cat] = (bycat[a.cat]||0) + a.value; });

  var originalNW = bycat.cash + bycat.physical + bycat.investment - bycat.liability;
  var stressedCash = bycat.cash       * (1 + shockCash / 100);
  var stressedPhys = bycat.physical   * (1 + shockPhys / 100);
  var stressedInv  = bycat.investment * (1 + shockInv  / 100);
  var stressedLiab = bycat.liability  * (1 + shockLiab / 100);
  var stressedNW   = stressedCash + stressedPhys + stressedInv - stressedLiab;
  var loss         = originalNW - stressedNW;
  var lossPct      = originalNW > 0 ? ((loss / originalNW) * 100).toFixed(1) : '0';

  var worstCat = '', worstPct = 0;
  [{n:'Cash',p:shockCash,v:bycat.cash},{n:'Physical',p:shockPhys,v:bycat.physical},{n:'Investments',p:shockInv,v:bycat.investment},{n:'Liabilities',p:shockLiab,v:bycat.liability}].forEach(function(c) {
    var impact = Math.abs(c.p);
    if (impact > worstPct && c.v > 0) { worstPct = impact; worstCat = c.n; }
  });

  var statusColor = lossPct > 30 ? '#f87171' : lossPct > 15 ? '#f4c553' : lossPct > 5 ? '#f97316' : '#34d399';
  var statusLabel = lossPct > 30 ? 'Highly Vulnerable' : lossPct > 15 ? 'Moderately Exposed' : lossPct > 5 ? 'Mildly Affected' : 'Resilient';
  var statusIcon  = lossPct > 30 ? '🔴' : lossPct > 15 ? '🟡' : lossPct > 5 ? '🟠' : '🟢';

  el.innerHTML =
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:16px;">' +
      '<div class="kpi-card" style="text-align:center;padding:20px;">' +
        '<div class="kpi-label">Original Net Worth</div>' +
        '<div class="kpi-value sensitive" style="color:var(--text);">' + fmt(originalNW) + '</div>' +
      '</div>' +
      '<div class="kpi-card" style="text-align:center;padding:20px;">' +
        '<div class="kpi-label">Stressed Net Worth</div>' +
        '<div class="kpi-value sensitive" style="color:' + statusColor + ';">' + fmt(stressedNW) + '</div>' +
        '<div class="kpi-change" style="color:' + statusColor + ';">' + (loss > 0 ? '-' : '+') + fmt(Math.abs(loss)) + ' (' + (lossPct > 0 ? '-' : '+') + lossPct + '%)</div>' +
      '</div>' +
      '<div class="kpi-card" style="text-align:center;padding:20px;">' +
        '<div class="kpi-label">Resilience Rating</div>' +
        '<div style="font-size:28px;margin-bottom:2px;">' + statusIcon + '</div>' +
        '<div class="kpi-change" style="color:' + statusColor + ';font-weight:700;">' + statusLabel + '</div>' +
      '</div>' +
    '</div>' +

    '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:14px;padding:20px;margin-bottom:16px;">' +
      '<div style="font-size:13px;font-weight:600;margin-bottom:14px;">Category Impact Breakdown</div>' +
      '<div style="display:flex;flex-direction:column;gap:10px;">' +
        buildStressBar('Cash', shockCash, stressedCash, bycat.cash, '#60a5fa') +
        buildStressBar('Physical', shockPhys, stressedPhys, bycat.physical, '#34d399') +
        buildStressBar('Investments', shockInv, stressedInv, bycat.investment, '#f97316') +
        (bycat.liability > 0 ? buildStressBar('Liabilities', shockLiab, stressedLiab, bycat.liability, '#f87171') : '') +
      '</div>' +
    '</div>' +

    '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:14px;padding:20px;">' +
      '<div style="font-size:13px;font-weight:600;margin-bottom:8px;">Strategic Takeaway</div>' +
      '<p style="font-size:13px;color:var(--text-dim);line-height:1.7;margin:0;">' +
        (lossPct > 30
          ? 'This scenario would wipe out <strong style="color:#f87171;">over 30% of your net worth</strong>. ' + worstCat + ' takes the biggest hit. Consider rebalancing away from ' + worstCat.toLowerCase() + ' to reduce concentration risk and improve your shock resilience.'
          : lossPct > 15
            ? 'Your portfolio would lose <strong style="color:#f4c553;">' + lossPct + '% of its value</strong> under this scenario. ' + worstCat + ' is your most exposed category. Diversifying across more asset types can cushion future shocks.'
            : lossPct > 5
              ? 'A modest <strong style="color:#f97316;">' + lossPct + '% decline</strong> in net worth. Your portfolio shows reasonable diversification — ' + worstCat + ' bears the most impact but the damage is contained.'
              : 'Your portfolio is <strong style="color:#34d399;">highly resilient</strong> to this scenario. Net worth barely moves. Keep maintaining your balanced allocation across categories — it\'s working.') +
      '</p>' +
    '</div>';
}

function buildStressBar(label, shock, stressed, original, color) {
  if (original === 0) return '';
  var change = stressed - original;
  var arrow = change >= 0 ? '<i class="fas fa-arrow-up"></i>' : '<i class="fas fa-arrow-down"></i>';
  return '<div style="display:flex;align-items:center;gap:10px;">' +
    '<span style="font-size:12px;font-weight:500;min-width:90px;">' + label + '</span>' +
    '<div style="flex:1;display:flex;align-items:center;gap:8px;">' +
      '<span class="mono sensitive" style="font-size:13px;min-width:90px;text-align:right;">' + fmt(original) + '</span>' +
      '<span style="font-size:14px;color:' + (change >= 0 ? '#34d399' : '#f87171') + ';">' + arrow + '</span>' +
      '<span class="mono sensitive" style="font-size:13px;min-width:90px;color:' + (change >= 0 ? '#34d399' : '#f87171') + ';">' + fmt(Math.round(stressed)) + '</span>' +
      '<span style="font-size:11px;color:var(--text-muted);">(' + (shock > 0 ? '+' : '') + shock + '%)</span>' +
    '</div>' +
  '</div>';
}

// ══ MONTHLY WEALTH REPORT ═══════════════════════════════════════
async function generateMonthlyReport() {
  var includeFIRE = isPro() && await showConfirm('Monthly Report', 'Include FIRE Projection in the report?', 'Yes', '📊');
  var preparedFor = await showPrompt('Add Recipient', '(optional)', 'e.g. My Accountant or Mortgage Advisor', 'Add to Report', '📋');
  if (preparedFor === null) preparedFor = ''; // cancelled
  var total = assets.filter(function(a){return a.cat!=='liability';}).reduce(function(s,a){return s+a.value;},0);
  var totalLiab = assets.filter(function(a){return a.cat==='liability';}).reduce(function(s,a){return s+a.value;},0);
  var nw = total - totalLiab;
  var cashVal = assets.filter(function(a){return a.cat==='cash';}).reduce(function(s,a){return s+a.value;},0);
  var physVal = assets.filter(function(a){return a.cat==='physical';}).reduce(function(s,a){return s+a.value;},0);
  var invVal  = assets.filter(function(a){return a.cat==='investment';}).reduce(function(s,a){return s+a.value;},0);
  var invGains = assets.filter(function(a){return a.cat==='investment';}).reduce(function(s,a){return s+(a.interest||0);},0);
  var count = assets.length;

  var topAssets = assets.filter(function(a){return a.cat!=='liability';}).sort(function(a,b){return b.value - a.value;}).slice(0,5);

  var monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var today = new Date();
  var monthLabel = monthNames[today.getMonth()] + ' ' + today.getFullYear();
  var baseCur = Calculators.getBaseCurrency ? Calculators.getBaseCurrency() : 'USD';

  var goalsHTML = '';
  if (_goals && _goals.length > 0) {
    goalsHTML = _goals.map(function(g) {
      var currentAmount = g.fundingSource === 'liquid_only' ? cashVal : g.fundingSource === 'investment_only' ? invVal : nw;
      var pct = g.target > 0 ? Math.round((currentAmount / g.target) * 100) : 0;
      return '<tr><td>' + g.name + '</td><td>' + fmt(g.target) + '</td><td>' + fmt(currentAmount) + '</td><td>' + pct + '%</td></tr>';
    }).join('');
  }

  var historyHTML = '';
  if (nwHistory && nwHistory.length >= 2) {
    var firstNW = nwHistory[0].nw;
    var lastNW  = nwHistory[nwHistory.length - 1].nw;
    var changeNW = lastNW - firstNW;
    var changePct = firstNW > 0 ? ((changeNW / firstNW) * 100).toFixed(1) : 0;
    historyHTML = '<p>Started at <strong>' + fmt(firstNW) + '</strong> · Now at <strong>' + fmt(lastNW) + '</strong> · <strong style="color:' + (changeNW >= 0 ? '#34d399' : '#f87171') + ';">' + (changeNW >= 0 ? '+' : '') + fmt(changeNW) + ' (' + (changePct > 0 ? '+' : '') + changePct + '%)</strong></p>';
  }

  var w = window.open('', '_blank', 'width=800,height=900');
  w.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Keno Vault — Monthly Wealth Report</title>');
  w.document.write('<style>');
  w.document.write('body{font-family:system-ui,-apple-system,sans-serif;max-width:720px;margin:0 auto;padding:40px 24px;color:#1a1a1a;line-height:1.6;font-size:14px;}');
  w.document.write('h1{font-family:Georgia,serif;font-size:32px;margin:0 0 4px;letter-spacing:-0.02em;}');
  w.document.write('h2{font-family:Georgia,serif;font-size:20px;margin:32px 0 12px;border-bottom:2px solid #f97316;padding-bottom:6px;}');
  w.document.write('.accent{color:#f97316;}.muted{color:#888;}.mono{font-family:monospace;}');
  w.document.write('.kpi-row{display:flex;gap:20px;flex-wrap:wrap;margin:16px 0;}');
  w.document.write('.kpi{border:1px solid #e5e5e5;border-radius:10px;padding:16px;flex:1;min-width:140px;text-align:center;}');
  w.document.write('.kpi-val{font-size:24px;font-weight:700;font-family:Georgia,serif;}');
  w.document.write('.kpi-label{font-size:11px;text-transform:uppercase;color:#888;letter-spacing:.06em;}');
  w.document.write('table{width:100%;border-collapse:collapse;margin:12px 0;}');
  w.document.write('th,td{text-align:left;padding:8px 12px;border-bottom:1px solid #e5e5e5;font-size:13px;}');
  w.document.write('th{font-weight:600;color:#888;font-size:11px;text-transform:uppercase;}');
  w.document.write('.footer{margin-top:40px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:11px;color:#aaa;}');
  w.document.write('@media print{body{padding:20px;}@page{margin:20mm;}}');
  w.document.write('</style></head><body>');

  w.document.write('<h1>Keno Vault <span class="accent">⬡</span></h1>');
  w.document.write('<p class="muted">Monthly Wealth Report · ' + monthLabel + ' · Base Currency: ' + baseCur + '</p>');
  if (preparedFor) w.document.write('<p class="muted">Prepared for: <strong>' + preparedFor + '</strong></p>');

  w.document.write('<h2>Net Worth Summary</h2>');
  w.document.write('<div class="kpi-row">');
  w.document.write('<div class="kpi"><div class="kpi-label">Total Net Worth</div><div class="kpi-val accent">' + fmt(nw) + '</div></div>');
  w.document.write('<div class="kpi"><div class="kpi-label">Total Assets</div><div class="kpi-val">' + fmt(total) + '</div></div>');
  w.document.write('<div class="kpi"><div class="kpi-label">Liabilities</div><div class="kpi-val" style="color:#dc2626;">' + fmt(totalLiab) + '</div></div>');
  w.document.write('<div class="kpi"><div class="kpi-label">Entries</div><div class="kpi-val">' + count + '</div></div>');
  w.document.write('</div>');

  w.document.write('<h2>Asset Allocation</h2>');
  w.document.write('<table><tr><th>Category</th><th>Value</th><th>% of Assets</th></tr>');
  w.document.write('<tr><td>💵 Liquid Cash</td><td>' + fmt(cashVal) + '</td><td>' + (total > 0 ? (cashVal/total*100).toFixed(1) : '0') + '%</td></tr>');
  w.document.write('<tr><td>📦 Physical Assets</td><td>' + fmt(physVal) + '</td><td>' + (total > 0 ? (physVal/total*100).toFixed(1) : '0') + '%</td></tr>');
  w.document.write('<tr><td>📈 Investments</td><td>' + fmt(invVal) + '</td><td>' + (total > 0 ? (invVal/total*100).toFixed(1) : '0') + '%</td></tr>');
  w.document.write('<tr><td>⚠️ Liabilities</td><td>' + fmt(totalLiab) + '</td><td>' + (total > 0 ? (totalLiab/total*100).toFixed(1) : '0') + '%</td></tr>');
  w.document.write('</table>');
  if (invGains > 0) w.document.write('<p>Projected investment gains: <strong style="color:#16a34a;">+' + fmt(invGains) + '</strong></p>');

  if (topAssets.length) {
    w.document.write('<h2>Top Assets</h2>');
    w.document.write('<table><tr><th>#</th><th>Asset</th><th>Category</th><th>Value</th></tr>');
    topAssets.forEach(function(a, i) {
      var catLabel = (a.cat === 'custom' && a.custom_cat) ? a.custom_cat : a.cat;
      w.document.write('<tr><td>' + (i+1) + '</td><td>' + a.name + '</td><td>' + catLabel + '</td><td>' + fmt(a.value) + '</td></tr>');
    });
    w.document.write('</table>');
  }

  if (nwHistory && nwHistory.length >= 2) {
    w.document.write('<h2>Net Worth Trend</h2>');
    w.document.write(historyHTML);
  }

  if (goalsHTML) {
    w.document.write('<h2>Goal Progress</h2>');
    w.document.write('<table><tr><th>Goal</th><th>Target</th><th>Current</th><th>Progress</th></tr>');
    w.document.write(goalsHTML);
    w.document.write('</table>');
  }

  // FIRE Snapshot (Pro+ users, optional)
  if (includeFIRE) {
    var fireAge = parseInt(document.getElementById('fireAge')?.value) || 30;
    var fireRetire = parseInt(document.getElementById('fireRetire')?.value) || 55;
    var fireSave = (parseInt(document.getElementById('fireSavings')?.value) || 500) * (_fireSaveMul || 1);
    var fireReturn = parseInt(document.getElementById('fireReturn')?.value) || 10;
    var fireInflation = parseInt(document.getElementById('fireInflation')?.value) || 18;
    var fireExpenses = (parseInt(document.getElementById('fireExpenses')?.value) || 30000) * (_fireExpMul || 1);
    var fireRes = Calculators.fireSimulation({
      currentAge: fireAge, retirementAge: fireRetire, currentNetWorth: nw,
      monthlySavings: fireSave, annualReturnRate: fireReturn, inflationRate: fireInflation, annualExpenses: fireExpenses
    });
    w.document.write('<h2>FIRE Projection</h2>');
    w.document.write('<div class="kpi-row">');
    w.document.write('<div class="kpi"><div class="kpi-label">Retirement Age</div><div class="kpi-val accent">' + fireRetire + '</div></div>');
    w.document.write('<div class="kpi"><div class="kpi-label">FI Target Number</div><div class="kpi-val">' + fmt(fireRes.fiNumber) + '</div></div>');
    w.document.write('<div class="kpi"><div class="kpi-label">Projected at ' + fireRetire + '</div><div class="kpi-val" style="color:' + (fireRes.isFIReady ? '#16a34a' : '#dc2626') + ';">' + fmt(fireRes.projectedNW) + '</div></div>');
    w.document.write('<div class="kpi"><div class="kpi-label">Status</div><div class="kpi-val" style="color:' + (fireRes.isFIReady ? '#16a34a' : '#dc2626') + ';">' + (fireRes.isFIReady ? 'FIRE Ready' : 'Shortfall') + '</div></div>');
    w.document.write('</div>');
    if (fireRes.isFIReady) {
      w.document.write('<p>Surplus of <strong style="color:#16a34a;">' + fmt(fireRes.surplus) + '</strong> over FI target. Your real (inflation-adjusted) return rate: <strong>' + fireRes.realReturnRate + '%</strong>.</p>');
    } else {
      w.document.write('<p>Shortfall of <strong style="color:#dc2626;">' + fmt(fireRes.shortfall) + '</strong> to reach FI target. Consider increasing monthly savings or adjusting your retirement timeline.</p>');
    }
  }

  w.document.write('<div class="footer">Generated by Keno Vault on ' + today.toLocaleDateString() + ' · kenovault@gmail.com</div>');
  w.document.write('<script>setTimeout(function(){window.print();},500);</script>');
  w.document.write('</body></html>');
  w.document.close();
}

async function renderCurrency() {
  if (!isGrowth()) return;

  var kpiEl = document.getElementById('currencyKPIs');
  var rateEl = document.getElementById('fxRateDisplay');
  if (kpiEl) kpiEl.innerHTML = '<div class="kpi-card" style="grid-column:span 5;text-align:center;padding:28px;"><div class="spinner" style="margin:0 auto 12px;"></div><div style="font-size:13px;color:var(--text-dim);">Fetching live exchange rates…</div></div>';
  if (rateEl) rateEl.innerHTML = '';

  await Calculators.fetchFXRates();

  var baseCur = Calculators.getBaseCurrency();
  var total = assets.filter(function(a) { return a.cat !== 'liability'; }).reduce(function(s, a) { return s + a.value; }, 0)
              - assets.filter(function(a) { return a.cat === 'liability'; }).reduce(function(s, a) { return s + a.value; }, 0);

  // Net worth KPI cards — show user's selected KPI currencies
  var selectedNw = getFXKpiCurrencies().filter(function(c) { return c !== baseCur; });
  if (kpiEl) kpiEl.innerHTML = selectedNw.map(function(c) {
    var converted = Calculators.convertCurrency(total, baseCur, c);
    return '<div class="kpi-card"><div class="kpi-label">' + c + '</div><div class="kpi-value sensitive">' + Calculators.formatCurrency(converted, c) + '</div><div class="kpi-change">Net Worth</div></div>';
  }).join('');

  // Rate chips — show user's selected currencies
  var selectedRates = getFXCurrencies();
  var lastFetched = Calculators.ratesLastFetched;
  var timeAgo = lastFetched ? Math.floor((Date.now() - lastFetched) / 60000) + ' min ago' : 'just now';
  var timeEl = document.getElementById('fxTimeLabel');
  if (timeEl) timeEl.textContent = 'Updated ' + timeAgo + ' · ' + Object.keys(Calculators.rates).length + ' currencies';

  if (rateEl) rateEl.innerHTML = selectedRates.map(function(k) {
    var v = Calculators.rates[k];
    if (!v) return '';
    return '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:7px 12px;">' +
      '<div style="font-size:9px;color:var(--text-muted);">1 USD =</div>' +
      '<div class="mono" style="font-size:13px;font-weight:600;">' + Calculators.getCurrencySymbol(k) + ' ' + (typeof v === 'number' ? v.toFixed(2) : v) + '</div>' +
      '<div style="font-size:9px;color:var(--text-dim);">' + k + '</div>' +
    '</div>';
  }).join('');
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
    var investOnly = assets.filter(function(a){return a.cat==='investment';}).reduce(function(s,a){return s+a.value;},0);
    var currentAmount = g.fundingSource === 'liquid_only' ? liquidCash : g.fundingSource === 'investment_only' ? investOnly : totalNw;
    var pct = g.target > 0 ? Math.min(Math.round((currentAmount / g.target) * 100), 100) : 0;
    var barColor = pct >= 100 ? '#34d399' : pct >= 50 ? '#f4c553' : pct >= 25 ? '#f97316' : '#f87171';
    var remaining = Math.max(0, g.target - currentAmount);
    var fundingLabel = g.fundingSource === 'liquid_only' ? 'Tracking: Liquid Cash' : g.fundingSource === 'investment_only' ? 'Tracking: Investments' : 'Tracking: Net Worth';

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
    initHistoryUI();
    loadGoals(); // Non-blocking
    if (isElite()) loadHousehold().then(function() {
      var hhToggle = document.getElementById('householdToggleBtn');
      if (hhToggle && _household) hhToggle.style.display = 'inline-block';
    });
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