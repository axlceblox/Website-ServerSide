require('dotenv').config();
const { Client, GatewayIntentBits, ChannelType, EmbedBuilder } = require('discord.js');
const axios = require('axios');

const client = new Client({
  intents: [
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.Guilds
  ]
});

const BOT_TOKEN = process.env.DISCORD_TOKEN;
const API_URL = process.env.CRYPTID_API_URL || 'http://localhost:3001';
const API_KEY = process.env.CRYPTID_API_KEY;
const PREFIX = process.env.BOT_PREFIX || '!';

if (!BOT_TOKEN) {
  console.error('DISCORD_TOKEN is not set in .env');
  process.exit(1);
}

if (!API_KEY) {
  console.warn('WARNING: CRYPTID_API_KEY is not set. Some features may not work.');
}

client.on('ready', () => {
  console.log(`✅ Bot logged in as ${client.user.tag}`);
  client.user.setActivity('Lua scripts', { type: 'WATCHING' });
});

client.on('messageCreate', async (message) => {
  // Ignore bot messages
  if (message.author.bot) return;

  // Check if message starts with prefix
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = args[0].toLowerCase();

  try {
    if (command === 'decode') {
      await handleDecode(message, args);
    } else if (command === 'cxhelp') {
      await handleHelp(message);
    }
  } catch (error) {
    console.error('Command error:', error);
    message.reply('❌ An error occurred while processing your command.').catch(console.error);
  }
});

async function handleDecode(message, args) {
  if (args.length < 2) {
    return message.reply('❌ Usage: `!decode <ID or URL>`');
  }

  const scriptInput = args.slice(1).join(' ');

  // Show thinking status
  const thinkingMsg = await message.reply('🔍 Decoding script...');

  try {
    const headers = {
      'Content-Type': 'application/json'
    };

    if (API_KEY) {
      headers['X-API-Key'] = API_KEY;
    }

    const response = await axios.post(`${API_URL}/api/decode`, {
      id: !scriptInput.includes('http') ? scriptInput : undefined,
      url: scriptInput.includes('http') ? scriptInput : undefined
    }, { headers });

    const { scriptId, lua, bytes } = response.data;

    // Create a safe filename
    const randomFilename = Math.random().toString(36).substring(7) + '.txt';

    // Send script as file (more secure than chat)
    if (lua && lua.length > 0) {
      const buffer = Buffer.from(lua, 'utf-8');

      const embed = new EmbedBuilder()
        .setColor('#6c63ff')
        .setTitle('✅ Script Decoded')
        .setDescription(`Script ID: ${scriptId}`)
        .addFields(
          { name: 'Size', value: `${bytes} bytes`, inline: true },
          { name: 'Status', value: 'Successfully decoded', inline: true }
        )
        .setFooter({ text: 'Cryptid X Decoder' })
        .setTimestamp();

      await message.reply({
        embeds: [embed],
        files: [{ attachment: buffer, name: randomFilename }]
      });
    } else {
      await message.reply('❌ No script content found.');
    }

    await thinkingMsg.delete();
  } catch (error) {
    console.error('Decode error:', error.response?.data || error.message);

    const errorMsg = error.response?.data?.error || error.message || 'Unknown error';
    await message.reply(`❌ Failed to decode script: ${errorMsg}`);
    await thinkingMsg.delete();
  }
}

async function handleHelp(message) {
  const embed = new EmbedBuilder()
    .setColor('#00d4ff')
    .setTitle('🔐 Cryptid X Decoder Bot')
    .setDescription('Decrypt and retrieve authorized Lua scripts')
    .addFields(
      {
        name: '📋 Commands',
        value: `\`${PREFIX}decode <ID>\` - Decode a script by numeric ID\n\`${PREFIX}decode <URL>\` - Decode a script from a full URL\n\`${PREFIX}cxhelp\` - Show this help message`,
        inline: false
      },
      {
        name: '🔒 Security',
        value: 'Scripts are sent as file attachments. Never share raw keys or encrypted data in chat.',
        inline: false
      },
      {
        name: '📚 Examples',
        value: `\`${PREFIX}decode 2723928466610\`\n\`${PREFIX}decode https://encrypt-x.pages.dev/Scripts?Id=2723928466610\``,
        inline: false
      }
    )
    .setFooter({ text: 'Cryptid X Decoder' })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}

client.login(BOT_TOKEN);