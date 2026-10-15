"""「报复性熬夜」横屏版的声音设计（从竖屏版 audio.py 移植）。
情绪：序、01、02 压抑 → 03 脉冲 → 04 单音 → 05 转暖。
"""
import numpy as np

MOODS = ['dark', 'dark', 'dark', 'pulse', 'drone', 'warm']

BEDS = [('S01', 'room', .05), ('S06', 'room', .04), ('S19', 'room', .04), ('S25', 'room', .05), ('S23', 'room', .035),
        ('S02', 'city', .07), ('TITLE', 'city', .05), ('S10', 'city', .05), ('S17', 'city', .06), ('S22', 'city', .07), ('S24', 'city', .05),
        ('S08', 'hum', .025), ('S11', 'hum', .02), ('S12', 'subway', .14), ('S09', 'subway', .06)]


def events(fx, sh, cues, rng):
    # 远处车声
    for k in ('S02', 'S17', 'S22'):
        a, b = sh[k]
        for t0 in np.arange(a + 1, b - 1, 3.3): fx.whoosh(t0, .05, 2.2, 150, 700)
    # 滴答：S04
    a, b = sh['S04']
    for t0 in np.arange(a + .3, b - .3, 1.0): fx.click(t0, .07, 3200, .015); fx.click(t0 + .5, .035, 2600, .015)
    # S01 指尖点屏
    for t0 in np.arange(sh['S01'][0] + 1.2, sh['S01'][1] - .5, .85): fx.click(t0, .05, 1800, .03)
    # S05 名词出现：低频重音 + 光扫风声
    fx.thump(sh['S05'][0] + .45, .6, 40, 5); fx.whoosh(sh['S05'][0] + .1, .12, 2.5, 200, 1800)
    # S06、S16 滑动声，S16 越来越密
    for t0 in np.arange(sh['S06'][0] + .4, cues['S06'][1] - .3, .85): fx.whoosh(t0, .06, .18, 1500, 6000)
    a = sh['S16'][0]; stop = cues['S16'][2] + .4; t0 = a + .3
    while t0 < stop: fx.whoosh(t0, .05, .15, 1500, 7000); t0 += max(.12, .7 - (t0 - a) * .08)
    fx.thump(stop, .3, 60, 10)
    # S07 电量警告、门
    fx.ding(cues['S07'][0] + 2.0, .08, 660); fx.ding(cues['S07'][0] + 2.25, .06, 440)
    fx.whoosh(cues['S07'][3], .08, 2.0, 200, 900)
    # S11 键盘
    a, b = sh['S11']
    for t0 in np.sort(rng.uniform(a + .5, b - .5, int((b - a) * 6))): fx.click(t0, .06, 3500, .012)
    # S12 铁轨节奏
    a, b = sh['S12']
    for t0 in np.arange(a + .2, b, .95): fx.click(t0, .2, 700, .05); fx.click(t0 + .14, .16, 600, .05)
    # S13 通知叠加 + 盖章
    a = sh['S13'][0]
    for k in range(5): fx.ding(a + .3 + k * .55 + .05, .09, 1320 + k * 40)
    fx.thump(cues['S13'][2] + .25, .55, 60, 9); fx.click(cues['S13'][2] + .25, .25, 1200, .06)
    # S14 车流加速
    a, b = sh['S14']; t0 = a + .3
    while t0 < b - .3:
        p = (t0 - a) / (b - a); fx.thump(t0, .12, 70, 30); t0 += 1 / (3 + 9 * p ** 1.6) * 2.2
    # S15 条形出现
    for k in range(3): fx.click(cues['S15'][1] + .3 + k * .35, .1, 1500, .04)
    fx.click(cues['S15'][2] + .3, .1, 900, .04)
    # S18 慢钟摆 vs 快秒表
    for t0 in np.arange(cues['S18'][0], cues['S18'][1], 1.0): fx.click(t0, .1, 1800, .03)
    for t0 in np.arange(cues['S18'][1], sh['S18'][1] - .3, .1): fx.click(t0, .04, 4200, .01)
    # S19 闹铃
    a = sh['S19'][0]
    for k in range(10): fx.ding(a + .2 + k * .3, .07, 2000 if k % 2 else 1600)
    # S20 低频脉冲；S21 心跳
    for t0 in np.arange(sh['S20'][0] + .5, sh['S20'][1], 2.0): fx.thump(t0, .15, 40, 4)
    for t0 in np.arange(cues['S21'][1], sh['S21'][1], 60 / 70): fx.heart(t0, .3)
    # S23 翻页
    fx.whoosh(cues['S23'][3] + .6, .08, .5, 2000, 6000)
    # S24 晨鸟
    a, b = sh['S24']
    for t0 in np.sort(rng.uniform(a + 1, b - 1, 12)): fx.bird(t0, .05)
    # S25 屏幕熄灭
    fx.click(cues['S25'][0] + 2.9, .12, 900, .05)
