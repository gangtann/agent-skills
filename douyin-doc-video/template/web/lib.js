// 通用绘图工具
// 画幅：横屏 1920×1080（默认）或竖屏 1080×1920，由工程里的 format.json 决定，rec.js 通过 ?fmt= 传进来
// safe = 画面文字安全区 [x0, y0, x1, y1]；sub = 字幕框（固定位置）与每段最多字数
const FORMATS = {
  landscape: { w: 1920, h: 1080, safe: [140, 90, 1700, 760], sub: { top: 784, left: 310, width: 1300, size: 52, max: 20 } },
  cover: { w: 1440, h: 1080, safe: [100, 100, 1340, 980], sub: { top: 0, left: 0, width: 0, size: 0, max: 0 } },   // 横封面 4:3（web/cover.html）
  portrait: { w: 1080, h: 1920, safe: [72, 300, 900, 1240], sub: { top: 1312, left: 110, width: 820, size: 42, max: 17 } },
};
const FORMAT = new URLSearchParams(location.search).get('fmt') || 'landscape', FMT = FORMATS[FORMAT], W = FMT.w, H = FMT.h;
const C = {
  night: '#05080f', deep: '#0b1424', navy: '#12213a', blue: '#3a5a8a', cold: '#9cbce6',
  ice: '#d7e6fa', amber: '#ffb35a', warm: '#ff8c42', ember: '#e2572b', text: '#eef2f7', mute: '#8b95a8'
};
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const ease = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const eo = x => 1 - Math.pow(1 - x, 3);
const lerp = (a, b, t) => a + (b - a) * t;
function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function hex2rgb(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function rgba(h, a) { const [r, g, b] = hex2rgb(h); return `rgba(${r},${g},${b},${a})`; }
function mix(h1, h2, t) { const a = hex2rgb(h1), b = hex2rgb(h2); return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], t))).join(',')})`; }

function vgrad(ctx, stops, y0 = 0, y1 = H) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function glow(ctx, x, y, r, col, a = 1, op = 'lighter') {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(col, a)); g.addColorStop(.35, rgba(col, a * .45)); g.addColorStop(1, rgba(col, 0));
  ctx.save(); ctx.globalCompositeOperation = op; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); ctx.restore();
}
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
// 虚化光斑：景深背景
function bokeh(ctx, seed, n, t, o = {}) {
  const r = rng(seed), cols = o.cols || [C.amber, C.cold, C.warm];
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const x = r() * W, y = (o.y0 ?? 0) + r() * ((o.y1 ?? H) - (o.y0 ?? 0)), s = (o.rmin ?? 18) + r() * ((o.rmax ?? 70) - (o.rmin ?? 18));
    const sp = (r() - .5) * (o.drift ?? 8), ph = r() * 6.28, col = cols[Math.floor(r() * cols.length)];
    const a = (o.a ?? .22) * (.5 + .5 * Math.sin(t * .6 + ph));
    const xx = x + sp * t, g = ctx.createRadialGradient(xx, y, 0, xx, y, s);
    g.addColorStop(0, rgba(col, a)); g.addColorStop(.7, rgba(col, a * .6)); g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(xx, y, s, 0, 6.29); ctx.fill();
  }
  ctx.restore();
}
// 镜头：围绕 (cx,cy) 缩放 + 平移
function cam(ctx, s, cx, cy, dx = 0, dy = 0) {
  ctx.translate(cx + dx, cy + dy); ctx.scale(s, s); ctx.translate(-cx, -cy);
}
// 手机
function phone(ctx, x, y, w, h, screen, o = {}) {
  ctx.save();
  if (o.rot) { ctx.translate(x + w / 2, y + h / 2); ctx.rotate(o.rot); ctx.translate(-x - w / 2, -y - h / 2); }
  rrect(ctx, x - 10, y - 10, w + 20, h + 20, w * .14); ctx.fillStyle = '#0a0d13'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(160,180,210,.25)'; ctx.stroke();
  rrect(ctx, x, y, w, h, w * .11); ctx.save(); ctx.clip();
  screen && screen(ctx, x, y, w, h);
  ctx.restore();
  ctx.restore();
}
// 人物剪影 —— 头肩（站立，地铁）
function bust(ctx, x, y, s, col, phoneGlow) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = col;
  ctx.beginPath(); ctx.ellipse(0, -128, 34, 42, 0, 0, 6.29); ctx.fill();          // 头
  ctx.beginPath(); ctx.moveTo(-18, -92); ctx.lineTo(18, -92); ctx.lineTo(22, -70); ctx.lineTo(-22, -70); ctx.fill(); // 脖子
  ctx.beginPath(); ctx.moveTo(-90, 120); ctx.bezierCurveTo(-92, -10, -70, -66, 0, -72);
  ctx.bezierCurveTo(70, -66, 92, -10, 90, 120); ctx.closePath(); ctx.fill();       // 肩
  ctx.restore();
  if (phoneGlow) glow(ctx, x + 6 * s, y - 40 * s, 120 * s, phoneGlow, .55);
}
// 平躺的人（侧面），头在左
function lying(ctx, x, y, s, col) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = col;
  ctx.beginPath(); // 头侧影：后脑-额头-鼻-嘴-下巴
  ctx.moveTo(-60, 10); ctx.bezierCurveTo(-70, -40, -40, -78, 0, -80);
  ctx.bezierCurveTo(30, -82, 46, -70, 50, -54); ctx.lineTo(60, -40); ctx.lineTo(52, -34);
  ctx.bezierCurveTo(56, -26, 50, -20, 46, -18); ctx.bezierCurveTo(48, -10, 44, 0, 34, 2);
  ctx.bezierCurveTo(20, 16, -10, 30, -60, 10); ctx.fill();
  // 被子起伏
  ctx.beginPath(); ctx.moveTo(-40, 30); ctx.bezierCurveTo(60, -10, 200, -60, 380, -40);
  ctx.bezierCurveTo(560, -20, 700, -70, 900, -30); ctx.lineTo(900, 60); ctx.lineTo(-40, 60); ctx.fill();
  ctx.restore();
}
// 胶片颗粒 + 暗角
let grainTiles = null;
function initGrain() {
  grainTiles = [];
  for (let k = 0; k < 6; k++) {
    const c = document.createElement('canvas'); c.width = 360; c.height = 640;
    const g = c.getContext('2d'), d = g.createImageData(360, 640), r = rng(k * 99 + 7);
    for (let i = 0; i < d.data.length; i += 4) { const v = 128 + (r() - .5) * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0); grainTiles.push(c);
  }
}
function grainVignette(ctx, t, amt = .055) {
  if (!grainTiles) initGrain();
  ctx.save(); ctx.globalAlpha = amt; ctx.globalCompositeOperation = 'overlay';
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(grainTiles[Math.floor(t * 24) % 6], 0, 0, W, H); ctx.restore();
  const g = ctx.createRadialGradient(W / 2, H * .46, H * .22, W / 2, H * .5, H * .78);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.62)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
// 数字滚动格式
const fmtInt = n => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
