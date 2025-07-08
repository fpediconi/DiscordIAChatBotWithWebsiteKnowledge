// src/ia/providers/OffgameProvider.js
import { KnowledgeProvider } from './KnowledgeProvider.js';
import fs from 'fs/promises';
import path from 'path';

import { STOPWORDS } from '../config/stopwords.js';


export class OffgameProvider extends KnowledgeProvider {
  constructor({ jsonPath = path.resolve('./data/offgame.json') } = {}) {
    super();
    this.jsonPath = jsonPath;
    this.entries = [];
    this.initialized = false;
  }

  async init() {
    if (!this.initialized) {
      const raw = await fs.readFile(this.jsonPath, 'utf8');
      this.entries = JSON.parse(raw);
      this.initialized = true;
    }
  }

  async ingest() {
    await this.init();
  }

  async retrieve(query, options = { topK: 5 }) {
    await this.init();
    // 1. Tokenizar y filtrar stop-words
    const tokens = (query.toLowerCase().match(/\w+/g) || []);
    const keywords = tokens.filter(t => t.length >= 2 && !STOPWORDS.has(t));
    if (!keywords.length) return [];

    // 2. Buscar entradas que coincidan en title o tags
    const hits = this.entries.filter(e =>
      keywords.some(k =>
        e.title.toLowerCase().includes(k) ||
        (e.tags && e.tags.some(tag => tag.toLowerCase().includes(k)))
      )
    );

    // 3. Puntuar y ordenar
    const scored = hits.map(e => {
      const titleMatches   = keywords.reduce((sum, k) =>
        sum + (e.title.toLowerCase().includes(k) ? 2 : 0), 0);
      const contentMatches = keywords.reduce((sum, k) =>
        sum + ((e.content.toLowerCase().match(new RegExp(k,'g'))||[]).length), 0);
      return { entry: e, score: titleMatches * 2 + contentMatches };
    }).sort((a,b) => b.score - a.score);

    // 4. Generar fragments y recortar a topK
    const fragments = [];
    for (let i = 0; i < Math.min(scored.length, options.topK); i++) {
      const { entry, score } = scored[i];
      const chunks = this._chunkText(entry.content, 1000);
      for (let j = 0; j < Math.min(chunks.length, options.topK); j++) {
        fragments.push({
          text: chunks[j],
          score,
          metadata: {
            source: 'offgame',
            domain: entry.domain,
            title: entry.title
          }
        });
      }
    }
    return fragments.slice(0, options.topK);
  }

  _chunkText(text, maxChars) {
    const paras = text.split(/\r?\n\r?\n/);
    const chunks = [];
    for (const p of paras) {
      if (p.length <= maxChars) chunks.push(p.trim());
      else {
        for (let i = 0; i < p.length; i += maxChars) {
          chunks.push(p.slice(i, i + maxChars).trim());
        }
      }
    }
    return chunks.filter(c => c.length > 0);
  }
}
