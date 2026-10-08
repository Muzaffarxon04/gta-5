'use strict';
// ===== Sozlamalar, geympad, menyudagi oynalar (sozlamalar va statistika) =====
const QUALITY = {
  auto: { name: 'Avto' }, // tezlikka qarab o'zi tanlaydi (AutoQuality)
  min: { name: 'Juda past', ratio: 0.75, shadow: 0, traffic: 0.45, view: 220, auto: true },
  low: { name: 'Past', ratio: 1, shadow: 0, traffic: 0.6, view: 260 },
  medium: { name: 'O\'rta', ratio: 1.25, shadow: 1024, traffic: 0.8, view: 340 },
  high: { name: 'Yuqori', ratio: 1.5, shadow: 2048, traffic: 1, view: 420 },
};
// Telefonda mashinani burish usullari
const STEER_MODES = [['arrows', 'Strelka'], ['wheel', 'Rul'], ['tilt', 'Qiyshaytirish']];
const Settings = {
  v: { quality: 'auto', qv: 2, keyHints: true, fuel: true, gearbox: 'auto', master: 0.8, music: 0.6, sens: 1, invertY: false, fov: 65, steer: 'arrows' },
  // Amaldagi sifat: "Avto" bo'lsa — AutoQuality tanlagani
  q() { const k = this.v.quality === 'auto' ? AutoQuality.level : this.v.quality; return QUALITY[k] && k !== 'auto' ? QUALITY[k] : QUALITY.high; },
  viewDist() { return this.q().view; },
  apply() {
    const q = this.q();
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

// ----- Avtomatik sifat: kadr tezligini o'lchab, qotsa pasaytiradi, bemalol bo'lsa oshiradi -----
const AQ_ORDER = ['min', 'low', 'medium', 'high'];
const AutoQuality = {
  level: 'high', acc: 0, n: 0, slowT: 0, fastT: 0, holdT: 0,
  init(touch) { this.level = touch ? 'medium' : 'high'; },
  // dt — haqiqiy kadr vaqti (cheklanmagan); faqat o'yin ketayotganda chaqiriladi
  sample(dt) {
    if (Settings.v.quality !== 'auto' || dt <= 0 || dt > 0.5) return;
    this.acc += dt; this.n++;
    if (this.acc < 1) return;
    const fps = this.n / this.acc;
    this.acc = 0; this.n = 0;
    this.holdT = Math.max(0, this.holdT - 1);
    this.slowT = fps < 27 ? this.slowT + 1 : 0;
    this.fastT = fps > 56 ? this.fastT + 1 : 0;
    const i = AQ_ORDER.indexOf(this.level);
    if (this.slowT >= 3 && i > 0) this.set(AQ_ORDER[i - 1], 20);
    else if (this.fastT >= 10 && this.holdT <= 0 && i < AQ_ORDER.length - 1) this.set(AQ_ORDER[i + 1], 45);
  },
  set(level, hold) {
    this.level = level; this.slowT = this.fastT = 0; this.holdT = hold;
    Settings.apply();
  },
};

// ----- Geympad (Xbox/PlayStation standart sxemasi) -----
const PAD_HOLD = { 0: 'Space', 2: 'ShiftLeft', 1: 'KeyN', 10: 'KeyH' };
const PAD_PRESS = { 3: 'KeyF', 11: 'KeyG', 12: 'KeyR', 14: 'KeyT', 15: 'KeyV' };
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
    // LB/RB: piyodada — qurol, mashinada — burilish chiroqlari
    const inCar = Player.inCar && !Player.passenger;
    // Mexanik uzatmada LB/RB — uzatma (past/yuqori)
    const manual = inCar && Settings.v.gearbox === 'manual';
    if (rise(4)) { if (manual) Input.pressed.KeyQ = true; else if (inCar) Input.pressed.KeyZ = true; else Input.wheel -= 1; }
    if (rise(5)) { if (manual) Input.pressed.KeyE = true; else if (inCar) Input.pressed.KeyC = true; else Input.wheel += 1; }
    if (btn(7) !== !!was.rt) { Input.mouseL = btn(7) || val(7) > 0.5; if (Input.mouseL) Input.clickL = true; }
    if (btn(6) !== !!was.lt) Input.mouseR = btn(6) || val(6) > 0.5;
    if (rise(13)) Input.pressed[Fuel.action ? 'KeyB' : 'KeyO'] = true; // D-pad pastga: zapravkada quyish, aks holda ob-havo
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
    document.getElementById('btnGuide').addEventListener('click', () => this.guide());
    // Burger menyu: bo'lim ochilganda yopiladi (Saqlash va Yangi o'yin — javob shu yerda ko'rinsin)
    const burger = document.getElementById('btnBurger'), drawer = document.getElementById('menuDrawer');
    const setDrawer = open => { drawer.hidden = !open; burger.setAttribute('aria-expanded', String(open)); };
    burger.addEventListener('click', () => setDrawer(drawer.hidden));
    drawer.addEventListener('click', e => { const b = e.target.closest('button'); if (b && b.id !== 'btnSave' && b.id !== 'btnReset') setDrawer(false); });
    document.addEventListener('click', e => { if (!drawer.hidden && !drawer.contains(e.target) && !burger.contains(e.target)) setDrawer(false); });
    addEventListener('keydown', e => { if (e.code === 'Escape' && !drawer.hidden) setDrawer(false); });
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
    // "Juda past" faqat avtomatik rejim uchun — tugmalar orasida yo'q
    const v = Settings.v, q = Object.entries(QUALITY).filter(([, d]) => !d.auto).map(([k, d]) =>
      `<button type="button" class="seg${v.quality === k ? ' on' : ''}" data-q="${k}">${d.name}</button>`).join('');
    const range = (id, label, min, max, step, val, fmt) =>
      `<label class="set-row" for="${id}"><span>${label}</span><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}"><output id="${id}Out">${fmt(val)}</output></label>`;
    this.open('O\'yin', 'Sozlamalar', `
      <div class="set-row"><span>Grafika sifati</span><div class="segs" id="setQuality">${q}</div></div>
      <p class="set-note">«Avto» — o'yin tezligini kuzatib, qotsa sifatni o'zi pasaytiradi, tez ishlasa oshiradi. Qo'lda tanlasangiz, o'sha sifat doim qoladi.</p>
      ${range('setMaster', 'Umumiy ovoz', 0, 1, 0.05, v.master, x => Math.round(x * 100) + '%')}
      ${range('setMusic', 'Radio musiqasi', 0, 1, 0.05, v.music, x => Math.round(x * 100) + '%')}
      ${range('setSens', 'Sichqoncha sezgirligi', 0.4, 2.5, 0.1, v.sens, x => (+x).toFixed(1) + '×')}
      ${range('setFov', 'Ko\'rish burchagi', 55, 85, 1, v.fov, x => x + '°')}
      <label class="set-row" for="setInvert"><span>Kamerani teskari (yuqori/past)</span><input type="checkbox" id="setInvert"${v.invertY ? ' checked' : ''}></label>
      <div class="set-row"><span>Uzatmalar qutisi</span><div class="segs" id="setGear">${[['auto', 'Avtomat'], ['manual', 'Mexanika']].map(([k, n]) =>
        `<button type="button" class="seg${(v.gearbox || 'auto') === k ? ' on' : ''}" data-gear="${k}">${n}</button>`).join('')}</div></div>
      <p class="set-note">Mexanikada uzatmani o'zingiz almashtirasiz: ${Input.touch ? 'pedallar yonidagi ▲ ▼ tugmalari' : '<kbd>E</kbd> — yuqori, <kbd>Q</kbd> — past'} (geympadda RB / LB). Aylanish ko'rsatkichi sariq bo'lsa — yuqoriga o'ting.</p>
      <label class="set-row" for="setFuel"><span>Yoqilg'i sarflanadi (zapravkada quyish kerak)</span><input type="checkbox" id="setFuel"${v.fuel !== false ? ' checked' : ''}></label>
      ${Input.touch ? '' : `<label class="set-row" for="setHints"><span>Tugmalar ko'rsatmasi o'yin ichida (I)</span><input type="checkbox" id="setHints"${v.keyHints !== false ? ' checked' : ''}></label>`}
      ${Input.touch ? `<div class="set-row"><span>Mashinani burish (telefonda)</span><div class="segs" id="setSteer">${STEER_MODES.map(([k, n]) =>
        `<button type="button" class="seg${(v.steer || 'arrows') === k ? ' on' : ''}" data-steer="${k}">${n}</button>`).join('')}</div></div>
      <p class="set-note">Strelka — chap/o'ng tugmalari; Rul — ekrandagi rulni barmoq bilan aylantirasiz; Qiyshaytirish — telefonni rul kabi chapga/o'ngga qiyshaytirasiz.</p>` : ''}
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
    document.getElementById('setFuel').addEventListener('change', e => { v.fuel = e.target.checked; Save.soon(); });
    b.querySelectorAll('[data-gear]').forEach(el => el.addEventListener('click', () => {
      v.gearbox = el.dataset.gear; b.querySelectorAll('[data-gear]').forEach(x => x.classList.toggle('on', x === el)); KeyHints._k = null; Save.soon();
    }));
    const sh = document.getElementById('setHints');
    if (sh) sh.addEventListener('change', e => { v.keyHints = e.target.checked; KeyHints._k = null; Save.soon(); });
    b.querySelectorAll('[data-steer]').forEach(el => el.addEventListener('click', () => {
      const mode = el.dataset.steer, pick = m => { v.steer = m; b.querySelectorAll('[data-steer]').forEach(x => x.classList.toggle('on', x.dataset.steer === m)); Save.soon(); };
      if (mode !== 'tilt') return pick(mode);
      // Qiyshaytirish uchun harakat sensori kerak (iPhone'da ruxsat so'raladi)
      TouchUI.enableTilt(ok => { if (ok) pick('tilt'); else { pick(v.steer === 'tilt' ? 'arrows' : v.steer); toast('Sozlamalar', 'Harakat sensoriga ruxsat berilmadi', ''); } });
    }));
  },
  // Yo'riqnoma: klaviatura, telefon va geympad boshqaruvi
  guide() {
    const li = a => a.map(t => `<li>${t}</li>`).join('');
    // Telefon tugmalari belgilari va ma'nosi
    const legend = rows => `<dl class="keys">${rows.map(([ics, text, cls]) =>
      `<dt>${ics.map(k => `<span class="${cls || ''}">${touchIcon(k)}</span>`).join(' ')}</dt><dd>${text}</dd>`).join('')}</dl>`;
    this.open('O\'yin', 'Yo\'riqnoma', `<div class="info guide">
      <h3>Klaviatura va sichqoncha</h3>
      ${document.getElementById('guideKeys').innerHTML}
      <h3>Telefonda</h3>
      <p>Telefonni yotqizib (albom rejimida) o'ynang. Chapdagi joystik — yurish, ekranning bo'sh joyini surish — kamerani burish.</p>
      ${legend([
        [['run'], 'Yugurish (bir bosish — yoqiladi, yana bosish — o\'chadi)'],
        [['jump'], 'Sakrash'],
        [['punch', 'shoot'], 'Urish (musht, bita) / otish (o\'qotar qurol)'],
        [['weapon'], 'Qurolni almashtirish'],
        [['aim'], 'Nishon — faqat o\'qotar qurolda; bosish — kamera yaqinlashib mo\'ljal chiqadi, yana bosish — o\'chadi'],
        [['car', 'moto'], 'Mashina/mototsikl eshigi oldida (4 m ichida) — bossangiz aynan o\'sha mashinaga o\'tirasiz', 'ic-sun'],
        [['taken'], 'Ichida haydovchi bor — bossangiz uni tortib chiqarasiz', 'ic-red'],
        [['left', 'right'], 'Mashinada burish — «Strelka» usuli (Sozlamalar → Mashinani burish)'],
        [['car'], '«Rul» usuli: chapdagi rulni barmoq bilan aylantiring, qo\'yib yuborsangiz o\'rtaga qaytadi'],
        [['tilt'], '«Qiyshaytirish» usuli: telefonni rul kabi chapga/o\'ngga qiyshaytiring (iPhone sensorga ruxsat so\'raydi)'],
        [['gas', 'brake'], 'Gaz va tormoz pedallari'],
        [['reverse'], 'Mashina to\'xtab turganda tormoz pedali shu belgiga aylanadi — bosib tursangiz orqaga yurasiz'],
        [['handbrake'], 'Qo\'l tormozi (drift)'],
        [['horn'], 'Signal (bosib tursangiz uzun chaladi)'],
        [['gearUp', 'gearDown'], 'Mexanik uzatmalar (Sozlamalar → Uzatmalar qutisi → Mexanika): yuqori / past'],
        [['fuel'], 'Zapravkada kolonka yonida to\'xtasangiz chiqadi — benzin yoki metan quyish; bak bo\'shasa — kanistr chaqirish', 'ic-fuel'],
        [['exit'], 'Mashinadan tushish'],
        [['view'], 'Mashina ichidan ko\'rish (rul va tablo) / orqadan ko\'rish'],
        [['sigL', 'sigR'], 'Burilish chiroqlari (burilib bo\'lgach o\'zi o\'chadi)'],
        [['hazard'], 'Avariya chirog\'i'],
        [['lights'], 'Faralarni yoqish / o\'chirish (yoniq bo\'lsa tugma sariq hoshiyali; kechasi o\'zi yonadi)'],
        [['radio'], 'Radio stansiyasi'],
        [['siren'], 'Sirena (politsiya mashinasida)'],
        [['taxi'], 'Taksi ishi (sariq taksida)'],
        [['bus'], 'Avtobus ishi (avtobusda): bekatma-bekat yo\'lovchi tashish'],
        [['nitro'], 'Nitro (garajda o\'rnatilgan bo\'lsa)'],
        [['pause'], 'Pauza (yuqori o\'ng burchakda)'],
      ])}
      <h3>Avtodrom (prava imtihoni)</h3>
      <ul>${li([
        'Xaritadagi yashil <b>P</b> belgisi — Yunusobod tumanidagi avtodrom. Imtihonchi yonidagi yashil halqaga kiring (haqi $50)',
        'O\'quv mashinasida YIM tartibidagi 15 mashq: start, piyodalar o\'tish joyi, estakada, 90° burilishlar, svetoforli chorrahalar, ilon izi, boks, temir yo\'l, tezlashish, avariya to\'xtashi, parallel parkovka, finish',
        'Tezlik 20 km/soatdan oshmasin (tezlashish bo\'lagida 40 gacha), har burilishda burilish chirog\'ini yoqing, chiziq va konuslarga tegmang',
        '3 ta xato — «O\'tmadi». Qizil chiroqda o\'tish yoki piyodaga yo\'l bermaslik — darhol «O\'tmadi»',
      ])}</ul>
      <h3>Uzatmalar qutisi</h3>
      <ul>${li([
        'Avtomat (odatiy): uzatmalar o\'zi almashadi. Gaz oxirigacha bosilsa — pastroq uzatmaga tushib, tezroq tezlanadi',
        'Mexanika: Sozlamalar → Uzatmalar qutisi. <kbd>E</kbd> — yuqori, <kbd>Q</kbd> — past (telefonda pedallar yonidagi ▲ ▼). Mashinalarda 5 ta, kuchli mashinalar, avtobus va mototsiklda 6 ta uzatma',
        'Har uzatmaning o\'z eng yuqori tezligi bor: aylanish oxiriga yetsa, dvigatel cheklovchiga uriladi — ko\'rsatkich sariq bo\'lganda yuqoriga o\'ting. Past uzatmada tezroq tezlanasiz, baland uzatmada joyidan sekin qo\'zg\'alasiz',
        'Orqaga: to\'xtab turganda tormozni bosib turing (R)',
      ])}</ul>
      <h3>Yoqilg'i va zapravka</h3>
      <ul>${li([
        'Haydaganingiz sari bak bo\'shaydi (spidometr ostidagi yashil chiziq). 15% dan kam qolsa, eng yaqin zapravka xaritada belgilanadi',
        'Xaritadagi <b>Z</b> — zapravka (3 ta). Benzin kolonkasi yonida to\'xtang: navbatsiz, o\'tirgan joyingizda quyiladi (to\'la bak ≈ $40)',
        'Metan uch baravar arzon, lekin navbat bor va quyish paytida mashinadan tushish shart. Malibu, Mercedes, Charger, mototsikl va politsiya mashinasi faqat benzinda yuradi',
        'Bak bo\'shasa dvigatel o\'chadi — kanistr chaqiring ($25, 22% quyiladi) yoki boshqa mashina toping. Sozlamalarda yoqilg\'i sarfini o\'chirib qo\'yish mumkin',
      ])}</ul>
      <h3>Politsiyadan qochish</h3>
      <ul>${li([
        'Ko\'zdan yo\'qoling: bino orqasiga buriling, uzoqlashing. Hech kim ko\'rmasa yulduzlar miltillaydi va 14–30 soniyada o\'chadi',
        'Garajda mashinani qayta bo\'yating — politsiya ko\'rmayotgan bo\'lsa, yulduzlar darhol o\'chadi',
        'Metroda boshqa bekatga keting — 1–2 yulduz butunlay o\'chadi, ko\'prog\'i 2 taga kamayadi',
        'Politsiya yoningizda turganda to\'xtamang — 2–4 soniyada qo\'lga olinasiz',
      ])}</ul>
      <h3>Geympad</h3>
      <ul>${li([
        'Chap tayoq — yurish va rul, o\'ng tayoq — kamera; mashinada LB / RB — burilish chiroqlari (mexanik uzatmada — uzatma past / yuqori)',
        'RT — otish / gaz, LT — nishon / tormoz, A — sakrash / qo\'l tormozi, B — nitro, Y — mashinaga o\'tirish',
        'D-pad o\'ng — mashina ichidan ko\'rish, D-pad past — zapravkada yoqilg\'i quyish, Back — xarita, Start — pauza',
      ])}</ul>
    </div>`);
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
        'O\'zbek mashinalari: Nexia, Cobalt, Gentra, Lacetti, Malibu, Spark, Damas, shuningdek Mercedes, SamAuto avtobusi va mototsikl',
        'Avtodrom: YIM tartibidagi 15 mashqli prava imtihoni',
        'Yoqilg\'i: benzin va metan zapravkalari (metanda navbat bor), bo\'sh bakka kanistr',
        'Vazifalar, taksi va avtobus haydovchisi ishi, ko\'cha poygalari, garaj va tyuning, qurol va kiyim do\'konlari',
        'Politsiya: 5 yulduzli qidiruv, yo\'l to\'siqlari va vertolyot',
        'Jonli ko\'cha harakati: har xil fe\'lli haydovchilar, quvib o\'tish, chorrahada yo\'l berish, yo\'l chetiga to\'xtash va chiqib ketish',
        'Ob-havo (yomg\'ir, qor, tuman), kun va tun, mashinada radio',
        'Ko\'p o\'yinchi: xona kodi yoki QR-kod orqali, lokal tarmoqda',
        `O'yinni saqlash, statistika va ${ACHIEVEMENTS.length} ta yutuq; telefon va geympad bilan boshqaruv`,
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
        'Mashina signali ovozi: <b>Mixkit</b> (Mixkit Sound Effects Free License)',
        'Dvigatel ovozlari (Freesound, CC0): <i>lovretta</i> — Renault 19 yozuvi; <i>FreeCarSoundsGaming</i> — V8; <i>qubodup</i> va <i>Mihacappy</i> — avtobus',
        '3D modellar (Sketchfab, o\'yin uchun soddalashtirilgan): Nexia, Cobalt, Gentra, Spark va Lacetti — <a href="https://sketchfab.com/uzbek_supra" target="_blank" rel="noopener"><i>uzb_rx7</i></a> (CC BY 4.0); Malibu — <i>Ddiaz Design</i> (CC BY 4.0); Damas — <i>own.guest</i> (CC BY 4.0); SamAuto avtobusi — <i>ItsDiyor</i> (CC BY 4.0); BMW S1000RR mototsikli — <i>VTX</i> (CC BY-NC-SA 4.0); Amir Temur haykali skani — <i>Global Digital Heritage</i> (CC BY-NC 4.0)',
        'Boshqa 3D modellar: Fast Charger — <i>ergoninane</i>; politsiya mashinasi — <i>arunangshubanerjee</i>; skanerlangan odam — <i>Renderpeople</i> (rp_posed_00178_29); Mercedes-Benz GLS 580 modeli',
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
      ['Haydovchilik guvohnomasi', s.license ? 'Bor («B» toifasi)' : 'Yo\'q — avtodromda topshiring'],
    ].map(([a, b]) => `<div class="stat-row"><span>${a}</span><b>${b}</b></div>`).join('');
    const got = ACHIEVEMENTS.filter(a => Stats.ach[a.id]).length;
    const ach = ACHIEVEMENTS.map(a => `<div class="ach${Stats.ach[a.id] ? ' got' : ''}"><b>${a.name}</b><span>${a.desc}</span></div>`).join('');
    this.open('O\'yin', 'Statistika', `${rows}<h3 class="ach-head">Yutuqlar · ${got}/${ACHIEVEMENTS.length}</h3><div class="ach-grid">${ach}</div>`);
  },
};
