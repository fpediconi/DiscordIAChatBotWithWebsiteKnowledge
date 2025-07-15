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


const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const LOG_FILE = resolve(__dirname, '..', 'data', 'unanswered.json');

/**
 * Registra en data/unanswered.json la fecha y mensaje de consultas sin respuesta.
 * Crea el archivo si no existe.
 * @param {string} message 
 */
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
    // si no existe, asumimos array vacío
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

  const onMessage = async (userMessage, senderId, userName) => {
    const fragments = await km.retrieveAll(userMessage);
    // Si no hay info, devolvemos fallback y lo registramos
    if (!fragments.length) {
      await logUnanswered(userMessage);
      return `Perdón, no puedo ayudarte con eso. Intenta formular tu pregunta de otra manera o utiliza palabras clave más específicas. Recuerda que las estadísticas en tiempo real y los calculos de vida estan en BETA y pueden fallar o no detectar tus preguntas.`;
    }
    const prompt = promptBuilder.buildPrompt(userMessage, fragments, userName);
    console.log(`Prompt para ${senderId}:\n${prompt}\n\n---\n`);
    return await openRouter.getCompletion(prompt);
  };

  const discordBot = new DiscordClient(onMessage);
  await discordBot.start();
})();
