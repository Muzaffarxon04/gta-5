'use strict';
const _doorV = new THREE.Vector3(), _doorP = new THREE.Vector3(), _doorY = new THREE.Vector3(0, 1, 0);
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
    else if (act === 'enter' || act === 'door') { if (down) Input.pressed.KeyF = true; }
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
  // "Minish" tugmasi faqat mashina yonida, uning eshigi turgan joyda (ekranda) chiqadi
  updateDoor() {
    const P = Player, b = this.door || (this.door = this.btn('door'));
    const c = !P.inCar && !P.dead ? nearestCar(4.2) : null;
    if (c) {
      // Eshik: o'yinchi turgan tomonda, haydovchi o'rindig'i ro'parasida
      const T = c.T, l = carLocal(c, P.x, P.z), s = l.r > 0 ? -1 : 1;
      _doorV.set(s * (T.kind === 'moto' ? 0.45 : T.w / 2 + 0.1), T.kind === 'moto' ? 0.85 : Math.min(1.1, T.H * 0.62), T.seat.z + 0.1)
        .applyAxisAngle(_doorY, c.h).add(_doorP.set(c.x, c.y, c.z)).project(camera);
      const W = innerWidth, H = innerHeight;
      if (_doorV.z < 1) {
        b.style.left = clamp((_doorV.x + 1) / 2 * W, 50, W - 50) + 'px';
        b.style.top = clamp((1 - _doorV.y) / 2 * H, 60, H - 50) + 'px';
        b.textContent = c.driver ? 'Tushirish' : 'Minish';
      } else b.style.left = b.style.top = '50%';
    }
    b.hidden = !c;
  },
  update() {
    if (!this.root || this.root.hidden) return;
    this.updateDoor();
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
    this.btn('enter').hidden = !car; // piyodaga "Minish" mashina eshigi yonida chiqadi
    if (nitro) this.btn('weapon').hidden = true;
    this.btn('aim').hidden = !gun;
    if (!gun && this.aiming) this.setAim(false);
  },
};
