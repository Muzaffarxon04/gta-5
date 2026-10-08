// Ko'cha Qiroli — barcha fayllarni bitta HTML ga yig'adi (internetsiz o'ynash uchun).
// Ishlatish: node tools/build-offline.mjs  →  dist/kocha-qiroli.html
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(join(root, p), 'utf8');
let html = read('index.html');

// js/loader.js: modellar ro'yxati (hajmlari yangilanadi — yuklash foizi to'g'ri chiqsin) va keyin yuklanadigan kutubxonalar
let loader = read('js/loader.js');
const models = [...loader.matchAll(/\['([a-z]+)', \d+, ([12])\]/g)].map(m => m[1]);
for (const n of models) loader = loader.replace(new RegExp(`\\['${n}', \\d+,`), `['${n}', ${statSync(join(root, `models/${n}.js`)).size},`);
writeFileSync(join(root, 'js/loader.js'), loader);
const lazy = [...loader.matchAll(/\['((?:lib|sounds)\/[^']+\.js)', '[^']+'\]/g)].map(m => m[1]);
const extra = [...models.map(n => `models/${n}.js`), ...lazy];
console.log(`js/loader.js — ${models.length} ta model, ${lazy.length} ta kutubxona`);

// sw.js: keshlanadigan fayllar ro'yxati va versiyasi (mazmun o'zgarsa — yangi kesh)
{
  const files = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
    ...[...html.matchAll(/<link rel="stylesheet" href="([^"]+)"[^>]*>/g)].map(m => m[1]),
    ...[...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]), ...extra];
  const h = createHash('sha1');
  for (const f of files.slice(1)) h.update(readFileSync(join(root, f)));
  const ver = h.digest('hex').slice(0, 8);
  let sw = read('sw.js');
  sw = sw.replace(/const CACHE = '[^']*';/, `const CACHE = 'kocha-qiroli-${ver}';`).replace(/const FILES = \[[^\]]*\];/, `const FILES = ${JSON.stringify(files)};`);
  writeFileSync(join(root, 'sw.js'), sw);
  console.log(`sw.js — ${files.length} ta fayl, kesh ${ver}`);
}

// Bitta faylda manifest va ikonka havolalari kerak emas
html = html.replace(/<link rel="(manifest|icon|apple-touch-icon)" href="[^"]+">\n?/g, '');
html = html.replace(/<link rel="stylesheet" href="([^"]+)"[^>]*>/g, (_, href) => `<style>\n${read(href)}\n</style>`);
// Bitta faylda hamma narsa ichida: modellar va QR kutubxonalari yuklovchidan oldin (loader ularni tayyor deb ko'radi)
html = html.replace('<script src="js/loader.js"></script>', extra.map(f => `<script src="${f}"></script>\n`).join('') + '<script src="js/loader.js"></script>');
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) => {
  if (/^https?:/.test(src)) throw new Error(`Tashqi skript qoldi: ${src}`);
  return `<script>\n${read(src).replace(/<\/script/gi, '<\\/script')}\n</script>`;
});
// Faqat yuklanadigan resurslar tekshiriladi (oddiy <a href> havolalari mumkin)
const external = html.match(/<(?:script|link|img|source|iframe|video|audio)\b[^>]*\s(?:src|href)="https?:\/\/[^"]+"/g);
if (external) throw new Error('Tashqi havolalar qoldi: ' + external.join(', '));

html = '<!doctype html>\n<html lang="uz">\n' + html + '\n</html>\n';
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/kocha-qiroli.html'), html);
console.log(`dist/kocha-qiroli.html — ${(Buffer.byteLength(html) / 1048576).toFixed(2)} MB`);
