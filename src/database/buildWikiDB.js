import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import * as cheerio from 'cheerio';

// 🛠️ Configuración de rutas
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const INDEX_FILE = path.resolve(DATA_DIR, 'wiki.html');
const DB_FILE = path.resolve(DATA_DIR, 'database.db');
const BASE_URL = 'https://fsao.com.ar';

// 🔎 Construye un mapa de slugs a metadatos desde el índice
function extractIndexMap() {
  const html = fs.readFileSync(INDEX_FILE, 'utf-8');
  const $ = cheerio.load(html);
  const map = {};

  $('article.index_article').each((_, art) => {
    const categoria = $(art).find('h2.index_category__title').text().trim();
    $(art).find('ul.index_category__list a').each((_, a) => {
      const titulo = $(a).text().trim();
      const href = $(a).attr('href');
      if (href) {
        const slug = href.replace(/^\/wiki\//, '').replace(/\//g, '_');
        map[slug] = { categoria, titulo, url: `${BASE_URL}${href}` };
      }
    });
  });

  return map;
}

// 🛠️ Inicializa o crea la base de datos SQLite
async function initDb() {
  const db = await open({ filename: DB_FILE, driver: sqlite3.Database });
  await db.exec(`
    CREATE TABLE IF NOT EXISTS wiki (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      categoria TEXT,
      titulo TEXT,
      url TEXT,
      keywords TEXT,
      contenido TEXT
    );
  `);
  return db;
}

// 📄 Parsea un HTML local y extrae párrafos, tablas y listas en orden
function parseHtmlContent(filePath) {
  const html = fs.readFileSync(filePath, 'utf-8');
  const $ = cheerio.load(html);

  // Remover elementos irrelevantes
  $('aside, nav, header, footer, script, style, .wiki-navigation').remove();

  const contentParts = [];
  // Selecciona el contenedor principal (mw-parser-output o main)
  const container = $('.mw-parser-output').length ? $('.mw-parser-output') : $('main');

  // Itera sobre párrafos, tablas y listas en orden de aparición
  container.find('p, table, ul, ol').each((_, el) => {
    const tag = el.tagName.toLowerCase();

    if (tag === 'p') {
      const text = $(el).text().trim();
      if (text) contentParts.push(text);

    } else if (tag === 'table') {
      const rows = [];
      $(el).find('tr').each((_, tr) => {
        const cells = [];
        $(tr).find('th, td').each((_, cell) => {
          const cellText = $(cell).text().trim().replace(/\s+/g, ' ');
          cells.push(cellText);
        });
        if (cells.length) rows.push(`| ${cells.join(' | ')} |`);
      });
      if (rows.length) {
        // Inserta separador de encabezado
        const headerCount = $(el).find('th').length;
        if (headerCount > 0) {
          const separator = `| ${Array(headerCount).fill('---').join(' | ')} |`;
          rows.splice(1, 0, separator);
        }
        contentParts.push(rows.join('\n'));
      }

    } else if (tag === 'ul' || tag === 'ol') {
      const items = [];
      $(el).find('li').each((idx, li) => {
        const itemText = $(li).text().trim();
        if (itemText) {
          const prefix = tag === 'ul' ? '- ' : `${idx + 1}. `;
          items.push(`${prefix}${itemText}`);
        }
      });
      if (items.length) contentParts.push(items.join('\n'));
    }
  });

  return contentParts.join('\n\n');
}

// 📝 Genera keywords desde el título
function generateKeywords(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .join(', ');
}

// 🚀 Flujo principal
(async () => {
  try {
    const indexMap = extractIndexMap();
    const db = await initDb();
    const insertStmt = await db.prepare(
      `INSERT OR REPLACE INTO wiki (categoria, titulo, url, keywords, contenido)
       VALUES (?, ?, ?, ?, ?)`
    );

    const files = fs.readdirSync(DATA_DIR)
      .filter(f => f.endsWith('.html') && f !== 'wiki.html');

    for (const file of files) {
      const slug = path.basename(file, '.html');
      const meta = indexMap[slug];
      if (!meta) {
        console.warn(`⚠️ Sin mapping de índice para slug: ${slug}`);
        continue;
      }

      const filePath = path.resolve(DATA_DIR, file);
      const contenido = parseHtmlContent(filePath);

      if (!contenido.trim()) {
        console.warn(`⛔ Sin contenido para: ${slug}`);
        continue;
      }

      const keywords = generateKeywords(meta.titulo);
      await insertStmt.run(
        meta.categoria,
        meta.titulo,
        meta.url,
        keywords,
        contenido
      );

      console.log(`💾 Guardado en DB: ${slug}`);
    }

    await insertStmt.finalize();
    await db.close();
    console.log(`✅ Base de datos actualizada en: ${DB_FILE}`);
  } catch (err) {
    console.error('❌ Error construyendo la DB:', err);
    process.exit(1);
  }
})();
