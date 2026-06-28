// ═══════════════════════════════════════════════════════════════
// config.js — Keno Vault Shared Configuration & Helpers
// Load this BEFORE app.js or any page-specific script.
// ═══════════════════════════════════════════════════════════════

const APP_VERSION = '1.1.0';
const SITE_URL    = 'https://keno-vault.vercel.app';
const SUPA_URL    = 'https://soxqotattmhahzpehycz.supabase.co';
const SUPA_KEY    = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNveHFvdGF0dG1oYWh6cGVoeWN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMjU0NDIsImV4cCI6MjA5NTcwMTQ0Mn0.0jjwmGu5W1EIMq18Popq9Dh_SPEyDVOOBmPx9BuMPNw';
const ADMIN_EMAIL = 'kenovault@gmail.com';

// Shared Supabase client factory
function createSupabaseClient() {
  return supabase.createClient(SUPA_URL, SUPA_KEY, {
    auth: {
      autoRefreshToken:   true,
      persistSession:     true,
      detectSessionInUrl: true,
      storageKey:         'keno-vault-auth-v3',
      flowType:           'implicit',
    }
  });
}

// Shared toast helper (used by both dashboard and settings)
function sharedToast(msg, type) {
  type = type || 'info';
  var container = document.getElementById('toast');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast';
    container.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:600;display:flex;flex-direction:column;gap:8px;';
    document.body.appendChild(container);
  }
  var el = document.createElement('div');
  el.className = 'toast-item ' + type;
  el.innerHTML = '<span>' + ({ success:'✓', error:'✕', info:'ℹ' })[type] + '</span> ' + msg;
  container.appendChild(el);
  setTimeout(function() { el.remove(); }, 3500);
}

// Shared theme helpers
function getTheme() {
  return localStorage.getItem('kv-theme') || 'dark';
}

function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('kv-theme', t);
  // Update theme toggle button text if it exists
  var btn = document.getElementById('themeToggleBtn');
  if (btn) btn.textContent = t === 'dark' ? '🌙 Dark' : '☀️ Light';
}

function toggleTheme() {
  applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
}
