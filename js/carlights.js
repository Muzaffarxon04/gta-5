'use strict';
// ===== Kechasi mashina chiroqlari: oldingi faralar (oq), stop-chiroqlar (qizil, tormozda yorqinroq)
// va yo'ldagi fara yorug'ligi. Hamma mashinalar uchun 3 ta chizish chaqiruvida (Points va InstancedMesh).
const LIGHT_N = 48; // bir vaqtda ko'rsatiladigan mashinalar soni
function glowTexture(w, h, stops) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d'), gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  g.fillStyle = gr;
  g.setTransform(1, 0, 0, h / w, 0, 0); g.fillRect(0, 0, w, w);
  return new THREE.CanvasTexture(cv);
}
// Model fazosidagi chiroqlar joyi (oldingi — "lens" qismidan, orqadagi — "red" dan); bo'lmasa — o'lchamlardan
function carLamps(car) {
  const T = car.T, M = T.model && MODELS[T.model];
  if (M && M.lamps) return M.lamps;
  if (T._lamps) return T._lamps;
  const moto = T.kind === 'moto', x = moto ? 0 : T.w / 2 - 0.28, L2 = T.l / 2;
  return (T._lamps = moto ? { f: [[0, 0.9, L2 - 0.1]], r: [[0, 0.8, -L2 + 0.1]] }
    : { f: [[x, T.nose ? T.nose - 0.07 : 0.65, L2], [-x, T.nose ? T.nose - 0.07 : 0.65, L2]], r: [[x, T.tail ? T.tail - 0.1 : 0.75, -L2], [-x, T.tail ? T.tail - 0.1 : 0.75, -L2]] });
}
// Faralar yoniqmi: o'yinchi qo'lda yoqqan/o'chirgan bo'lsa — shu (c.lightsOn), aks holda kechasi o'zi yonadi
const nightLights = () => 1 - World.daylight > 0.35;
const carLightsOn = c => (c.lightsOn != null ? c.lightsOn : nightLights());
function toggleCarLights(c) {
  c.lightsOn = !carLightsOn(c);
  SFX.click();
  HUD.help(c.lightsOn ? 'Faralar yoqildi' : 'Faralar o\'chirildi', 1.5);
}
const CarLights = {
  init(scene) {
    const pts = (size, tex) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(LIGHT_N * 2 * 3), 3));
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(LIGHT_N * 2 * 3), 3));
      const p = new THREE.Points(g, new THREE.PointsMaterial({ size, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
      p.frustumCulled = false; p.visible = false; p.renderOrder = 3;
      scene.add(p);
      return p;
    };
    const dot = glowTexture(64, 64, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,.8)'], [1, 'rgba(255,255,255,0)']]);
    this.front = pts(1.15, dot);
    this.rear = pts(0.6, dot);
    this.amber = pts(0.75, dot);
    // Yo'lga tushgan fara yorug'ligi: cho'zinchoq dog'
    const pool = glowTexture(64, 128, [[0, 'rgba(255,240,200,.9)'], [0.55, 'rgba(255,230,180,.35)'], [1, 'rgba(255,220,160,0)']]);
    const geo = new THREE.PlaneGeometry(3.4, 9).rotateX(-Math.PI / 2).translate(0, 0, 4.5);
    this.pools = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ map: pool, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5 }), LIGHT_N);
    this.pools.frustumCulled = false; this.pools.visible = false; this.pools.renderOrder = 2;
    scene.add(this.pools);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(1, 1, 1); this._p = new THREE.Vector3(); this._Y = new THREE.Vector3(0, 1, 0);
  },
  update(cars, cx, cz) {
    if (!this.front) return;
    const k = clamp((1 - World.daylight - 0.35) / 0.3, 0, 1);
    // Burilish chiroqlari (kunduzi ham ko'rinadi)
    const blink = blinkOn(), aP = this.amber.geometry.attributes.position.array, aC = this.amber.geometry.attributes.color.array;
    let na = 0;
    if (blink) for (const c of cars) {
      if (!c.signal || c.dead || !c.mesh.visible || na >= LIGHT_N * 2 - 4) continue;
      const dx = c.x - cx, dz = c.z - cz;
      if (dx * dx + dz * dz > 140 * 140) continue;
      const L = carLamps(c), s = Math.sin(c.h), co = Math.cos(c.h), want = c.signal === 2 ? 0 : c.signal; // +x mahalliy — chap tomon
      for (const p of [...L.f, ...L.r]) {
        if (want && Math.sign(p[0]) !== -want) continue;
        const ox = p[0] + Math.sign(p[0]) * 0.08;
        aP[na * 3] = c.x + ox * co + p[2] * s; aP[na * 3 + 1] = c.y + p[1] + 0.05; aP[na * 3 + 2] = c.z - ox * s + p[2] * co;
        aC[na * 3] = 1; aC[na * 3 + 1] = 0.55; aC[na * 3 + 2] = 0.05; na++;
      }
    }
    this.amber.visible = na > 0;
    if (na) { this.amber.geometry.setDrawRange(0, na); this.amber.geometry.attributes.position.needsUpdate = this.amber.geometry.attributes.color.needsUpdate = true; }
    // Kunduzi ham qo'lda yoqilgan faralar ko'rinadi (xira)
    const on = k > 0 || cars.some(c => c.lightsOn === true);
    this.front.visible = this.rear.visible = this.pools.visible = on;
    if (!on) return;
    const fP = this.front.geometry.attributes.position.array, fC = this.front.geometry.attributes.color.array;
    const rP = this.rear.geometry.attributes.position.array, rC = this.rear.geometry.attributes.color.array;
    let nf = 0, nr = 0, np = 0;
    for (const c of cars) {
      if (np >= LIGHT_N || c.dead || !c.mesh.visible) continue;
      const dx = c.x - cx, dz = c.z - cz;
      if (dx * dx + dz * dz > 170 * 170) continue;
      const L = carLamps(c), s = Math.sin(c.h), co = Math.cos(c.h), br = c.lampBroken || 0;
      const put = (arr, col, n, p, rgb) => {
        arr[n * 3] = c.x + p[0] * co + p[2] * s; arr[n * 3 + 1] = c.y + p[1]; arr[n * 3 + 2] = c.z - p[0] * s + p[2] * co;
        col[n * 3] = rgb[0] * kc; col[n * 3 + 1] = rgb[1] * kc; col[n * 3 + 2] = rgb[2] * kc;
      };
      // Haydovchisiz turgan mashinalarning chiroqlari o'chiq; o'yinchi faralarni o'zi yoqib-o'chira oladi
      const lit = c.driver || c === Player.inCar;
      const kc = !lit || c.lightsOn === false ? 0 : c.lightsOn === true ? Math.max(k, 0.55) : k;
      if (kc <= 0) continue;
      L.f.forEach((p, i) => { if (!(br & (1 << i)) && nf < LIGHT_N * 2) put(fP, fC, nf++, p, [1, 0.93, 0.78]); });
      const braking = c.pedals ? c.brk > 0.1 : c.thr < -0.1 && c.fwd > 0.5;
      L.r.forEach((p, i) => { if (!(br & (4 << i)) && nr < LIGHT_N * 2) put(rP, rC, nr++, p, braking ? [1, 0.12, 0.08] : [0.55, 0.04, 0.03]); });
      // Yo'ldagi yorug'lik (o'yinchining mashinasida haqiqiy fara bor)
      if (c !== Player.inCar && (br & 3) !== 3 && k > 0) {
        const fz = L.f[0][2] + 0.3;
        this._p.set(c.x + fz * s, groundH(c.x + fz * 3 * s, c.z + fz * 3 * co) + 0.1, c.z + fz * co);
        this._q.setFromAxisAngle(this._Y, c.h);
        this.pools.setMatrixAt(np++, this._m.compose(this._p, this._q, this._s));
      }
    }
    this.front.geometry.setDrawRange(0, nf); this.rear.geometry.setDrawRange(0, nr);
    this.front.geometry.attributes.position.needsUpdate = this.front.geometry.attributes.color.needsUpdate = true;
    this.rear.geometry.attributes.position.needsUpdate = this.rear.geometry.attributes.color.needsUpdate = true;
    this.pools.count = np; this.pools.instanceMatrix.needsUpdate = true;
    this.pools.material.opacity = 0.8 * k;
  },
};

// ===== Burilish chiroqlari (povorotnik): -1 chap, 1 o'ng, 2 avariya. Z / C / X, telefonda chap tomondagi tugmalar =====
const SIGNAL_NAMES = { '-1': 'Chapga burilish chirog\'i', 1: 'O\'ngga burilish chirog\'i', 2: 'Avariya chirog\'i' };
const blinkOn = () => Math.floor(performance.now() / 333) % 2 === 0;
function setSignal(c, s) {
  c.signal = c.signal === s ? 0 : s;
  c.signalH0 = c.h; c.signalT = 0;
  SFX.click();
  if (c === Player.inCar) HUD.help(c.signal ? `${SIGNAL_NAMES[c.signal]} yoqildi` : 'Burilish chirog\'i o\'chirildi', 1.2);
}
// O'yinchining mashinasi: burilish tugagach chiroq o'zi o'chadi; yonib turganda "chiq-chiq" ovozi
const Signals = {
  _b: false,
  update(dt) {
    const c = Player.inCar;
    if (!c || Player.passenger) return;
    if (c.signal === 1 || c.signal === -1) {
      c.signalT = (c.signalT || 0) + dt;
      if (Math.abs(wrapAng(c.h - (c.signalH0 ?? c.h))) > 0.9 && Math.abs(c.steer) < 0.2) { c.signal = 0; }
    }
    const b = !!c.signal && blinkOn();
    if (b !== this._b) { this._b = b; if (c.signal && SFX.ctx) SFX.burst(SFX.out, SFX.ctx.currentTime, 0.02, 'bandpass', b ? 2200 : 1700, 0.18, 6); }
  },
};
