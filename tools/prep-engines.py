#!/usr/bin/env python3
"""Ko'cha Qiroli — dvigatel ovozlari: haqiqiy yozuvlardan (Freesound, CC0) aylanish tezligi (RPM) qatlamlarini
tayyorlaydi va sounds/engines.js ga yozadi.

Har bir qatlam — bir xil ohangdagi (doimiy RPM) qisqa halqa. O'yinda joriy RPM ga eng yaqin ikki qatlam
ohangi moslab (playbackRate) aralashtiriladi — haqiqiy poyga o'yinlaridagi usul.
Tezlanayotgan yoki sekinlayotgan bo'lakdan olingan qatlamning ohangi dvigatel sikllari bo'yicha
tekislanadi (har bir sikl bir xil uzunlikka keltiriladi), so'ng butun sikllar soni bilan halqa qilinadi.

Ishlatish: python3 tools/prep-engines.py   (macOS afconvert va `pip3 install --user lameenc numpy` kerak)
"""
import base64, io, json, os, subprocess, sys, urllib.request, wave
import numpy as np
import lameenc

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'tools', 'engine-src')
RATE = 22050
HEAD = 2048  # halqa boshidan keyin qo'shiladigan namuna: o'yin MP3 kechikishini shu bo'yicha topadi

# Manbalar (hammasi CC0, Freesound)
SOURCES = {
    'renault': ('https://cdn.freesound.org/previews/141/141240_581937-hq.mp3', 'lovretta — Renault 19 underhood acceleration (1.4 benzinli, 4 silindr)'),
    'musidle': ('https://cdn.freesound.org/previews/535/535038_11894201-hq.mp3', 'FreeCarSoundsGaming — Muscle_Idle (V8)'),
    'busidle': ('https://cdn.freesound.org/previews/54/54909_71257-hq.mp3', 'qubodup — Bus Motor/Engine Sound Loop'),
    'buslow': ('https://cdn.freesound.org/previews/803/803767_10594370-hq.mp3', 'Mihacappy — buslow2 (MAN/Solaris avtobusi)'),
}

# Qatlamlar: nom, manba, bo'lak (s), sikl chastotasi ko'paytuvchisi (kuzatuvchi yarim ohangni olgan joyda 2),
# maqsad chastota (Hz, None — bo'lakdagi o'rtacha), halqa uzunligi (s)
# Benzinli 4 silindrda o't olish chastotasi = RPM / 30
LAYERS = [
    ('p0', 'renault', 27.2, 30.0, 1, None, 2.0),     # salt yurish ~760 RPM
    ('p1', 'renault', 9.7, 10.5, 1, 51.7, 1.2),      # 1550 RPM (gaz qo'yib yuborilgan, sekinlashayotgan bo'lakdan tekislangan)
    ('p2', 'renault', 60.5, 66.3, 1, None, 2.0),     # ~2550 RPM, bir tekis
    ('p3', 'renault', 52.6, 55.6, 1, None, 1.8),     # ~3550 RPM, bir tekis
    ('p4', 'renault', 45.6, 47.1, 1, 150.0, 1.2),    # 4500 RPM (to'liq gazda tezlanishdan)
    ('p5', 'renault', 47.6, 49.4, 1, 183.0, 1.4),    # 5500 RPM (to'liq gazda tezlanishdan)
    ('p6', 'renault', 15.3, 16.1, 1, 207.0, 0.9),    # 6200 RPM (eng yuqori)
    ('v0', 'musidle', 0.0, 2.17, 1, None, 1.6),       # V8 salt yurish
    ('b0', 'busidle', 1.0, 11.0, 1, None, 2.0),       # avtobus salt yurish
    ('b1', 'buslow', 0.0, 1.70, 1, None, 1.3),        # avtobus past aylanishda yurib ketmoqda
]
TRACK = {'renault': (12, 240), 'musidle': (20, 200), 'busidle': (8, 120), 'buslow': (8, 160)}


def fetch(name):
    os.makedirs(SRC, exist_ok=True)
    mp3, wav = os.path.join(SRC, name + '.mp3'), os.path.join(SRC, name + '.wav')
    if not os.path.exists(wav):
        if not os.path.exists(mp3):
            req = urllib.request.Request(SOURCES[name][0], headers={'User-Agent': 'Mozilla/5.0'})
            open(mp3, 'wb').write(urllib.request.urlopen(req, timeout=120).read())
        subprocess.check_call(['afconvert', '-f', 'WAVE', '-d', 'LEI16@%d' % RATE, '-c', '1', mp3, wav])
    w = wave.open(wav)
    return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768


def track(x, fmin, fmax, win=4096, hop=256, H=8, jump=0.04):
    """Dvigatel sikl chastotasini vaqt bo'yicha kuzatish: garmonikalar taroq'i + Viterbi (silliq yo'l)."""
    N = 1 << 14
    nfr = 1 + (len(x) - win) // hop
    w = np.hanning(win)
    cands = np.exp(np.linspace(np.log(fmin), np.log(fmax), 400))
    bins = np.arange(N // 2 + 1) * RATE / N
    S = np.zeros((nfr, len(cands)))
    for t in range(nfr):
        X = np.abs(np.fft.rfft(x[t * hop:t * hop + win] * w, N))
        L = np.log1p(X / (X.mean() + 1e-9))
        for h in range(1, H + 1):
            S[t] += np.interp(cands * h, bins, L) / h ** 0.3
            S[t] -= 0.6 * np.interp(cands * (h - 0.5), bins, L) / h ** 0.3
    lc = np.log(cands)
    trans = -np.maximum(0, np.abs(lc[:, None] - lc[None, :]) - jump) * 60
    V = S[0].copy(); back = np.zeros((nfr, len(cands)), dtype=np.int32)
    for t in range(1, nfr):
        M = V[None, :] + trans
        back[t] = np.argmax(M, axis=1)
        V = M[np.arange(len(cands)), back[t]] + S[t]
    path = np.zeros(nfr, dtype=np.int32); path[-1] = np.argmax(V)
    for t in range(nfr - 1, 0, -1): path[t - 1] = back[t, path[t]]
    return (np.arange(nfr) * hop + win / 2) / RATE, cands[path]


def true_firing(x, t, f):
    """Kuzatuvchi ba'zan yarim ohangni (dvigatel aylanishi) oladi: 2f kuchliroq bo'lsa — haqiqiy o't olish chastotasi 2f."""
    win, N = 4096, 1 << 15
    fr = np.fft.rfftfreq(N, 1 / RATE)
    out = f.copy()
    for i in range(len(t)):
        c = int(t[i] * RATE); seg = x[max(0, c - win // 2):c + win // 2]
        if len(seg) < win: continue
        X = np.abs(np.fft.rfft(seg * np.hanning(win), N))
        lv = lambda q: X[(fr > q * 0.95) & (fr < q * 1.05)].max()
        if 20 * np.log10(lv(f[i]) / lv(2 * f[i])) < -6: out[i] = 2 * f[i]
    return out


def smooth(f, k=9):
    pad = np.pad(f, k // 2, mode='edge')
    return np.array([np.median(pad[i:i + k]) for i in range(len(f))])


def make_layer(x, t, f, a, b, mult, target, dur):
    """Bo'lakni doimiy ohangga keltirib, butun sikllar sonidan iborat silliq halqa qiladi."""
    i0, i1 = int(a * RATE), int(b * RATE)
    seg = x[i0:i1]
    ts = (np.arange(len(seg)) + i0) / RATE
    fs = np.interp(ts, t, smooth(f)) * mult
    F = target or float(np.median(fs))
    phase = np.cumsum(fs) / RATE                      # bosib o'tilgan sikllar
    total = phase[-1]
    fade = max(4, int(round(0.06 * F)))               # chegarani silliqlash uchun ~60 ms
    K = int(min(round(dur * F), total - fade - 2))
    start = (total - K - fade) / 2                    # bo'lak o'rtasidan
    n_out = int(round((K + fade) / F * RATE))
    ph_out = start + np.arange(n_out) * F / RATE
    t_in = np.interp(ph_out, phase, np.arange(len(seg)))
    y = np.interp(t_in, np.arange(len(seg)), seg)
    L = int(round(K / F * RATE))                      # halqa uzunligi (namuna)
    X = n_out - L
    ramp = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, X))
    loop = y[:L].copy()
    loop[:X] = y[:X] * ramp + y[L:L + X] * (1 - ramp)  # oxiri boshiga uzluksiz o'tadi
    # Past shovqinni olib tashlash (25 Hz) va bir xil balandlik (RMS −18 dB)
    spec = np.fft.rfft(loop); fr = np.fft.rfftfreq(len(loop), 1 / RATE)
    spec[fr < 25] = 0; spec[fr > 9000] *= 0.3
    loop = np.fft.irfft(spec, len(loop))
    loop *= 10 ** (-18 / 20) / (np.sqrt((loop ** 2).mean()) + 1e-9)
    loop = np.clip(loop, -0.98, 0.98)
    return loop, F, total


def mp3(loop):
    pcm = np.concatenate([loop, loop[:HEAD]])
    enc = lameenc.Encoder()
    enc.set_bit_rate(56); enc.set_in_sample_rate(RATE); enc.set_channels(1); enc.set_quality(2)
    data = enc.encode((pcm * 32767).astype(np.int16).tobytes()) + enc.flush()
    return bytes(data)


def main():
    cache = {}
    out = {}
    for name, src, a, b, mult, target, dur in LAYERS:
        if src not in cache:
            x = fetch(src)
            t, f = track(x, *TRACK[src])
            cache[src] = (x, t, true_firing(x, t, f) if src == 'renault' else f)
        x, t, f = cache[src]
        loop, F, total = make_layer(x, t, f, a, b, mult, target, dur)
        data = mp3(loop)
        out[name] = {'hz': round(F, 2), 'n': len(loop), 'rate': RATE, 'data': base64.b64encode(data).decode()}
        print('%-3s %-8s %5.1f-%5.1f s  %6.1f Hz  halqa %.2f s  (%d sikl bor)  mp3 %d KB' % (name, src, a, b, F, len(loop) / RATE, total, len(data) // 1024))
    credits = '; '.join(v[1] for v in SOURCES.values())
    js = ('// Dvigatel ovozlari: haqiqiy yozuvlardan RPM qatlamlari (tools/prep-engines.py yaratadi, qo\'lda o\'zgartirmang).\n'
          '// Manbalar (Freesound, CC0): ' + credits + '\n'
          '// hz — qatlamning sikl chastotasi, n — halqa uzunligi (namuna, rate Hz da). MP3 oxirida halqa boshi takrorlangan.\n'
          'window.ENGINE_SOUNDS = ' + json.dumps(out, separators=(',', ':')) + ';\n')
    path = os.path.join(ROOT, 'sounds', 'engines.js')
    open(path, 'w').write(js)
    print('sounds/engines.js — %d KB' % (len(js) // 1024))


if __name__ == '__main__':
    main()
