# 渲染引擎手册

整条片子是一个确定性的网页：`window.render(t)` 画出第 t 秒的画面，puppeteer 逐帧截图喂给 ffmpeg。所有时间都由 `timeline.json` 决定，而 timeline 由**旁白实测时长**决定，所以顺序永远是：先配音 → 再定时间线 → 再出画面和音乐。

## 目录结构（new_project.sh 拷出来的工程）

| 文件 | 作用 | 每个项目要改吗 |
|---|---|---|
| format.json | 画幅：`{"format":"landscape"}`（默认，1920×1080）或 `portrait`（1080×1920）。rec.js、qa_safe.py、sheet.sh、finalize.sh、jianying.py、gen_storyboard.py 都读它 | 一般不改 |
| script.json | 旁白脚本：`[{shot, ch, text}]`；片名卡 `TITLE`、章节卡 `CH1..CHn` 的 text 为空 | **改** |
| web/shots.js | 每个镜头的画面（`draw`）和画面文字（`txt`），API 写在文件头 | **改** |
| shots.py | 分镜元数据（场景/运镜/画面/文字/声音/转场）+ CHAPTERS | **改** |
| sound_plan.py | 每章音乐情绪 + 环境音 + 点状音效 | **改** |
| web/cover.html | 封面（横屏 1440×1080，4:3） | **改** |
| footage.py | 实拍素材：白名单下载 → 授权台账 footage/ledger.json → 转码成全 I 帧片段 footage/<id>.mp4；`credits` 生成 素材授权.md | 不改 |
| tts.py | 云希逐句配音 → voice/NN.wav + durs.json，打印实测语速 | 不改 |
| jianying.py | 备选：剪映配音的准备与切分 | 不改 |
| build_timeline.py | durs.json → timeline.json（句间 .32s，镜头间 .75s，片名卡 3.6s，章节卡 2.2s，开头 1.6s，片尾资料页 4.5s） | 不改 |
| audio.py | 按 timeline 合成配乐和音效 → music.wav / sfx.wav | 不改 |
| mix.py | 旁白 + 配乐（旁白处压 8dB）+ 音效 → mix.wav | 不改 |
| rec.js | stills / shots / video / cover 四种渲染 | 不改 |
| web/lib.js, main.js, city.js, film.html | 绘图工具、时间线控制器、3D 城市、页面与文字样式 | 一般不改 |
| gen_storyboard.py | 生成 03_分镜脚本.md | 不改 |
| qa_safe.py, sheet.sh | 抽帧安全区检查、镜头联系表 | 不改 |
| qa_frames.py | 全片扫描空画面、过暗，对应到镜头号 | 不改 |
| finalize.sh | 合成成片（loudnorm -14 LUFS）、720p 预览、拷到交付目录 | 不改 |

## 命令顺序

```bash
bash ~/.claude/skills/douyin-doc-video/scripts/new_project.sh <工程目录>
cd <工程目录> && export PATH="$PWD/bin:$PATH"; PY=.venv/bin/python

# 写好 script.json 后：
$PY tts.py                         # 看打印的语速，目标 280–295 字/分；不对就 --rate 调整
python3 build_timeline.py durs.json
$PY audio.py
python3 gen_storyboard.py 片名      # → 03_分镜脚本.md

# 迭代画面（每次改 shots.js 后）：
node rec.js shots stills/all       # 每镜 35%/85% 两帧
bash sheet.sh stills/all 35 s1.png S01 S02 TITLE S04 S05 S06   # 6 镜一排，逐排看
node rec.js stills stills/x 83.5,86   # 单独看某几个时间点

# 出片（4 分钟约 9 分钟，放后台跑）：
node rec.js video final_silent.mp4
$PY mix.py
node rec.js cover 封面.png          # 横屏 4:3 封面（竖屏工程：node rec.js cover 封面.png 300 裁 3:4）
$PY qa_frames.py final_silent.mp4 --shots   # 全片空画面/过暗扫描
$PY qa_safe.py final_silent.mp4 5   # 随机 5 帧 + UI 遮挡区，肉眼检查
bash finalize.sh <中文名> ~/Desktop/抖音配音素材/<NN_中文名>
```

只改了某一句旁白：重跑 `tts.py`（有缓存，只合成改动的句子）→ build_timeline → audio → 重渲染。

## shots.js 写法要点

- `draw(ctx, lt, D, Q)`：lt 镜头内时间，D 镜头时长，Q[i] 第 i 句旁白在镜头内的开始时间。动画都写成 lt 的纯函数（`seg`/`ease`/`eo`/`lerp`），不要有状态，否则逐帧渲染和抽帧会不一致。
- 文字跟旁白：`at:[句号, 偏移秒]`，`out:[句号, 偏移秒]`。
- 动态数字：`fn:(lt,Q)=>html`，例如 `(4.4*eo(seg(lt,Q[1]+.2,Q[1]+2.2))).toFixed(1)+' 亿人'`。
- 文字压在亮画面上时，在 draw 末尾加 `scrim()`（上下方向）或 `scrimX()`（左右方向，横屏常用）。
- 坐标尽量写成 `W`、`H` 的比例或常量，画幅由 lib.js 的 `FORMATS` 决定（`FMT.safe` 是安全区，`FMT.sub` 是字幕框）。
- 3D 城市在横屏下自动铺得更大（N=40），各镜头的 fov 乘 0.72，城市边缘不会进画面。
- 3D 底：`gl:'night'`，draw 只叠 2D（天空渐隐、压暗、图表）。
- 实拍底：`vid:{src, in, speed, kb:[1,1.1], pan:[dx0,dy0,dx1,dy1], grade:'night'|'warm'|'doc', dim}`，也可以是带 `t0` 的数组（镜头内硬切）。render 是 async 的，会等视频跳到准确的那一帧（已验证与 ffmpeg 抽帧逐帧一致）。
- 镜头 id 必须和 script.json、shots.py 一致；章节卡用 `chapter(n,'标题',warm)`；`SRC` 是片尾资料页，自动追加到时间线末尾。

## 环境

- 需要 macOS 上的 Google Chrome（GPU 走 Metal：ANGLE Metal Renderer），Node，python3。其他路径用 `CHROME=` 环境变量指定。
- edge-tts 需要联网（微软 Edge 朗读接口，非官方授权；账号要商业变现时换成 Azure 语音服务的同名音色 zh-CN-YunxiNeural）。
- 渲染速度约 14 帧/秒；无声母带很大（4 分钟约 1GB），放在工程目录，不要放进桌面交付目录。
