'use strict';

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Middleware: require a valid JWT Bearer token.
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

/**
 * Middleware: require a valid API key in X-API-Key header.
 * Checks against in-memory store (replace with DB in production).
 */
function requireApiKey(apiKeyStore) {
  return (req, res, next) => {
    const key = req.headers['x-api-key'];
    if (!key) {
      return res.status(401).json({ error: 'API key required.' });
    }
    const entry = apiKeyStore.get(key);
    if (!entry) {
      return res.status(401).json({ error: 'Invalid API key.' });
    }
    req.apiKeyEntry = entry;
    next();
  };
}

module.exports = { requireAuth, requireApiKey };
