'use strict';
// ===== Sozlamalar, geympad, menyudagi oynalar (sozlamalar va statistika) =====
const QUALITY = {
  low: { name: 'Past', ratio: 1, shadow: 0, traffic: 0.6, view: 260 },
  medium: { name: 'O\'rta', ratio: 1.25, shadow: 1024, traffic: 0.8, view: 340 },
  high: { name: 'Yuqori', ratio: 1.5, shadow: 2048, traffic: 1, view: 420 },
};
const Settings = {
  v: { quality: 'high', master: 0.8, music: 0.6, sens: 1, invertY: false, fov: 65 },
  viewDist() { return QUALITY[this.v.quality].view; },
  apply() {
    const q = QUALITY[this.v.quality] || QUALITY.high;
    if (renderer) renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.ratio));
    const sun = World.sun;
    if (sun) {
      sun.castShadow = q.shadow > 0;
      if (q.shadow && sun.shadow.mapSize.x !== q.shadow) {
        sun.shadow.mapSize.set(q.shadow, q.shadow);
        if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
      }
    }
    Game.maxTraffic = Math.round(Game.baseTraffic * q.traffic);
    Game.maxPeds = Math.round(Game.basePeds * q.traffic);
    if (camera) { camera.far = q.view + 200; camera.updateProjectionMatrix(); }
    if (SFX.out) SFX.out.gain.value = 0.95 * this.v.master;
  },
};

// ----- Geympad (Xbox/PlayStation standart sxemasi) -----
const PAD_HOLD = { 0: 'Space', 2: 'ShiftLeft', 1: 'KeyN' };
const PAD_PRESS = { 3: 'KeyF', 10: 'KeyH', 11: 'KeyG', 12: 'KeyR', 13: 'KeyO', 14: 'KeyT' };
const Pad = {
  connected: false, prev: [],
  poll() {
    const list = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (const g of list) if (g && g.connected) { gp = g; break; }
    if (!gp) { if (this.connected) { this.connected = false; Input.pad.active = false; } return; }
    if (!this.connected) { this.connected = true; if (Game.started) HUD.help('Geympad ulandi', 3); }
    const btn = i => !!(gp.buttons[i] && gp.buttons[i].pressed), val = i => (gp.buttons[i] ? gp.buttons[i].value : 0);
    const dz = a => (Math.abs(a) < 0.15 ? 0 : a);
    Input.pad = { active: true, x: dz(gp.axes[0] || 0), y: dz(gp.axes[1] || 0), rt: val(7), lt: val(6) };
    Input.mdx += dz(gp.axes[2] || 0) * 14; Input.mdy += dz(gp.axes[3] || 0) * 10;
    const now = gp.buttons.map(b => b.pressed), was = this.prev;
    const rise = i => now[i] && !was[i], fall = i => !now[i] && was[i];
    for (const [i, code] of Object.entries(PAD_HOLD)) { if (rise(i)) { Input.keys[code] = true; Input.pressed[code] = true; } if (fall(i)) Input.keys[code] = false; }
    for (const [i, code] of Object.entries(PAD_PRESS)) if (rise(i)) Input.pressed[code] = true;
    if (rise(4)) Input.wheel -= 1;
    if (rise(5)) Input.wheel += 1;
    if (btn(7) !== !!was.rt) { Input.mouseL = btn(7) || val(7) > 0.5; if (Input.mouseL) Input.clickL = true; }
    if (btn(6) !== !!was.lt) Input.mouseR = btn(6) || val(6) > 0.5;
    if (rise(9)) { if (!Game.started) startGame(); else togglePause(); }
    if (rise(8)) MapUI.toggle();
    this.prev = now; this.prev.rt = btn(7); this.prev.lt = btn(6);
  },
};
addEventListener('gamepadconnected', () => { if (Game.started) HUD.help('Geympad ulandi', 3); });

// ----- Menyudagi oyna: sozlamalar, statistika va ma'lumot -----
const GAME_VERSION = '1.0';
const Panel = {
  el: null,
  init() {
    this.el = { root: document.getElementById('panel'), title: document.getElementById('panelTitle'), kicker: document.getElementById('panelKicker'), body: document.getElementById('panelBody') };
    document.getElementById('panelClose').addEventListener('click', () => this.close());
    document.getElementById('btnSettings').addEventListener('click', () => this.settings());
    document.getElementById('btnStats').addEventListener('click', () => this.stats());
    document.getElementById('btnInfo').addEventListener('click', () => this.info());
    const saveBtn = document.getElementById('btnSave'), resetBtn = document.getElementById('btnReset');
    saveBtn.addEventListener('click', () => { saveBtn.textContent = Save.write(true) ? 'Saqlandi' : 'Saqlab bo\'lmadi'; setTimeout(() => (saveBtn.textContent = 'Saqlash'), 1600); });
    resetBtn.addEventListener('click', () => {
      if (resetBtn.dataset.sure) { Save.reset(); return; }
      resetBtn.dataset.sure = '1'; resetBtn.textContent = 'Ishonchingiz komilmi? Yana bosing';
      setTimeout(() => { delete resetBtn.dataset.sure; resetBtn.textContent = 'Yangi o\'yin'; }, 3500);
    });
    addEventListener('keydown', e => { if (e.code === 'Escape' && !this.el.root.hidden) this.close(); });
  },
  open(kicker, title, html) {
    this.el.kicker.textContent = kicker; this.el.title.textContent = title; this.el.body.innerHTML = html;
    this.el.root.hidden = false;
  },
  close() { this.el.root.hidden = true; },
  settings() {
    const v = Settings.v, q = Object.entries(QUALITY).map(([k, d]) =>
      `<button type="button" class="seg${v.quality === k ? ' on' : ''}" data-q="${k}">${d.name}</button>`).join('');
    const range = (id, label, min, max, step, val, fmt) =>
      `<label class="set-row" for="${id}"><span>${label}</span><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}"><output id="${id}Out">${fmt(val)}</output></label>`;
    this.open('O\'yin', 'Sozlamalar', `
      <div class="set-row"><span>Grafika sifati</span><div class="segs" id="setQuality">${q}</div></div>
      <p class="set-note">Sekin kompyuter yoki telefonda «Past» ni tanlang: soyalar o'chadi, mashina va odamlar kamayadi.</p>
      ${range('setMaster', 'Umumiy ovoz', 0, 1, 0.05, v.master, x => Math.round(x * 100) + '%')}
      ${range('setMusic', 'Radio musiqasi', 0, 1, 0.05, v.music, x => Math.round(x * 100) + '%')}
      ${range('setSens', 'Sichqoncha sezgirligi', 0.4, 2.5, 0.1, v.sens, x => (+x).toFixed(1) + '×')}
      ${range('setFov', 'Ko\'rish burchagi', 55, 85, 1, v.fov, x => x + '°')}
      <label class="set-row" for="setInvert"><span>Kamerani teskari (yuqori/past)</span><input type="checkbox" id="setInvert"${v.invertY ? ' checked' : ''}></label>
      <p class="set-note">Geympad: chap tayoq — yurish, o'ng tayoq — kamera, RT — otish/gaz, LT — nishon/tormoz, A — sakrash, Y — mashinaga o'tirish, B — nitro, Back — xarita, Start — pauza.</p>`);
    const b = this.el.body;
    b.querySelectorAll('[data-q]').forEach(el => el.addEventListener('click', () => {
      v.quality = el.dataset.q; b.querySelectorAll('[data-q]').forEach(x => x.classList.toggle('on', x === el)); Settings.apply(); Save.soon();
    }));
    const bind = (id, key, fmt) => {
      const inp = document.getElementById(id), out = document.getElementById(id + 'Out');
      inp.addEventListener('input', () => { v[key] = +inp.value; out.textContent = fmt(inp.value); Settings.apply(); Save.soon(); });
    };
    bind('setMaster', 'master', x => Math.round(x * 100) + '%');
    bind('setMusic', 'music', x => Math.round(x * 100) + '%');
    bind('setSens', 'sens', x => (+x).toFixed(1) + '×');
    bind('setFov', 'fov', x => x + '°');
    document.getElementById('setInvert').addEventListener('change', e => { v.invertY = e.target.checked; Save.soon(); });
  },
  info() {
    const li = a => a.map(t => `<li>${t}</li>`).join('');
    this.open('Ma\'lumot', 'Ko\'cha Qiroli', `<div class="info">
      <p class="info-lead">Toshkentdan ilhomlangan ochiq dunyo shahar o'yini. Brauzerda ishlaydi, internetsiz ham o'ynash mumkin va telefonga ilova kabi o'rnatiladi.</p>
      <h3>O'yin haqida</h3>
      <p>Siz katta shaharda erkin yurasiz: mashina haydaysiz, ish topasiz, pul ishlaysiz va politsiyadan qochasiz. Shahar kunduz va tunda, yomg'ir va qorda o'zgarib turadi, ko'chalarda odamlar, avtobuslar va svetoforlar bor.</p>
      <h3>Imkoniyatlar</h3>
      <ul>${li([
        'Teleminora, Amir Temur xiyoboni, Chorsu bozori, metro va choyxonali shahar',
        'O\'zbek mashinalari: Nexia, Cobalt, Gentra, Malibu, Spark, Matiz, Damas, Labo, Lacetti, shuningdek Mercedes, avtobus va mototsikl',
        'Vazifalar, taksi ishi, garaj va tyuning, qurol va kiyim do\'konlari',
        'Politsiya: 5 yulduzli qidiruv, yo\'l to\'siqlari va vertolyot',
        'Ob-havo (yomg\'ir, qor, tuman), kun va tun, mashinada radio',
        'Ko\'p o\'yinchi: xona kodi yoki QR-kod orqali, lokal tarmoqda',
        'O\'yinni saqlash, statistika va 13 ta yutuq; telefon va geympad bilan boshqaruv',
      ])}</ul>
      <h3>Asoschi</h3>
      <div class="info-founder">
        <div class="info-avatar" aria-hidden="true">MA</div>
        <div><b>Muzaffarxon Abdusalomov</b><span>O'yin g'oyasi muallifi va asoschisi</span>
          <div class="info-social">
            <a href="https://t.me/maxdevblog" target="_blank" rel="noopener"><span class="soc tg" aria-hidden="true"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M2.5 11.2 20.6 4.2c.8-.3 1.6.4 1.4 1.3l-3 14.1c-.2.9-1.2 1.3-2 .8l-4.6-3.4-2.3 2.2c-.4.4-1 .2-1-.4l.2-3.4 8.3-7.5-10.2 6.4-3.9-1.2c-.9-.3-.9-1.5 0-1.9z"/></svg></span>@maxdevblog</a>
            <a href="https://instagram.com/muzaffarxon_abduslomov" target="_blank" rel="noopener"><span class="soc ig" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.2" cy="6.8" r="1.2" fill="currentColor"/></svg></span>muzaffarxon_abduslomov</a>
            <a href="https://github.com/Muzaffarxon04" target="_blank" rel="noopener"><span class="soc gh" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 7 3 12l5 5M16 7l5 5-5 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>Muzaffarxon04</a>
          </div>
        </div>
      </div>
      <p>O'yin sahifasi: <a href="https://muzaffarxon04.github.io/gta-5/" target="_blank" rel="noopener">muzaffarxon04.github.io/gta-5</a> · Manba kodi: <a href="https://github.com/Muzaffarxon04/gta-5" target="_blank" rel="noopener">GitHub</a></p>
      <h3>Mualliflar va litsenziyalar</h3>
      <ul class="info-credits">${li([
        '3D grafika: <b>Three.js</b> (MIT)',
        'Shriftlar: <b>Bungee</b> va <b>Barlow Condensed</b> (SIL Open Font License 1.1)',
        'QR-kod: <b>qrcode-generator</b> — Kazuhiko Arase (MIT), <b>jsQR</b> (Apache 2.0); modellarni ochish: <b>meshoptimizer</b> (MIT)',
        'Xona kodi orqali ulanish: <b>ntfy.sh</b> xizmati',
        '3D modellar: Nexia, Cobalt, Gentra, Spark va Lacetti — <a href="https://sketchfab.com/uzbek_supra" target="_blank" rel="noopener"><i>uzb_rx7</i></a> (Sketchfab, CC BY 4.0, o\'yin uchun soddalashtirilgan); Fast Charger — <i>ergoninane</i>; politsiya mashinasi — <i>arunangshubanerjee</i>; skanerlangan odam — <i>Renderpeople</i> (rp_posed_00178_29); Mercedes-Benz GLS 580 modeli',
      ])}</ul>
      <p class="info-ver">Versiya ${GAME_VERSION} · 2026</p>
    </div>`);
  },
  stats() {
    const s = Stats.d, km = m => (m / 1000).toFixed(1) + ' km', mins = Math.floor(s.playTime / 60);
    const rows = [
      ['O\'yin vaqti', `${Math.floor(mins / 60)} soat ${mins % 60} daqiqa`], ['Mashinada', km(s.drive)], ['Piyoda', km(s.walk)],
      ['Eng yuqori tezlik', Math.round(s.topKmh) + ' km/soat'], ['Olingan mashinalar', s.stolen], ['Bajarilgan vazifalar', s.missions],
      ['Taksi yo\'lovchilari', s.fares], ['Politsiyadan qochish', `${s.escapes} marta (eng ko'pi ${s.maxEscape} yulduz)`],
      ['Ishlab topilgan pul', '$' + Math.round(s.earned).toLocaleString('en-US')], ['Metro safarlari', s.metro],
    ].map(([a, b]) => `<div class="stat-row"><span>${a}</span><b>${b}</b></div>`).join('');
    const got = ACHIEVEMENTS.filter(a => Stats.ach[a.id]).length;
    const ach = ACHIEVEMENTS.map(a => `<div class="ach${Stats.ach[a.id] ? ' got' : ''}"><b>${a.name}</b><span>${a.desc}</span></div>`).join('');
    this.open('O\'yin', 'Statistika', `${rows}<h3 class="ach-head">Yutuqlar · ${got}/${ACHIEVEMENTS.length}</h3><div class="ach-grid">${ach}</div>`);
  },
};
