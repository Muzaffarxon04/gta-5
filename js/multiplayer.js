'use strict';
// ===== Ko'p o'yinchi: boshqa o'yinchilarni ko'rish, birga haydash, bir-biriga o'q uzish =====
// Har bir telefon o'z shahrini (mashinalar, piyodalar, politsiya) o'zi hisoblaydi;
// o'yinchilar, ularning mashinalari, o'q uzish, vaqt va ob-havo esa umumiy.
function nameTag(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 34px "Barlow Condensed", Arial, sans-serif';
  const w = Math.min(240, g.measureText(text).width + 28);
  g.fillStyle = 'rgba(10,8,18,.68)'; g.fillRect((256 - w) / 2, 8, w, 48);
  g.fillStyle = '#7ee0ff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 33);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
  sp.scale.set(2.2, 0.55, 1); sp.position.y = 2.35; sp.renderOrder = 10;
  return sp;
}

class RemotePlayer {
  constructor(s) {
    this.id = s.id; this.name = s.n || 'O\'yinchi'; this.outfit = s.o || 'default';
    this.buf = []; this.last = null; this.car = null; this.seat = null; this.phase = 0;
    this.x = s.x; this.y = s.y; this.z = s.z; this.h = s.h || 0; this.weapon = 'fist';
    this.build();
  }
  build() {
    this.hm = makeHuman(playerOutfit(this.outfit));
    this.tag = nameTag(this.name); this.hm.g.add(this.tag);
    this.gun = new THREE.Mesh(new THREE.BufferGeometry(), WEAPON_MAT); this.gun.visible = false;
    this.hm.b.faR.add(this.gun);
    World.scene.add(this.hm.g);
  }
  rebuild() {
    const old = this.hm, car = this.car, seat = this.seat;
    if (car) car.unseat();
    if (seat) seat.unseatPassenger();
    if (old.g.parent) old.g.parent.remove(old.g);
    old.mesh.geometry.dispose();
    this.build();
    if (car) car.seatHuman(this.hm, true);
    if (seat) seat.seatPassenger(this.hm);
  }
  push(s) {
    s.rt = performance.now();
    this.buf.push(s); if (this.buf.length > 30) this.buf.shift();
    this.last = s;
    if ((s.n && s.n !== this.name) || (s.o && s.o !== this.outfit)) {
      this.name = s.n || this.name; this.outfit = s.o || this.outfit;
      this.rebuild();
    }
  }
  // ~110 ms kechikish bilan ikki holat orasini silliq to'ldirish
  sample() {
    const B = this.buf, t = performance.now() - 110;
    if (!B.length) return null;
    let a = B[B.length - 1], b = a;
    for (let i = B.length - 1; i > 0; i--) if (B[i - 1].rt <= t) { a = B[i - 1]; b = B[i]; break; }
    return { a, b, k: b.rt > a.rt ? clamp((t - a.rt) / (b.rt - a.rt), 0, 1) : 1 };
  }
  ensureCar(cs) {
    // Eski versiyadagi o'yinchi bizda yo'q mashina turini yuborishi mumkin (masalan, Jiguli)
    const ty = CAR_TYPES[cs.ty] ? cs.ty : 'nexia';
    if (this.car && this.car.type === ty && !this.car.dead) return this.car;
    this.leaveCar();
    const c = new Car(ty, cs.x, cs.z, cs.h, 'parked', cs.co);
    c.driver = 'remote'; c.remote = this;
    Game.cars.push(c);
    this.unseatPass();
    c.seatHuman(this.hm, true);
    return (this.car = c);
  }
  leaveCar() {
    const c = this.car;
    if (!c) return;
    c.unseat(); World.scene.add(this.hm.g);
    c.driver = null; c.remote = null; c.vx = c.vz = 0;
    if (Player.inCar === c && Player.passenger) exitCar();
    this.car = null;
  }
  unseatPass() {
    if (!this.seat) return;
    this.seat.unseatPassenger(); World.scene.add(this.hm.g);
    this.seat = null;
  }
  update(dt) {
    const S = this.sample();
    if (!S) return;
    const { a, b, k } = S, L = (p, q) => p + (q - p) * k, LA = (p, q) => p + wrapAng(q - p) * k;
    this.x = L(a.x, b.x); this.y = L(a.y, b.y); this.z = L(a.z, b.z); this.h = LA(a.h, b.h);
    this.dead = !!b.d;
    if (b.car) {
      const c = this.ensureCar(b.car), ca = a.car || b.car;
      c.x = L(ca.x, b.car.x); c.y = L(ca.y, b.car.y); c.z = L(ca.z, b.car.z); c.h = LA(ca.h, b.car.h);
      c.steer = b.car.st; c.siren = !!b.car.si;
      c.vx = Math.sin(c.h) * b.car.sp; c.vz = Math.cos(c.h) * b.car.sp;
      this.gun.visible = false;
      return;
    }
    this.leaveCar();
    if (b.ride) {
      const car = b.ride === Net.id ? Player.inCar : (MP.players.get(b.ride) || {}).car;
      if (car && this.seat !== car) { this.unseatPass(); car.seatPassenger(this.hm); this.seat = car; }
      this.gun.visible = false;
      return;
    }
    this.unseatPass();
    const g = this.hm.g;
    g.position.set(this.x, this.y, this.z);
    g.rotation.set(this.dead ? -Math.PI / 2 : 0, this.h, 0);
    if (this.dead) { poseDead(this.hm); g.position.y += 0.12; }
    else {
      this.phase += dt * b.sp * 2.1;
      poseHuman(this.hm, this.phase, clamp(b.sp / 3.4, 0, 1), clamp((b.sp - 3.6) / 3.5, 0, 1));
      if (b.w !== 'fist' && b.aim) { this.hm.b.uaR.rotation.set(-Math.PI / 2, 0, 0); this.hm.b.faR.rotation.set(0, 0, 0); }
    }
    if (b.w !== this.weapon) {
      this.weapon = b.w;
      if (b.w !== 'fist' && WEAPON_GEO[b.w]) this.gun.geometry = _wgeo[b.w] || (_wgeo[b.w] = WEAPON_GEO[b.w]());
    }
    this.gun.visible = b.w !== 'fist' && !this.dead;
  }
  remove() {
    this.leaveCar(); this.unseatPass();
    World.scene.remove(this.hm.g);
    this.hm.mesh.geometry.dispose();
  }
}

const MP = {
  active: false, players: new Map(), sendT: 0, wT: 0, pvp: true, lastHit: null,
  start() {
    this.active = true;
    Net.onMessage = (pid, m) => this.onMsg(pid, m);
    Net.onOpen = pid => {
      Net.send(pid, { t: 'hi', id: Net.id, n: Net.name, pvp: this.pvp }, false);
      if (Net.role === 'host') this.sendWorld();
      MPUI.refresh();
    };
    Net.onClose = (pid, name) => {
      if (Net.role === 'guest') {
        for (const id of [...this.players.keys()]) this.removePlayer(id);
        toast('Ko\'p o\'yinchi', 'Host o\'yinni yopdi', 'Siz yana yolg\'iz o\'ynayapsiz');
        Net.leave(); this.active = false;
      } else {
        this.removePlayer(pid);
        Net.broadcast({ t: 'bye', id: pid }, false);
        toast('Ko\'p o\'yinchi', name || 'O\'yinchi', 'o\'yindan chiqdi');
      }
      MPUI.refresh();
    };
  },
  stop() {
    Net.leave();
    for (const id of [...this.players.keys()]) this.removePlayer(id);
    this.active = false;
    MPUI.refresh();
  },
  removePlayer(id) { const r = this.players.get(id); if (r) { r.remove(); this.players.delete(id); } },
  myState() {
    const P = Player, c = P.inCar;
    const own = c && !P.passenger && !c.dead;
    return {
      t: 's', id: Net.id, n: Net.name, o: P.outfitId, x: +P.x.toFixed(2), y: +P.y.toFixed(2), z: +P.z.toFixed(2), h: +P.h.toFixed(3),
      sp: +Math.hypot(P.vx, P.vz).toFixed(2), w: P.weapon, aim: (Input.mouseR || P.aimT > 0) ? 1 : 0, d: P.dead ? 1 : 0,
      car: own ? { ty: c.type, co: c.color, x: +c.x.toFixed(2), y: +c.y.toFixed(2), z: +c.z.toFixed(2), h: +c.h.toFixed(3), st: +c.steer.toFixed(2), si: c.siren ? 1 : 0, sp: +c.fwd.toFixed(1) } : null,
      ride: P.passenger || null,
    };
  },
  sendWorld() { Net.broadcast({ t: 'w', day: World.dayT, wx: Weather.kind, pvp: this.pvp }, false); },
  update(dt) {
    if (!this.active || !Net.peers.size) return;
    if ((this.sendT -= dt) <= 0) {
      this.sendT = 1 / 15;
      const s = this.myState();
      if (Net.role === 'host') Net.broadcast({ t: 'S', ps: [s, ...[...this.players.values()].map(r => r.last).filter(Boolean)] }, true);
      else Net.send('host', s, true);
    }
    if (Net.role === 'host' && (this.wT -= dt) <= 0) { this.wT = 4; this.sendWorld(); }
    for (const r of this.players.values()) r.update(dt);
    // Yo'lovchi bo'lib o'tirgan mashina haydovchisi tushib ketsa — biz ham tushamiz
    const P = Player;
    if (P.passenger && (!P.inCar || P.inCar.driver !== 'remote')) { if (P.inCar) exitCar(); else P.passenger = null; }
  },
  onMsg(pid, m) {
    const host = Net.role === 'host';
    if (m.t === 's') { if (host) this.apply(m); }
    else if (m.t === 'S') { for (const s of m.ps) if (s.id !== Net.id) this.apply(s); }
    else if (m.t === 'hi') { MPUI.refresh(); }
    else if (m.t === 'w') { World.dayT = m.day; this.pvp = m.pvp; Weather.timer = 9999; if (Weather.kind !== m.wx) Weather.set(m.wx, false); }
    else if (m.t === 'shot') { this.remoteShot(m); if (host) Net.broadcast(m, false, pid); }
    else if (m.t === 'hit') {
      if (m.to === Net.id) this.takeHit(m);
      else if (host) Net.send(m.to, m, false);
    }
    else if (m.t === 'kill') { this.killFeed(m); if (host) Net.broadcast(m, false, pid); }
    else if (m.t === 'bye') this.removePlayer(m.id);
  },
  apply(s) {
    let r = this.players.get(s.id);
    if (!r) { r = new RemotePlayer(s); this.players.set(s.id, r); toast('Ko\'p o\'yinchi', r.name, 'o\'yinga qo\'shildi'); MPUI.refresh(); }
    r.push(s);
  },
  nameOf(id) { return id === Net.id ? Net.name : (this.players.get(id) || {}).name || 'O\'yinchi'; },
  // --- O'q uzish ---
  shot(ax, ay, az, bx, by, bz, w) {
    if (!this.active || !Net.peers.size) return;
    const m = { t: 'shot', id: Net.id, a: [ax, ay, az].map(v => +v.toFixed(2)), b: [bx, by, bz].map(v => +v.toFixed(2)), w };
    if (Net.role === 'host') Net.broadcast(m, false); else Net.send('host', m, false);
  },
  remoteShot(m) {
    FX.tracer(...m.a, ...m.b);
    FX.spawn(m.a[0], m.a[1], m.a[2], 0, 0, 0, 0.05, 0xffe08a, 0.25);
    const d = Math.hypot(m.a[0] - Player.x, m.a[2] - Player.z);
    SFX.shot(m.w || 'pistol', clamp(1.1 - d / 80, 0.2, 1), clamp(d / 70, 0, 0.8));
  },
  // Nur boshqa o'yinchiga tegadimi (piyoda — tana, mashinada — mashina)
  rayPlayers(o, dir, best) {
    if (!this.active || !this.pvp) return null;
    let hit = null;
    for (const r of this.players.values()) {
      if (r.dead) continue;
      if (r.car) {
        const t = rayCar(r.car, o.x, o.y, o.z, dir.x, dir.y, dir.z, best);
        if (t > 0 && t < best) { best = t; hit = { r, t, car: true }; }
        continue;
      }
      if (r.seat) continue;
      for (const [hy, rad, head] of [[0.55, 0.36, false], [1.2, 0.36, false], [1.72, 0.2, true]]) {
        const t = raySphere(o.x, o.y, o.z, dir.x, dir.y, dir.z, r.x, r.y + hy, r.z, rad);
        if (t > 0 && t < best) { best = t; hit = { r, t, head }; }
      }
    }
    return hit;
  },
  hit(r, dmg) {
    const m = { t: 'hit', to: r.id, from: Net.id, dmg: Math.round(dmg) };
    if (Net.role === 'host') Net.send(r.id, m, false); else Net.send('host', m, false);
    Game.hitMark = 0.2;
  },
  takeHit(m) {
    if (!this.pvp || Player.dead) return;
    this.lastHit = { from: m.from, t: performance.now() };
    hurtPlayer(m.dmg);
    if (Player.dead) {
      const k = { t: 'kill', k: m.from, v: Net.id };
      if (Net.role === 'host') Net.broadcast(k, false); else Net.send('host', k, false);
      this.killFeed(k);
    }
  },
  killFeed(m) { toast('Ko\'p o\'yinchi', `${this.nameOf(m.k)} → ${this.nameOf(m.v)}`, m.k === Net.id ? 'Siz g\'alaba qildingiz!' : ''); },
  // Yaqin atrofdagi o'yinchiga musht yoki bita
  melee(fx, fz, range, dmg) {
    if (!this.active || !this.pvp) return false;
    const P = Player;
    for (const r of this.players.values()) {
      if (r.dead || r.car || r.seat) continue;
      const dx = r.x - P.x, dz = r.z - P.z, d = Math.hypot(dx, dz);
      if (d < range && (dx * fx + dz * fz) / (d || 1) > 0.35) { this.hit(r, dmg); return true; }
    }
    return false;
  },
  blips() { return [...this.players.values()].map(r => ({ x: r.x, z: r.z, color: '#7ee0ff', size: 6, edge: true, label: (r.name[0] || '?').toUpperCase() })); },
};

// ===== Ko'p o'yinchi oynasi (lobbi) =====
const Scanner = {
  stream: null,
  async start(onResult) {
    const v = document.getElementById('mpVideo');
    try { this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); }
    catch (e) { MPUI.status('Kameraga ruxsat berilmadi. Kodni matn sifatida nusxalab, pastdagi maydonga joylang.'); return; }
    v.srcObject = this.stream; v.hidden = false;
    try { await v.play(); } catch (e) { /* avtomatik ijro */ }
    const det = 'BarcodeDetector' in window ? new BarcodeDetector({ formats: ['qr_code'] }) : null;
    const cv = document.createElement('canvas'), g = cv.getContext('2d', { willReadFrequently: true });
    const loop = async () => {
      if (!this.stream) return;
      let txt = null;
      try {
        if (det) { const r = await det.detect(v); if (r[0]) txt = r[0].rawValue; }
        else if (v.videoWidth) {
          cv.width = v.videoWidth; cv.height = v.videoHeight; g.drawImage(v, 0, 0);
          const img = g.getImageData(0, 0, cv.width, cv.height), r = jsQR(img.data, img.width, img.height);
          if (r) txt = r.data;
        }
      } catch (e) { /* kadr tayyor emas */ }
      if (txt) { this.stop(); onResult(txt); } else setTimeout(loop, 120);
    };
    loop();
  },
  stop() {
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    this.stream = null;
    document.getElementById('mpVideo').hidden = true;
  },
};

const MPUI = {
  el: {}, after: null,
  init() {
    for (const id of ['mpPanel', 'mpName', 'mpHost', 'mpQrHost', 'mpCode', 'mpJoin', 'mpQrJoin', 'mpLeave', 'mpPlay', 'mpClose', 'mpStatus', 'mpList',
      'mpRoom', 'mpQrBox', 'mpQrImg', 'mpQrCap', 'mpOut', 'mpCopy', 'mpScan', 'mpIn', 'mpApply', 'mpPvp', 'mpSetup', 'mpWarn']) this.el[id] = document.getElementById(id);
    const e = this.el;
    try { e.mpName.value = localStorage.getItem('kq-name') || ''; } catch (err) { /* saqlash yo'q */ }
    document.getElementById('btnMP').addEventListener('click', () => this.open());
    e.mpClose.addEventListener('click', () => this.close());
    e.mpPlay.addEventListener('click', () => { this.close(); startGame(); });
    e.mpLeave.addEventListener('click', () => { MP.stop(); this.reset(); this.status('Xonadan chiqdingiz.'); });
    e.mpHost.addEventListener('click', () => this.host());
    e.mpQrHost.addEventListener('click', () => this.qrHost());
    e.mpJoin.addEventListener('click', () => this.join());
    e.mpQrJoin.addEventListener('click', () => this.qrJoin());
    e.mpCopy.addEventListener('click', () => {
      const t = e.mpOut.value;
      if (navigator.clipboard) navigator.clipboard.writeText(t).then(() => this.status('Nusxalandi.'), () => { e.mpOut.select(); });
      else e.mpOut.select();
    });
    e.mpScan.addEventListener('click', () => Scanner.start(txt => this.handleCode(txt)));
    e.mpApply.addEventListener('click', () => { if (e.mpIn.value.trim()) this.handleCode(e.mpIn.value.trim()); });
    e.mpPvp.addEventListener('change', () => { MP.pvp = e.mpPvp.checked; if (Net.role === 'host') MP.sendWorld(); });
    Net.onStatus = t => this.status(t);
  },
  supported() {
    // claude.ai sahifasi ichida (iframe) to'g'ridan-to'g'ri ulanish taqiqlangan
    let framed = true;
    try { framed = window.top !== window.self; } catch (e) { framed = true; }
    if (!Net.supported() || framed || /claude\.ai$/.test(location.hostname)) return false;
    try { new RTCPeerConnection().close(); return true; } catch (e) { return false; }
  },
  open() {
    this.el.mpPanel.hidden = false;
    const ok = this.supported();
    this.el.mpWarn.hidden = ok; this.el.mpSetup.hidden = !ok;
    this.refresh();
  },
  close() { Scanner.stop(); this.el.mpPanel.hidden = true; },
  status(t) { this.el.mpStatus.textContent = t; },
  myName() {
    const n = (this.el.mpName.value || '').trim().slice(0, 16) || 'O\'yinchi ' + Math.floor(Math.random() * 90 + 10);
    this.el.mpName.value = n; Net.name = n;
    try { localStorage.setItem('kq-name', n); } catch (e) { /* saqlash yo'q */ }
    return n;
  },
  reset() { this.el.mpRoom.textContent = ''; this.el.mpQrBox.hidden = true; this.after = null; Scanner.stop(); this.refresh(); },
  showQR(str, caption, after) {
    const e = this.el, qr = qrcode(0, 'L');
    qr.addData(str); qr.make();
    e.mpQrImg.src = qr.createDataURL(Math.max(2, Math.floor(300 / qr.getModuleCount())), 2);
    e.mpQrCap.textContent = caption; e.mpOut.value = str; e.mpIn.value = '';
    e.mpQrBox.hidden = false; this.after = after;
  },
  host() {
    if (Net.role === 'guest') MP.stop();
    this.myName(); MP.start();
    const code = Net.room || Net.hostRoom();
    this.el.mpRoom.textContent = code;
    this.status('Xona ochildi. Do\'stlaringiz «Qo\'shilish» bo\'limida shu kodni kiritsin (internet kerak).');
    this.refresh();
  },
  // Kameraga ruxsat berilgan sahifaga brauzer telefonning haqiqiy lokal manzilini ochadi —
  // shunda hotspot va oddiy Wi-Fi'da telefonlar bir-birini ishonchliroq topadi
  async warmCamera() {
    if (this.camOk || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    this.status('Kameraga ruxsat bering — ulanish ishonchliroq bo\'ladi.');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true });
      s.getTracks().forEach(t => t.stop());
      this.camOk = true;
    } catch (e) { /* ruxsat berilmadi — baribir urinib ko'ramiz */ }
  },
  async qrHost() {
    if (Net.role === 'guest') MP.stop();
    this.myName(); MP.start();
    if (!Net.role) Net.role = 'host';
    await this.warmCamera();
    this.status('QR-kod tayyorlanmoqda…');
    const str = await Net.qrHostOffer();
    this.showQR(str, '1) O\'yinchi «QR orqali qo\'shilish» ni bosib, shu kodni skanerlasin. 2) Keyin uning telefonidagi javob QR-kodini «Skanerlash» bilan o\'qing.', 'host');
    this.status('O\'yinchi skanerlashini kuting.');
  },
  join() {
    const code = (this.el.mpCode.value || '').trim();
    if (code.length < 4) { this.status('Xona kodini kiriting.'); return; }
    MP.stop(); this.myName(); MP.start();
    Net.joinRoom(code).catch(() => this.status('Ulanib bo\'lmadi. Internetni tekshiring yoki QR usulini sinang.'));
  },
  qrJoin() {
    MP.stop(); this.myName(); MP.start();
    this.after = 'guest';
    this.el.mpQrBox.hidden = false; this.el.mpQrImg.removeAttribute('src');
    this.el.mpQrCap.textContent = 'Hostning QR-kodini skanerlang (yoki uning kodini pastga joylang).';
    this.el.mpOut.value = '';
    Scanner.start(txt => this.handleCode(txt));
  },
  async handleCode(txt) {
    try {
      if (this.after === 'host') { await Net.qrHostAccept(txt); this.status('Javob qabul qilindi — ulanmoqda…'); this.el.mpQrBox.hidden = true; }
      else {
        const ans = await Net.qrGuestAnswer(txt);
        this.showQR(ans, 'Endi bu QR-kodni hostga ko\'rsating — u «Skanerlash» bilan o\'qisin.', 'done');
        this.status('Host javobni skanerlashini kuting.');
      }
    } catch (err) { this.status('Kod mos kelmadi: ' + err.message); }
  },
  refresh() {
    const e = this.el;
    if (!e.mpList) return;
    const names = [`${Net.name || 'Siz'}${Net.role === 'host' ? ' (host)' : ''}`, ...[...MP.players.values()].map(r => r.name)];
    e.mpList.innerHTML = Net.role ? names.map(n => `<li>${n.replace(/</g, '&lt;')}</li>`).join('') : '<li>Hali hech kim yo\'q</li>';
    e.mpLeave.hidden = !Net.role;
    const hud = document.getElementById('mpHud');
    if (hud) { hud.hidden = !MP.active || !Net.peers.size; hud.textContent = `${MP.players.size + 1} o'yinchi${Net.room ? ' · xona ' + Net.room : ''}`; }
  },
};
