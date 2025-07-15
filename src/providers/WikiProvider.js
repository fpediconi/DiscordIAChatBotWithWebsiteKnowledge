// src/providers/WikiProvider.js
import { KnowledgeProvider } from './KnowledgeProvider.js';
import { BindingManager }     from '../bindings/BindingManager.js';

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
   * @param {string} query
   * @param {Object} options
   * @param {number} options.topK
   * @returns {Promise<Array<{ text: string, score: number, metadata: Object }>>}
   */
  async retrieve(query, options = { topK: 5 }) {
    await this.bindingManager.init();
    const entries = await this.bindingManager.getWikiEntryByQuery(query);
    if (!entries || entries.length === 0) return [];

    // Mapeo a fragments
    return entries.map(entry => ({
      text: entry.contenido,
      score: 1.0,
      metadata: {
        source:   'wiki',
        title:    entry.titulo,
        category: entry.categoria,
        url:      entry.url
      }
    }));
  }
}
