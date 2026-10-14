#!/bin/bash
# 在工程目录里安装渲染依赖：bash setup.sh
# 之后：export PATH="$PWD/bin:$PATH"；Python 一律用 .venv/bin/python
set -e
cd "$(dirname "$0")"
[ -d node_modules/puppeteer-core ] || npm i --no-audit --no-fund --silent puppeteer-core ffmpeg-static
[ -x .venv/bin/python ] || python3 -m venv .venv
.venv/bin/pip -q install numpy scipy pillow edge-tts 2>&1 | grep -v notice || true
mkdir -p bin && ln -sf ../node_modules/ffmpeg-static/ffmpeg bin/ffmpeg
[ -x "${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}" ] || echo "warn: Chrome not found; set CHROME=/path/to/chrome"
echo "setup ok"
