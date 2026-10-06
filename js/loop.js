'use strict';
// ===== Asosiy sikl, kamera, menyu =====
let renderer, scene, camera, headlight;

function init(data) {
  const canvas = document.getElementById('game');
  const touch = TouchUI.detect();
  if (touch) { Game.maxTraffic = 18; Game.maxPeds = 28; Settings.v.quality = 'medium'; }
  Game.baseTraffic = Game.maxTraffic; Game.basePeds = Game.maxPeds;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: !touch, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, touch ? 1.25 : 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 900);
  buildWorld(scene);
  if (touch) World.sun.shadow.mapSize.set(1024, 1024);
  FX.init(scene);
  Weather.init(scene);
  headlight = new THREE.SpotLight(0xfff0d0, 0, 70, 0.55, 0.5, 1);
  scene.add(headlight, headlight.target);
  initInput(canvas);
  TouchUI.init();
  HUD.init();
  initPlayer(SPAWN.x, SPAWN.z);
  Player.h = SPAWN.h;
  loadModels(() => {
    try { finishInit(data); }
    catch (e) { document.getElementById('loading').textContent = 'Xatolik: ' + e.message; console.error(e); }
  });
}
function finishInit(data) {
  Landmarks.useTemurModel();
  Player.money = Number.isFinite(data.money) ? data.money : 500;
  if (Number.isFinite(data.x) && Number.isFinite(data.z)) { Player.x = data.x; Player.z = data.z; Player.y = groundH(data.x, data.z); }
  if (Number.isFinite(data.dayT)) World.dayT = data.dayT;
  // Saqlangan o'yin (pul, qurollar, kiyim, garaj, sozlamalar, joy)
  const had = Save.load();
  Settings.apply();
  populate();
  Pickups.init();
  Missions.init(scene);
  placePeople(scene);
  Shops.init(scene);
  Garage.init(scene);
  MapUI.init(scene);
  Panel.init();
  MPUI.init();
  // Saytdan ochilganda (GitHub Pages) internetsiz ishlash uchun keshni yoqamiz
  try {
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && window.top === window.self && !/claude/.test(location.hostname))
      navigator.serviceWorker.register('sw.js').catch(() => { /* kesh ixtiyoriy */ });
  } catch (e) { /* iframe ichida */ }
  if (had) document.getElementById('play').textContent = 'Davom etish';
  addEventListener('resize', onResize);
  // Telefon burilganda o'lchamlar biroz kechikib yangilanadi
  addEventListener('orientationchange', () => setTimeout(onResize, 250));
  addEventListener('keydown', e => { if (e.code === 'KeyP' && Game.started && !e.repeat) togglePause(); });
  document.getElementById('play').addEventListener('click', startGame);
  try {
    if (window.claude && window.claude.hot && window.claude.hot.snapshot)
      window.claude.hot.snapshot(() => ({ money: Player.money, x: Player.x, z: Player.z, dayT: World.dayT }));
  } catch (e) { /* yangilanishda holatni saqlash ixtiyoriy */ }
  updateSky(0, Player.x, Player.z);
  document.getElementById('loading').hidden = true;
  document.getElementById('menu').hidden = false;
  document.getElementById('play').focus();
  requestAnimationFrame(frame);
}
// Telefonda faqat albom (yotiq) rejimi: tik holatda "telefonni yotqizing" ekrani chiqadi (CSS), o'yin to'xtaydi
const isPortrait = () => Input.touch && innerHeight > innerWidth;
// To'liq ekran va albom holatini qulflash (Android Chrome'da ishlaydi; iPhone'da — bosh ekranga qo'shilgan ilovada)
function goFullscreen() {
  if (!Input.touch || document.fullscreenElement || document.webkitFullscreenElement) return;
  const el = document.documentElement, req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req) return;
  const lock = () => { try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* qulflab bo'lmaydi */ } };
  try {
    const p = req.call(el, { navigationUI: 'hide' });
    if (p && p.then) p.then(lock, () => {}); else lock();
  } catch (e) { /* ruxsat yo'q (masalan, iframe ichida) */ }
}
function onResize() {
  if (isPortrait() && Game.started && !Game.paused) pauseGame();
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
function startGame() {
  goFullscreen();
  if (isPortrait()) return; // tik holatda o'yin boshlanmaydi
  SFX.init();
  document.getElementById('menu').hidden = true;
  HUD.el.hud.hidden = false;
  if (!Game.started) {
    Game.started = true;
    Game.camYaw = Player.h;
    HUD.help(`Yoningizda qora Malibu va qizil mototsikl turibdi — ${Input.touch ? 'yoniga borib, eshik oldidagi «Minish» ni bosing' : '<kbd>F</kbd> bilan o\'tiring'}. Ko\'chaning narigi tomonida qurol (<b>Q</b>) va kiyim (<b>K</b>) do\'konlari bor. Sariq <b>!</b> — vazifalar.`, 9);
  }
  Game.paused = false;
  TouchUI.show(true);
  document.getElementById('play').textContent = 'Davom etish';
  requestLock();
}
function pauseGame() {
  if (Game.paused) return;
  Game.paused = true;
  document.getElementById('menu').hidden = false;
  SFX.mute();
  TouchUI.show(false);
  if (Input.locked && document.exitPointerLock) document.exitPointerLock();
}
function togglePause() { if (Game.paused) startGame(); else pauseGame(); }
function onLockLost() { if (Game.started && !Game.shopOpen) pauseGame(); }

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const raw = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  Pad.poll();
  if (!Game.started) menuDemo(raw);
  else if (!Game.paused && !Game.shopOpen) step(raw);
  MP.update(raw);
  if (!isPortrait()) renderer.render(scene, camera); // tik holatda chizish shart emas (batareya)
  endFrameInput();
}
// Menyu orqasida shahar "jonli" ko'rinadi
function menuDemo(dt) {
  Game.time += dt;
  simulateWorld(dt);
  const a = Game.time * 0.05;
  camera.position.set(SPAWN.x + Math.cos(a) * 95, 58, SPAWN.z + Math.sin(a) * 95);
  camera.lookAt(SPAWN.x, 6, SPAWN.z);
}

function step(raw) {
  const P = Player;
  if (P.dead) { Game.respawnT -= raw; if (Game.respawnT <= 0) respawn(); }
  if (Game.bigT > 0) { Game.bigT -= raw; if (Game.bigT <= 0 && !P.dead) HUD.hideBig(); }
  const dt = raw * Game.timeScale;
  Game.time += dt; Game.crashCd -= dt; Game.hitMark -= dt; P.shootCd -= dt;
  if (!P.dead) handleActions();
  if (P.inCar && !P.dead) updatePlayerCar(dt);
  else if (!P.dead) updatePlayerFoot(dt, Game.camYaw, Game.cars);
  else if (!P.inCar) deathAnim(dt);
  simulateWorld(dt);
  if (P.inCar) { const c = P.inCar; P.x = c.x; P.z = c.z; P.y = c.y; P.h = c.h; P.vx = c.vx; P.vz = c.vz; }
  updateWanted(dt);
  policeShoot(dt);
  checkBusted(dt);
  Pickups.update(dt, Game.time);
  if (!P.dead) { Missions.update(dt); Shops.update(dt); Taxi.update(dt); }
  Garage.update(dt);
  MapUI.update(dt);
  PoliceAir.update(dt); Roadblocks.update(dt); deployCops(dt);
  Stats.tick(dt); Save.update(raw);
  TouchUI.update();
  Cockpit.update(raw);
  if (Cockpit.active()) Cockpit.camera(raw); else updateCamera(raw);
  updateAudio(raw);
  updateHeadlight();
  prompts();
  HUD.update(raw, { wanted: Game.wanted, evading: Game.evading, aiming: !P.inCar && !WEAPONS[P.weapon].melee && (Input.mouseR || P.aimT > 0), hitMark: Game.hitMark });
  const sp = P.inCar ? P.inCar.speed : 0;
  HUD.drawRadar(P.x, P.z, Game.camYaw, P.h, lerp(1.7, 0.95, clamp(sp / 35, 0, 1)), radarBlips(), Game.wanted, Game.time, MapUI.route, MapUI.routeColor);
}

function handleActions() {
  const P = Player;
  if (kp('KeyF') || kp('Enter')) {
    if (P.inCar) exitCar();
    else { const c = nearestCar(4.2); if (c) enterCar(c); }
  }
  WEAPON_ORDER.forEach((w, i) => { if (kp('Digit' + (i + 1))) selectWeapon(w); });
  if (Input.wheel && !P.inCar) cycleWeapon(Input.wheel > 0 ? 1 : -1);
  if (P.inCar && (kp('KeyH') || (Input.touch && Input.clickL))) SFX.horn();
  if (P.inCar && kp('KeyR')) Radio.cycle();
  if (kp('KeyT')) Taxi.toggle();
  if (kp('KeyV')) Cockpit.toggle();
  if (kp('KeyO')) Weather.cycle();
  if (P.inCar && P.inCar.type === 'police' && kp('KeyG')) {
    P.inCar.siren = !P.inCar.siren;
    HUD.help(P.inCar.siren ? 'Sirena yoqildi' : 'Sirena o\'chirildi', 1.5);
  }
  const W = WEAPONS[P.weapon];
  if (!P.inCar && (Input.clickL || (W.auto && Input.mouseL && (Input.locked || Input.touch)))) playerAttack(camera);
}
function updatePlayerCar(dt) {
  const c = Player.inCar;
  if (Player.passenger) return;
  const J = activeStick(), pad = Input.pad;
  c.thr = J.active ? (Math.abs(J.y) < 0.15 ? 0 : clamp(-J.y * 1.3, -1, 1)) : (kd('KeyW') || kd('ArrowUp') ? 1 : 0) - (kd('KeyS') || kd('ArrowDown') ? 1 : 0);
  if (pad.active && (pad.rt > 0.05 || pad.lt > 0.05)) c.thr = pad.rt - pad.lt;
  const st = J.active ? -J.x : (kd('KeyA') || kd('ArrowLeft') ? 1 : 0) - (kd('KeyD') || kd('ArrowRight') ? 1 : 0);
  c.steer = lerp(c.steer, st, 1 - Math.exp(-7 * dt));
  c.hand = kd('Space');
}
function deathAnim(dt) {
  const g = Player.hm.g;
  if (g.rotation.x === 0) poseDead(Player.hm);
  g.rotation.x = Math.max(-Math.PI / 2, g.rotation.x - dt * 4);
  g.position.y = lerp(g.position.y, groundH(Player.x, Player.z) + 0.12, 0.2);
}
// Yonayotgan mashinadan haydovchi qochadi
function bailOut(c) {
  const b = blockAt(c.x, c.z) || nearestBlock(c.x, c.z), p = new Ped(b, 0, c.driverOutfit || (c.type === 'police' ? 'police' : null));
  c.setDriverModel(null);
  p.x = c.x + Math.cos(c.h) * 2; p.z = c.z - Math.sin(c.h) * 2;
  p.scare(c.x, c.z); Game.peds.push(p);
  c.driver = null;
}

function simulateWorld(dt) {
  const P = Player, cars = Game.cars;
  for (const c of cars) {
    if (c.driver === 'remote') { c.sync(dt, Game.time); continue; } // boshqa o'yinchi mashinasi
    if (!c.dead) {
      if (c.onFire && (c.driver === 'traffic' || c.driver === 'police')) bailOut(c);
      if (c.driver === 'traffic') updateTrafficAI(c, dt, cars, P);
      else if (c.driver === 'police') updatePoliceAI(c, dt, cars, P, Game.wanted);
      else if (c.driver !== 'player') { c.thr = 0; c.steer *= 0.9; c.hand = false; }
    }
    if (c.driver || c.onFire || c.vx * c.vx + c.vz * c.vz > 0.01) c.physics(dt);
    const ex = Math.sin(c.h) * c.T.l * 0.36, ez = Math.cos(c.h) * c.T.l * 0.36;
    if (c.onFire) {
      c.burnT -= dt;
      if (Math.random() < 0.6) FX.fire(c.x + ex, c.y + 1, c.z + ez);
      if (c.burnT <= 0) explodeCar(c);
    } else if (!c.dead && c.hp < 35 && Math.random() < 0.15) FX.smoke(c.x + ex, c.y + 1, c.z + ez, c.hp < 20);
    else if (c.dead && Math.random() < 0.03) FX.smoke(c.x, c.y + 1, c.z, true);
    if (c.drift > 5 && c.speed > 8 && Math.random() < 0.5) FX.smoke(c.x - ex, 0.3, c.z - ez, false);
    c.sync(dt, Game.time);
  }
  collideCars(cars);
  carPedHits();
  for (const p of Game.peds) p.update(dt);
  updateSignals(dt);
  FX.update(dt);
  updateSky(dt, P.x, P.z);
  Weather.update(dt, camera);
  Weather.apply();
  Landmarks.update(Game.time);
  manageSpawns(dt);
}

// ===== Qidiruv: yulduzlar, otishma, qo'lga olish =====
function updateWanted(dt) {
  if (Game.wanted === 0) { Game.heat = Math.max(0, Game.heat - dt * 0.04); Game.evading = false; return; }
  const P = Player;
  let seen = false;
  for (const c of Game.cars) if (c.driver === 'police' && (c.sees || dist2(c.x, c.z, P.x, P.z) < 400)) { seen = true; break; }
  if (!seen) seen = PoliceAir.sees() || Game.peds.some(p => p.cop && p.alive && p.state === 'chase' && dist2(p.x, p.z, P.x, P.z) < 900);
  Game.evading = !seen;
  Game.evadeT = seen ? 0 : Game.evadeT + dt;
  if (Game.evadeT > 10 + Game.wanted * 4) {
    Stats.add('escapes'); Stats.max('maxEscape', Game.wanted); Save.soon();
    Game.wanted = 0; Game.heat = 0; Game.evadeT = 0;
    HUD.help('Politsiyadan qutulding!', 3);
  }
}
function policeShoot(dt) {
  const P = Player;
  if (Game.wanted < 2 || P.dead) return;
  const T = P.inCar || P;
  for (const c of Game.cars) {
    if (c.driver !== 'police' || !c.sees) continue;
    const d = Math.hypot(T.x - c.x, T.z - c.z);
    if (d > 40) continue;
    c.shootT -= dt;
    if (c.shootT > 0) continue;
    c.shootT = rand(0.8, 1.7) / (Game.wanted >= 4 ? 1.7 : 1);
    const hitP = clamp(0.5 - d / 120 - Math.hypot(T.vx, T.vz) / 70, 0.08, 0.5), miss = Math.random() > hitP;
    const o = miss ? 2.2 : 0.3;
    FX.tracer(c.x, c.y + 1.5, c.z, T.x + rand(-o, o), T.y + 1.1 + rand(-o, o) * 0.4, T.z + rand(-o, o));
    SFX.shot('pistol', clamp(1.1 - d / 60, 0.3, 1), clamp(d / 55, 0.1, 0.85));
    if (!miss) { if (P.inCar) { P.inCar.damage(4); hurtPlayer(1.5); } else hurtPlayer(rand(5, 9)); }
  }
}
function checkBusted(dt) {
  const P = Player;
  if (Game.wanted === 0 || P.dead) { Game.bustT = 0; return; }
  let near = false;
  for (const c of Game.cars) if (c.driver === 'police' && c.speed < 4 && dist2(c.x, c.z, P.x, P.z) < (P.inCar ? 30 : 49)) { near = true; break; }
  if (!near && !P.inCar) near = Game.peds.some(p => p.cop && p.alive && p.state === 'chase' && dist2(p.x, p.z, P.x, P.z) < 6.25);
  const slow = P.inCar ? P.inCar.speed < 1.5 : Math.hypot(P.vx, P.vz) < 2;
  Game.bustT = near && slow ? Game.bustT + dt : Math.max(0, Game.bustT - dt * 2);
  if (Game.bustT > (P.inCar ? 3 : Game.wanted >= 3 ? 4 : 1.8)) playerDied('busted');
}

// ===== Kamera =====
function updateCamera(dt) {
  const P = Player, sens = 0.0024 * Settings.v.sens, c = P.inCar;
  const moved = Input.mdx !== 0 || Input.mdy !== 0 || kd('KeyQ') || kd('KeyE');
  Game.camYaw -= Input.mdx * sens;
  Game.camPitch = clamp(Game.camPitch + Input.mdy * sens * (Settings.v.invertY ? -1 : 1), -0.45, 1.15);
  if (kd('KeyQ')) Game.camYaw += 2.2 * dt;
  if (kd('KeyE')) Game.camYaw -= 2.2 * dt;
  Game.mouseIdle = moved ? 0 : Game.mouseIdle + dt;
  let px, py, pz, dist, fov;
  if (c) {
    if (Game.mouseIdle > 1.2) {
      Game.camYaw += wrapAng(c.h - Game.camYaw) * Math.min(1, dt * 2.5);
      Game.camPitch = lerp(Game.camPitch, 0.2, Math.min(1, dt * 2));
    }
    px = c.x; py = c.y + 1.7; pz = c.z;
    dist = 6.5 + c.T.l * 0.4 + c.speed * 0.05;
    fov = Settings.v.fov + clamp(c.speed - 15, 0, 30) * 0.45 + (c.boost ? 8 : 0);
  } else {
    const aiming = !WEAPONS[P.weapon].melee && (Input.mouseR || P.aimT > 0);
    const rx = -Math.cos(Game.camYaw), rz = Math.sin(Game.camYaw);
    px = P.x + rx * 0.6; py = P.y + 1.6; pz = P.z + rz * 0.6;
    dist = aiming ? 2.5 : 4.3;
    fov = aiming ? Settings.v.fov - 10 : Settings.v.fov;
  }
  Game.camDist = lerp(Game.camDist || dist, dist, Math.min(1, dt * 8));
  camera.near = 0.1;
  camera.fov = lerp(camera.fov, fov, Math.min(1, dt * 4));
  camera.updateProjectionMatrix();
  const cp = Math.cos(Game.camPitch), dx = Math.sin(Game.camYaw) * cp, dy = -Math.sin(Game.camPitch), dz = Math.cos(Game.camYaw) * cp;
  // Kamera devor ichiga kirib qolmasin
  const hit = rayBuildings(px, py, pz, -dx, -dy, -dz, Game.camDist, true);
  const d = Math.max(0.6, Math.min(Game.camDist, hit - 0.35));
  let cx = px - dx * d, cy = py - dy * d, cz = pz - dz * d;
  cy = Math.max(cy, groundH(cx, cz) + 0.3);
  if (Game.shake > 0) {
    const s = Game.shake * 0.4;
    cx += rand(-s, s); cy += rand(-s, s); cz += rand(-s, s);
    Game.shake = Math.max(0, Game.shake - dt * 1.5);
  }
  camera.position.set(cx, cy, cz);
  camera.lookAt(px + dx * 10, py + dy * 10, pz + dz * 10);
}

// Uzatmalar: tezlik oshganda aylanish ko'tariladi, keyingi uzatmaga o'tganda pasayadi
const GEARS = [0, 0.16, 0.33, 0.52, 0.74, 1.01];
function updateAudio(dt) {
  const P = Player, c = P.inCar;
  if (c && !c.dead && !P.dead) {
    const ratio = clamp(Math.abs(c.fwd) / c.T.max, 0, 1);
    let g = 0;
    while (g < 4 && ratio >= GEARS[g + 1]) g++;
    let rpm = 0.18 + 0.82 * (ratio - GEARS[g]) / (GEARS[g + 1] - GEARS[g]);
    if (Math.abs(c.fwd) < 1.5) rpm = c.thr ? 0.6 : 0.1;
    Game.rpm = lerp(Game.rpm || 0.1, rpm, 1 - Math.exp(-dt * 9));
    SFX.setEngine(true, Game.rpm, Math.abs(c.thr), engineProfile(c));
  } else SFX.setEngine(false);
  // Yaqinda o'tayotgan boshqa mashina dvigateli
  let best = null, bd = 32;
  for (const k of Game.cars) {
    if (k === c || !k.driver || k.dead) continue;
    const d = Math.hypot(k.x - P.x, k.z - P.z);
    if (d < bd) { bd = d; best = k; }
  }
  if (best) SFX.setTraffic(clamp(1 - bd / 32, 0, 1) * clamp(0.35 + best.speed / 18, 0, 1), clamp(best.speed / best.T.max, 0, 1), engineProfile(best));
  else SFX.setTraffic(0);
  // Eng yaqin sirena ovozi: uzoqdan "wail", yaqinda "yelp"; o'z mashinangizda — to'liq ovoz
  let sv = 0, near = Infinity;
  for (const k of Game.cars) {
    if (!k.siren || k.dead || (k.driver !== 'police' && k !== c)) continue;
    const d = k === c ? 0 : Math.hypot(k.x - P.x, k.z - P.z);
    near = Math.min(near, d);
    sv = Math.max(sv, k === c ? 0.75 : clamp(1 - d / 170, 0, 1));
  }
  SFX.setSiren(sv, Game.time, near > 0 && near < 35 && Game.wanted > 0 ? 'yelp' : 'wail');
  Radio.update(!!c && !c.dead && !P.dead);
}
function updateHeadlight() {
  const c = Player.inCar, night = 1 - World.daylight;
  if (!c || c.dead || night < 0.3) { headlight.intensity = 0; return; }
  const fx = Math.sin(c.h), fz = Math.cos(c.h);
  headlight.position.set(c.x + fx * 2.3, c.y + 1, c.z + fz * 2.3);
  headlight.target.position.set(c.x + fx * 25, c.y, c.z + fz * 25);
  headlight.intensity = 2.2 * night;
}
function prompts() {
  const P = Player;
  if (P.dead) return HUD.prompt(null);
  if (Game.bustT > 0.3) return HUD.prompt('Politsiya seni ushlamoqda — qoch!');
  if (!P.inCar) {
    const c = nearestCar(4.2);
    if (c && !Input.touch) return HUD.prompt(`<kbd>F</kbd> ${c.driver ? 'haydovchini tushirish' : c.T.kind === 'moto' ? 'mototsiklga minish' : 'mashinaga o\'tirish'}`);
  }
  HUD.prompt(null);
}
const PICKUP_COL = { cash: '#79d46a', health: '#ef4b46', armor: '#4fa6e0', ammo: '#ffb238' };
function radarBlips() {
  const out = [], P = Player;
  for (const p of Pickups.list) if (!p.hidden && p.respawn && dist2(p.x, p.z, P.x, P.z) < 22500) out.push({ x: p.x, z: p.z, color: PICKUP_COL[p.kind], size: 3.5, shape: 'sq' });
  for (const c of Game.cars) if (c.driver === 'police' && dist2(c.x, c.z, P.x, P.z) < 40000)
    out.push({ x: c.x, z: c.z, color: Game.wanted && Math.floor(Game.time * 4) % 2 ? '#ef4b46' : '#3d7bff', size: 5.5 });
  if (MapUI.wp) out.push({ x: MapUI.wp.x, z: MapUI.wp.z, color: '#b36bff', size: 7, edge: true, label: '★' });
  return out.concat(Landmarks.blips(P.x, P.z), Shops.blips(), Garage.blips(), Missions.blips(), Taxi.blips(), MP.blips());
}

// ===== Ishga tushirish =====
function boot(data) {
  try { init(data || {}); }
  catch (e) { document.getElementById('loading').textContent = 'Xatolik: ' + e.message; console.error(e); }
}
if (typeof THREE === 'undefined') {
  document.getElementById('loading').textContent = 'Three.js yuklanmadi. lib/three.min.js fayli o\'yin papkasida borligini tekshiring.';
} else {
  setTimeout(() => {
    const hot = window.claude && window.claude.hot;
    if (hot && hot.ready) hot.ready(boot); else boot((hot && hot.data) || {});
  }, 30);
}
