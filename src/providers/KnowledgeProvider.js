import { WikiProvider } from './WikiProvider.js';
// En el futuro: OffgameProvider, EventsProvider

/**
 * Gestiona múltiples KnowledgeProviders y fusiona sus resultados.
 */
export class KnowledgeProvider {
  /**
   * @param {Object} options
   * @param {Array<KnowledgeProvider>} options.providers - Lista de providers a consultar.
   * @param {number} options.topK - Número de resultados por provider.
   * @param {number} options.globalTopK - Número total de fragmentos a devolver tras mezclar.
   */
  constructor({ providers = [], topK = 5, globalTopK = 10 } = {}) {
    this.providers = providers;
    this.topK = topK;
    this.globalTopK = globalTopK;
  }

  /**
   * Recupera y mezcla los resultados de todos los providers para la query.
   * @param {string} query - Texto de la consulta del usuario.
   * @param {Object} [options]
   * @param {Object<string, any>} [options.filters] - Filtros específicos por provider (opcional).
   * @returns {Promise<Array<{ text: string, score: number, metadata: object }>>}
   */
  async retrieveAll(query, options = {}) {
    const { filters = {} } = options;

    // Llamar retrieve() en paralelo en cada provider
    const resultsNested = await Promise.all(
      this.providers.map(async provider => {
        const name = provider.constructor.name;
        const providerOpts = {
          topK: filters[name]?.topK || this.topK,
          metadataFilter: filters[name]?.metadataFilter
        };
        try {
          const res = await provider.retrieve(query, providerOpts);
          return Array.isArray(res) ? res : [];
        } catch (err) {
          console.error(`Error en provider ${name}:`, err);
          return [];
        }
      })
    );

    // Aplanar y ordenar por score descendente
    const merged = resultsNested.flat();
    merged.sort((a, b) => (b.score || 0) - (a.score || 0));

    // Devolver sólo los mejores globalTopK
    return merged.slice(0, this.globalTopK);
  }
}
