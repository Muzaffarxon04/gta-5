'use strict';
// ===== Ko'cha harakati "aqli": haydovchi fe'li, yo'lak almashtirish va quvib o'tish, chorrahada yo'l berish,
// yon tomondan kelayotganni ko'rish, yo'l chetiga kelib to'xtash va u yerdan chiqib ketish.
// Asosiy haydash (yo'l bo'ylab nishon nuqtasi, rul, gaz) — vehicles.js: aiFollowRoad, steerTo.
// Yo'laklar (yo'l o'rtasidan o'ngga, metr): 2.5 — chap (tezroq), 5.5 — o'ng, 7.9 — yo'l cheti (to'xtab turish).
const LANE_L = 2.5, LANE_R = 5.5, LANE_P = 7.9;
// k — tezlik, gap — oldingi mashinagacha masofa, over — quvib o'tishga moyillik, keepR — o'ng yo'lakka qaytish,
// yellow — sariqda o'tib ketadigan masofa (m), honk — signal chalishdan oldin sabr (s), patience — yo'l berib kutish (s)
const DRIVER_KINDS = {
  calm:   { k: 0.85, gap: 1.4,  over: 0.25, keepR: 1,    yellow: 2,  honk: 7,   patience: 14 },
  normal: { k: 1,    gap: 1,    over: 0.7,  keepR: 0.6,  yellow: 7,  honk: 3.5, patience: 9 },
  fast:   { k: 1.22, gap: 0.7,  over: 1.6,  keepR: 0.15, yellow: 11, honk: 1.8, patience: 5 },
};
function driverKind(c) {
  if (c.type === 'bus' || c.type === 'damas') return Math.random() < 0.8 ? 'calm' : 'normal';
  const r = Math.random(), sporty = ['moto', 'gls', 'charger', 'malibu', 'taxi'].includes(c.type);
  return sporty ? (r < 0.45 ? 'fast' : r < 0.9 ? 'normal' : 'calm') : (r < 0.28 ? 'calm' : r < 0.82 ? 'normal' : 'fast');
}
const drvOf = c => DRIVER_KINDS[c.drv || (c.drv = driverKind(c))];

// Joriy yo'l bo'lagi: boshlanish chorrahasi (ax, az), yo'nalish (dx, dz), boshidan bosib o'tilgan masofa s
function segFrame(car) {
  const a = car.ai, ax = roadPos(a.fi), az = roadPos(a.fj), dx = Math.sign(roadPos(a.ti) - ax), dz = Math.sign(roadPos(a.tj) - az);
  return { ax, az, dx, dz, s: (car.x - ax) * dx + (car.z - az) * dz };
}
// Keyingi chorrahada: +1 o'ngga, −1 chapga, 0 to'g'riga
function turnSign(a) {
  const dx = Math.sign(a.ti - a.fi), dz = Math.sign(a.tj - a.fj), nx = Math.sign(a.ni - a.ti), nz = Math.sign(a.nj - a.tj);
  return nx * -dz + nz * dx;
}
// Yo'lak bo'shmi: orqada `back`, oldinda `front` metr ichida hech kim yo'q va orqadan tez yetib kelayotgan yo'q
function laneClear(car, F, lane, back, front) {
  for (const o of Game.cars) {
    if (o === car) continue;
    const ox = o.x - F.ax, oz = o.z - F.az, u = ox * F.dx + oz * F.dz - F.s, v = -ox * F.dz + oz * F.dx;
    if (Math.abs(v - lane) > (car.T.w + o.T.w) / 2 + 0.3 || u > front || u < -back * 3) continue;
    if (u >= -back) return false;
    const ou = o.vx * F.dx + o.vz * F.dz;
    if (ou > car.fwd + 2 && -u < (ou - car.fwd) * 3 + back) return false;
  }
  return true;
}
// Yo'lakka silliq o'tish: yon tomonga tezlik bilan bog'liq (to'xtab turgan mashina sekinroq chiqadi)
const laneRate = car => clamp(0.3 * car.speed + 0.6, 0.8, 2);
function stepLane(car, dt) {
  const a = car.ai;
  if (a.laneT == null) a.laneT = a.lane;
  if (a.lane === a.laneT) return;
  const st = laneRate(car) * dt;
  a.lane = Math.abs(a.laneT - a.lane) <= st ? a.laneT : a.lane + Math.sign(a.laneT - a.lane) * st;
}
// Qaysi yo'lakka o'tish: burilishdan oldin to'g'ri yo'lakka, sekin mashinani quvib o'tish, keyin o'ngga qaytish.
// stalled — oldinda yo'lda turib qolgan mashina (buzilgan, bekatdagi avtobus): har qanday haydovchi aylanib o'tadi
function laneLogic(car, dt, F, D, slowLead, stalled) {
  const a = car.ai;
  a.lcT = (a.lcT || 0) - dt;
  if ((car.type === 'bus' && !stalled) || car.park || a.lane !== a.laneT || a.lcT > 0) return;
  const toNode = CITY.CELL - F.s, sgn = turnSign(a);
  if (toNode < 16) return; // chorrahaga juda yaqin — yo'lak almashtirilmaydi
  let want = null;
  if (stalled && toNode > 20) want = a.lane > 4 ? LANE_L : LANE_R;
  else if (toNode < 55 && sgn !== 0) want = sgn > 0 ? LANE_R : LANE_L;
  else if (slowLead && a.lane > 4 && toNode > 32 && Math.random() < D.over * dt * 3) want = LANE_L;
  else if (a.lane < 4 && toNode > 28 && !slowLead && Math.random() < D.keepR * dt * 0.4) want = LANE_R;
  if (want == null || Math.abs(want - a.lane) < 0.5) return;
  if (laneClear(car, F, want, 8, 15)) { a.laneT = want; a.lcT = 3; }
  else a.lcT = 0.6;
}
// Yo'lak almashtirayotganda yoki to'xtash joyiga burilayotganda burilish chirog'i
function laneSignal(car) {
  const a = car.ai;
  if (car.signal === 2 || !a) return;
  if (car.park) car.signal = 1;
  else if (Math.abs(a.laneT - a.lane) > 0.15) car.signal = a.laneT > a.lane ? 1 : -1;
}

// Chorrahada yo'l berish:
// • svetoforsiz chorrahada (shahar chetidagi) ikkinchi darajali yo'ldan chiquvchi — asosiy yo'ldagilarga;
// • chapga buriluvchi — qarshidan to'g'riga yoki o'ngga ketayotganga (yashil chiroqda ham)
function yieldCruise(car, cruise, F, D, dt) {
  const a = car.ai, toNode = CITY.CELL - F.s, stop = toNode - CITY.R / 2 - 3.2 - car.T.l / 2;
  if (stop > 26 || stop < -7) { car.yieldT = 0; return cruise; }
  const sgn = turnSign(a), N = CITY.N;
  const lit = !!World.sigMap[a.ti * 100 + a.tj];
  const major = (a.fi === a.ti && (a.fi === 0 || a.fi === N)) || (a.fj === a.tj && (a.fj === 0 || a.fj === N));
  const minor = !lit && !major;
  if (!minor && sgn !== -1) { car.yieldT = 0; return cruise; }
  if ((car.yieldT || 0) > D.patience) return cruise; // juda uzoq kutdi — sekin o'tadi
  const nx = roadPos(a.ti), nz = roadPos(a.tj), dx = F.dx, dz = F.dz, box = CITY.R / 2 + 1;
  let conflict = false;
  for (const o of Game.cars) {
    if (o === car || o.dead) continue;
    const rx = o.x - nx, rz = o.z - nz;
    if (Math.abs(rx) > 34 || Math.abs(rz) > 34) continue;
    const u = rx * dx + rz * dz, v = -rx * dz + rz * dx;
    if (minor) {
      if (Math.abs(v) < box && u < -box) continue; // o'zimiz kelayotgan yo'l
      if (Math.abs(rx) < box && Math.abs(rz) < box && o.speed > 0.5) { conflict = true; break; }
      const d = Math.hypot(rx, rz) || 1, toward = -(o.vx * rx + o.vz * rz) / d;
      if (d < 30 && toward > 1.5) { conflict = true; break; }
    } else {
      // Qarshidan keluvchi: chorrahaning narigi yarmida
      if (v > -0.5 || u < -2 || u > 34) continue;
      if (o.ai && o.driver === 'traffic' && turnSign(o.ai) === -1 && o.ai.ti === a.ti && o.ai.tj === a.tj) {
        // U ham chapga buriladi: yo'llarimiz kesishadi — chorrahaga yaqinroq turgan birinchi o'tadi
        const mine = toNode, its = CITY.CELL - segFrame(o).s;
        if (its < mine - 0.5 || (Math.abs(its - mine) <= 0.5 && carUid(o) < carUid(car))) { conflict = true; break; }
        continue;
      }
      if (o.vx * dx + o.vz * dz > -1.5) continue; // bizga qarab kelmayapti
      conflict = true; break;
    }
  }
  if (!conflict) { car.yieldT = Math.max(0, (car.yieldT || 0) - dt); return cruise; }
  car.yieldT = (car.yieldT || 0) + dt; car.holding = true;
  if (stop > -0.5) return Math.min(cruise, Math.max(0, stop - 0.3) * 0.7);
  return 0; // chorrahaga kirib bo'lgan — joyida kutadi
}
// Nuqta chorraha ichidami
function inBox(x, z) {
  const h = CITY.R / 2, kx = Math.round((x - CITY.OFF) / CITY.CELL), kz = Math.round((z - CITY.OFF) / CITY.CELL);
  return Math.abs(x - roadPos(kx)) < h && Math.abs(z - roadPos(kz)) < h;
}
// Yon tomondan kelayotgan mashina bilan 1.6 soniyada to'qnashish xavfi bo'lsa — sekinlaydi.
// Chorraha ichidagiga (o'tib ketsin), o'ngdagiga, o'yinchiga va politsiyaga yo'l beradi — ikkalasi ham to'xtab qolmasin
function crossCruise(car, cruise, cars) {
  const fx = Math.sin(car.h), fz = Math.cos(car.h), meIn = inBox(car.x, car.z);
  for (const o of cars) {
    if (o === car || o.dead) continue;
    const rx = o.x - car.x, rz = o.z - car.z;
    if (rx * rx + rz * rz > 625) continue;
    if (Math.abs(Math.sin(o.h) * fx + Math.cos(o.h) * fz) > 0.8) continue; // bir yo'nalishda yoki qarama-qarshi — boshqa qoidalar
    const vx = o.vx - car.vx, vz = o.vz - car.vz, v2 = vx * vx + vz * vz;
    if (v2 < 1) continue;
    const t = -(rx * vx + rz * vz) / v2;
    if (t <= 0 || t > 1.6) continue;
    const mx = rx + vx * t, mz = rz + vz * t, w = 1.2 + (car.T.l + o.T.l) * 0.3;
    if (mx * mx + mz * mz > w * w || rx * fx + rz * fz < -2) continue;
    if ((!meIn && inBox(o.x, o.z)) || -rx * fz + rz * fx > 0 || o.driver === 'player' || o.driver === 'police' || o.siren) {
      car.holding = true;
      return Math.min(cruise, car.speed < 2 ? 0 : cruise * 0.3);
    }
  }
  return cruise;
}

// Chorrahada bir-birini to'sib qolish (A B ni kutadi, B esa A ni — yoki uch-to'rt mashina doira bo'lib):
// doiradagi eng "kichik" raqamli mashina sekin yo'lida davom etadi, qolganlari uni kutadi
let _carUid = 0;
const carUid = c => c.uid || (c.uid = ++_carUid);
function gridlockFree(car) {
  if (car.glT > 0) return true;
  const ring = [car];
  for (let x = car.leadObj, k = 0; x && k < 5; x = x.leadObj, k++) {
    if (x === car) { if (ring.every(o => carUid(car) <= carUid(o))) { car.glT = 2.5; return true; } return false; }
    if (ring.includes(x)) return false;
    ring.push(x);
  }
  return false;
}

// ----- Yo'l chetida to'xtash va chiqib ketish -----
// Avtobus bekati oldida to'xtab turish mumkin emas
function parkSpotOk(sp) {
  if (!sp) return false;
  const st = World.busStops[sp.fi + ',' + sp.fj + ',' + sp.ti + ',' + sp.tj];
  return !st || Math.abs(st.s - sp.s) > 14;
}
// Harakatdagi mashina oldinda bo'sh joy topadi (bekat va chorrahadan uzoqda)
function tryPark(c) {
  const a = c.ai;
  if (!a || c.park || c.panic > 0 || c.type === 'bus' || c.role === 'police' || Math.abs(a.lane - LANE_R) > 0.3 || (a.laneT != null && a.laneT !== a.lane)) return false;
  const F = segFrame(c), s = F.s + rand(28, 45);
  if (s < 14 || s > CITY.CELL - 16) return false;
  const st = World.busStops[a.fi + ',' + a.fj + ',' + a.ti + ',' + a.tj];
  if (st && Math.abs(st.s - s) < 14) return false;
  const x = F.ax + F.dx * s - F.dz * LANE_P, z = F.az + F.dz * s + F.dx * LANE_P;
  if (Game.cars.some(o => o !== c && dist2(o.x, o.z, x, z) < 49)) return false;
  c.park = { s, fi: a.fi, fj: a.fj, ti: a.ti, tj: a.tj };
  return true;
}
function parkCruise(car, cruise, F, obst) {
  const P = car.park, a = car.ai, rem = P.s - F.s;
  const abort = () => { car.park = null; a.laneT = LANE_R; a.lcT = 2; return cruise; };
  if (P.fi !== a.fi || P.fj !== a.fj || P.ti !== a.ti || P.tj !== a.tj || rem < -3) return abort();
  if (rem < 24) a.laneT = LANE_P;
  if (obst < 9 && rem > 2 && Math.abs(a.lane - LANE_P) < 0.8) return abort(); // joyni boshqasi egallabdi
  // Yo'l chetiga to'liq yetib kelgandagina to'xtaydi (aks holda yo'lakni, ayniqsa avtobusni to'sib qo'yardi)
  const lat = -(car.x - F.ax) * F.dz + (car.z - F.az) * F.dx;
  if (rem < 0.8 && lat > LANE_P - 0.25) { finishPark(car); return 0; }
  return Math.min(cruise, Math.max(0.8, rem * 0.45));
}
// To'xtadi: haydovchi tushib, yo'lakdan ketadi; mashina keyinroq yana chiqib ketishi mumkin
function finishPark(c) {
  const a = c.ai;
  c.spot = { fi: a.fi, fj: a.fj, ti: a.ti, tj: a.tj, lane: LANE_P };
  c.park = null; c.ai = null; c.driver = null; c.signal = 0; c.thr = 0; c.steer = 0;
  const px = c.x + rightX(c.h) * 3.4, pz = c.z + rightZ(c.h) * 3.4, b = blockAt(px, pz) || nearestBlock(px, pz);
  const p = new Ped(b, ringT(b, px, pz), c.driverOutfit || null);
  Game.peds.push(p);
  c.setDriverModel(null);
}
// Yo'l chetidagi mashinaga haydovchi o'tiradi, chap chiroq yoqib, bo'sh bo'lganda yo'lga chiqadi
function startLeaving(c) {
  const sp = c.spot;
  setRoute(c, sp.fi, sp.fj, sp.ti, sp.tj, LANE_P, null);
  c.ai.laneT = LANE_P; c.driver = 'traffic'; c.leaveT = rand(1.5, 2.8); c.spot = null;
  c.setDriverModel(driverOutfit(c));
}
function leaveWait(car, dt) {
  car.thr = 0; car.steer = 0; car.signal = -1;
  car.leaveT -= dt;
  if (car.leaveT > 0) return;
  if (laneClear(car, segFrame(car), LANE_R, 24, 8)) { car.ai.laneT = LANE_R; car.ai.lcT = 3; car.leaveT = 0; return; }
  car.leaveT = 0.5;
  // Yo'l bo'shamayapti — chiqishdan voz kechadi (mashina yana yo'l chetida qoladi)
  if ((car.leaveTries = (car.leaveTries || 0) + 1) > 30) {
    const a = car.ai;
    car.spot = { fi: a.fi, fj: a.fj, ti: a.ti, tj: a.tj, lane: LANE_P };
    car.leaveT = 0; car.leaveTries = 0; car.driver = null; car.ai = null; car.signal = 0;
    car.setDriverModel(null);
  }
}
// Har ehtimolga qarshi: uzoq qimirlamay qolsa (svetofor yoki navbat emas) — avval orqaga yuradi,
// baribir bo'lmasa va o'yinchi uzoqda bo'lsa — yo'qoladi (yangi mashina boshqa joyda paydo bo'ladi)
function stuckGuard(car, dt) {
  if (car.speed < 0.3 && !car.holding && !(car.leadObj && car.leadObj.holding)) { car.stillT = (car.stillT || 0) + dt; car.stuckSum = (car.stuckSum || 0) + dt; }
  else { car.stillT = 0; if (car.speed > 2) car.stuckSum = Math.max(0, (car.stuckSum || 0) - dt); }
  if (car.stillT > 15 && car.revT <= 0) { car.revT = 1.5; car.stillT = 5; }
}
// manageSpawns har 0.4 soniyada chaqiradi: o'yinchi atrofida goh birov to'xtaydi, goh chiqib ketadi
function trafficEvents(px, pz) {
  for (let i = Game.cars.length - 1; i >= 0; i--) {
    const c = Game.cars[i];
    if (c.driver === 'traffic' && !c.persist && (c.stuckSum || 0) > 45 && dist2(c.x, c.z, px, pz) > 3600) { c.remove(); Game.cars.splice(i, 1); }
  }
  if (Math.random() < 0.05) {
    const list = Game.cars.filter(c => c.spot && !c.driver && !c.dead && !c.persist && !c.mine && !c.onFire && dist2(c.x, c.z, px, pz) > 625 && dist2(c.x, c.z, px, pz) < 25600);
    if (list.length > 2) startLeaving(pick(list));
  }
  if (Math.random() < 0.08) {
    const list = Game.cars.filter(c => c.driver === 'traffic' && c.ai && !c.park && c.type !== 'bus' && dist2(c.x, c.z, px, pz) > 900 && dist2(c.x, c.z, px, pz) < 19600);
    if (list.length > 5) tryPark(pick(list));
  }
}
