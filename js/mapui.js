'use strict';
// ===== Katta xarita (M), belgi qo'yish va GPS yo'nalishi =====
const MapUI = {
  open: false, wp: null, route: [], routeColor: '#b36bff', routeT: 0, beacon: null, view: null,
  init(scene) {
    this.root = document.getElementById('mapPanel');
    this.cv = document.getElementById('bigmap');
    this.g = this.cv.getContext('2d');
    document.getElementById('mapClose').addEventListener('click', () => this.close());
    document.getElementById('mapClear').addEventListener('click', () => { this.setWaypoint(null); this.render(); });
    this.cv.addEventListener('click', e => this.onClick(e));
    document.getElementById('radar').addEventListener('click', () => this.toggle());
    addEventListener('keydown', e => {
      if (e.code === 'KeyM' && !e.repeat) this.toggle();
      if (e.code === 'Escape' && this.open) this.close();
    });
    addEventListener('resize', () => { if (this.open) this.render(); });
    this.beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 90, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xb36bff, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }));
    this.beacon.visible = false; scene.add(this.beacon);
  },
  toggle() { if (this.open) this.close(); else this.show(); },
  show() {
    if (!Game.started || Game.paused || Game.shopOpen) return;
    this.open = true; Game.shopOpen = true;
    if (Input.locked && document.exitPointerLock) document.exitPointerLock();
    Input.keys = {}; Input.mouseL = Input.mouseR = false;
    SFX.mute(); TouchUI.show(false);
    this.root.hidden = false;
    this.render();
  },
  close() {
    if (!this.open) return;
    this.open = false; Game.shopOpen = false;
    this.root.hidden = true;
    TouchUI.show(true); requestLock();
  },
  setWaypoint(p) {
    this.wp = p;
    this.beacon.visible = !!p;
    if (p) this.beacon.position.set(p.x, 45, p.z);
    this.routeT = 0;
  },
  onClick(e) {
    const r = this.cv.getBoundingClientRect(), v = this.view;
    const u = (e.clientX - r.left) * (this.cv.width / r.width), w = (e.clientY - r.top) * (this.cv.height / r.height);
    const x = (u - v.ox) / v.s + World.mapMin, z = (w - v.oy) / v.s + World.mapMin;
    if (Math.abs(x) > CITY.LIMIT || Math.abs(z) > CITY.LIMIT) return;
    if (this.wp && dist2(x, z, this.wp.x, this.wp.z) < 400) this.setWaypoint(null);
    else this.setWaypoint({ x, z });
    this.update(0, true);
    this.render();
  },
  // GPS: maqsad — vazifa/taksi (sariq) yoki o'z belgingiz (binafsha)
  target() {
    const t = Taxi.target() || Missions.target();
    if (t) return { x: t.x, z: t.z, color: '#ffc83d' };
    return this.wp ? { x: this.wp.x, z: this.wp.z, color: '#b36bff' } : null;
  },
  update(dt, force) {
    const P = Player;
    if (this.wp && dist2(P.x, P.z, this.wp.x, this.wp.z) < 144) { this.setWaypoint(null); HUD.help('Belgilangan joyga yetib keldingiz.', 2.5); }
    this.routeT -= dt;
    if (this.routeT > 0 && !force) return;
    this.routeT = 0.7;
    const t = this.target();
    this.route = t ? gpsRoute(P.x, P.z, t.x, t.z) : [];
    this.routeColor = t ? t.color : '#b36bff';
  },
  render() {
    const cv = this.cv, g = this.g, dpr = Math.min(window.devicePixelRatio || 1, 2);
    const box = Math.max(200, Math.min(innerWidth - 32, innerHeight - 150));
    cv.style.width = cv.style.height = box + 'px';
    cv.width = cv.height = Math.round(box * dpr);
    const W = cv.width, img = World.mapCanvas, s = W / img.width;
    this.view = { s, ox: 0, oy: 0 };
    g.fillStyle = '#2b5a73'; g.fillRect(0, 0, W, W);
    g.drawImage(img, 0, 0, W, W);
    const toC = (x, z) => [(x - World.mapMin) * s, (z - World.mapMin) * s];
    // Tuman nomlari
    g.font = `600 ${Math.round(13 * dpr)}px "Barlow Condensed", sans-serif`; g.textAlign = 'center'; g.fillStyle = 'rgba(255,255,255,.45)';
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const x = CITY.OFF + (i + 0.5) * CITY.SIZE / 3, z = CITY.OFF + (j + 0.5) * CITY.SIZE / 3, [u, w] = toC(x, z);
      g.fillText(DISTRICTS[j][i].toUpperCase(), u, w);
    }
    // GPS yo'li
    if (this.route.length > 1) {
      g.strokeStyle = this.routeColor; g.lineWidth = 5 * dpr; g.lineJoin = 'round'; g.beginPath();
      this.route.forEach((p, k) => { const [u, w] = toC(p.x, p.z); if (k) g.lineTo(u, w); else g.moveTo(u, w); });
      g.stroke();
    }
    const icon = (x, z, color, label, size = 9) => {
      const [u, w] = toC(x, z), r = size * dpr;
      g.fillStyle = color; g.strokeStyle = '#000'; g.lineWidth = 2 * dpr;
      g.beginPath(); g.arc(u, w, r, 0, TAU); g.fill(); g.stroke();
      if (label) { g.fillStyle = '#111'; g.font = `bold ${Math.round(r * 1.3)}px sans-serif`; g.textBaseline = 'middle'; g.fillText(label, u, w + 1); }
    };
    for (const b of [...Landmarks.blips(0, 0, true), ...Shops.blips(), ...Missions.blips(), ...Garage.blips(), ...Taxi.blips(), ...MP.blips()]) icon(b.x, b.z, b.color, b.label, 8);
    for (const c of Game.cars) if (c.driver === 'police' && Game.wanted > 0) icon(c.x, c.z, '#3d7bff', '', 5);
    if (this.wp) icon(this.wp.x, this.wp.z, '#b36bff', '★', 10);
    // O'yinchi strelkasi
    const [pu, pw] = toC(Player.x, Player.z);
    g.save(); g.translate(pu, pw); g.rotate(Math.PI - Player.h); g.scale(dpr * 1.3, dpr * 1.3);
    g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -12); g.lineTo(9, 10); g.lineTo(0, 5); g.lineTo(-9, 10); g.closePath(); g.fill(); g.stroke();
    g.restore();
  },
};

// Yo'l tarmog'i bo'ylab eng qisqa yo'l (chorrahalar to'ri, BFS)
function nearestNode(x, z) {
  return [clamp(Math.round((x - CITY.OFF) / CITY.CELL), 0, CITY.N), clamp(Math.round((z - CITY.OFF) / CITY.CELL), 0, CITY.N)];
}
function gpsRoute(x0, z0, x1, z1) {
  const [ai, aj] = nearestNode(x0, z0), [bi, bj] = nearestNode(x1, z1);
  if (ai === bi && aj === bj) return [{ x: x0, z: z0 }, { x: x1, z: z1 }];
  const N = CITY.N + 1, prev = new Int32Array(N * N).fill(-1), q = [ai * N + aj];
  prev[ai * N + aj] = ai * N + aj;
  while (q.length) {
    const k = q.shift(), i = Math.floor(k / N), j = k % N;
    if (i === bi && j === bj) break;
    for (const [ni, nj] of neighbors(i, j)) { const nk = ni * N + nj; if (prev[nk] < 0) { prev[nk] = k; q.push(nk); } }
  }
  const pts = [];
  for (let k = bi * N + bj; ; k = prev[k]) { pts.push({ x: roadPos(Math.floor(k / N)), z: roadPos(k % N) }); if (prev[k] === k || prev[k] < 0) break; }
  pts.reverse();
  // O'yinchi allaqachon birinchi chorrahadan o'tib ketgan bo'lsa, uni tashlab yuboramiz
  if (pts.length > 1 && dist2(x0, z0, pts[1].x, pts[1].z) < dist2(pts[0].x, pts[0].z, pts[1].x, pts[1].z)) pts.shift();
  return [{ x: x0, z: z0 }, ...pts, { x: x1, z: z1 }];
}
