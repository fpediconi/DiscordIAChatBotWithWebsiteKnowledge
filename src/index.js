// index.js
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { WikiProvider }     from './providers/WikiProvider.js';
import { StatsProvider }   from './providers/StatsProvider.js';
import { PlayerStatsService } from './providers/PlayerStatsService.js';
import { OffgameProvider }  from './providers/OffgameProvider.js';
import { KnowledgeProvider } from './providers/KnowledgeProvider.js';
import { PromptBuilder }    from './ia/PromptBuilder.js';
import { OpenRouterClient } from './ia/OpenRouterClient.js';
import { DiscordClient }    from './client/DiscordClient.js';
import { MessageQueueManager } from './utils/MessageQueueManager.js';
import { OllamaClient } from './ia/OllamaClient.js';
import { config } from './config/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const LOG_FILE = resolve(__dirname, '..', 'data', 'unanswered.json');

async function logUnanswered(message) {
  let logs = [];
  try {
    const content = await fs.promises.readFile(LOG_FILE, 'utf8');
    logs = JSON.parse(content);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('Error leyendo el log de consultas no atendidas:', err);
      return;
    }
  }
  logs.push({
    date: new Date().toISOString(),
    message
  });
  try {
    await fs.promises.writeFile(LOG_FILE, JSON.stringify(logs, null, 2), 'utf8');
  } catch (err) {
    console.error('Error escribiendo el log de consultas no atendidas:', err);
  }
}

(async () => {
  const wikiProvider    = new WikiProvider({ dbPath: './data/database.db' });
  const offgameProvider = new OffgameProvider({ jsonPath: './data/offgame.json' });
  const statsProvider   = new StatsProvider({ dataPath: './data/statsData.json' });
  const playerStatsService = new PlayerStatsService({ dataPath: './data/livedata.json' });

  await offgameProvider.ingest();

  const km = new KnowledgeProvider({
    providers:   [wikiProvider, offgameProvider, statsProvider, playerStatsService],
    topK:        3,
    globalTopK: 12
  });

  const promptBuilder = new PromptBuilder();
  const openRouter    = new OpenRouterClient();
  const ollamaClient  = new OllamaClient();

  const onMessage = async (userMessage, senderId, userName, replyCallback) => {
    const fragments = await km.retrieveAll(userMessage);
    if (!fragments.length) {
      await logUnanswered(userMessage);
      replyCallback(`Perdón, no puedo ayudarte con eso. Intenta formular tu pregunta de otra manera o utiliza palabras clave más específicas. Recuerda que las estadísticas en tiempo real y los calculos de vida están en BETA y pueden fallar o no detectar tus preguntas.`);
      return;
    }
    const prompt = promptBuilder.buildPrompt(userMessage, fragments, userName);
    console.log(`Prompt para ${senderId}:\n${prompt}\n\n---\n`);
    let respuesta;
    if(config.uselocalAPI) {
      respuesta = await ollamaClient.getCompletion(prompt);
    } else {
      respuesta = await openRouter.getCompletion(prompt);
    }
    replyCallback(respuesta);
  };

  const queueManager = new MessageQueueManager({
    onValidMessage: onMessage,
    messagesPerUserPerMinute: 15,
    maxQueueLength: 10
  });

  const discordBot = new DiscordClient((userMessage, senderId, userName, replyCallback, isEdit = false) => {
    queueManager.enqueue(userMessage, senderId, userName, replyCallback, isEdit);
  });
  await discordBot.start();
})();
