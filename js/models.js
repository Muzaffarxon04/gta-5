'use strict';
// ===== Tashqi 3D modellar (GLB): Mercedes GLS 580, Fast Charger, politsiya =====
// Modellar models/*.js fayllarida base64 ko'rinishida turadi (fayl ochilganda ham ishlaydi).
const MODELS = {};
const MODEL_DARK = new THREE.MeshLambertMaterial({ vertexColors: true });
const MODEL_CHROME = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 90, specular: 0xaaaaaa });
const MODEL_RED = new THREE.MeshBasicMaterial({ color: 0xd01010 });
const MODEL_LENS = new THREE.MeshPhongMaterial({ color: 0xdfe8f0, transparent: true, opacity: 0.55, shininess: 100, specular: 0xffffff, depthWrite: false });
const _paint = {};
const paintMat = c => _paint[c] || (_paint[c] = new THREE.MeshPhongMaterial({ color: c, shininess: 80, specular: 0x666666 }));

function loadModels(done) {
  const data = window.MODEL_DATA || {}, names = Object.keys(data);
  if (!names.length || !THREE.GLTFLoader) { done(); return; }
  let left = names.length;
  const finish = () => { if (--left === 0) done(); };
  for (const n of names) {
    try {
      const bin = Uint8Array.from(atob(data[n]), ch => ch.charCodeAt(0)).buffer;
      // Teksturalar fetch() emas, oddiy <img> orqali yuklansin (sahifa cheklovlari uchun)
      const saved = window.createImageBitmap;
      window.createImageBitmap = undefined;
      try {
        new THREE.GLTFLoader().parse(bin, '', g => { try { MODELS[n] = prepModel(n, g.scene); } catch (e) { console.warn(n, e); } finish(); },
          e => { console.warn('Model yuklanmadi:', n, e); finish(); });
      } finally { window.createImageBitmap = saved; }
    } catch (e) { console.warn('Model yuklanmadi:', n, e); finish(); }
  }
}

function prepModel(name, scene) {
  const M = { scene };
  scene.traverse(o => {
    if (!o.isMesh) return;
    const src = o.material;
    if (src.map) { src.map.encoding = THREE.LinearEncoding; src.map.needsUpdate = true; }
    let mat;
    if (name === 'gls') {
      // Mercedes qismlari nomi bo'yicha: bo'yoq, xrom, qora qismlar, oyna, chiroqlar
      if (o.name === 'paint') o.userData.paint = true;
      else if (o.name === 'glass') { mat = GLASS_MAT; o.userData.glass = true; }
      else if (o.name === 'lens') { mat = MODEL_LENS; o.userData.glass = true; }
      else if (o.name === 'red') mat = MODEL_RED;
      else if (o.name === 'chrome') mat = MODEL_CHROME;
      else mat = MODEL_DARK;
    } else if (name === 'person') mat = new THREE.MeshLambertMaterial({ map: src.map, emissive: 0xffffff, emissiveMap: src.map, emissiveIntensity: 0.3 }); // skanerda yorug'lik bor
    else mat = new THREE.MeshPhongMaterial({ map: src.map, shininess: 40, specular: 0x333333, side: src.side });
    if (mat) o.material = mat;
    o.castShadow = !o.userData.glass;
  });
  if (name === 'police') {
    // Tomdagi chiroqlar joyini geometriyadan topamiz (eng baland uchlar)
    const box = new THREE.Box3().setFromObject(scene), top = box.max.y, v = new THREE.Vector3();
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    scene.traverse(o => {
      if (!o.isMesh) return;
      const P = o.geometry.attributes.position;
      for (let i = 0; i < P.count; i++) {
        v.fromBufferAttribute(P, i);
        if (v.y > top - 0.12) { x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z); }
      }
    });
    const hw = (x1 - x0) / 2;
    M.bar = { x: hw / 2, y: top - 0.07, z: (z0 + z1) / 2, w: hw * 0.92, h: 0.15, d: (z1 - z0) * 1.05 };
    Object.assign(CAR_TYPES.police, { model: 'police', kind: 'model', name: 'Politsiya', l: 4.8, w: 2.1, H: top, wr: 0.36, roofZ: M.bar.z, seat: { x: 0.45, y: 0.55, z: -0.1 } });
  }
  return M;
}
