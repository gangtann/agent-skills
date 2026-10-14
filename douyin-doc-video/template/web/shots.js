// 各镜头的画面与文字（起步模板，按分镜重写 SH）。完整范例：examples/revenge_sleep/shots.js
// 默认横屏，坐标 1920×1080（W/H/FMT 来自 lib.js）。文字安全区 x 140–1700、y 90–760；字幕固定在 y≈784（main.js 负责）
// 横屏构图：主体放左右三分线，文字放另一侧；不要把竖屏的「上字下图」直接搬过来
// 每个镜头：{ draw(ctx, lt, D, Q), txt:[...], gl?, glo?, fadeIn?, fadeOut?, cutIn?, cutOut?, grain? }
//   lt = 镜头内时间，D = 镜头时长，Q[i] = 本镜头第 i 句旁白开始的镜头内时间（文字跟旁白走）
//   txt 项：{ h:html, c:css 类(k/h/h2/q/n/n2/n3/b/b2/s/en), x, y, w?, a?:'center', at:[句号, 偏移] 或秒,
//            out?:[句号, 偏移], dur?, rise?, css?, fn?(lt,Q)→html（数字滚动之类的动态内容）}
//   gl：'night' | 'title' | 'tower' | 'dawn' 用 3D 城市（city.js）做底，draw 再往上叠 2D
const off = document.createElement('canvas'); off.width = W; off.height = H; const octx = off.getContext('2d');
// 剪影 + 轮廓光：先画剪影，再用光源只照亮剪影本身
function lit(ctx, drawFn, lights) {
  octx.setTransform(1, 0, 0, 1, 0, 0); octx.globalCompositeOperation = 'source-over'; octx.clearRect(0, 0, W, H);
  octx.setTransform(ctx.getTransform()); drawFn(octx); octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.globalCompositeOperation = 'source-atop';
  lights.forEach(([x, y, r, col, a]) => {
    const p = ctx.getTransform().transformPoint(new DOMPoint(x, y)), s = ctx.getTransform().a;
    const g = octx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * s);
    g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0)); octx.fillStyle = g; octx.fillRect(0, 0, W, H);
  });
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(off, 0, 0); ctx.restore();
}
// 压暗带：文字压在亮画面上时必须垫一层。dir>0：从顶边实色压暗到 y0，再渐隐到 y1；dir<0：从底边往上
const scrim = (ctx, y0, y1, a = .7, dir = 1) => {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, `rgba(4,7,13,${a})`); g.addColorStop(1, 'rgba(4,7,13,0)');
  ctx.fillStyle = `rgba(4,7,13,${a})`;
  if (dir > 0) ctx.fillRect(0, 0, W, y0); else ctx.fillRect(0, y0, W, H - y0);
  ctx.fillStyle = g; ctx.fillRect(0, Math.min(y0, y1), W, Math.abs(y1 - y0));
};
// 侧向压暗：文字放在左侧（或右侧，dir<0）时，从该侧实色压暗到 x0，再渐隐到 x1
const scrimX = (ctx, x0, x1, a = .7, dir = 1) => {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, `rgba(4,7,13,${a})`); g.addColorStop(1, 'rgba(4,7,13,0)');
  ctx.fillStyle = `rgba(4,7,13,${a})`;
  if (dir > 0) ctx.fillRect(0, 0, x0, H); else ctx.fillRect(x0, 0, W - x0, H);
  ctx.fillStyle = g; ctx.fillRect(Math.min(x0, x1), 0, Math.abs(x1 - x0), H);
};
const skyTop = (ctx, col, a) => {   // 3D 场景顶部的天空渐隐，增加纵深
  const g = ctx.createLinearGradient(0, 0, 0, H * .47); g.addColorStop(0, rgba(col, a));
  g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * .47);
};
const screenCol = t => ['#9fc4ff', '#ffc98a', '#c6b2ff', '#8fe0d0'][Math.floor(t / .85) % 4];   // 手机屏幕光轮换

function chapter(num, title, warm) {
  return {
    draw(ctx, lt) {
      vgrad(ctx, warm ? [[0, '#0b0806'], [.5, '#171009'], [1, '#07050a']] : [[0, '#04070d'], [.5, '#0a1322'], [1, '#04060b']]);
      bokeh(ctx, num * 31 + 3, 14, lt, { rmin: 40, rmax: 140, a: .10, drift: 10, cols: warm ? [C.amber, C.warm] : [C.cold, C.blue, C.amber] });
      const e = eo(seg(lt, .3, 1.4));
      ctx.strokeStyle = rgba(warm ? C.amber : C.cold, .6); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(210, 560); ctx.lineTo(210 + 320 * e, 560); ctx.stroke();
    },
    txt: [
      { h: String(num).padStart(2, '0'), c: 'n3', x: 208, y: 460, at: .2, css: `color:${warm ? '#ffb35a' : '#9cbce6'}` },
      { h: title, c: 'h2', x: 206, y: 590, w: 1300, at: .5 },
    ], fadeIn: .6, fadeOut: .6
  };
}

const SH = {
  // 钩子：开头 3 秒内一个强画面 + 一句戳心的问题（这里用 3D 夜城摇臂 + 窗光做示意）
  S01: {
    gl: 'night',
    draw(ctx, lt, D, Q) { skyTop(ctx, '#02040a', .85); scrimX(ctx, 380, 1000, .55); },
    txt: [{ h: '凌晨两点', c: 'h', x: 180, y: 300, at: [0, .1] }], fadeIn: 1.2
  },
  TITLE: {
    gl: 'title',
    draw(ctx) { skyTop(ctx, '#02040a', .9); ctx.fillStyle = 'rgba(3,6,12,.35)'; ctx.fillRect(0, 0, W, H); },
    txt: [
      { h: '主 题 词', c: 'k', x: 0, y: 330, w: W, a: 'center', at: .2 },
      { h: '片名第一行<br>片名第二行', c: 'h', x: 0, y: 400, w: W, a: 'center', at: .6 },
    ], fadeIn: .5, fadeOut: .6
  },
  CH1: chapter(1, '第一章标题'),
  // 数据镜头：数字滚动 + 来源小字；数据跟着说到它的那句旁白出现
  S02: {
    draw(ctx, lt, D, Q) {
      vgrad(ctx, [[0, '#04070d'], [1, '#0a1322']]);
      bokeh(ctx, 7, 18, lt, { rmin: 30, rmax: 120, a: .08, drift: 12, cols: [C.cold, C.amber] });
      const e = eo(seg(lt, Q[0] + .3, Q[0] + 1.6));
      ctx.fillStyle = rgba(C.amber, .9); ctx.fillRect(210, 560, 900 * e, 18); glow(ctx, 210 + 900 * e, 569, 60, C.amber, .4 * e);
    },
    txt: [
      { h: '示例指标', c: 'k', x: 206, y: 290, at: [0, 0] },
      { h: '', c: 'n', x: 200, y: 340, at: [0, .2], fn: (lt, Q) => (48.6 * eo(seg(lt, Q[0] + .3, Q[0] + 1.8))).toFixed(1) + '<span style="font-size:60px"> 小时</span>' },
      { h: '来源机构 · 报告名 · 年份', c: 's', x: 210, y: 620, at: [0, 1.2] },
    ]
  },
  // 收尾金句：一句记得住的话，居中，宋体
  S03: {
    draw(ctx, lt) {
      vgrad(ctx, [[0, '#020309'], [.7, '#070c18'], [1, '#0b1424']]);
      glow(ctx, W / 2, 640, 140, C.amber, .45); glow(ctx, W / 2, 640, 26, '#fff2d8', .9);
    },
    txt: [{ h: '一句记得住的话，<br>分成两行。', c: 'q', x: 0, y: 300, w: W, a: 'center', at: [0, .2] }], fadeOut: .8
  },
  // 片尾资料来源（build_timeline.py 自动追加 SRC 镜头）
  SRC: {
    draw(ctx) { vgrad(ctx, [[0, '#03050a'], [1, '#060a12']]); },
    txt: [
      { h: '资料来源', c: 'k', x: 180, y: 120, at: .2 },
      { h: '来源一<br>来源二', c: 's', x: 180, y: 180, w: 1500, at: .4, css: 'font-size:24px;line-height:1.9;color:#a8b2c4;column-count:2;column-gap:80px' },
    ], fadeOut: .6
  },
};
