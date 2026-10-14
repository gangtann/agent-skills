#!/bin/bash
# 合成成片并交付：bash finalize.sh <中文名> <交付目录>
#   例：bash finalize.sh 报复性熬夜 ~/Desktop/抖音配音素材/03_报复性熬夜
# 输入：final_silent.mp4（node rec.js video）、mix.wav（mix.py）、封面.png（node rec.js cover）、01/02/03 文档
# 输出：<名>_成片.mp4（1080p，横屏 1920×1080，-14 LUFS，上传用）、<名>_预览720p.mp4（发给用户看）、封面与文档拷进交付目录
set -e
grep -qs portrait format.json && PREVIEW=720:1280 || PREVIEW=1280:720   # 画幅见 format.json，默认横屏
name=$1; dest=$2
[ -n "$name" ] && [ -n "$dest" ] || { echo "usage: bash finalize.sh <名> <交付目录>"; exit 1; }
# 胶片颗粒让码率暴涨：轻度降噪 + crf 21，4 分钟约 200MB；预览版再缩到 720p
ffmpeg -y -v error -i final_silent.mp4 -i mix.wav -map 0:v -map 1:a -vf "hqdn3d=1.5:1.5:3:3" \
  -c:v libx264 -preset slow -crf 21 -pix_fmt yuv420p -af "loudnorm=I=-14:TP=-1.5:LRA=9" -ar 48000 \
  -c:a aac -b:a 192k -movflags +faststart -shortest "${name}_成片.mp4"
ffmpeg -y -v error -i "${name}_成片.mp4" -vf "hqdn3d=2:2:4:4,scale=$PREVIEW" -c:v libx264 -preset medium -crf 25 \
  -c:a copy -movflags +faststart "${name}_预览720p.mp4"
mkdir -p "$dest/素材"
cp "${name}_成片.mp4" "$dest/"
[ -f 封面.png ] && cp 封面.png "$dest/${name}_封面.png"
for f in 01_资料笔记.md 02_文章.md 03_分镜脚本.md; do [ -f "$f" ] && cp "$f" "$dest/"; done
[ -f footage/ledger.json ] && python3 footage.py credits "$dest/素材授权.md"   # 用了实拍素材就附授权台账
ls -lh "$dest"
