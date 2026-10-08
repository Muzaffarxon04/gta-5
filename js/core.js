'use strict';
// ===== Yordamchi funksiyalar =====
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const wrapAng = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const dist2 = (ax, az, bx, bz) => (ax - bx) * (ax - bx) + (az - bz) * (az - bz);
// Yo'nalish: h burchagi uchun oldinga = (sin h, cos h), ekranda o'ngga = (-cos h, sin h)
const fwdX = h => Math.sin(h), fwdZ = h => Math.cos(h);
const rightX = h => -Math.cos(h), rightZ = h => Math.sin(h);

// ===== Shahar o'lchamlari =====
const CITY = { N: 8, B: 64, R: 18, SW: 4 };
CITY.CELL = CITY.B + CITY.R;
CITY.SIZE = CITY.N * CITY.CELL;
CITY.OFF = -CITY.SIZE / 2;
CITY.LIMIT = CITY.SIZE / 2 + 34;
const roadPos = i => CITY.OFF + i * CITY.CELL;

// Nuqta qaysi kvartal (blok) ichida — yo'l bo'lsa null
function blockAt(x, z) {
  const i = Math.floor((x - CITY.OFF) / CITY.CELL), j = Math.floor((z - CITY.OFF) / CITY.CELL);
  if (i < 0 || j < 0 || i >= CITY.N || j >= CITY.N) return null;
  const lx = x - roadPos(i), lz = z - roadPos(j), h = CITY.R / 2;
  if (lx < h || lx > CITY.CELL - h || lz < h || lz > CITY.CELL - h) return null;
  return World.blocks[i][j];
}
// Balandlik zonalari: doiraviy maydon, balandligi markazdan masofaga qarab (Amir Temur xiyobonidagi zinali maydon)
const HEIGHT_ZONES = [];
function groundH(x, z) {
  for (const Z of HEIGHT_ZONES) {
    // To'g'ri to'rtburchak zona (estakada): balandlik z bo'ylab profil [[z, h], ...]
    if (Z.rect) {
      if (x < Z.x0 || x > Z.x1 || z < Z.z0 || z > Z.z1) continue;
      const P = Z.prof;
      for (let i = 1; i < P.length; i++) if (z <= P[i][0]) return Z.base + P[i - 1][1] + (P[i][1] - P[i - 1][1]) * (z - P[i - 1][0]) / (P[i][0] - P[i - 1][0]);
      continue;
    }
    const dx = x - Z.x, dz = z - Z.z;
    if (dx > Z.r || dx < -Z.r || dz > Z.r || dz < -Z.r) continue;
    const r = Math.hypot(dx, dz);
    if (r >= Z.r) continue;
    const P = Z.prof, f = r / Z.step, i = Math.min(Math.floor(f), P.length - 2);
    return Z.base + P[i] + (P[i + 1] - P[i]) * Math.min(1, f - i);
  }
  return blockAt(x, z) ? 0.15 : 0;
}

// ===== To'qnashuv (binolar, daraxtlar) =====
const GRID = 24;
const colliders = [];
const cgrid = new Map();
let queryId = 0;
function addCollider(x0, z0, x1, z1, h, tag) {
  const c = { x0, z0, x1, z1, h, tag, q: 0 };
  colliders.push(c);
  for (let gx = Math.floor(x0 / GRID); gx <= Math.floor(x1 / GRID); gx++)
    for (let gz = Math.floor(z0 / GRID); gz <= Math.floor(z1 / GRID); gz++) {
      const k = gx * 100000 + gz;
      if (!cgrid.has(k)) cgrid.set(k, []);
      cgrid.get(k).push(c);
    }
  return c;
}
function removeCollider(c) {
  const i = colliders.indexOf(c);
  if (i >= 0) colliders.splice(i, 1);
  for (const list of cgrid.values()) { const k = list.indexOf(c); if (k >= 0) list.splice(k, 1); }
}
function nearColliders(x, z, r) {
  const out = []; queryId++;
  for (let gx = Math.floor((x - r) / GRID); gx <= Math.floor((x + r) / GRID); gx++)
    for (let gz = Math.floor((z - r) / GRID); gz <= Math.floor((z + r) / GRID); gz++) {
      const list = cgrid.get(gx * 100000 + gz);
      if (!list) continue;
      for (const c of list) if (c.q !== queryId) { c.q = queryId; out.push(c); }
    }
  return out;
}
// Aylanani (o.x, o.z, radius r) binolardan itarib chiqaradi. Urilish normalini qaytaradi.
function pushOut(o, r, y = 0) {
  let hit = null;
  for (const c of nearColliders(o.x, o.z, r)) {
    if (y > c.h) continue;
    const cx = clamp(o.x, c.x0, c.x1), cz = clamp(o.z, c.z0, c.z1);
    let dx = o.x - cx, dz = o.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 < 1e-8) {
      const l = o.x - c.x0, rr = c.x1 - o.x, t = o.z - c.z0, b = c.z1 - o.z, m = Math.min(l, rr, t, b);
      if (m === l) { o.x = c.x0 - r; hit = { nx: -1, nz: 0 }; }
      else if (m === rr) { o.x = c.x1 + r; hit = { nx: 1, nz: 0 }; }
      else if (m === t) { o.z = c.z0 - r; hit = { nx: 0, nz: -1 }; }
      else { o.z = c.z1 + r; hit = { nx: 0, nz: 1 }; }
      continue;
    }
    const d = Math.sqrt(d2), nx = dx / d, nz = dz / d;
    o.x = cx + nx * r; o.z = cz + nz * r;
    hit = { nx, nz };
  }
  const L = CITY.LIMIT;
  if (o.x < -L) { o.x = -L; hit = { nx: 1, nz: 0 }; }
  if (o.x > L) { o.x = L; hit = { nx: -1, nz: 0 }; }
  if (o.z < -L) { o.z = -L; hit = { nx: 0, nz: 1 }; }
  if (o.z > L) { o.z = L; hit = { nx: 0, nz: -1 }; }
  return hit;
}
// Nur (ray) va quti kesishuvi — t masofani yoki -1 qaytaradi
function rayBox(ox, oy, oz, dx, dy, dz, x0, y0, z0, x1, y1, z1, maxT) {
  let t0 = 0, t1 = maxT;
  const ax = [[ox, dx, x0, x1], [oy, dy, y0, y1], [oz, dz, z0, z1]];
  for (const [o, d, lo, hi] of ax) {
    if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) return -1; continue; }
    let a = (lo - o) / d, b = (hi - o) / d;
    if (a > b) { const t = a; a = b; b = t; }
    if (a > t0) t0 = a;
    if (b < t1) t1 = b;
    if (t0 > t1) return -1;
  }
  return t0;
}
function rayBuildings(ox, oy, oz, dx, dy, dz, maxT, onlyBuildings) {
  let best = maxT;
  for (const c of colliders) {
    if (onlyBuildings && c.tag !== 'building') continue;
    const t = rayBox(ox, oy, oz, dx, dy, dz, c.x0, 0, c.z0, c.x1, c.h, c.z1, best);
    if (t >= 0 && t < best) best = t;
  }
  return best;
}
// Ikki nuqta orasida bino bormi (ko'rinish chizig'i)
function lineOfSight(ax, ay, az, bx, by, bz) {
  const dx = bx - ax, dy = by - ay, dz = bz - az, L = Math.hypot(dx, dy, dz) || 1;
  return rayBuildings(ax, ay, az, dx / L, dy / L, dz / L, L) >= L - 0.01;
}

// ===== Klaviatura va sichqoncha =====
const Input = { keys: {}, pressed: {}, mdx: 0, mdy: 0, mouseL: false, mouseR: false, clickL: false, locked: false, canvas: null,
  joy: { x: 0, y: 0, active: false }, steer: { v: 0, active: false }, wheel: 0, touch: false, pad: { active: false, x: 0, y: 0, rt: 0, lt: 0 } };
// Faol tayoq: telefon joystigi yoki geympadning chap tayog'i
const _noStick = { x: 0, y: 0, active: false };
function activeStick() {
  if (Input.joy.active) return Input.joy;
  const p = Input.pad;
  return p.active && (p.x || p.y) ? { x: p.x, y: p.y, active: true } : _noStick;
}
const kd = c => !!Input.keys[c];
const kp = c => !!Input.pressed[c];
function initInput(canvas) {
  Input.canvas = canvas;
  const block = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  addEventListener('keydown', e => {
    // Matn maydoniga yozilayotganda (masalan, raqam) o'yin tugmalari ishlamaydi
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (!e.repeat) Input.pressed[e.code] = true;
    Input.keys[e.code] = true;
    if (block.includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', e => { Input.keys[e.code] = false; });
  addEventListener('blur', () => { Input.keys = {}; Input.mouseL = Input.mouseR = false; });
  canvas.addEventListener('mousedown', e => {
    if (e.button === 0) { Input.mouseL = true; Input.clickL = true; }
    if (e.button === 2) Input.mouseR = true;
    requestLock();
  });
  addEventListener('mouseup', e => {
    if (e.button === 0) Input.mouseL = false;
    if (e.button === 2) Input.mouseR = false;
  });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => { Input.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  addEventListener('mousemove', e => {
    if (Input.locked || Input.mouseL || Input.mouseR) { Input.mdx += e.movementX || 0; Input.mdy += e.movementY || 0; }
  });
  document.addEventListener('pointerlockchange', () => {
    const was = Input.locked;
    Input.locked = document.pointerLockElement === canvas;
    if (was && !Input.locked && typeof onLockLost === 'function') onLockLost();
  });
}
function requestLock() {
  if (Input.locked || !Input.canvas || Input.touch) return;
  try { const p = Input.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ruxsat yo'q — sichqonchani tortib boshqarish ishlaydi */ }
}
function endFrameInput() { Input.pressed = {}; Input.mdx = 0; Input.mdy = 0; Input.clickL = false; Input.wheel = 0; }

// ===== Ovoz (WebAudio sintez, fayllarsiz) =====
// Dvigatel profillari: base/top — salt va maksimal aylanishdagi chastota (Gs)
// Dvigatel ovozi. Yozuvlar (sounds/engines.js) yuklangan bo'lsa — haqiqiy dvigatel qatlamlari (s: to'plam,
// salt yurish va eng yuqori aylanish — yozuvdagi benzinli dvigatel RPM ida, pitch — ohang, lp — tiniqlik,
// low — past chastota kuchaytirish dB); yuklanmaguncha — eski sintez (base…cut)
const ENGINE_PROFILES = {
  car:   { base: 34, top: 165, sub: 0.35, hi: 0.18, cut: 1,    s: { set: 'petrol', idle: 780, max: 6000, pitch: 1, lp: 1, low: 0 } },
  big4:  { base: 30, top: 150, sub: 0.45, hi: 0.15, cut: 0.9,  s: { set: 'petrol', idle: 760, max: 5800, pitch: 0.9, lp: 0.85, low: 3 } },
  v8:    { base: 25, top: 118, sub: 0.62, hi: 0.1, cut: 0.75,  s: { set: 'v8', idle: 780, max: 5600, pitch: 0.74, lp: 0.8, low: 6 } },
  small: { base: 44, top: 205, sub: 0.18, hi: 0.26, cut: 1.25, s: { set: 'petrol', idle: 860, max: 6200, pitch: 1.12, lp: 1.15, low: -3 } },
  moto:  { base: 52, top: 310, sub: 0.22, hi: 0.32, cut: 1.6,  s: { set: 'petrol', idle: 780, max: 6200, pitch: 1.5, lp: 1.4, low: -4 } },
  truck: { base: 20, top: 85, sub: 0.75, hi: 0.08, cut: 0.6,   s: { set: 'bus', idle: 600, max: 2200, pitch: 1, lp: 0.7, low: 4 } },
};
// Qatlamlar to'plami: [nom, sikl chastotasi (bo'lmasa — yozuvdagi), o'z ohangi (bo'lmasa — profildagi)].
// O't olish chastotasi = RPM / 30. V8 salt yurishi — haqiqiy V8 yozuvi, aylanish oshgach — pastroq ohangdagi 4 silindr
const ENGINE_SETS = {
  petrol: [['p0'], ['p1'], ['p2'], ['p3'], ['p4'], ['p5'], ['p6']],
  v8: [['v0', 26.7, 1], ['p1'], ['p2'], ['p3'], ['p4'], ['p5'], ['p6']],
  bus: [['b0', 20], ['b1', 54.7]],
};
function engineProfile(car) {
  if (car.T.kind === 'moto') return ENGINE_PROFILES.moto;
  if (car.T.kind === 'bus') return ENGINE_PROFILES.truck;
  if (['gls', 'charger'].includes(car.type)) return ENGINE_PROFILES.v8;
  if (['malibu', 'police'].includes(car.type)) return ENGINE_PROFILES.big4;
  if (['damas', 'spark'].includes(car.type)) return ENGINE_PROFILES.small;
  return ENGINE_PROFILES.car;
}
const SHOT_PROFILES = {
  pistol:  { crack: 0.9, body: 0.75, len: 0.24, low: 165, lp: 3200 },
  smg:     { crack: 0.65, body: 0.5, len: 0.13, low: 190, lp: 3800 },
  shotgun: { crack: 0.9, body: 0.85, len: 0.5, low: 105, lp: 2100 },
};
// MP3 dan ochilgan halqaning aniq chegaralari: n — halqa uzunligi (rate Hz da). Fayl oxirida halqa boshi takrorlangan —
// qaysi joydan boshlab ma'lumot n namunadan keyin aynan takrorlanishini qidiramiz (kodlovchi kechikishi har xil bo'ladi)
function findLoop(b, n, rate) {
  const d = b.getChannelData(0), k = b.sampleRate / rate, L = n * k, W = Math.round(384 * k), max = Math.round(2600 * k);
  let best = -2, bs = 0;
  for (let s = 0; s < max; s += 2) {
    const e = Math.round(s + L);
    if (e + W >= d.length) break;
    let num = 0, a2 = 0, b2 = 0;
    for (let i = 0; i < W; i += 3) { const p = d[s + i], q = d[e + i]; num += p * q; a2 += p * p; b2 += q * q; }
    const cor = num / Math.sqrt(a2 * b2 + 1e-12);
    if (cor > best) { best = cor; bs = s; }
  }
  return { start: bs / b.sampleRate, end: (bs + L) / b.sampleRate };
}
const SFX = {
  ctx: null, samples: {}, hornSrc: null,
  init() {
    if (this.ctx) { if (this.ctx.resume) this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const c = new AC(); this.ctx = c;
      // Umumiy chiqish: kompressor ovozni baland, lekin buzilmagan holda saqlaydi
      this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -14; this.comp.ratio.value = 6; this.comp.attack.value = 0.002;
      this.out = c.createGain(); this.out.gain.value = 0.75;
      this.out.connect(this.comp).connect(c.destination);
      const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
      // Shahar aks-sadosi (binolar orasidagi reverb)
      const irLen = Math.floor(c.sampleRate * 1.6), ir = c.createBuffer(2, irLen, c.sampleRate), gap = c.sampleRate * 0.012;
      for (let ch = 0; ch < 2; ch++) { const x = ir.getChannelData(ch); for (let i = 0; i < irLen; i++) x[i] = i < gap ? 0 : (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 3.2); }
      this.verb = c.createConvolver(); this.verb.buffer = ir;
      this.verbIn = c.createGain(); this.verbIn.gain.value = 0.32;
      this.verbIn.connect(this.verb).connect(this.out);
      // Yomg'ir va shamol shovqini (balandligi ob-havoga qarab)
      const rs = c.createBufferSource(); rs.buffer = buf; rs.loop = true;
      const rhp = c.createBiquadFilter(); rhp.type = 'highpass'; rhp.frequency.value = 900;
      this.rainLP = c.createBiquadFilter(); this.rainLP.type = 'lowpass'; this.rainLP.frequency.value = 9000;
      this.rainG = c.createGain(); this.rainG.gain.value = 0;
      rs.connect(rhp).connect(this.rainLP).connect(this.rainG).connect(this.out); rs.start();
      const ws = c.createBufferSource(); ws.buffer = buf; ws.loop = true; ws.playbackRate.value = 0.5;
      const wlp = c.createBiquadFilter(); wlp.type = 'lowpass'; wlp.frequency.value = 380;
      this.windG = c.createGain(); this.windG.gain.value = 0;
      ws.connect(wlp).connect(this.windG).connect(this.out); ws.start();
      // Vertolyot parragi: past shovqin, sekundiga ~15 marta urinadi
      const hs = c.createBufferSource(); hs.buffer = buf; hs.loop = true;
      const hlp = c.createBiquadFilter(); hlp.type = 'lowpass'; hlp.frequency.value = 260;
      const ham = c.createGain(); ham.gain.value = 0.5;
      const hlfo = c.createOscillator(), hlg = c.createGain(); hlfo.type = 'square'; hlfo.frequency.value = 15; hlg.gain.value = 0.5;
      hlfo.connect(hlg).connect(ham.gain); hlfo.start();
      this.heliG = c.createGain(); this.heliG.gain.value = 0;
      hs.connect(hlp).connect(ham).connect(this.heliG).connect(this.out); hs.start();
      this.engine = this.makeEngine(0.5);
      this.traffic = this.makeEngine(0.35);
      // Sirena (migalka): arra + uchburchak to'lqin
      this.sir = c.createOscillator(); this.sir.type = 'sawtooth';
      this.sir2 = c.createOscillator(); this.sir2.type = 'triangle'; this.sir2.detune.value = 18;
      const sf = c.createBiquadFilter(); sf.type = 'bandpass'; sf.frequency.value = 1300; sf.Q.value = 0.6;
      this.sirG = c.createGain(); this.sirG.gain.value = 0;
      this.sir.connect(sf); this.sir2.connect(sf);
      sf.connect(this.sirG).connect(this.out);
      this.sir.start(); this.sir2.start();
      this.decodeSamples();
      this.loadEngines();
    } catch (e) { this.ctx = null; }
  },
  // Dvigatel ovozi: asosiy ohang, past "gurillash", yuqori garmonika, havo so'rish shovqini va titrash
  makeEngine(level) {
    const c = this.ctx, E = { level };
    E.out = c.createGain(); E.out.gain.value = 0;
    E.am = c.createGain(); E.am.gain.value = 0.8;
    E.f = c.createBiquadFilter(); E.f.type = 'lowpass'; E.f.frequency.value = 600; E.f.Q.value = 1.4;
    E.f.connect(E.am).connect(E.out).connect(this.out);
    E.osc = [['sawtooth', 1], ['square', 0.5], ['triangle', 2]].map(([type, mul]) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; g.gain.value = 0.3;
      o.connect(g).connect(E.f); o.start();
      return { o, g, mul };
    });
    const lfo = c.createOscillator(), lg = c.createGain();
    lfo.type = 'sine'; lfo.frequency.value = 12; lg.gain.value = 0.2;
    lfo.connect(lg).connect(E.am.gain); lfo.start(); E.lfo = lfo;
    const n = c.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true;
    E.nf = c.createBiquadFilter(); E.nf.type = 'bandpass'; E.nf.frequency.value = 900; E.nf.Q.value = 0.7;
    E.ng = c.createGain(); E.ng.gain.value = 0;
    n.connect(E.nf).connect(E.ng).connect(E.out); n.start();
    return E;
  },
  driveEngine(E, vol, rpm, thr, p) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, f = p.base + (p.top - p.base) * rpm;
    E.out.gain.setTargetAtTime(vol * E.level * (0.75 + thr * 0.45), t, 0.08);
    for (const s of E.osc) s.o.frequency.setTargetAtTime(f * s.mul, t, 0.04);
    E.osc[1].g.gain.setTargetAtTime(p.sub, t, 0.1);
    E.osc[2].g.gain.setTargetAtTime(p.hi, t, 0.1);
    E.f.frequency.setTargetAtTime((320 + rpm * 1500 + thr * 700) * p.cut, t, 0.05);
    E.lfo.frequency.setTargetAtTime(f * 0.25, t, 0.05);
    E.ng.gain.setTargetAtTime(0.12 * thr * (0.3 + rpm), t, 0.08);
    E.nf.frequency.setTargetAtTime(600 + rpm * 1800, t, 0.05);
  },
  // inside — mashina ichidan (kokpit): ovoz bo'g'iqroq
  setEngine(on, rpm = 0, thr = 0, prof = ENGINE_PROFILES.car, inside = false) {
    if (!this.ctx) return;
    const real = this.engReady;
    if (!on || real) this.engine.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    if (real) { if (!on) this.driveReal(this.eng, 0); else this.driveReal(this.eng, 1, rpm, thr, prof, inside); return; }
    if (on) this.driveEngine(this.engine, 1, rpm, thr, prof);
  },
  // Yaqindagi boshqa mashina: rpm — uzatmali aylanish (0…1)
  setTraffic(vol, rpm = 0.3, prof = ENGINE_PROFILES.car, thr = 0.4) {
    if (!this.ctx) return;
    const real = this.engReady;
    if (vol <= 0.001 || real) this.traffic.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
    if (real) { this.driveReal(this.trafEng, vol > 0.001 ? vol * 0.8 : 0, rpm, thr, prof, false, vol); return; }
    if (vol > 0.001) this.driveEngine(this.traffic, vol, 0.15 + rpm * 0.7, 0.3, prof);
  },
  // ----- Haqiqiy yozuvlardan dvigatel -----
  // sounds/engines.js: har bir qatlam MP3, oxirida halqa boshi takrorlangan — kodlovchi kechikishini shu bo'yicha topamiz
  loadEngines() {
    if (this.engLoading || !this.ctx) return;
    this.engLoading = true;
    Loader.lib('sounds/engines.js', () => {
      const all = window.ENGINE_SOUNDS || {}, names = Object.keys(all);
      let left = names.length;
      this.engBufs = {};
      for (const n of names) {
        const S = all[n], bin = atob(S.data), u = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        const done = () => { if (--left === 0) this.engineSetup(); };
        try {
          this.ctx.decodeAudioData(u.buffer, b => { this.engBufs[n] = { buf: b, hz: S.hz, ...findLoop(b, S.n, S.rate) }; done(); }, done);
        } catch (e) { done(); }
      }
    });
  },
  engineSetup() {
    if (!Object.keys(this.engBufs).length) return;
    this.eng = this.makeReal(1); this.trafEng = this.makeReal(0.75);
    this.engReady = true;
  },
  // Bitta dvigatel: qatlamlar → past chastota kuchaytirgich → tiniqlik filtri → ovoz balandligi
  makeReal(level) {
    const c = this.ctx, E = { level, set: null, layers: [] };
    E.out = c.createGain(); E.out.gain.value = 0;
    E.lp = c.createBiquadFilter(); E.lp.type = 'lowpass'; E.lp.frequency.value = 4000; E.lp.Q.value = 0.5;
    E.low = c.createBiquadFilter(); E.low.type = 'lowshelf'; E.low.frequency.value = 160;
    E.bus = c.createGain();
    E.bus.connect(E.low).connect(E.lp).connect(E.out).connect(this.out);
    return E;
  },
  useSet(E, name) {
    if (E.set === name) return;
    const t = this.ctx.currentTime;
    for (const L of E.layers) { L.g.gain.setTargetAtTime(0, t, 0.05); try { L.src.stop(t + 0.3); } catch (e) { /* to'xtagan */ } }
    E.set = name; E.layers = [];
    for (const [n, hz, pitch] of ENGINE_SETS[name] || []) {
      const B = this.engBufs[n];
      if (!B) continue;
      const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
      src.buffer = B.buf; src.loop = true; src.loopStart = B.start; src.loopEnd = B.end;
      g.gain.value = 0;
      src.connect(g).connect(E.bus);
      src.start(t, B.start + Math.random() * (B.end - B.start));
      E.layers.push({ src, g, hz: hz || B.hz, pitch });
    }
  },
  // rpm 0.1 (salt) … 1 (eng yuqori), thr — gaz (0…1). Joriy aylanishga eng yaqin ikki qatlam ohangi moslab aralashadi
  driveReal(E, vol, rpm = 0.1, thr = 0, prof = ENGINE_PROFILES.car, inside = false, dist = 1) {
    const c = this.ctx, t = c.currentTime;
    if (!vol) { E.out.gain.setTargetAtTime(0, t, 0.12); return; }
    const P = prof.s;
    this.useSet(E, P.set);
    const k = clamp((rpm - 0.1) / 0.9, 0, 1), f = (P.idle + (P.max - P.idle) * k) / 30, Ls = E.layers;
    let i = 0;
    while (i < Ls.length - 2 && f > Ls[i + 1].hz) i++;
    const lo = Ls[i], hi = Ls[i + 1] || lo, w = hi === lo ? 0 : clamp(Math.log(f / lo.hz) / Math.log(hi.hz / lo.hz), 0, 1);
    Ls.forEach((L, j) => {
      const g = j === i ? Math.cos(w * Math.PI / 2) : L === hi ? Math.sin(w * Math.PI / 2) : 0;
      L.g.gain.setTargetAtTime(g, t, 0.03);
      L.src.playbackRate.setTargetAtTime(clamp(f / L.hz * (L.pitch || P.pitch), 0.25, 3), t, 0.03);
    });
    const load = clamp(thr, 0, 1);
    // Cheklovchiga tegsa (eng yuqori aylanishda gaz bosilgan) — ovoz uzilib-uzilib turadi
    const limiter = rpm > 0.97 && load > 0.5 && Math.floor(t * 15) % 2 ? 0.6 : 1;
    E.out.gain.setTargetAtTime(vol * E.level * (0.42 + 0.3 * k) * (0.62 + 0.38 * load) * limiter * 2, t, 0.05);
    E.lp.frequency.setTargetAtTime(clamp((700 + 5200 * (0.3 + 0.7 * load) * (0.35 + 0.65 * k)) * P.lp * (inside ? 0.62 : 1) * (0.5 + 0.5 * dist), 300, 11000), t, 0.06);
    E.low.gain.setTargetAtTime(P.low + (inside ? 4 : 0), t, 0.2);
  },
  // Qisqa shovqin portlashi (filtr bilan)
  burst(dest, t, dur, type, freq, vol, q = 0.7) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(Math.max(vol, 0.002), t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(dest); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  },
  tone(freq, dur, vol, type = 'sine', slide = 0, when = 0, dest = null) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + when, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(dest || this.out); o.start(t); o.stop(t + dur + 0.05);
  },
  // O'q ovozi: keskin "chirs" + tana + past gumburlash + aks-sado. far: 0 — yaqin, 1 — juda uzoq
  shot(kind = 'pistol', vol = 1, far = 0) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime, P = SHOT_PROFILES[kind] || SHOT_PROFILES.pistol;
    const bus = c.createGain(); bus.gain.value = vol * 0.6;
    const send = c.createGain(); send.gain.value = 0.7 + far * 0.8;
    bus.connect(this.out); bus.connect(send).connect(this.verbIn);
    let node = bus;
    if (far > 0) { const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200 - far * 3300; lp.connect(bus); node = lp; }
    this.burst(node, t, 0.035, 'highpass', 2200, P.crack);
    this.burst(node, t, P.len, 'lowpass', P.lp, P.body);
    this.tone(P.low, 0.16, 0.9 * P.body, 'sine', -P.low + 38, 0, node);
    if (far < 0.2) {
      if (kind === 'shotgun') { this.burst(this.out, t + 0.42, 0.05, 'bandpass', 2600, 0.5, 3); this.burst(this.out, t + 0.56, 0.06, 'bandpass', 1900, 0.55, 3); }
      else if (Math.random() < 0.7) { this.tone(3600, 0.05, 0.05, 'sine', 0, 0.28); this.tone(4300, 0.06, 0.04, 'sine', 0, 0.36); }
    }
  },
  click() { if (this.ctx) this.burst(this.out, this.ctx.currentTime, 0.03, 'bandpass', 3000, 0.4, 4); },
  swing() { if (this.ctx) this.burst(this.out, this.ctx.currentTime, 0.18, 'bandpass', 700, 0.35, 1.2); },
  boom() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, bus = this.ctx.createGain(); bus.gain.value = 1;
    bus.connect(this.out); bus.connect(this.verbIn);
    this.burst(bus, t, 1.8, 'lowpass', 420, 1.0);
    this.burst(bus, t, 0.08, 'highpass', 1500, 0.6);
    this.tone(75, 1.0, 0.85, 'sine', -45, 0, bus);
  },
  punch() { if (this.ctx) this.burst(this.out, this.ctx.currentTime, 0.08, 'lowpass', 800, 0.6); },
  crash(v) { if (this.ctx) { const t = this.ctx.currentTime; this.burst(this.out, t, 0.35, 'lowpass', 650, clamp(v, 0.08, 0.8)); this.burst(this.verbIn, t, 0.2, 'bandpass', 2400, clamp(v * 0.5, 0.05, 0.4), 2); } },
  coin() { this.tone(988, 0.08, 0.2, 'square'); this.tone(1319, 0.14, 0.2, 'square', 0, 0.07); },
  // Signal: yozib olingan ovoz (sounds/horn.js). hold — bosib turilsa o'rtasi takrorlanadi (hornUp to'xtatadi).
  // vol/rate — boshqa mashinalar uchun (uzoqlik va har xil ohang)
  horn(vol = 1, rate = 1, hold = false) {
    if (!this.ctx) return;
    const b = this.samples.horn;
    if (!b) { this.tone(415 * rate, 0.4, 0.18 * vol, 'sawtooth'); this.tone(330 * rate, 0.4, 0.18 * vol, 'sawtooth'); return; }
    const c = this.ctx, s = c.createBufferSource(), g = c.createGain(), L = SOUND_DATA.horn.loop;
    s.buffer = b; s.playbackRate.value = rate; g.gain.value = 0.85 * vol;
    if (hold) { this.hornUp(); s.loop = true; s.loopStart = L[0]; s.loopEnd = L[1]; this.hornSrc = s; }
    s.connect(g); g.connect(this.out); g.connect(this.verbIn);
    s.start();
  },
  // Qo'yib yuborilganda: halqadan chiqib, ovoz tabiiy so'nadi
  hornUp() { if (this.hornSrc) { this.hornSrc.loop = false; this.hornSrc = null; } },
  // sounds/*.js dagi base64 WAV'larni bir marta ochib qo'yish
  decodeSamples() {
    this.samples = {};
    for (const [n, S] of Object.entries(window.SOUND_DATA || {})) {
      try {
        const bin = atob(S.data), u = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        this.ctx.decodeAudioData(u.buffer, b => { this.samples[n] = b; }, () => {});
      } catch (e) { /* namuna bo'lmasa sintez ovoz ishlaydi */ }
    }
  },
  door() { if (this.ctx) this.burst(this.out, this.ctx.currentTime, 0.12, 'lowpass', 300, 0.45); },
  // Eshik ochilishi: qulf "chiq" etadi, keyin yengil g'ijirlash
  doorOpen() { if (this.ctx) { const t = this.ctx.currentTime; this.burst(this.out, t, 0.04, 'bandpass', 2400, 0.25, 4); this.burst(this.out, t + 0.05, 0.22, 'bandpass', 900, 0.08, 6); } },
  // Uzatma richagi: qisqa mexanik "chiq"
  gear() { if (this.ctx) { const t = this.ctx.currentTime; this.burst(this.out, t, 0.05, 'bandpass', 1800, 0.18, 3); this.burst(this.out, t + 0.04, 0.07, 'lowpass', 420, 0.22); } },
  // mode: 'wail' — sekin ko'tarilib-tushadi, 'yelp' — tez (yaqin ta'qibda)
  setSiren(vol, time, mode = 'wail') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    let f;
    if (mode === 'yelp') { const k = (time / 0.34) % 1; f = 700 + 820 * (k < 0.5 ? k * 2 : 2 - k * 2); }
    else f = 640 + 820 * (0.5 - 0.5 * Math.cos(time / 2.6 * TAU));
    this.sirG.gain.setTargetAtTime(vol * 0.16, t, 0.15);
    this.sir.frequency.setTargetAtTime(f, t, 0.012);
    this.sir2.frequency.setTargetAtTime(f, t, 0.012);
  },
  setRain(rain, wind, inCar) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.rainG.gain.setTargetAtTime(rain * 0.16, t, 0.5);
    this.rainLP.frequency.setTargetAtTime(inCar ? 1600 : 9000, t, 0.2);
    this.windG.gain.setTargetAtTime(wind * 0.14, t, 0.8);
  },
  thunder() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, bus = this.ctx.createGain(); bus.gain.value = 0.9;
    bus.connect(this.out); bus.connect(this.verbIn);
    this.burst(bus, t, 0.35, 'lowpass', 1200, 0.5);
    this.burst(bus, t + 0.05, 3.8, 'lowpass', 160, 1.0);
    this.tone(48, 2.4, 0.5, 'sine', -18, 0.1, bus);
  },
  setHeli(vol) { if (this.ctx) this.heliG.gain.setTargetAtTime(vol * 0.5, this.ctx.currentTime, 0.3); },
  nitro() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.burst(this.out, t, 0.9, 'bandpass', 1400, 0.4, 0.6);
    this.tone(120, 0.6, 0.15, 'sawtooth', 160);
  },
  metro() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.burst(this.out, t, 1.4, 'bandpass', 420, 0.45, 0.8);
    this.tone(190, 1.2, 0.12, 'sawtooth', -90);
  },
  mute() {
    this.hornUp();
    this.setEngine(false); this.setTraffic(0); this.setSiren(0, 0); this.setRain(0, 0, false); this.setHeli(0);
    if (typeof Radio !== 'undefined') Radio.silence();
  },
};
