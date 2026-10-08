'use strict';
// ===== Uzatmalar qutisi: har uzatmaning eng yuqori tezligi (mashina eng yuqori tezligidan ulush) va tortish kuchi.
// O'yinchi mashinasida selektor bor: avtomatda P R N D, mexanikada R N 1…5(6). Gaz faqat gaz, tormoz faqat tormoz —
// oldinga yoki orqaga yurish selektorga bog'liq. Boshqa mashinalar (AI) doim avtomatda, eski boshqaruv bilan.
// Kuchlar shunday tanlanganki, avtomatda tezlanish oldingi (uzatmasiz) holat bilan deyarli bir xil.
// Oxirgi uzatma eng yuqori tezlikda cheklovchigacha yetmaydi (havo qarshiligi to'xtatadi) — ovoz "uzilmaydi"
const GEAR_SETS = {
  5: { top: [0.24, 0.42, 0.6, 0.8, 1.1], pull: [1.35, 1.1, 0.92, 0.8, 0.7] },
  6: { top: [0.2, 0.35, 0.5, 0.66, 0.83, 1.1], pull: [1.4, 1.18, 1.02, 0.9, 0.8, 0.7] },
};
const REV_MAX = 13; // orqaga eng yuqori tezlik (m/s)
// Dvigatel kuchi aylanishga qarab: pastda biroz sust, o'rtada to'liq, cheklovchiga yaqinlashganda yo'qoladi
const engineTorque = r => (r < 0.3 ? 0.82 + 0.6 * r : r > 0.92 ? Math.max(0, (1.04 - r) / 0.12) : 1);
const gearSet = c => GEAR_SETS[c.T.gears] || GEAR_SETS[5];
const manualBox = c => c.driver === 'player' && Settings.v.gearbox === 'manual';
// sel: P / R / N / D (mexanikada D — oldinga, raqami g da)
const gearState = c => c.gb || (c.gb = { g: 1, sel: 'D', shiftT: 0, rpm: 0.1 });

// Har kadr (Car.physics): uzatmani tanlaydi, dvigatel aylanishini (rpm: 0.1 salt … 1 eng yuqori) hisoblaydi
// va tortish ko'paytuvchisini qaytaradi (N, P va almashtirish paytida — 0). thr — gaz (0…1)
function gearDrive(c, vF, maxS, thr, dt) {
  const G = gearSet(c), S = gearState(c), n = G.top.length, sel = c.pedals ? S.sel : 'D';
  if (S.g > n) S.g = n;
  S.shiftT = Math.max(0, S.shiftT - dt);
  // Neytral va "Park": g'ildiraklarga uzatilmaydi, gaz faqat dvigatelni aylantiradi
  if (sel === 'N' || sel === 'P') { S.rpm = 0.1 + 0.85 * thr; return 0; }
  if (sel === 'R') {
    const r = Math.max(0, -vF) / REV_MAX;
    S.rpm = Math.max(0.1 + 0.9 * clamp(r, 0, 1.05), thr > 0 && r < 0.4 ? 0.28 + 0.3 * thr : 0);
    return S.shiftT > 0 ? 0 : 1.25 * engineTorque(r);
  }
  const v = Math.max(0, vF), ratio = g => v / (maxS * G.top[g - 1]);
  if (!manualBox(c)) {
    if (vF < 0.5) S.g = 1;
    else if (S.shiftT <= 0 && S.g < n && ratio(S.g) > (thr > 0.6 ? 0.9 : 0.62)) { S.g++; S.shiftT = 0.18; }
    // Pastga: aylanish tushib ketganda yoki gaz oxirigacha bosilsa (kickdown)
    else if (S.g > 1 && (ratio(S.g) < 0.3 || (thr > 0.9 && ratio(S.g) < 0.55 && ratio(S.g - 1) < 0.82))) { S.g--; S.shiftT = Math.max(S.shiftT, 0.1); }
  }
  const r = ratio(S.g);
  let rpm = 0.1 + 0.9 * clamp(r, 0, 1.08);
  // Joyidan qo'zg'alayotganda ilashish (mufta) sirpanadi — dvigatel baland aylanadi
  if (thr > 0 && S.g <= 2 && v < maxS * G.top[0] * 0.5) rpm = Math.max(rpm, 0.28 + 0.32 * thr);
  S.rpm = rpm;
  return S.shiftT > 0 ? 0 : G.pull[S.g - 1] * engineTorque(r);
}

// Selektor holatlari: avtomatda P R N D, mexanikada R N 1 … n
function gearOptions(c) {
  if (!manualBox(c)) return ['P', 'R', 'N', 'D'];
  return ['R', 'N', ...gearSet(c).top.map((_, i) => String(i + 1))];
}
// Joriy holat (selektordagi belgi)
function gearSel(c) {
  const S = gearState(c);
  if (S.sel !== 'D') return S.sel;
  return manualBox(c) ? String(S.g) : 'D';
}
// Selektorni o'tkazish. Harakatlanayotganda P va teskari yo'nalishga o'tib bo'lmaydi (haqiqiy mashinadagidek)
function selectGear(c, opt) {
  const S = gearState(c), cur = gearSel(c), v = c.fwd;
  if (opt === cur) return;
  const deny = msg => { SFX.click(); HUD.help(msg, 1.4); };
  if (opt === 'P' && Math.abs(v) > 1) return deny('Avval to\'xtang, keyin P ga o\'tkazing');
  if (opt === 'R' && v > 1.5) return deny('Oldinga yurib turibsiz — avval to\'xtang, keyin R');
  const fwdGear = opt === 'D' || /^\d$/.test(opt);
  if (fwdGear && v < -1.5) return deny('Orqaga yurib turibsiz — avval to\'xtang');
  if (/^\d$/.test(opt)) {
    const g = +opt, G = gearSet(c);
    // Dvigatelni haddan tashqari aylantiradigan pastga o'tish rad etiladi
    if (S.sel === 'D' && g < S.g && Math.max(0, v) / (c.T.max * G.top[g - 1]) > 1.06) return deny('Bu tezlikda pastroq uzatmaga o\'tib bo\'lmaydi');
    S.g = g; S.sel = 'D';
  } else {
    S.sel = opt;
    if (opt === 'D' && !manualBox(c)) S.g = 1;
  }
  S.shiftT = 0.15;
  SFX.gear();
}
// Q / E (geympadda LB / RB, telefonda selektor): ro'yxat bo'ylab bir pog'ona
function shiftStep(c, d) {
  const L = gearOptions(c), i = L.indexOf(gearSel(c));
  const j = clamp((i < 0 ? L.length - 1 : i) + d, 0, L.length - 1);
  if (L[j] !== gearSel(c)) selectGear(c, L[j]);
}
// Mashinaga o'tirganda — harakatga tayyor (avtomatda D, mexanikada 1), tushganda — P
function gearOnEnter(c) {
  const S = gearState(c);
  c.pedals = true; c.brk = 0; S.sel = 'D'; S.g = 1; S.shiftT = 0;
}
function gearOnExit(c) {
  const S = gearState(c);
  c.pedals = false; c.brk = 0; S.sel = 'P';
}
// Ko'rsatkich: avtomatda P / R / N / D3, mexanikada R / N / raqam
function gearLabel(c) {
  const S = gearState(c);
  if (!c.pedals) return c.fwd < -0.5 ? 'R' : 'D' + S.g;
  const s = gearSel(c);
  return s === 'D' ? 'D' + S.g : s;
}
// Maslahat: tormozni bosib turib orqaga yurmoqchi — R kerak; N yoki P da gaz bosilsa — D kerak (har biri 3 martagacha)
const _gh = { key: null, t: 0, n: {} };
function gearHints(c, gas, brk, dt) {
  const sel = gearState(c).sel, slow = Math.abs(c.fwd) < 0.4;
  const key = slow && brk > 0 && !gas && sel === 'D' ? 'rev' : gas > 0 && (sel === 'N' || sel === 'P') ? 'drive' : null;
  _gh.t = key && key === _gh.key ? _gh.t + dt : 0; _gh.key = key;
  if (!key || _gh.t < (key === 'rev' ? 1.3 : 0.6) || (_gh.n[key] || 0) >= 3) return;
  _gh.n[key] = (_gh.n[key] || 0) + 1; _gh.t = -99;
  const L = gearOptions(c), steps = Math.abs(L.indexOf(gearSel(c)) - L.indexOf(key === 'rev' ? 'R' : manualBox(c) ? '1' : 'D'));
  const how = Input.touch ? 'pedallar yonidagi selektordan' : `<kbd>${key === 'rev' ? 'Q' : 'E'}</kbd>${steps > 1 ? ' ni ' + steps + ' marta bosing' : ' bilan'}`;
  HUD.help(key === 'rev' ? `Orqaga yurish uchun uzatmani <b>R</b> ga o'tkazing (${how}), keyin gazni bosing` : `Uzatma <b>${sel}</b> da — yurish uchun <b>D</b> ga o'tkazing (${how})`, 3.5);
}
// Mashinada Q / E — uzatma, shuning uchun kamera ular bilan burilmaydi (sichqoncha bilan buriladi)
const camKeysFree = () => !(Player.inCar && !Player.passenger);
