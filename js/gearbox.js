'use strict';
// ===== Uzatmalar qutisi: har uzatmaning eng yuqori tezligi (mashina eng yuqori tezligidan ulush) va tortish kuchi.
// Avtomat — o'zi almashtiradi (boshqa mashinalarda doim), mexanika — o'yinchi E (yuqori) va Q (past) bilan.
// Kuchlar shunday tanlanganki, avtomatda tezlanish oldingi (uzatmasiz) holat bilan deyarli bir xil.
// Oxirgi uzatma eng yuqori tezlikda cheklovchigacha yetmaydi (havo qarshiligi to'xtatadi) — ovoz "uzilmaydi"
const GEAR_SETS = {
  5: { top: [0.24, 0.42, 0.6, 0.8, 1.1], pull: [1.35, 1.1, 0.92, 0.8, 0.7] },
  6: { top: [0.2, 0.35, 0.5, 0.66, 0.83, 1.1], pull: [1.4, 1.18, 1.02, 0.9, 0.8, 0.7] },
};
// Dvigatel kuchi aylanishga qarab: pastda biroz sust, o'rtada to'liq, cheklovchiga yaqinlashganda yo'qoladi
const engineTorque = r => (r < 0.3 ? 0.82 + 0.6 * r : r > 0.92 ? Math.max(0, (1.04 - r) / 0.12) : 1);
const gearSet = c => GEAR_SETS[c.T.gears] || GEAR_SETS[5];
const manualBox = c => c.driver === 'player' && Settings.v.gearbox === 'manual';
const gearState = c => c.gb || (c.gb = { g: 1, shiftT: 0, rpm: 0.1 });

// Har kadr (Car.physics): uzatmani tanlaydi, dvigatel aylanishini (rpm: 0.1 salt … 1 eng yuqori) hisoblaydi
// va oldinga tortish ko'paytuvchisini qaytaradi (almashtirish paytida — 0)
function gearDrive(c, vF, maxS, thr, dt) {
  const G = gearSet(c), S = gearState(c), n = G.top.length, v = Math.max(0, vF);
  if (S.g > n) S.g = n;
  S.shiftT = Math.max(0, S.shiftT - dt);
  const ratio = g => v / (maxS * G.top[g - 1]);
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
// Mexanikada qo'lda almashtirish (d: +1 yuqori, −1 past). Dvigatelni haddan tashqari aylantiradigan pastga o'tish rad etiladi
function shiftGear(c, d) {
  const G = gearSet(c), S = gearState(c), g = clamp(S.g + d, 1, G.top.length);
  if (g === S.g) return;
  if (d < 0 && Math.max(0, c.fwd) / (c.T.max * G.top[g - 1]) > 1.06) { SFX.click(); HUD.help('Bu tezlikda pastroq uzatmaga o\'tib bo\'lmaydi', 1.2); return; }
  S.g = g; S.shiftT = 0.12;
  SFX.gear();
}
// Ko'rsatkich: R — orqaga, mexanikada raqam, avtomatda D va raqam
function gearLabel(c) {
  if (c.fwd < -0.5) return 'R';
  const S = gearState(c);
  return manualBox(c) ? String(S.g) : 'D' + S.g;
}
// Mexanikada kamera Q/E bilan burilmaydi (bu tugmalar uzatma uchun)
const camKeysFree = () => !(Player.inCar && !Player.passenger && Settings.v.gearbox === 'manual');
