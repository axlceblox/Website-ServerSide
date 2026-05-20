'use strict';

require('dotenv').config();

const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
const fetch = require('node-fetch');
const crypto = require('crypto');

// ── Validate environment ──────────────────────────────────────────────────────
const REQUIRED_ENV = ['DISCORD_TOKEN', 'CRYPTID_API_URL', 'CRYPTID_API_KEY'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[FATAL] Missing env var: ${key}`);
    process.exit(1);
  }
}

const BOT_PREFIX = process.env.BOT_PREFIX || '!';
const API_URL = process.env.CRYPTID_API_URL;
const API_KEY = process.env.CRYPTID_API_KEY;

const SCRIPT_ID_PATTERN = /^\d{10,20}$/;
const URL_ID_PATTERN = /[?&]Id=(\d{10,20})/i;

function parseScriptId(input) {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(URL_ID_PATTERN);
  if (urlMatch) return urlMatch[1];
  if (SCRIPT_ID_PATTERN.test(trimmed)) return trimmed;
  return null;
}

function randomFilename(scriptId) {
  const rand = crypto.randomBytes(6).toString('hex');
  return `decoded_${rand}.txt`;
}

// ── Discord client ────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', () => {
  console.log(`[Cryptid X Bot] Logged in as ${client.user.tag}`);
  client.user.setActivity('decoding scripts', { type: 0 });
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(`${BOT_PREFIX}decode`)) return;

  // Parse argument
  const parts = message.content.slice(`${BOT_PREFIX}decode`.length).trim();
  if (!parts) {
    return message.reply({
      content: '```\nUsage: !decode <Script ID or full URL>\nExample: !decode 2723928466610\n```'
    });
  }

  const scriptId = parseScriptId(parts);
  if (!scriptId) {
    return message.reply({
      content: '❌ **Invalid input.** Provide a numeric Script ID (10–20 digits) or a full `?Id=...` URL.'
    });
  }

  // "Thinking" state
  let thinkingMsg;
  try {
    thinkingMsg = await message.reply({
      content: `⏳ Decoding \`${scriptId}\`... please wait.`
    });
  } catch {
    return;
  }

  try {
    const res = await fetch(`${API_URL}/api/decode`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify({ id: scriptId })
    });

    const data = await res.json();

    if (!res.ok) {
      await thinkingMsg.edit({
        content: `❌ **Decode failed:** ${data.error || `HTTP ${res.status}`}`
      });
      return;
    }

    const { lua, bytes } = data;

    // Upload as a randomized .txt file attachment
    const filename = randomFilename(scriptId);
    const attachment = new AttachmentBuilder(Buffer.from(lua, 'utf8'), { name: filename });

    await thinkingMsg.edit({
      content: [
        `✅ **Script \`${scriptId}\` decrypted successfully!**`,
        `📦 Size: \`${formatBytes(bytes)}\``,
        `📄 File: \`${filename}\``,
        ``,
        `> ⚠️ You requested this decode. Ensure you are authorized to access this script.`
      ].join('\n'),
      files: [attachment]
    });

  } catch (err) {
    console.error('[Bot decode error]', err);
    await thinkingMsg.edit({
      content: '❌ **Error:** Could not reach the Cryptid X backend. Try again later.'
    });
  }
});

// ── Help command ──────────────────────────────────────────────────────────────
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(`${BOT_PREFIX}cxhelp`)) return;

  await message.reply({
    content: [
      '```',
      'Cryptid X Decoder — Commands',
      '─────────────────────────────',
      `${BOT_PREFIX}decode <ID or URL>   Decode a script by numeric ID or full URL`,
      `${BOT_PREFIX}cxhelp               Show this help message`,
      '',
      'Examples:',
      `  ${BOT_PREFIX}decode 2723928466610`,
      `  ${BOT_PREFIX}decode https://encrypt-x.pages.dev/Scripts?Id=2723928466610`,
      '```'
    ].join('\n')
  });
});

function formatBytes(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

// ── Login ─────────────────────────────────────────────────────────────────────
client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error('[FATAL] Discord login failed:', err.message);
  process.exit(1);
});
