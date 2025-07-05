// src/index.js
import { BindingManager } from './bindings/BindingManager.js';
import { PromptBuilder } from './ia/PromptBuilder.js';
import { OpenRouterClient } from './ia/OpenRouterClient.js';
import { DiscordClient } from './client/DiscordClient.js';

const bindings = new BindingManager();
await bindings.init();

const promptBuilder = new PromptBuilder();
const openRouter = new OpenRouterClient();

// 2. Definir cómo responder a cada mensaje
const onMessage = async (userMessage, senderId) => {
  console.log(`📩 Mensaje recibido de ${senderId}: "${userMessage}"`);

  const matchedWikiEntries = await bindings.getWikiEntryByQuery(userMessage);

  const prompt = promptBuilder.buildPrompt(userMessage, matchedWikiEntries);
  console.log(`📝 Prompt generado:\n${prompt}`);
  const iaResponse = await openRouter.getCompletion(prompt);

  return iaResponse;
};

// 3. Iniciar Discord
const discordBot = new DiscordClient(onMessage);
await discordBot.start();
