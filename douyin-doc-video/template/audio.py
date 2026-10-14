"""配乐 + 环境音效，全部程序合成，按 timeline.json 对齐 → music.wav, sfx.wav（48kHz 立体声 float）
用法: .venv/bin/python audio.py
音乐按章节分段（序章 = 开头到 CH1，第 n 段 = CHn 到下一章），每段的情绪在 sound_plan.MOODS 里指定：
  dark  小调长音铺底 + 稀疏钢琴动机（压抑、叙述）
  pulse 长音 + 72bpm 心跳式底鼓 + 八分音符琶音（共鸣、紧迫）
  drone 收缩为一个长音 + 稀疏低音（反思、代价）
  warm  大调长音 + 旋律（转暖、出路、余韵）
环境音和点状音效在 sound_plan.BEDS / sound_plan.events() 里按镜头写。可用的音色见下方 FX。
"""
import json, re, numpy as np
from scipy.signal import fftconvolve, butter, sosfilt
from scipy.io import wavfile
import sound_plan as P

SR = 48000
TL = json.load(open('timeline.json'))
T = TL['total'] + 1.0
N = int(T * SR)
rng = np.random.default_rng(7)
sh = TL['shots']
cues = {k: [l['start'] for l in TL['lines'] if l['shot'] == k] for k in sh}

def tt(n): return np.arange(n) / SR
def lp(x, f, o=2): return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)
def bp(x, a, b, o=2): return sosfilt(butter(o, [a, b], 'band', fs=SR, output='sos'), x)
def env_adsr(n, a=.01, r=.3):
    e = np.ones(n); na, nr = int(a * SR), int(r * SR)
    e[:na] = np.linspace(0, 1, na); e[-nr:] *= np.linspace(1, 0, nr); return e
def place(buf, x, t0, g=1.0, pan=0.0):
    i = int(t0 * SR)
    if i >= N or i + len(x) <= 0: return
    x = x[:N - i] if i >= 0 else x[-i:]
    i = max(i, 0)
    l, r = np.sqrt(.5 * (1 - pan)), np.sqrt(.5 * (1 + pan))
    buf[i:i + len(x), 0] += x * g * l * 1.414; buf[i:i + len(x), 1] += x * g * r * 1.414
def note(m): return 440 * 2 ** ((m - 69) / 12)
def reverb(x, sec=3.2, wet=.35):
    n = int(sec * SR); ir = rng.standard_normal(n) * np.exp(-np.linspace(0, 7, n)); ir = lp(ir, 6000); ir /= np.sqrt((ir ** 2).sum())
    out = np.zeros_like(x)
    for c in range(2): out[:, c] = x[:, c] * (1 - wet) + fftconvolve(x[:, c], ir * (1 if c else .97))[:len(x)] * wet * 2.2
    return out

# ———————— 音乐 ————————
music = np.zeros((N, 2))
def pad(freqs, t0, dur, g=.05, bright=1200):
    n = int(dur * SR); t = tt(n); x = np.zeros(n)
    for f in freqs:
        for k, a in [(1, 1), (2, .35), (3, .15), (4, .07)]:
            for det in (-.12, .12):
                x += a * np.sin(2 * np.pi * f * k * (1 + det / 1200 * 10) * t + rng.uniform(0, 6))
    x = lp(x, bright) * env_adsr(n, min(2.5, dur / 3), min(3, dur / 3))
    place(music, x / len(freqs), t0, g)
def piano(m, t0, g=.12, dec=2.8, pan=0.0):
    f = note(m); n = int(4.5 * SR); t = tt(n); x = np.zeros(n)
    for k, a in [(1, 1), (2, .45), (3, .22), (4, .12), (5, .06)]:
        fk = f * k * np.sqrt(1 + .0004 * k * k)
        x += a * np.sin(2 * np.pi * fk * t) * np.exp(-t * (1.2 + k * .9) / dec * 2.2)
    x *= np.minimum(1, t / .004); x = lp(x, 5000)
    place(music, x, t0, g, pan)
def pads(chords, a, b, g, bright):
    t, k = a + .3, 0
    while t < b - 1:
        pad([note(m) for m in chords[k % len(chords)]], t, min(8.5, b - t + 1.5), g, bright); t += 8; k += 1

def sec_dark(a, b):
    pads([[38, 45, 53], [36, 43, 52], [34, 41, 50], [33, 45, 52]], a, b, .045, 900)      # Dm C/Am Bb A
    motif, t, k = [62, 65, 69, 67, 65, 64], a + 2, 0
    while t < b - 2: piano(motif[k % 6], t, .07, pan=(-.3 if k % 2 else .3)); t += 2.6 + (k % 3) * .6; k += 1
def sec_pulse(a, b):
    pads([[38, 45, 53], [34, 41, 50], [36, 43, 52], [33, 40, 49]], a, b, .05, 1300)
    beat, t = 60 / 72, a + 1.5
    while t < b - .5:
        n = int(.35 * SR); q = tt(n); kick = np.sin(2 * np.pi * (55 * np.exp(-q * 9) + 38) * q) * np.exp(-q * 11)
        place(music, kick, t, .16); place(music, kick, t + .22, .08); t += beat
    arp, t, k = [62, 69, 65, 69, 62, 69, 65, 72], a + 4, 0
    while t < b - 1: piano(arp[k % 8] - (0 if (k // 16) % 2 == 0 else 3), t, .035, dec=1.2, pan=.4 * np.sin(k)); t += beat / 2; k += 1
def sec_drone(a, b):
    pad([note(50)], a, b - a + 1, .05, 700)
    t, i = a + 1, 0
    while t < b - 1: piano([38, 36, 34, 33][i % 4], t, .09, dec=4); t += 6.2; i += 1
def sec_warm(a, b, last=False):
    pads([[41, 48, 57], [36, 43, 52], [38, 45, 53], [34, 41, 50]], a, b, .05, 1800)    # F C Dm Bb
    mel, t, k = [69, 72, 74, 72, 69, 67, 65, 67, 69, 72, 77, 76, 74, 72], a + 3, 0
    while t < b - 4: piano(mel[k % len(mel)], t, .08, dec=3.2, pan=(-.25 if k % 2 else .25)); t += 1.9 + (.6 if k % 4 == 3 else 0); k += 1
    if last:
        for d, m in enumerate([53, 57, 60]): piano(m, b - 7 + d * .02, .1 - d * .015, dec=5)
SEC = dict(dark=sec_dark, pulse=sec_pulse, drone=sec_drone, warm=sec_warm)

chs = sorted([k for k in sh if re.fullmatch(r'CH\d+', k)], key=lambda k: int(k[2:]))
# 短片没有章节卡时，sound_plan.SPLITS = ['S05'] 可以在指定镜头处换段（换情绪）
bounds = sorted([0.0] + [sh[c][0] for c in chs] + [sh[k][0] for k in getattr(P, 'SPLITS', [])]) + [TL['total'] + 1]
assert len(P.MOODS) == len(bounds) - 1, f'MOODS needs {len(bounds) - 1} entries (prologue + {len(chs)} chapters + {len(getattr(P, "SPLITS", []))} splits)'
for i, mood in enumerate(P.MOODS):
    a, b = bounds[i], bounds[i + 1]
    (sec_warm(a, b, last=i == len(P.MOODS) - 1) if mood == 'warm' else SEC[mood](a, b))
if 'TITLE' in sh:   # 片名处一个低音重拍
    piano(26, sh['TITLE'][0] + .1, .25, dec=4); piano(38, sh['TITLE'][0] + .1, .12, dec=4)
music = reverb(music, 3.6, .42)

# ———————— 环境音效 ————————
sfx = np.zeros((N, 2))
def noise(n): return rng.standard_normal(n)
def brown(n): x = np.cumsum(noise(n)); x = hp(x, 20); return x / (np.abs(x).max() + 1e-9)
class FX:
    """sound_plan.events(fx, sh, cues) 里可用的音色。t0 都是绝对秒数。"""
    @staticmethod
    def bed(kind, a, b, g):
        """持续环境底：room 室内底噪 / city 城市夜 / hum 日光灯电流 / subway 地铁"""
        n = int((b - a + 1.2) * SR)
        if kind == 'room': x = lp(noise(n), 400) * .6 + np.sin(2 * np.pi * 60 * tt(n)) * .05
        elif kind == 'city': x = lp(brown(n), 500) * 1.6 + lp(noise(n), 2500) * .05
        elif kind == 'hum': x = sum(np.sin(2 * np.pi * 100 * k * tt(n)) / k ** 1.5 for k in range(1, 6)) * .25 + lp(noise(n), 3000) * .03
        elif kind == 'subway': x = lp(brown(n), 160) * 2.4 + bp(noise(n), 300, 900) * .12 * (1 + .5 * np.sin(2 * np.pi * .7 * tt(n)))
        else: raise ValueError(kind)
        x = x / (np.abs(x).max() + 1e-9) * env_adsr(n, .8, 1.0)
        place(sfx, x, a - .4, g)
    @staticmethod
    def click(t0, g=.2, f=2500, dur=.02):
        """滴答、键盘、点屏、铁轨（调 f 和 dur）"""
        n = int(dur * SR); x = bp(noise(n), f * .6, f * 1.4) * np.exp(-tt(n) * 300); place(sfx, x, t0, g, rng.uniform(-.3, .3))
    @staticmethod
    def ding(t0, g=.18, f=1320):
        """消息提示、闹铃、电量警告"""
        n = int(1.2 * SR); x = (np.sin(2 * np.pi * f * tt(n)) + .4 * np.sin(2 * np.pi * f * 1.5 * tt(n))) * np.exp(-tt(n) * 5)
        place(sfx, x, t0, g, .2)
    @staticmethod
    def whoosh(t0, g=.25, dur=.5, f0=400, f1=3000):
        """滑动、光扫、远处车声（dur 长、频率低）、翻页"""
        n = int(dur * SR); x = noise(n); fc = np.linspace(f0, f1, n); y = np.zeros(n)
        for i in range(0, n, 2400): s = x[i:i + 2400]; y[i:i + len(s)] = bp(s, max(60, fc[i] * .6), min(20000, fc[i] * 1.4))
        place(sfx, y * np.sin(np.linspace(0, np.pi, n)), t0, g)
    @staticmethod
    def thump(t0, g=.5, f=48, dec=7):
        """低频重音、盖章、脚步（dec 大）"""
        n = int(1.2 * SR); q = tt(n); x = np.sin(2 * np.pi * (f * 2 * np.exp(-q * 18) + f) * q) * np.exp(-q * dec); place(sfx, x, t0, g)
    @staticmethod
    def heart(t0, g=.35): FX.thump(t0, g, 45, 14); FX.thump(t0 + .2, g * .6, 42, 14)
    @staticmethod
    def bird(t0, g=.05):
        n = int(.18 * SR); q = tt(n); f = 3200 + 1800 * np.sin(2 * np.pi * 14 * q) * np.exp(-q * 4)
        place(sfx, np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * q / .18), t0, g, rng.uniform(-.7, .7))

for sid, kind, g in P.BEDS:
    FX.bed(kind, sh[sid][0], sh[sid][1], g)
P.events(FX, sh, cues, rng)
sfx = reverb(sfx, 1.4, .18)

def save(name, x):
    x = x / max(1e-9, np.abs(x).max()) * .89
    wavfile.write(name, SR, x.astype(np.float32))
save('music.wav', music); save('sfx.wav', sfx)
print('ok', round(T, 1))
