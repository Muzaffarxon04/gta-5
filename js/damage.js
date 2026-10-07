'use strict';
// ===== Mashina shikastlanishi: urilgan joyda kuzov ichiga botadi, chiroqlar sinadi, oyna siniqlari sochiladi.
// Geometriya mashinalarda umumiy — birinchi urilishda shu mashina uchun nusxa olinadi (faqat yaqin LOD).
const DENT_PARTS = ['paint', 'dark', 'chrome', 'red', 'lens'];
const _dmgV = new THREE.Vector3();
// x, z — urilish nuqtasi (dunyoda), nx, nz — urilish yo'nalishi (mashina ichiga qarab), imp — kuch (m/s)
Car.prototype.dent = function (x, z, nx, nz, imp) {
  if (this.dead || imp < 7) return;
  const T = this.T, near = this.body.isLOD && this.body.getObjectByName('lod0');
  // Mashina fazosiga: x — o'ngga/chapga, z — oldinga
  const s = Math.sin(this.h), c = Math.cos(this.h), dx = x - this.x, dz = z - this.z;
  const lx = dx * c - dz * s, lz = dx * s + dz * c, dnx = nx * c - nz * s, dnz = nx * s + nz * c;
  // Chiroqlar: old (f — 1, 2 bitlar) yoki orqa (r — 4, 8), chap/o'ng tomonga qarab
  const L2 = T.l / 2;
  if (imp > 9 && Math.abs(lz) > L2 - 0.7) {
    const bit = (lz > 0 ? 1 : 4) << (lx >= 0 ? 0 : 1);
    if (!(this.lampBroken & bit)) {
      this.lampBroken = (this.lampBroken || 0) | bit;
      for (let i = 0; i < 8; i++) FX.spawn(x, this.y + 0.6, z, rand(-2, 2), rand(1, 3), rand(-2, 2), rand(0.4, 0.8), lz > 0 ? 0xe8f4ff : 0xff3020, 0.06, false, 12);
    }
  }
  if (!near) return;
  const depth = Math.min(0.26, (imp - 6) * 0.02), rad = Math.min(0.95, 0.5 + imp * 0.02);
  // Faqat kuzov qismlari (bo'yoq, qora qismlar, xrom, chiroqlar) — rul va raqam emas
  near.children.forEach(o => {
    if (!o.isMesh || !DENT_PARTS.includes(o.name)) return;
    o.updateMatrix();
    const inv = o.userData.inv || (o.userData.inv = new THREE.Matrix4().copy(o.matrix).invert());
    // Zarba bu bo'lakka yetmasa — nusxa olinmaydi (geometriya chegarasi mashina fazosida)
    const bs = o.geometry.boundingSphere;
    if (bs) {
      _dmgV.copy(bs.center).applyMatrix4(o.matrix);
      if (Math.hypot(_dmgV.x - lx, _dmgV.z - lz) > bs.radius * o.matrix.getMaxScaleOnAxis() + rad) return;
    }
    if (!o.userData.ownGeo) { o.geometry = o.geometry.clone(); toFloatAttrs(o.geometry); o.userData.ownGeo = true; }
    const P = o.geometry.attributes.position;
    let moved = false;
    for (let i = 0; i < P.count; i++) {
      // Hisob mashina fazosida (metrda): siqilgan geometriyada tugun masshtabi bor
      _dmgV.fromBufferAttribute(P, i).applyMatrix4(o.matrix);
      const ddx = _dmgV.x - lx, ddz = _dmgV.z - lz, d = Math.hypot(ddx, ddz);
      if (d > rad || _dmgV.y < 0.2 || _dmgV.y > T.H * 0.85) continue;
      // Ezilish: markazda chuqurroq, chetga qarab kamayadi; burishgan metall uchun tasodifiy to'lqin
      const k = 1 - d / rad, f = depth * k * k * (0.55 + 0.45 * Math.sin(_dmgV.x * 23 + _dmgV.y * 31 + _dmgV.z * 17) ** 2);
      _dmgV.set(_dmgV.x + dnx * f, _dmgV.y - f * 0.3, _dmgV.z + dnz * f).applyMatrix4(inv);
      P.setXYZ(i, _dmgV.x, _dmgV.y, _dmgV.z);
      moved = true;
    }
    if (moved) { P.needsUpdate = true; o.geometry.computeVertexNormals(); }
  });
  this.dented = true;
};
// Garajda ta'mirlash: kuzov va chiroqlar asl holiga qaytadi
Car.prototype.fixBody = function () {
  this.lampBroken = 0;
  if (!this.dented) return;
  const M = MODELS[this.T.model], near = this.body.getObjectByName('lod0'), src = M && M.scene.getObjectByName('lod0');
  if (near && src) near.children.forEach(o => {
    const s = o.isMesh && o.userData.ownGeo && src.getObjectByName(o.name);
    if (s && s.isMesh) { o.geometry.dispose(); o.geometry = s.geometry; o.userData.ownGeo = false; }
  });
  this.dented = false;
};
