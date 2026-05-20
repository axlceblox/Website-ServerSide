// ============================================================================
// CRYPTID X DECODER - Frontend Application
// Complete rewrite with improved error handling, debugging, and UX
// ============================================================================

const config = {
  API_BASE: window.CRYPTID_API_BASE || 'http://localhost:3001',
  DEBUG: true,
  TIMEOUT: 15000
};

const state = {
  authToken: localStorage.getItem('authToken') || null,
  currentUser: localStorage.getItem('currentUser') || null,
  lastScriptId: null
};

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  log('App initializing...');
  updateAuthUI();
  checkServerConnection();
  setupEventListeners();
});

function setupEventListeners() {
  // Enter key support
  document.getElementById('scriptId').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') decodeScript();
  });
  document.getElementById('loginUsername').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') login();
  });
  document.getElementById('loginPassword').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') login();
  });
  document.getElementById('registerUsername').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') register();
  });
  document.getElementById('registerPassword').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') register();
  });
}

// ============================================================================
// UTILITIES
// ============================================================================

function log(message, data = null) {
  if (config.DEBUG) {
    console.log(`[CryptidX] ${message}`, data || '');
  }
}

function error(message, err = null) {
  console.error(`[CryptidX Error] ${message}`, err || '');
}

async function checkServerConnection() {
  try {
    const response = await fetch(`${config.API_BASE}/health`, { timeout: 5000 });
    if (response.ok) {
      updateConnectionStatus(true);
      log('Server connected');
    } else {
      updateConnectionStatus(false);
    }
  } catch (err) {
    updateConnectionStatus(false);
    error('Server connection failed', err);
  }
}

function updateConnectionStatus(connected) {
  const status = document.getElementById('connectionStatus');
  if (connected) {
    status.textContent = 'Connected';
    status.classList.remove('disconnected');
    status.classList.add('connected');
  } else {
    status.textContent = 'Disconnected';
    status.classList.remove('connected');
    status.classList.add('disconnected');
  }
}

function showTab(event, tabName) {
  if (event) event.preventDefault();

  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.remove('active');
  });

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  const tab = document.getElementById(tabName);
  if (tab) {
    tab.classList.add('active');
    log(`Switched to tab: ${tabName}`);
  }

  if (event && event.target) {
    event.target.classList.add('active');
  }

  if (tabName === 'keys' && state.authToken) {
    loadApiKeys();
  }
}

// ============================================================================
// API REQUESTS
// ============================================================================

async function apiRequest(endpoint, options = {}) {
  const method = options.method || 'GET';
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (state.authToken && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${state.authToken}`;
  }

  const fetchConfig = {
    method,
    headers,
    ...options
  };

  if (options.body && typeof options.body === 'object') {
    fetchConfig.body = JSON.stringify(options.body);
  }

  try {
    log(`API Request: ${method} ${endpoint}`);

    const response = await Promise.race([
      fetch(`${config.API_BASE}${endpoint}`, fetchConfig),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), config.TIMEOUT)
      )
    ]);

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    log(`API Response OK: ${endpoint}`, data);
    return data;
  } catch (err) {
    error(`API Error: ${endpoint}`, err);
    throw err;
  }
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

async function register() {
  const username = document.getElementById('registerUsername').value.trim();
  const password = document.getElementById('registerPassword').value;
  const passwordConfirm = document.getElementById('registerPasswordConfirm').value;

  const loadingDiv = document.getElementById('registerLoading');
  clearMessages('register');

  if (!username || !password) {
    showError('registerError', 'Username and password are required');
    return;
  }

  if (username.length < 3) {
    showError('registerError', 'Username must be at least 3 characters');
    return;
  }

  if (password.length < 6) {
    showError('registerError', 'Password must be at least 6 characters');
    return;
  }

  if (password !== passwordConfirm) {
    showError('registerError', 'Passwords do not match');
    return;
  }

  loadingDiv.classList.remove('hidden');

  try {
    const response = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: { username, password }
    });

    state.authToken = response.token;
    state.currentUser = response.user.username;

    localStorage.setItem('authToken', state.authToken);
    localStorage.setItem('currentUser', state.currentUser);

    showSuccess('registerSuccess', `Welcome ${response.user.username}`);
    log('Registration successful');

    document.getElementById('registerUsername').value = '';
    document.getElementById('registerPassword').value = '';
    document.getElementById('registerPasswordConfirm').value = '';

    updateAuthUI();

    setTimeout(() => clearMessages('register'), 3000);
  } catch (err) {
    showError('registerError', err.message);
  } finally {
    loadingDiv.classList.add('hidden');
  }
}

async function login() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  const loadingDiv = document.getElementById('loginLoading');
  clearMessages('login');

  if (!username || !password) {
    showError('loginError', 'Username and password are required');
    return;
  }

  loadingDiv.classList.remove('hidden');

  try {
    const response = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { username, password }
    });

    state.authToken = response.token;
    state.currentUser = response.user.username;

    localStorage.setItem('authToken', state.authToken);
    localStorage.setItem('currentUser', state.currentUser);

    showSuccess('loginSuccess', `Welcome back ${response.user.username}`);
    log('Login successful');

    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';

    updateAuthUI();

    setTimeout(() => clearMessages('login'), 3000);
  } catch (err) {
    showError('loginError', err.message);
  } finally {
    loadingDiv.classList.add('hidden');
  }
}

function logout() {
  state.authToken = null;
  state.currentUser = null;
  localStorage.removeItem('authToken');
  localStorage.removeItem('currentUser');
  updateAuthUI();
  log('Logged out');
}

function updateAuthUI() {
  const userInfo = document.getElementById('userInfo');
  const authRequired = document.getElementById('authRequired');
  const keysPanel = document.getElementById('keysPanel');

  if (state.authToken && state.currentUser) {
    userInfo.classList.remove('hidden');
    document.getElementById('currentUser').textContent = state.currentUser;
    authRequired.classList.add('hidden');
    keysPanel.classList.remove('hidden');
    log(`Logged in as ${state.currentUser}`);
  } else {
    userInfo.classList.add('hidden');
    authRequired.classList.remove('hidden');
    keysPanel.classList.add('hidden');
    log('Logged out');
  }
}

// ============================================================================
// DECODE
// ============================================================================

async function decodeScript() {
  const input = document.getElementById('scriptId').value.trim();
  const resultDiv = document.getElementById('decodeResult');
  const loadingDiv = document.getElementById('decodeLoading');
  const contentDiv = document.getElementById('scriptContent');

  clearMessages('decode');

  if (!input) {
    showError('decodeError', 'Please enter a script ID or URL');
    return;
  }

  loadingDiv.classList.remove('hidden');

  try {
    state.lastScriptId = input;

    const response = await apiRequest('/api/decode', {
      method: 'POST',
      body: {
        id: !input.includes('http') ? input : undefined,
        url: input.includes('http') ? input : undefined
      }
    });

    contentDiv.textContent = response.lua || 'No script content';
    resultDiv.classList.remove('hidden');
    log('Script decoded successfully');
  } catch (err) {
    showError('decodeError', err.message);
  } finally {
    loadingDiv.classList.add('hidden');
  }
}

function downloadScript() {
  const content = document.getElementById('scriptContent').textContent;
  const filename = `script-${state.lastScriptId || 'export'}-${Date.now()}.lua`;
  downloadFile(content, filename);
}

// ============================================================================
// API KEYS
// ============================================================================

async function loadApiKeys() {
  if (!state.authToken) return;

  const keysList = document.getElementById('keysList');
  const keysError = document.getElementById('keysError');
  const keysLoading = document.getElementById('keysLoading');

  keysList.innerHTML = '';
  keysError.classList.add('hidden');
  keysLoading.classList.remove('hidden');

  try {
    const response = await apiRequest('/api/keys', { method: 'GET' });

    keysLoading.classList.add('hidden');

    if (response.keys.length === 0) {
      keysList.innerHTML = '<p style="color: var(--text-secondary);">No API keys yet.</p>';
      return;
    }

    response.keys.forEach(key => {
      const keyItem = document.createElement('div');
      keyItem.className = 'key-item';
      keyItem.innerHTML = `
        <div class="key-item-info">
          <strong>${escapeHtml(key.label)}</strong>
          <small>Preview: ${key.preview}</small>
          <small>Created: ${new Date(key.createdAt).toLocaleDateString()}</small>
        </div>
        <div class="key-item-actions">
          <button onclick="regenerateApiKey('${key.id}')">Regenerate</button>
          <button onclick="deleteApiKey('${key.id}')\" style=\"background-color: var(--error-color);\">Delete</button>
        </div>
      `;
      keysList.appendChild(keyItem);
    });
    log(`Loaded ${response.keys.length} API keys`);
  } catch (err) {
    keysLoading.classList.add('hidden');
    showError('keysError', err.message);
  }
}

async function createApiKey() {
  if (!state.authToken) return;

  const label = document.getElementById('keyLabel').value.trim();
  const resultDiv = document.getElementById('createKeyResult');
  const contentDiv = document.getElementById('newKeyContent');

  if (!label) {
    alert('Please enter a label for the API key');
    return;
  }

  try {
    const response = await apiRequest('/api/keys', {
      method: 'POST',
      body: { label }
    });

    contentDiv.textContent = response.key;
    resultDiv.classList.remove('hidden');
    document.getElementById('keyLabel').value = '';

    log('API key created successfully');
    loadApiKeys();
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

async function deleteApiKey(keyId) {
  if (!state.authToken || !confirm('Delete this API key?')) return;

  try {
    await apiRequest(`/api/keys/${keyId}`, { method: 'DELETE' });
    log('API key deleted');
    loadApiKeys();
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

async function regenerateApiKey(keyId) {
  if (!state.authToken) return;

  try {
    const response = await apiRequest(`/api/keys/${keyId}/regenerate`, { method: 'POST' });

    document.getElementById('newKeyContent').textContent = response.key;
    document.getElementById('createKeyResult').classList.remove('hidden');

    log('API key regenerated');
    loadApiKeys();
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

// ============================================================================
// UI HELPERS
// ============================================================================

function showError(elementId, message) {
  const element = document.getElementById(elementId);
  element.textContent = message;
  element.classList.remove('hidden');
}

function showSuccess(elementId, message) {
  const element = document.getElementById(elementId);
  element.textContent = message;
  element.classList.remove('hidden');
}

function clearMessages(type) {
  if (type === 'login') {
    document.getElementById('loginError').classList.add('hidden');
    document.getElementById('loginSuccess').classList.add('hidden');
  } else if (type === 'register') {
    document.getElementById('registerError').classList.add('hidden');
    document.getElementById('registerSuccess').classList.add('hidden');
  } else if (type === 'decode') {
    document.getElementById('decodeError').classList.add('hidden');
  }
}

function copyToClipboard(elementId) {
  const element = document.getElementById(elementId);
  const text = element.textContent;
  navigator.clipboard.writeText(text).then(() => {
    const button = event.target;
    const originalText = button.textContent;
    button.textContent = 'Copied';
    setTimeout(() => {
      button.textContent = originalText;
    }, 2000);
    log('Copied to clipboard');
  }).catch(() => {
    alert('Failed to copy to clipboard');
  });
}

function downloadFile(content, filename) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  log(`Downloaded file: ${filename}`);
}

function downloadKey() {
  const content = document.getElementById('newKeyContent').textContent;
  downloadFile(content, `api-key-${Date.now()}.txt`);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showAPIStatus() {
  alert(`API Status\nBackend: ${config.API_BASE}\nToken: ${state.authToken ? 'Active' : 'None'}\nUser: ${state.currentUser || 'Not logged in'}`);
}