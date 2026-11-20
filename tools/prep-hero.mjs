// Ko'cha Qiroli — Meshy + Mixamo personaj GLB'sini (skelet va animatsiyalar bilan) o'yin uchun tayyorlaydi → models/hero.js (base64).
// Nima qilinadi:
//  1. Mesh soddalashtiriladi (~12 ming uchburchak), tekstura 1024px JPEG (faqat rang xaritasi).
//  2. Skelet "tozalanadi": hamma suyakning dam holati burilishi 0 bo'ladi (faqat siljish). Shunda o'yindagi kod (mashinada o'tirish,
//     rul ushlash, qurol) odam skeleti kabi, oddiy burchaklar bilan boshqara oladi. Animatsiyalar shu skeletga qayta hisoblanadi:
//       yangi_burilish = Pr · q · Lr⁻¹ · Pr⁻¹   (Pr — ota-suyakning dam holati, Lr — suyakning ota-suyakka nisbatan dam holati)
//     Dam holati (A-poza) o'zgartirilmaydi: aralash og'irlikli joylar (yelka, tirsak) buzilmasin. Nishonga olish — IK (js/people.js heroAim).
//  3. Faqat Idle, Walking, Running animatsiyalari saqlanadi (Hips'ning joyidagi chayqalishi).
// Ishlatish (bir marta: cd tools && npm install): node tools/prep-hero.mjs [fayl.glb]
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// Asl GLB: argument, yoki models/ (git'ga kirmaydi) / loyiha ildizidagi Meshy_*animated*.glb
const SRC = process.argv[2] || ['models', '.'].map(d => (readdirSync(join(ROOT, d)).find(f => /^Meshy.*animated.*\.glb$/.test(f)) || '') && join(d, readdirSync(join(ROOT, d)).find(f => /^Meshy.*animated.*\.glb$/.test(f)))).find(Boolean);
const HEIGHT = 1.75, TRIS = 12000, KEEP = ['Idle', 'Walking', 'Running'];

// --- kichik matematika (matritsa ustun bo'yicha, kvaternion [x,y,z,w]) ---
const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qinv = q => [-q[0], -q[1], -q[2], q[3]];
const qnorm = q => { const l = Math.hypot(...q) || 1; return q.map(v => v / l); };
function inv4(m) {
  const a = m, o = new Array(16);
  const b00 = a[0] * a[5] - a[1] * a[4], b01 = a[0] * a[6] - a[2] * a[4], b02 = a[0] * a[7] - a[3] * a[4], b03 = a[1] * a[6] - a[2] * a[5], b04 = a[1] * a[7] - a[3] * a[5], b05 = a[2] * a[7] - a[3] * a[6];
  const b06 = a[8] * a[13] - a[9] * a[12], b07 = a[8] * a[14] - a[10] * a[12], b08 = a[8] * a[15] - a[11] * a[12], b09 = a[9] * a[14] - a[10] * a[13], b10 = a[9] * a[15] - a[11] * a[13], b11 = a[10] * a[15] - a[11] * a[14];
  const d = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);
  o[0] = (a[5] * b11 - a[6] * b10 + a[7] * b09) * d; o[1] = (a[2] * b10 - a[1] * b11 - a[3] * b09) * d; o[2] = (a[13] * b05 - a[14] * b04 + a[15] * b03) * d; o[3] = (a[10] * b04 - a[9] * b05 - a[11] * b03) * d;
  o[4] = (a[6] * b08 - a[4] * b11 - a[7] * b07) * d; o[5] = (a[0] * b11 - a[2] * b08 + a[3] * b07) * d; o[6] = (a[14] * b02 - a[12] * b05 - a[15] * b01) * d; o[7] = (a[8] * b05 - a[10] * b02 + a[11] * b01) * d;
  o[8] = (a[4] * b10 - a[5] * b08 + a[7] * b06) * d; o[9] = (a[1] * b08 - a[0] * b10 - a[3] * b06) * d; o[10] = (a[12] * b04 - a[13] * b02 + a[15] * b00) * d; o[11] = (a[9] * b02 - a[8] * b04 - a[11] * b00) * d;
  o[12] = (a[5] * b07 - a[4] * b09 - a[6] * b06) * d; o[13] = (a[0] * b09 - a[1] * b07 + a[2] * b06) * d; o[14] = (a[13] * b01 - a[12] * b03 - a[14] * b00) * d; o[15] = (a[8] * b03 - a[9] * b01 + a[10] * b00) * d;
  return o;
}
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm3 = a => { const l = Math.hypot(...a) || 1; return a.map(v => v / l); };
function mul4(a, b) { const o = new Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; }
const trans4 = t => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, t[0], t[1], t[2], 1];
function rot4(q) { const [x, y, z, w] = q; return [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0, 2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0, 2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0, 0, 0, 0, 1]; }
function qfromto(a, b) { // a → b (birlik vektorlar)
  const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  return qnorm([c[0], c[1], c[2], 1 + d]);
}
const pos3 = m => [m[12], m[13], m[14]];
const xf = (m, v) => [0, 1, 2].map(k => m[k] * v[0] + m[4 + k] * v[1] + m[8 + k] * v[2] + m[12 + k]);
function mat2quat(m) { // 3x3 (ustunlar m[0..2], m[4..6], m[8..10]) — masshtabsiz aylanish deb olinadi
  const c = [[m[0], m[1], m[2]], [m[4], m[5], m[6]], [m[8], m[9], m[10]]].map(v => { const l = Math.hypot(...v) || 1; return v.map(x => x / l); });
  const r00 = c[0][0], r10 = c[0][1], r20 = c[0][2], r01 = c[1][0], r11 = c[1][1], r21 = c[1][2], r02 = c[2][0], r12 = c[2][1], r22 = c[2][2];
  const t = r00 + r11 + r22; let q;
  if (t > 0) { const s = Math.sqrt(t + 1) * 2; q = [(r21 - r12) / s, (r02 - r20) / s, (r10 - r01) / s, s / 4]; }
  else if (r00 > r11 && r00 > r22) { const s = Math.sqrt(1 + r00 - r11 - r22) * 2; q = [s / 4, (r01 + r10) / s, (r02 + r20) / s, (r21 - r12) / s]; }
  else if (r11 > r22) { const s = Math.sqrt(1 + r11 - r00 - r22) * 2; q = [(r01 + r10) / s, s / 4, (r12 + r21) / s, (r02 - r20) / s]; }
  else { const s = Math.sqrt(1 + r22 - r00 - r11) * 2; q = [(r02 + r20) / s, (r12 + r21) / s, s / 4, (r10 - r01) / s]; }
  return qnorm(q);
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(join(ROOT, SRC));
const root = doc.getRoot(), skin = root.listSkins()[0], J = skin.listJoints(), ibmAcc = skin.getInverseBindMatrices();
const prim = root.listMeshes()[0].listPrimitives()[0];
const NJ = J.length, name = i => J[i].getName();

// Dam holati (bind): suyaklarning jahon matritsasi = ibm⁻¹
const IBM = J.map((_, i) => ibmAcc.getElement(i, new Array(16).fill(0)));
const W = IBM.map(inv4);
const parent = J.map(n => J.indexOf(n.getParentNode()));

const Wq = W.map(mat2quat);
const Pr = parent.map(p => (p >= 0 ? Wq[p] : [0, 0, 0, 1]));
const S = HEIGHT / 1.70; // mesh balandligi 1.70 m (oyoq y=0)

// --- Mesh: payvandlash (joy+UV+suyak) va soddalashtirish ---
const A = n => prim.getAttribute(n), Pa = A('POSITION'), Ta = A('TEXCOORD_0'), Ja = A('JOINTS_0'), Wa = A('WEIGHTS_0'), I = prim.getIndices();
const map = new Map(), pos = [], uv = [], jn = [], wt = [], idx = [];
for (let k = 0; k < I.getCount(); k++) {
  const i = I.getScalar(k), p = Pa.getElement(i, [0, 0, 0]), t = Ta.getElement(i, [0, 0]), j = Ja.getElement(i, [0, 0, 0, 0]), w = Wa.getElement(i, [0, 0, 0, 0]);
  const key = p.map(v => Math.round(v * 5000)).join(',') + ',' + Math.round(t[0] * 8192) + ',' + Math.round(t[1] * 8192);
  let v = map.get(key);
  if (v === undefined) {
    v = pos.length / 3; map.set(key, v);
    pos.push(p[0] * S, p[1] * S, p[2] * S); uv.push(t[0], t[1]); jn.push(...j); wt.push(...w);
  }
  idx.push(v);
}
await MeshoptSimplifier.ready;
const fpos = new Float32Array(pos);
let res;
try {
  const attrs = new Float32Array(pos.length / 3 * 6);
  for (let v = 0; v < pos.length / 3; v++) { attrs[v * 6] = uv[v * 2]; attrs[v * 6 + 1] = uv[v * 2 + 1]; for (let k = 0; k < 4; k++) attrs[v * 6 + 2 + k] = wt[v * 4 + k] * 0.5; }
  res = MeshoptSimplifier.simplifyWithAttributes(new Uint32Array(idx), fpos, 3, attrs, 6, [1, 1, 1, 1, 1, 1], null, TRIS * 3, 0.02, ['LockBorder']);
} catch (e) { console.warn('simplifyWithAttributes yo\'q, oddiy usul:', e.message); res = MeshoptSimplifier.simplify(new Uint32Array(idx), fpos, 3, TRIS * 3, 0.01, ['LockBorder']); }
const [out, err] = res;
const cidx = out.slice(), [remap, nv] = MeshoptSimplifier.compactMesh(cidx);
const P2 = new Float32Array(nv * 3), U2 = new Float32Array(nv * 2), J2 = new Uint8Array(nv * 4), W2 = new Float32Array(nv * 4);
for (let i = 0; i < remap.length; i++) if (remap[i] < nv) {
  const r = remap[i];
  P2.set(fpos.subarray(i * 3, i * 3 + 3), r * 3); U2[r * 2] = uv[i * 2]; U2[r * 2 + 1] = uv[i * 2 + 1];
  const w = wt.slice(i * 4, i * 4 + 4), sum = w.reduce((a, b) => a + b, 0) || 1;
  for (let k = 0; k < 4; k++) { J2[r * 4 + k] = jn[i * 4 + k]; W2[r * 4 + k] = w[k] / sum; }
}
const N2 = new Float32Array(nv * 3);
for (let t = 0; t < cidx.length; t += 3) {
  const a = cidx[t] * 3, b = cidx[t + 1] * 3, c = cidx[t + 2] * 3;
  const ux = P2[b] - P2[a], uy = P2[b + 1] - P2[a + 1], uz = P2[b + 2] - P2[a + 2], vx = P2[c] - P2[a], vy = P2[c + 1] - P2[a + 1], vz = P2[c + 2] - P2[a + 2];
  const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
  for (const q of [a, b, c]) for (let k = 0; k < 3; k++) N2[q + k] += n[k];
}
for (let i = 0; i < nv; i++) { const l = Math.hypot(N2[i * 3], N2[i * 3 + 1], N2[i * 3 + 2]) || 1; for (let k = 0; k < 3; k++) N2[i * 3 + k] /= l; }

// --- Tekstura ---
const mat = prim.getMaterial(), tex = mat.getBaseColorTexture();
const img = await sharp(Buffer.from(tex.getImage())).resize(1024, 1024, { fit: 'inside' }).jpeg({ quality: 84, mozjpeg: true }).toBuffer();

// --- Yangi hujjat: tozalangan skelet (burilishsiz) + mesh + animatsiyalar ---
const D = new Document(), buf = D.createBuffer(), scene = D.createScene();
const acc = (type, arr) => D.createAccessor().setType(type).setArray(arr).setBuffer(buf);
const nodes = J.map((_, i) => {
  const wp = [W[i][12] * S, W[i][13] * S, W[i][14] * S], pp = parent[i] >= 0 ? [W[parent[i]][12] * S, W[parent[i]][13] * S, W[parent[i]][14] * S] : [0, 0, 0];
  return D.createNode(name(i)).setTranslation([wp[0] - pp[0], wp[1] - pp[1], wp[2] - pp[2]]);
});
J.forEach((_, i) => { if (parent[i] >= 0) nodes[parent[i]].addChild(nodes[i]); else scene.addChild(nodes[i]); });
const ibm = new Float32Array(NJ * 16);
J.forEach((_, i) => { ibm.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -W[i][12] * S, -W[i][13] * S, -W[i][14] * S, 1], i * 16); });
const dskin = D.createSkin('hero').setInverseBindMatrices(acc('MAT4', ibm));
nodes.forEach(n => dskin.addJoint(n));
const texture = D.createTexture('hero').setImage(img).setMimeType('image/jpeg');
const dprim = D.createPrimitive()
  .setAttribute('POSITION', acc('VEC3', P2)).setAttribute('NORMAL', acc('VEC3', N2)).setAttribute('TEXCOORD_0', acc('VEC2', U2))
  .setAttribute('JOINTS_0', acc('VEC4', J2)).setAttribute('WEIGHTS_0', acc('VEC4', W2))
  .setIndices(acc('SCALAR', nv > 65535 ? cidx : new Uint16Array(cidx)))
  .setMaterial(D.createMaterial('hero').setBaseColorTexture(texture).setRoughnessFactor(1).setMetallicFactor(0));
scene.addChild(D.createNode('heroMesh').setMesh(D.createMesh('hero').addPrimitive(dprim)).setSkin(dskin));

const hips = J.findIndex(n => n.getName().endsWith('Hips'));
let nkeys = 0;
for (const an of root.listAnimations()) {
  if (!KEEP.includes(an.getName())) continue;
  const A2 = D.createAnimation(an.getName()), idle = an.getName() === 'Idle';
  const qmean = (o, n) => { const m = [0, 0, 0, 0]; for (let k = 0; k < n; k++) { const sg = o[k * 4 + 3] < 0 ? -1 : 1; for (let e = 0; e < 4; e++) m[e] += o[k * 4 + e] * sg; } return qnorm(m); };
  // Turish: chanoqning o'rtacha qiyaligi (oldinga/yonga egilish) — olib tashlanadi, oyoqlar esa joyida qoladi
  let HM = null;
  if (idle) {
    const hc = an.listChannels().find(c => J.indexOf(c.getTargetNode()) === hips && c.getTargetPath() === 'rotation'), v = hc.getSampler().getOutput(), n = v.getCount();
    const o = new Float32Array(n * 4);
    for (let k = 0; k < n; k++) o.set(qnorm(qmul(qmul(Pr[hips], qnorm(v.getElement(k, [0, 0, 0, 1]))), qinv(Wq[hips]))), k * 4);
    const m = qmean(o, n);
    HM = qnorm(qmul(m, qinv(qnorm([0, m[1], 0, m[3]])))); // faqat qiyalik (Y atrofidagi burilish qoladi)
  }
  for (const ch of an.listChannels()) {
    const i = J.indexOf(ch.getTargetNode()), path = ch.getTargetPath();
    if (i < 0 || (path !== 'rotation' && !(path === 'translation' && i === hips))) continue;
    // Kaft: Meshy skeletida Mixamo kaft animatsiyasi bilakni qiyshiq bukadi — kaft bilak bilan bir chiziqda qoladi
    if (/(Left|Right)Hand$/.test(name(i))) continue;
    const s = ch.getSampler(), times = s.getInput(), vals = s.getOutput(), n = times.getCount();
    let o;
    if (path === 'rotation') {
      o = new Float32Array(n * 4);
      // Bilak: o'z o'qi atrofidagi buralish olib tashlanadi (faqat egilish) — kaft dam holatidagidek songa qaragan bo'ladi
      const ax = /(Left|Right)ForeArm$/.test(name(i)) ? norm3(sub3(pos3(W[J.findIndex(n => n.getParentNode() === J[i])]), pos3(W[i]))) : null;
      for (let k = 0; k < n; k++) {
        let q = qnorm(qmul(qmul(Pr[i], qnorm(vals.getElement(k, [0, 0, 0, 1]))), qinv(Wq[i])));
        if (ax) { const d = q[0] * ax[0] + q[1] * ax[1] + q[2] * ax[2]; q = qnorm(qmul(q, qinv(qnorm([ax[0] * d, ax[1] * d, ax[2] * d, q[3]])))); }
        if (HM && i === hips) q = qnorm(qmul(q, qinv(HM)));
        if (HM && /UpLeg$/.test(name(i))) q = qnorm(qmul(HM, q));
        o.set(q, k * 4);
      }
      // Turish (Idle): umurtqa, bo'yin va boshdagi doimiy oldinga egilish olib tashlanadi — faqat nafas olish tebranishi qoladi
      if (idle && /(Spine\d?|Neck|Head)$/.test(name(i))) {
        const mi = qinv(qmean(o, n));
        for (let k = 0; k < n; k++) o.set(qnorm(qmul(Array.from(o.subarray(k * 4, k * 4 + 4)), mi)), k * 4);
      }
    } else { // Hips: tebranish (animatsiyalar joyida — ko'pi bilan 6 sm chayqalish; olib tashlansa oyoqlar sirpanadi)
      o = new Float32Array(n * 3);
      for (let k = 0; k < n; k++) { const t = vals.getElement(k, [0, 0, 0]); o.set([t[0] * S, t[1] * S, t[2] * S], k * 3); }
    }
    const samp = D.createAnimationSampler().setInput(acc('SCALAR', new Float32Array(Array.from({ length: n }, (_, k) => times.getScalar(k))))).setOutput(acc(path === 'rotation' ? 'VEC4' : 'VEC3', o)).setInterpolation('LINEAR');
    A2.addSampler(samp).addChannel(D.createAnimationChannel().setTargetNode(nodes[i]).setTargetPath(path).setSampler(samp));
    nkeys += n;
  }
}
const glb = await io.writeBinary(D);
writeFileSync(join(ROOT, 'models', 'hero.js'), `// Personaj (Meshy AI + Mixamo skeleti, animatsiyalar: Idle, Walking, Running) — o'yin uchun GLB (base64). Manba: ${SRC}, tools/prep-hero.mjs\n(window.MODEL_DATA = window.MODEL_DATA || {}).hero = '${Buffer.from(glb).toString('base64')}';\n`);
console.log(`hero: ${idx.length / 3 | 0} → ${cidx.length / 3} uchburchak (xato ${err.toFixed(4)}), ${nv} uch, ${NJ} suyak, ${nkeys} kalit, ${(glb.byteLength / 1024).toFixed(0)} KB (tekstura ${(img.length / 1024).toFixed(0)} KB), hips y=${(W[hips][13] * S).toFixed(3)}`);
