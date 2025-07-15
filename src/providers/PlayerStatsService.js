// Deshabilitar verificación de certificado TLS para evitar errores de certificado
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import fs from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

export class PlayerStatsService {
  /**
   * @param {Object} options
   * @param {string} options.dataPath  Ruta al JSON para cache persistente
   * @param {number} options.ttlMs     Tiempo de vida del cache en ms (3 horas)
   */
  constructor({ dataPath, ttlMs = 3 * 60 * 60 * 1000 } = {}) {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    this.dataPath = dataPath ? resolve(__dirname, '..', dataPath) : null;
    this.ttlMs = ttlMs;
    this.playersCache = { data: null, timestamp: 0 };

    // mapeo a nombres
    this.raceMap = { 1: 'Humano', 2: 'Enano', 3: 'Elfo', 4: 'Elfo oscuro', 5: 'Gnomo' };
    this.classMap = {
      38: 'Mago', 39: 'Nigromante', 41: 'Paladin', 42: 'Clerigo',
      44: 'Bardo', 45: 'Druida', 47: 'Asesino', 48: 'Cazador',
      50: 'Arquero', 51: 'Guerrero', 55: 'Pirata'
    };
    this.bandoMap = { 0: 'Neutro', 1: 'Ciudadano', 2: 'Criminal' };

    // Mapas inversos: nombre (lowercase) a código
    this.raceCodeMap = Object.fromEntries(
      Object.entries(this.raceMap).map(([k, v]) => [v.toLowerCase(), Number(k)])
    );
    this.classCodeMap = Object.fromEntries(
      Object.entries(this.classMap).map(([k, v]) => [v.toLowerCase(), Number(k)])
    );
    this.bandoCodeMap = Object.fromEntries(
      Object.entries(this.bandoMap).map(([k, v]) => [v.toLowerCase(), Number(k)])
    );
  }

  _isStale(ts) {
    return Date.now() - ts > this.ttlMs;
  }

  async _loadFromDisk() {
    if (!this.dataPath) return;
    if (existsSync(this.dataPath)) {
      try {
        const raw = await fs.readFile(this.dataPath, 'utf8');
        const json = JSON.parse(raw);
        this.playersCache = { data: json, timestamp: Date.now() };
      } catch (e) {
        console.warn('PlayerStatsService: no se pudo leer cache en disco:', e);
      }
    }
  }

  async _saveToDisk() {
    if (!this.dataPath) return;
    try {
      const dir = dirname(this.dataPath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(this.dataPath, JSON.stringify(this.playersCache.data, null, 2), 'utf8');
    } catch (e) {
      console.warn('PlayerStatsService: no se pudo escribir cache en disco:', e);
    }
  }

  async _fetchRemoteAll() {
    const url = 'https://panel.fsao.com.ar/api/usuario';
    const res = await global.fetch(url);
    if (!res.ok) throw new Error(`PlayerStatsService: fallo al fetch ${url}`);
    return res.json();
  }

  /**
   * Obtiene la lista completa de jugadores (array de objetos raw).
   */
  async getAllPlayers() {
    if (!this.playersCache.data || this._isStale(this.playersCache.timestamp)) {
      if (!this.playersCache.data) await this._loadFromDisk();
      if (!this.playersCache.data || this._isStale(this.playersCache.timestamp)) {
        const data = await this._fetchRemoteAll();
        this.playersCache = { data, timestamp: Date.now() };
        await this._saveToDisk();
      }
    }
    return this.playersCache.data;
  }

  /**
   * Obtiene un único jugador por nombre.
   */
  async getPlayer(nombre) {
    const all = await this.getAllPlayers();
    const key = nombre.toLowerCase().trim();
    const found = all.find(p => p.nombre && p.nombre.toLowerCase().trim() === key);
    if (found) return found;
    const url = `https://panel.fsao.com.ar/api/usuario?user=${encodeURIComponent(nombre)}`;
    const res = await global.fetch(url);
    if (!res.ok) throw new Error(`PlayerStatsService: jugador ${nombre} no encontrado`);
    return res.json();
  }

  /**
   * Valor numérico para ordenar según campo.
   */
  _getFieldValue(p, field) {
    switch (field) {
      case 'nivel': return p.elv || 0;
      case 'kills': return p.kills || 0;
      case 'murio': return p.murio || 0;
      case 'npcsmuertes': return p.npcsmuertes || 0;
      case 'retosGanados': return (p.rganados || 0) + (p.rduosg || 0);
      default: return p[field] || 0;
    }
  }

  /**
   * Ranking genérico con filtros de clase, raza y bando.
   */
  async getTopBy(field, { clazz, race, bando, limit = 1 } = {}) {
    let list = await this.getAllPlayers();
    if (clazz) {
      const cid = this.classCodeMap[clazz.toLowerCase()];
      if (cid !== undefined) list = list.filter(p => p.clase === cid);
    }
    if (race) {
      const rid = this.raceCodeMap[race.toLowerCase()];
      if (rid !== undefined) list = list.filter(p => p.raza === rid);
    }
    if (bando) {
      const bid = this.bandoCodeMap[bando.toLowerCase()];
      if (bid !== undefined) list = list.filter(p => p.bando === bid);
    }
    list.sort((a, b) => this._getFieldValue(b, field) - this._getFieldValue(a, field));
    return list.slice(0, limit);
  }

  /**
   * Integra con KnowledgeProvider: detecta consultas de ranking o detalle.
   */
  async retrieve(query, { topK = 1 } = {}) {
    const q = query.toLowerCase();

    // 0) Mejor/top + clase/jugador [+ opcional bando]
    const initialPat = /\b(mejor|top)\b.*\b(jugador|player|asesino|bardo|druida|guerrero|nigromante|mago|paladin|cazador)\b(?:.*\b(ciudadano|criminal|neutro)\b)?/i;
    const mInit = initialPat.exec(q);
    if (mInit) {
      const target = mInit[2].toLowerCase();
      const isPlayer = ['jugador', 'player'].includes(target);
      const clazz = isPlayer ? null : target;
      const bando = mInit[3] ? mInit[3].toLowerCase() : null;
      const top = await this.getTopBy('nivel', { clazz, bando, limit: topK });
      return top.map(p => {
        const parts = [];
        if (!isPlayer) parts.push(`Clase ${clazz}`);
        if (bando) parts.push(`Bando ${bando}`);
        const prefix = parts.length ? parts.join(', ') + ': ' : '';
        return {
          text: isPlayer
            ? `Mejor jugador: **${p.nombre}** (nivel ${p.elv})`
            : `${prefix}**${p.nombre}** (nivel ${p.elv})`,
          score: 100,
          metadata: { source: 'FurIA Ranking' }
        };
      });
    }

    // 1) Patrones de ranking (nivel, kills, murio, npc, retos)
    const patterns = [
      { regex: /\b(top|mejor)\b.*\bnivel\b/i,    field: 'nivel'       },
      { regex: /\b(top|mejor|más|mas)\b.*\bkill/i, field: 'kills'       },
      { regex: /\b(top|mejor)\b.*\bmuert/i,       field: 'murio'       },
      { regex: /\b(top|mejor)\b.*\bnpc/i,         field: 'npcsmuertes' },
      { regex: /\b(top|mejor)\b.*\bretos\b/i,    field: 'retosGanados'}
    ];
    for (const { regex, field } of patterns) {
      if (regex.test(q)) {
        const clazzMatch = /\b(asesino|bardo|druida|guerrero|nigromante|mago|paladin|cazador)\b/i.exec(q);
        const raceMatch  = /\b(humano|enano|elfo oscuro|elfo|gnomo)\b/i.exec(q);
        const bandoMatch = /\b(ciudadano|criminal|neutro)\b/i.exec(q);
        const clazz = clazzMatch ? clazzMatch[0].toLowerCase() : null;
        const race  = raceMatch  ? raceMatch[0].toLowerCase()  : null;
        const bando = bandoMatch ? bandoMatch[0].toLowerCase() : null;
        const top   = await this.getTopBy(field, { clazz, race, bando, limit: topK });
        return top.map(p => {
          const parts = [];
          if (clazz) parts.push(`Clase ${clazz}`);
          if (race)  parts.push(`Raza ${race}`);
          if (bando) parts.push(`Bando ${bando}`);
          const prefix = parts.length ? parts.join(', ') + ': ' : '';
          const value = this._getFieldValue(p, field);
          return {
            text: `🏆 ${prefix}**${p.nombre}** (${value})`,
            score: 100,
            metadata: { source: 'FurIA Ranking' }
          };
        });
      }
    }

    // 2) Detalles individuales (nivel, kills, murio, npc, retos)
    const detailPatterns = [
      // 1) NPC kills — se procesan antes que las kills genéricas
      { regex: /(?:cuant[oa]s?)\s*(?:veces\s*)?npc(?:s)?\s+(?:mato|mata[sn]|kill(?:s)?)\s*([\w ]+)/i, field: 'npcsmuertes' },
      { regex: /([\w ]+)\s+(?:mata[sn]|kill(?:s)?)\s*npc(?:s)?/i,                              field: 'npcsmuertes' },
      { regex: /([\w ]+)\s+tiene\s+npc(?:s)?\s+mat[oó]s?/i,                                  field: 'npcsmuertes' },

      // 2) Kills — pero excluye líneas con “npc” gracias al negative lookahead (?!npc)
      { regex: /(?:cuant[oa]s?)\s*(?:veces\s*)?(?:mato|mata[sn]|kill(?:s)?)\s+(?!npc)([\w ]+)/i, field: 'kills' },
      { regex: /(?:cuant[oa]s?)\s*(?:veces\s*)?kills?\s+de\s+(?!npc)([\w ]+)/i,               field: 'kills' },
      { regex: /([\w ]+)\s+(?:mata[sn]|kill(?:s)?)\s*(?!npc)/i,                              field: 'kills' },

      // 3) Deaths
      { regex: /(?:cuant[oa]s?)\s*(?:veces\s*)?murio\s*([\w ]+)/i,                          field: 'murio' },
      { regex: /([\w ]+)\s+murio\s*(?:veces)?/i,                                              field: 'murio' },
      { regex: /([\w ]+)\s+tiene\s+muert[oa]s?/i,                                            field: 'murio' },

      // 4) Level
      { regex: /nivel\s+(?:de|tiene)\s*([\w ]+)/i,                                           field: 'nivel' },
      { regex: /([\w ]+)\s+tiene\s+nivel/i,                                                  field: 'nivel' },

      // 5) Retos
      { regex: /retos\s+ganad[oa]s?\s*(?:de|tiene)\s*([\w ]+)/i,                              field: 'retosGanados' }
    ];

    for (const { regex, field } of detailPatterns) {
      const m = regex.exec(q);
      if (m) {
        const nombre = m[1].trim();
        try {
          const p = await this.getPlayer(nombre);
          const value = this._getFieldValue(p, field);
          return [{ text: `**${p.nombre}** tiene ${value} ${field}.`, score: 100, metadata: { source: 'FurIA Ranking' } }];
        } catch {
          return [{ text: `No encontré datos para el jugador **${nombre}**.`, score: 90, metadata: { source: 'FurIA Ranking' } }];
        }
      }
    }

    return [];
  }
}
