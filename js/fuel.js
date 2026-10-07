'use strict';
// ===== Yoqilg'i: haydaganda bak bo'shaydi, zapravkada benzin yoki metan quyiladi, bak bo'shasa — kanistr =====
// Metan arzon, lekin navbat bor va quyish paytida hamma mashinadan tushadi (O'zbekistondagi qoida).
// Benzin qimmatroq, lekin navbatsiz va o'tirgan joyingizda quyiladi.
// tank — bak hajmi (litr / m³, narx shunga qarab), metan — gaz ballon bormi, range — to'la bak bilan necha metr yuradi.
const FUEL_CARS = {
  nexia: { tank: 50, metan: true }, cobalt: { tank: 46, metan: true }, gentra: { tank: 60, metan: true }, lacetti: { tank: 60, metan: true },
  spark: { tank: 35, metan: true }, damas: { tank: 37, metan: true }, taxi: { tank: 46, metan: true }, bus: { tank: 120, metan: true, range: 12000 },
  malibu: { tank: 70 }, police: { tank: 70 }, gls: { tank: 90, range: 7000 }, charger: { tank: 70, range: 6500 }, moto: { tank: 17, range: 7000 },
};
const FUEL_PRICE = { benzin: 0.8, metan: 0.25 }; // $ — bir litr benzin / bir m³ metan
const FUEL_RANGE = 9000, FUEL_CAN = { price: 25, add: 0.22, wait: 7 };
const FUEL_BLIP = '#26a69a';
const fuelInfo = c => FUEL_CARS[c.type] || { tank: 50 };
const fuelOn = () => Settings.v.fuel !== false;
// Bak bo'sh: dvigatel o'chgan, faqat tormoz ishlaydi (imtihonda yoqilg'i sarflanmaydi)
const fuelEmpty = c => fuelOn() && !Autodrom.active && c.fuel != null && c.fuel <= 0;
// Pul bo'yicha to'la bak narxi
const fuelFull = (c, kind) => fuelInfo(c).tank * FUEL_PRICE[kind];

const Fuel = {
  stations: [], spots: [], job: null, hint: null, action: null, lowCar: null, _w: null, _sndT: 0,
  // Kvartal ichida zapravka: shimolda benzin kolonkalari, janubda metan, burchakda do'kon va narx ustuni.
  // Mashinalar g'arbdagi ko'chadan kirib, sharqqa chiqib ketadi (kolonkalar x bo'ylab).
  build(blk, scene) {
    const { cx, cz } = blk, P = [], L = [], Y = 0.19;
    const box = (w, h, d, x, y, z, color, to = P) => to.push([w, h, d, cx + x, y, cz + z, color]);
    const WHITE = 0xf2f2f0, GREY = 0x9aa0a6, GREEN = 0x1b8f3a, BLUE = 0x1565c0, DARK = 0x15181d;
    // Soyabon: tom, rangli hoshiya, tagidagi chiroqlar (kechasi yonadi), ustunlar orolcha ustida
    const canopy = (x0, x1, z0, z1, col, islandZ) => {
      const w = x1 - x0, d = z1 - z0, mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      box(w, 0.5, d, mx, 5.3, mz, WHITE);
      box(w - 0.1, 0.02, d - 0.1, mx, 5.04, mz, 0xc9ccd0, L); // ship (soyabon tagi) — doim yorug'
      box(w + 0.2, 0.75, 0.15, mx, 5.25, z0 - 0.08, col); box(w + 0.2, 0.75, 0.15, mx, 5.25, z1 + 0.08, col);
      box(0.15, 0.75, d + 0.2, x0 - 0.08, 5.25, mz, col); box(0.15, 0.75, d + 0.2, x1 + 0.08, 5.25, mz, col);
      for (let x = x0 + 2; x < x1 - 1; x += 3.4) for (const o of [-d / 4, d / 4]) box(1.6, 0.04, 0.7, x, 5.01, mz + o, 0xfff6e0, L);
      for (const x of [x0 + 1.5, x1 - 1.5]) box(0.5, 5.1, 0.5, x, 2.65, islandZ, GREY);
      // Orolcha (kolonkalar turadigan beton yo'lak)
      box(w - 2, 0.25, 1.4, mx, Y + 0.12, islandZ, 0xd8d6cc);
      box(w - 2.1, 0.06, 1.5, mx, Y + 0.03, islandZ, 0xe0b020);
      addCollider(cx + x0 + 1, cz + islandZ - 0.7, cx + x1 - 1, cz + islandZ + 0.7, 2.2, 'prop');
    };
    // Benzin: soyabon x −19…3, z −16.5…−5.5, kolonkalar x = −14, −8, −2
    canopy(-19, 3, -16.5, -5.5, GREEN, -11);
    for (const x of [-14, -8, -2]) {
      box(1.0, 1.7, 0.6, x, Y + 1.1, -11, WHITE); box(1.02, 0.32, 0.62, x, Y + 2.0, -11, GREEN);
      for (const s of [-1, 1]) { box(0.62, 0.36, 0.02, x, Y + 1.5, -11 + s * 0.31, DARK); box(0.08, 0.7, 0.08, x + 0.42, Y + 0.9, -11 + s * 0.34, 0x111111); }
      for (const z of [-13.6, -8.4]) this.spots.push({ x: cx + x, z: cz + z, kind: 'benzin' });
    }
    // Metan (AGNKS): soyabon x −17…1, z 7…17, kolonkalar x = −12, −4
    canopy(-17, 1, 7, 17, BLUE, 12);
    for (const x of [-12, -4]) {
      box(0.8, 1.9, 0.5, x, Y + 1.2, 12, 0xe8eef5); box(0.82, 0.3, 0.52, x, Y + 2.2, 12, BLUE);
      for (const s of [-1, 1]) box(0.5, 0.3, 0.02, x, Y + 1.6, 12 + s * 0.26, DARK);
      for (const z of [9.4, 14.6]) this.spots.push({ x: cx + x, z: cz + z, kind: 'metan' });
    }
    // Kompressor bloki (metan) va do'kon
    box(6, 2.6, 3, 20, 1.45, 22, 0xbfc5cc); box(6.05, 0.4, 3.05, 20, 2.2, 22, BLUE);
    addCollider(cx + 17, cz + 20.5, cx + 23, cz + 23.5, 2.8, 'building');
    box(12, 3.8, 8, 18, Y + 1.9, -22, 0xe6e1d6); box(12.2, 0.5, 8.2, 18, Y + 3.95, -22, GREEN);
    box(9, 2.2, 0.06, 18, Y + 1.3, -17.97, 0x2c4a5e);
    addCollider(cx + 12, cz - 26, cx + 24, cz - 18, 4.3, 'building');
    // Narx ustuni (sharqdagi ko'cha tomonida)
    box(0.35, 5.2, 0.35, 25, 2.75, 2, GREY);
    addCollider(cx + 24.8, cz + 1.8, cx + 25.2, cz + 2.2, 5, 'lamp');
    addMerged(scene, P);
    const lights = new THREE.Mesh(mergeParts(L), LIGHT_MAT);
    scene.add(lights);
    (this.lampMeshes || (this.lampMeshes = [])).push(lights);
    // Yozuvlar: soyabon hoshiyasida, do'kon ustida, metan kolonkasida ogohlantirish
    const sign = (text, w, h, bg, x, y, z, rot) => { const s = signMesh(text, w, h, bg); s.position.set(cx + x, y, cz + z); s.rotation.y = rot; scene.add(s); };
    sign('BENZIN · AI-92', 9, 0.68, '#1b8f3a', -8, 5.25, -16.62, Math.PI);
    sign('BENZIN · AI-92', 9, 0.68, '#1b8f3a', -8, 5.25, -5.38, 0);
    sign('METAN · AGNKS', 8, 0.68, '#1565c0', -8, 5.25, 6.88, Math.PI);
    sign('METAN · AGNKS', 8, 0.68, '#1565c0', -8, 5.25, 17.12, 0);
    sign('DO\'KON · 24/7', 6, 0.9, '#1b8f3a', 18, Y + 3.2, -17.9, 0);
    for (const s of [-1, 1]) sign('MASHINADAN TUSHING!', 2.6, 0.42, '#c62828', -8, 2.3, 12 + s * 0.05, s > 0 ? 0 : Math.PI);
    // Narx taxtasi: ikki tomonlama, sharq va g'arbga qaragan
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 320;
    const g = cv.getContext('2d');
    g.fillStyle = '#0f1a14'; g.fillRect(0, 0, 256, 320);
    g.fillStyle = '#1b8f3a'; g.fillRect(0, 0, 256, 70);
    g.fillStyle = '#fff'; g.font = 'bold 40px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ZAPRAVKA', 128, 37);
    const row = (y, name, price, col) => {
      g.fillStyle = col; g.fillRect(14, y - 34, 228, 68);
      g.fillStyle = '#fff'; g.font = 'bold 30px Arial'; g.textAlign = 'left'; g.fillText(name, 26, y);
      g.fillStyle = '#ffd54f'; g.font = 'bold 34px Arial'; g.textAlign = 'right'; g.fillText(price, 232, y);
    };
    row(120, 'AI-92', '$0.80', '#23402d'); row(200, 'METAN', '$0.25', '#1d3550');
    g.fillStyle = '#9fb3a8'; g.font = 'bold 20px Arial'; g.textAlign = 'center'; g.fillText('1 litr / 1 m³', 128, 280);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), side: THREE.DoubleSide }));
    board.position.set(cx + 25, 6.4, cz + 2); board.rotation.y = Math.PI / 2; scene.add(board);
    this.stations.push({ blk, x: cx - 8, z: cz, metan: { x: cx - 8, z: cz + 12 } });
    Landmarks.areas.push({ b: blk, name: 'Zapravka' });
  },
  // Har zapravkada: kolonkachi va metan quyilayotgan mashina (haydovchisi qoida bo'yicha tashqarida turibdi)
  init() {
    const stand = (o, x, z, h, y) => { const hm = makeHuman(o); hm.g.position.set(x, y != null ? y : groundH(x, z), z); hm.g.rotation.y = h; poseHuman(hm, 0, 0, 0); World.scene.add(hm.g); };
    for (const s of this.stations) {
      const { cx, cz } = s.blk;
      stand(Object.assign(randomOutfit('man'), { outfit: 'casual', top: 0xff6d00, sleeves: 'long', hat: 'cap', hatColor: 0x1b8f3a }), cx - 10.8, cz - 11, Math.PI, 0.44);
      const c = new Car(pick(['nexia', 'cobalt', 'gentra', 'spark']), cx - 4, cz + 14.6, Math.PI / 2, 'parked');
      c.persist = true; c.fuel = 0.4; Game.cars.push(c);
      stand(randomOutfit(), cx - 2.4, cz + 16.6, -2.4);
    }
  },
  nearest(x, z) {
    let best = null, bd = Infinity;
    for (const s of this.stations) { const d = dist2(x, z, s.x, s.z); if (d < bd) { bd = d; best = s; } }
    return best;
  },
  // Mashina kolonka yonida turibdimi
  spotAt(c) {
    for (const s of this.spots) if (Math.abs(c.x - s.x) < 2.6 && Math.abs(c.z - s.z) < 1.5) return s;
    return null;
  },
  blips() { return this.stations.map(s => ({ x: s.x, z: s.z, color: FUEL_BLIP, size: 8, label: 'Z' })); },
  gps(msg) {
    const s = this.nearest(Player.x, Player.z);
    if (s && !MapUI.wp) { MapUI.setWaypoint({ x: s.x, z: s.z }); MapUI.update(0, true); }
    if (msg) HUD.help(msg + (s ? ' Eng yaqin zapravka xaritada belgilandi (<b>Z</b>).' : ''), 5);
  },
  // Bak sarfi: yurilgan masofa, gaz bosilgani va nitroga qarab; to'xtab turganda juda oz
  burn(c, dt) {
    const k = 0.55 + 0.6 * Math.abs(c.thr) + (c.boost ? 1.5 : 0);
    const was = c.fuel;
    c.fuel = Math.max(0, c.fuel - c.speed * dt * k / (fuelInfo(c).range || FUEL_RANGE) - dt * 0.00005);
    if (was > 0 && c.fuel === 0) { this.sputter(); this.gps('Yoqilg\'i tugadi! Dvigatel o\'chdi.'); }
    else if (was >= 0.15 && c.fuel < 0.15 && this.lowCar !== c) { this.lowCar = c; this.gps('Yoqilg\'i kam qoldi.'); }
  },
  sputter() {
    if (!SFX.ctx) return;
    const t = SFX.ctx.currentTime;
    for (let i = 0; i < 4; i++) SFX.burst(SFX.out, t + i * 0.22 + Math.random() * 0.06, 0.12, 'lowpass', 260, 0.5 - i * 0.1);
  },
  key() { return Input.touch ? '' : '<kbd>B</kbd> '; },
  update(dt) {
    const P = Player, c = P.inCar, drv = c && !P.passenger && !c.dead && c.driver === 'player';
    if (drv && c.fuel == null) c.fuel = rand(0.35, 0.9);
    if (drv && fuelOn() && !Autodrom.active && !(this.job && this.job.car === c && this.job.stage === 'fill')) this.burn(c, dt);
    let hint = null, action = null;
    if (this.job) hint = this.tick(dt);
    else if (drv && fuelOn() && !Autodrom.active) {
      const sp = this.spotAt(c);
      if (sp) {
        const I = fuelInfo(c);
        if (sp.kind === 'metan' && !I.metan) hint = `${c.T.name} metanda yurmaydi — benzin kolonkasiga boring`;
        else if (c.fuel > 0.97) hint = 'Bak to\'la';
        else if (c.speed > 1.2) hint = 'Kolonka yonida to\'xtang';
        else {
          action = sp.kind;
          const cost = Math.max(1, Math.ceil((1 - c.fuel) * fuelFull(c, sp.kind)));
          hint = `${this.key()}${sp.kind === 'metan' ? 'Metan' : 'Benzin'} quyish — to'la bak <b>$${cost}</b>` + (sp.kind === 'metan' ? ' (navbat bor)' : '');
        }
        this._sp = sp;
      } else if (c.fuel <= 0) {
        action = 'can';
        hint = `Yoqilg'i tugadi — ${this.key()}kanistr chaqirish ($${Math.min(FUEL_CAN.price, P.money)})`;
      }
    }
    this.hint = hint; this.action = action;
    this.gauge();
  },
  // B tugmasi yoki telefonda "Quyish" / "Kanistr"
  act() {
    const P = Player, c = P.inCar, a = this.action;
    if (!a || !c) return;
    if (a === 'can') {
      const price = Math.min(FUEL_CAN.price, P.money);
      this.job = { kind: 'can', car: c, t: FUEL_CAN.wait, price };
      HUD.help(price ? `Kanistr chaqirildi ($${price}). Bir oz kuting…` : 'Pulingiz yo\'q, lekin bir yaxshi odam kanistr olib kelyapti…', 3);
      return;
    }
    if (P.money < 1) { HUD.help('Yoqilg\'i uchun pulingiz yo\'q.', 2.5); return; }
    SFX.click();
    if (a === 'benzin') this.job = { kind: 'benzin', stage: 'fill', car: c, spot: this._sp, from: c.fuel, paid: 0 };
    else {
      const n = randi(1, 3);
      this.job = { kind: 'metan', stage: 'queue', car: c, spot: this._sp, from: c.fuel, paid: 0, n, t: n * 4.5 };
    }
  },
  // Quyish jarayoni — HUD uchun ko'rsatma qaytaradi
  tick(dt) {
    const J = this.job, c = J.car, P = Player;
    const end = (msg, t = 3) => { this.job = null; if (msg) HUD.help(msg, t); return null; };
    if (c.dead) return end(null);
    if (J.kind === 'can') {
      if (P.inCar !== c) return end('Kanistr bekor qilindi.');
      J.t -= dt;
      if (J.t > 0) return `Kanistr yo'lda… ${Math.ceil(J.t)} s`;
      c.fuel = Math.max(c.fuel, FUEL_CAN.add); addMoney(-J.price); SFX.coin();
      end(null); this.gps(`Kanistrdan ${Math.round(FUEL_CAN.add * 100)}% quyildi.`);
      return null;
    }
    if (Math.hypot(c.x - J.spot.x, c.z - J.spot.z) > 3.2 || c.speed > 1.2) {
      if (J.paid) return end(`Quyish to'xtatildi · $${J.paid}`);
      return end(J.kind === 'metan' ? 'Navbatdan chiqib ketdingiz.' : 'Quyish to\'xtatildi.');
    }
    if (J.stage === 'queue') {
      J.t -= dt;
      J.n = Math.max(1, Math.ceil(J.t / 4.5));
      if (J.t > 0) return `Metan navbati: oldingizda ${J.n} ta mashina · ${Math.ceil(J.t)} s`;
      J.stage = 'out'; SFX.coin();
    }
    if (J.stage === 'out') {
      if (P.inCar === c) return `Navbatingiz keldi! Qoida: metan quyishda hamma mashinadan tushadi — ${Input.touch ? 'tushish tugmasini bosing' : '<kbd>F</kbd> bilan tushing'}`;
      if (Math.hypot(P.x - c.x, P.z - c.z) > 12) return end('Navbatingiz o\'tib ketdi.');
      J.stage = 'fill';
    }
    // Quyish: pul bak to'lgan sari olinadi
    if (J.kind === 'metan' && P.inCar === c) return end(`Metan quyish to'xtatildi · $${J.paid}`);
    const full = fuelFull(c, J.kind), rate = J.kind === 'metan' ? 0.2 : 0.24;
    c.fuel = Math.min(1, c.fuel + rate * dt);
    const due = Math.ceil((c.fuel - J.from) * full - 1e-6);
    if (due > J.paid) {
      const pay = Math.min(due - J.paid, P.money);
      addMoney(-pay); J.paid += pay;
      if (P.money <= 0 && c.fuel < 1) { c.fuel = J.from + J.paid / full; return end(`Pul tugadi · ${Math.round(c.fuel * 100)}% gacha quyildi`); }
    }
    if ((this._sndT -= dt) <= 0 && SFX.ctx) { this._sndT = 0.3; SFX.burst(SFX.out, SFX.ctx.currentTime, 0.28, 'bandpass', J.kind === 'metan' ? 3200 : 900, 0.12, 1.5); }
    if (c.fuel >= 1) {
      SFX.coin(); this.lowCar = null;
      return end(`Bak to'ldi! ${J.kind === 'metan' ? 'Metan' : 'Benzin'} · $${J.paid}` + (J.kind === 'metan' ? '. Mashinaga o\'tirishingiz mumkin' : ''), 3.5);
    }
    return `${J.kind === 'metan' ? 'Metan' : 'Benzin'} quyilmoqda… ${Math.round(c.fuel * 100)}% · $${J.paid}`;
  },
  // Spidometr ostidagi bak ko'rsatkichi
  gauge() {
    const W = this._w || (this._w = { wrap: document.getElementById('fuelWrap'), bar: document.getElementById('fuelBar') });
    if (!W.wrap) return;
    const c = Player.inCar, show = !!(c && fuelOn() && c.fuel != null && !Player.passenger);
    if (W.wrap.hidden !== !show) W.wrap.hidden = !show;
    if (!show) return;
    const pct = Math.round(c.fuel * 100), low = c.fuel < 0.15;
    if (pct !== W.pct) { W.pct = pct; W.bar.style.width = pct + '%'; }
    if (low !== W.low) { W.low = low; W.wrap.classList.toggle('low', low); }
  },
};
