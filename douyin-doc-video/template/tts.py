"""旁白：edge-tts 云希，逐句合成 → 去首尾静音 → voice/NN.wav + durs.json
用法: .venv/bin/python tts.py [--voice zh-CN-YunxiNeural] [--rate -4%]
- 按「文本+音色+语速」缓存，改了哪句只重合成哪句
- 结束时打印实测语速；目标约 300 字/分（用户 2026-10-14 嫌 285 稍慢）。偏快就把 --rate 调低（云希 0% ≈ 311 字/分，-4% ≈ 298，-8% ≈ 288）
需要 PATH 里有 ffmpeg（export PATH="$PWD/bin:$PATH"）
"""
import json, re, os, sys, asyncio, hashlib, subprocess, argparse, numpy as np
from scipy.io import wavfile
import edge_tts

ap = argparse.ArgumentParser(); ap.add_argument('--voice', default='zh-CN-YunxiNeural'); ap.add_argument('--rate', default='-4%')
A = ap.parse_args(); SR = 48000
lines = [l['text'] for l in json.load(open('script.json')) if l['text']]
os.makedirs('tts_cache', exist_ok=True); os.makedirs('voice', exist_ok=True)
key = lambda t: hashlib.md5(f'{A.voice}|{A.rate}|{t}'.encode()).hexdigest()[:12]

async def main():
    sem = asyncio.Semaphore(6)
    async def one(t):
        p = f'tts_cache/{key(t)}.mp3'
        if os.path.exists(p): return
        async with sem:
            for attempt in range(3):
                try: await edge_tts.Communicate(t, A.voice, rate=A.rate).save(p); return
                except Exception as e:
                    if attempt == 2: raise
                    await asyncio.sleep(2)
    await asyncio.gather(*(one(t) for t in lines))
asyncio.run(main())

durs = []
for i, t in enumerate(lines):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f'tts_cache/{key(t)}.mp3', '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32).astype(np.float64)
    hop = int(SR * .01); env = np.sqrt(np.convolve(x ** 2, np.ones(hop) / hop, 'same'))[::hop]
    thr = max(.004, np.percentile(env, 99) * .06); idx = np.where(env > thr)[0]
    on, off = idx[0] / 100, idx[-1] / 100
    a, b = max(0, int((on - .04) * SR)), min(len(x), int((off + .10) * SR))
    seg = x[a:b]; f = int(.015 * SR); seg[:f] *= np.linspace(0, 1, f); seg[-f:] *= np.linspace(1, 0, f)
    wavfile.write(f'voice/{i:02d}.wav', SR, seg.astype(np.float32))
    durs.append(round(off - on + .06, 3))
json.dump(durs, open('durs.json', 'w'))
n = sum(len(re.findall(r'[一-鿿〇0-9]', t)) for t in lines)
print(f'lines {len(lines)}  speech {sum(durs):.1f}s  rate {n / sum(durs) * 60:.0f} 字/分  ({A.voice} {A.rate})')
