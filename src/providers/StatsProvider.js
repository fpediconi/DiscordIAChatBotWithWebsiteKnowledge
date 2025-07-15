import fs from 'fs';
import path from 'path';

/**
 * StatsProvider: detecta consultas de vida/HP y retorna fragments para el pipeline RAG.
 */
export class StatsProvider {
  /**
   * @param {{ dataPath: string }} options
   */
  constructor({ dataPath }) {
    const fullPath = path.resolve(dataPath);
    try {
      this.stats = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    } catch (err) {
      console.error(`Error al leer statsData en ${fullPath}:`, err);
      this.stats = [];
    }
  }

  /**
   * Detecta si un texto menciona vida/HP.
   * @param {string} text
   * @returns {boolean}
   */
  isStatsQuery(text) {
    const re = /\b(vida|hp|puntos de vida)\b/i;
    return re.test(text);
  }

  /**
   * Extrae clase, raza y nivel de la consulta. Nivel opcional; detecta 'nivel', 'lvl', 'al nivel', o 'al'.
   * @param {string} text
   * @returns {{ claseKey: string|null, razaKey: string|null, nivel: number|null }}
   */
  parseQuery(text) {
    const lower = text.toLowerCase();
    const classMap = {
      mago: 'Mago/Nigromante/Druida',
      nigromante: 'Mago/Nigromante/Druida',
      druida: 'Mago/Nigromante/Druida',
      'clérigo': 'Clérigo/Bardo/Asesino',
      clerigo: 'Clérigo/Bardo/Asesino',
      bardo: 'Clérigo/Bardo/Asesino',
      asesino: 'Clérigo/Bardo/Asesino',
      'paladín': 'Paladín/Cazador',
      paladin: 'Paladín/Cazador',
      cazador: 'Paladín/Cazador',
      arquero: 'Arquero/Guerrero',
      guerrero: 'Arquero/Guerrero',
      bandido: 'Bandido',
      trabajadora: 'Trabajadoras',
      trabajadoras: 'Trabajadoras'
    };
    const raceMap = {
      enano: 'Enano',
      humano: 'Humano',
      'elfo oscuro': 'Elfo Oscuro / Gnomo',
      gnomo: 'Elfo Oscuro / Gnomo',
      elfo: 'Elfo'
    };

    let claseKey = null;
    for (const key in classMap) {
      if (lower.includes(key)) {
        claseKey = classMap[key];
        break;
      }
    }

    let razaKey = null;
    for (const key in raceMap) {
      if (lower.includes(key)) {
        razaKey = raceMap[key];
        break;
      }
    }

    // Detectar nivel: 'nivel 38', 'lvl 38', 'al nivel 38', 'al 38'
    const lvlMatch = lower.match(/\b(?:nivel|lvl|al nivel|al)\s*(\d{1,2})\b/);
    const nivel = lvlMatch ? parseInt(lvlMatch[1], 10) : null;

    return { claseKey, razaKey, nivel };
  }

  /**
   * Calcula HP basado en la entrada y nivel.
   * @param {object} entry
   * @param {number} nivel
   * @returns {number}
   */
  calculateHpForEntry(entry, nivel) {
    const { vidaA13, promedioDiario, vidaMinima, vidaA45, vidaMaxima } = entry;
    console.log(`Calculando HP para ${entry.clase} ${entry.raza} nivel ${nivel}`);
    console.log(`Datos: vidaA13=${vidaA13}, promedioDiario=${promedioDiario}, vidaMinima=${vidaMinima}, vidaA45=${vidaA45}, vidaMaxima=${vidaMaxima}`);
    let hp;
    if (!nivel || nivel <= 13) {
      hp = vidaA13;
    } else if (nivel < 45) {
      hp = Math.round(vidaA13 + (promedioDiario * (nivel - 13)));
    } else {
      hp = vidaA45;
    }
    return hp;
  }

  /**
   * Implementa retrieve(text) para KnowledgeProvider.
   * @param {string} text
   * @returns {Promise<Array<{ text: string, score: number, metadata: object }>>}
   */
  async retrieve(text) {
    if (!this.isStatsQuery(text)) {
      return [];
    }

    const { claseKey, razaKey, nivel } = this.parseQuery(text);

    if (!claseKey || !razaKey) {
      return [{
        text: 'Podría calcular vida, pero faltan datos (clase o raza). Por favor especificá ambos.',
        score: 1.0,
        metadata: { source: 'FurIA Calculator' }
      }];
    }

    const entry = this.stats.find(e => e.clase === claseKey && e.raza === razaKey);
    if (!entry) {
      return [{
        text: `No encontré datos de vida para ${claseKey} ${razaKey}.`,
        score: 1.0,
        metadata: { source: 'FurIA Calculator' }
      }];
    }

    if (!nivel) {
      return [{
        text: `La vida de un ${claseKey} ${razaKey} va de **${entry.vidaMinima}** a **${entry.vidaMaxima}**.`, 
        score: 1.0,
        metadata: { source: 'FurIA Calculator' }
      }];
    }

    const hp = this.calculateHpForEntry(entry, nivel);
    return [{
      text: `La vida promedio de un ${claseKey} ${razaKey} nivel ${nivel} es **${hp}**.`, 
      score: 1.0,
      metadata: { source: 'FurIA Calculator' }
    }];
  }
}
