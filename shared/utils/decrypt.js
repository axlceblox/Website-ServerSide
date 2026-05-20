/**
 * Cryptid X Decryption Utility
 * Base32 → XOR decryption algorithm
 */

// Base32 alphabet (RFC-4648)
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Decode a Base32 encoded string
 * @param {string} encoded - Base32 encoded string
 * @returns {Buffer} Decoded bytes
 */
function base32Decode(encoded) {
  const normalized = encoded.toUpperCase().replace(/=/g, '');
  const bits = normalized.split('').reduce((acc, char) => {
    const value = BASE32_ALPHABET.indexOf(char);
    if (value === -1) {
      throw new Error(`Invalid Base32 character: ${char}`);
    }
    return acc + value.toString(2).padStart(5, '0');
  }, '');

  const bytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    const byte = bits.substring(i, i + 8);
    if (byte.length === 8) {
      bytes.push(parseInt(byte, 2));
    }
  }

  return Buffer.from(bytes);
}

/**
 * XOR decrypt data using a key
 * @param {Buffer} data - Encrypted data
 * @param {string} key - XOR key
 * @returns {Buffer} Decrypted data
 */
function xorDecrypt(data, key) {
  const keyBuffer = Buffer.from(key, 'utf-8');
  const result = Buffer.alloc(data.length);

  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ keyBuffer[i % keyBuffer.length];
  }

  return result;
}

/**
 * Decrypt a Cryptid X script
 * @param {string} encryptedScript - Base32 encoded encrypted script
 * @param {string} key - XOR key for decryption
 * @returns {string} Decrypted Lua source code
 */
function decrypt(encryptedScript, key) {
  try {
    // Step 1: Base32 decode
    const decodedBytes = base32Decode(encryptedScript);

    // Step 2: XOR decrypt
    const decryptedBytes = xorDecrypt(decodedBytes, key);

    // Step 3: Interpret as UTF-8
    return decryptedBytes.toString('utf-8');
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

/**
 * Encrypt Lua source code to Cryptid X format
 * @param {string} luaSource - Lua source code to encrypt
 * @param {string} key - XOR key for encryption
 * @returns {string} Base32 encoded encrypted data
 */
function encrypt(luaSource, key) {
  try {
    // Step 1: Convert to bytes
    const sourceBytes = Buffer.from(luaSource, 'utf-8');

    // Step 2: XOR encrypt
    const keyBuffer = Buffer.from(key, 'utf-8');
    const encrypted = Buffer.alloc(sourceBytes.length);

    for (let i = 0; i < sourceBytes.length; i++) {
      encrypted[i] = sourceBytes[i] ^ keyBuffer[i % keyBuffer.length];
    }

    // Step 3: Base32 encode
    let bits = '';
    for (let i = 0; i < encrypted.length; i++) {
      bits += encrypted[i].toString(2).padStart(8, '0');
    }

    let encoded = '';
    for (let i = 0; i < bits.length; i += 5) {
      const chunk = bits.substring(i, i + 5).padEnd(5, '0');
      encoded += BASE32_ALPHABET[parseInt(chunk, 2)];
    }

    return encoded;
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

module.exports = {
  decrypt,
  encrypt,
  base32Decode,
  xorDecrypt
};