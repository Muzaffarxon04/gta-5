'use strict';
// ===== O'zbek mashinalari: modellar, ranglar va 3D shakl =====
// Har bir model yon profili (u — uzunlik bo'ylab, v — balandlik) bo'yicha yasaladi.
// uA — old oyna asosi, uB — tom boshi, uC — tom oxiri, uD — orqa oyna asosi, fa/ra — old/orqa o'q.
const CAR_TYPES = {
  nexia:  { name: 'Nexia',  kind: 'sedan',  l: 4.48, w: 1.66, H: 1.39, belt: 0.86, hoodF: 0.78, nose: 0.6,  tail: 0.88, uA: 1.1,  uB: 0.35, uC: -0.7,  uD: -1.28, fa: 1.4,  ra: -1.12, wr: 0.3,  max: 40, acc: 12, grip: 7,   mass: 1.0,  hp: 100 },
  cobalt: { name: 'Cobalt', kind: 'sedan',  l: 4.48, w: 1.73, H: 1.51, belt: 0.93, hoodF: 0.85, nose: 0.62, tail: 0.98, uA: 1.0,  uB: 0.3,  uC: -0.85, uD: -1.3,  fa: 1.38, ra: -1.24, wr: 0.31, max: 44, acc: 13, grip: 7.2, mass: 1.05, hp: 105 },
  gentra: { name: 'Gentra', kind: 'sedan',  l: 4.52, w: 1.73, H: 1.45, belt: 0.9,  hoodF: 0.82, nose: 0.6,  tail: 0.94, uA: 1.05, uB: 0.28, uC: -0.8,  uD: -1.32, fa: 1.4,  ra: -1.2,  wr: 0.31, max: 46, acc: 14, grip: 7.4, mass: 1.05, hp: 105 },
  malibu: { name: 'Malibu', kind: 'sedan',  l: 4.92, w: 1.85, H: 1.46, belt: 0.92, hoodF: 0.85, nose: 0.62, tail: 0.95, uA: 1.08, uB: 0.2,  uC: -0.95, uD: -1.6,  fa: 1.5,  ra: -1.33, wr: 0.33, max: 55, acc: 19, grip: 8.4, mass: 1.2,  hp: 120 },
  spark:  { name: 'Spark',  kind: 'hatch',  l: 3.64, w: 1.6,  H: 1.52, belt: 0.95, hoodF: 0.85, nose: 0.6,  tail: 0.95, uA: 1.15, uB: 0.5,  uC: -1.55, uD: -1.72, fa: 1.15, ra: -1.2,  wr: 0.28, max: 38, acc: 13, grip: 7.5, mass: 0.75, hp: 80 },
  matiz:  { name: 'Matiz',  kind: 'hatch',  l: 3.5,  w: 1.5,  H: 1.5,  belt: 0.92, hoodF: 0.82, nose: 0.55, tail: 0.92, uA: 1.2,  uB: 0.55, uC: -1.5,  uD: -1.66, fa: 1.12, ra: -1.22, wr: 0.27, max: 35, acc: 11, grip: 7,   mass: 0.7,  hp: 75 },
  damas:  { name: 'Damas',  kind: 'van',    l: 3.23, w: 1.4,  H: 1.9,  belt: 1.0,  hoodF: 0.95, nose: 0.5,  tail: 1.0,  uA: 1.2,  uB: 0.98, uC: -1.53, uD: -1.58, fa: 1.0,  ra: -0.85, wr: 0.27, max: 30, acc: 9,  grip: 6,   mass: 0.95, hp: 90 },
  labo:   { name: 'Labo',   kind: 'pickup', l: 3.3,  w: 1.4,  H: 1.85, belt: 1.0,  hoodF: 0.95, nose: 0.5,  tail: 0.95, uA: 1.23, uB: 1.0,  uC: 0.35,  uD: 0.3,   fa: 1.0,  ra: -0.9,  wr: 0.27, max: 30, acc: 9,  grip: 6,   mass: 1.0,  hp: 95 },
  jiguli: { name: 'Jiguli', kind: 'sedan',  l: 4.17, w: 1.61, H: 1.44, belt: 0.88, hoodF: 0.86, nose: 0.62, tail: 0.88, uA: 0.98, uB: 0.55, uC: -0.72, uD: -1.08, fa: 1.25, ra: -1.17, wr: 0.3,  max: 38, acc: 10, grip: 6.5, mass: 1.05, hp: 110, chrome: true,
    palette: [0xe8e2d0, 0x9c2a22, 0x2c5d8a, 0x6b8f4a, 0xd9b44a, 0xf3f3f0] },
};
CAR_TYPES.taxi = { ...CAR_TYPES.cobalt, name: 'Taksi (Cobalt)' };
CAR_TYPES.police = { ...CAR_TYPES.malibu, name: 'Politsiya (Malibu)', max: 52, acc: 18, mass: 1.3, hp: 140 };
CAR_TYPES.moto = { name: 'Mototsikl', kind: 'moto', l: 2.1, w: 0.8, H: 1.2, wr: 0.32, fa: 0.72, ra: -0.72, max: 52, acc: 21, grip: 9.5, mass: 0.45, hp: 60,
  palette: [0xc62828, 0x1b1c1f, 0x1565c0, 0xf3f3f0, 0x2e7d32, 0xff8f00] };
for (const T of Object.values(CAR_TYPES)) {
  T.roofZ = T.kind === 'moto' ? 0 : (T.uB + T.uC) / 2;
  // Haydovchi o'rindig'i (O'zbekistonda rul chap tomonda: +x)
  T.seat = T.kind === 'moto' ? { x: 0, y: 0.9, z: -0.22 } : { x: T.w * 0.22, y: T.wr + 0.3, z: T.uB - 0.35 };
}

// Toshkent ko'chalaridagidek: oq rang ko'pchilik, keyin kumush va qora
const CAR_COLORS = [0xf3f3f0, 0xf3f3f0, 0xf3f3f0, 0xf3f3f0, 0xf3f3f0, 0xb9bcc0, 0xb9bcc0, 0x1b1c1f, 0x1b1c1f,
  0x6c7178, 0xd6c9a8, 0x8a1c26, 0x274a7a, 0x2f5a3c];
const CAR_MIX = [['nexia', 16], ['cobalt', 18], ['gentra', 13], ['spark', 13], ['matiz', 8], ['damas', 9], ['labo', 5], ['jiguli', 7], ['malibu', 5], ['taxi', 6], ['moto', 7]];
function randomCarType() {
  let r = Math.random() * CAR_MIX.reduce((s, m) => s + m[1], 0);
  for (const [t, w] of CAR_MIX) if ((r -= w) <= 0) return t;
  return 'nexia';
}

const CAR_MAT = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 70, specular: 0x444444 });
const LIGHT_MAT = new THREE.MeshBasicMaterial({ vertexColors: true });
const GLASS_MAT = new THREE.MeshPhongMaterial({ color: 0x2a3a48, transparent: true, opacity: 0.42, shininess: 100, specular: 0x888888, depthWrite: false });
const WRECK_MAT = new THREE.MeshLambertMaterial({ color: 0x1c1b1a });
const BAR_RED = new THREE.MeshBasicMaterial({ color: 0xff2020 });
const BAR_BLUE = new THREE.MeshBasicMaterial({ color: 0x2060ff });
const _geo = {};

// Qismlarni bitta geometriyaga birlashtirish. Qism: [w,h,d,x,y,z,rang,'cyl'?] yoki { geo, color }
// color — son yoki (x, y, z) => rang funksiyasi.
function mergeParts(parts) {
  const pos = [], nor = [], col = [], c = new THREE.Color();
  for (const p of parts) {
    let g, color;
    if (Array.isArray(p)) {
      g = p[7] === 'cyl' ? new THREE.CylinderGeometry(p[0], p[0], p[1], 14).rotateZ(Math.PI / 2) : new THREE.BoxGeometry(p[0], p[1], p[2]);
      g.translate(p[3], p[4], p[5]); color = p[6];
    } else { g = p.geo; color = p.color; }
    if (g.index) g = g.toNonIndexed();
    const P = g.attributes.position.array, Nn = g.attributes.normal.array;
    for (let i = 0; i < P.length; i += 3) {
      pos.push(P[i], P[i + 1], P[i + 2]); nor.push(Nn[i], Nn[i + 1], Nn[i + 2]);
      c.setHex(typeof color === 'function' ? color(P[i], P[i + 1], P[i + 2]) : color);
      col.push(c.r, c.g, c.b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeBoundingSphere();
  return geo;
}

// Yon profilni mashina eni bo'ylab cho'zish (qirralari yumaloq)
function extrudeSide(shape, width, bevel) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 2, steps: 1, curveSegments: 10 });
  g.translate(0, 0, -(width - bevel * 2) / 2);
  g.rotateY(-Math.PI / 2);
  return g;
}
function bodyShape(T) {
  const s = new THREE.Shape(), L2 = T.l / 2, sill = T.wr, rA = T.wr + 0.06;
  s.moveTo(-L2, sill + 0.08);
  s.lineTo(-L2 + 0.06, sill);
  s.lineTo(T.ra - rA, sill); s.absarc(T.ra, sill, rA, Math.PI, 0, true);
  s.lineTo(T.fa - rA, sill); s.absarc(T.fa, sill, rA, Math.PI, 0, true);
  s.lineTo(L2 - 0.06, sill);
  s.lineTo(L2, T.nose);
  s.lineTo(L2 - 0.14, T.hoodF);
  s.lineTo(T.uA, T.belt);
  if (T.kind === 'sedan') { s.lineTo(T.uD, T.belt); s.lineTo(-L2 + 0.12, T.tail); s.lineTo(-L2, T.tail - 0.14); }
  else if (T.kind === 'pickup') { s.lineTo(T.uD, T.belt); s.lineTo(T.uD - 0.03, T.tail); s.lineTo(-L2, T.tail); }
  else { s.lineTo(-L2 + 0.06, T.belt); s.lineTo(-L2, T.belt - 0.15); }
  return s;
}
function cabinShape(T) {
  const s = new THREE.Shape();
  s.moveTo(T.uD, T.belt - 0.02); s.lineTo(T.uA, T.belt - 0.02); s.lineTo(T.uB, T.H - 0.03); s.lineTo(T.uC, T.H - 0.03);
  return s;
}
function roofShape(T) {
  const s = new THREE.Shape();
  s.moveTo(T.uC - 0.03, T.H - 0.07); s.lineTo(T.uB + 0.03, T.H - 0.07); s.lineTo(T.uB - 0.05, T.H); s.lineTo(T.uC + 0.05, T.H);
  return s;
}

function carGeo(type, color) {
  const key = type + color;
  if (_geo[key]) return _geo[key];
  const T = CAR_TYPES[type], W = T.w, L2 = T.l / 2, trim = T.chrome ? 0xcfd2d6 : 0x1e1f22;
  if (T.kind === 'moto') return (_geo[key] = motoGeo(color));
  const S = T.seat, inner = 0x2a2a2d;
  const P = [
    { geo: extrudeSide(bodyShape(T), W, 0.06), color },
    { geo: extrudeSide(roofShape(T), W * 0.88, 0.03), color },
    // Salon: pol, panel, o'rindiqlar, rul
    [W * 0.82, 0.012, T.uA - T.uD - 0.1, 0, T.belt + 0.006, (T.uA + T.uD) / 2, inner],
    [W * 0.82, 0.12, 0.3, 0, T.belt + 0.05, T.uA - 0.2, 0x1c1c1e],
    [0.42, 0.5, 0.1, S.x, T.belt + 0.08, S.z - 0.3, 0x333336],
    [0.42, 0.5, 0.1, -S.x, T.belt + 0.08, S.z - 0.3, 0x333336],
    [0.3, 0.3, 0.035, S.x, T.belt + 0.12, S.z + 0.5, 0x111111],
    [W * 0.87, T.H - T.belt - 0.06, 0.09, 0, (T.H + T.belt) / 2 - 0.02, T.roofZ + 0.08, type === 'police' ? 0x15171c : color],
    [W + 0.02, 0.17, 0.14, 0, T.wr + 0.03, L2 - 0.03, trim],
    [W + 0.02, 0.17, 0.14, 0, T.wr + 0.08, -L2 + 0.03, trim],
    [W * 0.42, 0.1, 0.04, 0, (T.nose + T.wr) / 2 + 0.05, L2 - 0.01, 0x15161a],
    [0.36, 0.1, 0.02, 0, T.wr + 0.14, L2 + 0.05, 0xf4f4f4],
    [0.36, 0.1, 0.02, 0, T.wr + 0.22, -L2 - 0.05, 0xf4f4f4],
  ];
  for (const s of [-1, 1]) {
    P.push([0.1, 0.07, 0.05, s * (W / 2 + 0.06), T.belt + 0.07, T.uA - 0.12, color]);
    for (const ax of [T.fa, T.ra]) {
      P.push([T.wr, 0.2, 0, s * (W / 2 - 0.1), T.wr, ax, 0x161616, 'cyl']);
      P.push([T.wr * 0.55, 0.21, 0, s * (W / 2 - 0.1), T.wr, ax, T.chrome ? 0xd8dadc : 0xa9adb2, 'cyl']);
    }
  }
  if (T.kind === 'pickup') P.push([W * 0.84, 0.02, T.uD + L2 - 0.15, 0, T.tail + 0.01, (T.uD - L2) / 2, 0x2a2b2e]);
  else if (T.kind !== 'van') P.push([W * 0.74, 0.42, 0.1, 0, T.belt + 0.06, T.uC + 0.12, 0x333336]);
  if (type === 'taxi') { P.push([0.56, 0.06, 0.24, 0, T.H + 0.03, T.roofZ, 0x111111]); P.push([0.52, 0.15, 0.2, 0, T.H + 0.13, T.roofZ, 0xffd21f]); }
  if (type === 'police') {
    for (const s of [-1, 1]) P.push([0.012, 0.12, T.l * 0.6, s * (W / 2 + 0.012), (T.belt + T.wr) / 2 + 0.1, 0.05, 0x1f55b3]);
    P.push([0.95, 0.06, 0.24, 0, T.H + 0.03, T.roofZ, 0x222222]);
  }
  return (_geo[key] = mergeParts(P));
}
function glassGeo(type) {
  const T = CAR_TYPES[type], key = 'G' + type;
  if (T.kind === 'moto') return null;
  return _geo[key] || (_geo[key] = extrudeSide(cabinShape(T), T.w * 0.86, 0.03));
}
function motoGeo(color) {
  return mergeParts([
    [0.32, 0.12, 0, 0, 0.32, 0.72, 0x151515, 'cyl'], [0.17, 0.13, 0, 0, 0.32, 0.72, 0xb5b8bc, 'cyl'],
    [0.32, 0.14, 0, 0, 0.32, -0.72, 0x151515, 'cyl'], [0.17, 0.15, 0, 0, 0.32, -0.72, 0xb5b8bc, 'cyl'],
    [0.26, 0.3, 0.42, 0, 0.47, 0.02, 0x3a3b3e],
    [0.16, 0.12, 1.0, 0, 0.66, 0, 0x2a2a2c],
    [0.34, 0.22, 0.48, 0, 0.84, 0.22, color],
    [0.28, 0.09, 0.56, 0, 0.86, -0.28, 0x111111],
    [0.22, 0.1, 0.5, 0, 0.78, -0.66, color],
    [0.05, 0.62, 0.05, 0.09, 0.62, 0.66, 0xb5b8bc], [0.05, 0.62, 0.05, -0.09, 0.62, 0.66, 0xb5b8bc],
    [0.22, 0.05, 0.36, 0, 0.66, 0.74, color],
    [0.72, 0.04, 0.04, 0, 1.0, 0.5, 0x1a1a1a],
    [0.2, 0.16, 0.1, 0, 0.92, 0.6, 0x1a1a1a],
    [0.08, 0.08, 0.6, -0.17, 0.42, -0.4, 0xc8c8c8],
  ]);
}
function lightGeo(type) {
  const key = 'L' + type;
  if (_geo[key]) return _geo[key];
  const T = CAR_TYPES[type], W = T.w, L2 = T.l / 2, P = [];
  if (T.kind === 'moto') return (_geo[key] = mergeParts([[0.14, 0.1, 0.04, 0, 0.92, 0.66, 0xfff6d0], [0.12, 0.06, 0.04, 0, 0.82, -0.92, 0xff2a1a]]));
  const tailY = T.kind === 'sedan' ? T.tail - 0.1 : T.kind === 'pickup' ? T.tail - 0.12 : T.belt - 0.2;
  for (const s of [-1, 1]) {
    P.push([0.3, 0.1, 0.06, s * (W / 2 - 0.26), T.nose - 0.07, L2 - 0.01, 0xfff6d0]);
    P.push([0.26, 0.12, 0.06, s * (W / 2 - 0.2), tailY, -L2 - 0.01, 0xff2a1a]);
    P.push([0.08, 0.06, 0.06, s * (W / 2 - 0.08), T.nose - 0.07, L2 - 0.03, 0xffa21a]);
  }
  return (_geo[key] = mergeParts(P));
}
