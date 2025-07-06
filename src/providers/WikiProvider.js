import { KnowledgeProvider } from './KnowledgeProvider.js';
import { BindingManager } from '../bindings/BindingManager.js';

/**
 * WikiProvider usa BindingManager para recuperar información de la wiki en caliente.
 */
export class WikiProvider extends KnowledgeProvider {
  /**
   * @param {Object} options
   * @param {string} options.dbPath - Ruta al archivo SQLite de la wiki
   */
  constructor({ dbPath = './data/database.db' } = {}) {
    super();
    this.bindingManager = new BindingManager(dbPath);
  }

  /**
   * No requiere ingestión offline; se usa BindingManager en caliente.
   */
  async ingest() {
    // No-op: BindingManager se encarga de la consulta directa
  }

  /**
   * Recupera los fragmentos de la wiki más relevantes para una query.
   * @param {string} query
   * @param {{ topK: number }} options
   * @returns {Promise<Array<{ text: string, score: number, metadata: object }>>}
   */
  async retrieve(query, options = { topK: 5 }) {
    await this.bindingManager.init();
    const entry = await this.bindingManager.getWikiEntryByQuery(query);
    if (!entry) return [];
    const chunks = this._chunkText(entry.contenido, 1000);
    return chunks.slice(0, options.topK).map(text => ({
      text,
      score: 1.0,
      metadata: {
        source: 'wiki',
        title: entry.titulo,
        category: entry.categoria,
        url: entry.url
      }
    }));
  }

  /**
   * Divide un texto en trozos de longitud máxima.
   * @param {string} text
   * @param {number} maxChars
   * @returns {string[]}
   */
  _chunkText(text, maxChars) {
    const paragraphs = text.split(/\r?\n\r?\n/);
    const chunks = [];
    for (const para of paragraphs) {
      if (para.length <= maxChars) {
        chunks.push(para.trim());
      } else {
        for (let i = 0; i < para.length; i += maxChars) {
          chunks.push(para.slice(i, i + maxChars).trim());
        }
      }
    }
    return chunks.filter(c => c.length > 0);
  }
}
