'use strict';
// ===== Tarmoq: telefonlar o'rtasida to'g'ridan-to'g'ri ulanish (WebRTC) =====
// Bir telefon — host, qolganlari unga ulanadi (yulduz shaklida). O'yin ma'lumotlari to'g'ridan-to'g'ri,
// bir Wi-Fi'da bo'lsa — internetsiz, lokal tarmoq orqali yuradi.
// Tanishuv (signal) ikki xil:
//   1) Xona kodi — ntfy.sh orqali (faqat ulanish lahzasida internet kerak)
//   2) QR-kod — telefonlar bir-birining QR-kodini skanerlaydi (internet umuman kerak emas)
const RELAY = 'https://ntfy.sh/';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

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
  peers: new Map(), room: null, polling: false, seen: new Set(), pendingQR: null,
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
    const p = this.peers.get(id);
    if (!p || !p.open) return;
    const ch = fast ? p.fast : p.rel;
    if (ch.readyState === 'open') try { ch.send(JSON.stringify(msg)); } catch (e) { /* bufer to'la */ }
  },
  broadcast(msg, fast, except) { for (const id of this.peers.keys()) if (id !== except) this.send(id, msg, fast); },
  drop(id) {
    const p = this.peers.get(id);
    if (!p) return;
    this.peers.delete(id);
    try { p.pc.close(); } catch (e) { /* allaqachon yopilgan */ }
    if (p.open && this.onClose) this.onClose(id, p.name);
  },
  leave() {
    for (const id of [...this.peers.keys()]) this.drop(id);
    this.role = null; this.room = null; this.polling = false; this.pendingQR = null;
  },

  // ----- 1) Xona kodi (ntfy.sh orqali tanishuv) -----
  topic(suffix) { return `kocha-qiroli-${this.room.toLowerCase()}-${suffix}`; },
  async publish(suffix, obj) { await fetch(RELAY + this.topic(suffix), { method: 'POST', body: await packMsg(obj) }); },
  pollLoop(suffix, handler) {
    this.polling = true;
    let since = Math.floor(Date.now() / 1000) - 60;
    const tick = async () => {
      if (!this.polling || !this.room) return;
      try {
        const r = await fetch(`${RELAY}${this.topic(suffix)}/json?poll=1&since=${since}`);
        for (const line of (await r.text()).split('\n')) {
          if (!line) continue;
          const m = JSON.parse(line);
          if (m.event !== 'message' || this.seen.has(m.id)) continue;
          this.seen.add(m.id); since = Math.max(since, m.time - 1);
          try { await handler(await unpackMsg(m.message)); } catch (e) { /* begona xabar */ }
        }
      } catch (e) { this.status('Internetga ulanib bo\'lmadi — QR-kod usulidan foydalaning.'); }
      setTimeout(tick, 1500);
    };
    tick();
  },
  hostRoom() {
    this.role = 'host';
    this.room = Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
    this.pollLoop('host', async d => {
      if (d.k !== 'offer' || this.peers.has(d.from)) return;
      const peer = this.newPeer(d.from); peer.name = d.name;
      this.status(`${d.name} ulanmoqda…`);
      const sdp = await this.answer(peer, d.sdp);
      await this.publish(d.from, { k: 'answer', sdp, name: this.name, from: this.id });
    });
    return this.room;
  },
  async joinRoom(code) {
    this.role = 'guest'; this.room = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const peer = this.newPeer('host');
    this.status('Ulanmoqda…');
    const sdp = await this.offer(peer);
    this.pollLoop(this.id, async d => {
      if (d.k !== 'answer' || peer.pc.signalingState !== 'have-local-offer') return;
      peer.name = d.name; this.hostId = d.from;
      await peer.pc.setRemoteDescription({ type: 'answer', sdp: d.sdp });
      this.polling = false;
    });
    await this.publish('host', { k: 'offer', from: this.id, sdp, name: this.name });
  },

  // ----- 2) QR-kod (internetsiz) -----
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
