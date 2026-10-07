'use strict';
// ===== Garaj va tyuning: mashinani saqlash, bo'yash, dvigatel, shinalar, zirh, nitro =====
const PAINTS = [0xf3f3f0, 0x1b1c1f, 0xb9bcc0, 0x8a1c26, 0xc62828, 0x1565c0, 0x274a7a, 0x2e7d32, 0xf9a825, 0xff6f00, 0x6a1b9a, 0xec407a];
function carMods(c) { return c.mods || (c.mods = { eng: 0, grip: 0, armor: false, nitro: false }); }
function paintable(c) { const M = c.T.model && MODELS[c.T.model]; return !M || M.paint; }
function paintCar(c, col) {
  if (Cockpit.car === c) Cockpit.detach(); // ichki ko'rinish materiallarini avval qaytaramiz
  c.color = col;
  if (c.T.model && MODELS[c.T.model]) c.body.traverse(o => { if (o.isMesh && o.userData.paint) o.material = paintMat(col); });
  else c.body.geometry = carGeo(c.type, col);
}
function applyMods(c, mods) {
  c.mods = Object.assign({ eng: 0, grip: 0, armor: false, nitro: false }, mods);
  c.maxHp = c.T.hp * (c.mods.armor ? 1.6 : 1); c.hp = c.maxHp;
}
function tuneDesc(m) {
  const parts = [];
  if (m && m.eng) parts.push(`dvigatel ${m.eng}`);
  if (m && m.grip) parts.push(`shinalar ${m.grip}`);
  if (m && m.armor) parts.push('zirh');
  if (m && m.nitro) parts.push('nitro');
  return parts.length ? 'Tyuning: ' + parts.join(', ') : 'Tyuningsiz';
}

const Garage = {
  slots: [], spot: null, nitro: 1, boosting: false,
  init(scene) {
    const b = World.blocks[3][5], gx = b.cx - 15.25, gz = b.z0 + 11.5;
    const P = [
      [22.5, 5.5, 9, gx, 2.9, gz, 0x5f6368], [23, 0.4, 9.6, gx, 5.85, gz, 0x3c4043],
      [22.6, 0.6, 0.15, gx, 4.3, gz - 4.55, 0xff8f00],
    ];
    for (const o of [-7.2, 0, 7.2]) {
      P.push([5.6, 3.7, 0.1, gx + o, 2.0, gz - 4.53, 0x9aa0a6]);
      for (let k = 0; k < 6; k++) P.push([5.6, 0.05, 0.12, gx + o, 0.5 + k * 0.6, gz - 4.56, 0x70757a]);
    }
    addMerged(scene, P);
    addCollider(gx - 11.25, gz - 4.5, gx + 11.25, gz + 4.5, 6, 'building');
    const sign = signMesh('GARAJ · TUNING', 7, 1.0, '#e65100');
    sign.position.set(gx, 5.0, gz - 4.62); sign.rotation.y = Math.PI; scene.add(sign);
    this.spot = { x: gx, z: b.z0 + 4.2 };
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.9, 28, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xff8f00, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide }));
    ring.position.set(this.spot.x, groundH(this.spot.x, this.spot.z) + 0.45, this.spot.z); scene.add(ring);
    Shops.list.push({ kind: 'garage', title: 'Garaj va tyuning', x: this.spot.x, z: this.spot.z, ring, lock: false, noBlip: true });
  },
  blips() { return this.spot ? [{ x: this.spot.x, z: this.spot.z, color: '#ff8f00', size: 8, label: 'G' }] : []; },
  items() {
    const c = Player.inCar, out = [];
    if (c && !c.dead) {
      const m = carMods(c);
      out.push({ id: 'repair', label: 'Ta\'mirlash', desc: `Holati: ${Math.round(c.hp / c.maxHp * 100)}%${c.dented ? ', kuzov ezilgan' : ''}${c.lampBroken ? ', chiroq singan' : ''}`, price: 50 });
      if (paintable(c)) out.push({ id: 'paint', label: 'Bo\'yash', desc: 'Rangni tanlang', price: 120, colors: true });
      if (m.eng < 3) out.push({ id: 'eng', label: `Dvigatel · ${m.eng + 1}-daraja`, desc: 'Tezlik +12%, tezlanish +18%', price: [400, 800, 1400][m.eng] });
      if (m.grip < 2) out.push({ id: 'grip', label: `Sport shinalar · ${m.grip + 1}-daraja`, desc: 'Yo\'lni 12% yaxshiroq ushlaydi', price: [300, 600][m.grip] });
      if (!m.armor) out.push({ id: 'armor', label: 'Zirhli kuzov', desc: 'Mashina 60% chidamliroq', price: 600 });
      if (!m.nitro) out.push({ id: 'nitro', label: 'Nitro', desc: 'N tugmasi — 3 soniyalik kuchli tezlanish', price: 750 });
      if (c.T.plate) out.push({ id: 'plate', label: 'O\'z davlat raqamingiz', desc: `Istalgan harf va raqamlar · hozirgi: ${c.plate || '—'}`, price: 50, plateInput: true });
      if (c.type !== 'police' && c.type !== 'bus') out.push({ id: 'store', label: 'Garajda saqlash', desc: `${c.T.name} · joy ${this.slots.length}/4`, price: 0 });
    }
    this.slots.forEach((s, k) => out.push({ id: 'take' + k, label: CAR_TYPES[s.type].name, desc: (s.plate ? s.plate + ' · ' : '') + tuneDesc(s.mods), price: 0, take: k }));
    if (!out.length) out.push({ id: 'none', label: 'Garaj bo\'sh', desc: 'Mashinada keling: tyuning qilish yoki saqlash uchun', price: 0, info: true });
    return out;
  },
  state(it) {
    const c = Player.inCar, afford = Player.money >= it.price;
    if (it.info) return { text: '—', disabled: true, afford: true };
    if (it.id === 'repair') return c.hp >= c.maxHp - 0.5 && !c.dented && !c.lampBroken ? { text: 'Butun', disabled: true, afford: true } : { text: 'Ta\'mirlash', disabled: !afford, afford };
    if (it.id === 'store') return this.slots.length >= 4 ? { text: 'Joy yo\'q', disabled: true, afford: true } : { text: 'Saqlash', disabled: false, afford: true };
    if (it.take != null) return { text: 'Olib chiqish', disabled: false, afford: true };
    if (it.plateInput) return { text: 'Yozish', disabled: !afford, afford };
    return { text: 'O\'rnatish', disabled: !afford, afford };
  },
  buy(id) {
    const P = Player, c = P.inCar;
    if (id.startsWith('paint:')) {
      if (P.money < 120) return;
      addMoney(-120); paintCar(c, +id.slice(6)); SFX.coin();
      return 'Mashina bo\'yaldi';
    }
    const it = this.items().find(i => i.id === id);
    if (!it || this.state(it).disabled) return;
    if (it.take != null) { this.take(it.take); return null; }
    if (id === 'plate') {
      const reg = document.getElementById('plateReg'), txt = document.getElementById('plateText');
      const plate = reg && txt && customPlate(reg.value, txt.value);
      if (!plate) return 'Raqamga kamida bitta harf yoki son yozing';
      if (plate === c.plate) return 'Mashinada allaqachon shu raqam';
      addMoney(-it.price); SFX.coin();
      c.setPlate(plate); Save.soon();
      return `Yangi raqam: ${plate}`;
    }
    if (id === 'store') { this.store(); return null; }
    addMoney(-it.price); SFX.coin();
    const m = c && carMods(c);
    if (id === 'repair') { c.hp = c.maxHp; c.onFire = false; c.fixBody(); return 'Mashina ta\'mirlandi'; }
    if (id === 'eng') m.eng++;
    if (id === 'grip') m.grip++;
    if (id === 'armor') { m.armor = true; c.maxHp = c.T.hp * 1.6; c.hp = Math.min(c.maxHp, c.hp + c.T.hp * 0.6); }
    if (id === 'nitro') { m.nitro = true; this.nitro = 1; }
    if (m.eng === 3 && m.grip === 2 && m.armor && m.nitro && !c.fullTuned) { c.fullTuned = true; Stats.add('fullTune'); }
    Save.soon();
    return `${it.label} o'rnatildi`;
  },
  store() {
    const P = Player, c = P.inCar;
    this.slots.push({ type: c.type, color: c.color, mods: carMods(c), plate: c.plate });
    exitCar();
    c.remove(); Game.cars.splice(Game.cars.indexOf(c), 1);
    P.x = this.spot.x + 2.5; P.z = this.spot.z - 1;
    Shops.close(); Save.soon();
    HUD.help(`${c.T.name} garajga qo'yildi.`, 3);
  },
  take(k) {
    const s = this.slots.splice(k, 1)[0], P = Player;
    Shops.close();
    if (P.inCar) exitCar();
    const others = Game.cars.filter(o => dist2(o.x, o.z, this.spot.x, this.spot.z) < 16);
    for (const o of others) { o.x -= 6; }
    const c = new Car(s.type, this.spot.x, this.spot.z, Math.PI, 'parked', s.color);
    applyMods(c, s.mods);
    if (s.plate) c.setPlate(s.plate);
    c.persist = true; c.mine = true; Game.cars.push(c);
    enterCar(c);
    Save.soon();
    HUD.help(`${c.T.name} garajdan chiqarildi. Keyin yana garajda saqlashni unutmang!`, 4);
  },
  // Nitro: N tugmasi (geympadda B) — 3 soniyalik zaxira, 15 soniyada to'ladi
  update(dt) {
    const c = Player.inCar, el = document.getElementById('nitroWrap');
    const has = c && c.mods && c.mods.nitro && !c.dead;
    if (el) el.hidden = !has;
    if (!has) { if (c) c.boost = false; this.boosting = false; return; }
    const want = kd('KeyN') && this.nitro > 0.02 && c.thr >= 0;
    if (want && !this.boosting) SFX.nitro();
    this.boosting = want; c.boost = want;
    this.nitro = clamp(this.nitro + (want ? -dt / 3 : dt / 15), 0, 1);
    if (want && Math.random() < 0.9) {
      const fx = Math.sin(c.h), fz = Math.cos(c.h), back = c.T.l / 2 + 0.2;
      FX.spawn(c.x - fx * back, c.y + 0.45, c.z - fz * back, -fx * 6 + rand(-1, 1), rand(0, 1), -fz * 6 + rand(-1, 1), 0.18, pick([0x4fc3f7, 0x81d4fa, 0xffffff]), 0.28);
    }
    const bar = document.getElementById('nitroBar');
    if (bar) bar.style.width = Math.round(this.nitro * 100) + '%';
  },
};
