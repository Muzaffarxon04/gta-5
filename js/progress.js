'use strict';
// ===== O'yinni saqlash, statistika va yutuqlar =====
const SAVE_KEY = 'kocha-qiroli-save-v1';

const ACHIEVEMENTS = [
  { id: 'driver', name: 'Haydovchi', desc: '10 km yo\'l bosib o\'tish', test: s => s.drive >= 10000 },
  { id: 'speed', name: 'Tezkor', desc: '200 km/soat tezlikka chiqish', test: s => s.topKmh >= 200 },
  { id: 'biker', name: 'Mototsiklchi', desc: 'Mototsiklda 150 km/soat', test: s => s.topBikeKmh >= 150 },
  { id: 'taxi', name: 'Taksichi', desc: '5 ta yo\'lovchini manziliga yetkazish', test: s => s.fares >= 5 },
  { id: 'escape3', name: 'Qochqin', desc: '3 yulduzli qidiruvdan qutulish', test: s => s.maxEscape >= 3 },
  { id: 'escape5', name: 'Ilonday sirpanchiq', desc: '5 yulduzli qidiruvdan qutulish', test: s => s.maxEscape >= 5 },
  { id: 'rich', name: 'Boy-badavlat', desc: '$10 000 ga ega bo\'lish', test: () => Player.money >= 10000 },
  { id: 'tourist', name: 'Sayyoh', desc: 'Teleminora, Amir Temur xiyoboni va Chorsu bozoriga borish', test: s => ['Teleminora', 'Amir Temur xiyoboni', 'Chorsu bozori'].every(n => s.visited[n]) },
  { id: 'metro', name: 'Metro yo\'lovchisi', desc: '5 marta metroda yurish', test: s => s.metro >= 5 },
  { id: 'osh', name: 'Osh ishqibozi', desc: 'Choyxonada osh yeyish', test: s => s.osh >= 1 },
  { id: 'tuner', name: 'Tuning ustasi', desc: 'Bir mashinani to\'liq tuning qilish', test: s => s.fullTune >= 1 },
  { id: 'collector', name: 'Kolleksioner', desc: 'Garajda 4 ta mashina saqlash', test: () => Garage.slots.length >= 4 },
  { id: 'missions', name: 'Ishonchli odam', desc: '10 ta vazifani bajarish', test: s => s.missions >= 10 },
];

const Stats = {
  d: { drive: 0, walk: 0, topKmh: 0, topBikeKmh: 0, stolen: 0, fares: 0, missions: 0, escapes: 0, maxEscape: 0,
    earned: 0, metro: 0, osh: 0, fullTune: 0, playTime: 0, visited: {} },
  ach: {},
  _lx: null, _lz: null, _chk: 0,
  add(k, n = 1) { this.d[k] = (this.d[k] || 0) + n; },
  max(k, v) { if (v > (this.d[k] || 0)) this.d[k] = v; },
  tick(dt) {
    const P = Player;
    this.d.playTime += dt;
    if (this._lx != null && !P.dead) {
      const m = Math.hypot(P.x - this._lx, P.z - this._lz);
      if (m < 20) this.add(P.inCar ? 'drive' : 'walk', m);
    }
    this._lx = P.x; this._lz = P.z;
    if (P.inCar) {
      const kmh = P.inCar.speed * 3.6;
      this.max(P.inCar.T.kind === 'moto' ? 'topBikeKmh' : 'topKmh', kmh);
      if (P.inCar.T.kind === 'moto') this.max('topKmh', kmh);
    }
    const area = Landmarks.nameAt(P.x, P.z);
    if (area && !this.d.visited[area]) this.d.visited[area] = true;
    if ((this._chk -= dt) <= 0) { this._chk = 1; this.check(); }
  },
  check() {
    for (const a of ACHIEVEMENTS) {
      if (this.ach[a.id] || !a.test(this.d)) continue;
      this.ach[a.id] = Date.now();
      toast('Yutuq ochildi', a.name, a.desc);
      SFX.coin(); Save.soon();
    }
  },
};

// Ekran tepasida chiqadigan xabar (yutuq, saqlash)
let _toastT = 0;
function toast(kicker, title, desc) {
  const el = document.getElementById('toast');
  if (!el) return;
  document.getElementById('toastKicker').textContent = kicker;
  document.getElementById('toastName').textContent = title;
  document.getElementById('toastDesc').textContent = desc || '';
  el.hidden = false; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(_toastT); _toastT = setTimeout(() => (el.hidden = true), 4200);
}

const Save = {
  loaded: false, timer: 20, dirty: false,
  read() {
    try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; }
  },
  // init vaqtida chaqiriladi (o'yinchi va dunyo yaratilgandan keyin)
  load() {
    const d = this.read();
    if (!d || d.v !== 1) return false;
    const P = Player;
    Object.assign(P, { money: d.money ?? P.money, armor: d.armor ?? 0, owned: d.owned || P.owned, ammo: d.ammo || P.ammo, clothes: d.clothes || P.clothes });
    P.weapon = P.owned[d.weapon] ? d.weapon : 'fist';
    if (d.outfitId && d.outfitId !== 'default') setPlayerOutfit(d.outfitId);
    updateWeaponModel();
    Missions.done = d.missionsDone || 0;
    Object.assign(Stats.d, d.stats || {}); Stats.d.visited = Object.assign({}, (d.stats || {}).visited);
    Stats.ach = d.ach || {};
    Garage.slots = d.garage || [];
    if (d.settings) Object.assign(Settings.v, d.settings);
    if (Number.isFinite(d.dayT)) World.dayT = d.dayT;
    if (d.pos && Number.isFinite(d.pos.x) && Math.abs(d.pos.x) < CITY.LIMIT && Math.abs(d.pos.z) < CITY.LIMIT) {
      P.x = d.pos.x; P.z = d.pos.z; P.y = groundH(P.x, P.z); P.h = d.pos.h || 0;
      const o = { x: P.x, z: P.z }; pushOut(o, 0.4, 0.5); P.x = o.x; P.z = o.z;
    }
    this.loaded = true;
    return true;
  },
  data() {
    const P = Player;
    return {
      v: 1, savedAt: Date.now(), money: P.money, armor: Math.round(P.armor), weapon: P.weapon, owned: P.owned, ammo: P.ammo,
      outfitId: P.outfitId, clothes: P.clothes, missionsDone: Missions.done, stats: Stats.d, ach: Stats.ach,
      garage: Garage.slots, settings: Settings.v, dayT: World.dayT,
      pos: P.dead ? null : { x: +P.x.toFixed(1), z: +P.z.toFixed(1), h: +P.h.toFixed(2) },
    };
  },
  write(quiet) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data())); this.dirty = false; if (!quiet) toast('O\'yin', 'Saqlandi', ''); return true; }
    catch (e) { return false; }
  },
  soon() { this.dirty = true; this.timer = Math.min(this.timer, 2); },
  update(dt) {
    this.timer -= dt;
    if (this.timer <= 0) { this.timer = 20; this.write(true); }
  },
  reset() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* saqlash imkonsiz */ }
    location.reload();
  },
};
// Sahifa yopilayotganda yoki boshqa ilovaga o'tilganda saqlab qo'yamiz
addEventListener('pagehide', () => { if (Game.started) Save.write(true); });
document.addEventListener('visibilitychange', () => { if (document.hidden && Game.started) Save.write(true); });
