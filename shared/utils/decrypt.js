/**
 * Cryptid X Decoder — Shared Decryption Utility
 * Server-side only. Never expose this to the frontend bundle.
 */

'use strict';

// Standard RFC-4648 Base32 alphabet: A–Z + 2–7
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const BASE32_LOOKUP = new Map([...BASE32_ALPHABET].map((c, i) => [c, i]));

/**
 * Decodes a Base32-encoded string (RFC-4648) to a Buffer.
 * @param {string} input
 * @returns {Buffer}
 */
function base32Decode(input) {
  const str = input.toUpperCase().replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  const output = [];

  for (const char of str) {
    const val = BASE32_LOOKUP.get(char);
    if (val === undefined) {
      throw new Error(`Invalid Base32 character: '${char}'`);
    }
    value = (value << 5) | val;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(output);
}

/**
 * XOR-decrypts a buffer using a cycling key string.
 * @param {Buffer} data
 * @param {string} key
 * @returns {Buffer}
 */
function xorDecrypt(data, key) {
  const keyBytes = Buffer.from(key, 'utf8');
  const output = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) {
    output[i] = data[i] ^ keyBytes[i % keyBytes.length];
  }
  return output;
}

/**
 * Validates the decrypted output looks like Lua source.
 * @param {string} text
 * @returns {boolean}
 */
function looksLikeLua(text) {
  // Heuristic: Lua files tend to have these patterns
  return /[\x20-\x7E\n\r\t]/.test(text);
}

/**
 * Full decode pipeline: Base32 → XOR → UTF-8 Lua string
 * @param {string} encodedScript  — the Script field from JSON
 * @param {string} key            — the Key field from JSON
 * @returns {{ lua: string, bytes: number }}
 */
function decodeScript(encodedScript, key) {
  if (!encodedScript || typeof encodedScript !== 'string') {
    throw new Error('Script field is missing or invalid.');
  }
  if (!key || typeof key !== 'string') {
    throw new Error('Key field is missing or invalid.');
  }

  const decoded = base32Decode(encodedScript.trim());
  const decrypted = xorDecrypt(decoded, key);
  const lua = decrypted.toString('utf8');

  if (!looksLikeLua(lua)) {
    throw new Error('Decryption produced non-printable output. Key or data may be corrupt.');
  }

  return { lua, bytes: decrypted.length };
}

module.exports = { decodeScript, base32Decode, xorDecrypt };
