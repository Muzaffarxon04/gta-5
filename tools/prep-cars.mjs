// Ko'cha Qiroli — Sketchfab'dan olingan og'ir mashina GLB'larini o'yin uchun yengil modelga aylantiradi.
// Natija: models/<nom>.js (base64 GLB). Qismlar vazifasi bo'yicha birlashtiriladi:
//   paint (bo'yoq, har mashinada boshqa rang), glass (oyna), lens (fara oynasi), red (stop-chiroq),
//   chrome (yaltiroq metall), dark (qolgan hammasi, rangi uchlarda).
// Ishlatish (bir marta: cd tools && npm install): node tools/prep-cars.mjs [nom ...]
// Asl GLB fayllar models/ papkasida turadi (git'ga kirmaydi, .gitignore).
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { quantize, reorder } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MODELS = join(ROOT, 'models');

const has = (s, ...parts) => parts.some(p => s.includes(p));
const CARS = {
  cobalt: {
    title: 'Chevrolet Cobalt', src: 'chevrolet_cobalt_ltz.glb', length: 4.48, front: '-z', seat: [0.38, 0.6, 0],
    // GTA uslubidagi mod: tugun nomi "<qism>_<material>_0". G'ildiraklar 4 nusxadan — bittasini olamiz.
    skip: n => /^roda(\.0(0[13567]|09|1[01345]))?_/.test(n) && !/^roda\.0(02|04|08|12)_/.test(n) || has(n, 'ColMesh', 'bancos_right'),
    role(n, m) {
      if (has(n, '_primary_')) return 'paint';
      if (/^(door_.*|windscreen_ok)_glass_0$/.test(n)) return 'glass';
      if (has(n, 'lanterna_glass', 'ascende_', 'luzdefreio')) return 'red';
      if (has(n, 'fara_left', 'fara_right', 'bump_front_ok.003_left', 'bump_front_ok.003_right')) return 'lens';
      if (m === 'escape.008' || m === 'roda.026') return 'chrome';
      if (has(n, 'painel', 'bancos', 'pedais', 'steering', 'interior')) return 'dark:in';
      if (/^roda/.test(n)) return 'dark:wheel';
      return 'dark';
    },
  },
  gentra: {
    title: 'Chevrolet Gentra', src: 'gentra.glb', length: 4.52, front: '-z', seat: [0.38, 0.58, -0.05],
    skip: (n, m) => has(n, 'amartizator') || m === 'chassis.9' || m === 'chassis.11',
    role(n, m) {
      if (m === 'primary') return 'paint';
      if (m === 'chassis.0' || m === 'glass.004') return 'glass';
      if (/^glass\.00[123]$/.test(m) || m === 'Faralar_on.0') return 'lens';
      if (/^(glass|right_rear_light|arxa_stop\.0|povo\.2)$/.test(m)) return 'red';
      if (/^unnamed\.(1|00[357])$/.test(m) || m === 'door_lf_ok.6' || m === 'chassis.4' || m === 'right_front_light') return 'chrome';
      if (/^unnamed/.test(m)) return 'dark:wheel';
      if (has(n, 'salon') || m === 'chassis.6' || m === 'chassis.7' || m === 'chassis.2' || m === 'chassis.3' || m === 'chassis.12' || m === 'salon.4') return 'dark:in';
      return 'dark';
    },
    color: { 'chassis.6': 0x3a3a3c, 'chassis.7': 0x4a4a4c, 'chassis.8': 0x222224, 'chassis.2': 0x303032, 'chassis.3': 0x303032, 'chassis.12': 0x303032, 'salon.4': 0x2a2a2c, 'povorotnikler.0': 0xe08a20, 'povorotnikler.1': 0xe08a20, 'chassis.4': 0x8a8d90, right_front_light: 0xb0b4b8 },
  },
  nexia: {
    title: 'Daewoo Nexia', src: 'nexia_2.glb', length: 4.48, front: '+z', seat: [0.37, 0.58, -0.1],
    roleAt: (n, m, c) => m === 'clearglass' && c[2] < 0 ? 'glass' : null,
    color: { interior: 0x56585b },
    role(n, m) {
      if (m === 'carpaint') return 'paint';
      if (m === 'windowglass') return 'glass';
      if (m === 'clearglass') return 'lens';
      if (m === 'redglass') return 'red';
      if (m === 'chrome' || m === 'material' || m === 'mirror') return 'chrome';
      if (m === 'tire' || m === 'brakedisk' || m === 'mattemetal') return 'dark:wheel';
      if (m === 'interior') return 'dark:in';
      return 'dark';
    },
  },
  spark: {
    title: 'Chevrolet Spark', src: 'spark.glb', length: 3.64, front: '+z', seat: [0.36, 0.64, -0.1],
    // Orqa chiroq oynasi to'q; panjara orqasidagi kuzov qora (soddalashgan panjara teshiklaridan bo'yoq ko'rinmasin)
    roleAt: (n, m, c) => m === 'clearglass' && c[2] < 0 ? 'glass'
      : n === 'body_carpaint_0' && c[2] > 1.49 && Math.abs(c[0]) < 0.42 && c[1] > 0.46 && c[1] < 0.79 ? ['dark:grille', 0x18191b]
      : null,
    skip: n => n === 'grill_black_0',
    color: { chrome: 0x3c3e42, interior: 0x56585b },
    role(n, m) {
      if (m === 'carpaint') return 'paint';
      if (m === 'greenglass' || m === 'darkglass') return 'glass';
      if (m === 'clearglass') return 'lens';
      if (m === 'redglass') return 'red';
      if (m === 'chrome' || m === 'glossymetal' || m === 'material') return 'chrome';
      if (m === 'tire' || m === 'brakedisk') return 'dark:wheel';
      if (m === 'interior') return 'dark:in';
      return 'dark';
    },
  },
  lacetti: {
    title: 'Chevrolet Lacetti', src: 'lacetti.glb', length: 4.52, front: '+z', seat: [0.38, 0.54, -0.05],
    skip: (n, m) => m === 'Aerials' || n.startsWith('obj85_'),
    role(n, m) {
      if (m === 'Material.006') return 'paint';
      if (m === 'Material4') return 'glass';
      if (m === 'Material14') return 'lens';
      if (m === 'Material8') return 'red';
      if (m === 'chrome' || m === 'Material5') return 'chrome';
      if (m === 'Tread' || m === 'Sidewall' || m === 'Suspension' || m === 'Material7') return 'dark:wheel';
      return 'dark';
    },
  },
  malibu: {
    title: 'Chevrolet Malibu 2016', src: '2016_chevrolet_malibu_2.0_t_premier.glb', length: 4.92, front: '+z', seat: [0.4, 0.58, -0.2],
    roleAt: (n, m, c) => m === 'glass' && c[1] < 0.95 && Math.abs(c[2]) > 1.8 ? (c[2] > 0 ? 'lens' : 'red') : null,
    role(n, m) {
      if (m === 'int_mat') return 'paint';
      if (m === 'glass') return 'glass';
      if (m === 'class_col') return 'red';
      if (m === 'chrome_1' || m === 'badges' || m === 'lights' || m === 'phong10' || m === 'car_chevrolet_malibu_2016_Meshrim') return 'chrome';
      if (/Mesh(DOSK|calip)$/.test(m) || m === 'phong4') return 'dark:wheel';
      if (m === 'phong8') return 'dark:in';
      return 'dark';
    },
  },
  damas: {
    title: 'Chevrolet Damas', src: 'chevrolet_damas (1).glb', length: 3.23, front: '-x', seat: [0.32, 0.72, 0.55],
    skip: (n, m) => m === 'material_11',
    color: { material_9: 0xe08a20 },
    role(n, m) {
      if (m === 'material_3') return 'paint';
      if (m === 'material_5') return 'glass';
      if (m === 'material_13') return 'lens';
      if (m === 'material_2' || m === 'material_12') return 'red';
      if (m === 'material_8' || m === 'material') return 'chrome';
      if (m === '.001' || m === 'material_15') return 'dark:wheel';
      if (m === 'material_4' || m === 'material_6') return 'dark:in';
      return 'dark';
    },
  },
  bus: {
    title: 'SamAuto Isuzu HC40 avtobusi', src: 'samauto_avtobus_uz_otayol_isuzu_saz_hc_40.glb', length: 7.6, front: '-z', seat: [0.78, 1.4, 2.45], steerAxis: [0, 0.82, -0.57],
    skip: (n, m) => /^most_podveska/.test(m),
    color: { 'tutacaqlar_copy.0': 0xd8b030 },
    budget: { paint: 6000, 'dark:in': 4500, dark: 3500 },
    role(n, m) {
      if (m === 'primary') return 'paint';
      if (m === 'glass.001') return 'glass';
      if (m === 'glass' || m === 'Dumanni.1') return 'lens';
      if (m === 'stop.0' || m === 'right_rear_light') return 'red';
      if (/_front_light/.test(m) || m === 'metal_white' || m === 'doors.2' || m === 'guzgu.1' || m === 'guzguler.1' || m === 'tutacaqlar_copy.0') return 'chrome';
      if (/^wheel_rb/.test(m)) return 'dark:wheel';
      if (/^(ayaq_alti|oturacaqlar|torpedo_copy|perde|sdenik|rul_alti|tutacaqlar_copy\.1|Material\.002|chassis\.2|guzguler\.2)/.test(m)) return 'dark:in';
      return 'dark';
    },
  },
  moto: {
    title: 'BMW S1000RR mototsikli', src: 'bmw_motosikl.glb', length: 2.07, front: '-z',
    budget: { paint: 2500, dark: 5000, 'dark:wheel': 2500, chrome: 1200 },
    role(n, m) {
      if (m === 'vehicle_generic_smallspecmap_PRIMARY') return 'paint';
      if (m === 'glass_500px') return 'glass';
      if (m === 'headlight_glass_25') return 'lens';
      if (m === 'bmw_m1krr_exhaust') return 'chrome';
      if (m === 'vehicle_generic_smallspecmap_WHEEL' || m === 'bmw_m1krr_tyres' || m === 'bmw_m1krr_brakes') return 'dark:wheel';
      return 'dark';
    },
  },
  // Amir Temur xiyoboni: butun skanerlangan maydon (zinali doira, poydevor, otliq haykal) — teksturasi bilan
  timur: {
    title: 'Amir Temur haykali (skan)', src: 'tashkent_timur_statue._uzbekistan.glb', statue: true, tris: 34000,
  },
};

// seat — taxminiy o'rindiq (faqat rulni qidirish uchun; o'yindagi o'rindiq js/cars.js da)

// Har bir guruh uchun uchburchaklar soni (taxminan) va ruxsat etilgan xato — ko'chada 20+ mashina bo'ladi
const LODS = [
  { name: 'lod0', budget: { paint: 7000, glass: 300, lens: 500, red: 500, chrome: 2200, dark: 3000, 'dark:wheel': 2400, 'dark:in': 3500, 'dark:grille': 500, steer: 700 },
    err: { paint: 0.004, glass: 0.004, lens: 0.006, red: 0.006, chrome: 0.01, dark: 0.012, 'dark:wheel': 0.02, 'dark:in': 0.02, default: 0.01 } },
  { name: 'lod1', budget: { paint: 1800, glass: 80, lens: 60, red: 60, chrome: 300, dark: 450, 'dark:wheel': 500, 'dark:in': 150, 'dark:grille': 60, steer: 40 },
    err: { paint: 0.02, glass: 0.02, chrome: 0.03, default: 0.08 } },
];
const CREASE = Math.cos(48 * Math.PI / 180);

const lin2srgb = c => c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
const hex2rgb = h => [(h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255];

async function decodeTextures(doc) {
  const out = new Map();
  for (const t of doc.getRoot().listTextures()) {
    const { data, info } = await sharp(Buffer.from(t.getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    out.set(t, { data, w: info.width, h: info.height });
  }
  return out;
}
function sampleTex(T, u, v) {
  u -= Math.floor(u); v -= Math.floor(v);
  const x = Math.min(T.w - 1, Math.floor(u * T.w)), y = Math.min(T.h - 1, Math.floor(v * T.h)), i = (y * T.w + x) * 4;
  return [T.data[i] / 255, T.data[i + 1] / 255, T.data[i + 2] / 255];
}

// 4×4 matritsalar (glTF tartibida, ustun bo'yicha)
const mul4 = (A, B) => { const o = new Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = A[r] * B[c * 4] + A[4 + r] * B[c * 4 + 1] + A[8 + r] * B[c * 4 + 2] + A[12 + r] * B[c * 4 + 3]; return o; };
const xform = (M, v, w = 1) => [0, 1, 2].map(k => M[k] * v[0] + M[4 + k] * v[1] + M[8 + k] * v[2] + M[12 + k] * w);

async function prep(id) {
  const C = CARS[id];
  if (C.statue) return prepStatue(id);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(join(MODELS, C.src));
  const tex = await decodeTextures(doc);
  const recs = [], seen = new Set();
  let srcTris = 0;
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const n = node.getName(), M = node.getWorldMatrix(), skin = node.getSkin();
    // Skinli (suyakli) to'r: uchlar bo'g'inlar orqali joylashadi (tinch holat)
    const JM = skin && skin.listJoints().map((j, k) => mul4(j.getWorldMatrix(), skin.getInverseBindMatrices() ? skin.getInverseBindMatrices().getElement(k, new Array(16)) : [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]));
    for (const p of mesh.listPrimitives()) {
      const mat = p.getMaterial(), m = mat ? mat.getName() : '';
      const P = p.getAttribute('POSITION'), I = p.getIndices(), cnt = I ? I.getCount() : P.getCount();
      if (p.getMode() !== 4) continue; // faqat uchburchaklar (chiziqlar emas)
      srcTris += cnt / 3;
      if (C.skip && C.skip(n, m)) continue;
      const g = C.role(n, m);
      if (!g) continue;
      const J = JM && p.getAttribute('JOINTS_0'), WT = JM && p.getAttribute('WEIGHTS_0');
      const toWorld = (i, A, wv) => {
        const src = A.getElement(i, [0, 0, 0]);
        if (!J) return xform(M, src, wv);
        const jj = J.getElement(i, [0, 0, 0, 0]), ww = WT.getElement(i, [0, 0, 0, 0]), out = [0, 0, 0];
        for (let k = 0; k < 4; k++) if (ww[k]) { const q = xform(JM[jj[k]], src, wv); for (let j = 0; j < 3; j++) out[j] += q[j] * ww[k]; }
        return out;
      };
      const W = [];
      for (let i = 0; i < P.getCount(); i++) W.push(...toWorld(i, P, 1));
      // Bir xil joyda turgan nusxa qismlarni tashlab yuboramiz
      const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
      for (let i = 0; i < W.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], W[i + k]); mx[k] = Math.max(mx[k], W[i + k]); }
      const key = cnt + '|' + mn.concat(mx).map(x => x.toFixed(4)).join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      // Rang: material rangi (chiziqli → sRGB), teksturali bo'lsa — uchburchak bo'yicha o'rtacha
      const f = mat ? mat.getBaseColorFactor() : [1, 1, 1, 1];
      // Juda qora ranglar o'yinda "teshik"dek ko'rinadi — biroz yoritamiz
      const base = C.color && C.color[m] != null ? hex2rgb(C.color[m]) : [lin2srgb(f[0]), lin2srgb(f[1]), lin2srgb(f[2])].map(x => Math.max(x, 0.07));
      const T = mat && mat.getBaseColorTexture() && !(C.color && C.color[m] != null) ? tex.get(mat.getBaseColorTexture()) : null;
      const UV = T ? p.getAttribute('TEXCOORD_0') : null, NO = p.getAttribute('NORMAL');
      const pos = [], col = [];
      for (let t = 0; t < cnt; t += 3) {
        const ids = [0, 1, 2].map(k => I ? I.getScalar(t + k) : t + k);
        // Manbadagi materiallar ikki tomonlama, ba'zi uchburchaklar ichkariga qaragan —
        // uch normallari bo'yicha tashqi tomonga buramiz
        if (NO) {
          const [a, b, c] = ids.map(i => i * 3), nn = [0, 0, 0];
          for (const i of ids) { const q = toWorld(i, NO, 0); for (let k = 0; k < 3; k++) nn[k] += q[k]; }
          const ux = W[b] - W[a], uy = W[b + 1] - W[a + 1], uz = W[b + 2] - W[a + 2], vx = W[c] - W[a], vy = W[c + 1] - W[a + 1], vz = W[c + 2] - W[a + 2];
          if ((uy * vz - uz * vy) * nn[0] + (uz * vx - ux * vz) * nn[1] + (ux * vy - uy * vx) * nn[2] < 0) ids.reverse();
        }
        let cc = base;
        if (UV) {
          const s = [0, 0, 0], us = ids.map(i => UV.getElement(i, [0, 0]));
          const pts = [...us, [(us[0][0] + us[1][0] + us[2][0]) / 3, (us[0][1] + us[1][1] + us[2][1]) / 3]];
          for (const q of pts) { const c = sampleTex(T, q[0], q[1]); s[0] += c[0]; s[1] += c[1]; s[2] += c[2]; }
          cc = s.map((x, k) => x / pts.length * base[k]);
        }
        for (const i of ids) { pos.push(W[i * 3], W[i * 3 + 1], W[i * 3 + 2]); col.push(cc[0], cc[1], cc[2]); }
      }
      recs.push({ n, m, g, pos, col, tex: !!UV });
    }
  }

  // Yo'nalish va o'lcham: old tomon +z, uzunlik — haqiqiy, g'ildirak tagi y=0, markaz x=z=0
  const rot = { '+z': (x, z) => [x, z], '-z': (x, z) => [-x, -z], '+x': (x, z) => [-z, x], '-x': (x, z) => [z, -x] }[C.front];
  for (const R of recs) for (let i = 0; i < R.pos.length; i += 3) { const [x, z] = rot(R.pos[i], R.pos[i + 2]); R.pos[i] = x; R.pos[i + 2] = z; }
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (const R of recs) for (let i = 0; i < R.pos.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], R.pos[i + k]); mx[k] = Math.max(mx[k], R.pos[i + k]); }
  const s = C.length / (mx[2] - mn[2]), off = [(mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2];
  for (const R of recs) for (let i = 0; i < R.pos.length; i += 3) for (let k = 0; k < 3; k++) R.pos[i + k] = (R.pos[i + k] - off[k]) * s;

  // Rul: haydovchi oldidagi qutiga to'liq sig'adigan bog'langan bo'laklar (gardish, o'rtasi, ustun boshi)
  const sbox = C.steerBox || (C.seat && [C.seat[0] - 0.28, C.seat[1] - 0.1, C.seat[2] + 0.15, C.seat[0] + 0.28, C.seat[1] + 0.7, C.seat[2] + 0.95]);
  if (sbox) for (const R of recs) if (R.g.startsWith("dark")) R.steer = steerParts(R.pos, sbox);

  // Guruhlarga ajratish. Ba'zi uchburchaklar joyiga qarab boshqa guruhga o'tadi (roleAt — o'lchangan
  // koordinatalarda: metr, old tomon +z), rul esa alohida "steer" guruhiga (kabinadan ko'rinish uchun aylanadi)
  const groups = {};
  for (const R of recs) {
    for (let t = 0; t < R.pos.length; t += 9) {
      const c3 = [0, 1, 2].map(k => (R.pos[t + k] + R.pos[t + 3 + k] + R.pos[t + 6 + k]) / 3);
      let gg = R.g, col = null;
      const ov = C.roleAt && C.roleAt(R.n, R.m, c3);
      if (ov) { gg = Array.isArray(ov) ? ov[0] : ov; if (Array.isArray(ov)) col = hex2rgb(ov[1]); }
      if (R.steer && R.steer[t / 9]) gg = 'steer';
      const G = groups[gg] || (groups[gg] = { pos: [], col: [] });
      if (R.tex) G.tex = true;
      for (let k = 0; k < 9; k++) { G.pos.push(R.pos[t + k]); G.col.push(col ? col[k % 3] : R.col[t + k]); }
    }
  }

  // Rul doirasi; undan ancha chetdagi bo'laklar (dastaklar, tugmalar) rul emas — salonga qaytadi
  let frame = null;
  if (groups.steer) {
    frame = steerFrame(groups.steer.pos, C.steerAxis, C.steerFit).steer;
    const G = groups.steer, keep = { pos: [], col: [] }, back = groups['dark:in'] || (groups['dark:in'] = { pos: [], col: [] });
    const n = frame.a, c = frame.c;
    for (let t = 0; t < G.pos.length; t += 9) {
      let far = false;
      for (let k = 0; k < 9; k += 3) {
        const d = [G.pos[t + k] - c[0], G.pos[t + k + 1] - c[1], G.pos[t + k + 2] - c[2]], h = d[0] * n[0] + d[1] * n[1] + d[2] * n[2];
        if (Math.hypot(d[0] - h * n[0], d[1] - h * n[1], d[2] - h * n[2]) > frame.r * 1.25 || Math.abs(h) > frame.r * 0.9) far = true;
      }
      const T = far ? back : keep;
      for (let k = 0; k < 9; k++) { T.pos.push(G.pos[t + k]); T.col.push(G.col[t + k]); }
    }
    groups.steer = keep;
    // Qo'llar uchun — gardishning tashqi radiusi
    const rd = [];
    for (let i = 0; i < keep.pos.length; i += 3) { const d = [keep.pos[i] - c[0], keep.pos[i + 1] - c[1], keep.pos[i + 2] - c[2]], h = d[0] * n[0] + d[1] * n[1] + d[2] * n[2]; rd.push(Math.hypot(d[0] - h * n[0], d[1] - h * n[1], d[2] - h * n[2])); }
    rd.sort((a, b) => a - b);
    if (rd.length) frame.r = +rd[Math.floor(rd.length * 0.95)].toFixed(3);
    frame.info = `${JSON.stringify({ c: frame.c, a: frame.a, r: frame.r })} (${keep.pos.length / 9} uchb.)`;
  }

  // Ikki daraja (LOD): yaqin uchun to'liq, uzoq uchun juda yengil — o'yin masofaga qarab almashtiradi
  await MeshoptSimplifier.ready;
  const welded = Object.entries(groups).map(([g, G]) => ({ g, ...weld(G.pos, G.col, G.tex) }));
  const D = new Document(), buf = D.createBuffer(), scene = D.createScene(), stats = {}, tris = [];
  if (frame) { stats.rul = frame.info; delete frame.info; }
  const box = { mn: [1e9, 1e9, 1e9], mx: [-1e9, -1e9, -1e9] };
  for (const L of LODS) {
    const parts = [];
    for (const { g, pos, col, idx } of welded) {
      const bud = L === LODS[0] && C.budget && C.budget[g] || L.budget[g] || 1500, target = Math.min(idx.length, bud * 3);
      // Mayda bo'laklardan iborat qismlar (shina protektori, panjara) oddiy usulda kamaymaydi, Prune esa ularni butunlay o'chiradi
      const bits = g === 'dark:wheel' || g === 'dark:grille';
      let [out, err] = MeshoptSimplifier.simplify(idx, pos, 3, target, L.err[g] || L.err.default, bits ? [] : ['Prune']);
      if (bits && out.length > target * 1.3) {
        const sl = MeshoptSimplifier.simplifySloppy(idx, pos, 3, null, Math.round(target * 1.6 / 3) * 3, g === 'dark:grille' ? 1 : L === LODS[0] ? 0.02 : 0.05);
        if (sl[0].length > target * 0.3) [out, err] = sl;
      }
      stats[`${L.name} ${g}`] = `${idx.length / 3}→${out.length / 3} (xato ${err.toFixed(4)})`;
      if (out.length) parts.push({ g, out, pos, col });
    }
    stats[`${L.name} yo'nalish`] = `${orientOutward(parts)} ta uchburchak tashqariga burildi`;
    const roles = {};
    for (const { g, out, pos, col } of parts) {
      // Rul faqat yaqin nusxada alohida (aylanadi), uzoqda — qolgan qora qismlar bilan birga
      const role = g === 'steer' ? (L === LODS[0] ? 'steer' : 'dark') : g.split(':')[0], R = roles[role] || (roles[role] = []);
      R.push(...creasedTris(out, pos, col));
    }
    const level = D.createNode(L.name);
    scene.addChild(level);
    let n = 0;
    for (const role of ['paint', 'dark', 'chrome', 'red', 'lens', 'glass', 'steer']) {
      const corners = roles[role];
      if (!corners || !corners.length) continue;
      const { pos, nor, col, idx } = indexCorners(corners);
      n += idx.length / 3;
      if (L === LODS[0]) for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) { box.mn[k] = Math.min(box.mn[k], pos[i + k]); box.mx[k] = Math.max(box.mx[k], pos[i + k]); }
      const prim = D.createPrimitive()
        .setAttribute('POSITION', D.createAccessor().setType('VEC3').setArray(pos).setBuffer(buf))
        .setAttribute('NORMAL', D.createAccessor().setType('VEC3').setArray(nor).setBuffer(buf))
        .setIndices(D.createAccessor().setType('SCALAR').setArray(pos.length / 3 > 65535 ? idx : new Uint16Array(idx)).setBuffer(buf))
        .setMaterial(D.createMaterial(role).setRoughnessFactor(0.7).setMetallicFactor(0));
      if (role === 'dark' || role === 'chrome' || role === 'steer') prim.setAttribute('COLOR_0', D.createAccessor().setType('VEC3').setArray(col).setBuffer(buf));
      // Nomlar takrorlanmasin (yuklovchi takrorga "_1" qo'shadi): uzoq nusxada "paint_far" va h.k.
      const name = L === LODS[0] ? role : role + '_far';
      const node = D.createNode(name).setMesh(D.createMesh(name).addPrimitive(prim));
      if (role === 'steer') node.setExtras({ steer: frame });
      level.addChild(node);
    }
    tris.push(n);
  }
  // Siqish: kvantlash + meshopt (o'yinda lib/meshopt_decoder.js ochadi)
  await MeshoptEncoder.ready;
  await D.transform(quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeColor: 8 }), reorder({ encoder: MeshoptEncoder }));
  D.createExtension(EXTMeshoptCompression).setRequired(true);
  const glb = await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder }).writeBinary(D);
  const b64 = Buffer.from(glb).toString('base64');
  writeFileSync(join(MODELS, id + '.js'), `// ${C.title} — o'yin uchun tayyorlangan GLB (base64). Manba: models/${C.src}, tools/prep-cars.mjs\n(window.MODEL_DATA = window.MODEL_DATA || {}).${id} = '${b64}';\n`);
  const size = box.mx.map((x, k) => (x - box.mn[k]).toFixed(2));
  console.log(`${id}: ${Math.round(srcTris)} → ${tris.join(' / ')} uchburchak, ${(glb.byteLength / 1024).toFixed(0)} KB (base64 ${(b64.length / 1024).toFixed(0)} KB), o'lcham ${size.join(' × ')} m`);
  for (const [g, t] of Object.entries(stats)) console.log('   ', g.padEnd(16), t);
  return glb;
}

// Bir xil joy va rangdagi uchlarni birlashtirish (soddalashtirish uchun indeksli to'r kerak).
// Teksturadan olingan ranglar har uchburchakda boshqacha — u holda faqat joy bo'yicha, rang o'rtachasi bilan.
function weld(P, Cc, byPos) {
  const map = new Map(), pos = [], col = [], cnt = [], idx = new Uint32Array(P.length / 3);
  for (let i = 0; i < P.length / 3; i++) {
    let key = Math.round(P[i * 3] * 1e4) + ',' + Math.round(P[i * 3 + 1] * 1e4) + ',' + Math.round(P[i * 3 + 2] * 1e4);
    if (!byPos) key += ',' + Math.round(Cc[i * 3] * 255) + ',' + Math.round(Cc[i * 3 + 1] * 255) + ',' + Math.round(Cc[i * 3 + 2] * 255);
    let k = map.get(key);
    if (k === undefined) { k = pos.length / 3; map.set(key, k); pos.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); col.push(0, 0, 0); cnt.push(0); }
    for (let j = 0; j < 3; j++) col[k * 3 + j] += Cc[i * 3 + j];
    cnt[k]++;
    idx[i] = k;
  }
  for (let k = 0; k < cnt.length; k++) for (let j = 0; j < 3; j++) col[k * 3 + j] /= cnt[k];
  // Nol yuzali uchburchaklarni olib tashlash
  const keep = [];
  for (let t = 0; t < idx.length; t += 3) if (idx[t] !== idx[t + 1] && idx[t + 1] !== idx[t + 2] && idx[t] !== idx[t + 2]) keep.push(idx[t], idx[t + 1], idx[t + 2]);
  return { pos: new Float32Array(pos), col, idx: new Uint32Array(keep) };
}

// Qutiga to'liq sig'adigan bog'langan bo'laklarning uchburchaklarini belgilaydi
function steerParts(P, b) {
  const nt = P.length / 9, inBox = (x, y, z) => x >= b[0] && y >= b[1] && z >= b[2] && x <= b[3] && y <= b[4] && z <= b[5];
  let any = false;
  for (let t = 0; t < nt && !any; t++) any = inBox(P[t * 9], P[t * 9 + 1], P[t * 9 + 2]);
  if (!any) return null;
  const parent = new Int32Array(nt).map((_, i) => i), find = i => { while (parent[i] !== i) i = parent[i] = parent[parent[i]]; return i; };
  const owner = new Map();
  for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) {
    const q = t * 9 + k * 3, key = Math.round(P[q] * 1e4) + ',' + Math.round(P[q + 1] * 1e4) + ',' + Math.round(P[q + 2] * 1e4);
    const o = owner.get(key);
    if (o === undefined) owner.set(key, t); else parent[find(t)] = find(o);
  }
  const ok = new Map();
  for (let t = 0; t < nt; t++) {
    const r = find(t);
    if (ok.get(r) === false) continue;
    let inside = true;
    for (let k = 0; k < 3; k++) if (!inBox(P[t * 9 + k * 3], P[t * 9 + k * 3 + 1], P[t * 9 + k * 3 + 2])) inside = false;
    if (!inside) ok.set(r, false); else if (!ok.has(r)) ok.set(r, true);
  }
  const out = new Uint8Array(nt);
  let n = 0;
  for (let t = 0; t < nt; t++) if (ok.get(find(t))) { out[t] = 1; n++; }
  return n ? out : null;
}

// Rul markazi, o'qi (rul ustuni bo'ylab, haydovchiga qarab) va radiusi — o'yinda aylantirish va qo'llar uchun.
// Gardishni topamiz: o'qqa tik tekislikda aylana chizamiz (ichidagi kegay/ustun va tashqaridagi dastaklar chetda qoladi),
// so'ng gardish nuqtalari tekisligidan o'qni aniqlashtiramiz.
function steerFrame(P, axisHint, fitAxis) {
  const pts = [];
  for (let i = 0; i < P.length; i += 3) pts.push([P[i], P[i + 1], P[i + 2]]);
  const norm = v => { const l = Math.hypot(...v) || 1; return v.map(x => x / l); };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  let n = norm(axisHint || [0, 0.42, -0.91]);
  let c = [0, 1, 2].map(k => pts.reduce((a, p) => a + p[k], 0) / pts.length), r = 0, ring = pts;
  for (let it = 0; it < 4; it++) {
    const u = norm(cross(n, Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])), w = cross(n, u);
    const q = pts.map(p => { const d = [p[0] - c[0], p[1] - c[1], p[2] - c[2]]; return [dot(d, u), dot(d, w), dot(d, n)]; });
    // Aylana (Kasa usuli) — avval tashqi nuqtalar, keyin aylanaga yaqinlari bo'yicha
    const fit = list => {
      let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0, sz = 0;
      for (const [x, y] of list) { const z = x * x + y * y; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; sxz += x * z; syz += y * z; sz += z; }
      const N = list.length, A = [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, N]], B = [sxz, syz, sz];
      const det = M => M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
      const D = det(A), sol = [0, 1, 2].map(k => det(A.map((row, i) => row.map((x, j) => j === k ? B[i] : x))) / D);
      const cx = sol[0] / 2, cy = sol[1] / 2;
      return [cx, cy, Math.sqrt(Math.max(1e-6, sol[2] + cx * cx + cy * cy))];
    };
    const d0 = q.map(p => Math.hypot(p[0], p[1])), th = [...d0].sort((a, b) => a - b)[Math.floor(d0.length * 0.6)];
    let [cx, cy, rr] = fit(q.filter((p, i) => d0[i] >= th));
    for (let k = 0; k < 2; k++) { const near = q.filter(p => Math.abs(Math.hypot(p[0] - cx, p[1] - cy) - rr) < rr * 0.22); if (near.length > 10) [cx, cy, rr] = fit(near); }
    c = [0, 1, 2].map(k => c[k] + u[k] * cx + w[k] * cy);
    r = rr;
    ring = pts.filter((p, i) => Math.abs(Math.hypot(q[i][0] - cx, q[i][1] - cy) - rr) < rr * 0.2);
    if (!fitAxis || ring.length < 20) continue;
    // Gardish tekisligining normali — eng kichik tarqalish yo'nalishi
    const m = [0, 1, 2].map(k => ring.reduce((a, p) => a + p[k], 0) / ring.length), M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (const p of ring) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) M[a][b] += (p[a] - m[a]) * (p[b] - m[b]);
    const tr = M[0][0] + M[1][1] + M[2][2], S = M.map((row, a) => row.map((x, b) => (a === b ? tr : 0) - x));
    let v = n.slice();
    for (let k = 0; k < 80; k++) v = norm([0, 1, 2].map(r => S[r][0] * v[0] + S[r][1] * v[1] + S[r][2] * v[2]));
    n = dot(v, n) < 0 ? v.map(x => -x) : v;
  }
  if (n[2] > 0) n = n.map(x => -x); // haydovchiga (orqaga) qarasin
  const f3 = x => +x.toFixed(3);
  return { steer: { c: c.map(f3), a: n.map(f3), r: f3(r) } };
}

// Manba materiallari ikki tomonlama bo'lgani uchun ko'p uchburchaklar ichkariga qaragan.
// Har uchburchakdan ikki tomonga nurlar otamiz: qaysi tomoni tashqaridan ko'proq ko'rinsa — o'sha old tomon.
function orientOutward(parts) {
  const T = [];
  for (const P of parts) for (let t = 0; t < P.out.length; t += 3) T.push([P, t]);
  const n = T.length, V = new Float32Array(n * 9);
  T.forEach(([P, t], i) => { for (let k = 0; k < 3; k++) for (let j = 0; j < 3; j++) V[i * 9 + k * 3 + j] = P.pos[P.out[t + k] * 3 + j]; });
  // BVH
  const ids = Int32Array.from({ length: n }, (_, i) => i), cen = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) for (let j = 0; j < 3; j++) cen[i * 3 + j] = (V[i * 9 + j] + V[i * 9 + 3 + j] + V[i * 9 + 6 + j]) / 3;
  const nodes = [];
  const build = (lo, hi) => {
    const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (let i = lo; i < hi; i++) for (let k = 0; k < 3; k++) for (let j = 0; j < 3; j++) { const x = V[ids[i] * 9 + k * 3 + j]; if (x < mn[j]) mn[j] = x; if (x > mx[j]) mx[j] = x; }
    const node = { mn, mx, lo, hi, l: null, r: null };
    nodes.push(node);
    if (hi - lo > 6) {
      const ax = [0, 1, 2].reduce((a, b) => mx[b] - mn[b] > mx[a] - mn[a] ? b : a, 0);
      const sub = Array.from(ids.subarray(lo, hi)).sort((a, b) => cen[a * 3 + ax] - cen[b * 3 + ax]);
      ids.set(sub, lo);
      const mid = (lo + hi) >> 1;
      node.l = build(lo, mid); node.r = build(mid, hi);
    }
    return node;
  };
  const root = build(0, n);
  const hitBox = (b, o, inv) => {
    let t0 = 1e-6, t1 = 1e9;
    for (let j = 0; j < 3; j++) {
      let a = (b.mn[j] - o[j]) * inv[j], c = (b.mx[j] - o[j]) * inv[j];
      if (a > c) [a, c] = [c, a];
      if (a > t0) t0 = a; if (c < t1) t1 = c;
      if (t0 > t1) return false;
    }
    return true;
  };
  const hitTri = (i, o, d) => {
    const q = i * 9, e1 = [V[q + 3] - V[q], V[q + 4] - V[q + 1], V[q + 5] - V[q + 2]], e2 = [V[q + 6] - V[q], V[q + 7] - V[q + 1], V[q + 8] - V[q + 2]];
    const p = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]];
    const det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2];
    if (Math.abs(det) < 1e-12) return false;
    const inv = 1 / det, s = [o[0] - V[q], o[1] - V[q + 1], o[2] - V[q + 2]];
    const u = (s[0] * p[0] + s[1] * p[1] + s[2] * p[2]) * inv;
    if (u < 0 || u > 1) return false;
    const qv = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]];
    const v = (d[0] * qv[0] + d[1] * qv[1] + d[2] * qv[2]) * inv;
    if (v < 0 || u + v > 1) return false;
    return (e2[0] * qv[0] + e2[1] * qv[1] + e2[2] * qv[2]) * inv > 1e-5;
  };
  const occluded = (o, d, self) => {
    const inv = [1 / d[0], 1 / d[1], 1 / d[2]], stack = [root];
    while (stack.length) {
      const b = stack.pop();
      if (!hitBox(b, o, inv)) continue;
      if (b.l) { stack.push(b.l, b.r); continue; }
      for (let i = b.lo; i < b.hi; i++) if (ids[i] !== self && hitTri(ids[i], o, d)) return true;
    }
    return false;
  };
  // Sferadagi bir tekis yo'nalishlar
  const DIRS = [], K = 48;
  for (let i = 0; i < K; i++) { const y = 1 - 2 * (i + 0.5) / K, r = Math.sqrt(1 - y * y), a = i * 2.39996; DIRS.push([Math.cos(a) * r, y, Math.sin(a) * r]); }
  let flipped = 0;
  for (let i = 0; i < n; i++) {
    const q = i * 9;
    const e1 = [V[q + 3] - V[q], V[q + 4] - V[q + 1], V[q + 5] - V[q + 2]], e2 = [V[q + 6] - V[q], V[q + 7] - V[q + 1], V[q + 8] - V[q + 2]];
    const nn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], l = Math.hypot(...nn);
    if (!l) continue;
    const N = nn.map(x => x / l), c = [cen[i * 3], cen[i * 3 + 1], cen[i * 3 + 2]];
    let front = 0, back = 0;
    for (const d of DIRS) {
      const dn = d[0] * N[0] + d[1] * N[1] + d[2] * N[2];
      if (Math.abs(dn) < 0.15) continue;
      const sg = dn > 0 ? 1 : -1, o = [c[0] + N[0] * sg * 1e-4, c[1] + N[1] * sg * 1e-4, c[2] + N[2] * sg * 1e-4];
      if (!occluded(o, d, i)) { if (sg > 0) front++; else back++; }
    }
    if (back > front * 1.5 + 1) {
      const [P, t] = T[i], a = P.out[t + 1];
      P.out[t + 1] = P.out[t + 2]; P.out[t + 2] = a;
      flipped++;
    }
  }
  return flipped;
}

// Burchak bo'yicha normal: qirralar o'tkir qoladi, tekis sirtlar silliq
function creasedTris(idx, pos, col) {
  const nt = idx.length / 3, fn = new Float32Array(nt * 3), adj = new Map();
  for (let t = 0; t < nt; t++) {
    const a = idx[t * 3] * 3, b = idx[t * 3 + 1] * 3, c = idx[t * 3 + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    fn[t * 3] = uy * vz - uz * vy; fn[t * 3 + 1] = uz * vx - ux * vz; fn[t * 3 + 2] = ux * vy - uy * vx;
    for (let k = 0; k < 3; k++) {
      const p = idx[t * 3 + k] * 3, key = Math.round(pos[p] * 1e4) + ',' + Math.round(pos[p + 1] * 1e4) + ',' + Math.round(pos[p + 2] * 1e4);
      (adj.get(key) || adj.set(key, []).get(key)).push(t);
    }
  }
  const unit = t => { const l = Math.hypot(fn[t * 3], fn[t * 3 + 1], fn[t * 3 + 2]) || 1; return [fn[t * 3] / l, fn[t * 3 + 1] / l, fn[t * 3 + 2] / l]; };
  const out = [];
  for (let t = 0; t < nt; t++) {
    const n0 = unit(t);
    for (let k = 0; k < 3; k++) {
      const i = idx[t * 3 + k], p = i * 3, key = Math.round(pos[p] * 1e4) + ',' + Math.round(pos[p + 1] * 1e4) + ',' + Math.round(pos[p + 2] * 1e4);
      let nx = 0, ny = 0, nz = 0;
      for (const u of adj.get(key)) {
        const n1 = unit(u);
        if (n0[0] * n1[0] + n0[1] * n1[1] + n0[2] * n1[2] >= CREASE) { nx += fn[u * 3]; ny += fn[u * 3 + 1]; nz += fn[u * 3 + 2]; }
      }
      const l = Math.hypot(nx, ny, nz) || 1;
      out.push([pos[p], pos[p + 1], pos[p + 2], nx / l, ny / l, nz / l, col[p], col[p + 1], col[p + 2]]);
    }
  }
  return out;
}
function indexCorners(corners) {
  const map = new Map(), pos = [], nor = [], col = [], idx = [];
  for (const c of corners) {
    const key = c.map((x, k) => Math.round(x * (k < 3 ? 1e4 : k < 6 ? 100 : 255))).join(',');
    let i = map.get(key);
    if (i === undefined) { i = pos.length / 3; map.set(key, i); pos.push(c[0], c[1], c[2]); nor.push(c[3], c[4], c[5]); col.push(c[6], c[7], c[8]); }
    idx.push(i);
  }
  return { pos: new Float32Array(pos), nor: new Float32Array(nor), col: new Float32Array(col), idx: new Uint32Array(idx) };
}

// ===== Skanerlangan haykal: tekstura saqlanadi, UV bilan soddalashtiriladi =====
async function prepStatue(id) {
  const C = CARS[id];
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(join(MODELS, C.src));
  const P = [], UVs = [];
  let tex = null, srcTris = 0;
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const M = node.getWorldMatrix();
    for (const p of mesh.listPrimitives()) {
      const mat = p.getMaterial();
      if (mat && mat.getBaseColorTexture()) tex = mat.getBaseColorTexture();
      const A = p.getAttribute('POSITION'), T = p.getAttribute('TEXCOORD_0'), I = p.getIndices(), cnt = I ? I.getCount() : A.getCount();
      srcTris += cnt / 3;
      for (let k = 0; k < cnt; k++) { const i = I ? I.getScalar(k) : k; P.push(...xform(M, A.getElement(i, [0, 0, 0]))); UVs.push(...T.getElement(i, [0, 0])); }
    }
  }
  // Markaz: doiraning o'rtasi (x, z), pastki cheti y=0
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], P[i + k]); mx[k] = Math.max(mx[k], P[i + k]); }
  const off = [(mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2];
  for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) P[i + k] -= off[k];
  const R = Math.max(mx[0] - mn[0], mx[2] - mn[2]) / 2;

  // Poydevor izi: markaz yaqinidagi, maydon sathidan 0.6–2.4 m balanddagi nuqtalar
  const ys = [];
  for (let i = 0; i < P.length; i += 3) if (Math.hypot(P[i], P[i + 2]) < R * 0.5) ys.push(P[i + 1]);
  ys.sort((a, b) => a - b);
  const deck = ys[Math.floor(ys.length * 0.3)];
  const pb = [1e9, 1e9, -1e9, -1e9];
  let ptop = 0;
  for (let i = 0; i < P.length; i += 3) {
    const x = P[i], y = P[i + 1], z = P[i + 2];
    if (Math.hypot(x, z) < 6 && y > deck + 0.6 && y < deck + 2.4) { pb[0] = Math.min(pb[0], x); pb[1] = Math.min(pb[1], z); pb[2] = Math.max(pb[2], x); pb[3] = Math.max(pb[3], z); }
    if (Math.hypot(x, z) < 6) ptop = Math.max(ptop, y);
  }
  // Maydon balandligi radius bo'yicha (zinalar): poydevordan tashqaridagi nuqtalarning pastki qismi
  const STEP = 0.25, bins = Array.from({ length: Math.ceil(R / STEP) + 1 }, () => []);
  for (let i = 0; i < P.length; i += 3) {
    const x = P[i], z = P[i + 2];
    if (x > pb[0] - 0.4 && x < pb[2] + 0.4 && z > pb[1] - 0.4 && z < pb[3] + 0.4) continue;
    bins[Math.floor(Math.hypot(x, z) / STEP)].push(P[i + 1]);
  }
  const prof = bins.map(b => { if (!b.length) return null; b.sort((a, c) => a - c); return +b[Math.floor(b.length * 0.4)].toFixed(2); });
  for (let i = 0; i < prof.length; i++) if (prof[i] == null) prof[i] = i ? prof[i - 1] : deck;
  prof[prof.length - 1] = 0;

  // Payvandlash (joy + UV) va soddalashtirish
  const map = new Map(), pos = [], uv = [], idx = [];
  for (let i = 0; i < P.length / 3; i++) {
    const key = Math.round(P[i * 3] * 2000) + ',' + Math.round(P[i * 3 + 1] * 2000) + ',' + Math.round(P[i * 3 + 2] * 2000) + ',' + Math.round(UVs[i * 2] * 8192) + ',' + Math.round(UVs[i * 2 + 1] * 8192);
    let k = map.get(key);
    if (k === undefined) { k = pos.length / 3; map.set(key, k); pos.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); uv.push(UVs[i * 2], UVs[i * 2 + 1]); }
    idx.push(k);
  }
  await MeshoptSimplifier.ready;
  const fpos = new Float32Array(pos);
  const [out, err] = MeshoptSimplifier.simplify(new Uint32Array(idx), fpos, 3, C.tris * 3, 0.02, ['Prune']);
  // Ishlatilmagan uchlarni olib tashlash (compactMesh indekslarni joyida o'zgartiradi, eski→yangi jadvalini qaytaradi)
  const cidx = out.slice(), [remap, nv] = MeshoptSimplifier.compactMesh(cidx);
  const P2 = new Float32Array(nv * 3), U2 = new Float32Array(nv * 2);
  for (let i = 0; i < remap.length; i++) if (remap[i] < nv) { P2.set(fpos.subarray(i * 3, i * 3 + 3), remap[i] * 3); U2[remap[i] * 2] = uv[i * 2]; U2[remap[i] * 2 + 1] = uv[i * 2 + 1]; }
  // Silliq normallar
  const N2 = new Float32Array(nv * 3);
  for (let t = 0; t < cidx.length; t += 3) {
    const a = cidx[t] * 3, b = cidx[t + 1] * 3, c = cidx[t + 2] * 3;
    const ux = P2[b] - P2[a], uy = P2[b + 1] - P2[a + 1], uz = P2[b + 2] - P2[a + 2], vx = P2[c] - P2[a], vy = P2[c + 1] - P2[a + 1], vz = P2[c + 2] - P2[a + 2];
    const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    for (const q of [a, b, c]) for (let k = 0; k < 3; k++) N2[q + k] += n[k];
  }
  for (let i = 0; i < nv; i++) { const l = Math.hypot(N2[i * 3], N2[i * 3 + 1], N2[i * 3 + 2]) || 1; for (let k = 0; k < 3; k++) N2[i * 3 + k] /= l; }

  // Tekstura: 1024px JPEG
  const img = await sharp(Buffer.from(tex.getImage())).resize(1024, 1024, { fit: 'inside' }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  const D = new Document(), buf = D.createBuffer(), scene = D.createScene();
  const texture = D.createTexture('timur').setImage(img).setMimeType('image/jpeg');
  const prim = D.createPrimitive()
    .setAttribute('POSITION', D.createAccessor().setType('VEC3').setArray(P2).setBuffer(buf))
    .setAttribute('NORMAL', D.createAccessor().setType('VEC3').setArray(N2).setBuffer(buf))
    .setAttribute('TEXCOORD_0', D.createAccessor().setType('VEC2').setArray(U2).setBuffer(buf))
    .setIndices(D.createAccessor().setType('SCALAR').setArray(nv > 65535 ? cidx : new Uint16Array(cidx)).setBuffer(buf))
    .setMaterial(D.createMaterial('timur').setBaseColorTexture(texture).setRoughnessFactor(1).setMetallicFactor(0));
  const f2 = x => +x.toFixed(2);
  scene.addChild(D.createNode('timur').setMesh(D.createMesh('timur').addPrimitive(prim))
    .setExtras({ zone: { r: f2(R), step: STEP, prof }, pedestal: [...pb.map(f2), f2(ptop)] }));
  await MeshoptEncoder.ready;
  await D.transform(quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }), reorder({ encoder: MeshoptEncoder }));
  D.createExtension(EXTMeshoptCompression).setRequired(true);
  const glb = await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder }).writeBinary(D);
  const b64 = Buffer.from(glb).toString('base64');
  writeFileSync(join(MODELS, id + '.js'), `// ${C.title} — o'yin uchun tayyorlangan GLB (base64). Manba: models/${C.src}, tools/prep-cars.mjs\n(window.MODEL_DATA = window.MODEL_DATA || {}).${id} = '${b64}';\n`);
  console.log(`${id}: ${Math.round(srcTris)} → ${cidx.length / 3} uchburchak (xato ${err.toFixed(4)}), ${(glb.byteLength / 1024).toFixed(0)} KB (tekstura ${(img.length / 1024).toFixed(0)} KB), radius ${R.toFixed(1)} m, balandlik ${(mx[1] - mn[1]).toFixed(1)} m`);
  console.log('    poydevor', JSON.stringify(pb.map(f2)), 'tepasi', f2(ptop), 'maydon sathi', f2(deck));
  console.log('    profil', JSON.stringify(prof));
}

const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CARS);
for (const id of ids) await prep(id);
