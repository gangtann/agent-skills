"""由 script.json + timeline.json + shots.py 生成 03_分镜脚本.md（每镜：时间、时长、场景/运镜、画面、画面文字、旁白、声音、转场）。
用法: python3 gen_storyboard.py [片名]
"""
import json, sys, os
PORT = os.path.exists('format.json') and json.load(open('format.json')).get('format') == 'portrait'
import shots as M
TL = json.load(open('timeline.json'))
title = sys.argv[1] if len(sys.argv) > 1 else '分镜脚本'
fmt = lambda s: f"{int(s // 60)}:{s % 60:04.1f}"
STYLE = getattr(M, 'STYLE', None) or [
    '- **色彩**：深夜冷蓝（#05080F → #12213A）作底；手机屏幕光用冷蓝、琥珀、紫、青四色轮换；数据重点统一用琥珀色 #FFB35A，对照项用冷蓝 #9CBCE6；最后一章转为暖调。',
    '- **字体**：标题和金句用宋体（Songti SC Black），正文用苹方（PingFang SC），数字用 DIN Alternate。',
    '- **质感**：全片叠加胶片颗粒和暗角；3D 城市带雾效与景深，2D 场景用剪影加轮廓光、虚化光斑。',
    '- **动效**：文字统一做"上浮 + 去模糊"的入场（0.8 秒）；镜头以缓推、缓拉、摇臂、横移为主；转场以黑场叠化为主，个别用硬切。',
    ('- **安全区**：画面文字只出现在 y 300–1240、x 72–900 之间，避开顶部 15%、底部 25% 和右侧按钮列；字幕固定在 y≈1312，单行，最多 17 字，长句按标点分段。' if PORT else
     '- **安全区**：画面文字只出现在 x 140–1700、y 90–760 之间，避开顶部搜索栏、底部 20%（作者、标题、进度条）和右侧按钮列；字幕固定在 y≈784，单行，最多 20 字，长句按标点分段。'),
    '- **声音**：旁白用云希（微软神经网络语音）；配乐为程序合成，情绪走向是：压抑 → 共鸣 → 思考 → 转暖 → 余韵；环境音按场景铺设。',
]
out = [f'# {title}', '',
       f"成片时长 {fmt(TL['total'])} ｜ {'1080×1920 竖屏' if PORT else '1920×1080 横屏'} · 30fps ｜ 镜头 {len(TL['order'])} 个（含章节卡与片尾资料页）", '',
       '## 视觉系统', '', *STYLE, '',
       '## 分镜表', '',
       '| # | 时间 | 时长 | 场景 / 景别与运镜 | 画面 | 画面文字 / 数据 | 旁白 | 音乐与音效 | 转场 |',
       '|---|---|---|---|---|---|---|---|---|']
for i, sid in enumerate(TL['order']):
    a, b = TL['shots'][sid]
    if sid == 'SRC':
        out.append(f"| {i+1} | {fmt(a)} | {b-a:.1f}s | 片尾 | 资料来源列表 | 全部数据与引用出处 | — | 音乐收尾 | 黑场 |"); continue
    m = M.SHOTS[sid]
    vo = '<br>'.join(l['text'] for l in TL['lines'] if l['shot'] == sid) or '（无旁白）'
    if sid in M.CHAPTERS: out.append(f"| | | | **{M.CHAPTERS[sid]}** | | | | | |")
    out.append(f"| {i+1} {sid} | {fmt(a)} | {b-a:.1f}s | {m['scene']}：{m['shot']} | {m['picture']} | {m['onscreen']} | {vo} | {m['sound']} | {m['trans']} |")
open('03_分镜脚本.md', 'w').write('\n'.join(out) + '\n')
print('ok')
