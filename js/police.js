'use strict';
// ===== Kuchliroq politsiya: piyoda politsiyachilar, yo'l to'siqlari, vertolyot =====
const BEAM_DOWN = new THREE.Vector3(0, -1, 0), _beamDir = new THREE.Vector3();

// ----- Piyoda politsiyachi: quvadi, ushlaydi (1★) yoki otadi (2★+) -----
class Cop extends Ped {
  constructor(x, z, guard) {
    const b = blockAt(x, z) || nearestBlock(x, z);
    super(b, ringT(b, x, z), 'police');
    this.x = x; this.z = z; this.cop = true; this.hp = 70; this.guard = !!guard;
    this.state = 'chase'; this.shootT = rand(0.8, 1.8); this.umb = false;
    const gun = new THREE.Mesh(_wgeo.pistol || (_wgeo.pistol = WEAPON_GEO.pistol()), WEAPON_MAT);
    this.hm.b.faR.add(gun);
  }
  scare() { /* politsiya qo'rqmaydi */ }
  update(dt) {
    if (this.state !== 'chase') return super.update(dt);
    const P = Player, T = P.inCar || P, hm = this.hm;
    if (Game.wanted === 0) { this.state = 'walk'; this.blk = blockAt(this.x, this.z) || nearestBlock(this.x, this.z); this.t = ringT(this.blk, this.x, this.z); return super.update(dt); }
    const dx = T.x - this.x, dz = T.z - this.z, d = Math.hypot(dx, dz);
    const see = d < 40 && lineOfSight(this.x, 1.5, this.z, T.x, 1.3, T.z);
    const keep = Game.wanted >= 2 && see ? 9 : 1.6;
    let sp = 0;
    if (!this.guard && d > keep) { sp = d > 14 ? 5.4 : 3.2; this.x += dx / d * sp * dt; this.z += dz / d * sp * dt; pushOut(this, 0.3, 0.5); }
    this.h += wrapAng(Math.atan2(dx, dz) - this.h) * Math.min(1, dt * 8);
    this.phase += dt * sp * 2.2;
    poseHuman(hm, this.phase, clamp(sp / 4, 0, 1), sp > 4 ? 1 : 0);
    if (Game.wanted >= 2 && see && d < 35 && !P.dead) {
      hm.b.uaR.rotation.set(-Math.PI / 2, 0, 0); hm.b.faR.rotation.set(0, 0, 0);
      if ((this.shootT -= dt) <= 0) {
        this.shootT = rand(0.9, 1.6) / (Game.wanted >= 4 ? 1.4 : 1);
        const hit = Math.random() < clamp(0.42 - d / 90 - Math.hypot(T.vx || 0, T.vz || 0) / 60, 0.06, 0.42), o = hit ? 0.3 : 2;
        FX.tracer(this.x, this.y + 1.45, this.z, T.x + rand(-o, o), (T.y || 0) + 1.1, T.z + rand(-o, o));
        SFX.shot('pistol', clamp(1 - d / 60, 0.3, 0.9), clamp(d / 70, 0, 0.6));
        if (hit) { if (P.inCar) { P.inCar.damage(4); hurtPlayer(1.5); } else hurtPlayer(rand(6, 10)); }
      }
    }
    this.y = lerp(this.y, groundH(this.x, this.z), 0.3);
    hm.g.position.set(this.x, this.y, this.z);
    hm.g.rotation.y = this.h;
  }
}
// Politsiya mashinasi yaqinda to'xtasa — 2 ta politsiyachi tushadi
function deployCops(dt) {
  if (Game.wanted === 0) return;
  const P = Player, onFoot = Game.peds.filter(p => p.cop && p.alive).length;
  if (onFoot >= 6) return;
  for (const c of Game.cars) {
    if (c.driver !== 'police' || c.deployed || c.speed > 3) continue;
    if (dist2(c.x, c.z, P.x, P.z) > 22 * 22) continue;
    c.deployed = true;
    const rx = -Math.cos(c.h), rz = Math.sin(c.h);
    for (const s of [1, -1]) {
      const o = { x: c.x + rx * s * (c.T.w / 2 + 0.8), z: c.z + rz * s * (c.T.w / 2 + 0.8) };
      pushOut(o, 0.35, 0.5);
      Game.peds.push(new Cop(o.x, o.z));
    }
    c.setDriverModel(null); c.driver = null; c.siren = true;
    return;
  }
}

// ----- Yo'l to'siqlari (3★+): oldingizdagi yo'lda ko'ndalang turgan 2 mashina -----
const Roadblocks = {
  t: 8,
  update(dt) {
    if (Game.wanted < 3) { this.t = 8; return; }
    if ((this.t -= dt) > 0) return;
    this.t = rand(22, 32);
    const P = Player, c = P.inCar;
    if (!c || c.speed < 8) return;
    const fx = c.vx / c.speed, fz = c.vz / c.speed;
    const [ni, nj] = nearestNode(P.x + fx * 170, P.z + fz * 170);
    // To'siq chorrahaga kelayotgan yo'lda, o'yinchi tomonda
    const horiz = Math.abs(fx) > Math.abs(fz), sg = horiz ? -Math.sign(fx) : -Math.sign(fz);
    const nx = roadPos(ni), nz = roadPos(nj);
    const bx = horiz ? nx + sg * 24 : nx, bz = horiz ? nz : nz + sg * 24;
    if (Math.hypot(bx - P.x, bz - P.z) < 90 || Math.abs(bx) > CITY.SIZE / 2 || Math.abs(bz) > CITY.SIZE / 2) return;
    const h = horiz ? 0 : Math.PI / 2;
    for (const off of [-3.4, 3.4]) {
      const x = horiz ? bx : bx + off, z = horiz ? bz + off : bz;
      if (Game.cars.some(o => dist2(o.x, o.z, x, z) < 9)) continue;
      const k = new Car('police', x, z, h + rand(-0.2, 0.2), 'parked'); k.siren = true; k.roadblock = true;
      Game.cars.push(k);
    }
    for (const off of [-6.5, 6.5]) {
      const x = horiz ? bx - sg * 3 : bx + off, z = horiz ? bz + off : bz - sg * 3;
      Game.peds.push(new Cop(x, z, true));
    }
    HUD.help('Oldinda politsiya to\'sig\'i!', 2.5);
  },
};

// ----- Politsiya vertolyoti (4★+) -----
class Heli {
  constructor(x, z) {
    const P = [
      { geo: new THREE.SphereGeometry(1, 16, 12).scale(1.3, 1.1, 2.1).translate(0, 0, 0.3), color: 0x1d2a44 },
      { geo: new THREE.SphereGeometry(1, 14, 10, 0, TAU, 0, Math.PI / 2).scale(1.15, 0.9, 1.4).rotateX(-0.25).translate(0, 0.25, 1.3), color: 0x8fb3c9 },
      [0.5, 0.5, 4.6, 0, 0.35, -3.2, 0x1d2a44], [0.12, 1.4, 1.0, 0, 1.0, -5.3, 0xf2f2f2],
      [2.62, 0.25, 2.2, 0, -0.1, 0.3, 0xf2f2f2],
      [0.12, 0.12, 3.6, 0.95, -1.35, 0.3, 0x333333], [0.12, 0.12, 3.6, -0.95, -1.35, 0.3, 0x333333],
      [0.08, 0.6, 0.08, 0.95, -1.0, -0.6, 0x333333], [0.08, 0.6, 0.08, -0.95, -1.0, -0.6, 0x333333],
      [0.08, 0.6, 0.08, 0.95, -1.0, 1.2, 0x333333], [0.08, 0.6, 0.08, -0.95, -1.0, 1.2, 0x333333],
      [0.3, 0.5, 0.3, 0, 1.2, 0.2, 0x333333],
    ];
    this.g = new THREE.Group();
    const body = new THREE.Mesh(mergeParts(P), CAR_MAT); body.castShadow = true;
    this.rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.06, 0.35), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    this.rotor2 = this.rotor.clone(); this.rotor2.rotation.y = Math.PI / 2;
    const hub = new THREE.Group(); hub.position.y = 1.5; hub.add(this.rotor, this.rotor2); this.hub = hub;
    this.tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.6, 0.18), this.rotor.material);
    this.tail.position.set(0.12, 1.0, -5.3);
    // Projektor: yerga tushadigan nur (tunda ko'rinadi)
    this.beam = new THREE.Mesh(new THREE.ConeGeometry(7, 1, 20, 1, true).translate(0, -0.5, 0),
      new THREE.MeshBasicMaterial({ color: 0xfff7d6, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
    this.g.add(body, hub, this.tail);
    World.scene.add(this.g, this.beam);
    this.x = x; this.z = z; this.y = 70; this.vx = 0; this.vz = 0; this.h = 0; this.shootT = 2; this.ang = rand(0, TAU);
    this.bx = x; this.bz = z;
  }
  update(dt) {
    const P = Player, T = P.inCar || P;
    this.ang += dt * 0.25;
    const tx = T.x + Math.cos(this.ang) * 28, tz = T.z + Math.sin(this.ang) * 28;
    const dx = tx - this.x, dz = tz - this.z, d = Math.hypot(dx, dz) || 1, maxV = 34;
    const k = 1 - Math.exp(-dt * 0.8);
    this.vx = lerp(this.vx, dx / d * Math.min(maxV, d * 0.8), k); this.vz = lerp(this.vz, dz / d * Math.min(maxV, d * 0.8), k);
    this.x += this.vx * dt; this.z += this.vz * dt;
    this.y = lerp(this.y, this.leaving ? 160 : 62, dt * 0.3);
    this.h += wrapAng(Math.atan2(T.x - this.x, T.z - this.z) - this.h) * Math.min(1, dt * 1.5);
    this.g.position.set(this.x, this.y, this.z);
    this.g.rotation.set(clamp(this.vz * 0.01, -0.3, 0.3), this.h, clamp(-this.vx * 0.01, -0.3, 0.3), 'YXZ');
    this.hub.rotation.y += dt * 28; this.tail.rotation.x += dt * 40;
    // Projektor nishonga ergashadi
    this.bx = lerp(this.bx, T.x, dt * 1.5); this.bz = lerp(this.bz, T.z, dt * 1.5);
    const len = Math.hypot(this.bx - this.x, this.y, this.bz - this.z);
    this.beam.visible = World.daylight < 0.6 && !this.leaving;
    this.beam.position.set(this.x, this.y - 1.2, this.z);
    this.beam.scale.set(1, len, 1);
    this.beam.quaternion.setFromUnitVectors(BEAM_DOWN, _beamDir.set(this.bx - this.x, -(this.y - 1.2), this.bz - this.z).normalize());
    this.hd = Math.hypot(T.x - this.x, T.z - this.z);
    this.sees = !this.leaving && this.hd < 150;
    if (Game.wanted >= 5 && this.sees && this.hd < 90 && !P.dead && (this.shootT -= dt) <= 0) {
      this.shootT = rand(1.2, 2.2);
      const hit = Math.random() < 0.28, o = hit ? 0.3 : 3;
      FX.tracer(this.x, this.y - 1.5, this.z, T.x + rand(-o, o), (T.y || 0) + 1, T.z + rand(-o, o));
      SFX.shot('smg', 0.5, 0.5);
      if (hit) { if (P.inCar) { P.inCar.damage(6); hurtPlayer(2); } else hurtPlayer(rand(8, 14)); }
    }
  }
  remove() { World.scene.remove(this.g, this.beam); }
}

const PoliceAir = {
  heli: null,
  update(dt) {
    const P = Player;
    if (Game.wanted >= 4 && !this.heli) {
      const a = rand(0, TAU);
      this.heli = new Heli(P.x + Math.cos(a) * 220, P.z + Math.sin(a) * 220);
      HUD.help('Politsiya vertolyoti yetib keldi!', 2.5);
    }
    const h = this.heli;
    if (!h) { SFX.setHeli(0); return; }
    if (Game.wanted < 3) h.leaving = true;
    h.update(dt);
    const d = Math.hypot(h.x - P.x, h.z - P.z, h.y - P.y);
    SFX.setHeli(clamp(1 - d / 260, 0, 1));
    if (h.leaving && (h.y > 140 || d > 400)) { h.remove(); this.heli = null; SFX.setHeli(0); }
  },
  sees() { return !!(this.heli && this.heli.sees); },
  reset() { if (this.heli) { this.heli.remove(); this.heli = null; } SFX.setHeli(0); },
};
