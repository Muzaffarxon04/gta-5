'use strict';
const _doorV = new THREE.Vector3(), _doorP = new THREE.Vector3(), _doorY = new THREE.Vector3(0, 1, 0);
// Telefon tugmalari uchun belgilar (SVG, 24×24, rangi tugma matni rangida)
const TOUCH_ICONS = {
  pause: '<rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/>',
  weapon: '<path d="M2 7.5h18v2.2h1.2V12H11l-1 1.2V15a1 1 0 0 1-1 1H8l-1.4 4H3.4l1.5-6.2L3.6 12H2z" fill="currentColor" stroke="none"/>',
  aim: '<circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/>',
  run: '<circle cx="14.5" cy="4" r="2" fill="currentColor" stroke="none"/><path d="M13 7.5 11 13M13 7.5l-4 1.2L7 12M13 7.5l3 2.5 3-1M11 13l3 3-1 5M11 13l-3 3H4"/>',
  exit: '<path d="M14 4H6.5A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20H14"/><path d="M10 12h11M18 8.5l3.5 3.5-3.5 3.5"/>',
  punch: '<path d="M12 2.5l1.8 5.4 5.6-1.9-3.6 4.6 4.7 3.3-5.7.6.3 5.9-3.1-4.9-3.1 4.9.3-5.9-5.7-.6 4.7-3.3-3.6-4.6 5.6 1.9z"/>',
  shoot: '<path d="M2 8.5h11.5v3H8.6l-.8 1v2.3a.8.8 0 0 1-.8.8H5.3l-1 3.2H2.1l1.2-5.2L2 12z" fill="currentColor" stroke="none"/><path d="M16.5 10h5M16 6.5l4-2M16 13.5l4 2"/>',
  horn: '<path d="M3 9.5v5h3.5L12 19V5L6.5 9.5z" fill="currentColor" stroke="none"/><path d="M15.5 9a4 4 0 0 1 0 6M18.3 6.3a8 8 0 0 1 0 11.4"/>',
  jump: '<path d="M12 16V4M6.5 9.5 12 4l5.5 5.5"/><path d="M4 20.5h16"/>',
  handbrake: '<circle cx="12" cy="12" r="7"/><path d="M10.2 15.8V8.2h2.6a2.4 2.4 0 0 1 0 4.8h-2.6"/><path d="M3.2 6.5a10.5 10.5 0 0 0 0 11M20.8 6.5a10.5 10.5 0 0 1 0 11"/>',
  siren: '<path d="M7 18v-5.5a5 5 0 0 1 10 0V18"/><path d="M5 18h14v3H5z"/><path d="M12 2v2.5M4.6 5.2l1.7 1.7M19.4 5.2l-1.7 1.7M2 11.5h2.4M19.6 11.5H22"/>',
  radio: '<rect x="3" y="8" width="18" height="12" rx="2"/><circle cx="15.5" cy="14" r="3"/><path d="M6.5 12h4M6.5 15.5h4M7.5 8l9-5"/>',
  taxi: '<path d="M4 17.5h16v-4.5L17.8 9H6.2L4 13z"/><path d="M9.5 9V6.5h5V9"/><circle cx="8" cy="17.5" r="1.8"/><circle cx="16" cy="17.5" r="1.8"/>',
  nitro: '<path d="M12 22c4 0 7-2.7 7-6.6 0-3.5-2.5-5.3-3.6-8.4-1.4 2-2.3 2.7-3.4 2.7.4-3-.8-5.7-3.5-7.7 0 4.3-4.5 6.6-4.5 12.6C4 19.3 8 22 12 22z"/>',
  view: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  left: '<path d="M16 4.5 6.5 12l9.5 7.5z" fill="currentColor" stroke="none"/>',
  right: '<path d="M8 4.5 17.5 12 8 19.5z" fill="currentColor" stroke="none"/>',
  gas: '<path d="M6 13l6-6 6 6M6 19.5l6-6 6 6"/>',
  reverse: '<path d="M6 11l6 6 6-6M6 4.5l6 6 6-6"/>',
  brake: '<circle cx="12" cy="12" r="6"/><path d="M4.6 6.4a9.5 9.5 0 0 0 0 11.2M19.4 6.4a9.5 9.5 0 0 1 0 11.2M12 9v3.5"/><circle cx="12" cy="15" r=".6" fill="currentColor"/>',
  // Mashina eshigi belgilari: rul, mototsikl, haydovchini tortib chiqarish
  car: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.6"/><path d="M3.4 10.6 9.5 11.5M14.5 11.5l6.1-.9M12 14.6V21"/>',
  moto: '<circle cx="5.5" cy="16.5" r="3.5"/><circle cx="18.5" cy="16.5" r="3.5"/><path d="M5.5 16.5 9 11h5l2.5 5.5M14 11l1.5-4H18M9 11 7.5 8H5"/>',
  taken: '<circle cx="9" cy="5" r="2.2"/><path d="M9 8v6l-3 6M9 14l3 6M6 11h6M14 12h7M18 9l3 3-3 3"/>',
};
const touchIcon = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TOUCH_ICONS[k]}</svg>`;
const DOOR_ICONS = { car: touchIcon('car'), moto: touchIcon('moto'), taken: touchIcon('taken') };
// ===== Telefon uchun ekrandagi boshqaruv: joystik, kamera, tugmalar =====
const TouchUI = {
  root: null, running: false, aiming: false, _car: null,
  detect() {
    const coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
    Input.touch = !!(coarse || location.hash === '#touch');
    if (Input.touch) document.body.classList.add('touch');
    return Input.touch;
  },
  init() {
    if (!Input.touch) return;
    const root = (this.root = document.getElementById('touchUI'));
    const joy = document.getElementById('joy'), knob = document.getElementById('joyKnob'), R = 56;
    let joyId = null, camId = null, cx = 0, cy = 0, lx = 0, ly = 0;
    const move = t => {
      let dx = t.clientX - cx, dy = t.clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      Input.joy.x = dx / R; Input.joy.y = dy / R; Input.joy.active = true;
    };
    joy.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.changedTouches[0], r = joy.getBoundingClientRect();
      joyId = t.identifier; cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      move(t);
    }, { passive: false });
    // Ekranning bo'sh joyini surish — kamerani burish
    Input.canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.changedTouches[0];
      if (camId === null) { camId = t.identifier; lx = t.clientX; ly = t.clientY; }
    }, { passive: false });
    addEventListener('touchmove', e => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) move(t);
        else if (t.identifier === camId) { Input.mdx += (t.clientX - lx) * 2.2; Input.mdy += (t.clientY - ly) * 2.2; lx = t.clientX; ly = t.clientY; }
      }
      if (Game.started && !Game.paused && !Game.shopOpen) e.preventDefault();
    }, { passive: false });
    const end = e => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) { joyId = null; Input.joy.active = false; Input.joy.x = Input.joy.y = 0; knob.style.transform = ''; }
        if (t.identifier === camId) camId = null;
      }
    };
    addEventListener('touchend', end); addEventListener('touchcancel', end);
    // Har bosishda to'liq ekran va albom qulfi (Android'da telefon tik tursa ham ekran yotiq bo'ladi)
    addEventListener('touchend', goFullscreen, { passive: true });
    // Tugmalarda yozuv o'rniga belgi (nomi aria-label'da — ekran o'quvchilar uchun)
    const ICON_OF = { pause: 'pause', weapon: 'weapon', aim: 'aim', siren: 'siren', radio: 'radio', taxi: 'taxi', nitro: 'nitro', view: 'view', run: 'run',
      ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'gas', ArrowDown: 'brake' };
    const NAME_OF = { pause: 'Pauza', weapon: 'Qurolni almashtirish', aim: 'Nishonga olish', siren: 'Sirena', radio: 'Radio', taxi: 'Taksi ishi', nitro: 'Nitro',
      view: 'Mashina ichidan ko\'rish', run: 'Yugurish', ArrowLeft: 'Chapga', ArrowRight: 'O\'ngga', ArrowUp: 'Gaz', ArrowDown: 'Tormoz' };
    root.querySelectorAll('[data-act], [data-key]').forEach(b => {
      const k = b.dataset.act || b.dataset.key;
      if (ICON_OF[k]) this.setIcon(b, ICON_OF[k], NAME_OF[k]);
    });
    // Mashinada: chap/o'ng tugmalari va pedallar — klaviatura strelkalari kabi ishlaydi
    root.querySelectorAll('[data-key]').forEach(btn => {
      const code = btn.dataset.key;
      btn.addEventListener('touchstart', e => { e.preventDefault(); btn.classList.add('on'); Input.keys[code] = true; }, { passive: false });
      const up = e => { e.preventDefault(); btn.classList.remove('on'); Input.keys[code] = false; };
      btn.addEventListener('touchend', up, { passive: false });
      btn.addEventListener('touchcancel', up, { passive: false });
    });
    root.querySelectorAll('[data-act]').forEach(btn => {
      const act = btn.dataset.act;
      btn.addEventListener('touchstart', e => { e.preventDefault(); btn.classList.add('on'); this.press(act, true); }, { passive: false });
      const up = e => { e.preventDefault(); btn.classList.remove('on'); this.press(act, false); };
      btn.addEventListener('touchend', up, { passive: false });
      btn.addEventListener('touchcancel', up, { passive: false });
    });
    const note = document.getElementById('note');
    if (note) note.textContent = 'Telefonda: chapdagi joystik — yurish, mashinada — chap/o\'ng tugmalari va gaz/tormoz pedallari, ekranni surish — kamera, ko\'z belgisi — mashina ichidan ko\'rish. Barcha belgilar ☰ → Yo\'riqnoma ichida. O\'yin doim albom (yotiq) rejimida ochiladi.';
  },
  press(act, down) {
    if (act === 'fire') { Input.mouseL = down; if (down) Input.clickL = true; }
    else if (act === 'jump') { Input.keys.Space = down; if (down) Input.pressed.Space = true; }
    else if (act === 'enter') { if (down) Input.pressed.KeyF = true; }
    else if (act === 'run') { if (down) { this.running = !this.running; Input.keys.ShiftLeft = this.running; this.btn('run').classList.toggle('lock', this.running); } }
    // Nishon: bir bosish — yoqiladi, yana bosish — o'chadi (bosib turish shart emas, o'ng barmoq otish uchun bo'sh)
    else if (act === 'aim') { if (down) this.setAim(!this.aiming); }
    else if (act === 'weapon') { if (down) Input.wheel += 1; }
    else if (act === 'pause') { if (down) togglePause(); }
    else if (act === 'siren') { if (down) Input.pressed.KeyG = true; }
    else if (act === 'radio') { if (down) Input.pressed.KeyR = true; }
    else if (act === 'taxi') { if (down) Input.pressed.KeyT = true; }
    else if (act === 'nitro') Input.keys.KeyN = down;
    else if (act === 'view') { if (down) Input.pressed.KeyV = true; }
  },
  setIcon(b, k, label) {
    if (b._ic === k) return;
    b._ic = k; b.innerHTML = touchIcon(k); b.setAttribute('aria-label', label);
  },
  setAim(on) {
    this.aiming = on; Input.mouseR = on;
    this.btn('aim').classList.toggle('lock', on);
  },
  btn(act) { return this.root.querySelector(`[data-act="${act}"]`); },
  show(v) { if (this.root) this.root.hidden = !v || !Game.started || Game.paused || Game.shopOpen; },
  // Har bir yaqin (4 m ichidagi) mashinaning eshigi oldida belgi: rul — mashina, mototsikl — mototsikl,
  // qizil — ichida haydovchi bor (bossangiz tortib chiqarasiz). Bosilgan belgi aynan o'sha mashinaga o'tqazadi.
  doorBtn(i) {
    const pool = this.doors || (this.doors = []);
    if (!pool[i]) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'door-btn'; b.hidden = true;
      b.addEventListener('touchstart', e => { e.preventDefault(); if (b._car) Game.enterReq = b._car; }, { passive: false });
      document.getElementById('doorLayer').appendChild(b);
      pool[i] = b;
    }
    return pool[i];
  },
  updateDoors() {
    const P = Player, near = [];
    if (!P.inCar && !P.dead) for (const c of Game.cars) {
      const d = dist2(c.x, c.z, P.x, P.z);
      if (!c.dead && d < 4.2 * 4.2) near.push([d, c]);
    }
    near.sort((a, b) => a[0] - b[0]);
    const W = innerWidth, H = innerHeight, placed = [];
    // Boshqa tugmalar (joystik, otish va h.k.) ustiga tushmasin
    const busy = near.length ? [...this.root.querySelectorAll('.joy, .tbtn, .pause-btn')].filter(e => e.offsetParent).map(e => e.getBoundingClientRect()) : [];
    let n = 0;
    for (const [, c] of near) {
      // Eshik: o'yinchi turgan tomonda, haydovchi o'rindig'i ro'parasida
      const T = c.T, l = carLocal(c, P.x, P.z), s = l.r > 0 ? -1 : 1, moto = T.kind === 'moto';
      _doorV.set(s * (moto ? 0.45 : T.w / 2 + 0.1), moto ? 0.85 : Math.min(1.1, T.H * 0.62), T.seat.z + 0.1)
        .applyAxisAngle(_doorY, c.h).add(_doorP.set(c.x, c.y, c.z)).project(camera);
      if (_doorV.z >= 1) continue; // kamera ortida
      const x = (_doorV.x + 1) / 2 * W, y = (1 - _doorV.y) / 2 * H;
      if (x < 36 || x > W - 36 || y < 40 || y > H - 36) continue; // ekrandan tashqarida
      if (busy.some(r => x > r.left - 30 && x < r.right + 30 && y > r.top - 30 && y < r.bottom + 30)) continue;
      if (placed.some(([px, py]) => Math.hypot(px - x, py - y) < 62)) continue; // bir-birining ustiga tushmasin
      placed.push([x, y]);
      const b = this.doorBtn(n++), kind = c.driver ? 'taken' : moto ? 'moto' : 'car';
      if (b._kind !== kind) {
        b._kind = kind; b.innerHTML = DOOR_ICONS[kind];
        b.classList.toggle('taken', kind === 'taken');
        b.setAttribute('aria-label', kind === 'taken' ? 'Haydovchini tushirish' : moto ? 'Mototsiklga minish' : 'Mashinaga o\'tirish');
      }
      b._car = c; b.hidden = false;
      b.style.left = x + 'px'; b.style.top = y + 'px';
    }
    for (const b of this.doors || []) if (n-- <= 0) { b.hidden = true; b._car = null; }
  },
  update() {
    if (!this.root || this.root.hidden) return;
    this.updateDoors();
    // Tormoz pedali: mashina to'xtab turganda (yoki orqaga yurayotganda) — orqaga yurish strelkasi
    const dc = Player.inCar;
    if (dc && !Player.passenger) {
      const f = dc.fwd;
      if (this._rev ? f > 1.0 : f < 0.5) this._rev = !this._rev;
      this.setIcon(this.pedalBrake || (this.pedalBrake = this.root.querySelector('[data-key="ArrowDown"]')), this._rev ? 'reverse' : 'brake', this._rev ? 'Orqaga yurish' : 'Tormoz');
    }
    const c = Player.inCar, car = !!c, pol = car && c.type === 'police', taxi = car && c.type === 'taxi', nitro = !!(car && c.mods && c.mods.nitro);
    const driving = car && !Player.passenger;
    // Nishonga olish faqat o'qotar qurolda ishlaydi (musht va bitada kerak emas)
    const gun = !car && !WEAPONS[Player.weapon].melee;
    const key = [car, pol, taxi, nitro, driving, gun].join('|');
    if (key === this._car) return;
    this._car = key;
    // Haydaganda joystik o'rniga chap/o'ng tugmalari va gaz/tormoz pedallari
    this.root.classList.toggle('driving', driving);
    if (!driving) {
      for (const code of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) Input.keys[code] = false;
      this.root.querySelectorAll('[data-key].on').forEach(b => b.classList.remove('on'));
    }
    if (driving) { Input.joy.active = false; Input.joy.x = Input.joy.y = 0; }
    this.btn('view').hidden = !car;
    this.btn('siren').hidden = !pol;
    this.btn('radio').hidden = !car;
    this.btn('taxi').hidden = !taxi;
    this.btn('nitro').hidden = !nitro;
    this.setIcon(this.btn('jump'), car ? 'handbrake' : 'jump', car ? 'Qo\'l tormozi' : 'Sakrash');
    this.setIcon(this.btn('enter'), 'exit', 'Mashinadan tushish');
    this.setIcon(this.btn('fire'), car ? 'horn' : gun ? 'shoot' : 'punch', car ? 'Signal' : gun ? 'Otish' : 'Urish');
    for (const a of ['run', 'weapon']) this.btn(a).hidden = car;
    this.btn('enter').hidden = !car; // piyodaga: har bir yaqin mashina eshigi oldida belgi (updateDoors)
    if (nitro) this.btn('weapon').hidden = true;
    this.btn('aim').hidden = !gun;
    if (!gun && this.aiming) this.setAim(false);
  },
};
