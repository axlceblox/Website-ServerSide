require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-not-for-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';

// In-memory data stores (replace with database in production)
const users = new Map();
const apiKeys = new Map();

// Middleware
app.use(express.json());
app.use(cors({
  origin: ALLOWED_ORIGIN,
  credentials: true
}));

// Rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per windowMs
  message: 'Too many requests, please try again later.'
});

const decodeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute
  skip: (req) => !!req.headers.authorization
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many auth attempts, please try again later.'
});

app.use(globalLimiter);

// Middleware: Authentication
const verifyAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers['x-api-key'];

  if (apiKeyHeader) {
    const keyData = apiKeys.get(apiKeyHeader);
    if (!keyData) return res.status(401).json({ error: 'Invalid API key' });
    req.user = { id: keyData.userId, isApiKey: true };
    return next();
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization' });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Middleware: Optional Auth (for decode endpoint)
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers['x-api-key'];

  if (apiKeyHeader) {
    const keyData = apiKeys.get(apiKeyHeader);
    if (keyData) {
      req.user = { id: keyData.userId, isApiKey: true };
    }
  } else if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      req.user = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      // Continue without auth
    }
  }
  next();
};

// Helper: Generate JWT
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// Routes

// Register
app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    if (users.has(username)) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcryptjs.hash(password, 12);
    const userId = uuidv4();

    users.set(username, {
      id: userId,
      password: hashedPassword,
      createdAt: Date.now()
    });

    const token = generateToken(userId);
    res.json({ token, username });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const user = users.get(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isPasswordValid = await bcryptjs.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user.id);
    res.json({ token, username });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Decode (public endpoint with optional auth)
app.post('/api/decode', decodeLimiter, optionalAuth, async (req, res) => {
  try {
    const { id, url } = req.body;

    let scriptId = id;
    if (url) {
      const match = url.match(/Id=([0-9]+)/);
      scriptId = match ? match[1] : url;
    }

    if (!scriptId) {
      return res.status(400).json({ error: 'Script ID or URL required' });
    }

    // Simulate decryption (implement actual decryption logic)
    // This is a placeholder - implement actual GitHub fetch and decryption
    const bytes = Math.floor(Math.random() * 10000);

    res.json({
      scriptId,
      lua: '-- Decrypted Lua script would appear here',
      bytes
    });
  } catch (error) {
    console.error('Decode error:', error);
    res.status(500).json({ error: 'Failed to decode script' });
  }
});

// Get API Keys
app.get('/api/keys', verifyAuth, (req, res) => {
  try {
    const userId = req.user.id;
    const userKeys = Array.from(apiKeys.entries())
      .filter(([_, data]) => data.userId === userId)
      .map(([key, data]) => ({
        id: data.id,
        label: data.label,
        preview: key.substring(0, 8) + '...' + key.substring(key.length - 4),
        createdAt: data.createdAt
      }));

    res.json({ keys: userKeys });
  } catch (error) {
    console.error('Get keys error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create API Key
app.post('/api/keys', verifyAuth, (req, res) => {
  try {
    const { label } = req.body;
    const userId = req.user.id;

    if (!label) {
      return res.status(400).json({ error: 'Label required' });
    }

    const keyId = uuidv4();
    const key = 'cxd_' + uuidv4().replace(/-/g, '');

    apiKeys.set(key, {
      id: keyId,
      userId,
      label,
      createdAt: Date.now()
    });

    res.json({
      id: keyId,
      key,
      label,
      createdAt: Date.now()
    });
  } catch (error) {
    console.error('Create key error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete API Key
app.delete('/api/keys/:id', verifyAuth, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    let found = false;
    for (const [key, data] of apiKeys.entries()) {
      if (data.id === id && data.userId === userId) {
        apiKeys.delete(key);
        found = true;
        break;
      }
    }

    if (!found) {
      return res.status(404).json({ error: 'Key not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete key error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Regenerate API Key
app.post('/api/keys/:id/regenerate', verifyAuth, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    let oldKey = null;
    let keyData = null;

    for (const [key, data] of apiKeys.entries()) {
      if (data.id === id && data.userId === userId) {
        oldKey = key;
        keyData = data;
        break;
      }
    }

    if (!oldKey) {
      return res.status(404).json({ error: 'Key not found' });
    }

    apiKeys.delete(oldKey);

    const newKey = 'cxd_' + uuidv4().replace(/-/g, '');
    apiKeys.set(newKey, keyData);

    res.json({
      id: keyData.id,
      key: newKey,
      label: keyData.label,
      createdAt: keyData.createdAt
    });
  } catch (error) {
    console.error('Regenerate key error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log(`CORS enabled for: ${ALLOWED_ORIGIN}`);
});

module.exports = app;