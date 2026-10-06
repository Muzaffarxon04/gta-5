'use strict';
// ===== O'yin holati, paydo qilish, jinoyat/qidiruv, jang =====
const Game = {
  cars: [], peds: [], wanted: 0, heat: 0, evadeT: 0, evading: false, bustT: 0,
  time: 0, paused: true, started: false, timeScale: 1, spawnT: 0,
  camYaw: Math.PI / 2, camPitch: 0.22, mouseIdle: 9, shake: 0, hitMark: 0,
  respawnT: 0, deathKind: null, bigT: 0, crashCd: 0,
};
const SPAWN = { x: roadPos(4) - CITY.R / 2 - 2.5, z: roadPos(4) + 14, h: Math.PI / 2 };
const JAIL = { x: roadPos(3) + CITY.R / 2 + 2.5, z: roadPos(5) - 20, h: -Math.PI / 2 };
const WANTED_COPS = [0, 1, 2, 3, 5, 7];

function addMoney(v) {
  Player.money = Math.max(0, Player.money + v);
  const el = HUD.el.money;
  el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
}
function crime(amount) {
  if (Player.dead) return;
  Game.heat = Math.min(5.99, Game.heat + amount);
  Game.wanted = Math.max(Game.wanted, Math.min(5, Math.floor(Game.heat)));
  if (Game.wanted > 0) Game.evadeT = 0;
}
function setWanted(n) {
  Game.heat = Math.max(Game.heat, n + 0.01);
  Game.wanted = Math.max(Game.wanted, n);
  Game.evadeT = 0;
}

// ===== Paydo qilish (spawn) =====
function randomRoadSpot(px, pz, minD, maxD, lanes) {
  const N = CITY.N, ci = Math.round((px - CITY.OFF) / CITY.CELL), cj = Math.round((pz - CITY.OFF) / CITY.CELL);
  for (let k = 0; k < 24; k++) {
    const horiz = Math.random() < 0.5;
    const road = clamp((horiz ? cj : ci) + randi(-3, 3), 0, N), seg = clamp((horiz ? ci : cj) + randi(-3, 2), 0, N - 1);
    const fw = Math.random() < 0.5, a = fw ? seg : seg + 1, b = fw ? seg + 1 : seg;
    const [fi, fj, ti, tj] = horiz ? [a, road, b, road] : [road, a, road, b];
    const ax = roadPos(fi), az = roadPos(fj), dx = Math.sign(roadPos(ti) - ax), dz = Math.sign(roadPos(tj) - az);
    const lane = pick(lanes), s = rand(14, CITY.CELL - 16);
    const x = ax + dx * s - dz * lane, z = az + dz * s + dx * lane, d = Math.hypot(x - px, z - pz);
    if (d < minD || d > maxD) continue;
    if (Game.cars.some(c => dist2(c.x, c.z, x, z) < 100)) continue;
    return { fi, fj, ti, tj, lane, x, z, h: Math.atan2(dx, dz) };
  }
  return null;
}
function spawnCar(sp, type, role) {
  const c = new Car(type, sp.x, sp.z, sp.h, role);
  if (role !== 'parked') {
    setRoute(c, sp.fi, sp.fj, sp.ti, sp.tj, sp.lane, null);
    c.vx = Math.sin(sp.h) * 8; c.vz = Math.cos(sp.h) * 8;
  }
  Game.cars.push(c);
  return c;
}
function spawnPed(px, pz, minD, maxD) {
  const ci = Math.floor((px - CITY.OFF) / CITY.CELL), cj = Math.floor((pz - CITY.OFF) / CITY.CELL);
  for (let k = 0; k < 10; k++) {
    const b = World.blocks[clamp(ci + randi(-2, 2), 0, CITY.N - 1)][clamp(cj + randi(-2, 2), 0, CITY.N - 1)];
    const t = rand(0, b.ring.P), [x, z] = ringPoint(b, t), d = Math.hypot(x - px, z - pz);
    if (d < minD || d > maxD) continue;
    const p = new Ped(b, t);
    Game.peds.push(p);
    return p;
  }
  return null;
}
function populate() {
  const P = Player;
  for (const s of World.lotSlots) if (Math.random() < 0.3) {
    const c = new Car(randomCarType(), s.x, s.z, s.h + rand(-0.05, 0.05), 'parked');
    c.persist = true; Game.cars.push(c);
  }
  const starter = new Car('malibu', roadPos(4) - 7.6, SPAWN.z + 8, 0, 'parked', 0x1b1c1f);
  starter.persist = true; Game.cars.push(starter);
  for (let k = 0; k < 24; k++) { const sp = randomRoadSpot(P.x, P.z, 20, 230, [2.5, 5.5]); if (sp) spawnCar(sp, randomCarType(), 'traffic'); }
  for (let k = 0; k < 12; k++) { const sp = randomRoadSpot(P.x, P.z, 12, 200, [7.6]); if (sp) spawnCar(sp, randomCarType(), 'parked'); }
  for (let k = 0; k < 40; k++) spawnPed(P.x, P.z, 6, 140);
}
function manageSpawns(dt) {
  Game.spawnT -= dt;
  if (Game.spawnT > 0) return;
  Game.spawnT = 0.4;
  const P = Player, px = P.x, pz = P.z;
  let traffic = 0, parked = 0, cops = 0;
  for (let i = Game.cars.length - 1; i >= 0; i--) {
    const c = Game.cars[i];
    if (c === P.inCar || (c.persist && !c.dead)) continue;
    const d = Math.hypot(c.x - px, c.z - pz);
    const far = c.dead ? 180 : c.driver === 'police' ? (Game.wanted ? 320 : 240) : 260;
    if (d > far) { c.remove(); Game.cars.splice(i, 1); continue; }
    if (c.driver === 'traffic') traffic++;
    else if (c.driver === 'police') cops++;
    else if (!c.driver && !c.dead && !c.persist) parked++;
  }
  for (let i = Game.peds.length - 1; i >= 0; i--) {
    const p = Game.peds[i];
    if (Math.hypot(p.x - px, p.z - pz) > 170 || (!p.alive && p.deadT > 40)) { p.remove(); Game.peds.splice(i, 1); }
  }
  if (traffic < 26) { const sp = randomRoadSpot(px, pz, 90, 230, [2.5, 5.5]); if (sp) spawnCar(sp, randomCarType(), 'traffic'); }
  const wantCops = Game.wanted ? WANTED_COPS[Game.wanted] : 2;
  if (cops < wantCops) {
    const sp = randomRoadSpot(px, pz, Game.wanted ? 100 : 130, Game.wanted ? 190 : 230, [2.5]);
    if (sp) spawnCar(sp, 'police', 'police');
  }
  if (parked < 14) { const sp = randomRoadSpot(px, pz, 80, 220, [7.6]); if (sp) spawnCar(sp, randomCarType(), 'parked'); }
  if (Game.peds.length < 42) spawnPed(px, pz, 55, 150);
}

// ===== Hodisalar (boshqa fayllar chaqiradi) =====
function honk(car) {
  if (dist2(car.x, car.z, Player.x, Player.z) < 3600) SFX.horn();
}
function onCarImpact(car, imp) {
  if (car === Player.inCar) { SFX.crash(imp / 25); Game.shake = Math.max(Game.shake, Math.min(0.5, imp * 0.02)); }
}
function onCarCrash(A, B, imp) {
  const pc = Player.inCar;
  if (A !== pc && B !== pc) return;
  const o = A === pc ? B : A;
  SFX.crash(imp / 25);
  Game.shake = Math.max(Game.shake, Math.min(0.6, imp * 0.025));
  o.lastHitByPlayer = true;
  if (o.driver === 'traffic') o.panic = 6;
  if (o.driver === 'police' && Game.crashCd <= 0) { crime(0.6); Game.crashCd = 1.5; }
}
function onPlayerHurt() { HUD.hurtFlash(); }
function onPedKilled(p, byPlayer) {
  Pickups.add('cash', p.x, p.z, randi(1, 8) * 5, false);
  if (byPlayer) crime(1);
}
function playerDied(kind) {
  const P = Player;
  if (P.dead) return;
  P.dead = true; Game.respawnT = 4.5; Game.deathKind = kind; Game.timeScale = 0.4;
  Missions.fail('', true);
  HUD.objective(null); HUD.timer(null); HUD.prompt(null);
  HUD.big(kind === 'wasted' ? 'O\'LDING' : 'QO\'LGA OLINDING', kind === 'wasted' ? 'Shifoxona xizmati: $100' : 'Jarima: $250, o\'qlar musodara qilindi', kind);
  if (kind === 'busted' && P.inCar) { P.inCar.driver = null; P.inCar = null; P.hm.g.visible = true; }
}
function respawn() {
  const P = Player, kind = Game.deathKind, s = kind === 'busted' ? JAIL : SPAWN;
  if (P.inCar) { if (!P.inCar.dead) P.inCar.driver = null; P.inCar = null; }
  P.dead = false; P.hp = 100; P.armor = 0; P.vx = P.vz = P.vy = 0;
  addMoney(kind === 'busted' ? -250 : -100);
  if (kind === 'busted') { P.ammo = Math.min(P.ammo, 12); P.weapon = 0; }
  P.x = s.x; P.z = s.z; P.y = groundH(s.x, s.z); P.h = s.h;
  Game.camYaw = s.h; Game.camPitch = 0.22;
  P.hm.g.visible = true; P.hm.g.rotation.x = 0;
  Game.wanted = 0; Game.heat = 0; Game.evadeT = 0; Game.bustT = 0; Game.timeScale = 1;
  HUD.hideBig();
  HUD.help(kind === 'busted' ? 'Politsiya bo\'limidan chiqding.' : 'Shifoxonadan chiqding.', 4);
}

// ===== Mashinaga o'tirish / tushish =====
function nearestCar(maxD) {
  let best = null, bd = maxD * maxD;
  for (const c of Game.cars) {
    if (c.dead) continue;
    const d = dist2(c.x, c.z, Player.x, Player.z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
function enterCar(c) {
  const P = Player;
  if (c.driver === 'traffic' || c.driver === 'police') {
    // Haydovchini tortib chiqarish
    const rx = -Math.cos(c.h), rz = Math.sin(c.h), b = blockAt(c.x, c.z) || nearestBlock(c.x, c.z);
    const d = new Ped(b, 0, c.driver === 'police' ? 'police' : null);
    d.x = c.x - rx * 2; d.z = c.z - rz * 2;
    d.scare(P.x, P.z);
    Game.peds.push(d);
    crime(c.driver === 'police' ? 2 : 0.7);
  }
  c.driver = 'player'; c.ai = null; c.panic = 0; c.siren = false;
  P.inCar = c; P.hm.g.visible = false; P.punchT = 0;
  Game.mouseIdle = 9;
  SFX.door();
  HUD.help(`Mashina: <b>${c.T.name}</b>. <kbd>Probel</kbd> — qo'l tormozi, <kbd>F</kbd> — tushish`, 4);
}
function exitCar() {
  const P = Player, c = P.inCar;
  const rx = -Math.cos(c.h), rz = Math.sin(c.h), off = c.T.w / 2 + 0.7;
  let spot = null;
  for (const s of [-1, 1]) {
    const o = { x: c.x + rx * off * s, z: c.z + rz * off * s };
    if (!pushOut(o, 0.35, 0.5)) { spot = o; break; }
  }
  spot = spot || { x: c.x + rx * off * -1, z: c.z + rz * off * -1 };
  pushOut(spot, 0.35, 0.5);
  P.x = spot.x; P.z = spot.z; P.y = groundH(P.x, P.z);
  P.vx = c.vx * 0.3; P.vz = c.vz * 0.3; P.vy = 0; P.h = c.h;
  c.driver = null; c.thr = 0; c.hand = false; c.siren = false;
  P.inCar = null; P.hm.g.visible = true;
  Game.camYaw = c.h;
  SFX.door(); SFX.setEngine(false, 0);
}

// ===== Jang: musht va to'pponcha =====
function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const lx = cx - ox, ly = cy - oy, lz = cz - oz, tca = lx * dx + ly * dy + lz * dz;
  if (tca < 0) return -1;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
  return d2 > r * r ? -1 : tca - Math.sqrt(r * r - d2);
}
const _dir = new THREE.Vector3();
function playerAttack(camera) {
  const P = Player;
  if (P.weapon === 0) {
    if (P.punchT > 0) return;
    P.punchT = 0.3; SFX.punch();
    const fx = Math.sin(Game.camYaw), fz = Math.cos(Game.camYaw);
    for (const p of Game.peds) {
      if (!p.alive) continue;
      const dx = p.x - P.x, dz = p.z - P.z, d = Math.hypot(dx, dz);
      if (d > 1.8 || (dx * fx + dz * fz) / (d || 1) < 0.35) continue;
      const killed = p.hurt(14, P.x, P.z, fx * 3, 2, fz * 3);
      FX.sparks(p.x, p.y + 1.4, p.z, 0xffffff);
      Game.hitMark = 0.15;
      crime(killed ? 0 : 0.35);
      if (killed) onPedKilled(p, true);
      break;
    }
    return;
  }
  if (P.shootCd > 0) return;
  if (P.ammo <= 0) { P.weapon = 0; HUD.help('O\'q tugadi — mushtlarga o\'tildi.', 3); return; }
  P.shootCd = 0.2; P.ammo--; P.aimT = 1.2;
  const o = camera.position, dir = camera.getWorldDirection(_dir);
  let best = rayBuildings(o.x, o.y, o.z, dir.x, dir.y, dir.z, 220), hitPed = null, hitCar = null, head = false;
  if (dir.y < -1e-3) best = Math.min(best, -o.y / dir.y);
  for (const p of Game.peds) {
    if (!p.alive) continue;
    for (const [hy, r, hd] of [[0.55, 0.36, false], [1.2, 0.36, false], [1.72, 0.2, true]]) {
      const t = raySphere(o.x, o.y, o.z, dir.x, dir.y, dir.z, p.x, p.y + hy, p.z, r);
      if (t > 0 && t < best) { best = t; hitPed = p; head = hd; }
    }
  }
  for (const c of Game.cars) {
    const t = rayCar(c, o.x, o.y, o.z, dir.x, dir.y, dir.z, best);
    if (t > 0 && t < best) { best = t; hitCar = c; hitPed = null; }
  }
  const hx = o.x + dir.x * best, hy = o.y + dir.y * best, hz = o.z + dir.z * best;
  const gx = P.x + Math.sin(P.h) * 0.7 - Math.cos(P.h) * 0.33, gy = P.y + 1.48, gz = P.z + Math.cos(P.h) * 0.7 + Math.sin(P.h) * 0.33;
  FX.tracer(gx, gy, gz, hx, hy, hz);
  FX.spawn(gx, gy, gz, 0, 0, 0, 0.05, 0xffe08a, 0.25);
  FX.flash(gx, gy, gz, 1.5);
  SFX.shot();
  if (hitPed) {
    const killed = hitPed.hurt(head ? 100 : 22, P.x, P.z, dir.x * 2, 1, dir.z * 2);
    FX.sparks(hx, hy, hz, 0xb01818); Game.hitMark = 0.2;
    crime(killed ? 0 : 0.5);
    if (killed) onPedKilled(hitPed, true);
  } else if (hitCar) {
    hitCar.damage(8); hitCar.lastHitByPlayer = true;
    FX.sparks(hx, hy, hz); Game.hitMark = 0.15;
    if (hitCar.driver === 'traffic') hitCar.panic = 8;
    if (hitCar.driver === 'police') crime(0.4);
  } else FX.sparks(hx, hy, hz, 0xcccccc);
  crime(0.12);
  for (const p of Game.peds) if (p.alive && p !== hitPed && dist2(p.x, p.z, P.x, P.z) < 900) p.scare(P.x, P.z);
}

// ===== Portlash =====
function explodeCar(c) {
  const P = Player;
  c.wreck(); FX.explosion(c.x, c.y, c.z); SFX.boom();
  const dP = Math.hypot(P.x - c.x, P.z - c.z);
  Game.shake = Math.max(Game.shake, clamp(1 - dP / 60, 0, 1) * 0.9);
  if (c.lastHitByPlayer) crime(c.role === 'police' ? 2 : 0.5);
  for (const o of Game.cars) {
    if (o === c) continue;
    const d = Math.hypot(o.x - c.x, o.z - c.z);
    if (d >= 9) continue;
    o.damage(70 * (1 - d / 9));
    const k = (9 - d) * 1.2 / (d || 1);
    o.vx += (o.x - c.x) * k; o.vz += (o.z - c.z) * k;
  }
  for (const p of Game.peds) {
    if (!p.alive) continue;
    const d = Math.hypot(p.x - c.x, p.z - c.z);
    if (d < 8) { const k = 10 / (d + 1); if (p.hurt(100, c.x, c.z, (p.x - c.x) * k, 6, (p.z - c.z) * k)) onPedKilled(p, !!c.lastHitByPlayer); }
    else if (d < 40) p.scare(c.x, c.z);
  }
  if (P.inCar === c) hurtPlayer(500);
  else if (dP < 8 && !P.inCar) { hurtPlayer(70 * (1 - dP / 8)); P.vy = 5; P.onGround = false; }
}

// Mashina piyodani urib yuborishi
function carPedHits() {
  for (const c of Game.cars) {
    const sp = c.speed;
    if (sp < 2.5) continue;
    for (const p of Game.peds) {
      if (!p.alive || dist2(c.x, c.z, p.x, p.z) > 20) continue;
      const l = carLocal(c, p.x, p.z);
      if (Math.abs(l.r) < c.T.w / 2 + 0.3 && Math.abs(l.f) < c.T.l / 2 + 0.3) {
        const byP = c === Player.inCar;
        if (p.hurt(sp * 6, c.x, c.z, c.vx * 0.9, 2.5 + sp * 0.2, c.vz * 0.9)) onPedKilled(p, byP);
        else { p.x += c.vx * 0.15; p.z += c.vz * 0.15; }
        c.vx *= 0.97; c.vz *= 0.97;
        if (byP) { SFX.punch(); crime(0.3); }
      } else if (sp > 9 && l.f > 0 && l.f < 14 && Math.abs(l.r) < 3 && Math.random() < 0.1) p.scare(c.x, c.z);
    }
  }
}
