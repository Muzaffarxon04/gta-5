'use strict';
// ===== Qurollar, kiyimlar va do'konlar =====
const WEAPONS = {
  fist:    { name: 'Mushtlar', melee: true, dmg: 14, range: 1.8 },
  bat:     { name: 'Bita', melee: true, dmg: 34, range: 2.3 },
  pistol:  { name: 'To\'pponcha', dmg: 22, cd: 0.2, spread: 0, pellets: 1, give: 24, sound: 0.6 },
  shotgun: { name: 'Drobovik', dmg: 13, cd: 0.85, spread: 0.07, pellets: 7, give: 12, sound: 0.95, kick: 0.05 },
  smg:     { name: 'Avtomat', dmg: 15, cd: 0.085, spread: 0.022, pellets: 1, auto: true, give: 60, sound: 0.42, kick: 0.008 },
};
const WEAPON_ORDER = ['fist', 'bat', 'pistol', 'shotgun', 'smg'];
const WEAPON_MAT = new THREE.MeshLambertMaterial({ vertexColors: true });
// Qurol modellari: bilak suyagi bo'ylab (nishonga olganda oldinga qaraydi)
const WEAPON_GEO = {
  bat: () => mergeParts([{ geo: new THREE.CylinderGeometry(0.045, 0.026, 0.82, 8).translate(0, -0.66, 0.03), color: 0x9a6b45 }]),
  pistol: () => mergeParts([[0.035, 0.2, 0.06, 0, -0.37, 0.03, 0x151515], [0.03, 0.06, 0.1, 0, -0.3, -0.02, 0x2a2a2a]]),
  shotgun: () => mergeParts([[0.045, 0.62, 0.05, 0, -0.55, 0.03, 0x1a1a1a], [0.06, 0.32, 0.07, 0, -0.34, 0.03, 0x6d4c2e]]),
  smg: () => mergeParts([[0.05, 0.44, 0.08, 0, -0.45, 0.04, 0x1d1e20], [0.04, 0.05, 0.16, 0, -0.42, -0.05, 0x1d1e20], [0.035, 0.12, 0.05, 0, -0.62, 0.02, 0x333333]]),
};
const _wgeo = {};
function updateWeaponModel() {
  const P = Player;
  if (!P.gun) P.gun = new THREE.Mesh(new THREE.BufferGeometry(), WEAPON_MAT);
  if (P.gun.parent !== P.hm.b.faR) P.hm.b.faR.add(P.gun);
  if (P.weapon !== 'fist') P.gun.geometry = _wgeo[P.weapon] || (_wgeo[P.weapon] = WEAPON_GEO[P.weapon]());
  P.gun.visible = P.weapon !== 'fist';
}
function usable(id) { const P = Player; return P.owned[id] && (WEAPONS[id].melee || P.ammo[id] > 0); }
function selectWeapon(id) {
  if (!Player.owned[id]) return;
  if (!usable(id)) { HUD.help(`${WEAPONS[id].name} uchun o'q yo'q. Qurol do'konidan sotib oling.`, 3); return; }
  Player.weapon = id; updateWeaponModel();
}
function cycleWeapon(dir) {
  const list = WEAPON_ORDER.filter(usable), i = list.indexOf(Player.weapon);
  Player.weapon = list[(i + dir + list.length) % list.length] || 'fist';
  updateWeaponModel();
}

// ===== O'yinchi kiyimlari =====
const PLAYER_BASE = { sex: 'm', skin: 0xd8a47c, hair: 0x15100e, hairStyle: 'short', build: 1.06, height: 1.02, beard: true };
const CLOTHES = [
  { id: 'default', label: 'Charm kurtka', desc: 'Qora kurtka, oq futbolka, jinsi', price: 0,
    o: { outfit: 'jacket', jacket: 0x1d1d1f, shirt: 0xf2f2f2, sleeves: 'long', pants: 0x2a4a72, shoes: 0xe8e8e8 } },
  { id: 'summer', label: 'Yozgi kiyim', desc: 'Oq futbolka, jinsi va kepka', price: 120,
    o: { outfit: 'casual', top: 0xffffff, sleeves: 'short', pants: 0x2a4a72, shoes: 0xe8e8e8, hat: 'cap', hatColor: 0x1c1c1c } },
  { id: 'sport', label: 'Sport kostyum', desc: 'Ko\'k sport kostyum va oq krossovka', price: 250,
    o: { outfit: 'jacket', jacket: 0x1565c0, shirt: 0xffffff, sleeves: 'long', pants: 0x1565c0, shoes: 0xffffff } },
  { id: 'red', label: 'Qizil kurtka', desc: 'Qizil kurtka, qora shim', price: 300,
    o: { outfit: 'jacket', jacket: 0xb71c1c, shirt: 0x1c1c1c, sleeves: 'long', pants: 0x1b1b1d, shoes: 0x111111 } },
  { id: 'chapon', label: 'Chopon va do\'ppi', desc: 'Milliy chopon, belbog\' va Chust do\'ppisi', price: 450,
    o: { outfit: 'chapon', pal: [0x1a237e, 0x6a1b9a, 0x00897b], sash: 0xc62828, hat: 'doppi', sleeves: 'long', pants: 0x1d1d1f, shoes: 0x111111 } },
  { id: 'suit', label: 'Klassik kostyum', desc: 'Qora kostyum va bo\'yinbog\'', price: 600,
    o: { outfit: 'suit', jacket: 0x1c1f26, pants: 0x1c1f26, shirt: 0xf4f4f4, tie: 0x7a1f2b, sleeves: 'long', shoes: 0x111111 } },
];
function playerOutfit(id) {
  const c = CLOTHES.find(k => k.id === id) || CLOTHES[0];
  return Object.assign({}, PLAYER_BASE, c.o);
}
function setPlayerOutfit(id) {
  const P = Player, old = P.hm, parent = old.g.parent, hm = makeHuman(playerOutfit(id));
  hm.g.position.copy(old.g.position); hm.g.rotation.copy(old.g.rotation);
  if (parent) { parent.remove(old.g); parent.add(hm.g); }
  old.mesh.geometry.dispose();
  P.hm = hm; P.outfitId = id;
  updateWeaponModel();
}

const GUN_ITEMS = [
  { id: 'bat', label: 'Bita', desc: 'Kuchli zarba, o\'q kerak emas', price: 150, weapon: 'bat' },
  { id: 'pistol', label: 'To\'pponcha', desc: '24 ta o\'q bilan', price: 300, weapon: 'pistol' },
  { id: 'shotgun', label: 'Drobovik', desc: 'Yaqin masofada juda kuchli, 12 ta o\'q', price: 1000, weapon: 'shotgun' },
  { id: 'smg', label: 'Avtomat', desc: 'Tugmani bosib tursangiz uzluksiz otadi, 60 ta o\'q', price: 1500, weapon: 'smg' },
  { id: 'ammo-pistol', label: 'To\'pponcha o\'qi', desc: '24 dona', price: 60, ammo: 'pistol', n: 24 },
  { id: 'ammo-shotgun', label: 'Drobovik o\'qi', desc: '12 dona', price: 120, ammo: 'shotgun', n: 12 },
  { id: 'ammo-smg', label: 'Avtomat o\'qi', desc: '60 dona', price: 150, ammo: 'smg', n: 60 },
  { id: 'armor', label: 'Bronejilet', desc: 'Zirhni 100% gacha to\'ldiradi', price: 250, armor: true },
];

// Choyxona taomlari
const TEA_ITEMS = [
  { id: 'choy', label: 'Ko\'k choy', desc: 'Bir choynak, +15 sog\'liq', price: 3, hp: 15 },
  { id: 'non', label: 'Non va qatiq', desc: '+25 sog\'liq', price: 5, hp: 25 },
  { id: 'somsa', label: 'Tandir somsa', desc: '+35 sog\'liq', price: 8, hp: 35 },
  { id: 'lagmon', label: 'Lag\'mon', desc: '+60 sog\'liq', price: 12, hp: 60 },
  { id: 'osh', label: 'Osh (palov)', desc: 'Sog\'liqni to\'liq tiklaydi', price: 18, hp: 100 },
];
// Metro: qorong'ilashib, boshqa bekatda paydo bo'lish
function metroTravel(st) {
  const fade = document.getElementById('fade'), P = Player;
  fade.classList.add('on'); SFX.metro(); Stats.add('metro'); Save.soon();
  setTimeout(() => {
    P.x = st.x + st.nx * 1.8; P.z = st.z + st.nz * 1.8; P.y = groundH(P.x, P.z); P.vx = P.vz = P.vy = 0;
    P.h = Game.camYaw = Math.atan2(st.nx, st.nz);
    const place = Shops.list.find(s => s.station === st);
    if (place) place.lock = true;
    fade.classList.remove('on');
    HUD.help(`<b>${st.name}</b> bekati`, 3);
  }, 1100);
}

// ===== Do'konlar =====
const Shops = {
  list: [], open: null, el: {},
  init(scene) {
    const defs = [
      { kind: 'gun', title: 'Qurol do\'koni', sign: 'QUROL DO\'KONI', blk: [3, 3], east: true, color: '#b8322c', blip: '#ef4b46', label: 'Q' },
      { kind: 'clothes', title: 'Kiyim do\'koni', sign: 'KIYIM DO\'KONI', blk: [4, 3], east: false, color: '#6f45b8', blip: '#b36bff', label: 'K' },
    ];
    const postMat = new THREE.MeshLambertMaterial({ color: 0x2a2b2e });
    for (const d of defs) {
      const b = World.blocks[d.blk[0]][d.blk[1]], x = d.east ? b.x1 - 2 : b.x0 + 2, z = b.cz + 6;
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.9, 24, 1, true),
        new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }));
      ring.position.set(x, 0.6, z);
      // Peshlavha
      const c = document.createElement('canvas'); c.width = 512; c.height = 128;
      const g = c.getContext('2d');
      g.fillStyle = d.color; g.fillRect(0, 0, 512, 128);
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 6; g.strokeRect(9, 9, 494, 110);
      let fs = 64;
      do { g.font = `bold ${fs}px "Arial Black", Arial, sans-serif`; fs -= 2; } while (g.measureText(d.sign).width > 460);
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(d.sign, 256, 68);
      const sx = d.east ? x - 1.8 : x + 1.8;
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), side: THREE.DoubleSide }));
      sign.position.set(sx, 3.6, z); sign.rotation.y = d.east ? Math.PI / 2 : -Math.PI / 2;
      scene.add(ring, sign);
      for (const o of [-1.9, 1.9]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.1, 6), postMat);
        post.position.set(sx, 1.55, z + o); scene.add(post);
      }
      this.list.push({ ...d, x, z, ring, lock: false });
    }
    // Choyxona va metro bekatlari (landmarks.js joylashtirgan)
    const ringAt = (color, x, z) => {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.9, 24, 1, true),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }));
      r.position.set(x, groundH(x, z) + 0.45, z); scene.add(r); return r;
    };
    if (Landmarks.tea) { const t = Landmarks.tea; this.list.push({ kind: 'tea', title: 'Choyxona', x: t.x, z: t.z, ring: ringAt('#d9a441', t.x, t.z), lock: false, noBlip: true }); }
    for (const m of Landmarks.metro) this.list.push({ kind: 'metro', title: `${m.name} bekati`, station: m, x: m.x, z: m.z, ring: ringAt('#2f7fe0', m.x, m.z), lock: false, noBlip: true });
    for (const id of ['shop', 'shopTitle', 'shopKind', 'shopMoney', 'shopList', 'shopMsg', 'shopClose']) this.el[id] = document.getElementById(id);
    this.el.shopClose.addEventListener('click', () => this.close());
    this.el.shopList.addEventListener('click', e => { const b = e.target.closest('button[data-id]'); if (b) this.buy(b.dataset.id); });
    addEventListener('keydown', e => { if (e.code === 'Escape' && this.open) this.close(); });
  },
  update(dt) {
    const P = Player;
    for (const s of this.list) {
      s.ring.rotation.y += dt;
      const d = dist2(s.x, s.z, P.x, P.z);
      if (s.lock && d > 9) s.lock = false;
      const carOk = s.kind === 'garage' && P.inCar && P.inCar.speed < 3;
      if (!this.open && !s.lock && (!P.inCar || carOk) && !P.dead && d < (carOk ? 10.5 : 3.2)) this.show(s);
    }
  },
  show(s) {
    this.open = s; s.lock = true; Game.shopOpen = true;
    if (Input.locked && document.exitPointerLock) document.exitPointerLock();
    Input.keys = {}; Input.mouseL = Input.mouseR = false;
    SFX.mute(); SFX.door();
    this.el.shopTitle.textContent = s.title;
    this.el.shopKind.textContent = { gun: 'Qurol va o\'q-dori', clothes: 'Kiyim-kechak', tea: 'Taomlar', metro: 'Toshkent metrosi · jeton $5', garage: 'Saqlash va tyuning' }[s.kind];
    this.el.shopMsg.textContent = '';
    this.el.shop.hidden = false;
    TouchUI.show(false);
    this.render();
    const first = this.el.shopList.querySelector('button:not([disabled])') || this.el.shopClose;
    first.focus();
  },
  close() {
    if (!this.open) return;
    this.open = null; Game.shopOpen = false;
    this.el.shop.hidden = true;
    TouchUI.show(true);
    requestLock();
  },
  items() {
    const k = this.open.kind;
    if (k === 'gun') return GUN_ITEMS;
    if (k === 'clothes') return CLOTHES;
    if (k === 'tea') return TEA_ITEMS;
    if (k === 'garage') return Garage.items();
    return Landmarks.metro.filter(m => m !== this.open.station)
      .map(m => ({ id: m.name, label: m.name, desc: districtAt(m.x, m.z) + ' tumani', price: 5, station: m }));
  },
  state(it) {
    const P = Player, afford = P.money >= it.price;
    if (this.open.kind === 'garage') return Garage.state(it);
    if (this.open.kind === 'tea') return P.hp >= 100 ? { text: 'Sog\'liq to\'la', disabled: true, afford: true } : { text: 'Buyurtma', disabled: !afford, afford };
    if (this.open.kind === 'metro') return { text: 'Borish', disabled: !afford, afford };
    if (this.open.kind === 'clothes') {
      if (P.outfitId === it.id) return { text: 'Kiyilgan', disabled: true, afford: true };
      if (P.clothes[it.id]) return { text: 'Kiyish', disabled: false, afford: true };
      return { text: 'Sotib olish', disabled: !afford, afford };
    }
    if (it.weapon && P.owned[it.weapon]) return { text: 'Sizda bor', disabled: true, afford: true };
    if (it.ammo && !P.owned[it.ammo]) return { text: 'Qurol yo\'q', disabled: true, afford };
    if (it.armor && P.armor >= 100) return { text: 'To\'la', disabled: true, afford: true };
    return { text: 'Sotib olish', disabled: !afford, afford };
  },
  render() {
    const P = Player;
    this.el.shopMoney.textContent = '$' + P.money.toLocaleString('en-US');
    this.el.shopList.innerHTML = this.items().map(it => {
      if (it.colors) {
        const ok = P.money >= it.price;
        return `<div class="shop-item"><div class="shop-info"><b>${it.label}</b><span>${it.desc}</span></div><div class="shop-price${ok ? '' : ' no'}">$${it.price}</div>` +
          `<div class="swatches">${PAINTS.map(c => `<button type="button" class="sw" data-id="paint:${c}" style="background:#${c.toString(16).padStart(6, '0')}" aria-label="Rang"${ok ? '' : ' disabled'}></button>`).join('')}</div></div>`;
      }
      const st = this.state(it);
      const extra = it.ammo ? ` · sizda ${P.ammo[it.ammo] || 0}` : '';
      return `<div class="shop-item"><div class="shop-info"><b>${it.label}</b><span>${it.desc}${extra}</span></div>` +
        `<div class="shop-price${st.afford ? '' : ' no'}">${it.price ? '$' + it.price.toLocaleString('en-US') : 'Bepul'}</div>` +
        `<button type="button" class="shop-buy" data-id="${it.id}"${st.disabled ? ' disabled' : ''}>${st.text}</button></div>`;
    }).join('');
  },
  buy(id) {
    if (this.open.kind === 'garage') {
      const msg = Garage.buy(id);
      if (msg && this.open) { this.el.shopMsg.textContent = msg; this.render(); }
      return;
    }
    const P = Player, it = this.items().find(i => i.id === id);
    if (!it || this.state(it).disabled) return;
    if (this.open.kind === 'metro') { addMoney(-it.price); this.close(); metroTravel(it.station); return; }
    if (this.open.kind === 'tea') {
      addMoney(-it.price); P.hp = Math.min(100, P.hp + it.hp);
      if (it.id === 'osh') Stats.add('osh');
      this.el.shopMsg.textContent = `${it.label} — yoqimli ishtaha!`;
      SFX.coin(); this.render(); return;
    }
    if (this.open.kind === 'clothes') {
      if (!P.clothes[it.id]) { addMoney(-it.price); P.clothes[it.id] = true; }
      setPlayerOutfit(it.id);
      this.el.shopMsg.textContent = `${it.label} kiyildi`;
    } else {
      addMoney(-it.price);
      if (it.weapon) {
        const W = WEAPONS[it.weapon];
        P.owned[it.weapon] = true;
        if (W.give) P.ammo[it.weapon] = (P.ammo[it.weapon] || 0) + W.give;
        P.weapon = it.weapon; updateWeaponModel();
        this.el.shopMsg.textContent = `${it.label} sotib olindi. Raqam tugmalari yoki g'ildirak bilan tanlang.`;
      } else if (it.ammo) {
        P.ammo[it.ammo] = (P.ammo[it.ammo] || 0) + it.n;
        this.el.shopMsg.textContent = `+${it.n} ta o'q`;
      } else if (it.armor) {
        P.armor = 100;
        this.el.shopMsg.textContent = 'Bronejilet kiyildi';
      }
    }
    SFX.coin();
    this.render();
  },
  blips() { return this.list.filter(s => !s.noBlip).map(s => ({ x: s.x, z: s.z, color: s.blip, size: 8, label: s.label })); },
};
