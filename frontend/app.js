/**
 * Cryptid X Decoder — Frontend App
 * Pure vanilla JS, no frameworks.
 */

'use strict';

// ── Config ────────────────────────────────────────────────────────────────────
const API_BASE = window.CRYPTID_API_BASE || 'http://localhost:3001';
const HISTORY_KEY = 'cxd_history';
const AUTH_TOKEN_KEY = 'cxd_token';
const AUTH_USER_KEY = 'cxd_user';

// ── State ─────────────────────────────────────────────────────────────────────
let currentLua = '';
let currentScriptId = '';
let authToken = localStorage.getItem(AUTH_TOKEN_KEY) || null;
let authUser = localStorage.getItem(AUTH_USER_KEY) || null;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const $q = sel => document.querySelector(sel);
const $all = sel => document.querySelectorAll(sel);

// ── Live clock ────────────────────────────────────────────────────────────────
function updateClock() {
  const el = $('live-time');
  if (el) el.textContent = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}
updateClock();
setInterval(updateClock, 1000);

// ── Navigation ────────────────────────────────────────────────────────────────
function showPage(name) {
  $all('.page').forEach(p => p.classList.remove('active'));
  $all('.nav-link').forEach(l => l.classList.remove('active'));
  const page = $(`page-${name}`);
  if (page) page.classList.add('active');
  const link = $q(`.nav-link[data-page="${name}"]`);
  if (link) link.classList.add('active');
  if (name === 'history') renderHistory();
  if (name === 'keys') renderKeysPage();
}

$all('.nav-link').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    showPage(link.dataset.page);
  });
});

// ── Decode flow ───────────────────────────────────────────────────────────────
const loadingSteps = [
  'Validating ID...',
  'Fetching encrypted payload...',
  'Decrypting Base32 → XOR...',
  'Rendering Lua output...'
];

function setLoading(active, stepIndex = 0) {
  const ls = $('loading-state');
  const bar = $('loading-bar');
  const steps = $('loading-steps');
  const btn = $('decode-btn');

  if (active) {
    ls.classList.remove('hidden');
    btn.disabled = true;
    btn.querySelector('.btn-text').textContent = 'DECODING...';
    bar.style.width = `${(stepIndex + 1) * 25}%`;
    steps.innerHTML = loadingSteps
      .map((s, i) => `<span class="step${i === stepIndex ? ' active' : ''}">${s}</span>`)
      .join('');
  } else {
    ls.classList.add('hidden');
    btn.disabled = false;
    btn.querySelector('.btn-text').textContent = 'INITIATE DECODE';
    bar.style.width = '0%';
  }
}

function showError(msg) {
  const box = $('error-box');
  $('error-text').textContent = msg;
  box.classList.remove('hidden');
}

function clearError() {
  $('error-box').classList.add('hidden');
}

function showResult(scriptId, lua, bytes) {
  currentLua = lua;
  currentScriptId = scriptId;

  $('res-id').textContent = scriptId;
  $('res-bytes').textContent = formatBytes(bytes);
  $('lua-output').textContent = lua.slice(0, 4000) + (lua.length > 4000 ? '\n-- [truncated for preview] --' : '');

  $('result-panel').classList.remove('hidden');
}

function hideResult() {
  $('result-panel').classList.add('hidden');
  currentLua = '';
  currentScriptId = '';
}

async function runDecode() {
  const raw = $('script-input').value.trim();
  if (!raw) {
    showError('Please enter a Script ID or URL.');
    return;
  }

  clearError();
  hideResult();

  // Animate through steps
  const stepDelay = 400;
  for (let i = 0; i < loadingSteps.length - 1; i++) {
    setLoading(true, i);
    await sleep(stepDelay);
  }
  setLoading(true, loadingSteps.length - 1);

  try {
    const res = await fetch(`${API_BASE}/api/decode`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
      },
      body: JSON.stringify({ id: raw })
    });
    const data = await res.json();

    setLoading(false);

    if (!res.ok) {
      showError(data.error || `Server error (${res.status})`);
      return;
    }

    showResult(data.scriptId, data.lua, data.bytes);
    addHistory(data.scriptId);
  } catch (err) {
    setLoading(false);
    showError('Network error: could not reach the decode server. Is the backend running?');
  }
}

$('decode-btn').addEventListener('click', runDecode);
$('script-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') runDecode();
});

// ── Paste button ──────────────────────────────────────────────────────────────
$('paste-btn').addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    $('script-input').value = text;
    $('script-input').focus();
  } catch {
    // Clipboard API may not be available; silently fail
  }
});

// ── Copy / Download ───────────────────────────────────────────────────────────
$('copy-btn').addEventListener('click', () => {
  if (!currentLua) return;
  navigator.clipboard.writeText(currentLua).then(() => {
    const btn = $('copy-btn');
    const orig = btn.innerHTML;
    btn.innerHTML = '✓ COPIED';
    btn.style.color = 'var(--green)';
    setTimeout(() => { btn.innerHTML = orig; btn.style.color = ''; }, 1500);
  });
});

$('download-btn').addEventListener('click', () => {
  if (!currentLua || !currentScriptId) return;
  const blob = new Blob([currentLua], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${currentScriptId}_decrypted.lua`;
  a.click();
  URL.revokeObjectURL(url);
});

// ── History ───────────────────────────────────────────────────────────────────
function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
  catch { return []; }
}

function addHistory(scriptId) {
  const h = getHistory().filter(e => e.id !== scriptId);
  h.unshift({ id: scriptId, ts: Date.now() });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 50)));
}

function renderHistory() {
  const list = $('history-list');
  const h = getHistory();
  if (!h.length) {
    list.innerHTML = `<div class="empty-state"><span class="empty-icon">∅</span><p>No decodes yet.</p></div>`;
    return;
  }
  list.innerHTML = h.map(e => `
    <div class="history-item">
      <div>
        <div class="history-id">${e.id}</div>
        <div class="history-time">${new Date(e.ts).toLocaleString()}</div>
      </div>
      <button class="history-redecode" data-id="${e.id}">RE-DECODE →</button>
    </div>
  `).join('');

  list.querySelectorAll('.history-redecode').forEach(btn => {
    btn.addEventListener('click', () => {
      $('script-input').value = btn.dataset.id;
      showPage('decoder');
      runDecode();
    });
  });
}

$('clear-history').addEventListener('click', () => {
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
});

// ── Auth ──────────────────────────────────────────────────────────────────────
function updateAuthUI() {
  const btn = $('auth-toggle');
  if (authToken && authUser) {
    btn.textContent = `LOGOUT [${authUser}]`;
  } else {
    btn.textContent = 'LOGIN';
  }
}
updateAuthUI();

$('auth-toggle').addEventListener('click', () => {
  if (authToken) {
    authToken = null; authUser = null;
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    updateAuthUI();
    renderKeysPage();
  } else {
    openAuthModal();
  }
});

function openAuthModal() {
  $('auth-modal').classList.remove('hidden');
  $('auth-username').focus();
}

$('modal-close').addEventListener('click', () => $('auth-modal').classList.add('hidden'));
$('auth-modal').addEventListener('click', e => { if (e.target === $('auth-modal')) $('auth-modal').classList.add('hidden'); });

let authMode = 'login';
$all('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    authMode = btn.dataset.tab;
    $all('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    $('auth-submit').textContent = authMode === 'login' ? 'LOGIN' : 'REGISTER';
    $('auth-mode-text').innerHTML = authMode === 'login'
      ? `No account? <a href="#" id="switch-mode">Register here</a>`
      : `Have an account? <a href="#" id="switch-mode">Login here</a>`;
    bindSwitchMode();
    $('auth-error').classList.add('hidden');
  });
});

function bindSwitchMode() {
  const sm = $('switch-mode');
  if (sm) sm.addEventListener('click', e => {
    e.preventDefault();
    const target = authMode === 'login' ? 'register' : 'login';
    $q(`.tab-btn[data-tab="${target}"]`).click();
  });
}
bindSwitchMode();

$('auth-submit').addEventListener('click', async () => {
  const username = $('auth-username').value.trim();
  const password = $('auth-password').value;
  $('auth-error').classList.add('hidden');

  if (!username || !password) {
    showModalError('auth-error', 'Username and password are required.');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/auth/${authMode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) { showModalError('auth-error', data.error); return; }

    authToken = data.token;
    authUser = data.username;
    localStorage.setItem(AUTH_TOKEN_KEY, authToken);
    localStorage.setItem(AUTH_USER_KEY, authUser);
    updateAuthUI();
    $('auth-modal').classList.add('hidden');
    $('auth-password').value = '';
    renderKeysPage();
  } catch {
    showModalError('auth-error', 'Network error. Is the backend running?');
  }
});

$('keys-login-btn').addEventListener('click', openAuthModal);

// ── Keys Page ─────────────────────────────────────────────────────────────────
function renderKeysPage() {
  const wall = $('keys-auth-wall');
  const panel = $('keys-panel');
  if (authToken) {
    wall.classList.add('hidden');
    panel.classList.remove('hidden');
    loadKeys();
  } else {
    wall.classList.remove('hidden');
    panel.classList.add('hidden');
  }
}

async function loadKeys() {
  if (!authToken) return;
  try {
    const res = await fetch(`${API_BASE}/api/keys`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (res.status === 401) { handleAuthExpiry(); return; }
    const data = await res.json();
    renderKeysList(data.keys || []);
  } catch {
    $('keys-list').innerHTML = `<div class="empty-state"><p>Could not load keys. Backend may be offline.</p></div>`;
  }
}

function renderKeysList(keys) {
  const list = $('keys-list');
  if (!keys.length) {
    list.innerHTML = `<div class="empty-state"><span class="empty-icon">∅</span><p>No API keys yet. Create one above.</p></div>`;
    return;
  }
  list.innerHTML = keys.map(k => `
    <div class="key-item" data-id="${k.id}">
      <div class="key-info">
        <div class="key-label">${escHtml(k.label)}</div>
        <div class="key-preview">${escHtml(k.preview)}</div>
        <div class="key-date">Created ${new Date(k.createdAt).toLocaleString()}</div>
      </div>
      <div class="key-actions">
        <button class="key-action-btn regen-btn" data-id="${k.id}">REGENERATE</button>
        <button class="key-action-btn danger delete-btn" data-id="${k.id}">DELETE</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.regen-btn').forEach(btn => {
    btn.addEventListener('click', () => regenKey(btn.dataset.id));
  });
  list.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteKey(btn.dataset.id));
  });
}

$('create-key-btn').addEventListener('click', () => {
  $('key-modal').classList.remove('hidden');
  $('key-label').focus();
  $('key-error').classList.add('hidden');
});
$('key-modal-close').addEventListener('click', () => $('key-modal').classList.add('hidden'));
$('key-modal').addEventListener('click', e => { if (e.target === $('key-modal')) $('key-modal').classList.add('hidden'); });

$('key-create-submit').addEventListener('click', async () => {
  const label = $('key-label').value.trim() || 'Default';
  $('key-error').classList.add('hidden');
  try {
    const res = await fetch(`${API_BASE}/api/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ label })
    });
    const data = await res.json();
    if (!res.ok) { showModalError('key-error', data.error); return; }

    $('key-modal').classList.add('hidden');
    $('key-label').value = '';
    showKeyReveal(data.key);
    loadKeys();
  } catch {
    showModalError('key-error', 'Network error.');
  }
});

function showKeyReveal(key) {
  $('revealed-key').textContent = key;
  $('key-reveal-modal').classList.remove('hidden');
}
$('key-reveal-close').addEventListener('click', () => $('key-reveal-modal').classList.add('hidden'));
$('copy-revealed-key').addEventListener('click', () => {
  navigator.clipboard.writeText($('revealed-key').textContent).then(() => {
    $('copy-revealed-key').textContent = 'COPIED!';
    setTimeout(() => { $('copy-revealed-key').textContent = 'COPY'; }, 1500);
  });
});

async function deleteKey(id) {
  if (!confirm('Delete this API key? This cannot be undone.')) return;
  try {
    const res = await fetch(`${API_BASE}/api/keys/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (res.status === 401) { handleAuthExpiry(); return; }
    loadKeys();
  } catch { /* silent */ }
}

async function regenKey(id) {
  if (!confirm('Regenerate this key? The old key will stop working immediately.')) return;
  try {
    const res = await fetch(`${API_BASE}/api/keys/${id}/regenerate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (!res.ok) return;
    const data = await res.json();
    showKeyReveal(data.key);
    loadKeys();
  } catch { /* silent */ }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function formatBytes(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showModalError(id, msg) {
  const el = $(id);
  el.textContent = msg;
  el.classList.remove('hidden');
}

function handleAuthExpiry() {
  authToken = null; authUser = null;
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  updateAuthUI();
  renderKeysPage();
                    }
