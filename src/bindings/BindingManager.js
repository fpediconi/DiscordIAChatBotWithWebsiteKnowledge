import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { STOPWORDS } from '../config/stopwords.js';

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
    if (!this.db) {
      this.db = await open({
        filename: this.dbPath,
        driver: sqlite3.Database
      });
    }
  }

  /**
   * Recupera entradas de la wiki según keywords de la query del usuario.
   * @param {string} userMessage
   * @returns {Promise<Array<{titulo:string, categoria:string, url:string, contenido:string, keywords:string}>>|null}
   */
  async getWikiEntryByQuery(userMessage) {
    if (!this.db) throw new Error('Database not initialized');

    // 1) Limpiar y tokenizar
    const cleanQuery = userMessage
      .normalize('NFD')              // eliminar acentos
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/gi, '')
      .trim();

    const rawTerms = cleanQuery.split(/\s+/)
      .filter(t => t.length >= 2 && !STOPWORDS.has(t));
    if (rawTerms.length === 0) return null;

    // 2) Singular/plural
    const termsSet = new Set();
    rawTerms.forEach(t => {
      termsSet.add(t);
      const sing = singularize(t);
      if (sing !== t) termsSet.add(sing);
    });
    const terms = Array.from(termsSet);

    // 3) Filtrado sólo por keywords
    const likeClauses = terms
      .map(() => `(LOWER(keywords) LIKE ?)`)
      .join(' OR ');
    const likeValues = terms.flatMap(t => [`%${t}%`]);

    const results = await this.db.all(
      `SELECT titulo, categoria, url, contenido, keywords
       FROM wiki
       WHERE ${likeClauses}
       COLLATE NOCASE`,
      likeValues
    );

    return results && results.length ? results : null;
  }
}
