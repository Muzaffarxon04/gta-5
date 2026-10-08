'use strict';
// ===== Mashinalar: model, fizika, sun'iy intellekt =====
const _steerQ = new THREE.Quaternion(), _Z_AXIS = new THREE.Vector3(0, 0, 1);
// Rulning tinch holatdagi yo'nalishi (har nusxa uchun bir marta)
const steerQ0 = pv => pv._q0 || (pv._q0 = new THREE.Quaternion().fromArray(pv.userData.q0));
class Car {
  constructor(type, x, z, h, role, color) {
    const T = CAR_TYPES[type];
    this.type = type; this.T = T; this.role = role;
    this.color = color != null ? color : type === 'police' ? 0xf3f3f3 : type === 'taxi' ? 0xf2c200 : pick(T.palette || CAR_COLORS);
    this.mesh = new THREE.Group(); this.mesh.rotation.order = 'YXZ';
    this.makeBody();
    this.driverHM = null; this.driverOutfit = null;
    this.x = x; this.z = z; this.y = groundH(x, z); this.h = h; this.vx = 0; this.vz = 0;
    this.hp = T.hp; this.maxHp = T.hp; this.mods = null; this.boost = false; this.driver = role === 'parked' ? null : role;
    this.thr = 0; this.steer = 0; this.hand = false; this.drift = 0;
    this.onFire = false; this.burnT = 0; this.dead = false;
    this.ai = null; this.stuckT = 0; this.revT = 0; this.panic = 0; this.waitT = 0; this.shootT = rand(0.5, 2);
    World.scene.add(this.mesh); this.sync(0);
    this.setPlate();
  }
  // Kuzov: tashqi 3D model (yuklangan bo'lsa) yoki kod bilan yasalgan shakl.
  // Model keyinroq (orqa fonda) yuklansa, upgradeBody() shu funksiya bilan kuzovni almashtiradi.
  makeBody() {
    const T = this.T, type = this.type, M = T.model && MODELS[T.model];
    this.bodyModel = M ? T.model : null;
    if (M) {
      // Tashqi 3D model: geometriya umumiy, faqat bo'yoq rangi har mashinada o'zgacha
      this.body = M.scene.clone(true);
      this.body.traverse(o => { if (o.isMesh && o.userData.paint) o.material = paintMat(this.color); });
      if (type === 'taxi' && T.roof) this.body.add(new THREE.Mesh(taxiSignGeo(T), CAR_MAT));
      this.steerPivot = this.body.getObjectByName('steerPivot') || null;
      this.doorBox = M.doorBox || null;
      this.lights = new THREE.Object3D();
    } else {
      const g = codeType(type);
      this.body = new THREE.Mesh(carGeo(g, this.color), CAR_MAT); this.body.castShadow = true;
      this.lights = new THREE.Mesh(lightGeo(g), LIGHT_MAT);
      this.steerPivot = null; this.doorBox = null;
      const gg = glassGeo(g);
      if (gg) { this.glass = new THREE.Mesh(gg, GLASS_MAT); this.mesh.add(this.glass); }
    }
    this.mesh.add(this.body, this.lights);
    if (type === 'police') {
      const B = M && M.bar, g = B ? new THREE.BoxGeometry(B.w, B.h, B.d) : new THREE.BoxGeometry(0.4, 0.12, 0.2);
      if (this.bar) this.mesh.remove(...this.bar);
      this.bar = [new THREE.Mesh(g, BAR_RED), new THREE.Mesh(g, BAR_BLUE)];
      if (B) { this.bar[0].position.set(-B.x, B.y, B.z); this.bar[1].position.set(B.x, B.y, B.z); }
      else { this.bar[0].position.set(0.24, T.H + 0.12, T.roofZ); this.bar[1].position.set(-0.24, T.H + 0.12, T.roofZ); }
      this.mesh.add(...this.bar);
    }
  }
  // Model endi yuklandi: kod bilan yasalgan (yoki boshqa modeldagi) kuzov o'rniga haqiqiy model
  upgradeBody() {
    const T = this.T;
    if (this.dead || !T.model || !MODELS[T.model] || this.bodyModel === T.model) return;
    if (Cockpit.car === this) Cockpit.detach();
    if (this.doorFx) clearDoor(this);
    this.disposePlate();
    if (this.dented) this.body.traverse(o => { if (o.isMesh && o.userData.ownGeo) o.geometry.dispose(); });
    this.mesh.remove(this.body, this.lights);
    if (this.glass) { this.mesh.remove(this.glass); this.glass = null; }
    this.dented = false;
    this.makeBody();
    this.setPlate(this.plate);
    // Politsiya modeli kelganda o'rindiq joyi ham o'zgaradi
    const S = T.seat, moto = T.kind === 'moto';
    if (this.driverHM) this.driverHM.g.position.set(S.x, S.y - 0.95 * this.driverHM.mesh.scale.y, S.z);
    if (this.passHM) this.passHM.g.position.set(moto ? 0 : -S.x, (moto ? S.y + 0.05 : S.y) - 0.95 * this.passHM.mesh.scale.y, moto ? S.z - 0.55 : S.z);
  }
  get speed() { return Math.hypot(this.vx, this.vz); }
  get fwd() { return this.vx * Math.sin(this.h) + this.vz * Math.cos(this.h); }

  physics(dt) {
    const T = this.T;
    let fx = Math.sin(this.h), fz = Math.cos(this.h), rx = -fz, rz = fx;
    let vF = this.vx * fx + this.vz * fz, vR = this.vx * rx + this.vz * rz;
    const thr = this.dead || this.onFire && this.driver !== 'player' ? 0 : this.thr;
    // Tyuning (dvigatel, shinalar) va nitro
    const md = this.mods, bo = this.boost;
    const maxS = T.max * (md ? 1 + 0.12 * md.eng : 1) * (bo ? 1.3 : 1) * (this.hp < 30 ? 0.6 : 1);
    // Ob-havo: ho'l yoki qorli yo'lda tezlanish va tormoz sustroq
    const wg = Weather.grip * (md ? 1 + 0.12 * md.grip : 1), brake = 30 * (0.5 + 0.5 * Weather.grip);
    const acc = T.acc * (md ? 1 + 0.18 * md.eng : 1) * (bo ? 2.2 : 1) * (0.7 + 0.3 * Weather.grip);
    // Uzatmalar qutisi (js/gearbox.js): uzatmaga va dvigatel aylanishiga qarab tortish kuchi
    const drive = gearDrive(this, vF, maxS, Math.max(0, thr), dt);
    if (this.pedals) {
      // O'yinchi: gaz faqat gaz, tormoz faqat tormoz; yo'nalishni selektor belgilaydi (D — oldinga, R — orqaga)
      const sel = gearState(this).sel, brk = this.dead ? 0 : this.brk || 0;
      if (thr > 0 && sel === 'D' && vF < maxS) vF += acc * thr * dt * drive;
      if (thr > 0 && sel === 'R' && vF > -REV_MAX) vF -= acc * 0.7 * thr * dt * drive;
      if (brk > 0) vF -= Math.sign(vF) * Math.min(Math.abs(vF), brake * brk * dt);
    } else {
      if (thr > 0) { if (vF < -0.5) vF += brake * thr * dt; else if (vF < maxS) vF += acc * thr * dt * drive; }
      else if (thr < 0) { if (vF > 0.5) vF += brake * thr * dt; else if (vF > -REV_MAX) vF += acc * 0.7 * thr * dt; }
    }
    vF -= vF * (thr === 0 ? 0.55 : 0.1) * dt;
    // Qiyalik (estakada): mashina pastga sirpanadi, qo'l tormozi ushlab turadi
    const gF = groundH(this.x + fx, this.z + fz), gB = groundH(this.x - fx, this.z - fz), slope = (gF - gB) / 2;
    this.pitch = Math.abs(slope) < 0.4 ? Math.atan(slope) : 0;
    if (this.pitch) vF -= 9.8 * slope * dt;
    // Qo'l tormozi, haydovchisiz mashina va "P" (park) holati — mashina ushlab turiladi
    const park = this.pedals && gearState(this).sel === 'P';
    if (this.hand || !this.driver || this.dead || park) vF -= Math.sign(vF) * Math.min(Math.abs(vF), (this.hand || park ? 10 : 7) * dt);
    this.vx = fx * vF + rx * vR; this.vz = fz * vF + rz * vR;
    // Rul: tezlikka qarab burilish
    const sp = Math.abs(vF), sf = clamp(sp / 5, 0, 1) * (1 - clamp(sp / (T.max * 1.6), 0, 0.55));
    this.h += this.steer * 1.9 * sf * (vF < 0 ? -1 : 1) * dt * (this.hand ? 1.4 : 1);
    // Yon sirpanish (drift) — qo'l tormozi ushlashni kamaytiradi
    fx = Math.sin(this.h); fz = Math.cos(this.h); rx = -fz; rz = fx;
    vF = this.vx * fx + this.vz * fz; vR = this.vx * rx + this.vz * rz;
    vR *= Math.exp(-(this.hand ? 1.3 : T.grip * wg) * dt);
    this.drift = Math.abs(vR);
    this.vx = fx * vF + rx * vR; this.vz = fz * vF + rz * vR;
    this.x += this.vx * dt; this.z += this.vz * dt;
    this.collideWorld();
    this.y = lerp(this.y, groundH(this.x, this.z), 1 - Math.exp(-12 * dt));
  }
  collideWorld() {
    const fx = Math.sin(this.h), fz = Math.cos(this.h), r = this.T.w / 2 + 0.05;
    for (const s of carCircles(this.T)) {
      const o = { x: this.x + fx * s, z: this.z + fz * s };
      const hit = pushOut(o, r, this.y + 0.5);
      if (!hit) continue;
      this.x = o.x - fx * s; this.z = o.z - fz * s;
      const vn = this.vx * hit.nx + this.vz * hit.nz;
      if (vn < 0) {
        this.vx -= vn * hit.nx * 1.3; this.vz -= vn * hit.nz * 1.3;
        this.vx *= 0.85; this.vz *= 0.85;
        if (-vn > 6) { this.damage((-vn - 6) * 1.7); this.dent(o.x - hit.nx * r, o.z - hit.nz * r, hit.nx, hit.nz, -vn); onCarImpact(this, -vn); }
      }
    }
  }
  damage(d) {
    if (this.dead || d <= 0 || this.driver === 'remote') return;
    this.hp -= d;
    if (this.hp <= 0 && !this.onFire) { this.hp = 0; this.onFire = true; this.burnT = rand(3.5, 5.5); }
  }
  sync(dt, time = 0) {
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.y = this.h;
    // Mototsikl burilishda yonboshga egiladi, to'xtab turganda tirgakka suyanadi
    const lean = this.T.kind === 'moto'
      ? (this.driver ? -this.steer * clamp(this.speed / 14, 0, 1) * 0.45 : 0.14)
      : -this.steer * clamp(this.speed / 30, 0, 1) * 0.05;
    this.mesh.rotation.z = lerp(this.mesh.rotation.z, lean, 0.1);
    this.mesh.rotation.x = lerp(this.mesh.rotation.x, -(this.pitch || 0), 0.2); // qiyalikda old tomoni ko'tariladi
    if (this.driverHM) this.driverHM.b.head.rotation.y = this.steer * 0.35;
    // Rul aylanadi, haydovchining qo'llari unga ergashadi (yaqindagi mashinalarda)
    const pv = this.steerPivot;
    if (pv) {
      pv.quaternion.copy(steerQ0(pv)).multiply(_steerQ.setFromAxisAngle(_Z_AXIS, this.steer * STEER_TURN));
      if (this.driverHM && (this.driver === 'player' || this.body.getCurrentLevel() === 0)) holdWheel(this.driverHM, this);
    } else if (this.T.grips && this.driverHM && this.body.isLOD && (this.driver === 'player' || this.body.getCurrentLevel() === 0)) holdGrips(this.driverHM, this);
    if (this.bar) {
      const on = !this.dead && this.siren;
      const f = Math.floor(time * 6) % 2;
      this.bar[0].visible = on ? f === 0 : true; this.bar[1].visible = on ? f === 1 : true;
    }
  }
  wreck() {
    if (this.doorFx) clearDoor(this);
    this.dead = true; this.onFire = false; this.driver = null;
    this.body.traverse(o => { if (o.isMesh) { if (o.userData.glass) o.visible = false; else o.material = WRECK_MAT; } });
    this.lights.visible = false;
    if (this.glass) this.glass.visible = false;
    if (this.bar) this.bar.forEach(b => (b.visible = false));
    if (this.driverHM && !this.driverHM.keep) this.setDriverModel(null);
  }
  // Ichida o'tirgan odam modeli (AI haydovchi)
  setDriverModel(outfit) {
    if (this.driverHM) {
      this.mesh.remove(this.driverHM.g);
      if (!this.driverHM.keep) this.driverHM.mesh.geometry.dispose();
      this.driverHM = null;
    }
    this.driverOutfit = outfit;
    if (outfit) this.seatHuman(makeHuman(outfit), false);
  }
  seatHuman(hm, keep) {
    const S = this.T.seat;
    hm.keep = keep;
    hm.g.position.set(S.x, S.y - 0.95 * hm.mesh.scale.y, S.z);
    hm.g.rotation.set(0, 0, 0);
    this.mesh.add(hm.g);
    this.driverHM = hm;
    if (this.T.kind === 'moto') poseRider(hm); else poseSeated(hm);
  }
  // Yo'lovchi o'rindig'i (o'ng tomon; mototsiklda — orqada)
  seatPassenger(hm) {
    const S = this.T.seat, moto = this.T.kind === 'moto';
    hm.g.position.set(moto ? 0 : -S.x, (moto ? S.y + 0.05 : S.y) - 0.95 * hm.mesh.scale.y, moto ? S.z - 0.55 : S.z);
    hm.g.rotation.set(0, 0, 0);
    this.mesh.add(hm.g); this.passHM = hm;
    if (moto) poseRider(hm); else poseSeated(hm);
  }
  unseatPassenger() {
    const hm = this.passHM;
    if (hm) this.mesh.remove(hm.g);
    this.passHM = null;
    return hm;
  }
  unseat() {
    const hm = this.driverHM;
    if (hm) this.mesh.remove(hm.g);
    this.driverHM = null;
    return hm;
  }
  remove() {
    if (this.doorFx) clearDoor(this);
    if (this.driverHM && !this.driverHM.keep) this.driverHM.mesh.geometry.dispose();
    this.disposePlate();
    if (this.dented) this.body.traverse(o => { if (o.isMesh && o.userData.ownGeo) o.geometry.dispose(); });
    World.scene.remove(this.mesh);
  }
}

// To'qnashuv doiralari mashina uzunligi bo'ylab (avtobusda ko'proq)
function carCircles(T) {
  if (!T.circ) {
    const n = Math.max(3, Math.ceil(T.l / (T.w * 0.95))), off = T.l / 2 - T.w / 2;
    T.circ = Array.from({ length: n }, (_, k) => -off + (2 * off * k) / (n - 1));
  }
  return T.circ;
}
// Mashina koordinatalariga o'tkazish: f — oldinga, r — o'ngga
function carLocal(car, x, z) {
  const dx = x - car.x, dz = z - car.z, fx = Math.sin(car.h), fz = Math.cos(car.h);
  return { f: dx * fx + dz * fz, r: -dx * fz + dz * fx };
}
function rayCar(car, ox, oy, oz, dx, dy, dz, maxT) {
  const fx = Math.sin(car.h), fz = Math.cos(car.h), px = ox - car.x, pz = oz - car.z, T = car.T;
  return rayBox(-px * fz + pz * fx, oy - car.y, px * fx + pz * fz, -dx * fz + dz * fx, dy, dx * fx + dz * fz,
    -T.w / 2, 0.1, -T.l / 2, T.w / 2, T.H, T.l / 2, maxT);
}

// Mashinalar o'zaro to'qnashuvi
function collideCars(cars) {
  for (let i = 0; i < cars.length; i++) {
    const A = cars[i];
    for (let k = i + 1; k < cars.length; k++) {
      const B = cars[k];
      const reach = (A.T.l + B.T.l) / 2 + 1;
      if (dist2(A.x, A.z, B.x, B.z) > reach * reach) continue;
      const ra = A.T.w / 2, rb = B.T.w / 2;
      let done = false;
      for (const sa of carCircles(A.T)) {
        for (const sb of carCircles(B.T)) {
          const ax = A.x + Math.sin(A.h) * sa, az = A.z + Math.cos(A.h) * sa, bx = B.x + Math.sin(B.h) * sb, bz = B.z + Math.cos(B.h) * sb;
          const dx = bx - ax, dz = bz - az, d = Math.hypot(dx, dz), minD = ra + rb;
          if (d >= minD || d < 1e-4) continue;
          const nx = dx / d, nz = dz / d, pen = minD - d, ma = A.T.mass, mb = B.T.mass, tot = ma + mb;
          A.x -= nx * pen * mb / tot; A.z -= nz * pen * mb / tot; B.x += nx * pen * ma / tot; B.z += nz * pen * ma / tot;
          const rv = (B.vx - A.vx) * nx + (B.vz - A.vz) * nz;
          if (rv < 0) {
            const j = -1.3 * rv / (1 / ma + 1 / mb);
            A.vx -= j * nx / ma; A.vz -= j * nz / ma; B.vx += j * nx / mb; B.vz += j * nz / mb;
            if (-rv > 5) {
              A.damage((-rv - 5) * 2 * mb / tot); B.damage((-rv - 5) * 2 * ma / tot);
              const px = ax + nx * ra, pz = az + nz * ra;
              A.dent(px, pz, -nx, -nz, -rv); B.dent(px, pz, nx, nz, -rv);
              onCarCrash(A, B, -rv);
            }
          }
          done = true; break;
        }
        if (done) break;
      }
    }
  }
}

// ===== Yo'l tarmog'i bo'ylab haydash =====
function neighbors(i, j) {
  return [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]].filter(n => n[0] >= 0 && n[0] <= CITY.N && n[1] >= 0 && n[1] <= CITY.N);
}
function chooseNext(fi, fj, ti, tj, goal) {
  const opts = neighbors(ti, tj).filter(n => !(n[0] === fi && n[1] === fj));
  if (!opts.length) return [fi, fj];
  if (goal) {
    opts.sort((a, b) => dist2(roadPos(a[0]), roadPos(a[1]), goal.x, goal.z) - dist2(roadPos(b[0]), roadPos(b[1]), goal.x, goal.z));
    return Math.random() < 0.85 ? opts[0] : pick(opts);
  }
  const straight = opts.find(n => n[0] - ti === ti - fi && n[1] - tj === tj - fj);
  return straight && Math.random() < 0.55 ? straight : pick(opts);
}
function setRoute(car, fi, fj, ti, tj, lane, goal) {
  car.ai = { fi, fj, ti, tj, lane, ni: 0, nj: 0 };
  [car.ai.ni, car.ai.nj] = chooseNext(fi, fj, ti, tj, goal);
}
// Mashinani eng yaqin yo'l bo'lagiga "bog'lash" (masalan, ta'qibdan keyin)
function anchorToRoad(car, lane, goal) {
  const N = CITY.N, kx = clamp(Math.round((car.x - CITY.OFF) / CITY.CELL), 0, N), kz = clamp(Math.round((car.z - CITY.OFF) / CITY.CELL), 0, N);
  if (Math.abs(car.x - roadPos(kx)) < Math.abs(car.z - roadPos(kz))) {
    const j = clamp(Math.floor((car.z - CITY.OFF) / CITY.CELL), 0, N - 1);
    if (Math.cos(car.h) >= 0) setRoute(car, kx, j, kx, j + 1, lane, goal); else setRoute(car, kx, j + 1, kx, j, lane, goal);
  } else {
    const i = clamp(Math.floor((car.x - CITY.OFF) / CITY.CELL), 0, N - 1);
    if (Math.sin(car.h) >= 0) setRoute(car, i, kz, i + 1, kz, lane, goal); else setRoute(car, i + 1, kz, i, kz, lane, goal);
  }
}
// Yo'l bo'ylab nishon nuqtasini hisoblab, rul va gazni o'rnatadi
function aiFollowRoad(car, cruise, goal, reanchored) {
  const a = car.ai, L = CITY.CELL;
  let ax = roadPos(a.fi), az = roadPos(a.fj), bx = roadPos(a.ti), bz = roadPos(a.tj);
  let dx = Math.sign(bx - ax), dz = Math.sign(bz - az);
  const lat = (car.x - ax) * -dz + (car.z - az) * dx - a.lane;
  if (Math.abs(lat) > 12 && !reanchored) { anchorToRoad(car, a.lane, goal); return aiFollowRoad(car, cruise, goal, true); }
  let nx = Math.sign(roadPos(a.ni) - bx), nz = Math.sign(roadPos(a.nj) - bz);
  let sgn = nx * -dz + nz * dx; // +1 o'ngga, -1 chapga, 0 to'g'ri
  let s = (car.x - ax) * dx + (car.z - az) * dz, corner = L - sgn * a.lane;
  if (s > corner) {
    a.fi = a.ti; a.fj = a.tj; a.ti = a.ni; a.tj = a.nj;
    [a.ni, a.nj] = chooseNext(a.fi, a.fj, a.ti, a.tj, goal);
    ax = bx; az = bz; bx = roadPos(a.ti); bz = roadPos(a.tj); dx = nx; dz = nz;
    nx = Math.sign(roadPos(a.ni) - bx); nz = Math.sign(roadPos(a.nj) - bz);
    sgn = nx * -dz + nz * dx; s = (car.x - ax) * dx + (car.z - az) * dz; corner = L - sgn * a.lane;
  }
  const look = 7 + Math.abs(car.fwd) * 0.35, st = s + look;
  let tx, tz;
  if (st <= corner) { tx = ax + dx * st - dz * a.lane; tz = az + dz * st + dx * a.lane; }
  else { const s2 = sgn * a.lane + (st - corner); tx = bx + nx * s2 - nz * a.lane; tz = bz + nz * s2 + nx * a.lane; }
  if (sgn !== 0 && corner - s < 24) cruise = Math.min(cruise, 8 + (car.role === 'police' ? 6 : 0));
  // Burilishdan oldin burilish chirog'i (sgn: +1 o'ngga, -1 chapga)
  if (car.signal !== 2) car.signal = sgn !== 0 && corner - s < 32 && corner - s > -6 ? sgn : 0;
  steerTo(car, tx, tz, cruise);
}
function steerTo(car, tx, tz, cruise) {
  const err = wrapAng(Math.atan2(tx - car.x, tz - car.z) - car.h);
  car.steer = clamp(err * 2.4, -1, 1);
  if (Math.abs(err) > 1.2) cruise = Math.min(cruise, 7);
  car.thr = cruise <= 0.1 ? (car.fwd > 0.3 ? -1 : 0) : clamp((cruise - car.fwd) * 0.45, -1, 1);
}
// Oldinda to'siq bormi (mashina yoki piyoda o'yinchi). Topilgan narsa — AI_HIT (quvib o'tish uchun).
// shift — yo'lak almashtirayotganda yangi yo'lakkacha yon masofa (o'ngga musbat): eski yo'lakdagi mashina
// faqat juda yaqin bo'lsa to'siq hisoblanadi, aks holda quvib o'tayotgan mashina uning orqasida qotib qolardi
// F — yo'l bo'lagi (traffic.js segFrame): to'g'ri yo'lda o'lchov yo'l bo'ylab olinadi, mashina burchagi emas —
// aks holda yo'lakka qaytayotgan, biroz qiyshiq turgan mashina yo'l chetidagi mashinani "oldimda" deb qotib qolardi
let AI_HIT = null;
function aiObstacle(car, range, cars, player, shift = 0, near = 1e9, F = null) {
  let best = range;
  AI_HIT = null;
  const fx = Math.sin(car.h), fz = Math.cos(car.h);
  const road = F && F.s > CITY.R / 2 && F.s < CITY.CELL - CITY.R / 2, edge = road ? CITY.CELL - CITY.R / 2 + 3 - F.s : 0;
  const test = (x, z, w, o, near = 0) => {
    const rx = x - car.x, rz = z - car.z;
    let al = rx * F_dx(road, F, fx) + rz * F_dz(road, F, fz), l = -rx * F_dz(road, F, fz) + rz * F_dx(road, F, fx);
    if (road && al > edge) { al = rx * fx + rz * fz; l = -rx * fz + rz * fx; } // chorrahadan nariga — mashina yo'nalishi bo'yicha
    // Eski yo'lakdagi uchun zaxirasiz kenglik: yon tomonga o'tib bo'lgan mashina uni chetlab o'ta oladi
    if (al > 0 && al < best && (Math.abs(l - shift) < w || (Math.abs(l) < w - 0.2 && al < near))) { best = al; AI_HIT = o; }
  };
  // Kenglik ikkala mashinaga qarab: yonidagi yo'lakdagi va yo'l chetida turganlar to'siq emas
  for (const o of cars) if (o !== car) test(o.x, o.z, (car.T.w + o.T.w) / 2 + 0.12, o, near);
  if (player && !player.inCar && !player.dead) test(player.x, player.z, 1.6, player);
  // Yo'l kesib o'tayotgan piyodalarga yo'l berish
  for (const p of Game.peds) if (p.onRoad && p.alive) test(p.x, p.z, 1.9, p);
  return best;
}
const F_dx = (road, F, fx) => (road ? F.dx : fx), F_dz = (road, F, fz) => (road ? F.dz : fz);
// Oddiy yo'l harakati (haydovchi fe'li, yo'lak almashtirish, yo'l berish, to'xtash — js/traffic.js)
function updateTrafficAI(car, dt, cars, player) {
  if (car.revT > 0) { car.revT -= dt; car.thr = -0.8; car.steer = -car.steer || 0.6; return; }
  if (car.leaveT > 0) { leaveWait(car, dt); return; }
  const D = drvOf(car), a = car.ai;
  car.holding = false;
  stepLane(car, dt);
  const F = segFrame(car);
  // Chap yo'lakda biroz tezroq yuriladi
  let cruise = car.panic > 0 ? 22 : 12 * (0.75 + 0.25 * Weather.grip) * D.k * (a.lane < 4 ? 1.08 : 1);
  const free = car.type === 'bus' ? Math.min(cruise, 11) : cruise; // bekatsiz istagan tezlik (quvib o'tish uchun)
  if (car.type === 'bus') cruise = busCruise(car, free, dt);
  car.panic = Math.max(0, car.panic - dt);
  // Yo'lak almashtirayotganda: eski yo'lakdagi mashina gacha yon tomonga o'tib ulgurmasa — u ham to'siq
  const shift = a.laneT - (-(car.x - F.ax) * F.dz + (car.z - F.az) * F.dx);
  const near = Math.abs(shift) > 0.3 ? 5.5 + Math.abs(shift) / laneRate(car) * car.speed * 0.8 : 1e9;
  const obst = aiObstacle(car, 30, cars, player, Math.abs(shift) > 0.3 ? shift : 0, near, F), lead = AI_HIT;
  let blocked = false;
  car.leadObj = lead instanceof Car && obst < 12 ? lead : null;
  if (obst < 30 && car.panic <= 0) {
    const lim = Math.max(0, (obst - 5.2 - 1.6 * D.gap) * 0.9);
    // Bir-birini to'sib qolgan doirada navbat bilan: bittasi sekin o'tib ketadi
    car.glT = (car.glT || 0) - dt;
    if (lim < 0.5 && car.speed < 1 && car.leadObj && gridlockFree(car)) cruise = Math.min(cruise, 2.5);
    else { cruise = Math.min(cruise, lim); blocked = cruise < 0.5; }
  }
  if (car.panic <= 0) {
    const sc = signalCruise(car, cruise, D);
    if (sc < cruise - 0.05) car.holding = true;
    cruise = crossCruise(car, yieldCruise(car, sc, F, D, dt), cars);
    if (car.park) { cruise = parkCruise(car, cruise, F, obst); if (!car.ai) return; } // to'xtab bo'ldi — haydovchi tushib ketdi
    // Oldindagi mashina sekin (svetoforda yoki yo'l berib turgani emas) — quvib o'tish mumkin
    const slow = lead instanceof Car && !car.holding && !lead.holding && lead.speed < free - 3;
    laneLogic(car, dt, F, D, slow, slow && lead.speed < 0.5 && obst < 20 && (!lead.driver || lead.dwell > 0 || lead.dead));
    // Yo'lak almashtirmoqchi-yu, oldidagi mashinaga juda yaqin qolib ketdi — biroz orqaga yuradi
    if (Math.abs(shift) > 0.8 && car.speed < 0.5 && lead instanceof Car && obst < 9) { car.lcStuck = (car.lcStuck || 0) + dt; if (car.lcStuck > 1.5) { car.lcStuck = 0; car.revT = 1.1; } }
    else car.lcStuck = Math.max(0, (car.lcStuck || 0) - dt * 0.5);
  }
  aiFollowRoad(car, cruise, null);
  laneSignal(car);
  // Svetofor yoki yo'l berib turganlarga emas, faqat yo'l to'silganda signal chaladi
  const waiting = car.holding || (lead instanceof Car && lead.holding);
  if (blocked && !waiting) { car.waitT += dt; if (car.waitT > D.honk && Math.random() < dt * 0.5) honk(car); } else car.waitT = 0;
  trackStuck(car, dt);
  stuckGuard(car, dt);
}
// Avtobus bekatda 6 soniya to'xtaydi
function busCruise(car, cruise, dt) {
  if (car.dwell > 0) { car.dwell -= dt; return 0; }
  const a = car.ai, key = a.fi + ',' + a.fj + ',' + a.ti + ',' + a.tj, st = World.busStops[key];
  if (!st || car.served === key) return cruise;
  const ax = roadPos(a.fi), az = roadPos(a.fj), dx = Math.sign(roadPos(a.ti) - ax), dz = Math.sign(roadPos(a.tj) - az);
  const dist = st.s - ((car.x - ax) * dx + (car.z - az) * dz);
  if (dist < -2) { car.served = key; return cruise; }
  if (dist < 0.8 && car.speed < 0.6) { car.dwell = 6; car.served = key; return 0; }
  return dist < 30 ? Math.min(cruise, Math.max(1.2, dist * 0.45)) : cruise;
}
// Svetofor: qizil yoki sariqda to'xtash chizig'i oldida to'xtaydi
function signalCruise(car, cruise, D) {
  const a = car.ai;
  if (!a) return cruise;
  const ax = roadPos(a.fi), az = roadPos(a.fj), dx = Math.sign(roadPos(a.ti) - ax), dz = Math.sign(roadPos(a.tj) - az);
  const s = (car.x - ax) * dx + (car.z - az) * dz;
  const dist = CITY.CELL - CITY.R / 2 - 3.2 - car.T.l / 2 - s;
  if (dist < -0.5 || dist > 35) return cruise;
  const st = signalFor(a.ti, a.tj, dx !== 0);
  if (st === 'G' || (st === 'Y' && dist < (D ? D.yellow : 7))) return cruise; // shoshqaloq haydovchi sariqda ham o'tadi
  return Math.min(cruise, Math.max(0, dist - 0.3) * 0.7);
}
function trackStuck(car, dt) {
  if (car.thr > 0.3 && Math.abs(car.fwd) < 0.7) car.stuckT += dt; else car.stuckT = Math.max(0, car.stuckT - dt);
  if (car.stuckT > 1.8) { car.stuckT = 0; car.revT = 1.3; }
}
// Politsiya: ko'rsa — to'g'ridan ta'qib, ko'rmasa — yo'llar orqali yaqinlashadi
function updatePoliceAI(car, dt, cars, player, wanted) {
  car.siren = wanted > 0;
  if (wanted === 0) { car.direct = false; return updateTrafficAI(car, dt, cars, player); }
  if (car.revT > 0) { car.revT -= dt; car.thr = -1; car.steer = -car.steer || 0.8; return; }
  const P = player.inCar || player, d = Math.hypot(P.x - car.x, P.z - car.z);
  const see = d < 55 && lineOfSight(car.x, 1.2, car.z, P.x, 1.2, P.z);
  car.sees = see;
  if (see) {
    car.direct = true;
    const lead = clamp(d / 25, 0, 1);
    const tx = P.x + (P.vx || 0) * lead, tz = P.z + (P.vz || 0) * lead;
    const cruise = !player.inCar && d < (wanted >= 2 ? 18 : 10) ? 0 : car.T.max;
    steerTo(car, tx, tz, cruise);
  } else {
    if (car.direct) { car.direct = false; anchorToRoad(car, 2.5, P); }
    aiFollowRoad(car, car.T.max * 0.8, P);
  }
  trackStuck(car, dt);
}
