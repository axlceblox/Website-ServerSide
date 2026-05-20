'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// In-memory API key store: apiKey → { owner, label, createdAt }
// Shared with server.js via module.exports
const apiKeyStore = new Map();

function generateApiKey() {
  return `cxd_${uuidv4().replace(/-/g, '')}`;
}

// All routes require JWT auth
router.use(requireAuth);

/**
 * GET /api/keys
 * Returns all API keys for the authenticated user (masked).
 */
router.get('/', (req, res) => {
  const { username } = req.user;
  const keys = [];
  for (const [key, entry] of apiKeyStore) {
    if (entry.owner === username) {
      keys.push({
        id: entry.id,
        label: entry.label,
        preview: `${key.slice(0, 8)}...${key.slice(-4)}`,
        createdAt: entry.createdAt
      });
    }
  }
  return res.json({ keys });
});

/**
 * POST /api/keys
 * Body: { label }
 * Creates a new API key for the authenticated user.
 */
router.post('/', (req, res) => {
  const { username } = req.user;
  const label = (req.body?.label || 'Default').trim().slice(0, 64);

  // Limit keys per user
  const userKeys = [...apiKeyStore.values()].filter(e => e.owner === username);
  if (userKeys.length >= 10) {
    return res.status(429).json({ error: 'Maximum of 10 API keys per account.' });
  }

  const key = generateApiKey();
  const id = uuidv4();
  apiKeyStore.set(key, { id, owner: username, label, createdAt: Date.now() });

  // Return the full key ONCE — after this only the preview is available
  return res.status(201).json({ id, key, label, createdAt: Date.now() });
});

/**
 * DELETE /api/keys/:id
 * Body: { password } — required for destructive action
 */
router.delete('/:id', async (req, res) => {
  const { username } = req.user;
  const { id } = req.params;

  // Find the key by ID
  let targetKey = null;
  for (const [key, entry] of apiKeyStore) {
    if (entry.id === id && entry.owner === username) {
      targetKey = key;
      break;
    }
  }

  if (!targetKey) {
    return res.status(404).json({ error: 'API key not found.' });
  }

  apiKeyStore.delete(targetKey);
  return res.json({ success: true });
});

/**
 * POST /api/keys/:id/regenerate
 * Creates a new key value for an existing key entry.
 */
router.post('/:id/regenerate', (req, res) => {
  const { username } = req.user;
  const { id } = req.params;

  let oldKey = null;
  let entry = null;
  for (const [key, e] of apiKeyStore) {
    if (e.id === id && e.owner === username) {
      oldKey = key;
      entry = e;
      break;
    }
  }

  if (!oldKey) {
    return res.status(404).json({ error: 'API key not found.' });
  }

  apiKeyStore.delete(oldKey);
  const newKey = generateApiKey();
  apiKeyStore.set(newKey, { ...entry, createdAt: Date.now() });

  return res.json({ id, key: newKey, label: entry.label, createdAt: Date.now() });
});

module.exports = { router, apiKeyStore };
