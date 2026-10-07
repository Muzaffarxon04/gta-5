'use strict';
// ===== Avtobus haydovchisi ishi: yo'nalish bo'yicha bekatma-bekat yo'lovchi tashish =====
const BUS_STOP_SAY = ['Eshiklar ochildi', 'Bekat', 'Keyingi bekat'];
const BusJob = {
  active: false, route: [], idx: 0, time: 0, dwell: 0, hits: 0, onboard: 0, earned: 0, stopName: '',
  toggle() {
    if (this.active) return this.stop('Avtobus ishi tugatildi.');
    const c = Player.inCar;
    if (!c || c.type !== 'bus' || Player.passenger) return HUD.help('Avtobus ishi uchun avtobusga o\'tiring.', 3);
    if (Missions.active) return HUD.help('Avval boshlangan vazifani tugating.', 3);
    if (!this.makeRoute(c)) return HUD.help('Yaqin atrofda bekat topilmadi.', 3);
    this.active = true; this.onboard = randi(2, 6); this.earned = 0;
    HUD.help(`Avtobus ishi boshlandi: ${this.route.length} ta bekat. Har bekatda to'xtang — yo'lovchilar tushib-chiqadi.` + (Input.touch ? '' : ' <kbd>T</kbd> — tugatish'), 5);
    this.startLeg(c);
  },
  stop(msg) {
    this.active = false; this.route = []; this.dwell = 0;
    HUD.objective(null); HUD.timer(null);
    if (msg) HUD.help(msg, 3);
  },
  // Bekat oldidagi yo'l bo'lagi (avtobus to'xtaydigan joy) — o'ng chekka qator
  stopPos(b) {
    const ax = roadPos(b.fi), az = roadPos(b.fj), dx = Math.sign(roadPos(b.ti) - ax), dz = Math.sign(roadPos(b.tj) - az);
    return { x: ax + dx * b.s - dz * 5.5, z: az + dz * b.s + dx * 5.5, h: Math.atan2(dx, dz) };
  },
  // Yo'nalish: eng yaqin bekatdan boshlab, har safar keyingi yaqin bekat (5 ta)
  makeRoute(c) {
    const all = World.busStopList.map(b => ({ ...this.stopPos(b), b }));
    if (all.length < 3) return false;
    const route = [];
    let x = c.x, z = c.z;
    for (let n = 0; n < 5; n++) {
      let best = null, bd = 1e18;
      for (const s of all) {
        if (route.includes(s)) continue;
        const d = dist2(x, z, s.x, s.z);
        if (d > 40 * 40 && d < bd) { bd = d; best = s; }
      }
      if (!best) break;
      best.name = streetAt(best.x, best.z) || districtAt(best.x, best.z);
      route.push(best); x = best.x; z = best.z;
    }
    this.route = route; this.idx = 0;
    return route.length >= 2;
  },
  startLeg(c) {
    const s = this.route[this.idx], d = Math.hypot(s.x - c.x, s.z - c.z);
    this.time = Math.round(d / 7 + 25); this.hits = 0;
  },
  update(dt) {
    if (!this.active) return;
    const c = Player.inCar;
    if (!c || c.type !== 'bus' || c.dead) return this.stop('Avtobusdan tushdingiz — ish to\'xtatildi.');
    const s = this.route[this.idx], d = Math.hypot(s.x - c.x, s.z - c.z);
    // Bekatda: eshiklar ochiq, yo'lovchilar tushib-chiqadi
    if (this.dwell > 0) {
      this.dwell -= dt;
      HUD.timer(null);
      HUD.objective(`<em>${s.name}</em> bekati — yo'lovchilar tushmoqda va chiqmoqda…`);
      if (this.dwell <= 0) this.depart(c, s);
      return;
    }
    this.time -= dt;
    HUD.timer(Math.max(0, this.time));
    HUD.objective(`Bekat <em>${this.idx + 1}/${this.route.length}</em>: ${s.name} · yo'lovchilar ${this.onboard}`);
    if (d < 11 && c.speed < 1.5) this.arrive(c, s);
  },
  arrive(c, s) {
    this.dwell = 3.5;
    SFX.door();
    HUD.help(`${pick(BUS_STOP_SAY)}: <b>${s.name}</b>`, 2.5);
    // Tushayotgan yo'lovchilar bekat yonida paydo bo'ladi
    const off = Math.min(this.onboard, randi(1, 3)), b = blockAt(s.x - Math.cos(s.h) * 6, s.z + Math.sin(s.h) * 6) || nearestBlock(s.x, s.z);
    for (let k = 0; k < off; k++) {
      const p = new Ped(b, ringT(b, s.x, s.z));
      p.x = c.x - Math.cos(c.h) * 2.4 + Math.sin(c.h) * (k - 1); p.z = c.z + Math.sin(c.h) * 2.4 + Math.cos(c.h) * (k - 1);
      Game.peds.push(p);
    }
    this.leaving = off;
  },
  depart(c, s) {
    const late = this.time < 0, on = randi(1, 4);
    // Yo'l haqi: tushganlar uchun $4, vaqtida kelsa qo'shimcha; urilishlar uchun ayiriladi
    const pay = Math.max(0, this.leaving * 4 + (late ? 0 : 6 + Math.round(this.time * 0.4)) - this.hits * 4);
    this.onboard = clamp(this.onboard - this.leaving + on, 0, 40);
    this.earned += pay;
    if (pay) { addMoney(pay); SFX.coin(); }
    Stats.add('busStops');
    this.idx++;
    if (this.idx >= this.route.length) {
      const bonus = 40 + this.route.length * 10;
      addMoney(bonus); this.earned += bonus; Stats.add('busRoutes'); Save.soon();
      toast('Avtobus', `Yo'nalish tugadi: +$${this.earned}`, `Bekatlar: ${this.route.length}, mukofot $${bonus}`);
      if (!this.makeRoute(c)) return this.stop('Yangi yo\'nalish topilmadi.');
      this.earned = 0;
      HUD.help(`Yangi yo'nalish: ${this.route.length} ta bekat.`, 3);
    } else HUD.help(`${late ? 'Kechikdingiz. ' : ''}Keyingi bekat: <b>${this.route[this.idx].name}</b>` + (pay ? ` · +$${pay}` : ''), 3);
    this.startLeg(c);
  },
  onCrash(imp) {
    if (!this.active || imp < 6) return;
    this.hits++;
    HUD.help(pick(['Yo\'lovchilar: «Ehtiyot bo\'ling!»', 'Yo\'lovchilar yiqilib tushdi!', 'Yo\'lovchilar norozi']), 2);
  },
  target() { return this.active && this.route[this.idx] ? this.route[this.idx] : null; },
  blips() {
    if (!this.active) return [];
    return this.route.slice(this.idx).map((s, k) => ({ x: s.x, z: s.z, color: '#4fc3f7', size: k ? 6 : 8, edge: !k, label: k ? '' : 'A' }));
  },
};
