"""旁白（voice/NN.wav 按 timeline 摆位）+ 配乐（旁白处自动压低 8dB）+ 音效 → mix.wav
用法: .venv/bin/python mix.py
响度在 finalize.sh 里统一做 loudnorm 到 -14 LUFS。
"""
import json, numpy as np
from scipy.io import wavfile
from scipy.signal import resample_poly
SR = 48000
TL = json.load(open('timeline.json'))
N = int((TL['total'] + .5) * SR)
def load(p):
    sr, x = wavfile.read(p); dt = x.dtype; x = x.astype(np.float64)
    if dt == np.int16: x /= 32768.0
    elif dt == np.int32: x /= 2147483648.0
    if x.ndim == 1: x = np.stack([x, x], 1)
    if sr != SR: x = np.stack([resample_poly(x[:, c], SR, sr) for c in range(2)], 1)
    return x
voice = np.zeros((N, 2))
for i, l in enumerate(TL['lines']):
    seg = load(f'voice/{i:02d}.wav'); s = int((l['start'] - .04) * SR); seg = seg[:N - s]
    voice[s:s + len(seg)] += seg
def fit(x, n): return np.pad(x, ((0, max(0, n - len(x))), (0, 0)))[:n]
music, sfx = fit(load('music.wav'), N), fit(load('sfx.wav'), N)
e = np.abs(voice).mean(1); win = int(.05 * SR); e = np.convolve(e, np.ones(win) / win, 'same')
act = (e > .01).astype(float); k = int(.6 * SR); act = np.convolve(act, np.ones(k) / k, 'same'); act = np.clip(act * 2, 0, 1)
duck = 1 - act * (1 - 10 ** (-8 / 20))
db = lambda v: 10 ** (v / 20)
out = voice / np.abs(voice).max() * db(-3) + music * duck[:, None] * db(-17) + sfx * db(-15)
out /= max(1, np.abs(out).max() / .97)
wavfile.write('mix.wav', SR, out.astype(np.float32)); print('ok', round(N / SR, 1))
