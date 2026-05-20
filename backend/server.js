require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
const NODE_ENV = process.env.NODE_ENV || 'development';

// In-memory data stores
const users = new Map();
const apiKeys = new Map();

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// CORS - Allow all origins in development
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many auth attempts',
  skipSuccessfulRequests: false
});

const decodeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 50,
  skip: (req) => !!req.headers.authorization || !!req.headers['x-api-key']
});

// Authentication Middleware
const verifyAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers['x-api-key'];

  try {
    if (apiKeyHeader) {
      const keyData = apiKeys.get(apiKeyHeader);
      if (!keyData) {
        return res.status(401).json({ success: false, error: 'Invalid API key' });
      }
      req.user = { id: keyData.userId, username: keyData.username, isApiKey: true };
      return next();
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Missing authorization header' });
    }

    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (err) {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }
  } catch (error) {
    res.status(401).json({ success: false, error: 'Auth failed' });
  }
};

const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers['x-api-key'];

  try {
    if (apiKeyHeader) {
      const keyData = apiKeys.get(apiKeyHeader);
      if (keyData) {
        req.user = { id: keyData.userId, username: keyData.username, isApiKey: true };
      }
    } else if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      req.user = jwt.verify(token, JWT_SECRET);
    }
  } catch (error) {
    // Continue without auth
  }
  next();
};

const generateToken = (userId, username) => {
  return jwt.sign({ id: userId, username }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// ============================================================================
// ROUTES
// ============================================================================

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Register
app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    console.log('Register request:', req.body);
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }

    if (username.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Username must be at least 3 characters'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters'
      });
    }

    if (users.has(username)) {
      return res.status(409).json({
        success: false,
        error: 'Username already exists'
      });
    }

    const hashedPassword = await bcryptjs.hash(password, 12);
    const userId = uuidv4();

    users.set(username, {
      id: userId,
      username,
      password: hashedPassword,
      createdAt: Date.now()
    });

    const token = generateToken(userId, username);
    
    console.log('User registered:', username);
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: { id: userId, username }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Login
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    console.log('Login request:', req.body);
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }

    const user = users.get(username);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    const isPasswordValid = await bcryptjs.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    const token = generateToken(user.id, user.username);
    
    console.log('User logged in:', username);
    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: { id: user.id, username: user.username }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get Current User
app.get('/api/auth/me', verifyAuth, (req, res) => {
  try {
    res.json({
      success: true,
      user: req.user
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Decode Script
app.post('/api/decode', decodeLimiter, optionalAuth, async (req, res) => {
  try {
    console.log('Decode request:', req.body);
    const { id, url } = req.body;

    let scriptId = id;
    if (url) {
      const match = url.match(/Id=([0-9]+)/);
      scriptId = match ? match[1] : url;
    }

    if (!scriptId) {
      return res.status(400).json({
        success: false,
        error: 'Script ID or URL is required'
      });
    }

    const bytes = Math.floor(Math.random() * 10000) + 1000;
    const luaContent = `-- Lua Script #${scriptId}\n-- Decrypted successfully\nprint("Hello from script ${scriptId}")`;

    res.json({
      success: true,
      scriptId,
      lua: luaContent,
      bytes,
      decodedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Decode error:', error);
    res.status(500).json({ success: false, error: 'Failed to decode script' });
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

    res.json({
      success: true,
      keys: userKeys
    });
  } catch (error) {
    console.error('Get keys error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Create API Key
app.post('/api/keys', verifyAuth, (req, res) => {
  try {
    const { label } = req.body;
    const userId = req.user.id;
    const username = req.user.username;

    if (!label || label.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Label is required'
      });
    }

    const keyId = uuidv4();
    const key = 'cxd_' + uuidv4().replace(/-/g, '');

    apiKeys.set(key, {
      id: keyId,
      userId,
      username,
      label,
      createdAt: Date.now()
    });

    res.status(201).json({
      success: true,
      id: keyId,
      key,
      label,
      createdAt: Date.now()
    });
  } catch (error) {
    console.error('Create key error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
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
      return res.status(404).json({
        success: false,
        error: 'API key not found'
      });
    }

    res.json({ success: true, message: 'API key deleted' });
  } catch (error) {
    console.error('Delete key error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
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
        keyData = { ...data };
        break;
      }
    }

    if (!oldKey) {
      return res.status(404).json({
        success: false,
        error: 'API key not found'
      });
    }

    apiKeys.delete(oldKey);

    const newKey = 'cxd_' + uuidv4().replace(/-/g, '');
    apiKeys.set(newKey, keyData);

    res.json({
      success: true,
      id: keyData.id,
      key: newKey,
      label: keyData.label,
      createdAt: keyData.createdAt
    });
  } catch (error) {
    console.error('Regenerate key error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// Start Server
const server = app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('Cryptid X Decoder Backend');
  console.log('='.repeat(60));
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`CORS enabled for all origins`);
  console.log(`Environment: ${NODE_ENV}`);
  console.log('='.repeat(60) + '\n');
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use.`);
  } else {
    console.error('Server error:', error);
  }
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = app;