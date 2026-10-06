'use strict';
// ===== Mashinadagi radio: kod bilan yaratiladigan musiqa (3 ta stansiya) =====
const midi = n => 440 * Math.pow(2, (n - 69) / 12);
function seeded(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const HIJAZ = [0, 1, 4, 5, 7, 8, 10, 12, 13, 16]; // Hijoz ladi — Sharq kuylariga xos
const PENTA = [0, 3, 5, 7, 10, 12, 15, 17];
const _phr = {};
// Takrorlanuvchi kuy jumlasi (bir xil urug' — bir xil kuy)
function phrase(key, seed, len, n, rhythm) {
  if (_phr[key]) return _phr[key];
  const r = seeded(seed), out = new Array(len).fill(-1);
  let deg = Math.floor(n / 2);
  for (let i = 0; i < len; i++) {
    if (!rhythm.includes(i % 16) || r() < 0.18) continue;
    const s = r();
    deg = clamp(deg + (s < 0.4 ? 1 : s < 0.8 ? -1 : s < 0.9 ? 2 : -2), 0, n - 1);
    out[i] = deg;
  }
  out[len - 2] = -1; out[len - 4] = 0;
  return (_phr[key] = out);
}

// Cholg'ular (WebAudio)
const I = {
  osc(type, f, t, dur, v, dest, o = {}) {
    const c = SFX.ctx, osc = c.createOscillator(), g = c.createGain(), a = o.a || 0.005;
    osc.type = type; osc.frequency.setValueAtTime(f, t);
    if (o.glide) osc.frequency.exponentialRampToValueAtTime(o.glide, t + dur);
    if (o.vib) {
      const l = c.createOscillator(), lg = c.createGain();
      l.frequency.value = o.vib; lg.gain.value = f * 0.012; l.connect(lg).connect(osc.frequency); l.start(t); l.stop(t + a + dur + 0.1);
    }
    let node = osc;
    if (o.lp) {
      const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(o.lp, t);
      if (o.lpEnd) fl.frequency.exponentialRampToValueAtTime(o.lpEnd, t + dur);
      osc.connect(fl); node = fl;
    }
    node.connect(g).connect(dest);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dur);
    osc.start(t); osc.stop(t + a + dur + 0.05);
  },
  kick(t, d) { I.osc('sine', 130, t, 0.28, 0.9, d, { glide: 42 }); },
  snare(t, d) { SFX.burst(d, t, 0.16, 'bandpass', 1900, 0.45, 0.8); I.osc('triangle', 190, t, 0.08, 0.3, d); },
  hat(t, d, open) { SFX.burst(d, t, open ? 0.18 : 0.045, 'highpass', 7500, 0.22); },
  // Doira: "dum" (markaz), "tak" (chet), halqalar jiringi
  dum(t, d) { I.osc('sine', 95, t, 0.22, 0.85, d, { glide: 60 }); SFX.burst(d, t, 0.06, 'lowpass', 500, 0.3); },
  tak(t, d) { SFX.burst(d, t, 0.05, 'bandpass', 2600, 0.5, 2); },
  ring(t, d) { SFX.burst(d, t, 0.16, 'highpass', 8000, 0.14); },
  // Dutor/rubob — chertib chalinadigan tor
  pluck(t, f, d, v = 0.2) { I.osc('sawtooth', f, t, 0.5, v, d, { lp: 3500, lpEnd: 400 }); I.osc('square', f * 2, t, 0.25, v * 0.25, d, { lp: 2500, lpEnd: 600 }); },
  pad(t, freqs, dur, d) { for (const f of freqs) for (const det of [-6, 6]) I.osc('sawtooth', f * Math.pow(2, det / 1200), t, dur, 0.045, d, { a: 0.25, lp: 1400 }); },
  bass(t, f, dur, d) { I.osc('square', f, t, dur, 0.22, d, { lp: 500, lpEnd: 220 }); },
  lead(t, f, dur, d, v = 0.11) { I.osc('square', f, t, dur, v, d, { lp: 2600, vib: 5.5, a: 0.02 }); },
};

const STATIONS = [
  { name: 'O\'zbek Navolari', bpm: 108, play(st, t, spb, d) {
    const s = st % 16, bar = Math.floor(st / 16);
    if (s === 0 || s === 6 || s === 10) I.dum(t, d);
    if (s === 3 || s === 8 || s === 12 || s === 14) I.tak(t, d);
    if (s === 4 || s === 12) I.ring(t, d);
    if (s === 0 || s === 8) I.pluck(t, midi(50), d, 0.15);
    if (s === 4 || s === 12) I.pluck(t, midi(57), d, 0.09);
    const pi = Math.floor(bar / 2), seed = (pi % 4 === 2 ? 900 : 300) + Math.floor(bar / 8) * 37;
    const deg = phrase('uz' + seed, seed, 32, HIJAZ.length, [0, 2, 3, 4, 6, 8, 10, 11, 12, 14])[st % 32];
    if (deg >= 0) {
      const f = midi(62 + HIJAZ[deg]);
      I.pluck(t, f, d, 0.2);
      if (pi % 2) I.osc('sine', f * 2, t, spb * 1.8, 0.06, d, { vib: 5, a: 0.03 }); // nay
    }
  } },
  { name: 'Toshkent FM', bpm: 120, play(st, t, spb, d) {
    const s = st % 16, bar = Math.floor(st / 16), ch = [[57, 60, 64], [53, 57, 60], [48, 55, 60], [55, 59, 62]][bar % 4];
    if (s === 0) I.pad(t, ch.map(midi), spb * 15, d);
    if (s % 4 === 0) I.kick(t, d);
    if (s === 4 || s === 12) I.snare(t, d);
    if (s % 2 === 0) I.hat(t, d, s === 14);
    if (s === 0 || s === 6 || s === 8 || s === 14) I.bass(t, midi(ch[0] - 24 + (s === 8 ? 12 : 0)), spb * 1.6, d);
    const seed = 500 + (Math.floor(bar / 4) % 3) * 17;
    const deg = phrase('pop' + seed, seed, 64, PENTA.length, [0, 3, 6, 8, 10, 12, 14])[st % 64];
    if (deg >= 0 && bar % 8 >= 2) I.lead(t, midi(57 + PENTA[deg]), spb * 2.5, d);
  } },
  { name: 'Shahar Ritmi', bpm: 90, play(st, t, spb, d) {
    const s = st % 16, bar = Math.floor(st / 16), r = [45, 45, 41, 43][bar % 4], sw = s % 2 ? spb * 0.18 : 0;
    if (s === 0 || s === 7 || s === 10) { I.kick(t, d); I.osc('sine', midi(r), t, spb * 3, 0.45, d, { glide: midi(r) * 0.85 }); }
    if (s === 4 || s === 12) I.snare(t, d);
    if (s % 2 === 0 || (s === 15 && bar % 2)) I.hat(t + sw, d, false);
    const k = [2, 6, 11].indexOf(s);
    if (k >= 0 && bar % 2 === 1) I.pluck(t, midi(r + 12 + [0, 3, 7][k]), d, 0.13);
  } },
];

const Radio = {
  idx: 0, step: 0, next: 0, bus: null,
  ensure() {
    if (this.bus) return true;
    if (!SFX.ctx) return false;
    const c = SFX.ctx;
    this.bus = c.createGain(); this.bus.gain.value = 0;
    const tone = c.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 7000;
    this.bus.connect(tone).connect(SFX.out);
    const send = c.createGain(); send.gain.value = 0.15;
    this.bus.connect(send).connect(SFX.verbIn);
    return true;
  },
  current() { return this.idx < STATIONS.length ? STATIONS[this.idx] : null; },
  announce() { HUD.help(this.current() ? `Radio: <b>${this.current().name}</b> · <kbd>R</kbd> — almashtirish` : 'Radio o\'chiq · <kbd>R</kbd> — yoqish', 2.5); },
  cycle() { this.idx = (this.idx + 1) % (STATIONS.length + 1); this.step = 0; this.next = 0; this.announce(); },
  silence() { if (this.bus) this.bus.gain.setTargetAtTime(0, SFX.ctx.currentTime, 0.05); this.next = 0; },
  update(active) {
    if (!this.ensure()) return;
    const st = this.current();
    if (!active || !st) { this.silence(); return; }
    const c = SFX.ctx, spb = 60 / st.bpm / 4;
    this.bus.gain.setTargetAtTime(0.75 * Settings.v.music, c.currentTime, 0.3);
    if (this.next < c.currentTime) this.next = c.currentTime + 0.05;
    while (this.next < c.currentTime + 0.25) { st.play(this.step, this.next, spb, this.bus); this.step++; this.next += spb; }
  },
};
