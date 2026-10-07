'use strict';
// ===== Vazifalar: yetkazib berish, poyga, politsiyadan qochish =====
const MARKER_MAT = new THREE.MeshBasicMaterial({ color: 0xffc83d, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });
const BEACON_MAT = new THREE.MeshBasicMaterial({ color: 0xffc83d, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide });

const Missions = {
  givers: [], active: null, beacon: null, done: 0,
  init(scene) {
    const defs = [
      { blk: [2, 5], who: 'Akmal aka', type: 'deliver', title: 'Yetkazib berish' },
      { blk: [5, 5], who: 'Malika', type: 'race', title: 'Ko\'cha poygasi' },
      { blk: [5, 1], who: 'Bobur', type: 'escape', title: 'Katta ta\'qib' },
    ];
    for (const d of defs) {
      const b = World.blocks[d.blk[0]][d.blk[1]], x = b.x0 + 2, z = b.cz + 6;
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 1.2, 24, 1, true), MARKER_MAT);
      ring.position.set(x, 0.75, z);
      const icon = new THREE.Mesh(new THREE.OctahedronGeometry(0.45), new THREE.MeshBasicMaterial({ color: 0xffc83d }));
      icon.position.set(x, 2.4, z);
      scene.add(ring, icon);
      this.givers.push({ ...d, x, z, ring, icon, cd: 0 });
    }
    this.beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 90, 20, 1, true), BEACON_MAT);
    this.beacon.visible = false;
    scene.add(this.beacon);
  },
  start(g) {
    g.cd = 25;
    if (g.type === 'deliver') {
      let tgt = null, d = 0;
      for (let k = 0; k < 60 && !tgt; k++) {
        const b = World.blocks[randi(0, CITY.N - 1)][randi(0, CITY.N - 1)];
        const x = b.x0 - 3, z = b.cz + rand(-15, 15);
        d = Math.hypot(x - g.x, z - g.z);
        if (d > 240 && d < 480) tgt = { x, z };
      }
      if (!tgt) { tgt = { x: -g.x, z: -g.z }; d = Math.hypot(2 * g.x, 2 * g.z); }
      const place = districtAt(tgt.x, tgt.z) + ' garaji';
      this.active = { type: 'deliver', x: tgt.x, z: tgt.z, r: 7, time: Math.round(d / 9 + 30), reward: 300 + Math.round(d / 20) * 10,
        text: `Mashinani <em>${place}</em>ga yetkazib bor` };
      HUD.help(`<b>${g.who}:</b> Menga mashina kerak, tezroq. Har qanday mashinani olib, ${place}ga olib bor.`, 7);
    } else if (g.type === 'race') {
      const m = Race.start(g);
      if (!m) return;
      this.active = { ...m, idx: 0 };
    } else {
      setWanted(Math.max(3, Game.wanted));
      this.active = { type: 'escape', time: null, reward: 750 };
      HUD.help(`<b>${g.who}:</b> Politsiya seni qidiryapti. Ko'zdan yo'qol, yulduzlar o'chguncha qoch!`, 7);
    }
  },
  update(dt) {
    const P = Player, t = Game.time;
    for (const g of this.givers) {
      g.icon.rotation.y += dt * 2; g.icon.position.y = 2.4 + Math.sin(t * 2) * 0.2;
      g.cd = Math.max(0, g.cd - dt);
      const vis = !this.active && g.cd <= 0;
      g.ring.visible = g.icon.visible = vis;
      const r = P.inCar ? 4 : 1.6;
      if (vis && !P.dead && dist2(g.x, g.z, P.x, P.z) < r * r) this.start(g);
    }
    const m = this.active;
    this.beacon.visible = false;
    if (!m) { HUD.objective(null); HUD.timer(null); return; }
    if (m.time != null) {
      m.time -= dt; HUD.timer(m.time);
      if (m.time <= 0) return this.fail('Vaqt tugadi');
    }
    if (m.type === 'deliver') {
      HUD.objective(P.inCar ? m.text : 'Avval mashina top va <em>F</em> bilan o\'tir');
      this.showTarget(m.x, m.z);
      if (P.inCar && !P.inCar.dead && dist2(P.x, P.z, m.x, m.z) < m.r * m.r) this.pass();
    } else if (m.type === 'race') {
      const res = Race.update(dt, m), cp = Race.target(m);
      if (cp) this.showTarget(cp.x, cp.z);
      if (res === 'win') { m.reward = Race.prize(Race.r.place); m.place = Race.r.place; this.pass(); }
      else if (res === 'lose') this.fail(Player.inCar ? 'Raqiblar oldinroq keldi' : 'Mashinadan tushding');
    } else {
      HUD.objective(Game.wanted > 0 ? 'Politsiyadan qutul: ko\'zdan g\'oyib bo\'l' : '');
      if (Game.wanted === 0) this.pass();
    }
  },
  target() {
    const m = this.active;
    if (!m || m.type === 'escape') return null;
    return m.type === 'race' ? Race.target(m) : m;
  },
  showTarget(x, z) { this.beacon.visible = true; this.beacon.position.set(x, 45, z); },
  pass() {
    const m = this.active;
    this.active = null; this.done++;
    if (m.type === 'race') { Race.finish(); Stats.add('races'); if (m.place === 1) Stats.add('raceWins'); }
    Stats.add('missions'); Save.soon();
    addMoney(m.reward);
    HUD.big(m.type === 'race' ? `${m.place}-O'RIN!` : 'VAZIFA BAJARILDI', `+$${m.reward.toLocaleString('en-US')}`, 'passed');
    Game.bigT = 3.2; SFX.coin();
  },
  fail(reason, quiet) {
    if (!this.active) return;
    if (this.active.type === 'race') Race.finish();
    this.active = null;
    if (!quiet) { HUD.big('VAZIFA BARBOD BO\'LDI', reason, 'wasted'); Game.bigT = 3; }
  },
  blips() {
    const out = [];
    for (const g of this.givers) if (g.ring.visible) out.push({ x: g.x, z: g.z, color: '#ffc83d', size: 9, label: '!' });
    const t = this.target();
    if (t) out.push({ x: t.x, z: t.z, color: '#ffc83d', size: 8, edge: true, shape: 'sq' });
    return out.concat(Race.blips());
  },
};
