#!/bin/bash
# 镜头联系表：先 node rec.js shots stills/all，再
#   bash sheet.sh stills/all 35 sheet.png S01 S02 TITLE ...   （35 或 85 = 镜头内位置百分比）
# 一次最多放 6–8 个镜头，便于肉眼检查构图、留白和遮挡。需要 PATH 里有 ffmpeg。
dir=$1; suf=$2; out=$3; shift 3
args=(); n=0; for id in "$@"; do args+=(-i "$dir/${id}_${suf}.png"); n=$((n+1)); done
ffmpeg -y -loglevel error "${args[@]}" -filter_complex "$(for i in $(seq 0 $((n-1))); do printf "[$i]scale=270:480,drawtext=text='$(echo ${@:$((i+1)):1})':x=8:y=8:fontsize=22:fontcolor=yellow[v$i];"; done)$(for i in $(seq 0 $((n-1))); do printf "[v$i]"; done)hstack=inputs=$n" "$out"
