"""QA：整片自动查「空画面」和「过暗」。每秒抽 2 帧，算两个指标：
  覆盖率：把画面切成 16×9 的格子（竖屏 9×16），有明显细节（亮度标准差 > 6）的格子占比，字幕带不算。
          「空背景 + 一行字」大约 0.05–0.12，有主体的画面通常 > 0.25。
  亮度：平均亮度（0–255）。夜景本来就暗，所以分两层查：整片中位数 < 26 报「整体偏暗」（手机上发闷）；
        单段 < 12（接近黑屏）连续 ≥1.5 秒才报。「报复性熬夜」整片中位数只有 20，偏暗。
空画面连续 ≥1.5 秒低于阈值就报出来，并对应到镜头号（需要 timeline.json）。片头 1 秒、片尾资料页、转场黑场不算。
用法: .venv/bin/python qa_frames.py <video.mp4> [--cov 0.15] [--luma 12] [--film-luma 26] [--min 1.5] [--out qa_frames.png]
       加 --shots 打印每个镜头的覆盖率和亮度中位数（调阈值、对比上一期时用）
"""
import sys, json, os, argparse, subprocess, re, numpy as np
from PIL import Image, ImageDraw, ImageFont

ap = argparse.ArgumentParser(); ap.add_argument('video'); ap.add_argument('--cov', type=float, default=.15)
ap.add_argument('--luma', type=float, default=12); ap.add_argument('--film-luma', type=float, default=26); ap.add_argument('--min', type=float, default=1.5)
ap.add_argument('--fps', type=float, default=2); ap.add_argument('--out', default='qa_frames.png'); ap.add_argument('--shots', action='store_true')
a = ap.parse_args()
w0, h0 = map(int, re.search(r'Video:.*?(\d{3,5})x(\d{3,5})', subprocess.run(['ffmpeg', '-i', a.video], capture_output=True, text=True).stderr).groups())
port = h0 > w0
gw, gh = (9, 16) if port else (16, 9)
sw, sh = gw * 12, gh * 12
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', a.video, '-vf', f'fps={a.fps},scale={sw}:{sh}:flags=area,format=gray', '-f', 'rawvideo', '-'],
                     capture_output=True, check=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, sh, sw).astype(np.float32)
sub = (1300 / 1920, 1390 / 1920) if port else (775 / 1080, 870 / 1080)     # 字幕带（不计入覆盖率）
rows = [r for r in range(gh) if not (sub[0] <= (r + .5) / gh <= sub[1])]
tiles = fr.reshape(len(fr), gh, 12, gw, 12).std(axis=(2, 4))[:, rows, :]
cov = (tiles > 6).mean(axis=(1, 2)); luma = fr.mean(axis=(1, 2)); ts = (np.arange(len(fr)) + .5) / a.fps

TL = json.load(open('timeline.json')) if os.path.exists('timeline.json') else None
def shot_at(t):
    if not TL: return '?'
    return next((k for k in TL['order'] if TL['shots'][k][0] <= t < TL['shots'][k][1]), TL['order'][-1])
def skip(t):   # 片头、片尾资料页、镜头交界 ±0.6s（黑场叠化）
    if t < 1 or (TL and shot_at(t) == 'SRC'): return True
    return bool(TL) and any(abs(t - TL['shots'][k][0]) < .6 for k in TL['order'])

if a.shots and TL:
    print(f"{'镜头':<7}{'时长':>6}{'覆盖率':>8}{'亮度':>7}")
    for k in TL['order']:
        s, e = TL['shots'][k]; m = (ts >= s + .6) & (ts < e - .6)
        if m.any(): print(f"{k:<7}{e - s:6.1f}{np.median(cov[m]):8.2f}{np.median(luma[m]):7.1f}" + ('  ← 空' if np.median(cov[m]) < a.cov else '') + ('  ← 暗' if np.median(luma[m]) < a.luma else ''))

issues = []
for name, bad in [('空画面', cov < a.cov), ('过暗', luma < a.luma)]:
    bad = bad & ~np.array([skip(t) for t in ts]); i = 0
    while i < len(bad):
        if bad[i]:
            j = i
            while j + 1 < len(bad) and bad[j + 1]: j += 1
            if (j - i + 1) / a.fps >= a.min: issues.append((name, ts[i], ts[j], (i + j) // 2))
            i = j + 1
        else: i += 1
issues.sort(key=lambda x: x[1])
fl = np.median(luma[[not skip(t) for t in ts]])
print(f'整片：覆盖率中位数 {np.median(cov):.2f}，亮度中位数 {fl:.1f}' + (f'  ← 整体偏暗（目标 ≥{a.film_luma}）：提高曝光、多用亮部和实拍' if fl < a.film_luma else '  ✓'))
print(f'低于阈值（覆盖率 {a.cov}，亮度 {a.luma}）连续 ≥{a.min}s 的段：{len(issues)} 处')
for n, s, e, _ in issues:
    print(f'  {n}  {s:6.1f}–{e:6.1f}s  ({e - s + 1 / a.fps:.1f}s)  镜头 {shot_at(s)}' + (f'→{shot_at(e)}' if shot_at(e) != shot_at(s) else ''))
if issues:   # 每处抽中间一帧拼成一张图，便于肉眼确认
    tw, th = (216, 384) if port else (384, 216); tmp = '/tmp/_qa_f.png' if os.name != 'nt' else 'qa_tmp.png'
    font = next((ImageFont.truetype(f, 18) for f in ['/System/Library/Fonts/PingFang.ttc', '/System/Library/Fonts/STHeiti Medium.ttc'] if os.path.exists(f)), None) or ImageFont.load_default(18); cols = min(len(issues), 6)
    sheet = Image.new('RGB', (tw * cols, (th + 26) * ((len(issues) + cols - 1) // cols)), (20, 20, 20))
    for k, (n, s, e, mid) in enumerate(issues):
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{ts[mid]:.2f}', '-i', a.video, '-frames:v', '1', tmp], check=True)
        x, y = tw * (k % cols), (th + 26) * (k // cols)
        sheet.paste(Image.open(tmp).convert('RGB').resize((tw, th)), (x, y + 26))
        ImageDraw.Draw(sheet).text((x + 6, y + 4), f'{n} {s:.0f}-{e:.0f}s {shot_at(s)}', fill=(255, 90, 90), font=font)
    sheet.save(a.out); print('→', a.out)
