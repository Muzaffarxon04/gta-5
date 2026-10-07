'use strict';
// ===== Ko'cha poygasi: 3 ta raqib (AI) bilan nazorat nuqtalari bo'ylab. Malika (poyga vazifasi) boshlaydi =====
const RACE_CARS = ['malibu', 'gentra', 'charger', 'gls', 'cobalt', 'lacetti'];
const RACE_COLORS = [0xc62828, 0x1565c0, 0xf9a825, 0x2e7d32, 0x6a1b9a, 0x1b1c1f];
const RACE_PRIZE = [900, 450, 200, 0];
const Race = {
  r: null, // { path, cps, racers, count, done, place, time }
  // Poyga yo'li: chorrahalar ketma-ketligi (raqiblar yo'l bo'ylab yuradi), har 2-chorraha — nazorat nuqtasi
  makePath(x, z) {
    let i = clamp(Math.round((x - CITY.OFF) / CITY.CELL), 0, CITY.N), j = clamp(Math.round((z - CITY.OFF) / CITY.CELL), 0, CITY.N), pi = -1, pj = -1;
    const path = [[i, j]];
    for (let n = 0; n < 14; n++) {
      const opts = neighbors(i, j).filter(q => !(q[0] === pi && q[1] === pj) && !path.some(p => p[0] === q[0] && p[1] === q[1]));
      const nx = pick(opts.length ? opts : neighbors(i, j).filter(q => !(q[0] === pi && q[1] === pj)));
      pi = i; pj = j; i = nx[0]; j = nx[1];
      path.push([i, j]);
    }
    return path.map(([a, b]) => ({ x: roadPos(a), z: roadPos(b) }));
  },
  start(g) {
    const P = Player, c = P.inCar;
    if (!c || c.dead || P.passenger) { HUD.help(`<b>${g.who}:</b> Poyga uchun mashinada kel!`, 4); g.cd = 6; return null; }
    const path = this.makePath(g.x, g.z), p0 = path[0], p1 = path[1];
    const h = Math.atan2(p1.x - p0.x, p1.z - p0.z), fx = Math.sin(h), fz = Math.cos(h), rx = -fz, rz = fx;
    // Start: birinchi chorrahadan keyin, ikki qatorda; o'yinchi — o'ng qatorda oldinda
    const at = (f, side) => ({ x: p0.x + fx * f + rx * side, z: p0.z + fz * f + rz * side });
    for (const o of Game.cars) if (o !== c && dist2(o.x, o.z, p0.x + fx * 14, p0.z + fz * 14) < 30 * 30 && !o.persist && o.driver !== 'player') { o.x += 400; }
    const s0 = at(18, 2.5);
    Object.assign(c, { x: s0.x, z: s0.z, h, vx: 0, vz: 0 });
    const racers = [];
    [[18, -2.5], [10, 2.5], [10, -2.5]].forEach(([f, side], k) => {
      const s = at(f, side), rc = new Car(pick(RACE_CARS), s.x, s.z, h, 'parked', RACE_COLORS[(k + randi(0, 5)) % RACE_COLORS.length]);
      rc.driver = 'racer'; rc.persist = true; rc.racer = { wp: 1, skill: [0.93, 0.88, 0.83][k] + rand(-0.03, 0.03), stuckT: 0, done: false };
      rc.setDriverModel(randomOutfit('man'));
      Game.cars.push(rc); racers.push(rc);
    });
    const cps = path.filter((_, k) => k > 0 && k % 2 === 0);
    let len = 0;
    for (let k = 1; k < path.length; k++) len += Math.hypot(path[k].x - path[k - 1].x, path[k].z - path[k - 1].z);
    this.r = { path, cps, racers, count: 3.5, place: 0, finished: 0, len };
    HUD.help(`<b>${g.who}:</b> Uchta poygachi bilan bellash! Birinchi bo'lsang — $${RACE_PRIZE[0]}.`, 5);
    return { type: 'race', time: Math.round(len / 12 + 40), reward: 0 };
  },
  // Har kadr (Missions.update chaqiradi): sanoq, raqiblar, o'rinlar. Natija: 'win' | 'lose' | null
  update(dt, m) {
    const R = this.r, P = Player, c = P.inCar;
    if (!R) return null;
    if (!c || c.dead) return 'lose';
    // Sanoq: hamma turadi
    if (R.count > 0) {
      const prev = Math.ceil(R.count);
      R.count -= dt;
      const now = Math.ceil(R.count);
      m.time += dt;
      for (const rc of [c, ...R.racers]) { rc.vx = rc.vz = 0; rc.thr = 0; }
      if (now !== prev) { if (now > 0) { HUD.big(String(now), 'Tayyorlan…', 'passed'); Game.bigT = 0.8; SFX.click(); } else { HUD.big('KETDIK!', '', 'passed'); Game.bigT = 0.8; SFX.coin(); } }
      HUD.objective('Poyga boshlanmoqda…');
      return null;
    }
    // Raqiblar
    for (const rc of R.racers) if (!rc.dead && rc.driver === 'racer' && !rc.racer.done) this.drive(rc, dt, R);
    // O'yinchi: nazorat nuqtalari
    const cp = R.cps[m.idx];
    if (cp && dist2(c.x, c.z, cp.x, cp.z) < 10 * 10) {
      m.idx++; SFX.coin();
      if (m.idx >= R.cps.length) {
        const place = 1 + R.racers.filter(rc => rc.racer.done).length;
        R.place = place;
        return place <= 3 ? 'win' : 'lose';
      }
    }
    const place = this.place(c, m);
    HUD.objective(`Poyga: <em>${place}/4</em> o'rin · nazorat nuqtasi ${Math.min(m.idx + 1, R.cps.length)}/${R.cps.length}`);
    return null;
  },
  // O'yinchining o'rni: yo'l bo'ylab qancha yurilgan (chorrahalar soni + keyingisigacha masofa)
  progressOf(x, z, wp, R) {
    const a = R.path[Math.max(0, wp - 1)], b = R.path[Math.min(wp, R.path.length - 1)], L = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    return wp + clamp(1 - Math.hypot(b.x - x, b.z - z) / L, 0, 1);
  },
  place(c, m) {
    const R = this.r;
    // O'yinchining yo'l nuqtasi: keyingi nazorat nuqtasigacha bo'lgan chorrahalardan eng yaqini
    const lastWp = m.idx * 2 + 2;
    let wp = Math.max(1, lastWp - 1);
    if (dist2(c.x, c.z, R.path[wp].x, R.path[wp].z) < 12 * 12) wp = Math.min(lastWp, R.path.length - 1);
    const me = this.progressOf(c.x, c.z, wp, R);
    return 1 + R.racers.filter(rc => rc.racer.done || this.progressOf(rc.x, rc.z, rc.racer.wp, R) > me).length;
  },
  drive(rc, dt, R) {
    const S = rc.racer, w = R.path[S.wp], n = R.path[S.wp + 1];
    if (!w) { S.done = true; rc.thr = -1; return; }
    const d = Math.hypot(w.x - rc.x, w.z - rc.z);
    if (d < 9) { S.wp++; if (S.wp >= R.path.length) { S.done = true; rc.thr = -1; return; } }
    // O'ng qatorda yurish, burilishdan oldin sekinlash
    const prev = R.path[S.wp - 1], dx = Math.sign(w.x - prev.x), dz = Math.sign(w.z - prev.z);
    const tx = w.x - dz * 2.5, tz = w.z + dx * 2.5;
    let turn = 0;
    if (n) { const nx = Math.sign(n.x - w.x), nz = Math.sign(n.z - w.z); turn = Math.abs(nx * -dz + nz * dx); }
    // Raqiblar o'yinchidan juda uzoqlashsa — sekinroq, orqada qolsa — tezroq (qiziqroq bo'lsin)
    const me = this.place(Player.inCar, Missions.active || { idx: 0 }), mine = this.progressOf(rc.x, rc.z, S.wp, R);
    const rubber = clamp(1 + (me > 1 ? 0 : 0.08) - (mine - (Missions.active ? Missions.active.idx * 2 : 0)) * 0.015, 0.85, 1.12);
    let cruise = rc.T.max * S.skill * rubber * (0.75 + 0.25 * Weather.grip);
    if (turn && d < 32) cruise = Math.min(cruise, 13 + d * 0.5);
    // Tiqilib qolsa — orqaga
    S.stuckT = rc.speed < 1.5 ? S.stuckT + dt : 0;
    if (S.revT > 0) { S.revT -= dt; rc.thr = -0.9; rc.steer = -rc.steer || 0.7; return; }
    if (S.stuckT > 1.6) { S.revT = 1; S.stuckT = 0; }
    steerTo(rc, tx, tz, cruise);
    rc.hand = false;
  },
  finish() {
    const R = this.r;
    if (!R) return;
    for (const rc of R.racers) { rc.driver = null; rc.persist = false; rc.thr = 0; rc.hand = true; rc.racer = null; }
    this.r = null;
  },
  prize(place) { return RACE_PRIZE[place - 1] || 0; },
  target(m) { return this.r ? this.r.cps[m.idx] : null; },
  blips() {
    if (!this.r) return [];
    return this.r.racers.filter(rc => !rc.dead).map(rc => ({ x: rc.x, z: rc.z, color: '#ff6f00', size: 5 }));
  },
};
