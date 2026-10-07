'use strict';
const _doorV = new THREE.Vector3(), _doorP = new THREE.Vector3(), _doorY = new THREE.Vector3(0, 1, 0);
// Eshik belgilari (SVG): rul, mototsikl, haydovchini tortib chiqarish
const DOOR_ICONS = {
  car: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.6"/><path d="M3.4 10.6 9.5 11.5M14.5 11.5l6.1-.9M12 14.6V21"/></svg>',
  moto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="5.5" cy="16.5" r="3.5"/><circle cx="18.5" cy="16.5" r="3.5"/><path d="M5.5 16.5 9 11h5l2.5 5.5M14 11l1.5-4H18M9 11 7.5 8H5"/></svg>',
  taken: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="5" r="2.2"/><path d="M9 8v6l-3 6M9 14l3 6M6 11h6M14 12h7M18 9l3 3-3 3"/></svg>',
};
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
    if (note) note.textContent = 'Telefonda: chapdagi joystik — yurish, mashinada — chap/o\'ng tugmalari va gaz/tormoz pedallari, ekranni surish — kamera, «Kamera» — mashina ichidan ko\'rish. O\'yin doim albom (yotiq) rejimida ochiladi.';
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
    this.btn('jump').innerHTML = car ? 'Qo\'l<br>tormoz' : 'Sakrash';
    this.btn('enter').textContent = car ? 'Tushish' : 'Minish';
    this.btn('fire').textContent = car ? 'Signal' : 'Otish';
    for (const a of ['run', 'weapon']) this.btn(a).hidden = car;
    this.btn('enter').hidden = !car; // piyodaga: har bir yaqin mashina eshigi oldida belgi (updateDoors)
    if (nitro) this.btn('weapon').hidden = true;
    this.btn('aim').hidden = !gun;
    if (!gun && this.aiming) this.setAim(false);
  },
};
