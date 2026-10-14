// 各镜头的画面与文字。坐标：1080×1920；文字安全区 x 72–900，y 300–1240；字幕在 y≈1312
const off = document.createElement('canvas'); off.width = W; off.height = H; const octx = off.getContext('2d');
// 先画剪影，再用光源只照亮剪影本身（轮廓光）
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
const scrim = (ctx, y0, y1, a = .7, dir = 1) => {   // dir>0：顶部压暗到 y1；dir<0：底部压暗到 y1
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, `rgba(4,7,13,${a})`); g.addColorStop(1, 'rgba(4,7,13,0)');
  ctx.fillStyle = `rgba(4,7,13,${a})`;
  if (dir > 0) ctx.fillRect(0, 0, W, y0); else ctx.fillRect(0, y0, W, H - y0);
  ctx.fillStyle = g; ctx.fillRect(0, Math.min(y0, y1), W, Math.abs(y1 - y0));
};
const skyTop = (ctx, col, a) => {   // 天空从顶部向下渐隐，给 3D 场景加纵深
  const g = ctx.createLinearGradient(0, 0, 0, 900); g.addColorStop(0, col.startsWith('rgb') ? col.replace('rgb', 'rgba').replace(')', `,${a})`) : rgba(col, a));
  g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, 900);
};
const screenCol = t => { const k = Math.floor(t / .85) % 4; return ['#9fc4ff', '#ffc98a', '#c6b2ff', '#8fe0d0'][k]; };

// ———— 卧室（S01 / S25 共用）：仰躺的侧脸特写，手机在脸上方 ————
// 正立、面朝右的侧脸轮廓（头高约 340），之后旋转 -90°，脸朝上
function headPath(g) {
  g.beginPath(); g.moveTo(0, 0);
  g.bezierCurveTo(50, -18, 120, -8, 140, 50);      // 头顶 → 额头
  g.bezierCurveTo(150, 80, 152, 100, 150, 116);    // 额
  g.bezierCurveTo(156, 122, 154, 132, 147, 140);   // 眉骨
  g.bezierCurveTo(160, 160, 178, 176, 186, 188);   // 鼻梁 → 鼻尖
  g.bezierCurveTo(186, 196, 174, 200, 162, 202);   // 鼻底
  g.bezierCurveTo(162, 210, 166, 218, 170, 226);   // 人中 → 上唇
  g.bezierCurveTo(166, 232, 160, 236, 160, 240);   // 唇缝
  g.bezierCurveTo(166, 246, 166, 254, 158, 262);   // 下唇
  g.bezierCurveTo(152, 268, 152, 276, 160, 290);   // 颏唇沟 → 下巴
  g.bezierCurveTo(162, 304, 150, 316, 126, 320);   // 下巴底
  g.bezierCurveTo(118, 334, 116, 350, 118, 380);   // 颈前
  g.lineTo(10, 400); g.bezierCurveTo(4, 330, -30, 300, -44, 220);   // 颈后 → 后脑
  g.bezierCurveTo(-58, 130, -40, 30, 0, 0); g.closePath();
}
function bedroom(ctx, lt, D, o) {
  vgrad(ctx, [[0, '#03050a'], [.5, '#060a12'], [1, '#03040a']]);
  const s = o.scale, pl = o.phone, mo = o.moon, col = screenCol(lt);
  ctx.save(); cam(ctx, s, 520, 900);
  // 月光：极淡的窗格
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .025 + mo * .11; ctx.filter = 'blur(18px)';
  for (let i = 0; i < 3; i++) { ctx.fillStyle = '#7d9bd0'; ctx.fillRect(700 + i * 90, 260, 66, 360); }
  ctx.restore();
  if (o.clock) {
    ctx.save(); ctx.filter = 'blur(3px)'; ctx.font = '400 56px "DIN Alternate"'; ctx.fillStyle = rgba('#ff5d3a', .85); ctx.textAlign = 'center';
    ctx.shadowColor = '#ff4a20'; ctx.shadowBlur = 30; ctx.fillText(o.clock, 230, 600); ctx.restore();
    glow(ctx, 230, 585, 150, '#ff4a20', .12);
  }
  // 枕头、被子（暗）
  ctx.fillStyle = '#0a0f1a'; ctx.beginPath(); ctx.ellipse(330, 1185, 460, 80, -.02, 0, 6.29); ctx.fill();
  ctx.fillStyle = '#080c15'; ctx.beginPath(); ctx.moveTo(640, 1120); ctx.bezierCurveTo(760, 1050, 880, 1080, 1100, 1050); ctx.lineTo(1100, 1500); ctx.lineTo(560, 1500); ctx.closePath(); ctx.fill();
  // 手臂与手（不受光，只有一道边缘光）
  ctx.fillStyle = '#05080e'; ctx.beginPath(); ctx.moveTo(820, 1160); ctx.bezierCurveTo(780, 1020, 700, 880, 660, 790); ctx.lineTo(724, 770); ctx.bezierCurveTo(770, 870, 850, 1010, 910, 1120); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.ellipse(690, 760, 46, 62, -.5, 0, 6.29); ctx.fill();
  ctx.strokeStyle = rgba(col, .35 * pl); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(662, 800); ctx.bezierCurveTo(700, 880, 780, 1020, 818, 1150); ctx.stroke();
  // 侧脸：仰躺，脸朝上
  ctx.save(); ctx.translate(170, 1215); ctx.rotate(-Math.PI / 2); ctx.scale(1.55, 1.55);
  headPath(ctx); ctx.fillStyle = '#070a11'; ctx.fill();
  ctx.save(); ctx.clip();       // 面部受光：沿脸的方向由暗到亮
  const fg = ctx.createLinearGradient(40, 0, 190, 0); fg.addColorStop(0, rgba(col, 0)); fg.addColorStop(1, rgba(col, .42 * pl + .06 * mo));
  ctx.fillStyle = fg; ctx.fillRect(-80, -40, 300, 460); ctx.restore();
  const rg = ctx.createLinearGradient(110, 0, 190, 0); rg.addColorStop(0, rgba(col, 0)); rg.addColorStop(1, rgba('#ffffff', .85 * pl + .2 * mo));
  ctx.strokeStyle = rg; ctx.lineWidth = 2.2; headPath(ctx); ctx.stroke();
  ctx.restore();
  // 手机：屏幕朝下，只见机身边缘和溢出的光
  ctx.save(); ctx.translate(560, 690); ctx.rotate(.22);
  rrect(ctx, -130, -28, 260, 32, 12); ctx.fillStyle = '#04060a'; ctx.fill();
  ctx.fillStyle = rgba(col, .95 * pl); ctx.fillRect(-122, 2, 244, 4); ctx.restore();
  if (pl > 0) { glow(ctx, 520, 860, 380, col, .20 * pl); glow(ctx, 470, 980, 170, col, .22 * pl); }
  ctx.restore();
}
function chapter(num, title, warm) {
  return {
    draw(ctx, lt, D) {
      vgrad(ctx, warm ? [[0, '#0b0806'], [.5, '#171009'], [1, '#07050a']] : [[0, '#04070d'], [.5, '#0a1322'], [1, '#04060b']]);
      bokeh(ctx, num * 31 + 3, 14, lt, { rmin: 40, rmax: 140, a: .10, drift: 10, cols: warm ? [C.amber, C.warm] : [C.cold, C.blue, C.amber] });
      const e = eo(seg(lt, .3, 1.4));
      ctx.strokeStyle = rgba(warm ? C.amber : C.cold, .6); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(110, 900); ctx.lineTo(110 + 280 * e, 900); ctx.stroke();
    },
    txt: [
      { h: String(num).padStart(2, '0'), c: 'n3', x: 108, y: 790, at: .2, css: `color:${warm ? '#ffb35a' : '#9cbce6'}` },
      { h: title, c: 'h2', x: 106, y: 930, w: 820, at: .5 },
    ], fadeIn: .6, fadeOut: .6
  };
}

const SH = {
  S01: {
    draw(ctx, lt, D) { bedroom(ctx, lt, D, { scale: lerp(1, 1.14, ease(clamp(lt / D))), phone: 1, moon: .2, clock: '02:00' }); },
    txt: [], fadeIn: 1.4
  },
  S02: {
    gl: 'night',
    draw(ctx, lt, D, Q) {
      skyTop(ctx, '#02040a', .85); scrim(ctx, 260, 760, .6);
      const e = eo(seg(lt, Q[2], Q[2] + 1.2));
      if (e > 0) {       // 2022 vs 2026 光柱
        scrim(ctx, 1290, 820, .8, -1);
        const base = 1220, sc = 300 / 4.4;
        [[330, 2.0, C.cold, '2022'], [700, 4.4, C.amber, '2026']].forEach(([x, v, col, y], i) => {
          const h = v * sc * (i ? e : Math.min(1, e * 1.6));
          const g = ctx.createLinearGradient(0, base - h, 0, base); g.addColorStop(0, rgba(col, .95)); g.addColorStop(1, rgba(col, .15));
          ctx.fillStyle = g; ctx.fillRect(x - 40, base - h, 80, h); glow(ctx, x, base - h, 120, col, .35);
          ctx.font = '400 30px "DIN Alternate"'; ctx.fillStyle = rgba('#eef2f7', .8 * e); ctx.textAlign = 'center'; ctx.fillText(y, x, base + 40);
          ctx.font = '400 50px "DIN Alternate"'; ctx.fillStyle = rgba(col, e); ctx.fillText(v === 2 ? '2 亿' : '4.4 亿', x, base - h - 26);
        });
      }
    },
    txt: [
      { h: '凌晨 0–2 点 · 全国日均在线', c: 'k', x: 90, y: 330, at: [1, 0] },
      { h: '', c: 'n', x: 84, y: 380, at: [1, .2], out: [2, -.2], fn: (lt, Q) => { const v = 4.4 * eo(seg(lt, Q[1] + .2, Q[1] + 2.2)); return v.toFixed(1) + '<span style="font-size:80px"> 亿人</span>'; } },
      { h: 'QuestMobile《2026 夜经济洞察》· 2026.5 · 2022.9', c: 's', x: 90, y: 1250, at: [2, .6] },
    ], fadeIn: .7
  },
  TITLE: {
    gl: 'title',
    draw(ctx, lt) { skyTop(ctx, '#02040a', .9); ctx.fillStyle = 'rgba(3,6,12,.35)'; ctx.fillRect(0, 0, W, H); },
    txt: [
      { h: '报 复 性 熬 夜', c: 'k', x: 0, y: 700, w: 1080, a: 'center', at: .2 },
      { h: '夜里偷回来的时间<br>被谁拿走了', c: 'h', x: 0, y: 770, w: 1080, a: 'center', at: .6 },
    ], fadeIn: .5, fadeOut: .6
  },
  S04: {
    draw(ctx, lt, D, Q) {
      vgrad(ctx, [[0, '#04070d'], [1, '#08101c']]);
      ctx.save(); ctx.filter = 'blur(6px)'; bokeh(ctx, 41, 22, lt, { rmin: 30, rmax: 90, a: .16 }); ctx.restore();
      const k = eo(seg(lt, Q[1] - .3, Q[1] + .6)), cy = lerp(700, 560, k), R = lerp(270, 210, k);
      ctx.save(); cam(ctx, lerp(1, 1.04, lt / D), 540, cy);
      // 钟面
      const g = ctx.createRadialGradient(540, cy - 60, 20, 540, cy, R); g.addColorStop(0, '#1a2436'); g.addColorStop(1, '#0a0f19');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(540, cy, R, 0, 6.29); ctx.fill();
      ctx.strokeStyle = 'rgba(180,200,230,.35)'; ctx.lineWidth = 4; ctx.stroke();
      for (let i = 0; i < 60; i++) {
        const a = i / 60 * 6.283, l = i % 5 ? 10 : 26; ctx.strokeStyle = i % 5 ? 'rgba(200,215,240,.3)' : 'rgba(230,238,250,.8)'; ctx.lineWidth = i % 5 ? 2 : 4;
        ctx.beginPath(); ctx.moveTo(540 + Math.sin(a) * (R - 18), cy - Math.cos(a) * (R - 18)); ctx.lineTo(540 + Math.sin(a) * (R - 18 - l), cy - Math.cos(a) * (R - 18 - l)); ctx.stroke();
      }
      // 指针：22:40 → 00:10
      const m = lerp(22 * 60 + 40, 24 * 60 + 10, ease(seg(lt, .2, Q[0] + 2.4)));
      const ha = (m / 60 % 12) / 12 * 6.283, ma = (m % 60) / 60 * 6.283;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#e8eef8'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(540, cy); ctx.lineTo(540 + Math.sin(ha) * R * .5, cy - Math.cos(ha) * R * .5); ctx.stroke();
      ctx.strokeStyle = C.amber; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(540, cy); ctx.lineTo(540 + Math.sin(ma) * R * .78, cy - Math.cos(ma) * R * .78); ctx.stroke();
      glow(ctx, 540 + Math.sin(ma) * R * .78, cy - Math.cos(ma) * R * .78, 60, C.amber, .4);
      ctx.fillStyle = '#e8eef8'; ctx.beginPath(); ctx.arc(540, cy, 12, 0, 6.29); ctx.fill();
      // 玻璃高光
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; const hg = ctx.createLinearGradient(540 - R, cy - R, 540, cy);
      hg.addColorStop(0, 'rgba(255,255,255,.10)'); hg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = hg;
      ctx.beginPath(); ctx.arc(540, cy, R - 6, Math.PI, 1.5 * Math.PI); ctx.lineTo(540, cy); ctx.fill(); ctx.restore();
      ctx.restore();
      // 十年时间轴
      if (k > 0) {
        const y = 1040, x0 = 120, x1 = 900, tx = h => x0 + (h - 21.5) / 4 * (x1 - x0);
        ctx.globalAlpha = k; ctx.strokeStyle = 'rgba(200,215,240,.35)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
        ctx.font = '400 26px "DIN Alternate"'; ctx.fillStyle = 'rgba(200,215,240,.6)'; ctx.textAlign = 'center';
        [22, 23, 24, 25].forEach(h => { ctx.fillRect(tx(h) - 1, y - 10, 2, 20); ctx.fillText(String(h % 24).padStart(2, '0') + ':00', tx(h), y + 48); });
        const e2 = ease(seg(lt, Q[1] + .5, Q[1] + 2.6)), xa = tx(24.55 - 2.1), xb = tx(24.55);
        ctx.setLineDash([6, 8]); ctx.strokeStyle = rgba(C.cold, .6); ctx.beginPath(); ctx.moveTo(xa, y - 34); ctx.lineTo(lerp(xa, xb, e2), y - 34); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = C.cold; ctx.beginPath(); ctx.arc(xa, y, 9, 0, 6.29); ctx.fill();
        ctx.fillStyle = C.amber; ctx.beginPath(); ctx.arc(lerp(xa, xb, e2), y, 12, 0, 6.29); ctx.fill(); glow(ctx, lerp(xa, xb, e2), y, 70, C.amber, .5);
        ctx.font = '500 28px "PingFang SC"'; ctx.fillStyle = rgba(C.cold, .9); ctx.fillText('2012', xa, y - 52);
        ctx.fillStyle = rgba(C.amber, e2); ctx.fillText('2021 · 00:33', xb - 10, y - 52);
        ctx.globalAlpha = 1;
      }
    },
    txt: [
      { h: '平均入睡 <span class="am" style="font:400 72px DIN Alternate">00:10</span>', c: 'b', x: 0, y: 1000, w: 1080, a: 'center', at: [0, .8], out: [1, -.5] },
      { h: '可穿戴设备实测 · 中国睡眠研究会《2026 中国睡眠健康研究白皮书》', c: 's', x: 0, y: 1100, w: 1080, a: 'center', at: [0, 1.2], out: [1, -.5] },
      { h: '入睡时间，推迟 <span class="am">2 小时以上</span>', c: 'b', x: 0, y: 860, w: 1080, a: 'center', at: [1, 1.0] },
      { h: '问卷口径 · 社科院 × 喜临门《中国睡眠研究报告（2022）》', c: 's', x: 0, y: 1150, w: 1080, a: 'center', at: [1, 1.4] },
    ], cutIn: false
  },
  S05: {
    draw(ctx, lt, D) {
      vgrad(ctx, [[0, '#030509'], [1, '#060a12']]);
      const x = lerp(-300, 1380, ease(seg(lt, .1, D * .9)));
      glow(ctx, x, 760, 700, '#7fa6e0', .22); glow(ctx, x, 760, 260, '#cfe0ff', .12);
    },
    txt: [
      { h: '报复性熬夜', c: 'h', x: 0, y: 640, w: 1080, a: 'center', at: .5, css: 'font-size:132px;letter-spacing:10px' },
      { h: 'REVENGE BEDTIME PROCRASTINATION', c: 'en', x: 0, y: 830, w: 1080, a: 'center', at: 1.1 },
      { h: '约 2018 年出现在中文网络 · 2020 年被译成英文', c: 'b2', x: 0, y: 930, w: 1080, a: 'center', at: 1.6 },
      { h: 'BBC Worklife 2020 · 中国青年报 2019', c: 's', x: 0, y: 1000, w: 1080, a: 'center', at: 1.9 },
    ]
  },
  S06: {
    draw(ctx, lt, D, Q) {
      vgrad(ctx, [[0, '#04060b'], [1, '#070b13']]);
      ctx.save(); ctx.filter = 'blur(10px)'; bokeh(ctx, 66, 16, lt, { rmin: 40, rmax: 110, a: .12 }); ctx.restore();
      const dim = 1 - .75 * eo(seg(lt, Q[1] - .2, Q[1] + .8)), dy = 60 * eo(seg(lt, Q[1] - .2, Q[1] + 1.2));
      const sway = Math.sin(lt * 1.3) * 4, col = screenCol(lt);
      glow(ctx, 640, 960 + dy, 520, col, .22 * dim);
      phone(ctx, 470 + sway, 640 + dy, 340, 640, (g, x, y, w, h) => {
        const k = Math.floor(lt / .85) % 3, bg = g.createLinearGradient(0, y, 0, y + h);
        bg.addColorStop(0, rgba(col, .9 * dim)); bg.addColorStop(1, rgba('#101826', dim)); g.fillStyle = bg; g.fillRect(x, y, w, h);
        g.globalAlpha = dim;
        if (k === 0) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x, y + h * .3, w, h * .32); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x + w / 2 - 22, y + h * .42); g.lineTo(x + w / 2 + 26, y + h * .46); g.lineTo(x + w / 2 - 22, y + h * .5); g.fill();
          g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x + 20, y + h * .66, w - 40, 6); g.fillStyle = C.amber; g.fillRect(x + 20, y + h * .66, (w - 40) * ((lt * .3) % 1), 6); }
        if (k === 1) for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = `hsla(${(i * 70 + j * 40 + lt * 40) % 360},70%,60%,.85)`; rrect(g, x + 24 + i * 76, y + 140 + j * 76, 64, 64, 12); g.fill(); }
        if (k === 2) for (let i = 0; i < 5; i++) { g.fillStyle = 'rgba(255,255,255,.18)'; rrect(g, x + 20, y + 60 + i * 120 - (lt * 160) % 120, w - 40, 104, 14); g.fill(); }
        g.globalAlpha = 1;
      }, { rot: -.06 });
      // 手
      ctx.fillStyle = '#0c111b'; ctx.beginPath(); ctx.moveTo(420 + sway, 1300 + dy); ctx.bezierCurveTo(430, 1150 + dy, 470, 1120 + dy, 520 + sway, 1180 + dy);
      ctx.lineTo(760 + sway, 1140 + dy); ctx.bezierCurveTo(840, 1160 + dy, 860, 1260 + dy, 820, 1320 + dy); ctx.closePath(); ctx.fill();
    },
    txt: [
      { h: '「我不睡，<br>只是因为舍不得。」', c: 'q', x: 90, y: 330, w: 820, at: [0, 1.6], out: [1, -.3] },
      { h: '— 某互联网大厂产品经理｜《时尚先生》2025', c: 's', x: 96, y: 520, w: 820, at: [0, 2.0], out: [1, -.3] },
      { h: '舍不得什么？', c: 'h2', x: 0, y: 420, w: 1080, a: 'center', at: [1, .1] },
    ], fadeOut: .8
  },
  CH1: chapter(1, '「报复」是真的'),
  S07: {
    draw(ctx, lt, D, Q) {
      vgrad(ctx, [[0, '#04070d'], [1, '#090f1a']]);
      const p1 = eo(seg(lt, Q[1] - .4, Q[1] + .4));
      // 电量
      if (p1 < 1) {
        ctx.globalAlpha = 1 - p1;
        const lv = 1 - ease(seg(lt, .3, Q[0] + 2.2)), x = 390, y = 560;
        rrect(ctx, x, y, 300, 150, 22); ctx.strokeStyle = '#cfd8e6'; ctx.lineWidth = 8; ctx.stroke();
        ctx.fillStyle = '#cfd8e6'; ctx.fillRect(x + 300, y + 50, 18, 50);
        ctx.fillStyle = lv > .25 ? C.cold : C.ember; ctx.fillRect(x + 16, y + 16, 268 * lv, 118);
        glow(ctx, x + 150, y + 75, 260, lv > .25 ? C.cold : C.ember, .2);
        ctx.globalAlpha = 1;
      }
      // 三扇门
      if (p1 > 0) {
        const push = ease(seg(lt, Q[3] - .2, D)), sc = lerp(1, 2.4, push);
        ctx.save(); cam(ctx, sc, 790, 820);
        const doors = [[150, C.cold], [440, C.cold], [730, C.amber]], hl = eo(seg(lt, Q[2], Q[2] + .8));
        doors.forEach(([x, col], i) => {
          const a = p1 * (i === 2 ? 1 : 1 - .6 * hl);
          ctx.fillStyle = '#060910'; ctx.fillRect(x - 12, 580, 224, 452);
          const g = ctx.createLinearGradient(0, 590, 0, 1020); g.addColorStop(0, rgba(col, .85 * a)); g.addColorStop(1, rgba(col, .25 * a));
          ctx.fillStyle = g; ctx.fillRect(x, 592, 200, 428);
          glow(ctx, x + 100, 1030, 260, col, .35 * a);
          ctx.fillStyle = rgba(col, .18 * a); ctx.beginPath(); ctx.moveTo(x, 1020); ctx.lineTo(x + 200, 1020); ctx.lineTo(x + 260, 1240); ctx.lineTo(x - 60, 1240); ctx.fill();
        });
        ctx.restore();
        const dk = ease(seg(lt, Q[3], Q[3] + 1.2)); ctx.fillStyle = `rgba(20,12,4,${.55 * dk})`; ctx.fillRect(0, 0, W, H);
      }
    },
    txt: [
      { h: '意志力耗尽？', c: 'h2', x: 0, y: 780, w: 1080, a: 'center', at: [0, .6], out: [1, -.5] },
      { h: '两项大型重复实验：效应接近 0<br>Hagger 2016 · Vohs 2021', c: 's', x: 0, y: 890, w: 1080, a: 'center', at: [0, 2.0], out: [1, -.5], css: 'font-size:26px' },
      { h: '心理学 · 三种晚睡的人', c: 'k', x: 96, y: 360, at: [1, .3], out: [3, 0] },
      { h: '<span style="display:inline-block;width:280px;text-align:center">忘了时间</span><span style="display:inline-block;width:300px;text-align:center">以为晚睡好睡</span><span class="am" style="display:inline-block;width:250px;text-align:center">故意的</span>', c: 'b2', x: 110, y: 470, w: 900, at: [1, .6], out: [3, 0] },
      { h: 'Nauts et al., Behavioral Sleep Medicine 2019', c: 's', x: 96, y: 1170, at: [1, 1], out: [3, 0] },
      { h: '「我理应有一段<br>自己的时间」', c: 'q', x: 0, y: 420, w: 1080, a: 'center', at: [3, .5] },
    ]
  },
  S08: {
    draw(ctx, lt, D) {
      vgrad(ctx, [[0, '#0b1018'], [.5, '#121a26'], [1, '#080c14']]);
      const vx = 540, vy = 700, z = lt * .35;
      ctx.strokeStyle = 'rgba(150,170,200,.18)'; ctx.lineWidth = 2;
      [[0, 300], [1080, 300], [0, 1300], [1080, 1300]].forEach(([x, y]) => { ctx.beginPath(); ctx.moveTo(vx, vy); ctx.lineTo(x, y); ctx.stroke(); });
      for (let i = 0; i < 9; i++) {      // 天花板灯管向前流动
        const d = ((i + z) % 9) / 9, s = Math.pow(d, 2.2), y = lerp(vy - 8, 160, s), w = lerp(10, 640, s), h = lerp(2, 40, s);
        ctx.fillStyle = rgba('#e6f0ff', .25 + .6 * d); ctx.fillRect(vx - w / 2, y, w, h); glow(ctx, vx, y + h, w * .7, '#cfe0ff', .12 * d);
        const fy = lerp(vy + 8, 1700, s); ctx.fillStyle = rgba('#cfe0ff', .05 * d); ctx.fillRect(vx - w / 2, fy, w, h * 1.5);
      }
      // 日程条：被别人的事填满
      const x0 = 150, x1 = 930, y = 840, e = seg(lt, .4, D * .75);
      ctx.fillStyle = 'rgba(10,14,22,.65)'; rrect(ctx, x0 - 30, y - 70, x1 - x0 + 60, 170, 18); ctx.fill();
      ctx.font = '400 22px "DIN Alternate"'; ctx.fillStyle = 'rgba(200,215,240,.6)'; ctx.textAlign = 'center';
      for (let h = 7; h <= 22; h++) { const x = lerp(x0, x1, (h - 7) / 15); ctx.fillText(String(h).padStart(2, '0'), x, y - 30); }
      const blocks = [[7, 8], [8, 12], [12.5, 13], [13, 17.5], [17.5, 19], [19.5, 21.5]];
      blocks.forEach(([a, b], i) => {
        const k = clamp(e * blocks.length - i); if (k <= 0) return;
        const xa = lerp(x0, x1, (a - 7) / 15), xb = lerp(xa, lerp(x0, x1, (b - 7) / 15), eo(k));
        ctx.fillStyle = rgba(C.cold, .55); rrect(ctx, xa, y, Math.max(4, xb - xa - 4), 50, 8); ctx.fill();
      });
    },
    txt: [
      { h: '「白天的我，<br>不是真正的我」', c: 'q', x: 0, y: 980, w: 1080, a: 'center', at: [0, 1.2] },
      { h: '— 一位规培医生（转述）｜紫牛新闻 2026', c: 's', x: 0, y: 1160, w: 1080, a: 'center', at: [0, 1.6] },
    ]
  },
  S09: {
    draw(ctx, lt, D, Q) {
      vgrad(ctx, [[0, '#05080f'], [1, '#0a111d']]);
      const cx = 540, cy = 700, R = 270, rot = lt * .01;
      ctx.lineWidth = 56; ctx.strokeStyle = 'rgba(120,140,170,.12)'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.29); ctx.stroke();
      ctx.font = '400 26px "DIN Alternate"'; ctx.fillStyle = 'rgba(200,215,240,.5)'; ctx.textAlign = 'center';
      [0, 6, 12, 18].forEach(h => { const a = h / 24 * 6.283 - Math.PI / 2; ctx.fillText(String(h).padStart(2, '0'), cx + Math.cos(a) * (R + 62), cy + Math.sin(a) * (R + 62) + 9); });
      const arc = (h0, len, col, k, glowA = 0) => {
        if (k <= 0) return; const a0 = h0 / 24 * 6.283 - Math.PI / 2, a1 = a0 + len / 24 * 6.283 * k;
        ctx.strokeStyle = col; ctx.lineWidth = 56; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.arc(cx, cy, R, a0, a1); ctx.stroke();
        if (glowA) { const am = (a0 + a1) / 2; glow(ctx, cx + Math.cos(am) * R, cy + Math.sin(am) * R, 200, col, glowA); }
      };
      arc(9, 6 + 23 / 60, C.blue, eo(seg(lt, Q[0] + .6, Q[0] + 2)));
      arc(15.5, 62 / 60, '#5c6f8c', eo(seg(lt, Q[1] + .2, Q[1] + 1)));
      const mv = ease(seg(lt, Q[2] + .2, Q[2] + 2.4)), free0 = lerp(17, 22, mv);
      arc(free0, 3.5, C.amber, eo(seg(lt, Q[1] + 1.4, Q[1] + 2.6)), .25);
    },
    txt: [
      { h: '一天 24 小时', c: 'k', x: 96, y: 330, at: [0, .2] },
      { h: '<span class="am" style="font:400 96px DIN Alternate">3:30</span><br><span class="b2">自由支配</span>', c: 'b', x: 0, y: 610, w: 1080, a: 'center', at: [1, 2.0] },
      { h: '<span class="co">■</span> 有酬劳动 6:23　<span style="color:#5c6f8c">■</span> 交通 1:02　<span class="am">■</span> 自由 3:30', c: 'b2', x: 0, y: 1080, w: 1080, a: 'center', at: [1, 1.6], css: 'font-size:28px' },
      { h: '国家统计局 第三次全国时间利用调查（2024）· 参与者日均 · 位置为示意', c: 's', x: 0, y: 1150, w: 1080, a: 'center', at: [1, 2] },
    ]
  },
  S10: {
    draw(ctx, lt, D) {
      vgrad(ctx, [[0, '#04060c'], [1, '#080d17']]);
      const s = lerp(1, 1.9, ease(clamp(lt / D))), r = rng(1010);
      ctx.save(); cam(ctx, s, 620, 770, 0, -40 * ease(clamp(lt / D)));
      ctx.fillStyle = '#0c1220'; ctx.fillRect(120, 200, 860, 1300);
      const off = seg(lt, .4, D * .72);
      for (let j = 0; j < 12; j++) for (let i = 0; i < 7; i++) {
        const x = 160 + i * 116, y = 240 + j * 104, keep = i === 4 && j === 5, lit0 = r() < .62, tOff = r();
        ctx.fillStyle = '#060a12'; ctx.fillRect(x, y, 86, 70);
        if (keep) continue;
        if (lit0 && tOff > off) { const warm = r() < .7; ctx.fillStyle = warm ? rgba('#ffc98a', .78) : rgba('#cfe0ff', .6); ctx.fillRect(x, y, 86, 70); glow(ctx, x + 43, y + 35, 70, warm ? '#ffb070' : '#bcd4ff', .12); } else r();
      }
      // 留下的那扇：沙发上的人和手机光
      const x = 160 + 4 * 116, y = 240 + 5 * 104, col = screenCol(lt);
      ctx.fillStyle = '#0d1424'; ctx.fillRect(x, y, 86, 70);
      glow(ctx, x + 50, y + 40, 60, col, .55);
      ctx.fillStyle = '#04060a'; ctx.fillRect(x + 6, y + 48, 74, 22); ctx.beginPath(); ctx.arc(x + 46, y + 30, 9, 0, 6.29); ctx.fill(); ctx.fillRect(x + 38, y + 38, 18, 14);
      ctx.restore();
      scrim(ctx, 260, 560, .85); scrim(ctx, 1290, 1000, .85, -1);
    },
    txt: [
      { h: '属于自己的时间，从', c: 'k', x: 96, y: 330, at: [0, .5] },
      { h: '22:00 以后', c: 'n2', x: 90, y: 380, at: [0, .9] },
      { h: '48.7% 的中年女性这样说', c: 'b2', x: 96, y: 1100, at: [0, 1.8] },
      { h: '喜临门《2026 中国睡眠指数报告》（企业报告）', c: 's', x: 96, y: 1160, at: [0, 2.2] },
    ]
  },
  CH2: chapter(2, '白天是怎样被拿走的'),
  S11: {
    gl: 'tower',
    draw(ctx, lt, D, Q) {
      skyTop(ctx, '#02040a', .7); scrim(ctx, 1290, 820, .88, -1);
      const e = eo(seg(lt, Q[1] + .6, Q[1] + 2.2)), x0 = 96, x1 = 900, sc = (x1 - x0) / 60, y = 1110;
      ctx.fillStyle = `rgba(200,215,240,${.15 * clamp(e * 3)})`; ctx.fillRect(x0, y, x1 - x0, 26);
      ctx.fillStyle = C.amber; ctx.fillRect(x0, y, 48.6 * sc * e, 26); glow(ctx, x0 + 48.6 * sc * e, y + 13, 90, C.amber, .4 * e);
      const xm = x0 + 44 * sc; ctx.fillStyle = rgba(C.ice, clamp(e * 3)); ctx.fillRect(xm - 2, y - 26, 4, 78);
      ctx.font = '500 26px "PingFang SC"'; ctx.fillStyle = rgba(C.ice, e); ctx.textAlign = 'center'; ctx.fillText('法定 44', xm, y + 84);
    },
    txt: [
      { h: '周平均工作时间', c: 'k', x: 96, y: 920, at: [1, .2] },
      { h: '48.6<span style="font:500 40px PingFang SC;color:#eef2f7"> 小时</span>', c: 'n2', x: 90, y: 970, at: [1, .5] },
      { h: '国家统计局 · 全国企业就业人员 · 2025 年', c: 's', x: 96, y: 1220, at: [1, 1.2] },
    ], cutIn: false
  },
  S12: {
    draw(ctx, lt, D) {
      vgrad(ctx, [[0, '#26303f'], [.3, '#2e3a4c'], [.7, '#1d2532'], [1, '#121821']]);
      ctx.fillStyle = 'rgba(220,235,255,.5)'; ctx.fillRect(0, 300, W, 10); glow(ctx, 540, 310, 600, '#dbe8ff', .12);   // 车顶灯带
      // 车窗外的隧道光
      const wy0 = 620, wy1 = 960;
      ctx.fillStyle = '#020306'; ctx.fillRect(0, wy0, W, wy1 - wy0);
      const r = rng(12);
      for (let i = 0; i < 40; i++) {
        const y = wy0 + 20 + r() * (wy1 - wy0 - 40), sp = 2400 + r() * 1600, len = 200 + r() * 500, x = W - ((lt * sp + r() * 4000) % 4000) + 600;
        const g = ctx.createLinearGradient(x, 0, x + len, 0); g.addColorStop(0, 'rgba(255,190,120,0)'); g.addColorStop(1, rgba(r() < .7 ? '#ffc070' : '#cfe0ff', .7));
        ctx.fillStyle = g; ctx.fillRect(x, y, len, 2 + r() * 3);
      }
      const flash = Math.pow(Math.max(0, Math.sin(lt * 5.2)), 18);
      ctx.fillStyle = rgba('#ffd6a0', .10 * flash); ctx.fillRect(0, 0, W, H);
      // 车厢：扶手
      ctx.strokeStyle = 'rgba(160,175,200,.35)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(0, 580); ctx.lineTo(W, 580); ctx.stroke();
      for (let i = 0; i < 6; i++) { const x = 90 + i * 190 + Math.sin(lt * 1.6 + i) * 6; ctx.strokeStyle = 'rgba(160,175,200,.3)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, 580); ctx.lineTo(x, 650); ctx.stroke(); ctx.beginPath(); ctx.arc(x, 672, 22, 0, 6.29); ctx.stroke(); }
      // 站着的人
      [[160, 1260, 1.25], [430, 1300, 1.45], [720, 1250, 1.3], [960, 1290, 1.4], [300, 1430, 1.8], [820, 1450, 1.9]].forEach(([x, y, s], i) => {
        const sw = Math.sin(lt * 1.4 + i) * 5;
        const col = screenCol(lt + i * .3);
        bust(ctx, x + sw, y, s, i > 3 ? '#030509' : '#070b12', null);
        glow(ctx, x + sw + 4 * s, y - 120 * s, 60 * s, col, .22);
        ctx.fillStyle = rgba(col, .85); rrect(ctx, x + sw - 14 * s, y - 70 * s, 30 * s, 50 * s, 5 * s); ctx.fill();
        glow(ctx, x + sw, y - 50 * s, 40 * s, col, .35);
      });
    },
    txt: [
      { h: '28%', c: 'n', x: 84, y: 300, at: [0, .6] },
      { h: '北京通勤者，单程超过 1 小时', c: 'b2', x: 96, y: 486, at: [0, 1.1] },
      { h: '住建部等《2024 年中国主要城市通勤监测报告》', c: 's', x: 96, y: 540, at: [0, 1.4] },
    ]
  },
  S13: {
    draw(ctx, lt, D, Q) {
      vgrad(ctx, [[0, '#04060b'], [1, '#080c14']]);
      const out = eo(seg(lt, Q[1] - .4, Q[1] + .5));
      if (out < 1) {
        ctx.save(); ctx.globalAlpha = 1 - out; ctx.translate(-120 * out, 0);
        glow(ctx, 290, 760, 420, '#7f9fd8', .2);
        phone(ctx, 100, 370, 380, 760, (g, x, y, w, h) => {
          const bg = g.createLinearGradient(0, y, 0, y + h); bg.addColorStop(0, '#16233c'); bg.addColorStop(1, '#0a1020'); g.fillStyle = bg; g.fillRect(x, y, w, h);
          g.font = '400 92px "DIN Alternate"'; g.fillStyle = '#e8eef8'; g.textAlign = 'center'; g.fillText('23:47', x + w / 2, y + 150);
          const msgs = ['明早九点前交材料', '收到请回复', '@所有人 方案再改一版', '这个今晚能出吗', '明天会议提前到八点'];
          const n = Math.floor(clamp((lt - .3) / .55, 0, 5));
          for (let i = 0; i < n; i++) {
            const yy = y + 210 + (n - 1 - i) * 98, a = i === n - 1 ? eo(clamp(((lt - .3) / .55) % 1 * 2)) : 1;
            g.globalAlpha = a; g.fillStyle = 'rgba(255,255,255,.14)'; rrect(g, x + 16, yy, w - 32, 84, 16); g.fill();
            g.font = '600 20px "PingFang SC"'; g.fillStyle = '#cfd8e6'; g.textAlign = 'left'; g.fillText('工作群', x + 36, yy + 32);
            g.font = '400 22px "PingFang SC"'; g.fillStyle = '#eef2f7'; g.fillText(msgs[i], x + 36, yy + 64); g.globalAlpha = 1;
          }
        });
        ctx.restore();
      }
      if (out > 0) {   // 判决书
        ctx.save(); ctx.globalAlpha = out;
        ctx.fillStyle = '#e9e4d8'; ctx.translate(540, 760); ctx.rotate(-.03);
        ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 60; ctx.fillRect(-300, -330, 600, 700); ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(40,40,50,.22)'; for (let i = 0; i < 16; i++) ctx.fillRect(-240, -160 + i * 34, i % 4 === 3 ? 300 : 480, 10);
        ctx.font = '900 40px "Songti SC"'; ctx.fillStyle = '#2a2a30'; ctx.textAlign = 'center'; ctx.fillText('民 事 判 决 书', 0, -240);
        const st = eo(seg(lt, Q[2] + .2, Q[2] + .7));
        if (st > 0) {
          ctx.globalAlpha = out * st; ctx.translate(120, 200); ctx.rotate(-.18); ctx.scale(lerp(1.6, 1, st), lerp(1.6, 1, st));
          ctx.strokeStyle = '#c8342a'; ctx.lineWidth = 8; rrect(ctx, -150, -60, 300, 120, 14); ctx.stroke();
          ctx.font = '900 64px "Songti SC"'; ctx.fillStyle = '#c8342a'; ctx.fillText('属于加班', 0, 22);
        }
        ctx.restore();
      }
    },
    txt: [
      { h: '84.7%', c: 'n2', x: 530, y: 520, at: [0, .4], out: [1, -.5] },
      { h: '下班后<br>仍在看工作消息', c: 'b', x: 534, y: 640, w: 380, at: [0, .8], out: [1, -.5] },
      { h: '前程无忧 2022（企业调查）<br>群消息为示意', c: 's', x: 534, y: 790, w: 380, at: [0, 1.2], out: [1, -.5] },
      { h: '595.8 <span style="font:500 40px PingFang SC;color:#eef2f7">小时</span>', c: 'n2', x: 0, y: 300, w: 1080, a: 'center', at: [1, .4] },
      { h: '一年里，下班后处理工作（原告主张）', c: 'b2', x: 0, y: 1150, w: 1080, a: 'center', at: [1, .9] },
      { h: '「隐形加班第一案」· 北京三中院 2024 · 酌定支付 3 万元', c: 's', x: 0, y: 1210, w: 1080, a: 'center', at: [2, .6] },
    ]
  },
  S14: {
    draw(ctx, lt, D) {
      vgrad(ctx, [[0, '#04060c'], [.55, '#0b1424'], [1, '#05070c']]);
      // 远处城市轮廓：一动不动
      const r = rng(14); ctx.fillStyle = '#0e1828';
      let x = 0; while (x < W) { const w = 40 + r() * 90, h = 60 + r() * 220; ctx.fillRect(x, 900 - h, w, h); x += w + 4; }
      glow(ctx, 540, 900, 700, '#3a5a8a', .25);
      // 地面线：越来越快
      const speed = 1 + 9 * Math.pow(clamp(lt / D), 1.6), ph = lt * speed * .9;
      ctx.strokeStyle = 'rgba(160,190,230,.35)'; ctx.lineWidth = 2;
      for (let i = 0; i < 18; i++) { const d = ((i / 18 + ph) % 1), y = 900 + Math.pow(d, 2.4) * 900; ctx.globalAlpha = d; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      ctx.globalAlpha = 1;
      for (let i = -6; i <= 6; i++) { ctx.beginPath(); ctx.moveTo(540 + i * 20, 900); ctx.lineTo(540 + i * 420, 1900); ctx.stroke(); }
      // 原地奔跑的人
      const cyc = lt * (3 + speed * .8), cx = 540, by = 1130, sw = Math.sin(cyc * 6.283);
      ctx.save(); ctx.translate(cx, by); ctx.scale(1.6, 1.6); ctx.translate(-cx, -by);
      ctx.strokeStyle = '#03050a'; ctx.fillStyle = '#03050a'; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(cx + 8, by - 330, 34, 0, 6.29); ctx.fill();
      ctx.lineWidth = 46; ctx.beginPath(); ctx.moveTo(cx + 4, by - 280); ctx.lineTo(cx - 6, by - 150); ctx.stroke();
      ctx.lineWidth = 26;
      const leg = (s) => { ctx.beginPath(); ctx.moveTo(cx - 6, by - 150); ctx.lineTo(cx - 6 + 60 * s, by - 70); ctx.lineTo(cx - 6 + 40 * s - 30 * Math.max(0, -s), by); ctx.stroke(); };
      leg(sw); leg(-sw);
      const arm = (s) => { ctx.beginPath(); ctx.moveTo(cx + 2, by - 260); ctx.lineTo(cx + 2 - 50 * s, by - 200); ctx.lineTo(cx + 2 - 20 * s, by - 150); ctx.stroke(); };
      arm(sw); arm(-sw);
      ctx.restore();
      glow(ctx, cx, by - 330, 420, '#7fa6e0', .12);
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.ellipse(cx, by + 10, 120, 18, 0, 0, 6.29); ctx.fill();
    },
    txt: [
      { h: '社会加速', c: 'k', x: 96, y: 340, at: [0, .4] },
      { h: '急速的静止', c: 'h', x: 90, y: 390, at: [1, .3] },
      { h: '哈特穆特·罗萨《新异化的诞生》', c: 's', x: 96, y: 520, at: [1, .8] },
    ]
  },
  CH3: chapter(3, '为什么总是赢不了'),
  S15: {
    draw(ctx, lt, D, Q) {
      vgrad(ctx, [[0, '#04060c'], [1, '#080d16']]);
      ctx.save(); ctx.filter = 'blur(14px)'; ctx.globalAlpha = .7; bedroom(ctx, lt, D, { scale: 1.3, phone: 1, moon: .1 }); ctx.restore();
      ctx.fillStyle = 'rgba(4,7,13,.72)'; ctx.fillRect(0, 0, W, H);
      const rows = [['刷短视频', 71.6, C.amber], ['打游戏', 36.1, '#8f9bb3'], ['看剧', 35.9, '#8f9bb3'], ['加班', 23.6, C.cold]];
      rows.forEach(([lab, v, col], i) => {
        const y = 540 + i * 160, s = i === 3 ? Q[2] + .3 : Q[1] + .3 + i * .35, e = eo(seg(lt, s, s + 1.1)), x0 = 96, len = v / 80 * 780 * e;
        ctx.globalAlpha = clamp(e * 2); ctx.font = '500 34px "PingFang SC"'; ctx.fillStyle = '#dfe6f2'; ctx.textAlign = 'left'; ctx.fillText(lab, x0, y);
        ctx.fillStyle = 'rgba(200,215,240,.08)'; ctx.fillRect(x0, y + 26, 780, 34);
        ctx.fillStyle = col; ctx.fillRect(x0, y + 26, len, 34); if (i === 0 || i === 3) glow(ctx, x0 + len, y + 43, 100, col, .4 * e);
        ctx.font = '400 46px "DIN Alternate"'; ctx.fillStyle = col; ctx.textAlign = 'right'; ctx.fillText((v * e).toFixed(1) + '%', 900, y);
        ctx.globalAlpha = 1;
      });
    },
    txt: [
      { h: '熬夜的时候，在做什么', c: 'k', x: 96, y: 360, at: [0, .6] },
      { h: '中国青年报社会调查中心 2022 · 1532 名青年 · 可多选', c: 's', x: 96, y: 1170, at: [1, .8] },
    ]
  },
  S16: {
    draw(ctx, lt, D, Q) {
      vgrad(ctx, [[0, '#04060c'], [1, '#090e18']]);
      const stopT = Q[2] + .4, v = lt < stopT ? 300 + 900 * Math.pow(clamp(lt / stopT), 2) : 0;
      if (!this._y) this._y = 0;
      // 用积分算位置，保证确定性
      const pos = t => { const T = Math.min(t, stopT), a = 900 / Math.pow(stopT, 2); let p = 300 * T + a * Math.pow(T, 3) / 3; if (t > stopT) p += 40 * (1 - Math.exp(-(t - stopT) * 6)); return p; };
      const y0 = pos(lt), shake = lt > stopT ? Math.sin(lt * 60) * 6 * Math.exp(-(lt - stopT) * 4) : 0;
      glow(ctx, 540, 860, 520, '#9fc4ff', .18);
      phone(ctx, 360 + shake, 560, 360, 660, (g, x, y, w, h) => {
        g.fillStyle = '#0d1422'; g.fillRect(x, y, w, h);
        for (let i = -1; i < 7; i++) {
          const yy = y + i * 128 - (y0 % 128), idx = Math.floor(y0 / 128) + i;
          g.fillStyle = `hsla(${(idx * 47) % 360},55%,55%,.55)`; rrect(g, x + 16, yy + 10, w - 32, 112, 14); g.fill();
          g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(x + 32, yy + 92, (w - 64) * .6, 8);
        }
        if (v > 900) { g.fillStyle = 'rgba(255,255,255,.08)'; for (let k = 0; k < 6; k++) g.fillRect(x, y + ((lt * 2000 + k * 120) % h), w, 3); }
      });
    },
    txt: [
      { h: '继续看：<span class="am">0</span> 个决定', c: 'b', x: 96, y: 330, at: [1, .2] },
      { h: '停下来：<span class="am">1</span> 次意志力', c: 'b', x: 96, y: 400, at: [2, .2] },
      { h: '晏青《短视频成瘾机制与人智交互错位之思》·《人民论坛》2025', c: 's', x: 96, y: 480, w: 820, at: [1, .8] },
    ]
  },
  S17: {
    draw(ctx, lt, D, Q) {
      vgrad(ctx, [[0, '#03050a'], [1, '#080c14']]);
      const s = lerp(1, 1.12, ease(clamp(lt / D)));
      ctx.save(); cam(ctx, s, 540, 860);
      const vx = 540, vy = 820;
      ctx.fillStyle = '#0b111d'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(420, 380); ctx.lineTo(420, 1080); ctx.lineTo(0, 1700); ctx.fill();
      ctx.beginPath(); ctx.moveTo(W, 0); ctx.lineTo(660, 380); ctx.lineTo(660, 1080); ctx.lineTo(W, 1700); ctx.fill();
      ctx.fillStyle = '#05080e'; ctx.beginPath(); ctx.moveTo(0, 1700); ctx.lineTo(420, 1080); ctx.lineTo(660, 1080); ctx.lineTo(W, 1700); ctx.fill();
      glow(ctx, 540, 880, 420, '#ffb070', .32); glow(ctx, 540, 860, 90, '#ffe2b0', .6);  // 巷子尽头的路灯
      const rr = rng(171);
      for (let k = 0; k < 14; k++) {   // 两侧墙上的窗、空调外机
        const side = k % 2, d = rr(), x = side ? lerp(1000, 690, d) : lerp(80, 390, d), y = lerp(300, 760, rr()), w = lerp(70, 26, d), h = w * 1.3;
        ctx.fillStyle = rr() < .25 ? rgba('#ffcf8a', .35) : '#070b13'; ctx.fillRect(x - w / 2, y, w, h);
        if (rr() < .5) { ctx.fillStyle = '#121a28'; ctx.fillRect(x - w / 2, y + h + 8, w * .9, w * .5); }
      }
      ctx.save(); ctx.globalCompositeOperation = 'lighter';   // 湿地面的倒影
      const rg = ctx.createLinearGradient(0, 1080, 0, 1600); rg.addColorStop(0, rgba('#ffb070', .22)); rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg; ctx.fillRect(480, 1080, 120, 520); ctx.restore();
      ctx.strokeStyle = 'rgba(10,14,22,.95)'; ctx.lineWidth = 3;   // 电线
      for (let i = 0; i < 9; i++) { const y = 200 + i * 38; ctx.beginPath(); ctx.moveTo(0, y); ctx.quadraticCurveTo(540, y + 120 + i * 6, W, y + 30); ctx.stroke(); }
      // 楼上那扇窗
      const on = 1 - eo(seg(lt, Q[1] + 1.4, Q[1] + 2.2)), col = screenCol(lt);
      ctx.fillStyle = '#04070c'; ctx.fillRect(770, 560, 120, 150);
      ctx.fillStyle = rgba(col, .55 * on); ctx.fillRect(770, 560, 120, 150); glow(ctx, 830, 635, 200, col, .3 * on);
      // 电动车
      ctx.fillStyle = '#03050a'; ctx.strokeStyle = '#03050a'; ctx.lineWidth = 14;
      ctx.beginPath(); ctx.arc(170, 1300, 60, 0, 6.29); ctx.stroke(); ctx.beginPath(); ctx.arc(430, 1300, 60, 0, 6.29); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(170, 1300); ctx.lineTo(260, 1200); ctx.lineTo(380, 1200); ctx.lineTo(430, 1300); ctx.stroke();
      ctx.fillRect(220, 1150, 120, 40); ctx.fillRect(170, 1080, 120, 90);   // 外卖箱
      ctx.restore();
      scrim(ctx, 260, 620, .8);
    },
    txt: [
      { h: '凌晨收工', c: 'k', x: 96, y: 340, at: [0, .4] },
      { h: '3–4 小时，一部短剧', c: 'h2', x: 90, y: 390, at: [0, 1.0] },
      { h: '一位外卖骑手的夜晚｜每日经济新闻 2024（综合法治日报、央视）', c: 's', x: 96, y: 1180, w: 820, at: [0, 1.6] },
    ]
  },
  S18: {
    draw(ctx, lt, D, Q) {
      vgrad(ctx, [[0, '#0c1320'], [.48, '#0a111c'], [.52, '#050709'], [1, '#07050a']]);
      ctx.fillStyle = 'rgba(200,215,240,.2)'; ctx.fillRect(96, 790, 888, 2);
      const e1 = seg(lt, Q[0] + .3, Q[0] + 2.6), e2 = seg(lt, Q[1] + .2, Q[1] + 2.4);
      for (let i = 0; i < 8; i++) {          // 白天：大格，按小时
        const k = clamp(e1 * 9 - i), x = lerp(110 + i * 80, 860, ease(k));
        ctx.fillStyle = rgba(C.cold, .75 * (1 - k * .6)); rrect(ctx, x, 560, 66, 120, 8); ctx.fill();
      }
      ctx.fillStyle = rgba(C.cold, .9); ctx.fillRect(900, 540, 6, 160);
      for (let i = 0; i < 90; i++) {         // 深夜：细格，按秒
        const k = clamp(e2 * 100 - i), x = lerp(110 + (i % 30) * 26, 860, ease(k)), y = 1010 + Math.floor(i / 30) * 44;
        ctx.fillStyle = rgba(C.amber, .8 * (1 - k * .6)); ctx.fillRect(x, y, 16, 30);
      }
      ctx.fillStyle = rgba(C.amber, .9); ctx.fillRect(900, 990, 6, 160);
    },
    txt: [
      { h: '白天 · 按小时', c: 'b', x: 96, y: 450, at: [0, .2] },
      { h: '→ 老板', c: 'b2', x: 760, y: 720, at: [0, 2.2], css: 'color:#9cbce6' },
      { h: '深夜 · 按秒', c: 'b', x: 96, y: 900, at: [1, .1] },
      { h: '→ 广告', c: 'b2', x: 760, y: 1170, at: [1, 2.0], css: 'color:#ffb35a' },
    ]
  },
  S19: {
    draw(ctx, lt, D, Q) {
      vgrad(ctx, [[0, '#1a2233'], [.5, '#252f42'], [1, '#141a26']]);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .22;
      ctx.fillStyle = '#c8d6ee'; ctx.beginPath(); ctx.moveTo(790, 300); ctx.lineTo(830, 300); ctx.lineTo(560, 1300); ctx.lineTo(420, 1300); ctx.fill(); ctx.restore();
      ctx.fillStyle = '#0f1520'; ctx.fillRect(700, 260, 100, 760); ctx.fillRect(830, 260, 160, 760);   // 窗帘
      ctx.fillStyle = '#121925'; ctx.fillRect(60, 1090, 980, 220);
      ctx.fillStyle = '#1a2232'; ctx.beginPath(); ctx.ellipse(270, 1080, 170, 42, 0, 0, 6.29); ctx.fill();
      lying(ctx, 250, 1060, 1, '#111826');
      // 闹钟
      const ring = lt < 3.2 ? Math.sin(lt * 70) * 4 : 0;
      ctx.fillStyle = '#0d121c'; ctx.fillRect(40, 1020, 120, 280);
      ctx.font = '400 54px "DIN Alternate"'; ctx.fillStyle = '#ff6a40'; ctx.textAlign = 'center'; ctx.fillText('07:00', 100 + ring, 1000);
      if (lt < 3.2) for (let i = 1; i <= 3; i++) { ctx.strokeStyle = rgba('#ff6a40', .4 / i * (.5 + .5 * Math.sin(lt * 12))); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(100, 980, 50 + i * 26, -2.6, -.5); ctx.stroke(); }
      // 床上的手机：3%
      ctx.save(); ctx.translate(600, 1110); ctx.rotate(.2); rrect(ctx, -60, -30, 120, 60, 10); ctx.fillStyle = '#05070b'; ctx.fill();
      ctx.fillStyle = '#ff4a3a'; ctx.fillRect(-36, -8, 8, 16); ctx.strokeStyle = '#ff4a3a'; ctx.lineWidth = 2; ctx.strokeRect(-40, -12, 50, 24); ctx.restore();
    },
    txt: [
      { h: '又输了一晚', c: 'h', x: 0, y: 470, w: 1080, a: 'center', at: [1, .3] },
    ], fadeOut: .9
  },
  CH4: chapter(4, '我们交出去的'),
  S20: {
    draw(ctx, lt, D, Q) {
      vgrad(ctx, [[0, '#04060c'], [1, '#090e18']]);
      const x0 = 120, x1 = 900, y0 = 620, y1 = 1060, e = ease(seg(lt, Q[1] - .2, Q[1] + 3.2));
      ctx.strokeStyle = 'rgba(200,215,240,.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, y1); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.font = '400 24px "DIN Alternate"'; ctx.fillStyle = 'rgba(200,215,240,.5)'; ctx.textAlign = 'center';
      for (let d = 0; d <= 14; d += 2) ctx.fillText('D' + d, lerp(x0, x1, d / 14), y1 + 40);
      const perf = d => y0 + 30 + (y1 - y0 - 80) * (1 - Math.exp(-d / 9)) * 1.25, feel = d => y0 + 60 + 110 * (1 - Math.exp(-d / 2.5));
      const line = (f, col, w) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); for (let d = 0; d <= 14 * e; d += .1) { const x = lerp(x0, x1, d / 14); d ? ctx.lineTo(x, f(d)) : ctx.moveTo(x, f(d)); } ctx.stroke(); };
      line(feel, C.cold, 5); line(perf, C.amber, 7);
      const de = 14 * e; glow(ctx, lerp(x0, x1, de / 14), perf(de), 80, C.amber, .5);
      if (e > .95) {
        ctx.font = '500 28px "PingFang SC"'; ctx.textAlign = 'right';
        ctx.fillStyle = C.cold; ctx.fillText('自己感觉的困倦', x1, feel(14) - 22);
        ctx.fillStyle = C.amber; ctx.fillText('实际表现的下降', x1, perf(14) + 50);
      }
    },
    txt: [
      { h: '每晚 6 小时 × 14 天', c: 'b', x: 96, y: 330, at: [1, .2] },
      { h: '≈ 通宵 2 夜', c: 'n2', x: 90, y: 400, at: [1, 1.4] },
      { h: 'Van Dongen et al., Sleep 2003 · 曲线为示意', c: 's', x: 96, y: 1150, at: [1, 1] },
    ]
  },
  S21: {
    draw(ctx, lt, D, Q) {
      vgrad(ctx, [[0, '#04060c'], [1, '#090e18']]);
      const p2 = eo(seg(lt, Q[1] - .3, Q[1] + .5));
      if (p2 < 1) {
        ctx.globalAlpha = 1 - p2;
        const days = ['一', '二', '三', '四', '五', '六', '日'], hrs = [5.5, 5.8, 5.4, 5.9, 5.6, 9, 8.6], base = 1060, sc = 50;
        days.forEach((d, i) => {
          const x = 140 + i * 112, e = eo(seg(lt, .3 + i * .15, .9 + i * .15)), h = hrs[i] * sc * e;
          ctx.fillStyle = i > 4 ? C.cold : '#5c6f8c'; ctx.fillRect(x, base - h, 64, h);
          ctx.font = '500 28px "PingFang SC"'; ctx.fillStyle = '#b8c3d6'; ctx.textAlign = 'center'; ctx.fillText(d, x + 32, base + 44);
        });
        ctx.setLineDash([10, 10]); ctx.strokeStyle = rgba(C.ice, .6); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(120, base - 7 * sc); ctx.lineTo(940, base - 7 * sc); ctx.stroke(); ctx.setLineDash([]);
        ctx.font = '400 26px "DIN Alternate"'; ctx.fillStyle = rgba(C.ice, .8); ctx.textAlign = 'left'; ctx.fillText('7h', 120, base - 7 * sc - 14);
        const debt = eo(seg(lt, 1.8, 2.8));
        ctx.fillStyle = rgba(C.ember, .85 * debt); ctx.fillRect(140, 1110, 700 * debt, 18);
        ctx.font = '500 26px "PingFang SC"'; ctx.fillStyle = rgba(C.ember, debt); ctx.fillText('睡眠债：补觉后代谢指标仍未恢复', 140, 1168);
        ctx.globalAlpha = 1;
      }
      if (p2 > 0) {     // 心电线
        ctx.globalAlpha = p2;
        const y = 860, prog = seg(lt, Q[1], D);
        ctx.strokeStyle = C.ember; ctx.lineWidth = 5; ctx.shadowColor = C.ember; ctx.shadowBlur = 20; ctx.beginPath();
        for (let x = 0; x <= W * Math.min(1, prog * 1.6); x += 3) {
          const ph = ((x + lt * 260) % 360) / 360; let v = 0;
          if (ph > .42 && ph < .46) v = -30; else if (ph > .46 && ph < .5) v = 150; else if (ph > .5 && ph < .55) v = -90; else if (ph > .62 && ph < .72) v = -26 * Math.sin((ph - .62) / .1 * Math.PI);
          x ? ctx.lineTo(x, y - v) : ctx.moveTo(x, y - v);
        }
        ctx.stroke(); ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      }
    },
    txt: [
      { h: '周末补觉 ≠ 还清', c: 'h2', x: 96, y: 340, at: [0, .3], out: [1, -.4] },
      { h: 'Depner et al., Current Biology 2019（随机对照实验）', c: 's', x: 96, y: 1200, w: 820, at: [0, .9], out: [1, -.4] },
      { h: '+25%', c: 'n', x: 84, y: 330, at: [1, .9] },
      { h: '零点后入睡（对比 22–23 点）<br>心血管病风险', c: 'b2', x: 96, y: 520, at: [1, 1.3] },
      { h: '8.8 万人 · 手环记录 · 观察性关联｜EHJ Digital Health 2021', c: 's', x: 96, y: 1200, w: 820, at: [1, 1.8] },
    ]
  },
  S22: {
    draw(ctx, lt, D, Q) {
      vgrad(ctx, [[0, '#04060c'], [1, '#070b14']]);
      const push = ease(seg(lt, Q[1] + 1, D)), s = lerp(1, 3.4, push), r = rng(2222);
      const bx = 140, by = 220, cols = 9, rows = 15, cw = 88, ch = 66;
      const tx = bx + 4 * cw + 40, ty = by + 7 * ch + 28;
      ctx.save(); cam(ctx, s, tx, ty, (540 - tx) * push, (760 - ty) * push);
      ctx.fillStyle = '#0d1524'; ctx.fillRect(bx - 20, by - 20, cols * cw + 40, rows * ch + 160);
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const x = bx + i * cw + 10, y = by + j * ch + 8, warm = r() < .3, fl = .85 + .15 * Math.sin(lt * 2 + i * 3 + j);
        if (i === 4 && j === 7) continue;
        ctx.fillStyle = warm ? rgba('#ffd7a0', .85 * fl) : rgba('#e3eeff', .8 * fl); ctx.fillRect(x, y, 68, 46);
      }
      glow(ctx, bx + cols * cw / 2, by + rows * ch / 2, 700, '#bcd4ff', .12);
      // 底层 24 小时便利店
      ctx.fillStyle = rgba('#8fe0b0', .75); ctx.fillRect(bx + 60, by + rows * ch + 20, cols * cw - 120, 90);
      ctx.font = '400 60px "DIN Alternate"'; ctx.fillStyle = '#0d1524'; ctx.textAlign = 'center'; ctx.fillText('24H', bx + cols * cw / 2, by + rows * ch + 88);
      // 唯一的暗窗 —— 最后也亮起手机光
      const x = bx + 4 * cw + 10, y = by + 7 * ch + 8, on = eo(seg(lt, Q[3] + .4, Q[3] + 1.6)), col = screenCol(lt);
      ctx.fillStyle = '#05080e'; ctx.fillRect(x, y, 68, 46);
      if (on > 0) { ctx.fillStyle = rgba(col, .7 * on); ctx.fillRect(x, y, 68, 46); glow(ctx, x + 34, y + 23, 60, col, .5 * on); }
      else { ctx.strokeStyle = rgba(C.amber, .5 + .3 * Math.sin(lt * 3)); ctx.lineWidth = 2; ctx.strokeRect(x - 4, y - 4, 76, 54); }
      ctx.restore();
      scrim(ctx, 250, 640, .85 * (1 - push)); if (on > 0) scrim(ctx, 250, 760, .93 * on); scrim(ctx, 1500, 1150, .85, -1);
    },
    txt: [
      { h: '睡眠，是资本<br>唯一还没征用的时间', c: 'q', x: 90, y: 320, w: 860, at: [1, .2], out: [2, -.2] },
      { h: '— 乔纳森·克拉里《24/7：晚期资本主义与睡眠的终结》', c: 's', x: 96, y: 530, w: 820, at: [1, .8], out: [2, -.2] },
      { h: '最后一块<br>只属于自己的时间', c: 'h2', x: 90, y: 330, w: 860, at: [3, .9] },
    ]
  },
  CH5: chapter(5, '出路不在深夜', true),
  S23: {
    draw(ctx, lt, D) {
      vgrad(ctx, [[0, '#0a0806'], [.6, '#140e09'], [1, '#080605']]);
      const s = lerp(1.04, 1, ease(clamp(lt / D)));
      ctx.save(); cam(ctx, s, 540, 900);
      // 背景：门外，屏幕朝下的手机（虚化）
      ctx.save(); ctx.filter = 'blur(8px)';
      ctx.fillStyle = '#05040a'; ctx.fillRect(760, 380, 220, 560); glow(ctx, 870, 900, 90, '#7f9fd8', .18);
      ctx.restore();
      // 台灯光锥
      glow(ctx, 330, 980, 620, '#ffb35a', .35);
      ctx.fillStyle = '#1b130c'; ctx.fillRect(0, 1010, W, 400);    // 桌面
      ctx.fillStyle = rgba('#ffcf8a', .08); ctx.fillRect(0, 1010, W, 6);
      ctx.strokeStyle = '#0a0705'; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(150, 1010); ctx.lineTo(220, 700); ctx.lineTo(330, 640); ctx.stroke();
      ctx.fillStyle = '#0a0705'; ctx.beginPath(); ctx.moveTo(290, 600); ctx.lineTo(420, 640); ctx.lineTo(380, 720); ctx.lineTo(250, 680); ctx.fill();
      glow(ctx, 370, 720, 220, '#ffd9a0', .5);
      // 书
      ctx.fillStyle = '#e9dcc6'; ctx.beginPath(); ctx.moveTo(360, 1000); ctx.quadraticCurveTo(470, 960, 560, 990); ctx.quadraticCurveTo(650, 960, 760, 1000); ctx.lineTo(760, 1030); ctx.quadraticCurveTo(650, 1000, 560, 1025); ctx.quadraticCurveTo(470, 1000, 360, 1030); ctx.fill();
      ctx.strokeStyle = 'rgba(80,60,40,.35)'; ctx.lineWidth = 2; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(390, 995 + i * 5); ctx.lineTo(530, 985 + i * 5); ctx.stroke(); ctx.beginPath(); ctx.moveTo(590, 985 + i * 5); ctx.lineTo(730, 995 + i * 5); ctx.stroke(); }
      // 杯子与热气
      ctx.fillStyle = '#2a1d12'; ctx.fillRect(820, 920, 90, 100); ctx.strokeStyle = '#2a1d12'; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(910, 965, 26, -1.4, 1.4); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,230,200,.18)'; ctx.lineWidth = 4;
      for (let k = 0; k < 3; k++) { ctx.beginPath(); for (let y = 0; y < 160; y += 4) { const x = 850 + k * 18 + Math.sin(y / 22 + lt * 1.5 + k) * 10; y ? ctx.lineTo(x, 900 - y) : ctx.moveTo(x, 900); } ctx.stroke(); }
      ctx.restore();
    },
    txt: [
      { h: '出路不在深夜', c: 'h', x: 0, y: 380, w: 1080, a: 'center', at: [0, .2], out: [1, 0] },
      { h: '一本书 · 一个人 · 发会儿呆', c: 'b', x: 0, y: 400, w: 1080, a: 'center', at: [3, .4] },
    ]
  },
  S24: {
    gl: 'dawn',
    draw(ctx, lt, D, Q) { skyTop(ctx, mix('#1b2a4a', '#6d86b4', ease(clamp(lt / D))), .75); scrim(ctx, 1290, 900, .55, -1); },
    txt: [
      { h: '下班就是下班', c: 'h', x: 90, y: 360, at: [1, .3] },
      { h: '「隐形加班」首次被判为加班 · 2024', c: 'b2', x: 96, y: 1010, at: [2, .3] },
      { h: '「离线休息权」两会提案 · 2024–2026', c: 'b2', x: 96, y: 1070, at: [2, .8] },
      { h: '北京三中院；全国政协委员吕国泉提案', c: 's', x: 96, y: 1140, at: [2, 1.2] },
    ]
  },
  S25: {
    draw(ctx, lt, D, Q) {
      const ph = 1 - ease(seg(lt, Q[0] + .5, Q[0] + 3));
      bedroom(ctx, lt, D, { scale: lerp(1.14, 1, ease(clamp(lt / D))), phone: ph, moon: 1 - ph * .8, clock: '' });
    },
    txt: [
      { h: '深夜偷回来的时间，<br>不该再交出去。', c: 'q', x: 0, y: 400, w: 1080, a: 'center', at: [1, .2] },
    ]
  },
  S26: {
    draw(ctx, lt, D) {
      vgrad(ctx, [[0, '#020309'], [.7, '#070c18'], [1, '#0b1424']]);
      const r = rng(26);
      for (let i = 0; i < 160; i++) { const x = r() * W, y = r() * 1300, a = .3 + .5 * Math.abs(Math.sin(lt * (.5 + r()) + r() * 6)); ctx.fillStyle = `rgba(220,230,255,${a * .6})`; ctx.fillRect(x, y, 2, 2); }
      glow(ctx, 540, 1180, 140, C.amber, .5); glow(ctx, 540, 1180, 28, '#fff2d8', .9);
    },
    txt: [
      { h: '我想夺回的，<br>到底是什么？', c: 'h', x: 0, y: 560, w: 1080, a: 'center', at: [1, .3] },
      { h: '评论区，说说你的答案', c: 'b2', x: 0, y: 860, w: 1080, a: 'center', at: [1, 3.0] },
    ], fadeOut: .8
  },
  SRC: {
    draw(ctx) { vgrad(ctx, [[0, '#03050a'], [1, '#060a12']]); },
    txt: [
      { h: '资料来源', c: 'k', x: 96, y: 330, at: .2 },
      { h: '中国睡眠研究会《2026 中国睡眠健康研究白皮书》<br>QuestMobile《2026 夜经济洞察》<br>国家统计局：第三次全国时间利用调查（2024）、企业就业人员周平均工作时间（2025）<br>住建部等《2024 年中国主要城市通勤监测报告》<br>中国青年报社会调查中心（2022）· 前程无忧（2022）<br>北京三中院「隐形加班」案（2024）<br>喜临门《2026 中国睡眠指数报告》（企业报告）<br>社科院 × 喜临门《中国睡眠研究报告（2022）》<br>Nauts et al. 2019 · Hagger 2016 · Vohs 2021<br>Van Dongen et al. 2003 · Depner et al. 2019 · Nikbakhtian et al. 2021<br>罗萨《新异化的诞生》· 克拉里《24/7》· 晏青《人民论坛》2025<br>案例引自《时尚先生》、紫牛新闻、每日经济新闻等公开报道，均为转述',
        c: 's', x: 96, y: 390, w: 800, at: .4, css: 'font-size:24px;line-height:1.9;color:#a8b2c4' },
    ], fadeOut: .6
  },
};
