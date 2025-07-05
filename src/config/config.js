// src/config/config.js
import { discordSort } from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

export const config = {
  openRouterKey: process.env.OPENROUTER_API_KEY,
  openRouterModel: process.env.OPENROUTER_MODEL || 'mistral-7b-openorca',
  discordToken: process.env.DISCORD_TOKEN,
  discordChannelId: process.env.DISCORD_CHANNEL_ID || '1378220808530301013',
};
