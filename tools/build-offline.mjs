// Ko'cha Qiroli — barcha fayllarni bitta HTML ga yig'adi (internetsiz o'ynash uchun).
// Ishlatish: node tools/build-offline.mjs  →  dist/kocha-qiroli.html
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(join(root, p), 'utf8');
let html = read('index.html');

html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, href) => `<style>\n${read(href)}\n</style>`);
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) => {
  if (/^https?:/.test(src)) throw new Error(`Tashqi skript qoldi: ${src}`);
  return `<script>\n${read(src).replace(/<\/script/gi, '<\\/script')}\n</script>`;
});
const external = html.match(/(?:src|href)="https?:\/\/[^"]+"/g);
if (external) throw new Error('Tashqi havolalar qoldi: ' + external.join(', '));

html = '<!doctype html>\n<html lang="uz">\n' + html + '\n</html>\n';
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/kocha-qiroli.html'), html);
console.log(`dist/kocha-qiroli.html — ${(Buffer.byteLength(html) / 1048576).toFixed(2)} MB`);
