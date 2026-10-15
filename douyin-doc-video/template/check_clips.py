"""检查实拍素材够不够长：每个镜头的 vid 从 in 开始、按 speed 播放 D 秒，终点必须落在素材时长以内，否则画面会定格。
配完音、build_timeline.py 之后、渲染之前跑一次（改了旁白或语速，镜头时长变了，要重跑）。
用法: python3 check_clips.py
  超出的会标「← 超出」：调慢 speed（虚化底的镜头 .35–.7 都看不出）、提前 in、或用数组在中途硬切到另一条素材（t0）。
  speed 为负表示倒放（例：夜转昼的延时倒放成天亮），终点要 ≥ 0。
需要 PATH 里有 ffmpeg；素材时长取 footage/<id>.mp4（prep 之后，in 以它为准）。
"""
import json, re, subprocess, os

TL = json.load(open('timeline.json'))
src = open('web/shots.js').read()
body = src[src.index('const SH = {'):]
starts = [(m.start(), m.group(1)) for m in re.finditer(r'\n  (\w+): ', body)]
_dur = {}


def clip_len(cid):
    if cid not in _dur:
        f = f'footage/{cid}.mp4'
        if not os.path.exists(f): _dur[cid] = None
        else:
            e = subprocess.run(['ffmpeg', '-i', f], capture_output=True, text=True).stderr
            m = re.search(r'Duration: (\d+):(\d+):([\d.]+)', e)
            _dur[cid] = int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3])
    return _dur[cid]


bad = 0
for i, (pos, sid) in enumerate(starts):
    if sid not in TL['shots']: continue
    blk = body[pos:starts[i + 1][0] if i + 1 < len(starts) else len(body)]
    a, b = TL['shots'][sid]; D = b - a
    specs = []
    for m in re.finditer(r"\{([^{}]*?src: '([\w.-]+)'[^{}]*)\}", blk):
        kv = lambda k, d: float(re.search(rf'\b{k}: ([-\d.]+)', m[1])[1]) if re.search(rf'\b{k}: ([-\d.]+)', m[1]) else d
        specs.append(dict(src=m[2], t0=kv('t0', 0), inn=kv('in', 0), sp=kv('speed', 1)))
    specs.sort(key=lambda s: s['t0'])
    for j, s in enumerate(specs):
        seg = (specs[j + 1]['t0'] if j + 1 < len(specs) else D) - s['t0']
        L = clip_len(s['src']); end = s['inn'] + s['sp'] * seg
        flag = '  (未 prep)' if L is None else ('' if 0 <= end <= L else '  ← 超出'); bad += flag == '  ← 超出'
        print(f"{sid:<7}{seg:5.1f}s  {s['src']:<24}" + (f"{L:6.1f}s" if L else '     ?') + f"  in {s['inn']:5.1f}  speed {s['sp']:5.2f}  → {end:6.1f}{flag}")
print(f'\n超出素材时长：{bad} 处' + ('' if bad else '  ✓'))
