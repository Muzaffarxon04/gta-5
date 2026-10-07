'use strict';
// ===== O'zbekiston davlat raqamlari: "01 A 123 BC" (shaxsiy), "01 123 ABC" (tashkilot: taksi, avtobus, politsiya) =====
// Raqam mashinaning old va orqa bamperida (yaqin ko'rinishda, LOD0 ichida) turadi.
const PLATE_REGIONS = [['01', 46], ['10', 14], ['30', 6], ['40', 6], ['50', 5], ['60', 5], ['20', 3], ['25', 3], ['70', 3], ['75', 2], ['80', 3], ['85', 2], ['90', 1], ['95', 1]];
const PLATE_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVXYZ';
const LEGAL_TYPES = ['taxi', 'bus', 'police'];
function plateRegion() {
  let r = Math.random() * PLATE_REGIONS.reduce((s, p) => s + p[1], 0);
  for (const [code, w] of PLATE_REGIONS) if ((r -= w) <= 0) return code;
  return '01';
}
const plateLetter = () => PLATE_LETTERS[randi(0, PLATE_LETTERS.length - 1)];
const plateDigits = () => String(randi(0, 999)).padStart(3, '0');
function randomPlate(type) {
  const reg = plateRegion();
  return LEGAL_TYPES.includes(type) ? `${reg} ${plateDigits()} ${plateLetter()}${plateLetter()}${plateLetter()}` : `${reg} ${plateLetter()} ${plateDigits()} ${plateLetter()}${plateLetter()}`;
}
// O'z raqamingiz (garajda $50): viloyat kodi + istalgan harf/raqamlar (8 tagacha belgi)
const PLATE_CODES = ['01', '10', '20', '25', '30', '40', '50', '60', '70', '75', '80', '85', '90', '95'];
function cleanPlateText(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 9); }
function customPlate(reg, text) {
  const t = cleanPlateText(text);
  return PLATE_CODES.includes(reg) && t.replace(/ /g, '').length ? `${reg} ${t}` : null;
}

// Raqam rasmi (kanvas): chapda viloyat kodi, o'rtada raqam, o'ngda bayroq va UZ
function plateTexture(text) {
  const t = new THREE.CanvasTexture(plateCanvas(text));
  t.anisotropy = 4;
  return t;
}
function plateCanvas(text, cv) {
  const W = 512, H = 112;
  cv = cv || document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), [reg, ...rest] = text.split(' ');
  g.fillStyle = '#111'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#f7f7f4'; g.fillRect(5, 5, W - 10, H - 10);
  g.fillStyle = '#111'; g.fillRect(104, 8, 4, H - 16);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#111';
  g.font = 'bold 74px Arial, sans-serif'; g.fillText(reg, 56, H / 2 + 4);
  g.font = 'bold 76px Arial, sans-serif';
  const main = rest.join(' '), mw = Math.min(310, g.measureText(main).width);
  g.fillText(main, 112 + (330 - 112 + 100) / 2 - 2, H / 2 + 4, mw);
  // Bayroq: ko'k, oq, yashil (qizil chiziqlar bilan) va "UZ"
  const fx = 446, fy = 16, fw = 54, fh = 38;
  g.fillStyle = '#0099b5'; g.fillRect(fx, fy, fw, fh / 3);
  g.fillStyle = '#ffffff'; g.fillRect(fx, fy + fh / 3, fw, fh / 3);
  g.fillStyle = '#1eb53a'; g.fillRect(fx, fy + 2 * fh / 3, fw, fh / 3);
  g.fillStyle = '#ce1126'; g.fillRect(fx, fy + fh / 3 - 1.5, fw, 3); g.fillRect(fx, fy + 2 * fh / 3 - 1.5, fw, 3);
  g.strokeStyle = '#555'; g.lineWidth = 1; g.strokeRect(fx, fy, fw, fh);
  g.fillStyle = '#0a5ba8'; g.font = 'bold 30px Arial, sans-serif'; g.fillText('UZ', fx + fw / 2, 80);
  return cv;
}

// Old va orqa raqam — bitta geometriyada (bitta chizish chaqiruvi)
function plateGeo(P, small) {
  const w = small ? 0.26 : 0.52, h = small ? 0.056 : 0.112, pos = [], uv = [], nor = [], idx = [];
  const quad = (y, z, dir) => {
    const b = pos.length / 3, x0 = -w / 2 * dir, x1 = w / 2 * dir;
    pos.push(x0, y - h / 2, z, x1, y - h / 2, z, x1, y + h / 2, z, x0, y + h / 2, z);
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    for (let k = 0; k < 4; k++) nor.push(0, 0, dir);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  };
  if (P[0] != null) quad(P[0], P[1] + 0.012, 1);
  if (P[2] != null) quad(P[2], P[3] - 0.012, -1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
const _plateGeo = {};
Car.prototype.setPlate = function (text) {
  const T = this.T;
  this.plate = text || randomPlate(this.type);
  if (!T.plate || !this.body.isLOD) return;
  const near = this.body.getObjectByName('lod0');
  if (!near) return;
  if (this.plateMesh) { this.plateMesh.material.map.dispose(); this.plateMesh.material.map = plateTexture(this.plate); this.plateMesh.material.needsUpdate = true; return; }
  const geo = _plateGeo[this.type] || (_plateGeo[this.type] = plateGeo(T.plate, T.kind === 'moto'));
  this.plateMesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: plateTexture(this.plate) }));
  near.add(this.plateMesh);
};
Car.prototype.disposePlate = function () {
  if (!this.plateMesh) return;
  this.plateMesh.material.map.dispose(); this.plateMesh.material.dispose();
  this.plateMesh.parent.remove(this.plateMesh); this.plateMesh = null;
};
