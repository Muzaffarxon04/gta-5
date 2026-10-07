'use strict';
// ===== Yuklash: 3D modellar bosqichma-bosqich, foizi ekranda =====
// 1-bosqich — o'yin ochilishidan oldin (ko'chada eng ko'p uchraydigan mashinalar). Qolganlari menyu chiqqach
// orqa fonda yuklanadi va tayyor bo'lishi bilan o'yinga qo'shiladi (kod bilan yasalgan nusxa modelga almashadi).
// Bu fayl birinchi bo'lib ishga tushadi — modellar Three.js va boshqa skriptlar bilan bir vaqtda yuklana boshlaydi.
// [nom, hajmi baytda (foiz uchun, tools/build-offline.mjs yangilaydi), bosqich]
const MODEL_FILES = [
  ['nexia', 462976, 1], ['cobalt', 469078, 1], ['gentra', 544040, 1], ['spark', 465093, 1],
  ['malibu', 429938, 2], ['moto', 372642, 2], ['bus', 543871, 2], ['damas', 423635, 2], ['lacetti', 393947, 2],
  ['police', 431977, 2], ['timur', 854555, 2], ['person', 923718, 2], ['gls', 1242204, 2], ['charger', 630887, 2],
];
// Kerak bo'lganda yuklanadigan kutubxonalar (ko'p o'yinchi QR-kodi) — [fayl, global nomi]
const LAZY_LIBS = [['lib/qrcode.js', 'qrcode'], ['lib/jsQR.js', 'jsQR']];

const Loader = {
  got: {}, state: {}, subs: [], waits: [], active: 0, stage2: false, libs: {},
  web: /^https?:$/.test(location.protocol),
  files(stage) { return MODEL_FILES.filter(f => f[2] === stage); },
  // Bosqich bo'yicha yuklangan qism (0…1)
  progress(stage) {
    let a = 0, b = 0;
    for (const [n, size, s] of MODEL_FILES) if (s === stage) { b += size; a += this.state[n] === 'ok' || this.state[n] === 'fail' ? size : Math.min(size, this.got[n] || 0); }
    return b ? a / b : 1;
  },
  done(stage) { return this.files(stage).every(([n]) => this.state[n] === 'ok' || this.state[n] === 'fail'); },
  failed(n) { return this.state[n] === 'fail'; },
  pending(n) { const s = this.state[n]; return s !== 'ok' && s !== 'fail' && MODEL_FILES.some(f => f[0] === n); },
  // Ma'lumoti tayyor (hali ochilmagan) modellar
  ready() { return MODEL_FILES.map(f => f[0]).filter(n => window.MODEL_DATA && window.MODEL_DATA[n]); },
  wait(stage, cb) { if (this.done(stage)) cb(); else this.waits.push([stage, cb]); },
  // Har bir model fayli tayyor bo'lganda (muvaffaqiyatli yoki yo'q)
  each(fn) { this.subs.push(fn); },
  start() {
    for (const [n, size] of this.files(1)) this.fetchOne(n, size);
    this.ui();
  },
  // 2-bosqich: ikkitadan navbat bilan (ro'yxat tartibida — avval spawn yonidagi mashinalar)
  startStage2() {
    this.stage2 = true;
    this.pump();
  },
  pump() {
    if (!this.stage2) return;
    for (const [n, size] of this.files(2)) {
      if (this.active >= 2) break;
      if (!this.state[n]) this.fetchOne(n, size);
    }
  },
  fetchOne(n, size) {
    if (window.MODEL_DATA && window.MODEL_DATA[n]) { this.state[n] = 'ok'; this.finish(n); return; } // bitta fayldagi nusxada hammasi ichida
    this.state[n] = 'loading'; this.active++;
    const url = `models/${n}.js`, fallback = () => this.byTag(n, url);
    if (!this.web || !window.fetch) { fallback(); return; }
    fetch(url).then(r => {
      if (!r.ok) throw new Error(r.status);
      if (!r.body || !r.body.getReader || !window.TextDecoder) return r.text();
      // Oqim bo'lib o'qiymiz — foiz silliq o'sadi
      const reader = r.body.getReader(), parts = [];
      let len = 0;
      const pump = () => reader.read().then(({ done, value }) => {
        if (done) {
          const all = new Uint8Array(len);
          let o = 0;
          for (const p of parts) { all.set(p, o); o += p.length; }
          return new TextDecoder().decode(all);
        }
        parts.push(value); len += value.length; this.got[n] = len; this.ui();
        return pump();
      });
      return pump();
    }).then(text => {
      const s = document.createElement('script');
      s.text = text; document.head.appendChild(s); s.remove();
      return true;
    }).catch(() => false).then(ok => {
      const has = !!(window.MODEL_DATA && window.MODEL_DATA[n]);
      if (!ok && !has) { fallback(); return; } // masalan, eski brauzer yoki tarmoq xatosi — <script> bilan yana urinamiz
      this.active--; this.state[n] = has ? 'ok' : 'fail'; this.finish(n);
    });
  },
  // Sahifa fayldan ochilgan (file://) yoki fetch ishlamasa — oddiy <script> bilan
  byTag(n, url) {
    const s = document.createElement('script');
    s.src = url;
    s.onload = () => { this.state[n] = window.MODEL_DATA && window.MODEL_DATA[n] ? 'ok' : 'fail'; this.active--; this.finish(n); };
    s.onerror = () => { this.state[n] = 'fail'; this.active--; this.finish(n); };
    document.head.appendChild(s);
  },
  finish(n) {
    this.ui();
    for (const fn of this.subs) fn(n, this.state[n] === 'ok');
    this.waits = this.waits.filter(([st, cb]) => { if (!this.done(st)) return true; cb(); return false; });
    this.pump();
  },
  // Yuklash ekrani (1-bosqich) va menyudagi kichik yozuv (2-bosqich)
  ui() {
    const now = performance.now();
    if (this._t && now - this._t < 60 && !this.done(1)) return;
    this._t = now;
    const bar = document.getElementById('loadBar'), pct = document.getElementById('loadPct'), txt = document.getElementById('loadText');
    if (bar) {
      const p = Math.round(this.progress(1) * 100);
      bar.style.width = p + '%'; pct.textContent = p + '%';
      if (this.done(1)) txt.textContent = 'Shahar qurilmoqda…';
    }
    const bg = document.getElementById('bgLoad');
    if (bg && this.stage2) {
      const fin = this.done(2);
      bg.hidden = fin;
      if (!fin) bg.textContent = `Qo'shimcha modellar yuklanmoqda… ${Math.round(this.progress(2) * 100)}%`;
    }
  },
  // Kutubxonani birinchi kerak bo'lganda yuklash
  lib(src, cb) {
    const def = LAZY_LIBS.find(l => l[0] === src), name = def && def[1];
    if (name && window[name]) { cb(); return; }
    let L = this.libs[src];
    if (!L) {
      L = this.libs[src] = { cbs: [] };
      const s = document.createElement('script');
      s.src = src;
      s.onload = s.onerror = () => { L.done = true; L.cbs.forEach(f => f()); L.cbs = []; };
      document.head.appendChild(s);
    }
    if (L.done) cb(); else L.cbs.push(cb);
  },
};
Loader.start();
