'use strict';
// ===== Kompyuterda klaviatura ko'rsatmasi: o'ng tomonda, holatga qarab (piyoda / mashinada). I — yashirish/ko'rsatish =====
const KeyHints = {
  el: null, _k: null,
  init() {
    this.el = document.getElementById('keyHint');
    // Bosh menyuda ham tugmalar ro'yxati (faqat kompyuterda)
    const mk = document.getElementById('menuKeys');
    if (mk && !Input.touch) {
      const K = s => s.split(' ').map(x => `<kbd>${x}</kbd>`).join(' ');
      mk.innerHTML = '<dl class="keys">' + [
        [K('W A S D'), 'yurish / haydash'], ['Sichqoncha', 'kamera'], [K('Shift'), 'yugurish'], [K('Probel'), 'sakrash / qo\'l tormozi'],
        [K('F'), 'o\'tirish / tushish'], ['Chap tugma', 'urish / otish'], ['O\'ng tugma', 'nishon'], [K('1–5'), 'qurol'],
        [K('Z C'), 'burilish chirog\'i'], [K('X'), 'avariya chirog\'i'], [K('H'), 'signal'], [K('B'), 'yoqilg\'i quyish'], [K('L'), 'faralar'], [K('V'), 'ichidan ko\'rish'], [K('R'), 'radio'],
        [K('G'), 'sirena'], [K('N'), 'nitro'], [K('T'), 'taksi / avtobus ishi'], [K('M'), 'xarita'],
        [K('O'), 'ob-havo'], [K('Q E'), 'kamera / mashinada uzatma'], [K('I'), 'ko\'rsatma'], [K('P'), 'pauza'],
      ].map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('') + '</dl>';
      mk.hidden = false;
    }
  },
  on() { return !Input.touch && Settings.v.keyHints !== false; },
  toggle() {
    Settings.v.keyHints = !this.on(); Save.soon();
    HUD.help(Settings.v.keyHints ? 'Tugmalar ko\'rsatmasi yoqildi' : 'Tugmalar ko\'rsatmasi yashirildi. <kbd>I</kbd> — qayta ko\'rsatish', 2.5);
    this._k = null;
  },
  rows() {
    const P = Player, c = P.inCar, k = (keys, text) => [keys.map(x => `<kbd>${x}</kbd>`).join(' '), text];
    if (c && P.passenger) return [k(['F'], 'tushish'), k(['M'], 'xarita'), k(['P'], 'pauza')];
    if (c) {
      const out = [k(['W', 'S'], 'gaz / tormoz'), k(['A', 'D'], 'rul'), k(['Probel'], 'qo\'l tormozi'), k(['F'], 'tushish'),
        k(['Z', 'C'], 'burilish chirog\'i'), k(['X'], 'avariya chirog\'i'), k(['H'], 'signal'), k(['B'], 'yoqilg\'i (zapravkada)'), k(['L'], 'faralar'), k(['V'], 'ichidan ko\'rish'), k(['R'], 'radio')];
      out.splice(2, 0, k(['E', 'Q'], Settings.v.gearbox === 'manual' ? 'uzatma yuqori / past (R N 1…5)' : 'uzatma: D tomon / R tomon'));
      if (c.mods && c.mods.nitro) out.push(k(['N'], 'nitro'));
      if (c.type === 'police') out.push(k(['G'], 'sirena'));
      if (c.type === 'taxi') out.push(k(['T'], 'taksi ishi'));
      if (c.type === 'bus') out.push(k(['T'], 'avtobus ishi'));
      out.push(k(['M'], 'xarita'), k(['P'], 'pauza'));
      return out;
    }
    const gun = !WEAPONS[P.weapon].melee;
    return [k(['W', 'A', 'S', 'D'], 'yurish'), k(['Shift'], 'yugurish'), k(['Probel'], 'sakrash'), k(['F'], 'mashinaga o\'tirish'),
      ['Chap tugma', gun ? 'otish' : 'urish'], ...(gun ? [['O\'ng tugma', 'nishon']] : []), k(['1–5'], 'qurol tanlash'),
      k(['Q', 'E'], 'kamera'), k(['M'], 'xarita'), k(['P'], 'pauza')];
  },
  update() {
    if (!this.el) return;
    const on = this.on() && !Player.dead, P = Player, c = P.inCar;
    const key = on ? [c ? c.type : '', P.passenger ? 1 : 0, c && c.mods && c.mods.nitro ? 1 : 0, P.weapon, Settings.v.gearbox].join('|') : 'off';
    if (key === this._k) return;
    this._k = key;
    this.el.hidden = !on;
    if (!on) return;
    this.el.innerHTML = this.rows().map(([a, b]) => `<span>${a}</span><span>${b}</span>`).join('') + '<span class="kh-foot"><kbd>I</kbd> — yashirish</span>';
  },
};
