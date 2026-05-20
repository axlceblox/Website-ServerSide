// Configuration
const API_BASE = window.CRYPTID_API_BASE || 'http://localhost:3001';

// State
let authToken = localStorage.getItem('authToken') || null;
let currentUser = localStorage.getItem('currentUser') || null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  updateAuthUI();
});

// Tab Management
function showTab(tabName) {
  // Hide all tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.remove('active');
  });

  // Remove active class from all buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  // Show selected tab
  document.getElementById(tabName).classList.add('active');

  // Add active class to clicked button
  event.target.classList.add('active');

  // Load data if needed
  if (tabName === 'keys' && authToken) {
    loadApiKeys();
  }
}

// Auth Functions
async function register() {
  const username = document.getElementById('registerUsername').value;
  const password = document.getElementById('registerPassword').value;
  const errorDiv = document.getElementById('registerError');
  const successDiv = document.getElementById('registerSuccess');

  errorDiv.classList.add('hidden');
  successDiv.classList.add('hidden');

  if (!username || !password) {
    errorDiv.textContent = 'Please fill in all fields';
    errorDiv.classList.remove('hidden');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    authToken = data.token;
    currentUser = data.username;
    localStorage.setItem('authToken', authToken);
    localStorage.setItem('currentUser', currentUser);

    successDiv.textContent = `Registration successful! Welcome, ${currentUser}`;
    successDiv.classList.remove('hidden');

    document.getElementById('registerUsername').value = '';
    document.getElementById('registerPassword').value = '';

    updateAuthUI();

    setTimeout(() => {
      successDiv.classList.add('hidden');
    }, 3000);
  } catch (error) {
    errorDiv.textContent = error.message;
    errorDiv.classList.remove('hidden');
  }
}

async function login() {
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;
  const errorDiv = document.getElementById('loginError');
  const successDiv = document.getElementById('loginSuccess');

  errorDiv.classList.add('hidden');
  successDiv.classList.add('hidden');

  if (!username || !password) {
    errorDiv.textContent = 'Please fill in all fields';
    errorDiv.classList.remove('hidden');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    authToken = data.token;
    currentUser = data.username;
    localStorage.setItem('authToken', authToken);
    localStorage.setItem('currentUser', currentUser);

    successDiv.textContent = `Login successful! Welcome back, ${currentUser}`;
    successDiv.classList.remove('hidden');

    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';

    updateAuthUI();

    setTimeout(() => {
      successDiv.classList.add('hidden');
    }, 3000);
  } catch (error) {
    errorDiv.textContent = error.message;
    errorDiv.classList.remove('hidden');
  }
}

function logout() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('authToken');
  localStorage.removeItem('currentUser');
  updateAuthUI();
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
}

function updateAuthUI() {
  const userInfo = document.getElementById('userInfo');
  const authRequired = document.getElementById('authRequired');
  const keysPanel = document.getElementById('keysPanel');

  if (authToken && currentUser) {
    userInfo.classList.remove('hidden');
    document.getElementById('currentUser').textContent = currentUser;
    authRequired.classList.add('hidden');
    keysPanel.classList.remove('hidden');
  } else {
    userInfo.classList.add('hidden');
    authRequired.classList.remove('hidden');
    keysPanel.classList.add('hidden');
  }
}

// Decode Functions
async function decodeScript() {
  const input = document.getElementById('scriptId').value;
  const resultDiv = document.getElementById('decodeResult');
  const errorDiv = document.getElementById('decodeError');
  const contentDiv = document.getElementById('scriptContent');

  resultDiv.classList.add('hidden');
  errorDiv.classList.add('hidden');

  if (!input) {
    errorDiv.textContent = 'Please enter a script ID or URL';
    errorDiv.classList.remove('hidden');
    return;
  }

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${API_BASE}/api/decode`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: !input.includes('http') ? input : undefined,
        url: input.includes('http') ? input : undefined
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Decode failed');
    }

    contentDiv.textContent = data.lua || 'No script content';
    resultDiv.classList.remove('hidden');
  } catch (error) {
    errorDiv.textContent = error.message;
    errorDiv.classList.remove('hidden');
  }
}

// API Key Functions
async function loadApiKeys() {
  if (!authToken) return;

  const keysList = document.getElementById('keysList');
  const keysError = document.getElementById('keysError');

  keysList.innerHTML = '';
  keysError.classList.add('hidden');

  try {
    const response = await fetch(`${API_BASE}/api/keys`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to load keys');
    }

    if (data.keys.length === 0) {
      keysList.innerHTML = '<p style="color: var(--text-secondary);">No API keys yet. Create one to get started.</p>';
      return;
    }

    data.keys.forEach(key => {
      const keyItem = document.createElement('div');
      keyItem.className = 'key-item';
      keyItem.innerHTML = `
        <div class="key-item-info">
          <strong>${key.label}</strong>
          <small>Preview: ${key.preview}</small>
          <small>Created: ${new Date(key.createdAt).toLocaleDateString()}</small>
        </div>
        <div class="key-item-actions">
          <button onclick="regenerateApiKey('${key.id}')">Regenerate</button>
          <button onclick="deleteApiKey('${key.id}')" style="background-color: var(--error-color);">Delete</button>
        </div>
      `;
      keysList.appendChild(keyItem);
    });
  } catch (error) {
    keysError.textContent = error.message;
    keysError.classList.remove('hidden');
  }
}

async function createApiKey() {
  if (!authToken) return;

  const label = document.getElementById('keyLabel').value;
  const resultDiv = document.getElementById('createKeyResult');
  const contentDiv = document.getElementById('newKeyContent');

  if (!label) {
    alert('Please enter a label for the API key');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/keys`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ label })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to create key');
    }

    contentDiv.textContent = data.key;
    resultDiv.classList.remove('hidden');
    document.getElementById('keyLabel').value = '';

    loadApiKeys();
  } catch (error) {
    alert(error.message);
  }
}

async function deleteApiKey(keyId) {
  if (!authToken || !confirm('Are you sure you want to delete this API key?')) return;

  try {
    const response = await fetch(`${API_BASE}/api/keys/${keyId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to delete key');
    }

    loadApiKeys();
  } catch (error) {
    alert(error.message);
  }
}

async function regenerateApiKey(keyId) {
  if (!authToken) return;

  try {
    const response = await fetch(`${API_BASE}/api/keys/${keyId}/regenerate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to regenerate key');
    }

    document.getElementById('newKeyContent').textContent = data.key;
    document.getElementById('createKeyResult').classList.remove('hidden');

    loadApiKeys();
  } catch (error) {
    alert(error.message);
  }
}

// Utility Functions
function copyToClipboard(elementId) {
  const element = document.getElementById(elementId);
  const text = element.textContent;
  navigator.clipboard.writeText(text).then(() => {
    const button = event.target;
    const originalText = button.textContent;
    button.textContent = '✓ Copied!';
    setTimeout(() => {
      button.textContent = originalText;
    }, 2000);
  }).catch(() => {
    alert('Failed to copy to clipboard');
  });
}