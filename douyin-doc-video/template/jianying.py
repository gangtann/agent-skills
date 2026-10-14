"""备选：用剪映「解说小帅」等音色配音（只有用户点名要剪映音色时才用；默认用 tts.py）。
  python jianying.py prep              → 剪映_配音稿.srt + 剪映_底片.mp4（黑屏，长度够放下所有句子）+ tts_slots.json
     在剪映里：导入底片 → 文本/本地字幕导入 srt → 全选字幕 → 朗读 → 选音色 → 开始朗读 → 隐藏字幕轨 → 导出（含音频）
  python jianying.py split <导出的 mp4/wav>  → 按宽松时隙测出每句起止 → voice/NN.wav + durs.json（与 tts.py 输出一致）
需要 PATH 里有 ffmpeg。
"""
import sys, json, re, os, subprocess, numpy as np
from scipy.io import wavfile
SR = 48000
SIZE = '1080x1920' if os.path.exists('format.json') and json.load(open('format.json')).get('format') == 'portrait' else '1920x1080'
lines = [l['text'] for l in json.load(open('script.json')) if l['text']]
cmd = sys.argv[1]
if cmd == 'prep':
    t, slots = 1.0, []
    for s in lines:
        est = 0.205 * len(re.findall(r'[一-鿿〇0-9]', s)) + 0.2; d = 1.35 * est + .6
        slots.append([round(t, 3), round(t + d, 3)]); t += d + 1.0
    json.dump(slots, open('tts_slots.json', 'w'))
    f = lambda x: f'{int(x // 3600):02d}:{int(x % 3600 // 60):02d}:{int(x % 60):02d},{int(round(x % 1 * 1000)) % 1000:03d}'
    open('剪映_配音稿.srt', 'w').write(''.join(f'{i + 1}\n{f(a)} --> {f(b)}\n{s}\n\n' for i, ((a, b), s) in enumerate(zip(slots, lines))))
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', f'color=black:s={SIZE}:r=30:d={t + 1:.2f}',
                    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '剪映_底片.mp4'], check=True)
    print('ok', len(lines), 'lines,', round(t + 1, 1), 's')
elif cmd == 'split':
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', sys.argv[2], '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32).astype(np.float64); x /= np.abs(x).max() + 1e-9
    slots = json.load(open('tts_slots.json')); os.makedirs('voice', exist_ok=True)
    hop = int(SR * .01); env = np.sqrt(np.convolve(x ** 2, np.ones(hop) / hop, 'same'))[::hop]
    thr = max(.02, np.percentile(env, 99) * .06); durs = []
    for i, (a, b) in enumerate(slots):
        nxt = slots[i + 1][0] if i + 1 < len(slots) else a + 30
        lo, hi = int((a - .3) * 100), int((nxt - .05) * 100); idx = np.where(env[lo:hi] > thr)[0]
        assert len(idx), f'line {i} silent'
        on, off = (lo + idx[0]) / 100, (lo + idx[-1]) / 100
        if off > b + .3: print(f'warn: line {i} runs past its slot')
        seg = x[int((on - .04) * SR):int((off + .10) * SR)].copy(); f = int(.015 * SR)
        seg[:f] *= np.linspace(0, 1, f); seg[-f:] *= np.linspace(1, 0, f)
        wavfile.write(f'voice/{i:02d}.wav', SR, seg.astype(np.float32)); durs.append(round(off - on + .06, 3))
    json.dump(durs, open('durs.json', 'w'))
    n = sum(len(re.findall(r'[一-鿿〇0-9]', t)) for t in lines)
    print(f'lines {len(durs)}  speech {sum(durs):.1f}s  rate {n / sum(durs) * 60:.0f} 字/分')
