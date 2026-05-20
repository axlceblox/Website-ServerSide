'use strict';

const express = require('express');
const fetch = require('node-fetch');
const { decodeScript } = require('../../shared/utils/decrypt');
const { validateDecodeRequest } = require('../middleware/validation');

const router = express.Router();

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/ScriptObfuscator2/Scripts/main/';
const FETCH_TIMEOUT_MS = 10_000;

/**
 * POST /api/decode
 * Body: { id: string }  (numeric ID or full URL)
 * Returns: { lua: string, bytes: number, scriptId: string }
 */
router.post('/', validateDecodeRequest, async (req, res) => {
  const { scriptId } = req;

  let rawJson;
  try {
    const url = `${GITHUB_RAW_BASE}${scriptId}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (response.status === 404) {
      return res.status(404).json({ error: `Script ID ${scriptId} not found in the repository.` });
    }
    if (!response.ok) {
      return res.status(502).json({ error: `Repository returned HTTP ${response.status}.` });
    }
    rawJson = await response.text();
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Request to GitHub timed out. Try again.' });
    }
    return res.status(502).json({ error: `Failed to fetch script data: ${err.message}` });
  }

  let payload;
  try {
    payload = JSON.parse(rawJson);
  } catch {
    return res.status(502).json({ error: 'Received malformed JSON from repository.' });
  }

  const { Key, Script } = payload;
  if (!Key || !Script) {
    return res.status(502).json({ error: 'Repository JSON is missing Key or Script fields.' });
  }

  let result;
  try {
    result = decodeScript(Script, Key);
  } catch (err) {
    return res.status(422).json({ error: `Decryption failed: ${err.message}` });
  }

  return res.json({
    scriptId,
    lua: result.lua,
    bytes: result.bytes
  });
});

module.exports = router;
