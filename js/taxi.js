'use strict';
// ===== Taksi ishi: yo'lovchini olib, manziliga yetkazish =====
const TAXI_HELLO = ['Assalomu alaykum!', 'Salom, aka!', 'Yaxshimisiz!', 'Iltimos, tezroq,'];
const TAXI_HIT = ['Yo\'lovchi: «Ehtiyot bo\'ling!»', 'Yo\'lovchi: «Voy, sekinroq!»', 'Yo\'lovchi: «Mashinani buzasiz-ku!»'];
const Taxi = {
  active: false, stage: 'idle', pass: null, outfit: null, dest: null, time: 0, fare: 0, hits: 0, wait: 0,
  toggle() {
    if (this.active) return this.stop('Taksi ishi tugatildi.');
    const c = Player.inCar;
    if (!c || c.type !== 'taxi') return HUD.help('Taksi ishi uchun sariq taksiga o\'tiring.', 3);
    if (Missions.active) return HUD.help('Avval boshlangan vazifani tugating.', 3);
    this.active = true;
    HUD.help('Taksi ishi boshlandi! Yo\'lovchilarni manziliga yetkazing. <kbd>T</kbd> — tugatish', 4);
    this.nextFare();
  },
  stop(msg) {
    if (this.pass) { this.pass.keep = false; if (this.pass.state === 'hail') this.pass.state = 'walk'; }
    this.active = false; this.stage = 'idle'; this.pass = null; this.dest = null;
    HUD.objective(null); HUD.timer(null);
    if (msg) HUD.help(msg, 3);
  },
  // Yo'lak chetidagi tasodifiy nuqta (min–max masofada)
  spot(minD, maxD) {
    const P = Player;
    for (let k = 0; k < 40; k++) {
      const b = World.blocks[randi(0, CITY.N - 1)][randi(0, CITY.N - 1)], t = rand(0, b.ring.P), [x, z] = ringPoint(b, t);
      const d = Math.hypot(x - P.x, z - P.z);
      if (d > minD && d < maxD) return { b, t, x, z, d };
    }
    return null;
  },
  nextFare() {
    this.stage = 'pickup'; this.wait = 0;
    const s = this.spot(70, 220);
    if (!s) return;
    const p = new Ped(s.b, s.t);
    p.state = 'hail'; p.keep = true;
    Game.peds.push(p);
    this.pass = p; this.outfit = p.outfit;
  },
  update(dt) {
    if (!this.active) return;
    const P = Player, c = P.inCar;
    if (!c || c.type !== 'taxi' || c.dead) return this.stop('Taksidan tushdingiz — ish to\'xtatildi.');
    if (this.stage === 'pickup') {
      const p = this.pass;
      if (!p || !p.alive || p.state !== 'hail') {
        if (p) p.keep = false;
        this.pass = null;
        if ((this.wait += dt) > 2) { HUD.help('Yo\'lovchi ketib qoldi. Yangisini qidiring.', 2.5); this.nextFare(); }
        return;
      }
      HUD.objective('Yo\'lovchini oling — xaritada <em>sariq</em> belgi');
      HUD.timer(null);
      if (Math.hypot(p.x - c.x, p.z - c.z) < 9 && c.speed < 2) {
        p.remove(); Game.peds.splice(Game.peds.indexOf(p), 1); this.pass = null;
        const s = this.spot(250, 600) || this.spot(150, 700);
        const name = Landmarks.nameAt(s.x, s.z) || streetAt(s.x, s.z);
        this.dest = { x: s.x, z: s.z, name };
        this.time = Math.round(s.d / 9 + 25); this.fare = Math.round(15 + s.d * 0.09); this.hits = 0;
        this.stage = 'ride'; SFX.door();
        HUD.help(`Yo'lovchi: «${pick(TAXI_HELLO)} ${name}ga olib boring.»`, 4);
      }
    } else if (this.stage === 'ride') {
      this.time -= dt;
      HUD.timer(this.time);
      HUD.objective(`Manzil: <em>${this.dest.name}</em>`);
      const d = Math.hypot(this.dest.x - c.x, this.dest.z - c.z);
      if (this.time <= 0) {
        this.dropOff(c);
        HUD.help('Yo\'lovchi kutib charchadi va tushib ketdi. Pul yo\'q.', 3);
        this.nextFare();
      } else if (d < 13 && c.speed < 2.5) {
        const tip = Math.max(0, Math.round(this.time * 1.5) - this.hits * 8), pay = this.fare + tip;
        addMoney(pay); Stats.add('fares'); Save.soon();
        this.dropOff(c);
        toast('Taksi', `+$${pay}`, tip > 0 ? `Yo'l haqi $${this.fare} + choychaqa $${tip}` : `Yo'l haqi $${this.fare}`);
        SFX.coin();
        this.nextFare();
      }
    }
  },
  dropOff(c) {
    const b = blockAt(c.x, c.z) || nearestBlock(c.x, c.z), p = new Ped(b, ringT(b, c.x, c.z), this.outfit);
    p.x = c.x - Math.cos(c.h) * 2.2; p.z = c.z + Math.sin(c.h) * 2.2; // o'ng tomon — yo'lak
    Game.peds.push(p);
  },
  onCrash(imp) {
    if (this.stage !== 'ride' || imp < 6) return;
    this.hits++;
    HUD.help(pick(TAXI_HIT), 2);
  },
  target() {
    if (!this.active) return null;
    if (this.stage === 'pickup' && this.pass) return { x: this.pass.x, z: this.pass.z };
    return this.stage === 'ride' ? this.dest : null;
  },
  blips() { const t = this.target(); return t ? [{ x: t.x, z: t.z, color: '#ffd21f', size: 8, edge: true, label: 'T' }] : []; },
};
