import { WikiProvider }     from './providers/WikiProvider.js';
import { OffgameProvider }  from './providers/OffgameProvider.js';
import { KnowledgeProvider } from './providers/KnowledgeProvider.js';
import { PromptBuilder }    from './ia/PromptBuilder.js';
import { OpenRouterClient } from './ia/OpenRouterClient.js';
import { DiscordClient }    from './client/DiscordClient.js';

(async () => {
  const wikiProvider    = new WikiProvider({ dbPath: './data/database.db' });
  const offgameProvider = new OffgameProvider({ jsonPath: './data/offgame.json' });

  // Precargar offline (opcional)
  await offgameProvider.ingest();

  const km = new KnowledgeProvider({
    providers:    [wikiProvider, offgameProvider],
    topK:         5,
    globalTopK:  10
  });

  const promptBuilder = new PromptBuilder();
  const openRouter   = new OpenRouterClient();

  const onMessage = async (userMessage, senderId, userName) => {
    const fragments = await km.retrieveAll(userMessage);
    // Si no hay info, devolvemos fallback directo
    if (!fragments.length) {
      return `Perdon, no puedo ayudarte con eso".`;
    }
    const prompt = promptBuilder.buildPrompt(userMessage, fragments, userName);
    console.log(`Prompt para ${senderId}:\n${prompt}\n\n---\n`);
    return await openRouter.getCompletion(prompt);
  };

  const discordBot = new DiscordClient(onMessage);
  await discordBot.start();
})();
