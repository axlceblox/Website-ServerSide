'use strict';

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const decodeRoute = require('./routes/decode');
const authRoute = require('./routes/auth');
const { router: keysRoute, apiKeyStore } = require('./routes/keys');
const { requireApiKey } = require('./middleware/auth');

// ── Validate required environment variables ──────────────────────────────────
const REQUIRED_ENV = ['JWT_SECRET', 'ALLOWED_ORIGIN'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[FATAL] Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const app = express();
const PORT = process.env.PORT || 3001;

// ── Security headers ─────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'"]
    }
  }
}));

// ── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN,
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '16kb' }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' }
});

const decodeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Decode rate limit exceeded. Max 20 requests/minute.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many auth attempts. Try again in 15 minutes.' }
});

app.use(globalLimiter);

// ── Routes ────────────────────────────────────────────────────────────────────

// Public decode — accepts either JWT or API key
app.post('/api/decode', decodeLimiter, (req, res, next) => {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'];
  if (apiKey) {
    return requireApiKey(apiKeyStore)(req, res, next);
  }
  // No auth required for public decode — comment this out to require auth
  next();
}, decodeRoute);

app.use('/api/auth', authLimiter, authRoute);
app.use('/api/keys', keysRoute);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', ts: Date.now() }));

// ── 404 & error handler ───────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Not found.' }));

app.use((err, req, res, _next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[Cryptid X Backend] Listening on port ${PORT}`);
});

module.exports = app;
