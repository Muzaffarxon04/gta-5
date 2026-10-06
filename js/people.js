'use strict';
// ===== Odamlar: skeletli (suyakli) realistik modellar, piyodalar va o'yinchi =====
const SKIN = [0xf0c8a0, 0xe0b088, 0xd09a70, 0xb98058, 0x9a6640];
const HAIR = [0x16100c, 0x2a1a10, 0x3d2817, 0x5a3a20, 0x1a1a1a];
const GREY_HAIR = [0x8a8a86, 0xb5b3ad, 0x6e6a64];
const TOPS = [0xffffff, 0x1c1c1c, 0x2e4a7a, 0x7a1f2b, 0x3a6b47, 0xc9b28a, 0x6a6f78, 0x9fb7d4, 0xe8d7b0, 0x553366, 0xd9662b];
const PANTS = [0x26354a, 0x1d2a3d, 0x1b1b1d, 0x4a4a4e, 0x6b5a45, 0x2f3a2c];
const SHOES = [0x111111, 0x2b1c12, 0xe8e8e8, 0x3a3a3a];
// Atlas (ikat) va chopon ranglari
const ATLAS = [[0xd81b60, 0xffc400, 0x1e88e5, 0x43a047], [0x8e24aa, 0xff7043, 0x26a69a, 0xfdd835], [0xc62828, 0x283593, 0xf9a825, 0x2e7d32]];
const CHAPON = [[0x1a237e, 0x6a1b9a, 0x00897b], [0x4a148c, 0xc62828, 0x283593], [0x004d40, 0x1565c0, 0x6d4c41]];
const SCARVES = [0xf5f0e6, 0xffffff, 0xe8d8c0, 0x6d4c41, 0x37474f, 0xb03a48];
const HUMAN_MAT = new THREE.MeshLambertMaterial({ vertexColors: true, skinning: true });
const BONE_NAMES = ['hips', 'spine', 'head', 'uaL', 'faL', 'uaR', 'faR', 'thL', 'shL', 'thR', 'shR'];
const MALE_TORSO = [[0.001, 0.86], [0.13, 0.865], [0.155, 0.93], [0.15, 1.0], [0.142, 1.08], [0.15, 1.18], [0.165, 1.3], [0.17, 1.37], [0.155, 1.43], [0.1, 1.475], [0.001, 1.49]];
const FEMALE_TORSO = [[0.001, 0.86], [0.14, 0.865], [0.16, 0.94], [0.145, 1.0], [0.122, 1.08], [0.132, 1.17], [0.152, 1.27], [0.148, 1.35], [0.128, 1.41], [0.085, 1.455], [0.001, 1.47]];

// Geometriya yordamchilari (model koordinatalarida, oyoq osti y=0, yuz +z tomonga)
const HG = {
  cyl: (rt, rb, h, x, y, z, seg = 9) => new THREE.CylinderGeometry(rt, rb, h, seg).translate(x, y, z),
  sph: (r, sx, sy, sz, x, y, z, ws = 12, hs = 9) => new THREE.SphereGeometry(r, ws, hs).scale(sx, sy, sz).translate(x, y, z),
  cap: (r, sx, sy, sz, x, y, z, frac) => new THREE.SphereGeometry(r, 14, 8, 0, TAU, 0, Math.PI * frac).scale(sx, sy, sz).translate(x, y, z),
  box: (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z),
  lathe: (pts, sx, sz, seg = 16) => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg).scale(sx, 1, sz),
};
const angleBand = (x, z, n) => Math.floor((Math.atan2(x, z) + Math.PI) / TAU * n);
const mod = (a, n) => ((a % n) + n) % n;

function skinnedGeo(parts) {
  const pos = [], nor = [], col = [], si = [], sw = [], c = new THREE.Color();
  for (const [g0, color, bone] of parts) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    const P = g.attributes.position.array, Nn = g.attributes.normal.array;
    for (let i = 0; i < P.length; i += 3) {
      pos.push(P[i], P[i + 1], P[i + 2]); nor.push(Nn[i], Nn[i + 1], Nn[i + 2]);
      c.setHex(typeof color === 'function' ? color(P[i], P[i + 1], P[i + 2]) : color);
      col.push(c.r, c.g, c.b); si.push(bone, 0, 0, 0); sw.push(1, 0, 0, 0);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  geo.computeBoundingSphere();
  return geo;
}
function makeBones(J) {
  const mk = (p, x, y, z) => { const b = new THREE.Bone(); b.position.set(x, y, z); if (p) p.add(b); return b; };
  const hips = mk(null, 0, 0.95, 0), spine = mk(hips, 0, 0.1, 0), head = mk(spine, 0, J.neckY - 1.05, 0);
  const uaL = mk(spine, J.shX, J.shY - 1.05, 0), faL = mk(uaL, 0.003, J.elY - J.shY, 0);
  const uaR = mk(spine, -J.shX, J.shY - 1.05, 0), faR = mk(uaR, -0.003, J.elY - J.shY, 0);
  const thL = mk(hips, J.hipX, J.hipY - 0.95, 0), shL = mk(thL, 0, J.knY - J.hipY, 0);
  const thR = mk(hips, -J.hipX, J.hipY - 0.95, 0), shR = mk(thR, 0, J.knY - J.hipY, 0);
  return [hips, spine, head, uaL, faL, uaR, faR, thL, shL, thR, shR];
}

// Tasodifiy kiyim: zamonaviy yigit, otaxon (do'ppi, chopon), ishbilarmon, qiz, atlas ko'ylakli ayol
function randomOutfit(style) {
  const r = Math.random();
  style = style || (r < 0.33 ? 'man' : r < 0.47 ? 'otaxon' : r < 0.58 ? 'suit' : r < 0.8 ? 'woman' : 'atlas');
  const o = { style, sex: 'm', skin: pick(SKIN), hair: pick(HAIR), hairStyle: 'short', hat: null, top: pick(TOPS), sleeves: pick(['short', 'long']),
    outfit: 'casual', pants: pick(PANTS), shoes: pick(SHOES), build: rand(0.94, 1.1), height: rand(0.95, 1.06) };
  if (style === 'otaxon') {
    Object.assign(o, { hair: pick(GREY_HAIR), hat: 'doppi', mustache: Math.random() < 0.6, beard: Math.random() < 0.4, build: rand(1.02, 1.15), height: rand(0.93, 1.0),
      pants: pick([0x1d1d1f, 0x2b2b2e, 0x3a3630]), shoes: 0x111111, sleeves: 'long' });
    if (Math.random() < 0.55) Object.assign(o, { outfit: 'chapon', pal: pick(CHAPON), sash: pick([0x2e7d32, 0xc62828, 0x283593, 0xe0e0e0]) });
    else Object.assign(o, { outfit: 'jacket', jacket: pick([0x2b2b2e, 0x3b3a36, 0x4a3b2a]), shirt: 0xe8e4da });
  } else if (style === 'suit') {
    const j = pick([0x1c1f26, 0x2a2d35, 0x23262b]);
    Object.assign(o, { outfit: 'suit', jacket: j, pants: j, shirt: 0xf4f4f4, tie: pick([0x7a1f2b, 0x1d3b6e, 0x333333]), shoes: 0x111111, sleeves: 'long' });
  } else if (style === 'woman') {
    Object.assign(o, { sex: 'f', hairStyle: pick(['long', 'long', 'bun']), build: rand(0.92, 1.04), height: rand(0.92, 0.99),
      top: pick([0xe57373, 0xf8bbd0, 0xffffff, 0x80cbc4, 0xfff176, 0x9575cd, 0x1c1c1c]), pants: pick([0x26354a, 0x1d2a3d, 0x1b1b1d, 0xd7ccc8]),
      skirt: Math.random() < 0.35 ? pick([0x37474f, 0x6d4c41, 0x1b1b1d, 0x880e4f]) : null, shoes: pick([0x111111, 0xe8e8e8, 0x8d6e63]) });
  } else if (style === 'atlas') {
    const pal = pick(ATLAS);
    Object.assign(o, { sex: 'f', outfit: 'atlas', pal, hat: Math.random() < 0.7 ? 'scarf' : null, hatColor: pick(SCARVES), hairStyle: 'long',
      build: rand(0.95, 1.08), height: rand(0.92, 0.98), pants: pal[1], sleeves: 'long', shoes: pick([0x111111, 0x6d4c41]) });
  } else if (style === 'police') {
    Object.assign(o, { outfit: 'uniform', top: 0x2c3a52, pants: 0x2c3a52, hat: 'cap', hatColor: 0x2c3a52, sleeves: 'long', shoes: 0x111111 });
  } else {
    if (Math.random() < 0.3) Object.assign(o, { outfit: 'jacket', jacket: pick([0x1d1d1f, 0x3d4a2f, 0x4e342e, 0x263238]), shirt: pick([0xffffff, 0x9fb7d4, 0x1c1c1c]), sleeves: 'long' });
    if (Math.random() < 0.12) Object.assign(o, { hat: 'cap', hatColor: pick([0x1c1c1c, 0xc62828, 0x1565c0, 0xeeeeee]) });
    else if (Math.random() < 0.08) o.hat = 'doppi';
    o.beard = Math.random() < 0.12;
  }
  return o;
}

function makeHuman(o) {
  const f = o.sex === 'f', bd = o.build || 1, P = [];
  const J = f ? { shX: 0.172, shY: 1.385, elY: 1.125, hipX: 0.088, hipY: 0.92, knY: 0.48, neckY: 1.53, hY: 1.645 }
    : { shX: 0.2, shY: 1.41, elY: 1.15, hipX: 0.095, hipY: 0.92, knY: 0.48, neckY: 1.55, hY: 1.665 };
  J.shX *= Math.sqrt(bd);
  const add = (geo, color, bone) => P.push([geo, color, bone]);
  const suited = o.outfit === 'jacket' || o.outfit === 'suit';
  const top = suited ? o.jacket : o.top;
  const chapon = o.outfit === 'chapon', atlas = o.outfit === 'atlas';
  const cloth = chapon ? (x, y, z) => o.pal[mod(angleBand(x, z, 28), 3)]
    : atlas ? (x, y, z) => o.pal[mod(Math.floor(angleBand(x, z, 14) + Math.sin(y * 24) * 0.9), 4)] : top;
  const wide = chapon ? 1.08 : 1;
  const sx = (f ? 1.1 : 1.18) * bd * wide, sz = (f ? 0.74 : 0.68) * bd * (chapon ? 1.12 : 1);
  // Tana
  const torsoC = chapon || atlas ? cloth : (x, y) => (y < 0.965 ? o.skirt || o.pants : y < 0.99 ? 0x1a1a1a : top);
  add(HG.lathe(f ? FEMALE_TORSO : MALE_TORSO, sx, sz), torsoC, 1);
  for (const s of [1, -1]) add(HG.sph(0.062 * bd * wide, 1.15, 0.9, 0.95, s * (J.shX - 0.025), J.shY - 0.005, 0), cloth, 1);
  add(HG.cyl(0.047, 0.054, 0.12, 0, J.neckY - 0.03, 0), o.skin, 1);
  const fz = 0.167 * sz + 0.002;
  if (suited) {
    add(HG.box(0.075, 0.2, 0.012, 0, 1.33, fz), o.shirt, 1);
    if (o.tie) add(HG.box(0.032, 0.19, 0.012, 0, 1.31, fz + 0.006), o.tie, 1);
  }
  if (chapon) {
    add(HG.box(0.06, 0.36, 0.012, 0, 1.24, fz), 0xe8e4da, 1);
    add(new THREE.CylinderGeometry(0.162, 0.162, 0.07, 16).scale(1.18 * bd * wide, 1, 0.68 * bd * 1.12).translate(0, 0.99, 0), o.sash, 1);
    add(HG.lathe([[0.235, 0.42], [0.215, 0.65], [0.185, 0.85], [0.165, 0.99]], 1.18 * bd * wide, 0.75 * bd * 1.12), cloth, 0);
  }
  if (atlas) add(HG.lathe([[0.235, 0.34], [0.215, 0.6], [0.18, 0.85], [0.152, 0.99]], 1.12 * bd, 0.85 * bd), cloth, 0);
  if (o.skirt) add(HG.lathe([[0.2, 0.5], [0.18, 0.7], [0.158, 0.9], [0.15, 0.99]], 1.12 * bd, 0.8 * bd), o.skirt, 0);
  if (o.outfit === 'uniform') { add(HG.box(0.04, 0.05, 0.01, 0.07, 1.34, fz), 0xe0b030, 1); add(HG.box(0.33, 0.05, 0.25, 0, 0.98, 0), 0x111111, 1); }

  // Bosh va yuz
  const hY = J.hY, hs = f ? 0.95 : 1, hc = o.hair;
  add(HG.sph(0.1 * hs, 0.92, 1.12, 1.0, 0, hY, 0.005), o.skin, 2);
  add(HG.sph(0.085 * hs, 0.92, 0.72, 0.95, 0, hY - 0.06, 0.018), o.skin, 2);
  add(new THREE.ConeGeometry(0.018, 0.05, 4).rotateX(Math.PI / 2).translate(0, hY - 0.012, 0.107 * hs), o.skin, 2);
  for (const s of [1, -1]) {
    add(HG.sph(0.014, 1.25, 0.7, 0.45, s * 0.034, hY + 0.016, 0.091 * hs, 8, 6), 0xf2eee6, 2);
    add(HG.sph(0.0075, 1, 1, 0.5, s * 0.034, hY + 0.016, 0.0965 * hs, 6, 5), 0x2a1a10, 2);
    add(HG.box(0.04, 0.007, 0.01, s * 0.035, hY + 0.04, 0.095 * hs), o.hat === 'scarf' ? o.hatColor : hc, 2);
    add(HG.sph(0.024, 0.45, 1, 0.75, s * 0.094 * hs, hY, -0.005, 8, 6), o.skin, 2);
  }
  add(HG.box(0.04, 0.009, 0.01, 0, hY - 0.05, 0.097 * hs), f ? 0xa8504a : 0x8a5a48, 2);
  if (o.beard) add(HG.sph(0.09 * hs, 0.95, 0.75, 0.98, 0, hY - 0.07, 0.022), hc, 2);
  if (o.mustache || o.beard) add(HG.box(0.06, 0.014, 0.014, 0, hY - 0.034, 0.104 * hs), hc, 2);
  if (o.hairStyle !== 'none' && o.hat !== 'scarf' && o.hat !== 'helmet') {
    add(HG.cap(0.106 * hs, 0.96, 1.1, 1.06, 0, hY + 0.008, -0.01, 0.52), hc, 2);
    add(HG.sph(0.098 * hs, 0.95, 0.85, 0.85, 0, hY - 0.02, -0.03), hc, 2);
    if (o.hairStyle === 'long') add(HG.sph(0.1, 1.05, 1.9, 0.72, 0, hY - 0.13, -0.05), hc, 2);
    if (o.hairStyle === 'bun') add(HG.sph(0.045, 1, 1, 1, 0, hY + 0.06, -0.1), hc, 2);
  }
  if (o.hat === 'doppi') {
    // Chust do'ppisi: to'rt qirrali, qora, oq "qalampir" naqshli
    add(new THREE.CylinderGeometry(0.13, 0.142, 0.07, 4).rotateY(Math.PI / 4).translate(0, hY + 0.09, -0.005), 0x121212, 2);
    for (const [dx, dz] of [[0, 1], [1, 0], [0, -1], [-1, 0]])
      add(HG.sph(0.024, dx ? 0.3 : 0.65, 1.1, dz ? 0.3 : 0.65, dx * 0.098, hY + 0.088, -0.005 + dz * 0.098, 8, 6), 0xf0f0f0, 2);
  } else if (o.hat === 'cap') {
    add(HG.cap(0.112, 0.97, 0.75, 1.07, 0, hY + 0.035, -0.005, 0.5), o.hatColor, 2);
    add(HG.box(0.15, 0.014, 0.1, 0, hY + 0.04, 0.115), o.outfit === 'uniform' ? 0x111111 : o.hatColor, 2);
  } else if (o.hat === 'helmet') {
    // Mototsikl dubulg'asi: qora oynali
    add(HG.sph(0.135, 1, 1.05, 1.08, 0, hY + 0.012, -0.005, 14, 10), o.hatColor || 0x1b1c1f, 2);
    add(HG.sph(0.13, 0.9, 0.5, 0.62, 0, hY + 0.0, 0.062, 12, 8), 0x0d0f12, 2);
  } else if (o.hat === 'scarf') {
    // Ro'mol: boshni yopadi, orqada tugun
    add(HG.cap(0.116 * hs, 0.98, 1.12, 1.08, 0, hY, -0.012, 0.42), o.hatColor, 2);
    add(HG.sph(0.1, 1.08, 1.5, 0.8, 0, hY - 0.09, -0.045), o.hatColor, 2);
    add(HG.sph(0.032, 1, 1, 1, 0, hY - 0.06, -0.12), o.hatColor, 2);
  }

  // Qo'llar (chap = +x, o'ng = -x)
  const ar = (f ? 0.88 : 1) * Math.sqrt(bd), aw = chapon ? 1.3 : 1;
  const sleeve = suited ? o.jacket : cloth;
  const shortS = o.sleeves === 'short' && !chapon && !atlas && !suited;
  for (const s of [1, -1]) {
    const ua = s > 0 ? 3 : 5, fa = s > 0 ? 4 : 6;
    const upC = shortS ? (x, y) => (y > J.shY - 0.12 ? sleeve : o.skin) : sleeve, foC = shortS ? o.skin : sleeve;
    add(HG.cyl(0.054 * ar * aw, 0.046 * ar * aw, 0.27, s * J.shX, J.shY - 0.13, 0), upC, ua);
    add(HG.sph(0.046 * ar * aw, 1, 1, 1, s * (J.shX + 0.003), J.elY, 0, 8, 6), foC, fa);
    add(HG.cyl(0.045 * ar * aw, 0.036 * ar * (chapon ? 1.4 : 1), 0.25, s * (J.shX + 0.005), J.elY - 0.13, 0), foC, fa);
    add(HG.sph(0.042 * ar, 0.65, 1.25, 1.0, s * (J.shX + 0.005), J.elY - 0.3, 0.008, 8, 6), o.skin, fa);
  }
  // Oyoqlar
  const lr = (f ? 0.9 : 1) * Math.sqrt(bd);
  const thighC = o.skirt ? o.skin : o.pants, shinC = o.skirt ? o.skin : o.pants;
  for (const s of [1, -1]) {
    const th = s > 0 ? 7 : 9, sh = s > 0 ? 8 : 10;
    add(HG.cyl(0.085 * lr, 0.064 * lr, 0.44, s * J.hipX, J.hipY - 0.22, 0), thighC, th);
    add(HG.sph(0.062 * lr, 1, 1, 1, s * J.hipX, J.knY, 0.004, 8, 6), shinC, sh);
    add(HG.cyl(0.062 * lr, 0.046 * lr, 0.41, s * J.hipX, J.knY - 0.205, 0), shinC, sh);
    add(HG.sph(0.056, 1.0, 0.62, 1.95, s * J.hipX, 0.05, 0.04, 10, 6), o.shoes, sh);
    add(HG.box(0.105, 0.024, 0.235, s * J.hipX, 0.013, 0.035), o.shoes === 0xe8e8e8 ? 0xcfcfcf : 0x1a1a1a, sh);
  }

  const bones = makeBones(J);
  const mesh = new THREE.SkinnedMesh(skinnedGeo(P), HUMAN_MAT);
  mesh.add(bones[0]);
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  mesh.castShadow = true;
  mesh.scale.setScalar(o.height || 1);
  const g = new THREE.Group(); g.rotation.order = 'YXZ'; g.add(mesh);
  const b = {}; BONE_NAMES.forEach((n, i) => (b[n] = bones[i]));
  return { g, mesh, b, hipsY: 0.95, stride: chapon || atlas || o.skirt ? 0.7 : 1 };
}

// Yurish/yugurish animatsiyasi: tizza va tirsak bukiladi, tana tebranadi
function poseHuman(hm, phase, amp, run) {
  const b = hm.b, s = Math.sin(phase), c = Math.cos(phase), A = amp * (0.5 + run * 0.4) * hm.stride;
  b.thL.rotation.set(-s * A, 0, 0); b.thR.rotation.set(s * A, 0, 0);
  b.shL.rotation.x = (Math.max(0, c) * (0.9 + run * 0.7) + 0.05) * amp * hm.stride;
  b.shR.rotation.x = (Math.max(0, -c) * (0.9 + run * 0.7) + 0.05) * amp * hm.stride;
  const sw = amp * (0.45 + run * 0.4);
  b.uaL.rotation.set(s * sw, 0, 0.07); b.uaR.rotation.set(-s * sw, 0, -0.07);
  b.faL.rotation.x = b.faR.rotation.x = -(0.12 + amp * (0.15 + run * 1.0));
  b.spine.rotation.set(run * 0.14 * amp, s * 0.09 * amp, 0);
  b.head.rotation.set(0, -s * 0.05 * amp, 0);
  b.hips.position.y = hm.hipsY + Math.abs(c) * 0.03 * amp * (1 + run);
}
function poseDead(hm) {
  const b = hm.b;
  b.uaL.rotation.set(0, 0, 1.25); b.uaR.rotation.set(0, 0, -1.25);
  b.faL.rotation.x = b.faR.rotation.x = -0.3;
  b.thL.rotation.set(0, 0, 0.18); b.thR.rotation.set(0, 0, -0.18);
  b.shL.rotation.x = b.shR.rotation.x = 0.1;
  b.spine.rotation.set(0, 0, 0); b.head.rotation.set(0, 0.4, 0);
  b.hips.position.y = hm.hipsY;
}

// Mashinada o'tirish va mototsiklda yurish holatlari
function poseSeated(hm) {
  const b = hm.b;
  b.hips.position.y = hm.hipsY;
  // Mashinadagidek: biroz suyanib, oyoqlar oldinga cho'zilgan (tom va pol ichida qolsin)
  b.spine.rotation.set(-0.38, 0, 0); b.head.rotation.set(0.3, 0, 0);
  b.thL.rotation.set(-1.45, 0, 0.06); b.thR.rotation.set(-1.45, 0, -0.06);
  b.shL.rotation.x = b.shR.rotation.x = 0.6;
  b.uaL.rotation.set(-0.85, 0, -0.15); b.uaR.rotation.set(-0.85, 0, 0.15);
  b.faL.rotation.x = b.faR.rotation.x = -0.55;
}
function poseRider(hm) {
  const b = hm.b;
  b.hips.position.y = hm.hipsY;
  b.spine.rotation.set(0.35, 0, 0); b.head.rotation.set(-0.25, 0, 0);
  b.thL.rotation.set(-1.15, 0, 0.28); b.thR.rotation.set(-1.15, 0, -0.28);
  b.shL.rotation.x = b.shR.rotation.x = 1.1;
  b.uaL.rotation.set(-1.05, 0, -0.12); b.uaR.rotation.set(-1.05, 0, 0.12);
  b.faL.rotation.x = b.faR.rotation.x = -0.35;
}

// Piyodalar kvartal atrofidagi yo'lak (halqa) bo'ylab yuradi
function ringPoint(b, t) {
  const r = b.ring; t = ((t % r.P) + r.P) % r.P;
  if (t < r.lx) return [r.a + t, r.d]; t -= r.lx;
  if (t < r.lz) return [r.c, r.d + t]; t -= r.lz;
  if (t < r.lx) return [r.c - t, r.e]; t -= r.lx;
  return [r.a, r.e - t];
}
function ringT(b, x, z) {
  const r = b.ring, cx = clamp(x, r.a, r.c), cz = clamp(z, r.d, r.e);
  const c = [
    [Math.abs(z - r.d) + Math.abs(x - cx), cx - r.a],
    [Math.abs(x - r.c) + Math.abs(z - cz), r.lx + cz - r.d],
    [Math.abs(z - r.e) + Math.abs(x - cx), r.lx + r.lz + r.c - cx],
    [Math.abs(x - r.a) + Math.abs(z - cz), 2 * r.lx + r.lz + r.e - cz],
  ];
  c.sort((p, q) => p[0] - q[0]);
  return c[0][1];
}
function nearestBlock(x, z) {
  const i = clamp(Math.floor((x - CITY.OFF) / CITY.CELL), 0, CITY.N - 1), j = clamp(Math.floor((z - CITY.OFF) / CITY.CELL), 0, CITY.N - 1);
  return World.blocks[i][j];
}

// Soyabon (yomg'irda)
const UMB_GEO = new THREE.ConeGeometry(0.75, 0.32, 10, 1, true), UMB_STICK = new THREE.CylinderGeometry(0.015, 0.015, 1.15, 5);
const UMB_STICK_MAT = new THREE.MeshLambertMaterial({ color: 0x222222 }), _umb = {};
const umbMat = c => _umb[c] || (_umb[c] = new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide }));
const UMB_COLORS = [0x1b1c1f, 0x1b1c1f, 0xc62828, 0x1565c0, 0x6a1b9a, 0x2e7d32, 0xf9a825];

class Ped {
  constructor(blk, t, style) {
    this.outfit = style && typeof style === 'object' ? style : randomOutfit(style);
    this.hm = makeHuman(this.outfit);
    this.blk = blk; this.t = t; this.dir = Math.random() < 0.5 ? 1 : -1;
    [this.x, this.z] = ringPoint(blk, t);
    this.y = 0.15; this.h = 0; this.state = 'walk'; this.hp = 40;
    this.walkSpd = rand(1.1, 1.6); this.phase = rand(0, 6);
    this.fleeT = 0; this.fx = 0; this.fz = 0; this.vx = 0; this.vy = 0; this.vz = 0; this.deadT = 0; this.fall = 0;
    this.onRoad = false; this.crossCd = rand(1, 6); this.umb = Math.random() < 0.5; this.umbMesh = null;
    World.scene.add(this.hm.g);
  }
  get alive() { return this.state !== 'dead'; }
  update(dt) {
    const hm = this.hm;
    if (this.state === 'dead') {
      this.vy -= 18 * dt; this.x += this.vx * dt; this.z += this.vz * dt; this.y += this.vy * dt;
      const gy = groundH(this.x, this.z) + 0.11;
      if (this.y <= gy) { this.y = gy; this.vy = 0; const f = Math.exp(-6 * dt); this.vx *= f; this.vz *= f; }
      pushOut(this, 0.3, this.y);
      this.fall = Math.min(Math.PI / 2, this.fall + dt * 5);
      hm.g.rotation.x = -this.fall;
      if (this.deadT === 0) poseDead(hm);
      this.deadT += dt;
    } else if (this.state === 'flee') {
      this.fleeT -= dt;
      const tgt = Math.atan2(this.x - this.fx, this.z - this.fz) + Math.sin(this.phase * 0.3) * 0.5;
      this.h += wrapAng(tgt - this.h) * Math.min(1, dt * 6);
      this.x += Math.sin(this.h) * 5.2 * dt; this.z += Math.cos(this.h) * 5.2 * dt;
      pushOut(this, 0.3, 0.5);
      this.phase += dt * 10.5;
      poseHuman(hm, this.phase, 1, 1);
      if (this.fleeT <= 0) {
        this.state = 'walk';
        this.blk = blockAt(this.x, this.z) || nearestBlock(this.x, this.z);
        this.t = ringT(this.blk, this.x, this.z);
      }
    } else if (this.state === 'hail') {
      // Taksi chaqirmoqda: qo'lini ko'tarib, mashinaga qarab turadi
      poseHuman(hm, 0, 0, 0);
      hm.b.uaR.rotation.set(-2.7, 0, 0.25); hm.b.faR.rotation.x = -0.25;
      this.h += wrapAng(Math.atan2(Player.x - this.x, Player.z - this.z) - this.h) * Math.min(1, dt * 3);
    } else if (this.state === 'wait') {
      // Svetofor oldida kutish: mashinalar uchun qizil yonsa — o'tadi
      const c = this.cr;
      this.h += wrapAng(Math.atan2(c.tx - this.x, c.tz - this.z) - this.h) * Math.min(1, dt * 6);
      poseHuman(hm, 0, 0, 0);
      if (signalFor(c.ni, c.nj, c.alongX) === 'R') { this.state = 'cross'; this.onRoad = true; }
      else if ((this.waitT += dt) > 40) this.state = 'walk';
    } else if (this.state === 'cross') {
      const c = this.cr, dx = c.tx - this.x, dz = c.tz - this.z, d = Math.hypot(dx, dz);
      const hurry = signalFor(c.ni, c.nj, c.alongX) !== 'R', sp = hurry ? 3.2 : this.walkSpd * 1.1;
      if (d < 0.3) {
        this.state = 'walk'; this.onRoad = false; this.blk = c.blk;
        this.t = ringT(c.blk, this.x, this.z); this.dir = Math.random() < 0.5 ? 1 : -1; this.crossCd = 6;
      } else {
        this.h += wrapAng(Math.atan2(dx, dz) - this.h) * Math.min(1, dt * 8);
        this.x += dx / d * Math.min(sp * dt, d); this.z += dz / d * Math.min(sp * dt, d);
      }
      this.phase += dt * sp * 3;
      poseHuman(hm, this.phase, hurry ? 1 : 0.75, hurry ? 1 : 0);
    } else {
      // Chorraha burchagiga yetganda ba'zan yo'lni kesib o'tadi
      this.crossCd -= dt;
      if (this.crossCd <= 0) {
        const r = this.blk.ring;
        for (const [qx, qz, sx, sz] of [[r.a, r.d, -1, -1], [r.c, r.d, 1, -1], [r.c, r.e, 1, 1], [r.a, r.e, -1, 1]]) {
          if (Math.abs(this.x - qx) > 1.5 || Math.abs(this.z - qz) > 1.5) continue;
          this.crossCd = 10;
          if (Math.random() < 0.5) this.planCross(qx, qz, sx, sz);
          break;
        }
      }
      const [tx, tz] = ringPoint(this.blk, this.t + this.dir * 1.2);
      const dx = tx - this.x, dz = tz - this.z, d = Math.hypot(dx, dz);
      if (d < 1.4) this.t += this.dir * this.walkSpd * dt;
      if (d > 0.05) {
        this.h += wrapAng(Math.atan2(dx, dz) - this.h) * Math.min(1, dt * 8);
        const sp = this.walkSpd * (d > 2 ? 1.4 : 1);
        this.x += dx / d * sp * dt; this.z += dz / d * sp * dt;
      }
      if (this.state === 'walk') { this.phase += dt * this.walkSpd * 3.4; poseHuman(hm, this.phase, 0.75, 0); }
    }
    // Yomg'irda soyabon
    const umb = this.umb && this.alive && this.state !== 'flee' && Weather.rain > 0.35;
    this.umbrella(umb);
    if (umb) { hm.b.uaL.rotation.set(-0.45, 0, -0.3); hm.b.faL.rotation.x = -1.45; }
    if (this.state !== 'dead') this.y = lerp(this.y, groundH(this.x, this.z), 0.3);
    hm.g.position.set(this.x, this.y, this.z);
    hm.g.rotation.y = this.h;
  }
  planCross(qx, qz, sx, sz) {
    const b = this.blk, horiz = Math.random() < 0.5;
    const ni = b.i + (sx > 0 ? 1 : 0), nj = b.j + (sz > 0 ? 1 : 0);
    if (!World.sigMap[ni * 100 + nj]) return;
    const bi = b.i + (horiz ? sx : 0), bj = b.j + (horiz ? 0 : sz);
    if (bi < 0 || bj < 0 || bi >= CITY.N || bj >= CITY.N) return;
    const gap = CITY.R + 4;
    this.cr = { ni, nj, alongX: !horiz, tx: horiz ? qx + sx * gap : qx, tz: horiz ? qz : qz + sz * gap, blk: World.blocks[bi][bj] };
    this.state = 'wait'; this.waitT = 0; this.onRoad = false;
  }
  umbrella(on) {
    if (on && !this.umbMesh) {
      const g = new THREE.Group(), canopy = new THREE.Mesh(UMB_GEO, umbMat(pick(UMB_COLORS))), stick = new THREE.Mesh(UMB_STICK, UMB_STICK_MAT);
      canopy.position.y = 2.18; stick.position.y = 1.62;
      g.add(canopy, stick); g.position.set(0.17, 0, 0.12);
      this.hm.g.add(g); this.umbMesh = g;
    }
    if (this.umbMesh) this.umbMesh.visible = on;
  }
  scare(sx, sz) {
    if (!this.alive) return;
    this.onRoad = false;
    this.state = 'flee'; this.fleeT = rand(6, 10); this.fx = sx; this.fz = sz;
  }
  hurt(dmg, sx, sz, kvx = 0, kvy = 0, kvz = 0) {
    if (!this.alive) return false;
    this.hp -= dmg;
    if (this.hp <= 0) {
      this.state = 'dead'; this.vx = kvx; this.vy = kvy; this.vz = kvz;
      this.h = Math.atan2(sx - this.x, sz - this.z);
      return true;
    }
    this.scare(sx, sz);
    return false;
  }
  remove() { World.scene.remove(this.hm.g); }
}

// ===== O'yinchi =====
const Player = {
  x: 0, y: 0.15, z: 0, vx: 0, vz: 0, vy: 0, h: 0, hp: 100, armor: 0, money: 0,
  inCar: null, weapon: 'fist', owned: { fist: true, pistol: true }, ammo: { pistol: 60, smg: 0, shotgun: 0 },
  outfitId: 'default', clothes: { default: true }, dead: false, onGround: true,
  phase: 0, punchT: 0, shootCd: 0, aimT: 0, hurtCd: 0, hm: null, gun: null,
};
function initPlayer(x, z) {
  const P = Player;
  P.hm = makeHuman(playerOutfit('default'));
  World.scene.add(P.hm.g);
  updateWeaponModel();
  P.x = x; P.z = z; P.y = groundH(x, z);
}
function updatePlayerFoot(dt, yaw, cars) {
  const P = Player;
  const J = activeStick();
  const ix = J.active ? J.x : (kd('KeyD') || kd('ArrowRight') ? 1 : 0) - (kd('KeyA') || kd('ArrowLeft') ? 1 : 0);
  const iz = J.active ? -J.y : (kd('KeyW') || kd('ArrowUp') ? 1 : 0) - (kd('KeyS') || kd('ArrowDown') ? 1 : 0);
  const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = -fz, rz = fx;
  let mx = fx * iz + rx * ix, mz = fz * iz + rz * ix;
  const ml = Math.hypot(mx, mz);
  const aiming = (Input.mouseR || P.aimT > 0) && !WEAPONS[P.weapon].melee;
  const run = kd('ShiftLeft') || kd('ShiftRight') || (J.active && ml > 0.95);
  const spd = ml > 0.12 ? (aiming ? 2.6 : run ? 7.4 : 3.4) * Math.min(1, J.active ? ml * 1.4 : 1) : 0;
  if (ml > 0) { mx /= ml; mz /= ml; }
  const k = 1 - Math.exp(-(P.onGround ? 12 : 1.5) * dt);
  P.vx = lerp(P.vx, mx * spd, k); P.vz = lerp(P.vz, mz * spd, k);
  if (aiming || P.punchT > 0) P.h += wrapAng(yaw - P.h) * Math.min(1, dt * 20);
  else if (ml > 0) P.h += wrapAng(Math.atan2(mx, mz) - P.h) * Math.min(1, dt * 12);
  if (kp('Space') && P.onGround) { P.vy = 6.2; P.onGround = false; }
  P.vy -= 18 * dt;
  P.x += P.vx * dt; P.z += P.vz * dt; P.y += P.vy * dt;
  pushOut(P, 0.35, P.y);
  // Mashinalar to'siq sifatida; tez kelayotgan mashina urib yuboradi
  P.hurtCd -= dt;
  for (const c of cars) {
    if (dist2(c.x, c.z, P.x, P.z) > 16) continue;
    const l = carLocal(c, P.x, P.z), hw = c.T.w / 2 + 0.35, hl = c.T.l / 2 + 0.35;
    if (Math.abs(l.r) >= hw || Math.abs(l.f) >= hl || P.y > c.y + 1.6) continue;
    const pr = hw - Math.abs(l.r), pf = hl - Math.abs(l.f), cfx = Math.sin(c.h), cfz = Math.cos(c.h);
    if (pr < pf) { const s = Math.sign(l.r) * pr; P.x += -cfz * s; P.z += cfx * s; }
    else { const s = Math.sign(l.f) * pf; P.x += cfx * s; P.z += cfz * s; }
    if (c.speed > 5 && P.hurtCd <= 0) {
      P.hurtCd = 0.8; hurtPlayer(c.speed * 2.2);
      P.vx = c.vx * 0.7; P.vz = c.vz * 0.7; P.vy = 4.5; P.onGround = false;
    }
  }
  const gy = groundH(P.x, P.z);
  if (P.y <= gy) { P.y = gy; P.vy = 0; P.onGround = true; } else if (P.y > gy + 0.05) P.onGround = false;
  // Animatsiya
  const hs = Math.hypot(P.vx, P.vz), hm = P.hm, b = hm.b;
  P.phase += dt * hs * 2.1;
  poseHuman(hm, P.phase, clamp(hs / 3.4, 0, 1) * (P.onGround ? 1 : 0.4), clamp((hs - 3.6) / 3.5, 0, 1));
  if (P.gun) P.gun.visible = P.weapon !== 'fist';
  if (P.punchT > 0) {
    P.punchT -= dt;
    const k2 = Math.sin(clamp(P.punchT / 0.3, 0, 1) * Math.PI);
    b.uaR.rotation.set(-1.5 * k2, 0, -0.07); b.faR.rotation.x = -0.15; b.spine.rotation.y = 0.3 * k2;
  } else if (aiming) {
    b.uaR.rotation.set(-Math.PI / 2 + Game.camPitch * 0.8, 0, 0); b.faR.rotation.x = 0;
    b.uaL.rotation.set(-1.2, 0, -0.5); b.faL.rotation.x = -0.4;
  }
  P.aimT = Math.max(0, P.aimT - dt);
  hm.g.position.set(P.x, P.y, P.z);
  hm.g.rotation.y = P.h;
}
function hurtPlayer(d) {
  const P = Player;
  if (P.dead || d <= 0) return;
  const a = Math.min(P.armor, d * 0.7);
  P.armor -= a; P.hp -= d - a;
  onPlayerHurt(d);
  if (P.hp <= 0) { P.hp = 0; playerDied('wasted'); }
}
