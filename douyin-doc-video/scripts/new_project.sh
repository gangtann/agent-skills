#!/bin/bash
# 新建视频工程：bash new_project.sh <工程目录>
# 拷贝渲染引擎模板并安装依赖。工程目录放中间产物（无声母带 ~1GB），不要放在桌面交付目录里。
set -e
SKILL="$(cd "$(dirname "$0")/.." && pwd)"
dir=$1; [ -n "$dir" ] || { echo "usage: bash new_project.sh <dir>"; exit 1; }
mkdir -p "$dir"; cp -Rn "$SKILL/template/." "$dir/"
bash "$dir/setup.sh"
echo "project ready: $dir"
