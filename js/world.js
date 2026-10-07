'use strict';
// ===== Shahar: yo'llar, kvartallar, binolar, daraxtlar, chiroqlar, osmon =====
const DAY_LEN = 480; // bir sutka = 8 daqiqa
const World = { blocks: [], bMats: [], lotSlots: [], parks: [], dayT: 0.36, daylight: 1, scene: null };

const DISTRICTS = [
  ['Olmazor', 'Shayxontohur', 'Yunusobod'],
  ['Chilonzor', 'Markaz', 'Mirzo Ulug\'bek'],
  ['Uchtepa', 'Yakkasaroy', 'Sergeli'],
];
const STREETS_X = ['Qatortol', 'Bunyodkor', 'Furqat', 'Navoiy', 'Amir Temur', 'Mustaqillik', 'Shota Rustaveli', 'Bobur', 'Buyuk Ipak Yo\'li'];
const STREETS_Z = ['Sebzor', 'Labzak', 'Beruniy', 'Usmon Nosir', 'Afrosiyob', 'Chorsu', 'Nukus', 'Kichik Halqa', 'Mirobod'];
function districtAt(x, z) {
  const t = CITY.SIZE / 3;
  const i = clamp(Math.floor((x - CITY.OFF) / t), 0, 2), j = clamp(Math.floor((z - CITY.OFF) / t), 0, 2);
  return DISTRICTS[j][i];
}
function streetAt(x, z) {
  const kx = clamp(Math.round((x - CITY.OFF) / CITY.CELL), 0, CITY.N), kz = clamp(Math.round((z - CITY.OFF) / CITY.CELL), 0, CITY.N);
  const dx = Math.abs(x - roadPos(kx)), dz = Math.abs(z - roadPos(kz));
  return (dx < dz ? STREETS_Z[kx] : STREETS_X[kz]) + ' ko\'chasi';
}

// Deraza teksturasi: kunduzgi rang + tungi yonib turgan derazalar
function shadeHex(hex, amt) { const c = new THREE.Color(hex); c.offsetHSL(0, 0, amt); return '#' + c.getHexString(); }
function windowTex(base, glass, style) {
  const S = 128, c = document.createElement('canvas'), l = document.createElement('canvas');
  c.width = c.height = l.width = l.height = S;
  const g = c.getContext('2d'), lg = l.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  lg.fillStyle = '#000'; lg.fillRect(0, 0, S, S);
  const cw = S / 4, rh = S / 4, isGlass = style === 'glass';
  for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) {
    const px = isGlass ? 2 : 6, py = isGlass ? 2 : 7;
    const x = k * cw + px, y = r * rh + py, w = cw - px * 2, h = rh - py * 2;
    g.fillStyle = shadeHex(glass, rand(-0.05, 0.05)); g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(255,255,255,0.13)'; g.fillRect(x, y, w, h * 0.35);
    if (Math.random() < 0.42) { lg.fillStyle = pick(['#ffd27a', '#ffe7b0', '#fff3d9', '#cfe6ff', '#ffc07a']); lg.fillRect(x, y, w, h); }
  }
  if (!isGlass) { g.fillStyle = 'rgba(0,0,0,0.13)'; for (let r = 0; r < 4; r++) g.fillRect(0, r * rh, S, 3); }
  const t1 = new THREE.CanvasTexture(c), t2 = new THREE.CanvasTexture(l);
  for (const t of [t1, t2]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; }
  return { map: t1, lit: t2 };
}
const PALETTES = [
  { base: '#cbbca6', glass: '#33475a' }, { base: '#9aa3ad', glass: '#2c3d4f' },
  { base: '#a5583d', glass: '#2a2f38' }, { base: '#e3dfd6', glass: '#3b5670' },
  { base: '#d8c38c', glass: '#30404e' }, { base: '#4c6378', glass: '#5b86a8', style: 'glass' },
  { base: '#2f3b47', glass: '#7aa7c7', style: 'glass' }, { base: '#5a6e64', glass: '#8fb3a5', style: 'glass' },
];

function makeBuilding(x, z, w, d, h, pal, baseY) {
  const geo = new THREE.BoxGeometry(w, h, d), uv = geo.attributes.uv;
  const TW = 12, TH = 14;
  for (let f = 0; f < 6; f++) {
    if (f === 2 || f === 3) continue;
    const su = (f < 2 ? d : w) / TW, sv = h / TH;
    for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); }
  }
  const M = World.bMats[pal];
  const mesh = new THREE.Mesh(geo, [M, M, World.roofMat, World.roofMat, M, M]);
  mesh.position.set(x, baseY + h / 2, z);
  mesh.castShadow = mesh.receiveShadow = true;
  World.scene.add(mesh);
  return mesh;
}

function buildWorld(scene) {
  World.scene = scene;
  const { N, R, B, SW } = CITY;
  for (const p of PALETTES) {
    const t = windowTex(p.base, p.glass, p.style);
    World.bMats.push(new THREE.MeshLambertMaterial({ map: t.map, emissive: 0xffe2a8, emissiveMap: t.lit, emissiveIntensity: 0 }));
  }
  World.roofMat = new THREE.MeshLambertMaterial({ color: 0x5b5d63 });

  // Okean, qirg'oq va asfalt
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), new THREE.MeshLambertMaterial({ color: 0x2d6f8f }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -0.7; scene.add(sea);
  const L = CITY.LIMIT + 8;
  const shore = new THREE.Mesh(new THREE.BoxGeometry(L * 2, 1, L * 2), new THREE.MeshLambertMaterial({ color: 0x627d40 }));
  shore.position.y = -0.52; shore.receiveShadow = true; scene.add(shore);
  const S = CITY.SIZE + R;
  // Asfalt: yomg'irda yaltiraydi (Weather specular ni o'zgartiradi)
  World.roadMat = new THREE.MeshPhongMaterial({ color: 0x3b3e44, specular: 0x000000, shininess: 45 });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(S, S), World.roadMat);
  road.rotation.x = -Math.PI / 2; road.receiveShadow = true; scene.add(road);

  const mats = {
    slab: new THREE.MeshLambertMaterial({ color: 0xa29e96 }),
    plaza: new THREE.MeshLambertMaterial({ color: 0x8b877f }),
    park: new THREE.MeshLambertMaterial({ color: 0x5f8c45 }),
    lot: new THREE.MeshLambertMaterial({ color: 0x46484d }),
    path: new THREE.MeshLambertMaterial({ color: 0xc9b99a }),
    water: new THREE.MeshLambertMaterial({ color: 0x3f8fb5 }),
  };
  // Qor yoqqanda oqaradigan materiallar (asl rangini eslab qolamiz)
  World.snowMats = [shore.material, mats.park, mats.slab, mats.plaza, World.roofMat].map(m => ({ m, base: m.color.clone() }));
  const slabGeo = new THREE.BoxGeometry(B, 0.15, B);
  const innerGeo = new THREE.BoxGeometry(B - SW * 2, 0.04, B - SW * 2);
  const special = { '4,4': 'square', '1,6': 'park', '6,1': 'tower', '6,6': 'park', '2,4': 'bazaar', '3,5': 'lot', '5,2': 'autodrom', '2,2': 'fuel', '6,4': 'fuel', '2,6': 'fuel', '1,3': 'lot' };
  const white = [], yellow = [], trees = [], lamps = [];

  for (let i = 0; i < N; i++) {
    World.blocks.push([]);
    for (let j = 0; j < N; j++) {
      const x0 = roadPos(i) + R / 2, x1 = roadPos(i + 1) - R / 2, z0 = roadPos(j) + R / 2, z1 = roadPos(j + 1) - R / 2;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const type = special[i + ',' + j] || 'city';
      const blk = { i, j, x0, x1, z0, z1, cx, cz, type, buildings: [] };
      const ra = x0 + 2, rc = x1 - 2, rd = z0 + 2, re = z1 - 2;
      blk.ring = { a: ra, c: rc, d: rd, e: re, lx: rc - ra, lz: re - rd, P: 2 * (rc - ra) + 2 * (re - rd) };
      World.blocks[i].push(blk);

      const slab = new THREE.Mesh(slabGeo, mats.slab);
      slab.position.set(cx, 0.075, cz); slab.receiveShadow = true; scene.add(slab);
      const inner = new THREE.Mesh(innerGeo, type === 'park' || type === 'square' || type === 'tower' ? mats.park : type === 'lot' || type === 'autodrom' || type === 'fuel' ? mats.lot : mats.plaza);
      inner.position.set(cx, 0.16, cz); inner.receiveShadow = true; scene.add(inner);

      const m = SW + 1.5, ix0 = x0 + m, ix1 = x1 - m, iz0 = z0 + m, iz1 = z1 - m;
      if (type === 'city') {
        const nx = Math.random() < 0.25 ? 1 : 2, nz = Math.random() < 0.25 ? 1 : 2, gap = 3;
        const cw = (ix1 - ix0 - gap * (nx - 1)) / nx, cd = (iz1 - iz0 - gap * (nz - 1)) / nz;
        const tall = lerp(90, 14, clamp(Math.hypot(cx, cz) / (CITY.SIZE * 0.62), 0, 1));
        for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) {
          const w = cw - rand(0, 4), d = cd - rand(0, 4);
          const bx = ix0 + a * (cw + gap) + cw / 2, bz = iz0 + b * (cd + gap) + cd / 2;
          const h = Math.max(10.5, Math.round(tall * rand(0.45, 1.15) / 3.5) * 3.5);
          const pal = h > 42 && Math.random() < 0.6 ? randi(5, 7) : randi(0, 4);
          makeBuilding(bx, bz, w, d, h, pal, 0.15);
          let top = h + 0.15;
          if (h > 40 && Math.random() < 0.55) { const h2 = Math.round(h * 0.3 / 3.5) * 3.5; makeBuilding(bx, bz, w * 0.64, d * 0.64, h2, pal, top); top += h2; }
          if (Math.random() < 0.6) {
            const box = new THREE.Mesh(new THREE.BoxGeometry(rand(2, 5), rand(1.5, 3), rand(2, 5)), World.roofMat);
            box.position.set(bx + rand(-w / 4, w / 4), top + 1, bz + rand(-d / 4, d / 4)); box.castShadow = true; scene.add(box);
          }
          addCollider(bx - w / 2, bz - d / 2, bx + w / 2, bz + d / 2, h + 0.15, 'building');
          blk.buildings.push({ x0: bx - w / 2, x1: bx + w / 2, z0: bz - d / 2, z1: bz + d / 2 });
        }
      } else if (type === 'park') {
        World.parks.push(blk);
        const p1 = new THREE.Mesh(new THREE.BoxGeometry(B - SW * 2, 0.05, 4), mats.path);
        p1.position.set(cx, 0.18, cz); scene.add(p1);
        const p2 = new THREE.Mesh(new THREE.BoxGeometry(4, 0.05, B - SW * 2), mats.path);
        p2.position.set(cx, 0.18, cz); scene.add(p2);
        const pond = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 0.3, 24), mats.water);
        pond.position.set(cx, 0.2, cz); scene.add(pond);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(6.2, 0.35, 6, 28), mats.slab);
        rim.rotation.x = Math.PI / 2; rim.position.set(cx, 0.35, cz); scene.add(rim);
        for (let t = 0; t < 22; t++) {
          const tx = rand(ix0, ix1), tz = rand(iz0, iz1);
          if (Math.abs(tx - cx) < 4 || Math.abs(tz - cz) < 4 || Math.hypot(tx - cx, tz - cz) < 9) continue;
          trees.push([tx, tz, rand(0.9, 1.5)]);
        }
      } else if (type === 'square' || type === 'tower' || type === 'bazaar') {
        buildLandmark(blk, scene, trees);
      } else if (type === 'autodrom') {
        Autodrom.build(blk, scene);
      } else if (type === 'fuel') {
        Fuel.build(blk, scene);
      } else {
        // avtoturargoh
        for (const rowZ of [iz0 + 4, iz1 - 4]) {
          for (let sx = ix0 + 1; sx <= ix1 - 1; sx += 3.4) {
            white.push([sx, rowZ, 0.12, 5]);
            if (sx + 1.7 < ix1 - 1) World.lotSlots.push({ x: sx + 1.7, z: rowZ, h: rowZ < cz ? 0 : Math.PI });
          }
        }
      }

      // Yo'lak bo'yidagi chiroqlar va daraxtlar
      const sides = [
        { x: cx, z: z0 + 1, ax: 1, az: 0, out: Math.PI }, { x: cx, z: z1 - 1, ax: 1, az: 0, out: 0 },
        { x: x0 + 1, z: cz, ax: 0, az: 1, out: -Math.PI / 2 }, { x: x1 - 1, z: cz, ax: 0, az: 1, out: Math.PI / 2 },
      ];
      for (const s of sides) [-26, -13, 0, 13, 26].forEach((o, k) => {
        const px = s.x + s.ax * o, pz = s.z + s.az * o;
        if (k % 2 === 0) lamps.push([px, pz, s.out]); else if (type !== 'lot' && type !== 'autodrom' && type !== 'fuel') trees.push([px, pz, rand(0.8, 1.1)]);
      });
    }
  }

  // Yo'l chiziqlari va piyoda o'tish joylari
  for (let k = 0; k <= N; k++) {
    const c = roadPos(k);
    for (let s = 0; s < N; s++) {
      const a = roadPos(s) + R / 2, b = roadPos(s + 1) - R / 2, mid = (a + b) / 2, len = b - a - 8;
      for (const o of [-0.2, 0.2]) { yellow.push([mid, c + o, len, 0.15]); yellow.push([c + o, mid, 0.15, len]); }
      for (let t = a + 5; t < b - 7; t += 6) for (const o of [-4.5, 4.5]) { white.push([t + 1.5, c + o, 3, 0.15]); white.push([c + o, t + 1.5, 0.15, 3]); }
      for (const e of [a + 1.6, b - 1.6]) for (let q = -R / 2 + 1.2; q <= R / 2 - 1.2; q += 1.4) { white.push([e, c + q, 2.2, 0.7]); white.push([c + q, e, 0.7, 2.2]); }
    }
  }
  instStripes(scene, white, 0xe8e6df);
  instStripes(scene, yellow, 0xe9c13a);
  buildMetro(scene, trees);
  buildTrees(scene, trees);
  buildLamps(scene, lamps);
  buildSignals(scene);
  buildBusStops(scene);
  setupSky(scene);
  buildMapCanvas();
}

function instStripes(scene, list, color) {
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.02, 1), new THREE.MeshLambertMaterial({ color }), list.length);
  const m4 = new THREE.Matrix4();
  list.forEach((s, i) => { m4.makeScale(s[2], 1, s[3]); m4.setPosition(s[0], 0.02, s[1]); im.setMatrixAt(i, m4); });
  im.receiveShadow = true; scene.add(im);
}

function buildTrees(scene, list) {
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.22, 2.6, 6), new THREE.MeshLambertMaterial({ color: 0x5a4030 }), list.length);
  const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.7, 0), new THREE.MeshLambertMaterial({ color: 0xffffff }), list.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color(), e = new THREE.Euler();
  list.forEach(([x, z, s], i) => {
    m4.compose(new THREE.Vector3(x, 1.4 * s, z), q.identity(), new THREE.Vector3(s, s, s)); trunk.setMatrixAt(i, m4);
    e.set(rand(0, 1), rand(0, 6), 0); q.setFromEuler(e);
    m4.compose(new THREE.Vector3(x, 3.4 * s, z), q, new THREE.Vector3(s, s * rand(0.9, 1.25), s)); crown.setMatrixAt(i, m4);
    col.setHSL(rand(0.22, 0.32), rand(0.35, 0.55), rand(0.28, 0.4)); crown.setColorAt(i, col);
    addCollider(x - 0.3, z - 0.3, x + 0.3, z + 0.3, 5, 'tree');
  });
  trunk.castShadow = crown.castShadow = true;
  scene.add(trunk, crown);
}

function buildLamps(scene, list) {
  const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.11, 6.5, 6), new THREE.MeshLambertMaterial({ color: 0x2c2f35 }), list.length);
  const arm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.1, 1.6), pole.material, list.length);
  World.lampHeadMat = new THREE.MeshBasicMaterial({ color: 0x777777 });
  const head = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 0.14, 0.7), World.lampHeadMat, list.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
  list.forEach(([x, z, out], i) => {
    m4.makeTranslation(x, 3.25, z); pole.setMatrixAt(i, m4);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), out);
    const ox = Math.sin(out), oz = Math.cos(out);
    m4.compose(new THREE.Vector3(x + ox * 0.8, 6.45, z + oz * 0.8), q, one); arm.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(x + ox * 1.5, 6.35, z + oz * 1.5), q, one); head.setMatrixAt(i, m4);
    addCollider(x - 0.15, z - 0.15, x + 0.15, z + 0.15, 6.5, 'lamp');
  });
  scene.add(pole, arm, head);
}

// ===== Svetoforlar =====
// Sikl (27 s): z bo'ylab yashil 0–10, sariq 10–12.5, hammasi qizil; x bo'ylab yashil 14–24, sariq 24–26.
const SIG_CYCLE = 27;
const SIG_ON = [new THREE.Color(0xff2a1a), new THREE.Color(0xffc21a), new THREE.Color(0x2bff6e)];
const SIG_OFF = [new THREE.Color(0x3a0d0a), new THREE.Color(0x3a2e08), new THREE.Color(0x0a3318)];
World.sigT = 0; World.sigMap = {}; World.sigHeads = [];
function signalFor(i, j, alongX) {
  const s = World.sigMap[i * 100 + j];
  if (!s) return 'G';
  const t = (World.sigT + s.off) % SIG_CYCLE;
  if (alongX) return t >= 14 && t < 24 ? 'G' : t >= 24 && t < 26 ? 'Y' : 'R';
  return t < 10 ? 'G' : t < 12.5 ? 'Y' : 'R';
}
function buildSignals(scene) {
  const heads = World.sigHeads;
  for (let i = 1; i < CITY.N; i++) for (let j = 1; j < CITY.N; j++) {
    const s = { i, j, off: rand(0, SIG_CYCLE) };
    World.sigMap[i * 100 + j] = s;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) heads.push({ s, dx, dz, c: -1 });
  }
  const n = heads.length, dark = new THREE.MeshLambertMaterial({ color: 0x24262a });
  const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.12, 5.6, 6), dark, n);
  const arm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.1, 5.4), dark, n);
  const box = new THREE.InstancedMesh(new THREE.BoxGeometry(0.45, 1.2, 0.35), new THREE.MeshLambertMaterial({ color: 0x1a1b1e }), n);
  const lamps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.26, 0.26, 0.05), new THREE.MeshBasicMaterial({ color: 0xffffff }), n * 3);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3();
  const off = CITY.R / 2 + 1;
  heads.forEach((h, k) => {
    // Kelayotgan mashinaga nisbatan o'ng-yaqin burchakda ustun, yo'l ustida chiroq
    const nx = roadPos(h.s.i), nz = roadPos(h.s.j), rx = -h.dz, rz = h.dx;
    const cx = nx - h.dx * off + rx * off, cz = nz - h.dz * off + rz * off;
    m4.makeTranslation(cx, 2.8, cz); pole.setMatrixAt(k, m4);
    q.setFromAxisAngle(up, Math.atan2(-rx, -rz));
    m4.compose(v.set(cx - rx * 2.7, 5.5, cz - rz * 2.7), q, one); arm.setMatrixAt(k, m4);
    const hx = cx - rx * 5.2, hz = cz - rz * 5.2;
    q.setFromAxisAngle(up, Math.atan2(-h.dx, -h.dz));
    m4.compose(v.set(hx, 4.95, hz), q, one); box.setMatrixAt(k, m4);
    for (let c = 0; c < 3; c++) {
      m4.compose(v.set(hx - h.dx * 0.19, 5.31 - c * 0.36, hz - h.dz * 0.19), q, one);
      lamps.setMatrixAt(k * 3 + c, m4);
      lamps.setColorAt(k * 3 + c, SIG_OFF[c]);
    }
    addCollider(cx - 0.15, cz - 0.15, cx + 0.15, cz + 0.15, 5.6, 'lamp');
  });
  pole.castShadow = arm.castShadow = box.castShadow = true;
  scene.add(pole, arm, box, lamps);
  World.sigLamps = lamps;
  updateSignals(0);
}
function updateSignals(dt) {
  World.sigT += dt;
  let changed = false;
  World.sigHeads.forEach((h, k) => {
    const st = signalFor(h.s.i, h.s.j, h.dx !== 0), c = st === 'R' ? 0 : st === 'Y' ? 1 : 2;
    if (h.c === c) return;
    h.c = c; changed = true;
    for (let q = 0; q < 3; q++) World.sigLamps.setColorAt(k * 3 + q, q === c ? SIG_ON[q] : SIG_OFF[q]);
  });
  if (changed) World.sigLamps.instanceColor.needsUpdate = true;
}

// ===== Osmon va yorug'lik =====
const SKY = { day: new THREE.Color(0x8fc3ec), dusk: new THREE.Color(0xf09a6a), night: new THREE.Color(0x0d1226), col: new THREE.Color() };
function setupSky(scene) {
  World.hemi = new THREE.HemisphereLight(0xcfe3ff, 0x4a4030, 0.7);
  scene.add(World.hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = sc.bottom = -75; sc.right = sc.top = 75; sc.near = 10; sc.far = 400;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  World.sun = sun;
  scene.fog = new THREE.Fog(0x8fc3ec, 90, 420);
  scene.background = new THREE.Color(0x8fc3ec);
}
function updateSky(dt, px, pz) {
  World.dayT = (World.dayT + dt / DAY_LEN) % 1;
  const a = (World.dayT - 0.25) * TAU, sy = Math.sin(a), sx = Math.cos(a);
  const day = clamp(sy * 3 + 0.25, 0, 1), dusk = clamp(1 - Math.abs(sy) * 3.5, 0, 1);
  World.daylight = day;
  const sun = World.sun;
  sun.position.set(px + sx * 110, 30 + Math.max(sy, 0) * 140, pz + 70);
  sun.target.position.set(px, 0, pz);
  sun.intensity = 0.95 * day;
  sun.color.setRGB(1, lerp(1, 0.75, dusk), lerp(1, 0.55, dusk));
  World.hemi.intensity = 0.42 + 0.33 * day;
  World.hemi.color.setRGB(lerp(0.45, 0.81, day), lerp(0.5, 0.89, day), lerp(0.85, 1, day));
  SKY.col.copy(SKY.night).lerp(SKY.day, day).lerp(SKY.dusk, dusk * 0.55);
  World.scene.background.copy(SKY.col);
  World.scene.fog.color.copy(SKY.col);
  const night = 1 - day;
  for (const m of World.bMats) m.emissiveIntensity = night * 0.95;
  World.lampHeadMat.color.setRGB(lerp(0.47, 1, night), lerp(0.47, 0.85, night), lerp(0.47, 0.55, night));
  // Modelli mashinalarning faralari kechasi yonadi
  MODEL_LENS.emissive.setRGB(night * 0.95, night * 0.9, night * 0.75);
}
function clockText() {
  const mins = Math.floor(World.dayT * 24 * 60);
  return String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
}

// ===== Mini-xarita uchun shahar rasmi (1 piksel = 1 metr) =====
function buildMapCanvas() {
  const L = CITY.LIMIT, size = Math.ceil(L * 2), c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d'), o = -L;
  g.fillStyle = '#2b5a73'; g.fillRect(0, 0, size, size);
  g.fillStyle = '#3c5233'; g.fillRect(0, 0, size, size);
  const S = CITY.SIZE + CITY.R;
  g.fillStyle = '#8c929b'; g.fillRect(-S / 2 - o, -S / 2 - o, S, S);
  for (const col of World.blocks) for (const b of col) {
    g.fillStyle = b.type === 'park' || b.type === 'square' || b.type === 'tower' ? '#4f7d3c' : b.type === 'lot' || b.type === 'autodrom' || b.type === 'fuel' ? '#525760' : b.type === 'bazaar' ? '#6b6457' : '#3f4752';
    g.fillRect(b.x0 - o, b.z0 - o, b.x1 - b.x0, b.z1 - b.z0);
    g.fillStyle = '#2c333c';
    for (const k of b.buildings) g.fillRect(k.x0 - o, k.z0 - o, k.x1 - k.x0, k.z1 - k.z0);
    if (b.type === 'park') { g.fillStyle = '#3f8fb5'; g.beginPath(); g.arc(b.cx - o, b.cz - o, 6, 0, TAU); g.fill(); }
  }
  drawLandmarksOnMap(g, o);
  World.mapCanvas = c; World.mapMin = o;
}
