import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { STOPWORDS } from '../config/stopwords.js'; // asume que defines STOPWORDS en otro módulo
// Función simple para singularizar términos terminados en 's'
const singularize = word => {
  if (word.length > 3 && word.endsWith('s')) {
    return word.slice(0, -1);
  }
  return word;
};

export class BindingManager {
  /**
   * @param {string} dbPath - Ruta al archivo SQLite de la wiki
   */
  constructor(dbPath = '../../data/database.db') {
    this.db = null;
    this.dbPath = dbPath;
  }

  async init() {
    this.db = await open({
      filename: this.dbPath,
      driver: sqlite3.Database
    });
  }

  /**
   * Retorna la entrada más relevante de la wiki según el mensaje del usuario,
   * omitiendo stopwords, singularizando plurales, y buscando en título o keywords.
   * @param {string} userMessage
   * @returns {Promise<{ titulo, categoria, url, contenido }|null>}
   */
  async getWikiEntryByQuery(userMessage) {
    if (!this.db) throw new Error('Database not initialized');

    // Limpiar y tokenizar
    const cleanQuery = userMessage
      .toLowerCase()
      .replace(/[^À-ſa-z0-9\s]/gi, '')
      .trim();
    const rawTerms = cleanQuery.split(/\s+/)
      .filter(t => t.length >= 2 && !STOPWORDS.has(t));
    if (rawTerms.length === 0) return null;

    // Singular/plural
    const termsSet = new Set();
    rawTerms.forEach(t => {
      termsSet.add(t);
      const s = singularize(t);
      if (s !== t) termsSet.add(s);
    });
    const terms = Array.from(termsSet);

    // Coincidencia forzada sobre el título completo
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

    // Cláusulas LIKE unidas por OR
    const likeClauses = terms.map(() =>
      `(LOWER(titulo) LIKE ? OR LOWER(keywords) LIKE ?)`
    ).join(' OR ');
    const likeValues = terms.flatMap(t => [`%${t}%`, `%${t}%`]);

    // Consulta final (incluye keywords en SELECT)
    const [best] = await this.db.all(
      `SELECT titulo, categoria, url, contenido, keywords
       FROM wiki
       WHERE ${likeClauses}
       COLLATE NOCASE
       LIMIT 1`,
      likeValues
    );

    return best || null;
  }
}
