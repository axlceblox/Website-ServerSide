'use strict';

const SCRIPT_ID_PATTERN = /^\d{10,20}$/;
const URL_PATTERN = /[?&]Id=(\d{10,20})/i;

/**
 * Extracts a numeric Script ID from either a full URL or a raw ID string.
 * Returns null if invalid.
 */
function parseScriptId(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();

  // Try full URL first
  const urlMatch = trimmed.match(URL_PATTERN);
  if (urlMatch) return urlMatch[1];

  // Try bare numeric ID
  if (SCRIPT_ID_PATTERN.test(trimmed)) return trimmed;

  return null;
}

/**
 * Express middleware: validates { id } in req.body, attaches req.scriptId.
 */
function validateDecodeRequest(req, res, next) {
  const raw = req.body?.id;
  if (!raw) {
    return res.status(400).json({ error: 'Missing required field: id' });
  }
  const scriptId = parseScriptId(String(raw));
  if (!scriptId) {
    return res.status(400).json({
      error: 'Invalid ID format. Provide a numeric Script ID (10–20 digits) or a full URL containing ?Id=...'
    });
  }
  req.scriptId = scriptId;
  next();
}

module.exports = { parseScriptId, validateDecodeRequest };
