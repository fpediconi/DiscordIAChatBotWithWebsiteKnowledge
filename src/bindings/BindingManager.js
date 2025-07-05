import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

// Lista de palabras vacías en español que deben omitirse de las búsquedas
const STOPWORDS = new Set([
  'que', 'como', 'es', 'cuando', 'de', 'la', 'el', 'y', 'a', 'en',
  'por', 'un', 'una', 'los', 'las', 'con', 'para', 'no', 'se', 'al', 'del',
  'este', 'esta', 'son', 'su', 'sus', 'sobre', 'entre'
]);

// Función simple para singularizar términos terminados en 's'
const singularize = word => {
  if (word.length > 3 && word.endsWith('s')) {
    return word.slice(0, -1);
  }
  return word;
};

export class BindingManager {
  constructor() {
    this.db = null;
  }

  async init() {
    this.db = await open({
      filename: './data/database.db',
      driver: sqlite3.Database
    });
  }

  /**
   * Retorna la entrada más relevante de la wiki según el mensaje del usuario,
   * omitiendo palabras vacías y normalizando singular/plural.
   */
  async getWikiEntryByQuery(userMessage) {
    if (!this.db) throw new Error('Database not initialized');

    // Limpiar el mensaje y tokenizar
    const cleanQuery = userMessage
      .toLowerCase()
      .replace(/[^À-ſa-z0-9\s]/gi, '')
      .trim();

    // Separar en términos, filtrar stopwords y tokens muy cortos
    const rawTerms = cleanQuery.split(/\s+/)
      .filter(t => t.length > 2 && !STOPWORDS.has(t));
    if (rawTerms.length === 0) return null;

    // Generar conjunto de términos incluyendo singular y plural
    const termsSet = new Set();
    rawTerms.forEach(t => {
      termsSet.add(t);
      const s = singularize(t);
      if (s !== t) termsSet.add(s);
    });
    const terms = Array.from(termsSet);

    // Priorizar coincidencia forzada si el título (o su singular) aparece exactamente
    const all = await this.db.all(
      `SELECT titulo, categoria, url, contenido
       FROM wiki`
    );
    const forced = all.find(e => {
      const title = e.titulo.toLowerCase();
      const singTitle = singularize(title);
      return cleanQuery.includes(title) || cleanQuery.includes(singTitle);
    });
    if (forced) return forced;

    // Construir cláusulas LIKE para cada término normalizado
    const likeClauses = terms.map(() =>
      `(LOWER(titulo) LIKE ? OR LOWER(keywords) LIKE ? OR LOWER(contenido) LIKE ?)`
    ).join(' AND ');
    const likeValues = terms.flatMap(t => [`%${t}%`, `%${t}%`, `%${t}%`]);

    // Ejecutar consulta con collation NOCASE para ignorar mayúsculas/minúsculas
    const [best] = await this.db.all(
      `SELECT titulo, categoria, url, contenido
       FROM wiki
       WHERE ${likeClauses}
       COLLATE NOCASE
       LIMIT 1`,
      likeValues
    );

    return best || null;
  }
}
