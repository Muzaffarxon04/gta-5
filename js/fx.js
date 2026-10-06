'use strict';
// ===== Effektlar: zarrachalar, o'q izlari, portlash yorug'ligi =====
const FX = {
  parts: [], tracers: [], mats: {}, geo: new THREE.BoxGeometry(1, 1, 1), light: null,
  init(scene) {
    this.scene = scene;
    this.light = new THREE.PointLight(0xffa040, 0, 45, 2);
    scene.add(this.light);
    for (let i = 0; i < 12; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe08a }));
      line.visible = false; line.frustumCulled = false;
      scene.add(line); this.tracers.push({ line, life: 0 });
    }
  },
  mat(color) { return this.mats[color] || (this.mats[color] = new THREE.MeshBasicMaterial({ color })); },
  spawn(x, y, z, vx, vy, vz, life, color, size, grow = false, grav = 0) {
    let p = this.parts.find(q => q.life <= 0);
    if (!p) {
      if (this.parts.length >= 280) return;
      p = { mesh: new THREE.Mesh(this.geo, this.mat(color)), life: 0 };
      this.scene.add(p.mesh); this.parts.push(p);
    }
    p.mesh.material = this.mat(color); p.mesh.visible = true;
    Object.assign(p, { x, y, z, vx, vy, vz, life, max: life, size, grow, grav });
    p.mesh.position.set(x, y, z); p.mesh.scale.setScalar(size);
  },
  tracer(ax, ay, az, bx, by, bz) {
    const t = this.tracers.find(q => q.life <= 0) || this.tracers[0];
    const pos = t.line.geometry.attributes.position;
    pos.array.set([ax, ay, az, bx, by, bz]); pos.needsUpdate = true;
    t.line.visible = true; t.life = 0.06;
  },
  flash(x, y, z, power) { this.light.position.set(x, y, z); this.light.intensity = Math.max(this.light.intensity, power); },
  explosion(x, y, z) {
    this.flash(x, y + 2, z, 7);
    for (let i = 0; i < 26; i++) this.spawn(x, y + 1, z, rand(-7, 7), rand(3, 12), rand(-7, 7), rand(0.5, 1.1), pick([0xffb020, 0xff6a00, 0xffe070]), rand(0.6, 1.4), true, 6);
    for (let i = 0; i < 14; i++) this.spawn(x, y + 1.5, z, rand(-2, 2), rand(2, 5), rand(-2, 2), rand(1.5, 2.6), pick([0x333333, 0x555555]), rand(1, 2), true, -0.5);
  },
  smoke(x, y, z, dark) { this.spawn(x + rand(-0.4, 0.4), y, z + rand(-0.4, 0.4), rand(-0.4, 0.4), rand(1.2, 2.2), rand(-0.4, 0.4), rand(0.8, 1.4), dark ? 0x2a2a2a : 0x9a9a9a, rand(0.35, 0.6), true, 0); },
  fire(x, y, z) { this.spawn(x + rand(-0.6, 0.6), y, z + rand(-0.6, 0.6), rand(-0.3, 0.3), rand(1.5, 3), rand(-0.3, 0.3), rand(0.3, 0.6), pick([0xff7a00, 0xffb020, 0xff4400]), rand(0.3, 0.6), false, 0); },
  sparks(x, y, z, color = 0xffd27a) { for (let i = 0; i < 6; i++) this.spawn(x, y, z, rand(-3, 3), rand(0, 4), rand(-3, 3), rand(0.15, 0.3), color, 0.09, false, 12); },
  update(dt) {
    for (const p of this.parts) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.mesh.visible = false; continue; }
      p.vy -= p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.05 && p.grav > 0) { p.y = 0.05; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
      const k = p.life / p.max;
      const sc = p.grow ? p.size * (1.6 - k * 0.6) * (k < 0.3 ? k / 0.3 : 1) : p.size * Math.max(k, 0.3);
      p.mesh.position.set(p.x, p.y, p.z); p.mesh.scale.setScalar(Math.max(0.01, sc));
    }
    for (const t of this.tracers) if (t.life > 0) { t.life -= dt; if (t.life <= 0) t.line.visible = false; }
    if (this.light.intensity > 0) this.light.intensity = Math.max(0, this.light.intensity - dt * 9);
  },
};

// ===== Yerdan olinadigan narsalar: pul, sog'liq, zirh, o'q =====
const PICKUP_MAT = new THREE.MeshBasicMaterial({ vertexColors: true });
const PICKUP_DEF = {
  cash: [[0.55, 0.22, 0.3, 0, 0, 0, 0x4fd36b], [0.56, 0.06, 0.31, 0, 0.05, 0, 0x2f8a43]],
  health: [[0.6, 0.2, 0.2, 0, 0, 0, 0xff4040], [0.2, 0.6, 0.2, 0, 0, 0, 0xff4040]],
  armor: [[0.5, 0.55, 0.18, 0, 0, 0, 0x4fa6e0], [0.3, 0.2, 0.2, 0, 0.3, 0, 0x2f6f9a]],
  ammo: [[0.3, 0.4, 0.2, 0, 0, 0, 0xffb238], [0.12, 0.2, 0.12, 0.1, 0.28, 0, 0xd08a1a]],
};
const Pickups = {
  list: [], geos: {},
  add(kind, x, z, value, respawn) {
    const geo = this.geos[kind] || (this.geos[kind] = mergeParts(PICKUP_DEF[kind]));
    const mesh = new THREE.Mesh(geo, PICKUP_MAT), y = groundH(x, z) + 0.75;
    mesh.position.set(x, y, z);
    World.scene.add(mesh);
    this.list.push({ kind, x, z, y, value, respawn, mesh, hidden: false, t: 0, age: 0 });
  },
  init() {
    const kinds = ['cash', 'cash', 'cash', 'cash', 'health', 'health', 'armor', 'ammo', 'ammo'];
    for (let n = 0; n < 46; n++) {
      const b = World.blocks[randi(0, CITY.N - 1)][randi(0, CITY.N - 1)];
      const [x, z] = ringPoint(b, rand(0, b.ring.P));
      const kind = pick(kinds);
      this.add(kind, x, z, kind === 'cash' ? randi(4, 25) * 10 : 0, true);
    }
  },
  update(dt, time) {
    const P = Player;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      if (p.hidden) { p.t -= dt; if (p.t <= 0) { p.hidden = false; p.mesh.visible = true; } continue; }
      p.mesh.rotation.y += dt * 2;
      p.mesh.position.y = p.y + Math.sin(time * 3 + i) * 0.15;
      if (!p.respawn && (p.age += dt) > 60) { this.removeAt(i); continue; }
      const r = P.inCar ? 2.8 : 1.3;
      if (!P.dead && dist2(p.x, p.z, P.x, P.z) < r * r && this.collect(p)) {
        if (p.respawn) { p.hidden = true; p.mesh.visible = false; p.t = 60; } else this.removeAt(i);
      }
    }
  },
  removeAt(i) { World.scene.remove(this.list[i].mesh); this.list.splice(i, 1); },
  collect(p) {
    const P = Player;
    if (p.kind === 'cash') { addMoney(p.value); }
    else if (p.kind === 'health') { if (P.hp >= 100) return false; P.hp = Math.min(100, P.hp + 40); HUD.help('Sog\'liq tiklandi'); }
    else if (p.kind === 'armor') { if (P.armor >= 100) return false; P.armor = Math.min(100, P.armor + 50); HUD.help('Zirh kiyildi'); }
    else if (p.kind === 'ammo') {
      const w = WEAPONS[P.weapon].melee ? 'pistol' : P.weapon, n = w === 'shotgun' ? 8 : w === 'smg' ? 40 : 24;
      P.ammo[w] = (P.ammo[w] || 0) + n;
      HUD.help(`${WEAPONS[w].name} o'qi +${n}`);
    }
    SFX.coin();
    return true;
  },
};
