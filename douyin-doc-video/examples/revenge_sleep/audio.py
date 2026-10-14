"""配乐 + 环境音效，全部程序合成，按 timeline.json 对齐。
输出: music.wav, sfx.wav（48kHz 立体声 float）
情绪曲线：压抑（序~02）→ 共鸣/脉冲（03）→ 收缩为单音（04）→ 转暖的大调（05）→ 余韵
"""
import json, numpy as np
from scipy.signal import fftconvolve, butter, sosfilt
from scipy.io import wavfile

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
def note(f): return 440 * 2 ** ((f - 69) / 12)
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

order = TL['order']
def span(a, b): return sh[a][0], sh[b][1]
# 段落边界
A0, A1 = 0, sh['S14'][1]                         # 序 ~ 02：压抑
B0, B1 = sh['CH3'][0], sh['S19'][1]              # 03：共鸣、脉冲
C0, C1 = sh['CH4'][0], sh['S22'][1]              # 04：单音
D0, D1 = sh['CH5'][0], TL['total'] + 1           # 05：转暖

# A：D 小调长音铺底，每 8 秒换和声；稀疏钢琴动机
chordsA = [[38, 45, 53], [36, 43, 52], [34, 41, 50], [33, 45, 52]]   # Dm  C/Am  Bb  A
t = A0 + .5; k = 0
while t < A1:
    d = min(8.5, A1 - t + 1.5); pad([note(m) for m in chordsA[k % 4]], t, d, .045, 900); t += 8; k += 1
motif = [62, 65, 69, 67, 65, 64]
t = sh['S02'][0] + 1; k = 0
while t < A1 - 2:
    piano(motif[k % 6], t, .07, pan=(-.3 if k % 2 else .3)); t += 2.6 + (k % 3) * .6; k += 1
# 片名处一个低音重拍
piano(26, sh['TITLE'][0] + .1, .25, dec=4); piano(38, sh['TITLE'][0] + .1, .12, dec=4)

# B：加入心跳式脉冲 + 八分音符琶音
chordsB = [[38, 45, 53], [34, 41, 50], [36, 43, 52], [33, 40, 49]]
t = B0; k = 0
while t < B1:
    d = min(8.5, B1 - t + 1.5); pad([note(m) for m in chordsB[k % 4]], t, d, .05, 1300); t += 8; k += 1
beat = 60 / 72
t = B0 + 1.5
while t < B1 - .5:
    n = int(.35 * SR); tq = tt(n); kick = np.sin(2 * np.pi * (55 * np.exp(-tq * 9) + 38) * tq) * np.exp(-tq * 11)
    place(music, kick, t, .16); place(music, kick, t + .22, .08); t += beat
arp = [62, 69, 65, 69, 62, 69, 65, 72]
t = sh['S15'][0]; k = 0
while t < B1 - 1:
    piano(arp[k % 8] - (0 if (k // 16) % 2 == 0 else 3), t, .035, dec=1.2, pan=.4 * np.sin(k)); t += beat / 2; k += 1

# C：收缩为一个长音 + 很稀疏的低音
pad([note(50)], C0, C1 - C0 + 1, .05, 700)
for i, m in enumerate([38, 36, 34, 33, 38]):
    piano(m, C0 + 1 + i * 6.2, .09, dec=4)

# D：大调，温暖
chordsD = [[41, 48, 57], [36, 43, 52], [38, 45, 53], [34, 41, 50]]    # F  C  Dm  Bb
t = D0; k = 0
while t < D1 - 3:
    d = min(8.5, D1 - t); pad([note(m) for m in chordsD[k % 4]], t, d, .05, 1800); t += 8; k += 1
mel = [69, 72, 74, 72, 69, 67, 65, 67, 69, 72, 77, 76, 74, 72]
t = sh['S23'][0] + 2; k = 0
while t < sh['S26'][1] - 3:
    piano(mel[k % len(mel)], t, .08, dec=3.2, pan=(-.25 if k % 2 else .25)); t += 1.9 + (.6 if k % 4 == 3 else 0); k += 1
piano(53, sh['S26'][0] + 1, .1, dec=5); piano(57, sh['S26'][0] + 1.02, .08, dec=5); piano(60, sh['S26'][0] + 1.04, .07, dec=5)
music = reverb(music, 3.6, .42)

# ———————— 环境音效 ————————
sfx = np.zeros((N, 2))
def noise(n): return rng.standard_normal(n)
def brown(n): x = np.cumsum(noise(n)); x = hp(x, 20); return x / (np.abs(x).max() + 1e-9)
def bed(kind, a, b, g):
    n = int((b - a + 1.2) * SR)
    if kind == 'room': x = lp(noise(n), 400) * .6 + np.sin(2 * np.pi * 60 * tt(n)) * .05
    elif kind == 'city': x = lp(brown(n), 500) * 1.6 + lp(noise(n), 2500) * .05
    elif kind == 'hum': x = sum(np.sin(2 * np.pi * 100 * k * tt(n)) / k ** 1.5 for k in range(1, 6)) * .25 + lp(noise(n), 3000) * .03
    elif kind == 'subway': x = lp(brown(n), 160) * 2.4 + bp(noise(n), 300, 900) * .12 * (1 + .5 * np.sin(2 * np.pi * .7 * tt(n)))
    x = x / (np.abs(x).max() + 1e-9) * env_adsr(n, .8, 1.0)
    place(sfx, x, a - .4, g)
def click(t0, g=.2, f=2500, dur=.02):
    n = int(dur * SR); x = bp(noise(n), f * .6, f * 1.4) * np.exp(-tt(n) * 300); place(sfx, x, t0, g, rng.uniform(-.3, .3))
def ding(t0, g=.18, f=1320):
    n = int(1.2 * SR); x = (np.sin(2 * np.pi * f * tt(n)) + .4 * np.sin(2 * np.pi * f * 1.5 * tt(n + 0)[:n])) * np.exp(-tt(n) * 5)
    place(sfx, x, t0, g, .2)
def whoosh(t0, g=.25, dur=.5, f0=400, f1=3000):
    n = int(dur * SR); x = noise(n); fc = np.linspace(f0, f1, n); y = np.zeros(n)
    for i in range(0, n, 2400): seg = x[i:i + 2400]; y[i:i + len(seg)] = bp(seg, max(60, fc[i] * .6), min(20000, fc[i] * 1.4))
    place(sfx, y * np.sin(np.linspace(0, np.pi, n)), t0, g)
def thump(t0, g=.5, f=48, dec=7):
    n = int(1.2 * SR); tq = tt(n); x = np.sin(2 * np.pi * (f * 2 * np.exp(-tq * 18) + f) * tq) * np.exp(-tq * dec); place(sfx, x, t0, g)
def heart(t0, g=.35): thump(t0, g, 45, 14); thump(t0 + .2, g * .6, 42, 14)

for k, kind, g in [('S01', 'room', .05), ('S06', 'room', .04), ('S19', 'room', .04), ('S25', 'room', .05), ('S23', 'room', .035),
                   ('S02', 'city', .07), ('TITLE', 'city', .05), ('S10', 'city', .05), ('S17', 'city', .06), ('S22', 'city', .07), ('S24', 'city', .05),
                   ('S08', 'hum', .025), ('S11', 'hum', .02), ('S12', 'subway', .14)]:
    bed(kind, sh[k][0], sh[k][1], g)
# 远处车声
for k in ('S02', 'S17', 'S22'):
    a, b = sh[k]
    for t0 in np.arange(a + 1, b - 1, 3.3): whoosh(t0, .05, 2.2, 150, 700)
# 滴答：S04、S09
for k in ('S04', 'S09'):
    a, b = sh[k]
    for t0 in np.arange(a + .3, b - .3, 1.0): click(t0, .07, 3200, .015); click(t0 + .5, .035, 2600, .015)
# S01 指尖点屏
for t0 in np.arange(sh['S01'][0] + 1.2, sh['S01'][1] - .5, .85): click(t0, .05, 1800, .03)
# S05 名词出现：低频重音 + 光扫风声
thump(sh['S05'][0] + .45, .6, 40, 5); whoosh(sh['S05'][0] + .1, .12, 2.5, 200, 1800)
# S06、S16 滑动声，S16 越来越密
for t0 in np.arange(sh['S06'][0] + .4, cues['S06'][1] - .3, .85): whoosh(t0, .06, .18, 1500, 6000)
a = sh['S16'][0]; stop = cues['S16'][2] + .4; t0 = a + .3
while t0 < stop: whoosh(t0, .05, .15, 1500, 7000); t0 += max(.12, .7 - (t0 - a) * .08)
thump(stop, .3, 60, 10)
# S07 电量警告、门
ding(cues['S07'][0] + 2.0, .08, 660); ding(cues['S07'][0] + 2.25, .06, 440)
whoosh(cues['S07'][3], .08, 2.0, 200, 900)
# S11 键盘
a, b = sh['S11']
for t0 in np.sort(rng.uniform(a + .5, b - .5, int((b - a) * 6))): click(t0, .06, 3500, .012)
# S12 铁轨节奏
a, b = sh['S12']
for t0 in np.arange(a + .2, b, .95): click(t0, .2, 700, .05); click(t0 + .14, .16, 600, .05)
# S13 通知叠加 + 盖章
a = sh['S13'][0]
for k in range(5): ding(a + .3 + k * .55 + .05, .09, 1320 + k * 40)
thump(cues['S13'][2] + .25, .55, 60, 9); click(cues['S13'][2] + .25, .25, 1200, .06)
# S14 脚步加速
a, b = sh['S14']; t0 = a + .3
while t0 < b - .3:
    p = (t0 - a) / (b - a); thump(t0, .12, 70, 30); t0 += 1 / (3 + 9 * p ** 1.6) * 2.2
# S15 条形出现
for k in range(3): click(cues['S15'][1] + .3 + k * .35, .1, 1500, .04)
click(cues['S15'][2] + .3, .1, 900, .04)
# S18 慢钟摆 vs 快秒表
for t0 in np.arange(cues['S18'][0], cues['S18'][1], 1.0): click(t0, .1, 1800, .03)
for t0 in np.arange(cues['S18'][1], sh['S18'][1] - .3, .1): click(t0, .04, 4200, .01)
# S19 闹铃
a = sh['S19'][0]
for k in range(10): ding(a + .2 + k * .3, .07, 2000 if k % 2 else 1600)
# S20 低频脉冲；S21 心跳
for t0 in np.arange(sh['S20'][0] + .5, sh['S20'][1], 2.0): thump(t0, .15, 40, 4)
for t0 in np.arange(cues['S21'][1], sh['S21'][1], 60 / 70): heart(t0, .3)
# S23 翻页
whoosh(cues['S23'][3] + .6, .08, .5, 2000, 6000)
# S24 晨鸟
a, b = sh['S24']
for t0 in np.sort(rng.uniform(a + 1, b - 1, 12)):
    n = int(.18 * SR); tq = tt(n); f = 3200 + 1800 * np.sin(2 * np.pi * 14 * tq) * np.exp(-tq * 4)
    place(sfx, np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tq / .18), t0, .05, rng.uniform(-.7, .7))
# S25 屏幕熄灭
click(cues['S25'][0] + 2.9, .12, 900, .05)
sfx = reverb(sfx, 1.4, .18)

def save(name, x):
    x = x / max(1e-9, np.abs(x).max()) * .89
    wavfile.write(name, SR, x.astype(np.float32))
save('music.wav', music); save('sfx.wav', sfx)
print('ok', round(T, 1))
