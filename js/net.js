'use strict';
// ===== Tarmoq =====
// Ikki xil ulanish:
//   1) Online — o'yin serveri orqali (server/server.js, WebSocket). Har qanday internetda ishlaydi;
//      har bir o'yinchi o'z holatini serverga yuboradi, server xonadagilarga tarqatadi. Xona egasi
//      chiqsa ham xona yopilmaydi. Ochiq xonalar ro'yxati bor.
//   2) Bir Wi-Fi'da, internetsiz — telefonlar o'rtasida to'g'ridan-to'g'ri (WebRTC), tanishuv QR-kod bilan.
//      Bir telefon — host, qolganlari unga ulanadi (yulduz shaklida).
// Online server manzili (o'yin GitHub Pages'da, server — alohida). Sinov uchun: localStorage 'kq-server'
const MP_SERVER = 'wss://151-145-55-234.sslip.io/game';

function b64u(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function unb64u(str) { const s = atob(str.replace(/-/g, '+').replace(/_/g, '/')); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
async function streamBytes(bytes, tf) { return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(tf)).arrayBuffer()); }
// Ixcham matn: JSON -> siqish (deflate) -> base64url. Birinchi belgi: 1 — siqilgan, 0 — siqilmagan
async function packMsg(obj) {
  const raw = new TextEncoder().encode(JSON.stringify(obj));
  if (window.CompressionStream) return '1' + b64u(await streamBytes(raw, new CompressionStream('deflate-raw')));
  return '0' + b64u(raw);
}
async function unpackMsg(str) {
  str = str.trim();
  let bytes = unb64u(str.slice(1));
  if (str[0] === '1') bytes = await streamBytes(bytes, new DecompressionStream('deflate-raw'));
  return JSON.parse(new TextDecoder().decode(bytes));
}
// SDP dan keraksiz qatorlarni olib tashlash (QR-kod kichikroq bo'lishi uchun)
const trimSdp = sdp => sdp.split('\r\n').filter(l => l && !/^a=(extmap|rtcp-fb|ssrc|msid|max-message-size)/.test(l)).join('\r\n') + '\r\n';

const Net = {
  role: null, id: Math.random().toString(36).slice(2, 10), name: '',
  peers: new Map(), room: null, pendingQR: null,
  mode: null, ws: null, waiters: [], onHost: null,
  onMessage: null, onOpen: null, onClose: null, onStatus: null,
  supported() { return typeof RTCPeerConnection === 'function'; },
  status(t) { if (this.onStatus) this.onStatus(t); },
  iceServers() { return navigator.onLine ? [{ urls: 'stun:stun.l.google.com:19302' }] : []; },
  newPeer(id) {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers() });
    // Ikki kanal: ishonchli (hodisalar) va tez (holat, yo'qolsa ham mayli)
    const rel = pc.createDataChannel('rel', { negotiated: true, id: 0 });
    const fast = pc.createDataChannel('fast', { negotiated: true, id: 1, ordered: false, maxRetransmits: 0 });
    const peer = { id, pc, rel, fast, open: false, name: '' };
    const onmsg = e => { try { if (this.onMessage) this.onMessage(peer.id, JSON.parse(e.data)); } catch (err) { /* buzilgan paket */ } };
    rel.onmessage = onmsg; fast.onmessage = onmsg;
    rel.onopen = () => { peer.open = true; this.status(`${peer.name || 'O\'yinchi'} ulandi`); if (this.onOpen) this.onOpen(peer.id, peer.name); };
    rel.onclose = () => this.drop(peer.id);
    pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed') { this.status('Ulanib bo\'lmadi. Bir xil Wi-Fi\'dami?'); this.drop(peer.id); } };
    this.peers.set(id, peer);
    return peer;
  },
  rename(peer, id) { this.peers.delete(peer.id); peer.id = id; this.peers.set(id, peer); },
  gather(pc) {
    if (pc.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise(res => {
      const t = setTimeout(res, 3000);
      pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } });
    });
  },
  async offer(peer) { await peer.pc.setLocalDescription(await peer.pc.createOffer()); await this.gather(peer.pc); return trimSdp(peer.pc.localDescription.sdp); },
  async answer(peer, sdp) {
    await peer.pc.setRemoteDescription({ type: 'offer', sdp });
    await peer.pc.setLocalDescription(await peer.pc.createAnswer()); await this.gather(peer.pc);
    return trimSdp(peer.pc.localDescription.sdp);
  },
  send(id, msg, fast) {
    if (this.mode === 'ws') { if (this.peers.has(id)) this.wsSend({ t: 'to', to: id, m: msg }); return; }
    const p = this.peers.get(id);
    if (!p || !p.open) return;
    const ch = fast ? p.fast : p.rel;
    if (ch.readyState === 'open') try { ch.send(JSON.stringify(msg)); } catch (e) { /* bufer to'la */ }
  },
  broadcast(msg, fast, except) {
    if (this.mode === 'ws') { if (this.peers.size) this.wsSend({ t: 'to', to: '*', m: msg, x: except }); return; }
    for (const id of this.peers.keys()) if (id !== except) this.send(id, msg, fast);
  },
  drop(id) {
    const p = this.peers.get(id);
    if (!p) return;
    this.peers.delete(id);
    if (p.pc) try { p.pc.close(); } catch (e) { /* allaqachon yopilgan */ }
    if (p.open && this.onClose) this.onClose(id, p.name);
  },
  // Hammadan jimgina uzilish (o'zimiz chiqyapmiz — har biri uchun "chiqdi" xabari kerak emas)
  clearPeers() {
    const ps = [...this.peers.values()];
    this.peers.clear();
    for (const p of ps) if (p.pc) try { p.pc.close(); } catch (e) { /* allaqachon yopilgan */ }
  },
  leave() {
    if (this.mode === 'ws') this.wsSend({ t: 'leave' });
    this.clearPeers();
    this.role = null; this.room = null; this.pendingQR = null; this.mode = null;
  },

  // ----- Online: o'yin serveri (WebSocket) -----
  server() { try { return localStorage.getItem('kq-server') || MP_SERVER; } catch (e) { return MP_SERVER; } },
  wsConnect() {
    if (this.ws && this.ws.readyState === 1) return Promise.resolve();
    if (this.wsOpening) return this.wsOpening;
    return (this.wsOpening = new Promise((res, rej) => {
      let ws;
      try { ws = new WebSocket(this.server()); } catch (e) { this.wsOpening = null; rej(e); return; }
      const t = setTimeout(() => { ws.close(); }, 8000);
      ws.onopen = () => { clearTimeout(t); this.ws = ws; this.wsOpening = null; res(); };
      ws.onerror = () => {};
      ws.onclose = () => {
        clearTimeout(t);
        const was = this.ws === ws;
        if (was) this.ws = null;
        if (this.wsOpening) { this.wsOpening = null; rej(new Error('server')); }
        if (was && this.mode === 'ws') {
          // Internet uzildi yoki server o'chdi — xonadan chiqamiz
          this.clearPeers();
          this.role = null; this.room = null; this.mode = null;
          this.status('Server bilan aloqa uzildi.');
          if (this.onLost) this.onLost();
        }
        for (const w of this.waiters.splice(0)) w.rej(new Error('server'));
      };
      ws.onmessage = e => { let d; try { d = JSON.parse(e.data); } catch (err) { return; } this.wsMsg(d); };
    }));
  },
  wsSend(o) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); },
  // Server javobini kutish (room, rooms yoki err)
  wait(types, ms = 8000) {
    return new Promise((res, rej) => {
      const w = { types, res, rej };
      w.timer = setTimeout(() => { this.waiters = this.waiters.filter(x => x !== w); rej(new Error('Server javob bermadi')); }, ms);
      this.waiters.push(w);
    });
  },
  wsMsg(d) {
    const w = this.waiters.find(x => x.types.includes(d.t));
    if (w) {
      this.waiters = this.waiters.filter(x => x !== w); clearTimeout(w.timer);
      if (d.t === 'err') w.rej(new Error(d.msg)); else w.res(d);
    }
    if (d.t === 'room') {
      this.clearPeers();
      this.mode = 'ws'; this.room = d.code; this.id = d.you; this.hostId = d.hostId;
      this.role = d.host ? 'host' : 'guest';
      for (const m of d.members) this.wsPeer(m.id, m.name);
    } else if (d.t === 'join') { this.wsPeer(d.id, d.name); this.status(`${d.name} qo'shildi`); }
    else if (d.t === 'left') this.drop(d.id);
    else if (d.t === 'host') {
      this.hostId = d.id;
      if (d.id === this.id && this.role !== 'host') { this.role = 'host'; this.status('Endi xona egasi — siz'); if (this.onHost) this.onHost(); }
    } else if (d.t === 'msg') { if (this.onMessage && this.peers.has(d.from)) this.onMessage(d.from, d.m); }
    else if (d.t === 'err' && !w) this.status(d.msg);
  },
  wsPeer(id, name) {
    if (this.peers.has(id)) return;
    const peer = { id, name, open: true };
    this.peers.set(id, peer);
    if (this.onOpen) this.onOpen(id, name);
  },
  async onlineHost(pub) {
    await this.wsConnect();
    this.wsSend({ t: 'host', name: this.name, pub });
    return (await this.wait(['room', 'err'])).code;
  },
  async onlineJoin(code) {
    await this.wsConnect();
    this.wsSend({ t: 'join', code, name: this.name });
    return (await this.wait(['room', 'err'])).code;
  },
  async onlineRooms() {
    await this.wsConnect();
    this.wsSend({ t: 'list' });
    return (await this.wait(['rooms'])).rooms;
  },

  // ----- Bir Wi-Fi'da: QR-kod (internetsiz) -----
  // Host: taklif QR-kodi -> o'yinchi skanerlaydi -> javob QR-kodi -> host skanerlaydi
  async qrHostOffer() {
    this.role = 'host';
    if (this.pendingQR) this.drop(this.pendingQR.id);
    const peer = this.newPeer('qr-' + Math.random().toString(36).slice(2, 7));
    this.pendingQR = peer;
    const sdp = await this.offer(peer);
    return packMsg({ k: 'offer', from: this.id, pid: peer.id, sdp, name: this.name });
  },
  async qrHostAccept(str) {
    const d = await unpackMsg(str), peer = this.peers.get(d.pid);
    if (d.k !== 'answer' || !peer) throw new Error('Bu QR-kod mos emas');
    peer.name = d.name;
    this.rename(peer, d.from);
    this.pendingQR = null;
    await peer.pc.setRemoteDescription({ type: 'answer', sdp: d.sdp });
  },
  async qrGuestAnswer(str) {
    const d = await unpackMsg(str);
    if (d.k !== 'offer') throw new Error('Bu QR-kod host taklifi emas');
    this.role = 'guest'; this.hostId = d.from;
    for (const id of [...this.peers.keys()]) this.drop(id);
    const peer = this.newPeer('host'); peer.name = d.name;
    const sdp = await this.answer(peer, d.sdp);
    return packMsg({ k: 'answer', from: this.id, pid: d.pid, sdp, name: this.name });
  },
};
