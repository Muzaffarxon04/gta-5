'use strict';
// ===== HUD: pul, yulduzlar, mini-xarita, xabarlar =====
const HUD = {
  el: {}, helpT: 0, moneyShown: 0, areaT: 0, _p: null, _o: null, _t: null,
  init() {
    for (const id of ['hud', 'help', 'timer', 'clock', 'stars', 'wname', 'ammo', 'money', 'cross', 'prompt', 'objective', 'speedo',
      'kmh', 'carhp', 'district', 'street', 'radar', 'hpbar', 'arbar', 'hpwrap', 'big', 'bigText', 'bigSub', 'flash']) this.el[id] = document.getElementById(id);
    this.rc = this.el.radar.getContext('2d');
    this.starEls = [...this.el.stars.children];
  },
  help(html, dur = 5) { this.el.help.innerHTML = html; this.el.help.hidden = false; this.helpT = dur; },
  prompt(html) {
    if (html === this._p) return;
    this._p = html; this.el.prompt.hidden = !html;
    if (html) this.el.prompt.innerHTML = html;
  },
  objective(html) {
    if (html === this._o) return;
    this._o = html; this.el.objective.hidden = !html;
    if (html) this.el.objective.innerHTML = html;
  },
  timer(sec) {
    const t = sec == null ? null : Math.max(0, Math.ceil(sec));
    if (t === this._t) return;
    this._t = t; this.el.timer.hidden = t == null;
    if (t == null) return;
    this.el.timer.textContent = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
    this.el.timer.classList.toggle('low', t <= 10);
  },
  big(text, sub, cls) {
    this.el.big.className = 'big ' + cls;
    this.el.bigText.textContent = text; this.el.bigSub.textContent = sub;
    this.el.big.hidden = false;
  },
  hideBig() { this.el.big.hidden = true; },
  hurtFlash() {
    this.el.flash.style.opacity = 0.32;
    clearTimeout(this._ft); this._ft = setTimeout(() => (this.el.flash.style.opacity = 0), 110);
  },
  update(dt, s) {
    const e = this.el, P = Player;
    if (this.helpT > 0) { this.helpT -= dt; if (this.helpT <= 0) e.help.hidden = true; }
    e.clock.textContent = clockText() + ' · ' + Weather.label();
    // Pul hisoblagichi asta-sekin yetib boradi
    if (this.moneyShown !== P.money) {
      const d = P.money - this.moneyShown;
      this.moneyShown += Math.abs(d) < 2 ? d : Math.sign(d) * Math.max(1, Math.abs(d) * dt * 6);
      this.moneyShown = Math.round(this.moneyShown);
      e.money.textContent = '$' + this.moneyShown.toLocaleString('en-US');
    }
    this.starEls.forEach((el, i) => el.classList.toggle('on', i < s.wanted));
    e.stars.classList.toggle('flash', s.wanted > 0 && s.evading);
    const W = WEAPONS[P.weapon];
    e.wname.textContent = W.name;
    e.ammo.textContent = W.melee ? '' : P.ammo[P.weapon] || 0;
    e.hpbar.style.width = clamp(P.hp, 0, 100) + '%';
    e.hpwrap.classList.toggle('low', P.hp < 30);
    e.arbar.style.width = clamp(P.armor, 0, 100) + '%';
    const car = P.inCar;
    e.speedo.hidden = !car;
    if (car) {
      // Burilish chiroqlari ko'rsatkichi (miltillaydi)
      const sg = car.signal || 0, bl = blinkOn();
      const L = bl && (sg === -1 || sg === 2), R = bl && (sg === 1 || sg === 2);
      if (L !== this._sl) { this._sl = L; (this._eL || (this._eL = document.getElementById('sigL'))).classList.toggle('on', L); }
      if (R !== this._sr) { this._sr = R; (this._eR || (this._eR = document.getElementById('sigR'))).classList.toggle('on', R); }
    }
    if (car) { e.kmh.textContent = Math.round(car.speed * 3.6); e.carhp.style.width = clamp(car.hp / (car.maxHp || car.T.hp) * 100, 0, 100) + '%'; }
    e.cross.hidden = !!car || P.dead;
    e.cross.classList.toggle('aim', s.aiming);
    e.cross.classList.toggle('hit', s.hitMark > 0);
    this.areaT -= dt;
    if (this.areaT <= 0) { this.areaT = 0.5; e.district.textContent = Landmarks.nameAt(P.x, P.z) || districtAt(P.x, P.z); e.street.textContent = streetAt(P.x, P.z); }
  },
  // Mini-xarita: kamera yo'nalishi doim tepaga qaragan
  drawRadar(px, pz, yaw, ph, zoom, blips, wanted, time, route, routeColor) {
    const c = this.el.radar, g = this.rc, W = c.width, H = c.height, s = zoom;
    const cx = W / 2, cy = H * 0.6, cs = Math.cos(yaw), sn = Math.sin(yaw);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#2b5a73'; g.fillRect(0, 0, W, H);
    const a = -s * cs, b = -s * sn, cc = s * sn, d = -s * cs, ox = World.mapMin - px, oz = World.mapMin - pz;
    g.setTransform(a, b, cc, d, cx + a * ox + cc * oz, cy + b * ox + d * oz);
    g.drawImage(World.mapCanvas, 0, 0);
    g.setTransform(1, 0, 0, 1, 0, 0);
    const toS = (x, z) => { const dx = x - px, dz = z - pz; return [cx + s * (-cs * dx + sn * dz), cy - s * (sn * dx + cs * dz)]; };
    // GPS yo'li va masofa
    if (route && route.length > 1) {
      g.strokeStyle = routeColor; g.lineWidth = 7; g.lineJoin = g.lineCap = 'round'; g.beginPath();
      let len = 0;
      route.forEach((p, k) => { const [x, y] = toS(p.x, p.z); if (k) { g.lineTo(x, y); len += Math.hypot(p.x - route[k - 1].x, p.z - route[k - 1].z); } else g.moveTo(x, y); });
      g.stroke();
      g.font = 'bold 22px "Barlow Condensed", sans-serif'; g.textAlign = 'right'; g.textBaseline = 'bottom';
      g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(W - 96, H - 34, 90, 28);
      g.fillStyle = routeColor; g.fillText(len > 1000 ? (len / 1000).toFixed(1) + ' km' : Math.round(len) + ' m', W - 12, H - 8);
    }
    for (const bp of blips) {
      let [x, y] = toS(bp.x, bp.z);
      const out = x < 8 || y < 8 || x > W - 8 || y > H - 8;
      if (out && !bp.edge) continue;
      if (out) {
        const vx = x - cx, vy = y - cy, k = Math.min((W / 2 - 10) / Math.abs(vx || 1e-6), (cy - 10) / Math.abs(vy < 0 ? vy : 1e-6), (H - cy - 10) / Math.abs(vy > 0 ? vy : 1e-6));
        x = cx + vx * k; y = cy + vy * k;
      }
      g.fillStyle = bp.color; g.strokeStyle = '#000'; g.lineWidth = 2;
      g.beginPath();
      if (bp.shape === 'sq') g.rect(x - bp.size, y - bp.size, bp.size * 2, bp.size * 2);
      else g.arc(x, y, bp.size, 0, TAU);
      g.fill(); g.stroke();
      if (bp.label) { g.fillStyle = '#111'; g.font = 'bold 15px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(bp.label, x, y + 1); }
    }
    // O'yinchi strelkasi
    g.save(); g.translate(cx, cy); g.rotate(yaw - ph);
    g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -12); g.lineTo(9, 10); g.lineTo(0, 5); g.lineTo(-9, 10); g.closePath(); g.fill(); g.stroke();
    g.restore();
    // Qidiruvda bo'lsa — qizil/ko'k chegara
    if (wanted > 0) {
      g.lineWidth = 8; g.strokeStyle = Math.floor(time * 3) % 2 ? '#ef4b46' : '#3d7bff';
      g.strokeRect(4, 4, W - 8, H - 8);
    }
  },
};
