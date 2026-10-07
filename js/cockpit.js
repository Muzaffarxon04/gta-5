'use strict';
// ===== Mashina ichidan ko'rinish: haydovchi ko'zidan, aylanadigan rul va tablo bilan (V) =====
const _ckV = new THREE.Vector3(), _ckE = new THREE.Euler(0, 0, 0, 'YXZ'), _ckQ = new THREE.Quaternion();
const _ckDS = new Map();
// Ichkaridan kuzov devorlari ko'rinsin: shu mashina uchun ikki tomonlama material nusxasi
function ckDouble(m) {
  if (m.side === THREE.DoubleSide || m.transparent) return m;
  let d = _ckDS.get(m);
  if (!d) { d = m.clone(); d.side = THREE.DoubleSide; _ckDS.set(m, d); }
  return d;
}

const Cockpit = {
  on: false, yaw: 0, pitch: -0.06, idle: 0, car: null, dash: null, ctx: null, tex: null, drawT: 0,
  toggle() {
    this.on = !this.on; this.yaw = 0; this.pitch = this.rest();
    if (Player.inCar) HUD.help(this.on ? 'Mashina ichidan ko\'rinish. <kbd>V</kbd> — orqadan' : 'Orqadan ko\'rinish. <kbd>V</kbd> — mashina ichidan', 2);
  },
  active() { return this.on && !!Player.inCar && !Player.dead; },
  // Oldinga qarash burchagi: mototsiklda pastroq (bak va tablo ko'rinsin)
  rest() { return Player.inCar && Player.inCar.T.kind === 'moto' ? -0.32 : -0.06; },
  // Har kadr: tablo va ikki tomonlama kuzovni faqat o'yinchining mashinasiga ulash
  update(dt) {
    const want = this.active() ? Player.inCar : null;
    if (want !== this.car) { this.detach(); if (want) this.attach(want); }
    if (!this.car) return;
    this.drawT -= dt;
    if (this.drawT <= 0) { this.drawT = 0.1; this.draw(this.car); }
  },
  attach(c) {
    this.car = c;
    c.body.traverse(o => {
      if (!o.isMesh || o.userData.glass) return;
      o.userData.mat0 = o.material; o.material = ckDouble(o.material);
    });
    if (!this.dash) {
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 176;
      this.ctx = cv.getContext('2d');
      this.tex = new THREE.CanvasTexture(cv);
      this.dash = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.103), new THREE.MeshBasicMaterial({ map: this.tex }));
    }
    // Tablo rul ortida (gardishning yuqori qismidan ko'rinadi); rul bo'lmasa — o'rindiq oldida
    const pv = c.steerPivot, d = this.dash, T = c.T;
    if (pv) {
      const q0 = steerQ0(pv), r = pv.userData.r;
      d.quaternion.copy(q0);
      d.position.copy(pv.position).add(_ckV.set(0, r * 0.56, -0.07).applyQuaternion(q0));
      d.scale.setScalar(clamp(r / 0.2, 0.8, 1.2));
      pv.parent.add(d);
    } else {
      const moto = T.kind === 'moto', S = T.seat;
      d.position.set(S.x, S.y + (moto ? 0.24 : 0.42), S.z + (moto ? 0.5 : 0.66));
      d.rotation.set(moto ? -0.9 : -0.25, Math.PI, 0); d.scale.setScalar(moto ? 0.7 : 1);
      c.mesh.add(d);
    }
    this.drawT = 0; this.pitch = this.rest(); this.yaw = 0;
  },
  detach() {
    const c = this.car;
    if (!c) return;
    c.body.traverse(o => { if (o.isMesh && o.userData.mat0) { if (o.material !== WRECK_MAT) o.material = o.userData.mat0; delete o.userData.mat0; } });
    if (this.dash && this.dash.parent) this.dash.parent.remove(this.dash);
    this.car = null;
  },
  // Tablo: tezlik va aylanish strelkalari, uzatma, soat
  draw(c) {
    const g = this.ctx, W = 512, H = 176, kmh = c.speed * 3.6;
    g.fillStyle = '#0b0d10'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#2b3138'; g.lineWidth = 4; g.strokeRect(2, 2, W - 4, H - 4);
    const gauge = (cx, val, max, step, label, warn) => {
      const R = 72, a0 = Math.PI * 0.75, a1 = Math.PI * 2.25, cy = 92;
      g.lineWidth = 3; g.strokeStyle = '#3b444f'; g.beginPath(); g.arc(cx, cy, R, a0, a1); g.stroke();
      if (warn) { g.strokeStyle = '#c62828'; g.lineWidth = 6; g.beginPath(); g.arc(cx, cy, R - 3, a0 + (a1 - a0) * warn, a1); g.stroke(); }
      g.fillStyle = '#cfd8dc'; g.font = 'bold 15px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let v = 0; v <= max + 1e-6; v += step) {
        const a = a0 + (a1 - a0) * v / max;
        g.strokeStyle = '#cfd8dc'; g.lineWidth = 3; g.beginPath();
        g.moveTo(cx + Math.cos(a) * (R - 3), cy + Math.sin(a) * (R - 3)); g.lineTo(cx + Math.cos(a) * (R - 13), cy + Math.sin(a) * (R - 13)); g.stroke();
        g.fillText(String(Math.round(v)), cx + Math.cos(a) * (R - 26), cy + Math.sin(a) * (R - 26));
      }
      const a = a0 + (a1 - a0) * clamp(val / max, 0, 1);
      g.strokeStyle = '#ff5a2a'; g.lineWidth = 4; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * (R - 8), cy + Math.sin(a) * (R - 8)); g.stroke();
      g.fillStyle = '#20262d'; g.beginPath(); g.arc(cx, cy, 9, 0, TAU); g.fill();
      g.fillStyle = '#8fa1ad'; g.font = 'bold 13px Arial'; g.fillText(label, cx, cy + 40);
    };
    gauge(96, kmh, 200, 40, 'km/soat');
    gauge(W - 96, (Game.rpm || 0.1) * 7, 7, 1, '×1000 ayl/min', 6 / 7);
    // O'rtada: raqamli tezlik, uzatma, soat
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#e8f1f5'; g.font = 'bold 44px Arial'; g.fillText(String(Math.round(kmh)), W / 2, 66);
    const gear = c.fwd < -0.5 ? 'R' : Math.abs(c.fwd) < 0.5 && !c.thr ? 'N' : 'D';
    g.font = 'bold 26px Arial'; g.fillStyle = gear === 'R' ? '#ff6b6b' : '#7ee0a1'; g.fillText(gear, W / 2, 108);
    g.font = 'bold 16px Arial'; g.fillStyle = '#8fa1ad'; g.fillText(clockText(), W / 2, 140);
    if (c.hand) { g.fillStyle = '#ff3b30'; g.font = 'bold 16px Arial'; g.fillText('(P)', W / 2 - 52, 108); }
    if (c.boost) { g.fillStyle = '#4fc3f7'; g.font = 'bold 16px Arial'; g.fillText('NITRO', W / 2 + 58, 108); }
    if (carLightsOn(c)) { g.fillStyle = '#4fa3ff'; g.font = 'bold 15px Arial'; g.fillText('FARA', W / 2, 24); }
    this.tex.needsUpdate = true;
  },
  // Kamera haydovchi ko'zida; sichqoncha/barmoq bilan atrofga qarash, qo'yib yuborilsa oldinga qaytadi
  camera(dt) {
    const c = Player.inCar, hm = Player.hm, sens = 0.0024 * Settings.v.sens;
    const moved = Input.mdx !== 0 || Input.mdy !== 0 || kd('KeyQ') || kd('KeyE');
    this.yaw = clamp(this.yaw - Input.mdx * sens + (kd('KeyQ') ? 2 * dt : 0) - (kd('KeyE') ? 2 * dt : 0), -1.5, 1.5);
    this.pitch = clamp(this.pitch - Input.mdy * sens * (Settings.v.invertY ? -1 : 1), -0.7, 0.45);
    this.idle = moved ? 0 : this.idle + dt;
    if (this.idle > 1.5) { const k = 1 - Math.exp(-dt * 3); this.yaw = lerp(this.yaw, 0, k); this.pitch = lerp(this.pitch, this.rest(), k); }
    c.mesh.updateMatrixWorld(true);
    camera.position.copy(hm.b.head.localToWorld(_ckV.set(0, 0.03, 0.14)));
    if (Game.shake > 0) { const s = Game.shake * 0.06; camera.position.x += rand(-s, s); camera.position.y += rand(-s, s); Game.shake = Math.max(0, Game.shake - dt * 1.5); }
    _ckE.set(this.pitch, Math.PI + this.yaw, 0);
    camera.quaternion.copy(c.mesh.quaternion).multiply(_ckQ.setFromEuler(_ckE));
    camera.near = 0.04;
    camera.fov = lerp(camera.fov, Settings.v.fov + 4 + clamp(c.speed - 15, 0, 30) * 0.25, Math.min(1, dt * 4));
    camera.updateProjectionMatrix();
    // Chiqqanda orqadagi kamera mashina ortida tursin
    Game.camYaw = c.h + this.yaw; Game.camPitch = 0.2; Game.mouseIdle = 9;
  },
};
