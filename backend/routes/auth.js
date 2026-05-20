'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const router = express.Router();

// In-memory user store — replace with a real DB in production
const users = new Map();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const BCRYPT_ROUNDS = 12;

function validateCredentials(username, password) {
  if (!username || typeof username !== 'string' || username.trim().length < 3) {
    return 'Username must be at least 3 characters.';
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username.trim())) {
    return 'Username may only contain letters, numbers, underscores, hyphens, and dots.';
  }
  return null;
}

/**
 * POST /api/auth/register
 * Body: { username, password }
 */
router.post('/register', async (req, res) => {
  const { username, password } = req.body || {};
  const validationError = validateCredentials(username, password);
  if (validationError) return res.status(400).json({ error: validationError });

  const normalized = username.trim().toLowerCase();
  if (users.has(normalized)) {
    return res.status(409).json({ error: 'Username already taken.' });
  }

  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  users.set(normalized, { username: normalized, hash, createdAt: Date.now() });

  const token = jwt.sign({ username: normalized }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  return res.status(201).json({ token, username: normalized });
});

/**
 * POST /api/auth/login
 * Body: { username, password }
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const normalized = username.trim().toLowerCase();
  const user = users.get(normalized);
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const match = await bcrypt.compare(password, user.hash);
  if (!match) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const token = jwt.sign({ username: normalized }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  return res.json({ token, username: normalized });
});

module.exports = router;
