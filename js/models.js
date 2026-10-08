'use strict';
// ===== Tashqi 3D modellar (GLB): Nexia, Cobalt, Gentra, Spark, Lacetti, Mercedes GLS 580, Fast Charger, politsiya =====
// Modellar models/*.js fayllarida base64 ko'rinishida turadi (fayl ochilganda ham ishlaydi). Ularni js/loader.js
// bosqichma-bosqich yuklaydi: avval eng kerakli mashinalar, qolganlari o'yin ochilgach (onModelReady).
// Mashina modellari qismlarga bo'lingan: paint, glass, lens, red, chrome, dark (tools/prep-cars.mjs).
const MODELS = {};
const MODEL_DARK = new THREE.MeshLambertMaterial({ vertexColors: true });
const MODEL_CHROME = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 90, specular: 0xaaaaaa });
const MODEL_RED = new THREE.MeshBasicMaterial({ color: 0xd01010 });
const MODEL_LENS = new THREE.MeshPhongMaterial({ color: 0xdfe8f0, transparent: true, opacity: 0.55, shininess: 100, specular: 0xffffff, depthWrite: false });
const CAR_LOD_FAR = 28; // shu masofadan (m) uzoqda yengil nusxa
const _paint = {};
const paintMat = c => _paint[c] || (_paint[c] = new THREE.MeshPhongMaterial({ color: c, shininess: 80, specular: 0x666666 }));

let _gltf = null;
// Bitta modelni ochish (base64 → GLB → sahna). Ochilgach base64 matn xotiradan o'chiriladi.
function loadModel(n, done) {
  const data = window.MODEL_DATA || {}, b64 = data[n];
  if (!b64 || !THREE.GLTFLoader) { done(false); return; }
  delete data[n];
  if (!_gltf) {
    // Yangi modellar meshopt bilan siqilgan
    _gltf = new THREE.GLTFLoader();
    if (window.MeshoptDecoder && MeshoptDecoder.supported) _gltf.setMeshoptDecoder(MeshoptDecoder);
  }
  try {
    const s = atob(b64), u = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    // Teksturalar fetch() emas, oddiy <img> orqali yuklansin (sahifa cheklovlari uchun)
    const saved = window.createImageBitmap;
    window.createImageBitmap = undefined;
    try {
      _gltf.parse(u.buffer, '', g => { let ok = false; try { MODELS[n] = prepModel(n, g.scene); ok = true; } catch (e) { console.warn(n, e); } done(ok); },
        e => { console.warn('Model yuklanmadi:', n, e); done(false); });
    } finally { window.createImageBitmap = saved; }
  } catch (e) { console.warn('Model yuklanmadi:', n, e); done(false); }
}
function loadModels(names, done) {
  let left = names.length;
  if (!left) { done(); return; }
  for (const n of names) loadModel(n, () => { if (--left === 0) done(); });
}
// O'yin ochilgandan keyin kelgan modellar: navbat bilan bittadan ochiladi (kadrlar qotmasin), so'ng o'yinga qo'shiladi
const ModelQueue = {
  list: [], busy: false,
  start() {
    Loader.each((n, ok) => { if (ok) this.add(n); });
    for (const n of Loader.ready()) this.add(n);
    Loader.startStage2();
  },
  add(n) { if (!MODELS[n] && !this.list.includes(n)) { this.list.push(n); this.next(); } },
  next() {
    if (this.busy || !this.list.length) return;
    this.busy = true;
    const n = this.list.shift();
    setTimeout(() => loadModel(n, ok => {
      if (ok) try { onModelReady(n); } catch (e) { console.warn(n, e); }
      this.busy = false; this.next();
    }), 30);
  },
};

// Siqilgan (kvantlangan) uch ma'lumotini oddiy float'ga o'tkazish — geometriyani o'zgartirish uchun
function toFloatAttrs(geo) {
  for (const k of Object.keys(geo.attributes)) {
    const a = geo.attributes[k], il = a.isInterleavedBufferAttribute;
    const src = il ? a.data.array : a.array, stride = il ? a.data.stride : a.itemSize, off = il ? a.offset : 0;
    if (!il && src instanceof Float32Array) continue;
    const div = !a.normalized ? 1 : src instanceof Int8Array ? 127 : src instanceof Uint8Array ? 255 : src instanceof Int16Array ? 32767 : src instanceof Uint16Array ? 65535 : 1;
    const out = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) for (let j = 0; j < a.itemSize; j++) {
      const v = src[i * stride + off + j];
      out[i * a.itemSize + j] = a.normalized ? Math.max(-1, v / div) : v;
    }
    geo.setAttribute(k, new THREE.BufferAttribute(out, a.itemSize));
  }
}

function prepModel(name, scene) {
  // Qismlarga bo'lingan modelda "paint" (bo'yoq) bor — rangini garajda ham o'zgartirsa bo'ladi
  const M = { scene, paint: !!scene.getObjectByName('paint') };
  scene.traverse(o => {
    if (!o.isMesh) return;
    const src = o.material;
    if (src.map) { src.map.encoding = THREE.LinearEncoding; src.map.needsUpdate = true; }
    let mat;
    if (M.paint) {
      // Qismlar nomi bo'yicha: bo'yoq, xrom, qora qismlar, oyna, chiroqlar ("_far" — uzoq nusxa)
      const part = o.name.split('_')[0];
      if (part === 'paint') o.userData.paint = true;
      else if (part === 'glass') { mat = GLASS_MAT; o.userData.glass = true; }
      else if (part === 'lens') { mat = MODEL_LENS; o.userData.glass = true; }
      else if (part === 'red') mat = MODEL_RED;
      else if (part === 'chrome') mat = MODEL_CHROME;
      else mat = MODEL_DARK;
    } else if (name === 'person' || name === 'timur') mat = new THREE.MeshLambertMaterial({ map: src.map, emissive: 0xffffff, emissiveMap: src.map, emissiveIntensity: 0.3 }); // skanerda yorug'lik bor
    else mat = new THREE.MeshPhongMaterial({ map: src.map, shininess: 40, specular: 0x333333, side: src.side });
    if (mat) o.material = mat;
    o.castShadow = !o.userData.glass;
    if (name === 'timur') o.receiveShadow = true;
  });
  // Rul: aylanish markazi va o'qi (tools/prep-cars.mjs hisoblagan) — mashina ichidan ko'rinishda buriladi
  const st = scene.getObjectByName('steer');
  if (st && st.userData.steer) {
    const S = st.userData.steer, z = new THREE.Vector3(...S.a).normalize();
    const x = new THREE.Vector3(0, 1, 0).cross(z).normalize(), y = z.clone().cross(x);
    const basis = new THREE.Matrix4().makeBasis(x, y, z).setPosition(...S.c);
    st.updateMatrix();
    toFloatAttrs(st.geometry);
    st.geometry.applyMatrix4(new THREE.Matrix4().copy(basis).invert().multiply(st.matrix));
    st.position.set(0, 0, 0); st.quaternion.identity(); st.scale.set(1, 1, 1);
    const pivot = new THREE.Group();
    pivot.name = 'steerPivot';
    pivot.position.set(...S.c); pivot.quaternion.setFromRotationMatrix(basis);
    pivot.userData.q0 = pivot.quaternion.toArray(); pivot.userData.r = S.r; // userData nusxalanganda JSON bo'ladi
    st.parent.add(pivot); pivot.add(st);
    M.steer = S;
  }
  // Chiroqlar joyi: oldingi fara ("lens", old yarmi) va stop-chiroq ("red", orqa yarmi) — chap va o'ng markazlari
  if (M.paint) {
    const v = new THREE.Vector3(), near = scene.getObjectByName('lod0') || scene, lamps = { f: [], r: [] };
    for (const [part, key, sgn] of [['lens', 'f', 1], ['red', 'r', -1]]) {
      const mesh = near.getObjectByName(part);
      if (!mesh) continue;
      toFloatAttrs(mesh.geometry); mesh.updateMatrix();
      const P = mesh.geometry.attributes.position, side = [[0, 0, 0, 0, -1e9 * sgn], [0, 0, 0, 0, -1e9 * sgn]];
      for (let i = 0; i < P.count; i++) {
        v.fromBufferAttribute(P, i).applyMatrix4(mesh.matrix);
        if (v.z * sgn < 0.4) continue;
        const S = side[v.x >= 0 ? 0 : 1];
        S[0] += v.x; S[1] += v.y; S[2]++; S[4] = sgn > 0 ? Math.max(S[4], v.z) : Math.min(S[4], v.z);
      }
      for (const S of side) if (S[2] > 4) lamps[key].push([S[0] / S[2], S[1] / S[2], S[4] + 0.03 * sgn]);
    }
    if (lamps.f.length && lamps.r.length) M.lamps = lamps;
  }
  // Uzoqdagi mashinalarda yengil nusxa ko'rinadi (ko'chada 20+ mashina bo'ladi)
  const near = scene.getObjectByName('lod0'), far = scene.getObjectByName('lod1');
  if (near && far) {
    const lod = new THREE.LOD();
    lod.addLevel(near, 0); lod.addLevel(far, CAR_LOD_FAR);
    M.scene = lod;
  }
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
    Object.assign(CAR_TYPES.police, { model: 'police', kind: 'model', name: 'Politsiya', l: 4.8, w: 2.1, H: top, wr: 0.36, roofZ: M.bar.z, seat: { x: 0.45, y: 0.55, z: -0.1 }, plate: [0.42, 2.4, 0.55, -2.4] });
    delete CAR_TYPES.police.circ; delete CAR_TYPES.police._lamps; // o'lchamlar o'zgardi
  }
  return M;
}
