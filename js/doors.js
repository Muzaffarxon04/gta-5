'use strict';
// ===== Eshiklar: haydovchi eshigi ochilib-yopiladi. Mashinaga o'tirish va tushish ketma-ketligi,
// ichida odam bo'lsa — eshikni ochib, uni ko'tarib tashqariga otib yuborish.
// Haydovchi chap tomonda o'tiradi — mashina fazosida +x tomon.
const DOOR_OPEN = 1.12; // eshik ochilish burchagi (radian, ~64°)
const _dv = new THREE.Vector3();
const easeIO = t => t * t * (3 - 2 * t);

// Model tayyorlanganda (prepModel): haydovchi eshigi egallagan quti (mashina fazosida). Eshik ochilganda kuzovdan shu
// quti ichi "kesib" yashiriladi va xuddi shu quti ichidagi kuzov nusxasi oshiq-moshiq atrofida buriladi (WebGL kesish
// tekisliklari) — model qanday uchburchaklardan iborat bo'lishidan qat'i nazar eshik shakli aniq chiqadi.
function prepDoor(name, scene, M) {
  const near = scene.getObjectByName('lod0'), T = Object.values(CAR_TYPES).find(t => t.model === name);
  if (!near || !T || T.kind === 'moto' || T.kind === 'bus' || !T.seat) return;
  const S = T.seat, zr = S.z - 0.38, zf = zr + (T.kind === 'van' ? 1.0 : 1.12), yb = T.kind === 'van' ? T.wr * 2 + 0.02 : T.wr + 0.06, yt = T.H - 0.2;
  // Eshik sirtining tashqi chegarasi — shu oraliqdagi eng chetki nuqta
  let xOut = 0;
  near.children.forEach(o => {
    if (!o.isMesh) return;
    o.updateMatrix(); toFloatAttrs(o.geometry);
    const P = o.geometry.attributes.position;
    for (let i = 0; i < P.count; i++) {
      _dv.fromBufferAttribute(P, i).applyMatrix4(o.matrix);
      if (_dv.z > zr && _dv.z < zf && _dv.y > 0.45 && _dv.y < 1.0 && _dv.x > xOut) xOut = _dv.x;
    }
  });
  if (xOut > 0.4) M.doorBox = { x0: xOut - 0.26, x1: xOut + 0.3, y0: yb, y1: yt, z0: zr, z1: zf, xOut };
}

// Eshikni ochish darajasi a (0 — yopiq … 1 — to'liq ochiq). Faqat yaqindan (o'yinchi o'tirayotganda) ishlatiladi
function setDoor(c, a) {
  if (!c.doorBox || !c.body.isLOD) return;
  if (a <= 0.001) { if (c.doorFx) clearDoor(c); return; }
  const F = c.doorFx || (c.doorFx = makeDoorFx(c));
  F.pivot.rotation.y = -DOOR_OPEN * a;
  c.mesh.updateMatrixWorld(true);
  // Kuzov: quti ichi kesiladi (normallar tashqariga, clipIntersection) — eshik nusxasi: faqat burilgan quti ichi
  F.m.copy(F.pivot.matrixWorld).multiply(F.p0inv);
  for (let i = 0; i < 6; i++) {
    F.bodyPlanes[i].copy(F.local[i]).applyMatrix4(F.near.matrixWorld);
    F.doorPlanes[i].copy(F.local[i]).negate().applyMatrix4(F.m);
  }
}
function makeDoorFx(c) {
  renderer.localClippingEnabled = true;
  const B = c.doorBox, near = c.body.getObjectByName('lod0');
  const F = { near, orig: new Map(), mats: [], bodyPlanes: [], doorPlanes: [], local: [], m: new THREE.Matrix4() };
  // Quti yoqlari (normallar tashqariga): n·p − d = 0
  for (const [nx, ny, nz, d] of [[1, 0, 0, B.x1], [-1, 0, 0, -B.x0], [0, 1, 0, B.y1], [0, -1, 0, -B.y0], [0, 0, 1, B.z1], [0, 0, -1, -B.z0]]) {
    F.local.push(new THREE.Plane(new THREE.Vector3(nx, ny, nz), -d));
    F.bodyPlanes.push(new THREE.Plane()); F.doorPlanes.push(new THREE.Plane());
  }
  F.pivot = new THREE.Group(); F.pivot.position.set(B.xOut - 0.04, 0, B.z1); near.add(F.pivot);
  F.pivot.updateMatrix(); F.p0inv = new THREE.Matrix4().copy(F.pivot.matrix).invert();
  const clip = (mat, planes, inter) => { const m = mat.clone(); m.clippingPlanes = planes; m.clipIntersection = inter; m.clipShadows = true; F.mats.push(m); return m; };
  const tmp = new THREE.Matrix4();
  for (const o of near.children) {
    if (!o.isMesh || o === c.plateMesh) continue;
    F.orig.set(o, o.material);
    o.material = clip(o.material, F.bodyPlanes, true);
    const d = new THREE.Mesh(o.geometry, clip(F.orig.get(o), F.doorPlanes, false));
    o.updateMatrix(); tmp.multiplyMatrices(F.p0inv, o.matrix).decompose(d.position, d.quaternion, d.scale);
    d.userData = { ...o.userData };
    F.pivot.add(d);
  }
  return F;
}
function clearDoor(c) {
  const F = c.doorFx;
  if (!F) return;
  for (const [o, mat] of F.orig) if (F.mats.includes(o.material)) o.material = mat;
  F.near.remove(F.pivot);
  for (const m of F.mats) m.dispose();
  c.doorFx = null;
}

// Mashina fazosidagi nuqtani dunyoga (lx — chapga, lz — oldinga)
const carToWorld = (c, lx, lz) => ({ x: c.x + lx * Math.cos(c.h) + lz * Math.sin(c.h), z: c.z - lx * Math.sin(c.h) + lz * Math.cos(c.h) });
// Eshik tashqi chegarasi (eshigi yo'q mashinada — kuzov yarmi)
const doorX = c => (c.doorBox && c.doorBox.xOut) || c.T.w / 2;

const CarEntry = {
  job: null,
  get active() { return !!this.job; },
  // O'yinchi F bosdi yoki telefonda eshik belgisini bosdi
  enter(c) {
    if (this.job || Player.dead) return;
    if (c.driver === 'remote' || c.dead) { enterCar(c); return; } // boshqa o'yinchi mashinasi — yo'lovchi
    const role = c.driver === 'traffic' || c.driver === 'police' || c.driver === 'racer' ? c.driver : null;
    if (role) { c.driver = null; c.ai = null; c.thr = 0; } // haydovchi to'xtaydi (tormoz)
    const P = Player, dx = doorX(c), S = c.T.seat;
    // Yo'l: yo'lovchi tomonda yoki old/orqada turgan bo'lsa — mashinani yaqin uchidan aylanib o'tadi
    const ox = P.x - c.x, oz = P.z - c.z, lx = ox * Math.cos(c.h) - oz * Math.sin(c.h), lz = ox * Math.sin(c.h) + oz * Math.cos(c.h);
    const path = [];
    if (lx < dx * 0.6) {
      const zEnd = (lz >= 0 ? 1 : -1) * (c.T.l / 2 + 0.7);
      if (lx < -dx * 0.6) path.push([-(dx + 0.6), zEnd]);
      path.push([dx + 0.6, zEnd]);
    }
    path.push([dx + 0.5, S.z - 0.05]);
    this.job = { c, kind: 'in', phase: 'walk', t: 0, role, path, seg: 0 };
    if (P.gun) P.gun.visible = false;
  },
  // O'yinchi boshqara olmaydigan payt (eshik yopilayotganda — boshqarsa bo'ladi)
  get locked() { return !!this.job && this.job.phase !== 'close'; },
  // F mashinada: sekin yurayotgan bo'lsa — eshikni ochib tushadi, tez bo'lsa — darhol (sakrab) tushadi
  exit() {
    const P = Player, c = P.inCar;
    if (this.job || !c) return;
    if (P.passenger || !c.doorBox || c.speed > 3 || c.T.kind === 'moto') { exitCar(); return; }
    if (Cockpit.on) Cockpit.toggle(); // tushayotganini orqadan ko'ramiz
    this.job = { c, kind: 'out', phase: 'open', t: 0 };
    SFX.doorOpen();
  },
  cancel() {
    const J = this.job;
    if (!J) return;
    setDoor(J.c, 0);
    if (J.pull) { World.scene.remove(J.pull.g); J.pull.mesh.geometry.dispose(); }
    if (J.kind === 'in' && Player.hm.g.parent === J.c.mesh) { World.scene.attach(Player.hm.g); Player.hm.g.rotation.set(0, Player.h, 0); }
    this.job = null;
  },
  update(dt) {
    const J = this.job;
    if (!J) return;
    const P = Player, c = J.c, hm = P.hm, S = c.T.seat, dx = doorX(c);
    if (P.dead || c.dead) { this.cancel(); return; }
    J.t += dt;
    const door = a => setDoor(c, a);
    const stand = carToWorld(c, dx + 0.5, S.z - 0.05), faceCar = Math.atan2(-Math.cos(c.h), Math.sin(c.h));
    const next = (ph) => { J.phase = ph; J.t = 0; };
    if (J.kind === 'in') {
      if (J.phase === 'walk') {
        // Eshik oldiga yurib boradi (kerak bo'lsa mashinani aylanib)
        let step = 4 * dt, done = false;
        while (step > 0) {
          const [wx, wz] = J.path[J.seg], w = carToWorld(c, wx, wz), ddx = w.x - P.x, ddz = w.z - P.z, d = Math.hypot(ddx, ddz);
          if (d > 0.01) P.h = Math.atan2(ddx, ddz);
          if (d <= step) { P.x = w.x; P.z = w.z; step -= d; if (++J.seg >= J.path.length) { done = true; break; } }
          else { P.x += ddx / d * step; P.z += ddz / d * step; step = 0; }
        }
        if (J.t > 4) done = true; // biror narsaga tiqilib qolsa ham
        P.y = groundH(P.x, P.z);
        P.phase = (P.phase || 0) + dt * 11; poseHuman(hm, P.phase, 0.85, 0.2);
        if (done) { P.h = faceCar; poseHuman(hm, 0, 0, 0); next(c.doorBox ? 'open' : J.role ? 'pull' : 'in'); if (c.doorBox) SFX.doorOpen(); }
        hm.g.position.set(P.x, P.y, P.z); hm.g.rotation.set(0, P.h, 0);
        return;
      }
      // Turgan joyida mashina bilan birga (mashina sirpanib ketsa ham eshik yonida)
      if (J.phase === 'open' || J.phase === 'pull') { P.x = stand.x; P.z = stand.z; P.h = faceCar; hm.g.position.set(P.x, groundH(P.x, P.z), P.z); hm.g.rotation.set(0, P.h, 0); }
      if (J.phase === 'open') {
        const k = Math.min(1, J.t / 0.35);
        door(easeIO(k));
        poseHuman(hm, 0, 0, 0); hm.b.uaR.rotation.set(-1.2 * k, 0, -0.1); hm.b.faR.rotation.set(-0.3, 0, 0);
        if (k >= 1) next(J.role && c.driverHM ? 'pull' : 'in');
        return;
      }
      if (J.phase === 'pull') {
        // Haydovchini ko'tarib, tashqariga otib yuboradi
        if (!J.pull) {
          const d = c.driverHM; c.driverHM = null;
          World.scene.attach(d.g); J.pull = d;
          J.from = d.g.position.clone(); J.fromH = d.g.rotation.y;
          const to = carToWorld(c, dx + 2.4, S.z + 0.5); J.to = new THREE.Vector3(to.x, groundH(to.x, to.z) + 0.15, to.z);
          SFX.punch();
          crime(J.role === 'police' ? 2 : 0.7);
        }
        const k = Math.min(1, J.t / 0.65), e = easeIO(k), d = J.pull;
        d.g.position.lerpVectors(J.from, J.to, e); d.g.position.y += Math.sin(Math.PI * k) * 0.7;
        d.g.rotation.set(-Math.PI / 2 * e, faceCar + Math.PI, 0);
        poseHuman(d, 0, 0, 0); d.b.uaL.rotation.set(-2.4, 0, 0.6); d.b.uaR.rotation.set(-2.4, 0, -0.6);
        poseHuman(hm, 0, 0, 0); hm.b.uaL.rotation.set(-1.4 * (1 - k), 0, 0.2); hm.b.uaR.rotation.set(-1.4 * (1 - k), 0, -0.2); hm.b.spine.rotation.x = 0.35 * Math.sin(Math.PI * k);
        if (k >= 1) {
          // Yerga tushgan haydovchi: biroz yotib, turib qochadi
          const b = blockAt(J.to.x, J.to.z) || nearestBlock(J.to.x, J.to.z), p = new Ped(b, 0, c.driverOutfit || (J.role === 'police' ? 'police' : null));
          p.x = J.to.x; p.z = J.to.z; p.h = faceCar + Math.PI; p.knockDown(1.3, P.x, P.z);
          Game.peds.push(p);
          World.scene.remove(d.g); d.mesh.geometry.dispose(); J.pull = null;
          c.driverOutfit = null;
          next('in');
        }
        return;
      }
      if (J.phase === 'in') {
        // Eshikdan ichkariga: oyoqni qo'yib, o'rindiqqa o'tiradi
        const lx0 = dx + 0.5, ly0 = groundH(stand.x, stand.z) - c.y, lz0 = S.z - 0.05;
        if (hm.g.parent !== c.mesh) { c.mesh.add(hm.g); }
        const k = Math.min(1, J.t / (c.T.kind === 'moto' ? 0.35 : 0.55)), e = easeIO(k), sy = S.y - 0.95 * hm.mesh.scale.y;
        hm.g.position.set(lerp(lx0, S.x, e), lerp(ly0, sy, e) + Math.sin(Math.PI * k) * 0.08, lerp(lz0, S.z, e));
        hm.g.rotation.set(0, lerp(-Math.PI / 2, 0, e), 0);
        if (k < 0.45) { poseHuman(hm, 0, 0, 0); hm.b.spine.rotation.x = 0.5 * k / 0.45; } else if (c.T.kind === 'moto') poseRider(hm); else poseSeated(hm);
        if (k >= 1) {
          enterCar(c, true);
          if (c.doorBox) next('close'); else this.job = null;
        }
        return;
      }
      if (J.phase === 'close') {
        const k = Math.min(1, J.t / 0.3);
        door(1 - easeIO(k));
        if (k >= 1) { SFX.door(); this.job = null; }
      }
      return;
    }
    // ----- Tushish -----
    if (P.inCar === c) { c.thr = 0; c.brk = 1; }
    if (J.phase === 'open') {
      const k = Math.min(1, J.t / 0.3);
      door(easeIO(k));
      if (k >= 1) next('out');
    } else if (J.phase === 'out') {
      const k = Math.min(1, J.t / 0.45), e = easeIO(k), sy = S.y - 0.95 * hm.mesh.scale.y, ly0 = groundH(stand.x, stand.z) - c.y;
      if (P.inCar === c && hm.g.parent === c.mesh) {
        hm.g.position.set(lerp(S.x, dx + 0.5, e), lerp(sy, ly0, e) + Math.sin(Math.PI * k) * 0.08, lerp(S.z, S.z - 0.05, e));
        hm.g.rotation.set(0, lerp(0, -Math.PI / 2, e), 0);
        if (k > 0.5) { poseHuman(hm, 0, 0, 0); hm.b.spine.rotation.x = 0.5 * (1 - k) / 0.5; }
      }
      if (k >= 1) {
        exitCar(true);
        P.x = stand.x; P.z = stand.z; P.y = groundH(P.x, P.z); P.h = faceCar + Math.PI;
        hm.g.position.set(P.x, P.y, P.z); hm.g.rotation.set(0, P.h, 0);
        next('close');
      }
    } else if (J.phase === 'close') {
      const k = Math.min(1, J.t / 0.3);
      door(1 - easeIO(k));
      if (k >= 1) { SFX.door(); this.job = null; }
    }
  },
};
