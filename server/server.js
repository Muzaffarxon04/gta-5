'use strict';
// ===== Ko'cha Qiroli — ko'p o'yinchi serveri =====
// O'yinning o'zi GitHub Pages'da (frontend). Bu server faqat xonalarni boshqaradi va o'yinchilar
// o'rtasida xabar tashiydi: har bir o'yinchi holatini yuboradi, server uni xonadagilarga yetkazadi.
// O'yin mantig'i (fizika, otishma) o'yinchilarning telefonida — server yengil (bir xonada 16 kishigacha).
//
// Xabarlar (JSON):
//   mijoz → server: hello, list, host {name, pub}, join {code, name}, to {to: id | '*', m, x}, leave, ping
//   server → mijoz: hi {id}, rooms [...], room {code, you, host, hostId, members}, join {id, name},
//                   left {id, name}, host {id}, msg {from, m}, err {msg}, pong
const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = +process.env.PORT || 3100;
const BIND = process.env.BIND || '127.0.0.1'; // tashqaridan Caddy orqali (HTTPS/WSS)
const MAX_ROOM = 16, MAX_ROOMS = 200, MAX_CONN = 600, MAX_MSG = 16 * 1024, RATE = 60; // xabar/soniya bitta o'yinchidan
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const rooms = new Map();
let seq = 0;

const rid = n => Array.from({ length: n }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
const clean = s => String(s || '').replace(/[<>&"'`\u0000-\u001f]/g, '').trim().slice(0, 16) || 'O\'yinchi';
const send = (c, o) => { if (c.ws.readyState === 1) c.ws.send(typeof o === 'string' ? o : JSON.stringify(o)); };
const log = (...a) => console.log(new Date().toISOString(), ...a);

function publicRooms() {
  return [...rooms.values()].filter(r => r.pub && r.members.size < MAX_ROOM)
    .map(r => ({ code: r.code, name: r.host.name, n: r.members.size, max: MAX_ROOM }))
    .sort((a, b) => b.n - a.n).slice(0, 30);
}
function enter(c, room) {
  c.room = room;
  room.members.set(c.id, c);
  send(c, { t: 'room', code: room.code, you: c.id, host: room.host === c, hostId: room.host.id,
    members: [...room.members.values()].filter(o => o !== c).map(o => ({ id: o.id, name: o.name })) });
  for (const o of room.members.values()) if (o !== c) send(o, { t: 'join', id: c.id, name: c.name });
}
function leave(c) {
  const room = c.room;
  if (!room) return;
  c.room = null;
  room.members.delete(c.id);
  if (!room.members.size) { rooms.delete(room.code); log('xona yopildi', room.code); return; }
  for (const o of room.members.values()) send(o, { t: 'left', id: c.id, name: c.name });
  // Xona egasi chiqsa — xona yopilmaydi, eng birinchi qo'shilgan o'yinchi ega bo'ladi
  if (room.host === c) {
    room.host = room.members.values().next().value;
    for (const o of room.members.values()) send(o, { t: 'host', id: room.host.id });
  }
}

function onMessage(c, d) {
  switch (d.t) {
    case 'hello': send(c, { t: 'hi', id: c.id }); break;
    case 'ping': send(c, { t: 'pong' }); break;
    case 'list': send(c, { t: 'rooms', rooms: publicRooms() }); break;
    case 'host': {
      leave(c);
      if (rooms.size >= MAX_ROOMS) { send(c, { t: 'err', msg: 'Server band, birozdan keyin urinib ko\'ring' }); break; }
      c.name = clean(d.name);
      let code;
      do code = rid(5); while (rooms.has(code));
      const room = { code, host: c, pub: d.pub !== false, members: new Map() };
      rooms.set(code, room);
      enter(c, room);
      log('xona ochildi', code, c.name, room.pub ? 'ochiq' : 'yopiq');
      break;
    }
    case 'join': {
      const room = rooms.get(String(d.code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''));
      if (!room) { send(c, { t: 'err', msg: 'Bunday xona yo\'q yoki yopilgan' }); break; }
      if (room.members.size >= MAX_ROOM) { send(c, { t: 'err', msg: 'Xona to\'la' }); break; }
      if (c.room === room) break;
      leave(c);
      c.name = clean(d.name);
      enter(c, room);
      break;
    }
    case 'leave': leave(c); break;
    case 'to': {
      const room = c.room;
      if (!room || d.m == null) break;
      const out = JSON.stringify({ t: 'msg', from: c.id, m: d.m });
      if (d.to === '*') { for (const o of room.members.values()) if (o !== c && o.id !== d.x) send(o, out); }
      else { const o = room.members.get(d.to); if (o) send(o, out); }
      break;
    }
  }
}

const server = http.createServer((req, res) => {
  // Holat (tekshirish uchun): xonalar va o'yinchilar soni
  let players = 0;
  for (const r of rooms.values()) players += r.members.size;
  res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
  res.end(JSON.stringify({ ok: true, rooms: rooms.size, players }));
});
const wss = new WebSocketServer({ server, maxPayload: MAX_MSG, perMessageDeflate: false });
wss.on('connection', ws => {
  if (wss.clients.size > MAX_CONN) { ws.close(1013, 'band'); return; } // kichik server xotirasini asrash
  const c = { ws, id: (++seq).toString(36) + rid(4).toLowerCase(), name: '', room: null, tokens: RATE * 2, t: Date.now() };
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', (data, binary) => {
    // Oddiy cheklov: soniyasiga RATE ta xabardan ko'pi tashlab yuboriladi
    const now = Date.now();
    c.tokens = Math.min(RATE * 2, c.tokens + (now - c.t) / 1000 * RATE); c.t = now;
    if (c.tokens < 1 || binary) return;
    c.tokens--;
    let d;
    try { d = JSON.parse(data); } catch (e) { return; }
    if (d && typeof d === 'object') onMessage(c, d);
  });
  ws.on('close', () => leave(c));
  ws.on('error', () => {});
});
// Uzilib qolgan ulanishlarni tozalash (telefon internetdan chiqib ketsa): 20 soniyada javob bermasa — uziladi
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false; ws.ping();
  }
}, 20000).unref();

server.listen(PORT, BIND, () => log(`Ko'cha Qiroli serveri: ${BIND}:${PORT}`));
