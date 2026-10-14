# 范例：「报复性熬夜」（2026.10，4:06，云希配音，**竖屏 1080×1920**）

这一期是竖屏做的（用户之后改为要求横屏）。镜头和场景写法照样可借用，但坐标是竖屏的，搬进横屏工程要重新排版。

完整走完三个阶段的真实项目，做新题材时拿来对照质量和写法：

- `01_资料笔记.md`：约 110 条带编号、来源和用途标注的资料，加「未核实」清单和核心观点
- `02_文章.md`：4442 字，《夜里偷回来的时间，被谁拿走了》
- `03_分镜脚本.md`：32 个镜头的完整分镜表
- `script.json`：58 句旁白，含 TITLE 和 CH1–CH5
- `shots.js`：全部镜头的实现（卧室侧脸、3D 城市、时钟、地铁、通知、24/7 大楼等），可以直接借用其中的场景函数
- `shots.py`：分镜元数据
- `audio.py`：这一期手写的完整配乐和音效（早于 template 里的 sound_plan.py 方式；直接替换工程里的 audio.py 也能运行），写 sound_plan.events() 时可以参考里面的音效编排
- `cover.html`：封面（复用卧室场景，整体下移 190px，裁 3:4）

在工程里试跑：把 `format.json`（portrait）、`script.json`、`shots.py` 拷到工程根目录，把 `shots.js`、`cover.html` 拷到 `web/`，然后 `python3 build_timeline.py && node rec.js shots stills/all`。
