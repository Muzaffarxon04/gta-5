'use strict';
// ===== Toshkent ramzlari: Teleminora, Amir Temur xiyoboni, Chorsu bozori, choyxona, metro, avtobus bekatlari =====
const LM_MAT = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 30, specular: 0x222222 });
const BRONZE = new THREE.MeshPhongMaterial({ color: 0x6b5530, shininess: 70, specular: 0x887755 });
const BRONZE_SKIN = new THREE.MeshPhongMaterial({ color: 0x6b5530, shininess: 70, specular: 0x887755, skinning: true });
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const Landmarks = { blinkers: [], metro: [], areas: [] };

function signMesh(text, w, h, bg, fg = '#ffffff') {
  const c = document.createElement('canvas'); c.width = 512; c.height = Math.round(512 * h / w);
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = 'rgba(255,255,255,.65)'; g.lineWidth = 6; g.strokeRect(8, 8, c.width - 16, c.height - 16);
  let fs = Math.round(c.height * 0.55);
  do { g.font = `bold ${fs}px "Arial Black", Arial, sans-serif`; fs -= 2; } while (g.measureText(text).width > c.width - 50);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, c.width / 2, c.height / 2 + 3);
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), side: THREE.DoubleSide }));
}
// Ikki nuqta orasidagi silindr (r1 — a da, r2 — b da)
function cylBetween(a, b, r1, r2, seg = 8) {
  const dir = new THREE.Vector3().subVectors(b, a), len = dir.length();
  const g = new THREE.CylinderGeometry(r2, r1, len, seg).translate(0, len / 2, 0);
  g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), dir.normalize())));
  return g.translate(a.x, a.y, a.z);
}
function addMerged(scene, parts, mat = LM_MAT) {
  const m = new THREE.Mesh(mergeParts(parts), mat);
  m.castShadow = m.receiveShadow = true; scene.add(m);
  return m;
}
function buildLandmark(b, scene, trees) {
  if (b.type === 'square') buildAmirTemur(b, scene, trees);
  else if (b.type === 'tower') buildTvTower(b, scene, trees);
  else if (b.type === 'bazaar') buildChorsu(b, scene);
}

// ----- Amir Temur xiyoboni: dumaloq maydon, gulzor, otliq haykal -----
function buildAmirTemur(b, scene, trees) {
  const { cx, cz } = b, granite = 0x6b3a2e, path = 0xc9b99a;
  // Maydonga olib boruvchi yo'laklar (maydon atrofida qoladi)
  addMerged(scene, [-1, 1].flatMap(s => [[14, 0.06, 4, cx + s * 21, 0.19, cz, path], [4, 0.06, 14, cx, 0.19, cz + s * 21, path]]));
  const plaza = addMerged(scene, [
    { geo: new THREE.CylinderGeometry(15, 15, 0.12, 40).translate(cx, 0.22, cz), color: 0xc9c1b4 },
    { geo: new THREE.CylinderGeometry(10, 10, 0.3, 40).translate(cx, 0.3, cz), color: 0x4f8f3a },
    { geo: new THREE.TorusGeometry(9.2, 0.45, 6, 48).rotateX(Math.PI / 2).translate(cx, 0.45, cz), color: 0xc62828 },
    { geo: new THREE.TorusGeometry(7.6, 0.4, 6, 48).rotateX(Math.PI / 2).translate(cx, 0.45, cz), color: 0xf9a825 },
    [6, 1.0, 8, cx, 0.65, cz, granite], [4.2, 3.4, 6.2, cx, 2.8, cz, 0x7a4636], [4.8, 0.35, 6.8, cx, 4.65, cz, granite],
  ]);
  const col = addCollider(cx - 3, cz - 4, cx + 3, cz + 4, 9, 'building');
  // Ot (bronza), old chap oyog'i ko'tarilgan — haqiqiy nisbatlarda
  const P = [
    { geo: new THREE.SphereGeometry(1, 16, 12).scale(0.55, 0.6, 1.25).translate(0, 1.55, 0) },
    { geo: new THREE.SphereGeometry(0.56, 12, 8).translate(0, 1.6, 0.8) },
    { geo: new THREE.SphereGeometry(0.52, 12, 8).translate(0, 1.6, -0.85) },
    { geo: cylBetween(V3(0, 1.75, 1.05), V3(0, 2.5, 1.6), 0.34, 0.22, 10) },
    { geo: cylBetween(V3(0, 2.62, 1.55), V3(0, 2.2, 2.25), 0.22, 0.12, 10) },
    { geo: new THREE.ConeGeometry(0.05, 0.2, 6).translate(0.09, 2.78, 1.6) }, { geo: new THREE.ConeGeometry(0.05, 0.2, 6).translate(-0.09, 2.78, 1.6) },
    { geo: cylBetween(V3(0, 1.85, -1.3), V3(0, 0.85, -1.6), 0.13, 0.06, 8) },
    { geo: cylBetween(V3(-0.3, 1.3, 0.85), V3(-0.3, 0.0, 0.95), 0.13, 0.07, 8) },
    { geo: cylBetween(V3(0.3, 1.3, 0.85), V3(0.33, 0.75, 1.3), 0.13, 0.1, 8) }, { geo: cylBetween(V3(0.33, 0.75, 1.3), V3(0.33, 0.45, 0.98), 0.1, 0.07, 8) },
    { geo: cylBetween(V3(0.3, 1.35, -0.85), V3(0.3, 0.0, -0.95), 0.15, 0.07, 8) }, { geo: cylBetween(V3(-0.3, 1.35, -0.85), V3(-0.3, 0.0, -0.95), 0.15, 0.07, 8) },
    [0.9, 0.12, 0.7, 0, 2.12, -0.05, 0],
  ].map(p => Array.isArray(p) ? (p[6] = 0xffffff, p) : { geo: p.geo, color: 0xffffff });
  const statue = new THREE.Group();
  const horse = new THREE.Mesh(mergeParts(P), BRONZE); horse.castShadow = true;
  const rider = makeHuman({ sex: 'm', skin: 0, hair: 0, top: 0, pants: 0, shoes: 0, outfit: 'chapon', pal: [0, 0, 0], sash: 0, hat: 'doppi', sleeves: 'long', build: 1.1, beard: true, mustache: true });
  rider.mesh.material = BRONZE_SKIN;
  poseRider(rider);
  const rb = rider.b;
  rb.spine.rotation.set(0, 0, 0); rb.head.rotation.set(0, 0, 0);
  rb.thL.rotation.set(-0.9, 0, 0.55); rb.thR.rotation.set(-0.9, 0, -0.55);
  rb.uaR.rotation.set(-2.1, 0, 0.25); rb.faR.rotation.x = -0.2;
  rider.g.position.set(0, 1.2, -0.05);
  statue.add(horse, rider.g);
  statue.scale.setScalar(2.0);
  statue.position.set(cx, 4.82, cz); statue.rotation.y = -Math.PI / 2;
  scene.add(statue);
  const sign = signMesh('AMIR TEMUR', 3.6, 0.7, '#6b3a2e', '#e8d9a8');
  sign.position.set(cx - 2.13, 2.9, cz); sign.rotation.y = -Math.PI / 2; scene.add(sign);
  // Skanerlangan haqiqiy haykal yuklansa, shu qismlar uning o'rniga almashadi (useTemurModel)
  Landmarks.temur = { cx, cz, code: [plaza, statue, sign], col };
  for (let k = 0; k < 24; k++) {
    const a = (k + 0.5) / 24 * TAU, r = k % 2 ? 19 : 23.5;
    if (Math.abs(Math.sin(a * 2)) < 0.25) continue;
    trees.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r, rand(1.0, 1.4)]);
  }
  Landmarks.areas.push({ b, name: 'Amir Temur xiyoboni' });
}

// Amir Temur xiyoboni: skanerlangan maydon va otliq haykal (models/timur.js). Zinali maydon ustida yurish mumkin.
Landmarks.useTemurModel = function () {
  const M = MODELS.timur, T = this.temur;
  if (!M || !T || T.used) return;
  T.used = true;
  const node = M.scene.getObjectByName('timur'), meta = node && node.userData;
  if (!meta || !meta.zone) return;
  for (const o of T.code) o.visible = false;
  const g = M.scene;
  g.position.set(T.cx, 0.15, T.cz);
  g.rotation.y = Math.PI; // haykal yuzi g'arbga (−x), yozuvli tomoni ham o'sha yoqda
  World.scene.add(g);
  HEIGHT_ZONES.push({ x: T.cx, z: T.cz, r: meta.zone.r, step: meta.zone.step, prof: meta.zone.prof, base: 0.15 });
  // Poydevor: modeldagi izi (π ga burilgan)
  const [x0, z0, x1, z1, top] = meta.pedestal;
  removeCollider(T.col);
  T.col = addCollider(T.cx - x1, T.cz - z1, T.cx - x0, T.cz - z0, 0.15 + top, 'building');
};

// ----- Toshkent teleminorasi: uch oyoqli, kuzatuv maydonchasi, qizil-oq antenna -----
function buildTvTower(b, scene, trees) {
  const { cx, cz } = b, white = 0xe8e8e6, steel = 0xb8bcc2, red = 0xd32f2f, glass = 0x23415a, P = [];
  P.push({ geo: new THREE.CylinderGeometry(20, 20, 0.1, 40).translate(cx, 0.22, cz), color: 0xbdb6aa });
  for (let k = 0; k < 3; k++) {
    const a = k * TAU / 3 + Math.PI / 2, bx = cx + Math.cos(a) * 15, bz = cz + Math.sin(a) * 15;
    const top = V3(cx + Math.cos(a) * 2.4, 62, cz + Math.sin(a) * 2.4), base = V3(bx, 0, bz);
    P.push({ geo: cylBetween(base, top, 1.5, 0.8, 8), color: steel });
    const mid = base.clone().lerp(top, 0.45);
    P.push({ geo: cylBetween(mid, V3(cx, mid.y + 6, cz), 0.45, 0.45, 6), color: steel });
    P.push([3.4, 1.2, 3.4, bx, 0.6, bz, 0x8d8478]);
    addCollider(bx - 1.7, bz - 1.7, bx + 1.7, bz + 1.7, 30, 'building');
  }
  P.push({ geo: new THREE.CylinderGeometry(2.2, 3.2, 125, 12).translate(cx, 62.5, cz), color: white });
  addCollider(cx - 3.2, cz - 3.2, cx + 3.2, cz + 3.2, 125, 'building');
  P.push({ geo: new THREE.CylinderGeometry(6, 6, 1.4, 24).translate(cx, 70, cz), color: white });
  P.push({ geo: new THREE.CylinderGeometry(10, 8, 1.6, 32).translate(cx, 97, cz), color: white });
  P.push({ geo: new THREE.CylinderGeometry(9.5, 9.5, 3.2, 32).translate(cx, 99.4, cz), color: glass });
  P.push({ geo: new THREE.CylinderGeometry(8, 10, 1.8, 32).translate(cx, 101.9, cz), color: white });
  P.push({ geo: new THREE.CylinderGeometry(6.5, 6.5, 2.4, 28).translate(cx, 104, cz), color: glass });
  P.push({ geo: new THREE.CylinderGeometry(4, 7, 1.2, 28).translate(cx, 105.8, cz), color: white });
  for (let k = 0; k < 8; k++) { const r = 1.6 - k * 0.15; P.push({ geo: new THREE.CylinderGeometry(r - 0.15, r, 5.6, 10).translate(cx, 127.8 + k * 5.6, cz), color: k % 2 ? white : red }); }
  addMerged(scene, P);
  // Tepadagi va maydonchadagi chiroqlar (tunda miltillaydi)
  const lamp = new THREE.MeshBasicMaterial({ color: 0xff2020 });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8), lamp);
  beacon.position.set(cx, 171.5, cz); scene.add(beacon);
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * TAU, l = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 5), lamp);
    l.position.set(cx + Math.cos(a) * 10.2, 97.8, cz + Math.sin(a) * 10.2); scene.add(l);
    Landmarks.blinkers.push({ m: l, phase: k * 0.12 });
  }
  Landmarks.blinkers.push({ m: beacon, phase: 0 });
  const sign = signMesh('TOSHKENT TELEMINORASI', 7, 0.9, '#1d3b6e');
  sign.position.set(cx, 1.8, cz - 20.2); sign.rotation.y = Math.PI; scene.add(sign);
  for (let k = 0; k < 20; k++) {
    const a = k / 20 * TAU + 0.1, r = 23.5;
    if (Math.abs(Math.sin(a * 2)) < 0.2) continue;
    trees.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r, rand(1.0, 1.3)]);
  }
  Landmarks.areas.push({ b, name: 'Teleminora' });
}

// ----- Chorsu bozori: katta ko'k gumbaz, kichik gumbazlar, rastalar va choyxona -----
function buildChorsu(b, scene) {
  const { cx, cz } = b, sand = 0xd9c9a3, sandDark = 0xb9a57c, blueA = 0x1f86ad, blueB = 0x2ea3c7, P = [];
  P.push({ geo: new THREE.CylinderGeometry(15.5, 16, 6, 40).translate(cx, 3.15, cz), color: sand });
  P.push({ geo: new THREE.CylinderGeometry(16.05, 16.05, 2.2, 48, 1, true).translate(cx, 3.6, cz), color: (x, y, z) => (mod(angleBand(x - cx, z - cz, 48), 2) ? 0x3a2f25 : sand) });
  P.push({ geo: new THREE.CylinderGeometry(16.6, 16.6, 0.6, 40).translate(cx, 6.3, cz), color: sandDark });
  P.push({ geo: new THREE.SphereGeometry(16, 40, 16, 0, TAU, 0, Math.PI / 2).scale(1, 0.72, 1).translate(cx, 6.5, cz),
    color: (x, y, z) => (mod(Math.floor((y - 6.5) / 1.6) + angleBand(x - cx, z - cz, 32), 2) ? blueA : blueB) });
  P.push({ geo: new THREE.CylinderGeometry(2.2, 2.6, 2.2, 16).translate(cx, 18.6, cz), color: sand });
  P.push({ geo: new THREE.SphereGeometry(2.4, 16, 8, 0, TAU, 0, Math.PI / 2).translate(cx, 19.7, cz), color: blueB });
  P.push({ geo: new THREE.ConeGeometry(0.3, 2, 8).translate(cx, 23, cz), color: 0xd4af37 });
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const x = cx + sx * 19, z = cz + sz * 19;
    P.push({ geo: new THREE.CylinderGeometry(4.2, 4.4, 4, 20).translate(x, 2.15, z), color: sand });
    P.push({ geo: new THREE.SphereGeometry(4.4, 20, 8, 0, TAU, 0, Math.PI / 2).scale(1, 0.8, 1).translate(x, 4.15, z),
      color: (x2, y, z2) => (mod(angleBand(x2 - x, z2 - z, 16), 2) ? blueA : blueB) });
    addCollider(x - 4.2, z - 4.2, x + 4.2, z + 4.2, 7.5, 'building');
  }
  for (const [hx, hz] of [[15.5, 6], [6, 15.5], [11.3, 11.3]]) addCollider(cx - hx, cz - hz, cx + hx, cz + hz, 18, 'building');
  // Rastalar: soyabon, peshtaxta, qovun-tarvuz va anorlar
  const awn = [0xc62828, 0x2e7d32, 0xf9a825, 0x1565c0, 0x6a1b9a], fruit = [0xe0c060, 0x2e6b2e, 0xa31515, 0xd84315, 0x7cb342];
  let k = 0;
  const stall = (x, z, alongX) => {
    const W = alongX ? 4.2 : 1.6, D = alongX ? 1.6 : 4.2, c = awn[k++ % awn.length];
    P.push([W, 0.9, D, x, 0.6, z, 0x8d6e4a], [W + 0.4, 0.12, D + 1, x, 2.6, z, c]);
    for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P.push([0.08, 2.4, 0.08, x + px * (W / 2), 1.35, z + pz * (D / 2 + 0.4), 0x5d4037]);
    for (let f = 0; f < 5; f++) {
      const o = (f - 2) * 0.75, fc = pick(fruit), r = fc === 0x2e6b2e ? 0.32 : 0.2;
      P.push({ geo: new THREE.SphereGeometry(r, 8, 6).translate(x + (alongX ? o : 0), 1.05 + r * 0.6, z + (alongX ? 0 : o)), color: fc });
    }
    addCollider(x - W / 2, z - D / 2, x + W / 2, z + D / 2, 1.0, 'stall');
  };
  for (const o of [-10, -4.5, 1, 6.5, 12]) { stall(cx + o, cz - 24, true); stall(cx + o, cz + 24, true); }
  for (const o of [-10, -4.5, 1, 6.5, 12]) stall(cx - 24, cz + o, false);
  addMerged(scene, P);
  const sign = signMesh('CHORSU BOZORI', 9, 1.6, '#1f6f8f');
  sign.position.set(cx, 8.4, cz - 16.4); sign.rotation.y = Math.PI; scene.add(sign);
  buildChoyxona(cx + 20, cz, scene);
  Landmarks.areas.push({ b, name: 'Chorsu bozori' });
}

// ----- Choyxona: ayvon, o'ymakor ustunlar, so'rilar, samovar -----
function buildChoyxona(x, z, scene) {
  const wood = 0x7a5232, P = [
    [10, 0.35, 16.5, x + 0.5, 0.33, z, 0xbfae8c],
    [0.4, 3.4, 16.5, x - 4.4, 2.0, z, 0xefe6d6],
    [0.42, 0.5, 16.5, x - 4.4, 3.1, z, 0x1f86ad],
    [10.8, 0.35, 17.2, x + 0.4, 3.85, z, 0x6d4c2e],
    [11, 0.25, 17.4, x + 0.4, 4.1, z, 0x1f86ad],
  ];
  for (const pz of [-7.6, -2.5, 2.5, 7.6]) {
    P.push({ geo: new THREE.CylinderGeometry(0.17, 0.2, 3.3, 10).translate(x + 5.2, 2.0, z + pz), color: wood });
    P.push([0.55, 0.3, 0.55, x + 5.2, 3.55, z + pz, 0x5d3a1a]);
    addCollider(x + 5.0, z + pz - 0.2, x + 5.4, z + pz + 0.2, 4, 'lamp');
  }
  for (const pz of [-5, 0, 5]) {
    P.push([2.3, 0.5, 2.3, x + 0.6, 0.75, z + pz, 0x8d5a34], [2.1, 0.07, 2.1, x + 0.6, 1.03, z + pz, 0xa0222a]);
    P.push([0.9, 0.22, 0.9, x + 0.6, 1.18, z + pz, 0x4e342e]);
    P.push({ geo: new THREE.SphereGeometry(0.12, 8, 6).translate(x + 0.5, 1.4, z + pz), color: 0x1e88e5 });
    for (const [cx2, cz2] of [[0.25, 0.25], [0.3, -0.2], [-0.2, 0.3]]) P.push({ geo: new THREE.CylinderGeometry(0.06, 0.045, 0.07, 8).translate(x + 0.6 + cx2, 1.33, z + pz + cz2), color: 0xf2f2f2 });
    addCollider(x - 0.55, z + pz - 1.15, x + 1.75, z + pz + 1.15, 1.0, 'stall');
  }
  P.push({ geo: new THREE.CylinderGeometry(0.32, 0.36, 0.8, 12).translate(x + 3.9, 0.95, z + 7), color: 0xc9a227 });
  P.push({ geo: new THREE.ConeGeometry(0.3, 0.35, 12).translate(x + 3.9, 1.52, z + 7), color: 0xc9a227 });
  P.push({ geo: new THREE.SphereGeometry(0.16, 8, 6).translate(x + 3.9, 1.8, z + 7), color: 0x1e88e5 });
  addCollider(x - 4.6, z - 8.25, x - 4.2, z + 8.25, 4, 'building');
  addMerged(scene, P);
  const sign = signMesh('CHOYXONA', 5, 1.0, '#6d4c2e', '#f6e7b8');
  sign.position.set(x + 5.95, 4.75, z); sign.rotation.y = Math.PI / 2; scene.add(sign);
  Landmarks.tea = { x: x + 7.2, z };
}

// ----- Metro bekatlari: ko'k "M" belgili kirish pavilyoni -----
const METRO_DEFS = [
  { name: 'Chorsu', blk: [2, 4], side: 'south' }, { name: 'Amir Temur xiyoboni', blk: [4, 4], side: 'north' },
  { name: 'Bodomzor', blk: [6, 1], side: 'west' }, { name: 'Paxtakor', blk: [1, 6], side: 'east' },
  { name: 'Mustaqillik maydoni', blk: [6, 6], side: 'west' }, { name: 'Kosmonavtlar', blk: [3, 5], side: 'east' },
];
const SIDE_N = { north: [0, 1], south: [0, -1], east: [1, 0], west: [-1, 0] };
function metroSignTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#1565c0'; g.beginPath(); g.arc(64, 64, 60, 0, TAU); g.fill();
  g.fillStyle = '#fff'; g.font = 'bold 84px "Arial Black", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('M', 64, 70);
  return new THREE.CanvasTexture(c);
}
function buildMetro(scene, trees) {
  const signMat = new THREE.MeshBasicMaterial({ map: metroSignTex(), transparent: true, side: THREE.DoubleSide }), P = [];
  for (const d of METRO_DEFS) {
    const b = World.blocks[d.blk[0]][d.blk[1]], [nx, nz] = SIDE_N[d.side];
    const tx = nz !== 0 ? 1 : 0, tz = nx !== 0 ? 1 : 0;
    const ex = nx > 0 ? b.x1 : nx < 0 ? b.x0 : b.cx, ez = nz > 0 ? b.z1 : nz < 0 ? b.z0 : b.cz;
    const px = ex - nx * 6.5 + tx * 18, pz = ez - nz * 6.5 + tz * 18;
    const a = Math.atan2(nx, nz);
    const part = (w, h, dd, lx, ly, lz, col) => P.push({ geo: new THREE.BoxGeometry(w, h, dd).translate(lx, ly, lz).rotateY(a).translate(px, 0, pz), color: col });
    part(4.6, 3.0, 3.2, 0, 1.65, 0, 0x8d8478);
    part(3.6, 2.2, 0.06, 0, 1.4, 1.62, 0x23415a);
    part(5.2, 0.3, 4.0, 0, 3.3, 0.3, 0x5f5a52);
    part(0.12, 4.2, 0.12, 2.0, 2.1, 2.2, 0x37474f);
    addCollider(px - 2.4, pz - 2.4, px + 2.4, pz + 2.4, 3.3, 'building');
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), signMat);
    sign.position.set(px + Math.cos(-a) * 2.0 + Math.sin(a) * 2.2, 4.6, pz + Math.sin(-a) * 2.0 + Math.cos(a) * 2.2);
    sign.rotation.y = a; scene.add(sign);
    for (let i = trees.length - 1; i >= 0; i--) if (dist2(trees[i][0], trees[i][1], px, pz) < 36) trees.splice(i, 1);
    const mx = ex - nx * 3.0 + tx * 18, mz = ez - nz * 3.0 + tz * 18;
    Landmarks.metro.push({ name: d.name, x: mx, z: mz, nx, nz });
  }
  addMerged(scene, P);
}

// ----- Avtobus bekatlari: soyabon, o'rindiq, "A" belgisi; avtobuslar shu yerda to'xtaydi -----
World.busStops = {}; World.busStopList = [];
function buildBusStops(scene) {
  const P = [], N = CITY.N;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const b = World.blocks[i][j];
    const sides = [
      { on: Math.random() < 0.3, x: b.x0 + 1.3, z: b.cz - 8, a: -Math.PI / 2, A: [i, j + 1], B: [i, j], s: 49 },
      { on: Math.random() < 0.3, x: b.x1 - 1.3, z: b.cz - 8, a: Math.PI / 2, A: [i + 1, j], B: [i + 1, j + 1], s: 33 },
      { on: Math.random() < 0.3, x: b.cx - 8, z: b.z0 + 1.3, a: Math.PI, A: [i, j], B: [i + 1, j], s: 33 },
      { on: Math.random() < 0.3, x: b.cx - 8, z: b.z1 - 1.3, a: 0, A: [i + 1, j + 1], B: [i, j + 1], s: 49 },
    ];
    for (const sd of sides) {
      if (!sd.on) continue;
      const part = (w, h, d, lx, ly, lz, col) => P.push({ geo: new THREE.BoxGeometry(w, h, d).translate(lx, ly, lz).rotateY(sd.a).translate(sd.x, 0.15, sd.z), color: col });
      part(3.8, 0.12, 1.6, 0, 2.5, 0.1, 0x37474f);
      part(3.6, 1.9, 0.06, 0, 1.35, -0.6, 0x7fa3bd);
      part(0.1, 2.45, 0.1, -1.8, 1.25, 0.75, 0x37474f); part(0.1, 2.45, 0.1, 1.8, 1.25, 0.75, 0x37474f);
      part(2.6, 0.1, 0.45, 0, 0.5, -0.3, 0x8d6e4a);
      part(0.08, 2.6, 0.08, 2.4, 1.3, 0.8, 0x607d8b); part(0.5, 0.5, 0.06, 2.4, 2.6, 0.8, 0x2e7d32);
      const key = sd.A.join(',') + ',' + sd.B.join(',');
      World.busStops[key] = { s: sd.s };
      World.busStopList.push({ fi: sd.A[0], fj: sd.A[1], ti: sd.B[0], tj: sd.B[1], s: sd.s });
    }
  }
  if (P.length) addMerged(scene, P);
}

// ----- Skanerlangan haqiqiy odam (models/person.js): turgan holatda, uch joyda -----
function placePeople(scene) {
  const M = MODELS.person;
  if (!M || placePeople.done) return;
  placePeople.done = true;
  const spots = [], g = Missions.givers.find(v => v.type === 'race');
  if (g) spots.push([g.x + 1.4, g.z + 1.2, -Math.PI / 2]);
  const sq = Landmarks.areas.find(a => a.name === 'Amir Temur xiyoboni'), tw = Landmarks.areas.find(a => a.name === 'Teleminora');
  if (sq) spots.push([sq.b.cx - 12.5, sq.b.cz + 9, -Math.PI / 2 + 0.4]);
  if (tw) spots.push([tw.b.cx + 7, tw.b.cz - 21.5, Math.PI - 0.3]);
  for (const [x, z, h] of spots) {
    const p = M.scene.clone(true);
    p.position.set(x, groundH(x, z), z); p.rotation.y = h;
    p.traverse(o => { if (o.isMesh) o.castShadow = true; });
    scene.add(p);
    addCollider(x - 0.25, z - 0.25, x + 0.25, z + 0.25, 1.7, 'lamp');
  }
}

// ----- Yangilash, xarita va nomlar -----
Landmarks.update = function (t) {
  const night = 1 - World.daylight;
  for (const k of this.blinkers) k.m.visible = night > 0.2 ? Math.sin((t + k.phase) * 4) > -0.2 : k.phase === 0 ? Math.sin(t * 3) > 0.6 : false;
};
Landmarks.nameAt = function (x, z) {
  for (const a of this.areas) if (x > a.b.x0 && x < a.b.x1 && z > a.b.z0 && z < a.b.z1) return a.name;
  for (const m of this.metro) if (dist2(m.x, m.z, x, z) < 100) return m.name + ' metro bekati';
  return null;
};
Landmarks.blips = function (px, pz, all) {
  const out = [];
  for (const m of this.metro) if (all || dist2(m.x, m.z, px, pz) < 90000) out.push({ x: m.x, z: m.z, color: '#2f7fe0', size: 7, label: 'M' });
  if (this.tea) out.push({ x: this.tea.x, z: this.tea.z, color: '#d9a441', size: 7, label: 'C' });
  return out;
};
function drawLandmarksOnMap(g, o) {
  for (const a of Landmarks.areas) {
    const { cx, cz } = a.b;
    if (a.name === 'Chorsu bozori') { g.fillStyle = '#2ea3c7'; g.beginPath(); g.arc(cx - o, cz - o, 16, 0, TAU); g.fill(); }
    else if (a.name === 'Teleminora') { g.fillStyle = '#e8e8e6'; g.beginPath(); g.arc(cx - o, cz - o, 4, 0, TAU); g.fill(); }
    else if (a.name === 'Amir Temur xiyoboni') { g.fillStyle = '#c9c1b4'; g.beginPath(); g.arc(cx - o, cz - o, 15, 0, TAU); g.fill(); g.fillStyle = '#6b3a2e'; g.fillRect(cx - o - 3, cz - o - 4, 6, 8); }
    else if (a.name === 'Zapravka') { g.fillStyle = '#2e8b57'; g.fillRect(cx - o - 19, cz - o - 16.5, 22, 11); g.fillStyle = '#2f6db5'; g.fillRect(cx - o - 17, cz - o + 7, 18, 10); }
  }
}
