'use strict';
// ===== Avtodrom: haydovchilik guvohnomasi (prava) imtihoni — YIM tartibidagi 15 ta mashq =====
// Kvartal (5,2) ichida kichik yo'l to'ri: yo'llar x, z = -20, 0, 20 (kengligi 6 m), markaziy chorrahada svetofor.
// Koordinatalar kvartal markaziga nisbatan. Mashina uchun "o'ng" vektori: r = (-dz, dx); mahalliy +x — chap tomon.
const AD_ROADS = [-20, 0, 20], AD_W = 3, AD_END = 23;
const AD_RAMP = { x0: -23, x1: -17, prof: [[3, 0], [8, 0.9], [12, 0.9], [17, 0]], stop: 6.5 };
const AD_ZEBRA = { x0: -23, x1: -17, z0: -10.5, z1: -7.5 };
const AD_BOX = { x0: 9.5, x1: 12.5, z0: 3, z1: 9 };
const AD_POCKET = { x0: 7, x1: 14, z0: -25.6, z1: -23.2 };
const AD_RAIL = { z: 11, stop: 8.5 };
const AD_SNAKE = [-5.5, -10, -14.5];
const AD_FINISH = { x0: -17, x1: -10 };
const AD_FEE = 50, AD_MAX_ERR = 5, AD_TIME = 25 * 60;
const AD_TOL = 0.25;
// Mashqlar (YIM ro'yxati bo'yicha) va yo'l ko'rsatkich nuqtalari (o'ng qator markazi)
const AD_EX = [
  { id: 'start', name: 'Harakatni boshlash (Start)', tip: 'Chap burilish chirog\'ini yoqing va harakatni boshlang. Tezlik 20 km/soatdan oshmasin, har burilishda chiroq yoqing', guide: [[-21.5, -14]] },
  { id: 'zebra', name: 'Piyodalar o\'tish joyi', tip: 'Piyodaga yo\'l bering — u o\'tib bo\'lguncha to\'xtab turing', guide: [[-21.5, -4]] },
  { id: 'ramp', name: 'To\'xtash va tik balandlikka ko\'tarilish (estakada)', tip: 'Estakadadagi STOP chizig\'i oldida to\'xtang, so\'ng orqaga sirpanmasdan davom eting (qo\'l tormozi yordam beradi)', guide: [[-21.5, 18]] },
  { id: 'turns', name: '90 gradus burchak ostida burilishlar', tip: 'Ikki marta chapga buriling, chiziqlardan chiqmang, burilish chirog\'ini yoqing', guide: [[-18, 21.5], [-3, 21.5], [1.5, 17], [1.5, 8]], nodes: [[-20, 20, -1], [0, 20, -1]] },
  { id: 'light1', name: 'Harakat tartibga solingan chorraha (to\'g\'riga)', tip: 'Svetoforga qarang: qizilda to\'xtash chizig\'i oldida to\'xtang, yashilda to\'g\'riga o\'ting', guide: [[1.5, -6]] },
  { id: 'snake', name: 'Ilon izi', tip: 'Konuslar orasidan ilonsimon o\'ting — birinchisini o\'ng tomondan', guide: [[-3, -21.5], [-18, -21.5]], nodes: [[0, -20, -1]] },
  { id: 'light2', name: 'Harakat tartibga solingan chorraha (to\'g\'riga)', tip: 'Chorrahadan to\'g\'riga o\'ting', guide: [[-21.5, -16], [-21.5, -3], [-18, 1.5], [6, 1.5]], nodes: [[-20, -20, -1], [-20, 0, -1]] },
  { id: 'box', name: 'Tor joyda qayrilib olish uchun boksga kirish', tip: 'Boksdan o\'ting, uzatmani R ga o\'tkazib orqa bilan kiring va to\'xtang, so\'ng D da chiqib orqaga qayting', guide: [[15.5, 1.5], [11, 6], [6, -1.5]] },
  { id: 'light3', name: 'Harakat tartibga solingan chorraha (chapga burilish)', tip: 'Chorrahada chapga buriling', guide: [[3, -1.5], [-1.5, 3], [-1.5, 5]], nodes: [[0, 0, -1]] },
  { id: 'rail', name: 'Temir yo\'l kesishmasi', tip: 'STOP belgisi: temir yo\'l oldidagi chiziqda to\'liq to\'xtang', guide: [[-1.5, 8], [-1.5, 15]] },
  { id: 'accel', name: 'Tezlashish bo\'lagi', tip: 'Bu bo\'lakda 25–40 km/soat gacha tezlashing', guide: [[3, 21.5], [18, 21.5], [21.5, 17], [21.5, 0]], nodes: [[0, 20, -1], [20, 20, -1]] },
  { id: 'brake', name: 'Avariya holatda to\'xtash', tip: 'Qizil «STOP» chiqishi bilan darhol to\'xtang', guide: [[21.5, -10]] },
  { id: 'park', name: 'Orqaga harakatlanib parallel to\'xtash (parkovka)', tip: 'Joydan o\'tib, uzatmani R ga o\'tkazing va orqa bilan kirib, yo\'lga parallel to\'xtang (keyin D)', guide: [[18, -21.5], [4, -21.5], [10.5, -24.4], [2, -21.5]], nodes: [[20, -20, -1]] },
  { id: 'light4', name: 'Harakat tartibga solingan chorraha (o\'ngga burilish)', tip: 'Burchakda chapga, chorrahada o\'ngga buriling (burilish chiroqlari bilan)', guide: [[-1.5, -16], [-1.5, -5], [-5, -1.5]], nodes: [[0, -20, -1], [0, 0, 1]] },
  { id: 'finish', name: 'Harakatni yakunlash (Finish)', tip: 'FINISH chizig\'idan keyin to\'xtang', guide: [[-13, -1.5]] },
];

function adTexSign(draw, w, h) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = Math.round(256 * h / w);
  draw(cv.getContext('2d'), cv.width, cv.height);
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, side: THREE.DoubleSide }));
}

const Autodrom = {
  blk: null, active: false, hint: null, car: null, ex: 0, err: 0, errs: [], time: 0, lock: false, endT: 0, result: null,
  // Kvartal markazidan dunyo koordinatasiga
  W(x, z) { return { x: this.blk.cx + x, z: this.blk.cz + z }; },
  build(blk, scene) {
    this.blk = blk;
    const { cx, cz } = blk, P = [], Y = 0.19, WHITE = 0xeeeeea, YEL = 0xf2c230;
    const box = (w, d, x, z, color, h = 0.02, y = Y) => P.push([w, h, d, cx + x, y + h / 2, cz + z, color]);
    // Yo'llar orasidagi maysazorlar (boks joyi — asfalt)
    for (const sx of [-10, 10]) for (const sz of [-10, 10]) box(14, 14, sx, sz, 0x5f8c45, 0.06);
    box(3, 6, 11, 6, 0x46484d, 0.07);
    // Yo'l chetidagi chiziqlar (chorrahalarda uziladi) va o'rtadagi uzuq chiziq
    const gaps = c => AD_ROADS.some(r => Math.abs(c - r) < AD_W + 0.1);
    for (const c of AD_ROADS) for (let t = -AD_END; t < AD_END; t += 0.5) {
      if (gaps(t + 0.25)) continue;
      for (const e of [-AD_W, AD_W]) { box(0.15, 0.5, c + e, t + 0.25, WHITE); box(0.5, 0.15, t + 0.25, c + e, WHITE); }
      if (Math.floor((t + AD_END) / 1.5) % 2 === 0) { box(0.12, 0.5, c, t + 0.25, WHITE); box(0.5, 0.12, t + 0.25, c, WHITE); }
    }
    // Piyodalar o'tish joyi (zebra)
    for (let x = -22.5; x <= -17.5; x += 1) box(0.5, 3, x, -9, WHITE);
    // Chorrahadagi to'xtash chiziqlari (har yo'nalishning o'ng qatorida)
    box(3, 0.4, -1.5, -4.5, WHITE); box(3, 0.4, 1.5, 4.5, WHITE); box(0.4, 3, -4.5, 1.5, WHITE); box(0.4, 3, 4.5, -1.5, WHITE);
    // Temir yo'l: relslar, shpallar, to'xtash chizig'i
    box(3, 0.4, -1.5, AD_RAIL.stop, WHITE);
    for (const rz of [AD_RAIL.z - 0.4, AD_RAIL.z + 0.4]) box(7.2, 0.1, 0, rz, 0x8a8f96, 0.12);
    for (let x = -3.4; x <= 3.4; x += 0.8) box(0.25, 1.6, x, AD_RAIL.z, 0x4a3a2a, 0.06);
    // Start va finish chiziqlari
    box(3, 0.4, -21.5, -21.2, WHITE); box(0.4, 3, -12, -1.5, WHITE);
    // Boks va parkovka joyi chiziqlari
    box(0.15, 6, AD_BOX.x0, 6, WHITE); box(0.15, 6, AD_BOX.x1, 6, WHITE); box(3, 0.15, 11, AD_BOX.z1, WHITE);
    box(7, 0.15, 10.5, AD_POCKET.z0, WHITE); box(0.15, 2.4, AD_POCKET.x0, -24.4, WHITE); box(0.15, 2.4, AD_POCKET.x1, -24.4, WHITE);
    // Estakada (beton, chetlari sariq) va undagi STOP chizig'i
    const R = AD_RAMP, shape = new THREE.Shape();
    shape.moveTo(R.prof[0][0], 0); for (const [z, h] of R.prof.slice(1)) shape.lineTo(z, h); shape.closePath();
    const rg = new THREE.ExtrudeGeometry(shape, { depth: R.x1 - R.x0, bevelEnabled: false }).rotateY(-Math.PI / 2).translate(cx + R.x1, 0.15, cz);
    P.push({ geo: rg, color: 0x9a968e });
    const a = Math.atan(0.9 / 5), sh = 0.9 * (R.stop - 3) / 5;
    P.push({ geo: new THREE.BoxGeometry(R.x1 - R.x0 - 0.4, 0.03, 0.4).rotateX(-a).translate(cx + (R.x0 + R.x1) / 2, 0.15 + sh + 0.03, cz + R.stop), color: WHITE });
    for (const ex of [R.x0 + 0.1, R.x1 - 0.1]) P.push({ geo: new THREE.BoxGeometry(0.2, 0.92, 9).translate(cx + ex, 0.15 + 0.46, cz + 10), color: YEL });
    addMerged(scene, P);
    HEIGHT_ZONES.push({ rect: true, x0: cx + R.x0, x1: cx + R.x1, z0: cz + R.prof[0][0], z1: cz + R.prof[R.prof.length - 1][0], prof: R.prof.map(([z, h]) => [cz + z, h]), base: 0.15 });

    // Svetofor: har yo'nalish uchun o'ng-yaqin burchakda, haydovchiga qaragan
    const lamp = c => new THREE.MeshBasicMaterial({ color: c });
    this.lights = { z: { r: lamp(0x330808), y: lamp(0x332a08), g: lamp(0x08330f) }, x: { r: lamp(0x330808), y: lamp(0x332a08), g: lamp(0x08330f) } };
    const pole = new THREE.MeshLambertMaterial({ color: 0x2f3237 }), lampGeo = new THREE.CircleGeometry(0.13, 16);
    for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const rx = -dz, rz = dx, px = -3.8 * dx + 3.8 * rx, pz = -3.8 * dz + 3.8 * rz, M = this.lights[dz ? 'z' : 'x'];
      const g = new THREE.Group(); g.position.set(cx + px, 0.15, cz + pz); g.rotation.y = Math.atan2(-dx, -dz);
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3), pole); p.position.y = 1.5;
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.0, 0.25), pole); head.position.y = 3.2;
      g.add(p, head);
      [['r', 3.52], ['y', 3.2], ['g', 2.88]].forEach(([k, y]) => { const l = new THREE.Mesh(lampGeo, M[k]); l.position.set(0, y, 0.13); g.add(l); });
      scene.add(g);
    }
    // Temir yo'l belgilari: "STOP" va Andreyev xochi (o'ng tomonda)
    const stop = adTexSign((g, w, h) => {
      g.fillStyle = '#c62828'; g.beginPath();
      for (let k = 0; k < 8; k++) { const t = (k + 0.5) / 8 * Math.PI * 2; g.lineTo(w / 2 + Math.cos(t) * w * 0.48, h / 2 + Math.sin(t) * h * 0.48); }
      g.fill(); g.fillStyle = '#fff'; g.font = 'bold 70px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('STOP', w / 2, h / 2 + 4);
    }, 0.8, 0.8);
    stop.position.set(cx - 3.8, 2.0, cz + AD_RAIL.stop - 0.3); stop.rotation.y = Math.PI; scene.add(stop);
    const crossM = new THREE.MeshLambertMaterial({ color: 0xf2f2f0 });
    for (const s of [1, -1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.18, 0.03), crossM); b.position.set(cx - 3.8, 2.9, cz + AD_RAIL.stop - 0.3); b.rotation.z = s * 0.6; scene.add(b); }
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.2), pole); sp.position.set(cx - 3.8, 1.75, cz + AD_RAIL.stop - 0.25); scene.add(sp);
    // Avariya to'xtash chirog'i (tezlashish bo'lagi oxirida)
    this.alarmMat = lamp(0x330808);
    const ap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.6), pole); ap.position.set(cx + 24, 1.45, cz - 2); scene.add(ap);
    const al = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), this.alarmMat); al.position.set(cx + 24, 2.9, cz - 2); scene.add(al);
    // Konuslar (bitta InstancedMesh): ilon izi, boks va parkovka burchaklari
    this.coneDefs = [...AD_SNAKE.map(x => [x, -20]), [AD_BOX.x0, 9], [AD_BOX.x1, 9], [AD_BOX.x0, 6], [AD_BOX.x1, 6],
      [AD_POCKET.x0, AD_POCKET.z0], [AD_POCKET.x1, AD_POCKET.z0], [AD_POCKET.x0, AD_POCKET.z1], [AD_POCKET.x1, AD_POCKET.z1]];
    const cg = mergeParts([{ geo: new THREE.ConeGeometry(0.2, 0.62, 10).translate(0, 0.35, 0), color: 0xff6d00 },
      { geo: new THREE.CylinderGeometry(0.13, 0.15, 0.1, 10).translate(0, 0.42, 0), color: 0xffffff }, [0.42, 0.04, 0.42, 0, 0.02, 0, 0x222222]]);
    this.cones = new THREE.InstancedMesh(cg, LM_MAT, this.coneDefs.length);
    this.cones.castShadow = true; scene.add(this.cones);
    this.resetCones();
    // Belgilar va taxtachalar
    const board = (text, x, z, rot, w = 2.6, bg = '#1565c0') => { const s = signMesh(text, w, 0.6, bg); s.position.set(cx + x, 2.2, cz + z); s.rotation.y = rot; scene.add(s);
      const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2), pole); pl.position.set(cx + x, 1.15, cz + z); scene.add(pl); };
    board('START', -24.2, -19, Math.PI / 2, 1.8, '#2e7d32');
    board('PIYODA O\'TISH JOYI', -24.2, -12, Math.PI / 2, 3.2);
    board('ESTAKADA', -24.2, 2, Math.PI / 2, 2.2);
    board('BOKS', 14, 9.6, Math.PI, 1.6);
    board('PARKOVKA', 15, -26, 0, 2.2);
    board('FINISH', -12, -3.6, 0, 1.8, '#c62828');
    const big = signMesh('AVTODROM · PRAVA IMTIHONI', 8, 1.1, '#2e7d32');
    big.position.set(cx - 22, 3.4, cz - 27.6); big.rotation.y = Math.PI; scene.add(big);
    // Imtihonchi va boshlash joyi (yashil halqa)
    this.spot = this.W(-25.5, -25.5);
    this.ring = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 1.2, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0x7ee0a1, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }));
    this.ring.position.set(this.spot.x, 0.75, this.spot.z); scene.add(this.ring);
    this.beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 14, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0x7ee0a1, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }));
    this.beacon.visible = false; scene.add(this.beacon);
    Landmarks.areas.push({ b: blk, name: 'Avtodrom' });
  },
  // Imtihonchi (odam modellari tayyor bo'lgach)
  placeInstructor() {
    if (!this.blk || this.inst) return;
    const hm = makeHuman(randomOutfit('suit')), s = this.W(-26.6, -24.2);
    hm.g.position.set(s.x, groundH(s.x, s.z), s.z); hm.g.rotation.y = Math.PI * 0.75;
    poseHuman(hm, 0, 0, 0);
    World.scene.add(hm.g); this.inst = hm;
  },
  resetCones() {
    const m = new THREE.Matrix4();
    this.coneHit = this.coneDefs.map(() => false);
    this.coneDefs.forEach(([x, z], i) => this.cones.setMatrixAt(i, m.makeTranslation(this.blk.cx + x, 0.19, this.blk.cz + z)));
    this.cones.instanceMatrix.needsUpdate = true;
  },
  knockCone(i, c) {
    this.coneHit[i] = true;
    const [x, z] = this.coneDefs[i], q = new THREE.Quaternion().setFromEuler(new THREE.Euler(1.45, c.h, 0, 'YXZ'));
    this.cones.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(this.blk.cx + x + Math.sin(c.h) * 0.5, 0.25, this.blk.cz + z + Math.cos(c.h) * 0.5), q, new THREE.Vector3(1, 1, 1)));
    this.cones.instanceMatrix.needsUpdate = true;
  },
  // Svetofor: z o'qi 10 s yashil, 2 s sariq; keyin x o'qi
  lightOf(axis) {
    const t = (this.active ? AD_TIME - this.time : Game.time) % 24; // imtihonda — o'tgan vaqt bo'yicha
    const zs = t < 10 ? 'g' : t < 12 ? 'y' : 'r', xs = t < 12 ? 'r' : t < 22 ? 'g' : 'y';
    return axis === 'z' ? zs : xs;
  },
  updateLights() {
    for (const axis of ['z', 'x']) {
      const s = this.lightOf(axis), M = this.lights[axis];
      M.r.color.setHex(s === 'r' ? 0xff2a1a : 0x330808); M.y.color.setHex(s === 'y' ? 0xffc21a : 0x332a08); M.g.color.setHex(s === 'g' ? 0x2cff6a : 0x08330f);
    }
  },
  // ----- Imtihonni boshlash -----
  canStart() {
    const P = Player;
    if (Game.wanted) return 'Politsiya qidirayotgan odam imtihon topshira olmaydi.';
    if (Missions.active || Taxi.active || BusJob.active) return 'Avval boshlangan ishni tugating.';
    if (P.money < AD_FEE) return `Imtihon haqi $${AD_FEE}. Pulingiz yetmaydi.`;
    return null;
  },
  start() {
    const why = this.canStart();
    if (why) { HUD.help(`<b>Imtihonchi:</b> ${why}`, 4); return; }
    const P = Player;
    addMoney(-AD_FEE);
    if (P.inCar) exitCar();
    // Avtodrom ichidagi begona mashinalarni chetga
    for (const o of Game.cars) if (Math.abs(o.x - this.blk.cx) < 28 && Math.abs(o.z - this.blk.cz) < 28) { o.x += 70; o.sync(0); }
    const s = this.W(-21.5, -19.5), c = new Car('cobalt', s.x, s.z, 0, 'parked', 0xf3f3f0);
    c.persist = true; c.examCar = true; c.setPlate('01 YIM ' + String(randi(1, 99)).padStart(2, '0'));
    // Tomida "U" (o'quv) belgisi
    const T = c.T, u = adTexSign((g, w, h) => {
      g.fillStyle = '#c62828'; g.beginPath(); g.moveTo(w / 2, 4); g.lineTo(w - 4, h - 4); g.lineTo(4, h - 4); g.closePath(); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(w / 2, 34); g.lineTo(w - 30, h - 18); g.lineTo(30, h - 18); g.closePath(); g.fill();
      g.fillStyle = '#111'; g.font = 'bold 100px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('U', w / 2, h * 0.64);
    }, 0.42, 0.38);
    if (T.roof) { u.position.set(0, T.roof[0] + 0.2, T.roof[1]); c.body.add(u); }
    Game.cars.push(c);
    enterCar(c);
    Object.assign(this, { active: true, car: c, ex: 0, gi: 0, err: 0, errs: [], time: AD_TIME, endT: 0, result: null, startZ: c.z, moved: false, sigOk: false,
      nodeDone: {}, lineEx: -1, overSpeed: false, ped: null, pedDone: false, rampS: 'go0', rampHold: 0, rampZ: 0, rampMaxH: 0, snakeI: 0,
      boxS: 0, boxT: 0, railS: 0, accelMax: 0, trig: rand(-5, -1), brakeS: 0, brakeZ: 0, parkS: 0, parkT: 0, prevX: c.x, prevZ: c.z });
    this.resetCones(); this.alarmMat.color.setHex(0x330808);
    HUD.big('PRAVA IMTIHONI', 'Chap burilish chirog\'ini yoqib, harakatni boshlang', 'passed'); Game.bigT = 3;
    this.announce();
  },
  announce() {
    const E = AD_EX[this.ex];
    HUD.help(`<b>${this.ex + 1}/${AD_EX.length} · ${E.name}</b><br>${E.tip}`, 6);
    this.gi = 0;
  },
  mistake(text) {
    this.err++; this.errs.push(text); SFX.click();
    HUD.help(`<b>Xato ${this.err}/${AD_MAX_ERR}:</b> ${text}`, 3);
    if (this.err >= AD_MAX_ERR) this.end(false, `${AD_MAX_ERR} ta xato`);
  },
  next() {
    this.ex++;
    if (this.ex >= AD_EX.length) return this.end(true);
    SFX.coin(); this.announce();
  },
  end(ok, reason) {
    if (!this.active || this.result) return;
    this.result = ok ? 'pass' : 'fail'; this.endT = 3.5;
    this.alarmMat.color.setHex(0x330808); this.beacon.visible = false;
    if (ok) {
      const first = !Stats.d.license;
      Stats.d.license = 1; Save.soon();
      HUD.big('O\'TDI', first ? 'Haydovchilik guvohnomasi (prava) berildi!' : `Xatolar: ${this.err}`, 'passed');
      if (first) toast('Prava', 'Haydovchilik guvohnomasi', '«B» toifasi · avtodrom imtihoni topshirildi');
    } else HUD.big('O\'TMADI', reason || 'Imtihon to\'xtatildi', 'wasted');
    Game.bigT = 3.4;
  },
  finishUp() {
    const c = this.car, P = Player;
    if (P.inCar === c) exitCar();
    if (c) { const i = Game.cars.indexOf(c); if (i >= 0) Game.cars.splice(i, 1); c.remove(); }
    if (this.ped) { World.scene.remove(this.ped.g); this.ped = null; }
    P.x = this.spot.x + 1.5; P.z = this.spot.z + 1.5; P.y = groundH(P.x, P.z);
    this.active = false; this.car = null; this.lock = true; this.hint = null;
    HUD.objective(null); HUD.timer(null);
  },
  // ----- Har kadr -----
  update(dt) {
    if (!this.blk) return;
    this.updateLights();
    const P = Player;
    this.ring.rotation.y += dt; this.ring.visible = !this.active;
    if (!this.active) {
      this.hint = null;
      const d = Math.hypot(P.x - this.spot.x, P.z - this.spot.z), r = P.inCar ? 4.5 : 1.8;
      if (d > r + 2) this.lock = false;
      if (!this.lock && !P.dead && d < r && (!P.inCar || P.inCar.speed < 2)) { this.lock = true; this.start(); }
      return;
    }
    if (this.result) { this.endT -= dt; if (this.endT <= 0) this.finishUp(); return; }
    const c = this.car;
    if (P.dead || !c || c.dead) return this.end(false, 'Mashina buzildi');
    if (P.inCar !== c) return this.end(false, 'Mashinadan tushdingiz');
    this.time -= dt;
    HUD.timer(this.time);
    if (this.time <= 0) return this.end(false, 'Vaqt tugadi');
    const lx = c.x - this.blk.cx, lz = c.z - this.blk.cz, kmh = c.speed * 3.6, E = AD_EX[this.ex];
    if (Math.abs(lx) > 27.5 || Math.abs(lz) > 27.5) return this.end(false, 'Avtodrom hududidan chiqdingiz');
    // Umumiy qoidalar: tezlik, chiziqlar, konuslar, svetofor, burilish chiroqlari
    const fast = E.id === 'accel' || (E.id === 'brake' && !this.brakeS);
    if (kmh > (fast ? 45 : 25)) { if (!this.overSpeed) { this.overSpeed = true; this.mistake(fast ? 'Tezlik 40 km/soatdan oshdi' : 'Tezlik 20 km/soatdan oshdi'); } }
    else if (kmh < (fast ? 40 : 20)) this.overSpeed = false;
    // Chiziqlar faqat chiziq bilan belgilangan mashqlarda tekshiriladi (har mashqda bir marta)
    const zone = E.id === 'turns' || (E.id === 'snake' && lx < -2) || (E.id === 'box' && lx > 7) || (E.id === 'park' && lx < 16);
    if (zone && this.lineEx !== this.ex) {
      const inside = this.corners(c, lx, lz).every(([x, z]) => this.allowed(x, z));
      if (!inside) { this.lineEx = this.ex; this.mistake('Chiziqdan chiqdingiz'); }
    }
    this.coneDefs.forEach(([x, z], i) => {
      if (this.coneHit[i]) return;
      for (const s of carCircles(c.T)) if (Math.hypot(lx + Math.sin(c.h) * s - x, lz + Math.cos(c.h) * s - z) < c.T.w / 2 + 0.05) { this.knockCone(i, c); this.mistake('Konusga tegdingiz'); return; }
    });
    // Markaziy chorraha: qizilda kirish — qo'pol xato
    const pl = this.prevX - this.blk.cx, pz = this.prevZ - this.blk.cz;
    const inBox = (x, z) => Math.abs(x) < AD_W + 0.2 && Math.abs(z) < AD_W + 0.2;
    if (inBox(lx, lz) && !inBox(pl, pz)) {
      const axis = Math.abs(pl) > Math.abs(pz) ? 'x' : 'z';
      if (this.lightOf(axis) === 'r') return this.end(false, 'Qizil chiroqda o\'tdingiz');
    }
    this.prevX = c.x; this.prevZ = c.z;
    this.hint = null;
    for (const [nx, nz, want] of E.nodes || []) {
      const key = this.ex + ':' + nx + ',' + nz;
      if (!this.nodeDone[key] && c.signal !== want && Math.abs(lx - nx) < 14 && Math.abs(lz - nz) < 14)
        this.hint = Input.touch ? `Burilishdan oldin ${want < 0 ? 'chap' : 'o\'ng'} burilish chirog'ini yoqing` : `<kbd>${want < 0 ? 'Z' : 'C'}</kbd> ${want < 0 ? 'chapga' : 'o\'ngga'} burilish chirog'ini yoqing`;
      if (this.nodeDone[key] || Math.abs(lx - nx) > AD_W + 0.5 || Math.abs(lz - nz) > AD_W + 0.5) continue;
      this.nodeDone[key] = true;
      if (c.signal !== want) this.mistake(want < 0 ? 'Chapga burilish chirog\'i yoqilmadi' : 'O\'ngga burilish chirog\'i yoqilmadi');
    }
    // Yo'l ko'rsatkichi
    const g = E.guide[this.gi];
    if (g && Math.hypot(lx - g[0], lz - g[1]) < 4.5 && this.gi < E.guide.length - 1 && !(E.id === 'box' && this.gi === 1) && !(E.id === 'park' && this.gi === 2)) this.gi++;
    const tg = E.guide[Math.min(this.gi, E.guide.length - 1)], tw = this.W(tg[0], tg[1]);
    this.beacon.visible = true; this.beacon.position.set(tw.x, 7, tw.z);
    HUD.objective(`Prava imtihoni · <em>${this.ex + 1}/${AD_EX.length}</em> ${E.name} · xatolar ${this.err}/${AD_MAX_ERR}`);
    this['x_' + E.id](c, lx, lz, kmh, dt);
  },
  corners(c, lx, lz) {
    const fx = Math.sin(c.h), fz = Math.cos(c.h), rx = -fz, rz = fx, L = c.T.l / 2 - 0.1, Wd = c.T.w / 2 - 0.08;
    return [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => [lx + fx * L * a + rx * Wd * b, lz + fz * L * a + rz * Wd * b]);
  },
  // Ruxsat etilgan joy: yo'llar, mashq vaqtida boks va parkovka joyi
  allowed(x, z) {
    const id = AD_EX[this.ex].id;
    const W = AD_W + AD_TOL, E = AD_END + AD_TOL;
    for (const c of AD_ROADS) {
      if (Math.abs(x - c) <= W && Math.abs(z) <= E) return true;
      if (Math.abs(z - c) <= W && Math.abs(x) <= E) return true;
    }
    if (id === 'box' && x >= AD_BOX.x0 && x <= AD_BOX.x1 && z >= AD_BOX.z0 - 0.5 && z <= AD_BOX.z1) return true;
    if (id === 'park' && x >= AD_POCKET.x0 && x <= AD_POCKET.x1 && z >= AD_POCKET.z0 && z <= AD_POCKET.z1 + 0.5) return true;
    return false;
  },
  inRect(c, lx, lz, R) { return this.corners(c, lx, lz).every(([x, z]) => x >= R.x0 - 0.05 && x <= R.x1 + 0.05 && z >= R.z0 - 0.05 && z <= R.z1 + 0.05); },
  // ----- Mashqlar -----
  x_start(c, lx, lz) {
    if (c.signal === -1) this.sigOk = true;
    if (!this.moved && Math.hypot(c.x - this.W(-21.5, -19.5).x, c.z - this.W(-21.5, -19.5).z) > 1.2) {
      this.moved = true;
      if (!this.sigOk) this.mistake('Harakatni boshlashda chap burilish chirog\'i yoqilmadi');
    }
    if (lz > -14) this.next();
  },
  x_zebra(c, lx, lz, kmh, dt) {
    // Piyoda: mashina yaqinlashganda yo'lni kesib o'tadi
    if (!this.ped && !this.pedDone && lz > -22) {
      const hm = makeHuman(randomOutfit()), s = this.W(-24, -9);
      hm.g.position.set(s.x, 0.15, s.z); hm.g.rotation.y = Math.PI / 2; World.scene.add(hm.g);
      this.ped = { hm, g: hm.g, x: -24, ph: 0 };
    }
    const p = this.ped;
    if (p) {
      p.x += 1.25 * dt; p.ph += dt * 5;
      const w = this.W(p.x, -9); p.g.position.set(w.x, groundH(w.x, w.z), w.z); poseHuman(p.hm, p.ph, 0.8, 0);
      const onRoad = p.x > AD_ZEBRA.x0 - 0.3 && p.x < AD_ZEBRA.x1 + 0.3;
      const front = lz + Math.cos(c.h) * c.T.l / 2;
      if (onRoad && front > AD_ZEBRA.z0 && lz < AD_ZEBRA.z1 + 2 && c.speed > 0.3) return this.end(false, 'Piyodaga yo\'l bermadingiz');
      if (p.x > -15) { World.scene.remove(p.g); this.ped = null; this.pedDone = true; }
    }
    if (lz > -4) { if (this.ped) { World.scene.remove(this.ped.g); this.ped = null; } this.next(); }
  },
  x_ramp(c, lx, lz, kmh, dt) {
    const front = lz + Math.cos(c.h) * c.T.l / 2, R = AD_RAMP;
    this.rampMaxH = Math.max(this.rampMaxH, groundH(c.x, c.z) - 0.15);
    if (this.rampS === 'go0') {
      if (front > R.stop + 0.25) { this.mistake('STOP chizig\'ida to\'xtamadingiz'); this.rampS = 'go'; this.rampZ = -1e9; }
      else if (front > R.stop - 1.6 && c.speed < 0.3) { this.rampHold += dt; if (this.rampHold > 1.5) { this.rampS = 'go'; this.rampZ = lz; HUD.help('Yaxshi. Endi orqaga sirpanmasdan davom eting', 2.5); } }
      else this.rampHold = 0;
    } else if (this.rampS === 'go' && lz < this.rampZ - 0.3) { this.mistake('Estakadada orqaga sirpanib ketdingiz (30 sm dan ko\'p)'); this.rampZ = -1e9; }
    if (lz > 18) { if (this.rampMaxH < 0.5) this.mistake('Estakadaga chiqmadingiz'); this.next(); }
  },
  x_turns(c, lx, lz) { if (lx > -1 && lx < 4 && lz < 8) this.next(); },
  x_light1(c, lx, lz) { if (lz < -6 && Math.abs(lx) < 4) this.next(); },
  x_snake(c, lx, lz) {
    // Konusni kesib o'tganda — mashina navbatma-navbat o'ng va chap tomonda bo'lishi kerak
    const i = this.snakeI;
    if (i < AD_SNAKE.length && lx < AD_SNAKE[i]) {
      // O'ng tomon vektori r = (-cos h, sin h): konusdan o'ngga siljish — musbat
      const off = (lz + 20) * Math.sin(c.h), want = i % 2 === 0 ? 1 : -1;
      if (Math.sign(off) !== want || Math.abs(off) < 0.5) this.mistake('Ilon izi noto\'g\'ri bajarildi');
      this.snakeI++;
    }
    if (lx < -17) this.next();
  },
  x_light2(c, lx, lz) { if (lx > 6 && Math.abs(lz) < 4) this.next(); },
  x_box(c, lx, lz, kmh, dt) {
    if (this.boxS === 0) {
      if (this.inRect(c, lx, lz, AD_BOX) && c.speed < 0.3) {
        this.boxT += dt;
        if (this.boxT > 1.2) {
          this.boxS = 1; this.gi = 2;
          if (Math.cos(c.h) > -0.5) this.mistake('Boksga orqa bilan kirish kerak edi');
          HUD.help('Yaxshi. Endi boksdan chiqib, chorraha tomon qayting', 3);
        }
      } else this.boxT = 0;
    } else if (lz < 0 && lx < 9 && Math.sin(c.h) < -0.3) this.next();
  },
  x_light3(c, lx, lz) { if (lz > 3.5 && Math.abs(lx) < 4) this.next(); },
  x_rail(c, lx, lz) {
    const front = lz + Math.cos(c.h) * c.T.l / 2;
    if (this.railS === 0) {
      if (front > AD_RAIL.stop + 0.25) { this.mistake('Temir yo\'l oldida (STOP) to\'xtamadingiz'); this.railS = 1; }
      else if (front > AD_RAIL.stop - 2 && c.speed < 0.3) { this.railS = 1; HUD.help('To\'g\'ri. Endi temir yo\'ldan o\'ting', 2); }
    }
    if (lz > 15) this.next();
  },
  x_accel(c, lx, lz, kmh) {
    if (lx > 17) this.accelMax = Math.max(this.accelMax, kmh);
    if (lx > 17 && lz < this.trig) {
      if (this.accelMax < 25) this.mistake('Tezlashish bo\'lagida 25 km/soatga yetmadingiz');
      this.brakeZ = lz; this.alarmMat.color.setHex(0xff2a1a);
      HUD.big('STOP!', 'Darhol to\'xtang', 'wasted'); Game.bigT = 1.2; SFX.horn();
      this.next();
    }
  },
  x_brake(c, lx, lz) {
    if (this.brakeS) { if (lz < -15) { this.alarmMat.color.setHex(0x330808); this.next(); } return; }
    if (c.speed < 0.3) { this.brakeS = 1; this.alarmMat.color.setHex(0x330808); HUD.help('To\'xtadingiz. Davom eting', 2); }
    else if (lz < this.brakeZ - 12) { this.brakeS = 1; this.mistake('Avariya to\'xtashida juda uzoq yurdingiz'); this.alarmMat.color.setHex(0x330808); }
  },
  x_park(c, lx, lz, kmh, dt) {
    if (this.parkS === 0) {
      if (this.inRect(c, lx, lz, AD_POCKET) && c.speed < 0.3) {
        this.parkT += dt;
        if (this.parkT > 1.2) {
          this.parkS = 1; this.gi = 3;
          if (Math.abs(Math.sin(c.h)) < 0.95) this.mistake('Yo\'lga parallel to\'xtamadingiz');
          HUD.help('Yaxshi. Endi chiqib, chorraha tomon davom eting', 3);
        }
      } else this.parkT = 0;
    } else if (lx < 6 && lz > -23) this.next();
  },
  x_light4(c, lx, lz) { if (lx < -6 && Math.abs(lz) < 4) this.next(); },
  x_finish(c, lx, lz) { if (lx > AD_FINISH.x0 && lx < AD_FINISH.x1 && Math.abs(lz) < 3 && c.speed < 0.3) this.end(true); },
  // Xarita uchun: qolgan yo'l (joriy mashqdan boshlab)
  route() {
    const out = [{ x: Player.x, z: Player.z }];
    for (let e = this.ex; e < AD_EX.length && out.length < 14; e++) {
      const G = AD_EX[e].guide;
      for (let k = e === this.ex ? this.gi : 0; k < G.length; k++) out.push(this.W(G[k][0], G[k][1]));
    }
    return out;
  },
  blips() { return this.blk && !this.active ? [{ x: this.spot.x, z: this.spot.z, color: '#7ee0a1', size: 8, label: 'P' }] : []; },
};
