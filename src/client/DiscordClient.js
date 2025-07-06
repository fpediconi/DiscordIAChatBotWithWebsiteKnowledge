// src/client/DiscordClient.js
import { Client, GatewayIntentBits } from 'discord.js';
import { config } from '../config/config.js';

/**
 * Divide un texto en trozos de máximo maxLen caracteres.
 */
function splitMessage(text, maxLen = 2000) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(text.length, start + maxLen);
    if (end < text.length) {
      const lastNl = text.lastIndexOf('\n', end);
      const lastSp = text.lastIndexOf(' ', end);
      const cut = Math.max(lastNl, lastSp);
      if (cut > start) end = cut;
    }
    chunks.push(text.slice(start, end));
    start = end;
  }
  return chunks;
}

export class DiscordClient {
  constructor(onMessage) {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });
    this.onMessage = onMessage;
    this.allowedChannelId = config.discordChannelId;
  }

  async start() {
    this.client.once('ready', () => {
      console.log(`🤖 Conectado como ${this.client.user.tag}`);
    });

    this.client.on('messageCreate', async (message) => {
      if (message.author.bot) return;
      if (message.channel.id !== this.allowedChannelId) return;

      // Nuevo trigger
      const trigger = '!furia ';
      if (!message.content.toLowerCase().startsWith(trigger)) return;

      const userMessage = message.content.slice(trigger.length).trim();
      const senderId = message.author.id;
      await message.channel.sendTyping();

      const response = await this.onMessage(userMessage, senderId);

      if (typeof response === 'string') {
        const parts = splitMessage(response);
        await message.reply(parts[0]);
        for (let i = 1; i < parts.length; i++) {
          await message.channel.send(parts[i]);
        }
      } else if (response?.type === 'media') {
        for (const media of response.mediaList) {
          await message.channel.send({
            content: media.caption,
            files: [media.image.url]
          });
        }
      }
    });

    await this.client.login(config.discordToken);
  }
}
