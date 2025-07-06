import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';

const BASE_URL = 'https://fsao.com.ar';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const INDEX_FILE = path.resolve(DATA_DIR, 'wiki.html');
const DB_FILE = path.resolve(DATA_DIR, 'database.db');

async function extractIndex() {
  const html = fs.readFileSync(INDEX_FILE, 'utf-8');
  const $ = cheerio.load(html);
  const entries = [];

  $('article.index_article').each((_, art) => {
    const categoria = $(art).find('h2.index_category__title').text().trim();
    $(art).find('ul.index_category__list a').each((_, a) => {
      const titulo = $(a).text().trim();
      const href = $(a).attr('href');
      if (href) entries.push({ categoria, titulo, href });
    });
  });

  return entries;
}

async function downloadAll(entries) {
  console.log('🔽 Iniciando descarga de artículos renderizados...');
  const browser = await puppeteer.launch({ headless: true });
  for (const { titulo, href } of entries) {
    try {
      const url = `${BASE_URL}${href}`;
      const slug = href.replace(/^\/wiki\//, '').replace(/\//g, '_');
      const outFile = path.resolve(DATA_DIR, `${slug}.html`);
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle0' });
      const content = await page.content();
      fs.writeFileSync(outFile, content, 'utf-8');
      console.log(`✅ Descargado (renderizado): ${titulo}`);
      await page.close();
    } catch (err) {
      console.error(`⚠️ Error renderizando ${titulo}: ${err.message}`);
    }
  }
  await browser.close();
}

(async function main() {
  try {
    const entries = await extractIndex();
    await downloadAll(entries);
  } catch (err) {
    console.error('❌ Error en el proceso:', err);
    process.exit(1);
  }
})();
