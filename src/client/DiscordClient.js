// src/client/DiscordClient.js
import { Client, GatewayIntentBits } from 'discord.js';
import { config } from '../config/config.js';

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

    // Mapa para trackear último contenido de cada mensaje y evitar procesar edits fantasma
    this.lastContents = new Map();

    this.client.on('error', err => {
      console.error('Discord client error:', err);
    });
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
  }

  async start() {
    this.client.once('ready', () => {
      console.log(`🤖 Conectado como ${this.client.user.tag}`);
    });

    const processDiscordMessage = async (message, isEdit = false) => {
      try {
        if (!message.content) return;
        if (message.author.bot) return;
        if (message.channel.id !== this.allowedChannelId) return;

        const trigger = '!furia ';
        if (!message.content.toLowerCase().startsWith(trigger)) return;

        // Check edits: solo procesar si el contenido cambió realmente
        if (isEdit) {
          const last = this.lastContents.get(message.id);
          if (last === message.content) return; 
          this.lastContents.set(message.id, message.content);
        } else {
          // Nuevo mensaje: guardar contenido
          this.lastContents.set(message.id, message.content);
        }

        const userMessage = message.content.slice(trigger.length).trim();
        const senderId = message.author.id;

        await message.channel.sendTyping();
        this.onMessage(
          userMessage,
          senderId,
          message.author.username,
          async (respuesta) => {
            if (!respuesta) return;
            if (typeof respuesta === 'string') {
              const parts = splitMessage(respuesta);
              try {
                await message.reply(parts[0]);
              } catch (err) {
                if (
                  err.code === 10008 || // Unknown Message
                  (err.rawError && err.rawError.code === 50035) // Invalid Form Body
                ) {
                  console.warn('El mensaje original fue borrado antes de la respuesta, se descarta.');
                  return;
                } else {
                  console.error('Reply falló por otro motivo:', err);
                }
              }
              // Solo enviar las partes siguientes si el reply original fue exitoso
              for (let i = 1; i < parts.length; i++) {
                try {
                  await message.channel.send(parts[i]);
                } catch (err) {
                  console.error('Error al enviar parte del mensaje:', err);
                }
              }
            } else if (respuesta?.type === 'media') {
              for (const media of respuesta.mediaList) {
                try {
                  await message.channel.send({
                    content: media.caption,
                    files: [media.image.url]
                  });
                } catch (err) {
                  console.error('Error al enviar media:', err);
                }
              }
            }
          },
          isEdit
        );
      } catch (err) {
        console.error('Error manejando messageCreate/messageUpdate:', err);
      }
    };

    this.client.on('messageCreate', message => processDiscordMessage(message, false));
    this.client.on('messageUpdate', (oldMsg, newMsg) => processDiscordMessage(newMsg, true));

    await this.client.login(config.discordToken);
  }
}
