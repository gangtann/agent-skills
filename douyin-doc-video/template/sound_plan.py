"""每个项目自己的声音设计（audio.py 读取）。完整写法参考 examples/revenge_sleep/audio.py 的 SFX 部分。
MOODS：序章 + 每章各一个，取值 dark / pulse / drone / warm。
  报复性熬夜用的是 ['dark', 'dark', 'dark', 'pulse', 'drone', 'warm']（序、01、02 压抑 → 03 脉冲 → 04 单音 → 05 转暖）
BEDS：(镜头, room|city|hum|subway, 音量)，常用音量 room .04–.05，city .05–.07，hum .02，subway .14
events(fx, sh, cues, rng)：点状音效。sh[镜头] = [起, 止]（绝对秒）；cues[镜头] = 该镜头每句旁白的开始时间。
  fx.click / ding / whoosh / thump / heart / bird，参数见 audio.py 的 FX。
"""
import numpy as np

MOODS = ['dark', 'warm']

BEDS = [('S01', 'city', .07)]

def events(fx, sh, cues, rng):
    a, b = sh['S01']
    for t0 in np.arange(a + 1, b - 1, 3.3): fx.whoosh(t0, .05, 2.2, 150, 700)     # 远处车声
    fx.click(cues['S02'][0] + .4, .1, 1500, .04)                                   # 数据出现
