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
const groundH = (x, z) => (blockAt(x, z) ? 0.15 : 0);

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
  joy: { x: 0, y: 0, active: false }, wheel: 0, touch: false };
const kd = c => !!Input.keys[c];
const kp = c => !!Input.pressed[c];
function initInput(canvas) {
  Input.canvas = canvas;
  const block = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  addEventListener('keydown', e => {
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
const SFX = {
  ctx: null,
  init() {
    if (this.ctx) { if (this.ctx.resume) this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const ctx = new AC(); this.ctx = ctx;
      this.out = ctx.createGain(); this.out.gain.value = 0.45; this.out.connect(ctx.destination);
      const len = ctx.sampleRate, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
      // dvigatel
      this.eng = ctx.createOscillator(); this.eng.type = 'sawtooth';
      this.engF = ctx.createBiquadFilter(); this.engF.type = 'lowpass'; this.engF.frequency.value = 400;
      this.engG = ctx.createGain(); this.engG.gain.value = 0;
      this.eng.connect(this.engF).connect(this.engG).connect(this.out); this.eng.start();
      // sirena
      this.sir = ctx.createOscillator(); this.sir.type = 'square';
      const sf = ctx.createBiquadFilter(); sf.type = 'lowpass'; sf.frequency.value = 1600;
      this.sirG = ctx.createGain(); this.sirG.gain.value = 0;
      this.sir.connect(sf).connect(this.sirG).connect(this.out); this.sir.start();
    } catch (e) { this.ctx = null; }
  },
  noise(dur, freq, vol) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; f.type = 'lowpass'; f.frequency.value = freq;
    g.gain.setValueAtTime(Math.max(vol, 0.002), t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(this.out); s.start(t); s.stop(t + dur + 0.05);
  },
  tone(freq, dur, vol, type = 'sine', slide = 0) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.linearRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.out); o.start(t); o.stop(t + dur + 0.05);
  },
  shot(vol = 0.6) { this.noise(0.22, 2600, vol); this.tone(140, 0.1, vol * 0.5, 'square', -90); },
  boom() { this.noise(1.6, 420, 1.0); this.tone(70, 0.9, 0.7, 'sine', -45); },
  punch() { this.noise(0.08, 800, 0.55); },
  crash(v) { this.noise(0.35, 650, clamp(v, 0.08, 0.8)); },
  coin() { this.tone(988, 0.08, 0.2, 'square'); setTimeout(() => this.tone(1319, 0.14, 0.2, 'square'), 70); },
  horn() { this.tone(415, 0.4, 0.18, 'sawtooth'); this.tone(330, 0.4, 0.18, 'sawtooth'); },
  door() { this.noise(0.12, 300, 0.4); },
  setEngine(on, rpm) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engG.gain.setTargetAtTime(on ? 0.1 : 0, t, 0.12);
    this.eng.frequency.setTargetAtTime(38 + rpm * 120, t, 0.05);
    this.engF.frequency.setTargetAtTime(280 + rpm * 1000, t, 0.05);
  },
  setSiren(vol, time) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sirG.gain.setTargetAtTime(vol * 0.06, t, 0.2);
    this.sir.frequency.setTargetAtTime(Math.floor(time * 1.6) % 2 ? 960 : 700, t, 0.03);
  },
};
