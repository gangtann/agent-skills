"""QA：随机抽帧，叠加抖音 UI 遮挡区（红色）→ 一张对比图。画幅读 format.json（默认横屏）
  横屏 1920×1080：顶部 7%（搜索栏）、底部 20%（作者/标题/进度条）、右侧按钮列
  竖屏 1080×1920：顶部 15%、底部 25%、右侧按钮列
用法: .venv/bin/python qa_safe.py <video.mp4> [帧数=5] [随机种子] [输出=qa_safe.png]
检查：文字/数据/字幕都不能进红区；每帧都要有明确主体和信息，不能是"空背景 + 一行字"或纯过渡黑场。
"""
import sys, random, subprocess, json, os, tempfile
from PIL import Image, ImageDraw, ImageFont
vid = sys.argv[1]; n = int(sys.argv[2]) if len(sys.argv) > 2 else 5
TL = json.load(open('timeline.json')); PORT = os.path.exists('format.json') and json.load(open('format.json')).get('format') == 'portrait'
ZONES = [[0, 0, 1080, 288], [0, 1440, 1080, 1920], [930, 860, 1080, 1440]] if PORT else [[0, 0, 1920, 76], [0, 870, 1920, 1080], [1780, 260, 1920, 870]]
TW, TH = (540, 960) if PORT else (960, 540); random.seed(sys.argv[3] if len(sys.argv) > 3 else None)
ts = sorted(random.uniform(2, TL['total'] - 6) for _ in range(n))
font = ImageFont.load_default(34); tmp = os.path.join(tempfile.gettempdir(), '_qa_frame.png'); tiles = []
for t in ts:
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{t:.2f}', '-i', vid, '-frames:v', '1', tmp], check=True)
    im = Image.open(tmp).convert('RGBA'); ov = Image.new('RGBA', im.size); d = ImageDraw.Draw(ov)
    for z in ZONES: d.rectangle(z, fill=(255, 40, 40, 70))
    im = Image.alpha_composite(im, ov); ImageDraw.Draw(im).text((24, 24), f'{t:.1f}s', fill='white', font=font)
    tiles.append(im.resize((TW, TH)))
cols = n if PORT else 2   # 横屏两列排布，便于看清
sheet = Image.new('RGB', (TW * cols, TH * ((n + cols - 1) // cols)))
for i, im in enumerate(tiles): sheet.paste(im, (TW * (i % cols), TH * (i // cols)))
sheet.save(sys.argv[4] if len(sys.argv) > 4 else 'qa_safe.png'); print([round(t, 1) for t in ts])
