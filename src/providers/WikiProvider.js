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
    // No-op
  }

  /**
   * Recupera la entrada completa de la wiki junto con su URL.
   * @param {string} query
   * @param {{ topK: number }} options
   * @returns {Promise<Array<{ text: string, score: number, metadata: object }>>}
   */
  async retrieve(query, options = { topK: 5 }) {
    await this.bindingManager.init();
    const entry = await this.bindingManager.getWikiEntryByQuery(query);
    if (!entry) return [];

    // Devolver un único fragmento con todo el contenido y la URL
    return [{
      text: entry.contenido,
      score: 1.0,
      metadata: {
        source: 'wiki',
        title: entry.titulo,
        category: entry.categoria,
        url: entry.url
      }
    }];
  }
}
