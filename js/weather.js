'use strict';
// ===== Ob-havo: ochiq, bulutli, yomg'ir (momaqaldiroq bilan), tuman, qor =====
const WX_GREY_DAY = new THREE.Color(0x8e959c), WX_GREY_NIGHT = new THREE.Color(0x1b1f26);
const WX_WHITE = new THREE.Color(0xffffff), WX_SNOW = new THREE.Color(0xeef2f5), WX_SNOW_ROAD = new THREE.Color(0x9a9ea4);
const _wxc = new THREE.Color();
const Weather = {
  kind: 'clear', timer: 160, rain: 0, snow: 0, fog: 0, cloud: 0, wet: 0, cover: 0, grip: 1, flash: 0, thunderT: 15,
  ORDER: ['clear', 'cloudy', 'rain', 'clear', 'fog', 'cloudy', 'snow', 'clear', 'rain'],
  CYCLE: ['clear', 'cloudy', 'rain', 'fog', 'snow'],
  NAMES: { clear: 'Ochiq', cloudy: 'Bulutli', rain: 'Yomg\'ir', fog: 'Tuman', snow: 'Qor' },
  TARGET: { clear: {}, cloudy: { cloud: 0.6 }, rain: { rain: 1, cloud: 0.9 }, fog: { fog: 1, cloud: 0.5 }, snow: { snow: 1, cloud: 0.7, fog: 0.3 } },
  step: 0,
  init(scene) {
    // Yomg'ir tomchilari — qisqa chiziqlar, kamera atrofida
    const NR = 2400, NS = 2200;
    this.R = { n: NR, x: new Float32Array(NR), y: new Float32Array(NR), z: new Float32Array(NR) };
    this.S = { n: NS, x: new Float32Array(NS), y: new Float32Array(NS), z: new Float32Array(NS), p: new Float32Array(NS) };
    for (const P of [this.R, this.S]) for (let i = 0; i < P.n; i++) { P.x[i] = rand(-40, 40); P.y[i] = rand(0, 34); P.z[i] = rand(-40, 40); if (P.p) P.p[i] = rand(0, TAU); }
    this.rainGeo = new THREE.BufferGeometry();
    this.rainGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(NR * 6), 3));
    this.rainMesh = new THREE.LineSegments(this.rainGeo, new THREE.LineBasicMaterial({ color: 0xa8bccd, transparent: true, opacity: 0.5 }));
    this.snowGeo = new THREE.BufferGeometry();
    this.snowGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(NS * 3), 3));
    // Qor parchasi — yumaloq, chetlari yumshoq
    const fc = document.createElement('canvas'); fc.width = fc.height = 32;
    const fg = fc.getContext('2d'), gr = fg.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    fg.fillStyle = gr; fg.fillRect(0, 0, 32, 32);
    this.snowMesh = new THREE.Points(this.snowGeo, new THREE.PointsMaterial({ map: new THREE.CanvasTexture(fc), size: 0.13, transparent: true, opacity: 0.95, depthWrite: false }));
    for (const m of [this.rainMesh, this.snowMesh]) { m.frustumCulled = false; m.visible = false; scene.add(m); }
  },
  set(kind, announce) {
    this.kind = kind; this.timer = rand(150, 260);
    if (announce) HUD.help(`Ob-havo: <b>${this.NAMES[kind]}</b>`, 2);
  },
  cycle() { this.set(this.CYCLE[(this.CYCLE.indexOf(this.kind) + 1) % this.CYCLE.length], true); },
  label() { return this.NAMES[this.kind]; },
  update(dt, cam) {
    this.timer -= dt;
    if (this.timer <= 0) { this.step = (this.step + 1) % this.ORDER.length; this.set(this.ORDER[this.step], false); }
    const T = this.TARGET[this.kind], k = 1 - Math.exp(-dt / 6);
    for (const key of ['rain', 'snow', 'fog', 'cloud']) this[key] = lerp(this[key], T[key] || 0, k);
    // Yo'l asta-sekin ho'llanadi va quriydi, qor asta-sekin yog'ib, eriydi
    this.wet = clamp(this.wet + (this.rain > 0.3 ? dt / 12 : -dt / 60), 0, 1);
    this.cover = clamp(this.cover + (this.snow > 0.4 ? dt / 30 : -dt / 90), 0, 1);
    this.grip = 1 - this.wet * 0.32 - this.cover * 0.45;
    this.particles(dt, cam);
    this.flash = Math.max(0, this.flash - dt * 4);
    if (this.rain > 0.7) {
      this.thunderT -= dt;
      if (this.thunderT <= 0) { this.thunderT = rand(12, 35); this.flash = 1; setTimeout(() => SFX.thunder(), rand(400, 2200)); }
    }
    SFX.setRain(this.rain, this.snow * 0.6 + this.fog * 0.4, !!Player.inCar);
  },
  particles(dt, cam) {
    const cx = cam.position.x, cy = cam.position.y, cz = cam.position.z;
    const wrap = (P, i) => {
      if (P.x[i] - cx > 40) P.x[i] -= 80; else if (P.x[i] - cx < -40) P.x[i] += 80;
      if (P.z[i] - cz > 40) P.z[i] -= 80; else if (P.z[i] - cz < -40) P.z[i] += 80;
      if (P.y[i] < cy - 12) P.y[i] += 34; else if (P.y[i] > cy + 22) P.y[i] -= 34;
    };
    const R = this.R, nr = Math.floor(R.n * this.rain), rp = this.rainGeo.attributes.position.array;
    for (let i = 0; i < nr; i++) {
      R.y[i] -= 26 * dt; R.x[i] -= 1.5 * dt; wrap(R, i);
      const o = i * 6;
      rp[o] = R.x[i]; rp[o + 1] = R.y[i]; rp[o + 2] = R.z[i];
      rp[o + 3] = R.x[i] + 0.05; rp[o + 4] = R.y[i] + 0.7; rp[o + 5] = R.z[i];
    }
    this.rainGeo.setDrawRange(0, nr * 2); this.rainGeo.attributes.position.needsUpdate = true;
    this.rainMesh.visible = nr > 10;
    const S = this.S, ns = Math.floor(S.n * this.snow), sp = this.snowGeo.attributes.position.array;
    for (let i = 0; i < ns; i++) {
      S.p[i] += dt; S.y[i] -= 1.6 * dt; S.x[i] += Math.sin(S.p[i]) * 0.6 * dt; S.z[i] += Math.cos(S.p[i] * 0.7) * 0.4 * dt; wrap(S, i);
      sp[i * 3] = S.x[i]; sp[i * 3 + 1] = S.y[i]; sp[i * 3 + 2] = S.z[i];
    }
    this.snowGeo.setDrawRange(0, ns); this.snowGeo.attributes.position.needsUpdate = true;
    this.snowMesh.visible = ns > 10;
  },
  // updateSky dan keyin chaqiriladi: osmon, tuman, yorug'lik, ho'l asfalt va qor qoplami
  apply() {
    const sc = World.scene, overcast = Math.max(this.cloud, this.rain * 0.9, this.snow * 0.7, this.fog * 0.6);
    _wxc.copy(WX_GREY_DAY).lerp(WX_GREY_NIGHT, 1 - World.daylight);
    sc.background.lerp(_wxc, overcast * 0.75);
    if (this.flash > 0) sc.background.lerp(WX_WHITE, this.flash * 0.55);
    sc.fog.color.copy(sc.background);
    World.sun.intensity *= 1 - overcast * 0.75;
    World.hemi.intensity = World.hemi.intensity * (1 - overcast * 0.15) + this.flash * 1.6;
    const thick = Math.max(this.fog, this.snow * 0.55, this.rain * 0.45);
    sc.fog.near = lerp(90, 8, Math.max(this.fog, this.snow * 0.4, this.rain * 0.25));
    sc.fog.far = lerp(Settings.viewDist(), 120, thick);
    World.roadMat.specular.setScalar(this.wet * 0.35);
    World.roadMat.color.setRGB(lerp(0.231, 0.16, this.wet), lerp(0.243, 0.17, this.wet), lerp(0.267, 0.19, this.wet)).lerp(WX_SNOW_ROAD, this.cover * 0.35);
    for (const s of World.snowMats) s.m.color.copy(s.base).lerp(WX_SNOW, this.cover * 0.85);
  },
};
