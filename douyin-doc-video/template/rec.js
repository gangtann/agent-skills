// 用法（在工程目录里运行，依赖由 setup.sh 安装到 ./node_modules）:
//   node rec.js stills <out_dir> t1,t2,...        截取指定时间点
//   node rec.js shots <out_dir>                    每个镜头取 35% 与 85% 两帧
//   node rec.js video <out.mp4> [from] [to]        渲染视频（30fps，无声）
//   node rec.js cover34 <out.png>                  渲染 web/cover_v.html → 1080×1440（横屏视频的 3:4 竖封面；抖音自动从横封面裁出的竖封面常常切掉标题）
//   node rec.js cover <out.png> [cropY]            渲染 web/cover.html。横屏：1440×1080（4:3 横封面）；竖屏：给 cropY 则裁成 1080×1440（3:4）
// 画幅读工程里的 format.json（{"format":"landscape"|"portrait"}，默认横屏 1920×1080），通过 ?fmt= 传给页面
const puppeteer = require('puppeteer-core'), ffmpeg = require('ffmpeg-static');
const { spawn } = require('child_process'), fs = require('fs'), path = require('path');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const [mode, out, a3, a4] = process.argv.slice(2);
const tl = fs.existsSync(path.join(__dirname, 'timeline.json')) ? fs.readFileSync(path.join(__dirname, 'timeline.json'), 'utf8') : '{}';
fs.writeFileSync(path.join(__dirname, 'web/build.html'), fs.readFileSync(path.join(__dirname, 'web/film.html'), 'utf8').replace('__TIMELINE__', tl));
const TL = JSON.parse(tl);
const FMT = (fs.existsSync(path.join(__dirname, 'format.json')) && JSON.parse(fs.readFileSync(path.join(__dirname, 'format.json'), 'utf8')).format) || 'landscape';
const [VW, VH] = mode === 'cover34' ? [1080, 1440] : mode === 'cover' ? (FMT === 'portrait' ? [1080, 1920] : [1440, 1080]) : (FMT === 'portrait' ? [1080, 1920] : [1920, 1080]);
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars', '--allow-file-access-from-files'] });
  const p = await b.newPage();
  p.on('pageerror', e => console.error('PAGE ERROR', e.message)); p.on('console', m => m.type() === 'error' && console.error('console', m.text()));
  await p.setViewport({ width: VW, height: VH, deviceScaleFactor: 1 });
  const page = mode === 'cover34' ? 'web/cover_v.html' : mode === 'cover' ? 'web/cover.html' : 'web/build.html';
  await p.goto('file://' + path.join(__dirname, page) + '?fmt=' + (mode === 'cover' && FMT !== 'portrait' ? 'cover' : FMT), { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  if (mode.startsWith('cover')) await p.waitForFunction(() => document.title === 'ready', { timeout: 5000 }).catch(() => {});   // 底图异步加载完才截
  const shot = async (t, f) => { await p.evaluate(t => window.render(t), t); await p.screenshot({ path: f }); };
  if (mode === 'cover34') await p.screenshot({ path: out });
  else if (mode === 'cover') {
    const y = a3 == null || FMT !== 'portrait' ? null : Number(a3);
    await p.screenshot(y == null ? { path: out } : { path: out, clip: { x: 0, y, width: 1080, height: 1440 } });
  } else if (mode === 'stills') { fs.mkdirSync(out, { recursive: true }); for (const t of a3.split(',').map(Number)) await shot(t, path.join(out, `t${t.toFixed(2)}.png`)); }
  else if (mode === 'shots') {
    fs.mkdirSync(out, { recursive: true });
    const warn = [];
    for (const id of TL.order) {
      const [s, e] = TL.shots[id];
      for (const k of [.35, .85]) {
        await shot(s + (e - s) * k, path.join(out, `${id}_${Math.round(k * 100)}.png`));
        // 自动检查当前可见的画面文字：是否出安全区、字号是否低于下限
        for (const m of await p.evaluate(() => [...document.querySelectorAll('#layer .tx')].filter(e => e.offsetParent && +e.style.opacity > .5 && e.textContent.trim()).flatMap(e => {
          const rg = document.createRange(); rg.selectNodeContents(e); const r = rg.getBoundingClientRect(), [x0, y0, x1, y1] = FMT.safe, fsz = parseFloat(getComputedStyle(e).fontSize), t = e.textContent.trim().slice(0, 12), out = [];
          if (r.left < x0 - 2 || r.top < y0 - 2 || r.right > x1 + 2 || r.bottom > y1 + 2) out.push(`出安全区 [${[r.left, r.top, r.right, r.bottom].map(Math.round)}]「${t}」`);
          if (fsz < FMT.minFont) out.push(`字号 ${fsz}px < ${FMT.minFont}「${t}」`);
          return out;
        }))) warn.push(`${id}@${Math.round(k * 100)}%  ${m}`);
      }
    }
    console.log(warn.length ? `文字检查：${warn.length} 处问题\n  ` + [...new Set(warn)].join('\n  ') : '文字检查：全部在安全区内，字号达标');
  } else if (mode === 'video') {
    const FPS = 30, from = Number(a3 || 0), to = Number(a4 || TL.total);
    const ff = spawn(ffmpeg, ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '17', '-preset', 'medium', '-movflags', '+faststart', out], { stdio: ['pipe', 'ignore', 'inherit'] });
    const n0 = Math.round(from * FPS), n1 = Math.round(to * FPS);
    for (let i = n0; i < n1; i++) {
      await p.evaluate(t => window.render(t), i / FPS);
      const buf = await p.screenshot({ type: 'jpeg', quality: 93 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 300 === 0) console.log('frame', i, '/', n1);
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
  }
  await b.close(); console.log('done');
})();
