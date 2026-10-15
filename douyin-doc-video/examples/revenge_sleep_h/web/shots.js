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

// 章节卡：编号 + 标题 + 一条生长的线。bg 传实拍素材（vid 规格）时用它打底（推荐，避免「空背景 + 一行字」），否则用光斑背景
function chapter(num, title, warm, bg) {
  return {
    vid: bg && { kb: [1.04, 1.1], grade: warm ? 'warm' : 'night', ...bg },
    draw(ctx, lt) {
      if (bg) scrimX(ctx, 560, 1300, .72); else {
      vgrad(ctx, warm ? [[0, '#0b0806'], [.5, '#171009'], [1, '#07050a']] : [[0, '#04070d'], [.5, '#0a1322'], [1, '#04060b']]);
      bokeh(ctx, num * 31 + 3, 14, lt, { rmin: 40, rmax: 140, a: .10, drift: 10, cols: warm ? [C.amber, C.warm] : [C.cold, C.blue, C.amber] }); }
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


// ===== 数据常量（2026-10-14 核实，见 03_核实记录.md）=====
const WORK_H = 48.2;   // 国家统计局 · 全国企业就业人员周平均工作时间 · 2026 年 8 月
const SOURCES = [
  'QuestMobile《2026「夜经济」洞察报告》',
  '中国睡眠研究会《2026 中国睡眠健康研究白皮书》',
  '社科院社会学所等《中国睡眠研究报告（2022）》',
  '国家统计局 · 第三次全国时间利用调查（2024）',
  '国家统计局 · 企业就业人员周平均工作时间（2026.8）',
  '国务院《关于职工工作时间的规定》·《劳动法》',
  '中规院等《2025 年中国主要城市通勤监测报告》',
  '前程无忧 2022 · 中青报社会调查中心 2022',
  '北京三中院「隐形加班」案二审（2022）',
  '喜临门《2026 中国睡眠指数报告》（企业报告）',
  'Kroese 2014 · Nauts 2019 · Hagger 2016',
  'Vohs 2021 · Van Dongen 2003 · Depner 2019',
  'Nikbakhtian 2021 · 晏青《人民论坛》2025',
  '罗萨《新异化的诞生》· 克拉里《24/7》',
  '案例均转述自《时尚先生》、紫牛新闻、每经等报道',
].join('<br>');
const FOOTAGE_CREDITS = 'Pexels：LayG Traveller · cottonbro studio · Ron Lach · K ZHAO · Xiang Qi · khanhhoangminh<br>Mixkit（Free License）· 画面中的人物与文中案例无关，仅为氛围示意';

// ===== 「报复性熬夜」横屏版：实拍（中国城市 / 人物）+ 数据图层 =====
// 构图：文字放左侧（x 180 起），图表放右侧（x 1000–1650）；字幕在 y≈784
const BLUR = (b = .55) => ({ f: `blur(9px) brightness(${b}) saturate(.8)`, tints: [['#0e1c33', 'screen', 1]] });
const L = 180;    // 左侧文字起点
// 数字条：x0..x1 内按比例生长
function hbar(ctx, x, y, w, h, v, col, e, label, val) {
  ctx.fillStyle = 'rgba(200,215,240,.10)'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = rgba(col, .92); ctx.fillRect(x, y, w * v * e, h); if (e > 0) glow(ctx, x + w * v * e, y + h / 2, 60, col, .35 * e);
  ctx.textAlign = 'left'; ctx.font = '500 30px "PingFang SC"'; ctx.fillStyle = rgba('#eef2f7', .9 * clamp(e * 3)); ctx.fillText(label, x, y - 14);
  ctx.font = '400 40px "DIN Alternate"'; ctx.fillStyle = rgba(col, clamp(e * 3)); ctx.fillText(val, x + w * v * e + 16, y + h - 2);
}
function clockFace(ctx, cx, cy, R, minutes) {
  const g = ctx.createRadialGradient(cx, cy - 60, 20, cx, cy, R); g.addColorStop(0, 'rgba(26,36,54,.92)'); g.addColorStop(1, 'rgba(10,15,25,.92)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.29); ctx.fill();
  ctx.strokeStyle = 'rgba(180,200,230,.35)'; ctx.lineWidth = 4; ctx.stroke();
  for (let i = 0; i < 60; i++) {
    const a = i / 60 * 6.283, l = i % 5 ? 10 : 24; ctx.strokeStyle = i % 5 ? 'rgba(200,215,240,.3)' : 'rgba(230,238,250,.8)'; ctx.lineWidth = i % 5 ? 2 : 4;
    ctx.beginPath(); ctx.moveTo(cx + Math.sin(a) * (R - 16), cy - Math.cos(a) * (R - 16)); ctx.lineTo(cx + Math.sin(a) * (R - 16 - l), cy - Math.cos(a) * (R - 16 - l)); ctx.stroke();
  }
  const ha = (minutes / 60 % 12) / 12 * 6.283, ma = (minutes % 60) / 60 * 6.283; ctx.lineCap = 'round';
  ctx.strokeStyle = '#e8eef8'; ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(ha) * R * .5, cy - Math.cos(ha) * R * .5); ctx.stroke();
  ctx.strokeStyle = C.amber; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(ma) * R * .78, cy - Math.cos(ma) * R * .78); ctx.stroke();
  glow(ctx, cx + Math.sin(ma) * R * .78, cy - Math.cos(ma) * R * .78, 50, C.amber, .4);
  ctx.fillStyle = '#e8eef8'; ctx.beginPath(); ctx.arc(cx, cy, 11, 0, 6.29); ctx.fill();
}

const SH = {
  // 钩子：深夜，床头灯下刷手机（实拍）
  S01: {
    vid: { src: 'bed-phone-lamp', in: 1.0, kb: [1.0, 1.08], pan: [0, 0, 40, 10] },
    draw(ctx) { scrimX(ctx, 260, 900, .55); },
    txt: [
      { h: '02:00', c: 'en', x: L + 6, y: 250, at: .3, css: 'color:#ffb35a;font-size:40px' },
      { h: '凌晨两点', c: 'h', x: L, y: 300, at: [0, .2] },
    ], fadeIn: 1.2
  },
  // 4.4 亿人在线：重庆夜景航拍
  S02: {
    vid: { src: 'cq-night-aerial', in: .3, speed: .85, kb: [1.03, 1.14], pan: [0, 0, -40, 10] },
    draw(ctx, lt, D, Q) {
      scrimX(ctx, 640, 1250, .78 * clamp(seg(lt, Q[1] - .4, Q[1] + .4)));
      const x0 = L + 90, sc = 620 / 4.4;
      [[480, 3.76, C.cold, '2025', '约 3.8 亿'], [570, 4.4, C.amber, '2026', '4.4 亿']].forEach(([y, v, col, yr, lab], i) => {
        const e = eo(seg(lt, Q[2] + .3 + i * .5, Q[2] + 1.7 + i * .5)); if (e <= 0) return;
        ctx.fillStyle = rgba(col, .9); ctx.fillRect(x0, y, v * sc * e, 30); if (i) glow(ctx, x0 + v * sc * e, y + 15, 70, C.amber, .4 * e);
        ctx.font = '400 30px "DIN Alternate"'; ctx.textAlign = 'left'; ctx.fillStyle = rgba('#d7e6fa', e); ctx.fillText(yr, L + 6, y + 26);
        ctx.font = '400 36px "DIN Alternate"'; ctx.fillStyle = rgba(col, e); ctx.fillText(lab, x0 + 20 + v * sc * e, y + 29);
      });
    },
    txt: [
      { h: '凌晨 0–2 点 · 全国日均活跃', c: 'k', x: L + 6, y: 200, at: [1, 0] },
      { h: '', c: 'n', x: L - 4, y: 250, at: [1, .2], fn: (lt, Q) => (4.4 * eo(seg(lt, Q[1] + .2, Q[1] + 2.2))).toFixed(1) + '<span style="font-size:72px"> 亿人</span>' },
    ], fadeIn: .7
  },
  TITLE: {
    vid: { src: 'sh-lujiazui-night', in: 2, kb: [1.06, 1.12], dim: .35 },
    draw(ctx) {},
    txt: [
      { h: '报 复 性 熬 夜', c: 'k', x: 0, y: 290, w: W, a: 'center', at: .2 },
      { h: '夜里偷回来的时间<br>被谁拿走了', c: 'h', x: 0, y: 350, w: W, a: 'center', at: .6 },
    ], fadeIn: .5, fadeOut: .6
  },
  // 入睡时间：钟 + 十年时间轴
  S04: {
    vid: { src: 'sz-skyline-a', in: .5, speed: .75, kb: [1.08, 1.12], grade: BLUR(.5) },
    draw(ctx, lt, D, Q) {
      clockFace(ctx, 1320, 380, 240, lerp(23 * 60, 24 * 60 + 10, ease(seg(lt, .2, Q[0] + 2.4))));
      const k = eo(seg(lt, Q[1] - .2, Q[1] + .6)); if (k <= 0) return;
      const y = 600, xa = L + 120, xb = 900, e2 = ease(seg(lt, Q[1] + .5, Q[1] + 2.6));
      ctx.globalAlpha = k; ctx.strokeStyle = 'rgba(200,215,240,.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(L + 10, y); ctx.lineTo(1000, y); ctx.stroke();
      ctx.setLineDash([6, 8]); ctx.strokeStyle = rgba(C.cold, .7); ctx.beginPath(); ctx.moveTo(xa, y - 36); ctx.lineTo(lerp(xa, xb, e2), y - 36); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = C.cold; ctx.beginPath(); ctx.arc(xa, y, 9, 0, 6.29); ctx.fill();
      ctx.fillStyle = C.amber; ctx.beginPath(); ctx.arc(lerp(xa, xb, e2), y, 12, 0, 6.29); ctx.fill(); glow(ctx, lerp(xa, xb, e2), y, 70, C.amber, .5);
      ctx.font = '400 30px "DIN Alternate"'; ctx.textAlign = 'center'; ctx.fillStyle = rgba(C.cold, .95); ctx.fillText('2012', xa, y + 50);
      ctx.fillStyle = rgba(C.amber, e2); ctx.fillText('2021', xb, y + 50);
      ctx.globalAlpha = 1;
    },
    txt: [
      { h: '平均入睡', c: 'k', x: L + 6, y: 220, at: [0, .6], out: [1, -.4] },
      { h: '00:10', c: 'n', x: L - 4, y: 270, at: [0, .8], out: [1, -.4] },
      { h: '入睡时间，推迟 <span class="am">2 小时以上</span>', c: 'b', x: L + 6, y: 300, at: [1, .9] },
    ], cutIn: false
  },
  // 名词：两个女孩在床上刷手机（实拍）
  S05: {
    vid: { src: 'girls-phone-bed', in: 3, kb: [1.05, 1.12], dim: .45 },
    draw(ctx, lt, D) { scrimX(ctx, 300, 1300, .5); const x = lerp(-300, 2200, ease(seg(lt, .1, D * .9))); glow(ctx, x, 380, 600, '#7fa6e0', .14); },
    txt: [
      { h: '报复性熬夜', c: 'h', x: L, y: 250, at: .5, css: 'font-size:132px;letter-spacing:10px' },
      { h: 'REVENGE BEDTIME PROCRASTINATION', c: 'en', x: L + 8, y: 440, at: 1.1 },
      { h: '最晚 2018 年已出现在中文网络 · 2020 年在英文推特走红', c: 'b2', x: L + 8, y: 520, at: 1.6 },
    ]
  },
  // 引语：握着手机的手
  S06: {
    vid: { src: 'hands-texting', in: 2, kb: [1.04, 1.12], pan: [0, 0, -30, 0], grade: 'night' },
    draw(ctx, lt, D, Q) { scrimX(ctx, 400, 1150, .7); ctx.fillStyle = `rgba(4,7,13,${.45 * eo(seg(lt, Q[1] - .3, Q[1] + .5))})`; ctx.fillRect(0, 0, W, H); },
    txt: [
      { h: '「我不睡，<br>只是因为舍不得。」', c: 'q', x: L, y: 240, at: [0, 1.4], out: [1, -.3] },
      { h: '— 某互联网大厂产品经理', c: 'b2', x: L + 6, y: 430, at: [0, 1.8], out: [1, -.3] },
      { h: '舍不得什么？', c: 'h', x: 0, y: 320, w: W, a: 'center', at: [1, .1] },
    ], fadeOut: .8
  },
  CH1: chapter(1, '「报复」是真的', false, { src: 'hz-night-crowd', in: 4 }),
  // 心理学：电量 → 三扇门（背景虚化的卧室实拍）
  S07: {
    vid: { src: 'girls-phone-bed', in: 12, kb: [1.08, 1.14], grade: BLUR(.42) },
    draw(ctx, lt, D, Q) {
      const p1 = eo(seg(lt, Q[1] - .4, Q[1] + .4));
      if (p1 < 1) {     // 电量耗尽
        ctx.globalAlpha = 1 - p1;
        const lv = 1 - ease(seg(lt, .3, Q[0] + 2.2)), x = 1150, y = 300;
        rrect(ctx, x, y, 320, 160, 24); ctx.strokeStyle = '#cfd8e6'; ctx.lineWidth = 8; ctx.stroke();
        ctx.fillStyle = '#cfd8e6'; ctx.fillRect(x + 320, y + 54, 18, 52);
        ctx.fillStyle = lv > .25 ? C.cold : C.ember; ctx.fillRect(x + 16, y + 16, 288 * lv, 128);
        glow(ctx, x + 160, y + 80, 280, lv > .25 ? C.cold : C.ember, .2); ctx.globalAlpha = 1;
      }
      if (p1 > 0) {     // 三扇门：忘了时间 / 以为晚睡好睡 / 故意的
        const push = ease(seg(lt, Q[3] - .2, D)), sc = lerp(1, 2.2, push);
        ctx.save(); cam(ctx, sc, 1480, 470);
        const hl = eo(seg(lt, Q[2], Q[2] + .8));
        [[960, C.cold], [1190, C.cold], [1420, C.amber]].forEach(([x, col], i) => {
          const a = p1 * (i === 2 ? 1 : 1 - .6 * hl);
          ctx.fillStyle = '#060910'; ctx.fillRect(x - 10, 260, 190, 400);
          const g = ctx.createLinearGradient(0, 270, 0, 650); g.addColorStop(0, rgba(col, .85 * a)); g.addColorStop(1, rgba(col, .25 * a));
          ctx.fillStyle = g; ctx.fillRect(x, 270, 170, 380); glow(ctx, x + 85, 660, 220, col, .35 * a);
          ctx.font = '500 30px "PingFang SC"'; ctx.textAlign = 'center'; ctx.fillStyle = rgba(i === 2 ? C.amber : '#eef2f7', .95 * a);
          ctx.fillText(['忘了时间', '以为晚睡好睡', '故意的'][i], x + 85, 230);
        });
        ctx.restore();
        const dk = ease(seg(lt, Q[3], Q[3] + 1.2)); ctx.fillStyle = `rgba(20,12,4,${.6 * dk})`; ctx.fillRect(0, 0, W, H);
      }
    },
    txt: [
      { h: '意志力耗尽？', c: 'h2', x: L, y: 280, at: [0, .6], out: [1, -.5] },
      { h: '心理学 · 三种晚睡的人', c: 'k', x: L + 6, y: 280, at: [1, .3], out: [3, 0] },
      { h: '「我理应有一段<br>自己的时间」', c: 'q', x: 0, y: 300, w: W, a: 'center', at: [3, .5] },
    ]
  },
  // 医院走廊 + 日程被填满
  S08: {
    vid: { src: 'hospital-corridor', in: .5, kb: [1.04, 1.1], grade: { f: 'brightness(.62) contrast(1.08) saturate(.7)', tints: [['#0e1c33', 'screen', 1]] } },
    draw(ctx, lt, D) {
      const x0 = 300, x1 = 1620, y = 600, e = seg(lt, .4, D * .75);
      ctx.fillStyle = 'rgba(10,14,22,.72)'; rrect(ctx, x0 - 40, y - 70, x1 - x0 + 80, 150, 18); ctx.fill();
      ctx.font = '400 26px "DIN Alternate"'; ctx.fillStyle = 'rgba(200,215,240,.7)'; ctx.textAlign = 'center';
      for (let h = 7; h <= 22; h++) ctx.fillText(String(h).padStart(2, '0'), lerp(x0, x1, (h - 7) / 15), y - 30);
      const blocks = [[7, 8], [8, 12], [12.5, 13], [13, 17.5], [17.5, 19], [19.5, 21.5]];
      blocks.forEach(([a, b], i) => {
        const k = clamp(e * blocks.length - i); if (k <= 0) return;
        const xa = lerp(x0, x1, (a - 7) / 15), xb = lerp(xa, lerp(x0, x1, (b - 7) / 15), eo(k));
        ctx.fillStyle = rgba(C.cold, .6); rrect(ctx, xa, y, Math.max(4, xb - xa - 4), 50, 8); ctx.fill();
      });
      scrimX(ctx, 200, 900, .5);
    },
    txt: [
      { h: '「白天的我，<br>不是真正的我」', c: 'q', x: L, y: 200, at: [0, 1.2] },
      { h: '— 一位规培医生', c: 'b2', x: L + 6, y: 390, at: [0, 1.6] },
    ]
  },
  // 一天 24 小时：圆环（背景：广州地铁扶梯，虚化）
  S09: {
    vid: { src: 'gz-metro-escalator', in: .3, speed: .35, kb: [1.08, 1.12], grade: BLUR(.48) },
    draw(ctx, lt, D, Q) {
      const cx = 1300, cy = 400, R = 250, segs = [[6 + 23 / 60, C.cold, Q[0] + .3], [1 + 2 / 60, '#5c6f8c', Q[1] - .3], [3.5, C.amber, Q[1] + .9]];
      ctx.lineWidth = 44; ctx.strokeStyle = 'rgba(200,215,240,.10)'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.29); ctx.stroke();
      let a0 = -Math.PI / 2 + 8 / 24 * 6.283;    // 从 08:00 开始
      segs.forEach(([hrs, col, t0], i) => {
        const e = ease(seg(lt, t0, t0 + 1.4)), a1 = a0 + hrs / 24 * 6.283 * e;
        let off = 0; if (i === 2) off = 6.283 * ((22 - 8 - 6.4 - 1.03) / 24) * ease(seg(lt, Q[2] + .2, Q[2] + 2.2));
        ctx.strokeStyle = col; ctx.lineWidth = 44; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.arc(cx, cy, R, a0 + off, a1 + off); ctx.stroke();
        if (i === 2 && e > 0) glow(ctx, cx + Math.cos(a1 + off) * R, cy + Math.sin(a1 + off) * R, 90, C.amber, .45 * e);
        a0 += hrs / 24 * 6.283 + .1;
      });
      ctx.font = '400 28px "DIN Alternate"'; ctx.fillStyle = 'rgba(200,215,240,.6)'; ctx.textAlign = 'center';
      [[0, '00'], [6, '06'], [12, '12'], [18, '18']].forEach(([h, s]) => { const a = -Math.PI / 2 + h / 24 * 6.283; ctx.fillText(s, cx + Math.cos(a) * (R + 56), cy + Math.sin(a) * (R + 56) + 10); });
    },
    txt: [
      { h: '一天 24 小时', c: 'k', x: L + 6, y: 200, at: [0, .2] },
      { h: '<span class="am" style="font:400 120px DIN Alternate">3:30</span><br><span class="b2">自由支配</span>', c: 'b', x: L, y: 250, at: [1, 2.0] },
      { h: '<span class="co">■</span> 有酬劳动 6:23　<span style="color:#7d8fae">■</span> 交通 1:02　<span class="am">■</span> 自由 3:30', c: 'b2', x: L + 6, y: 540, at: [0, 1.6] },
    ]
  },
  // 22:00 以后：夜晚的城市楼群
  S10: {
    vid: { src: 'gz-skyline-night', in: 1, kb: [1.04, 1.12], pan: [0, 0, -40, 0] },
    draw(ctx) { scrimX(ctx, 500, 1150, .75); },
    txt: [
      { h: '属于自己的时间，从', c: 'k', x: L + 6, y: 220, at: [0, .5] },
      { h: '22:00 以后', c: 'n2', x: L, y: 270, at: [0, .9] },
      { h: '48.7% 的中年女性这样说', c: 'b', x: L + 6, y: 420, at: [0, 1.8] },
    ]
  },
  CH2: chapter(2, '白天是怎样被拿走的', false, { src: 'hz-river-night', in: 3 }),
  // 工时：杭州钱江新城夜里亮着的写字楼
  S11: {
    vid: { src: 'hz-office-towers', in: 2, kb: [1.02, 1.12], pan: [0, 0, -40, 0] },
    draw(ctx, lt, D, Q) {
      scrimX(ctx, 820, 1400, .85 * clamp(seg(lt, Q[1] - .4, Q[1] + .3)));
      const e = eo(seg(lt, Q[1] + .6, Q[1] + 2.4)), x0 = L + 10, x1 = 1150, sc = (x1 - x0) / 60, y = 480;
      if (e <= 0) return;
      ctx.fillStyle = `rgba(200,215,240,${.15 * clamp(e * 3)})`; ctx.fillRect(x0, y, x1 - x0, 28);
      ctx.fillStyle = C.amber; ctx.fillRect(x0, y, WORK_H * sc * e, 28); glow(ctx, x0 + WORK_H * sc * e, y + 14, 90, C.amber, .4 * e);
      const em = clamp(seg(lt, Q[1] + 2.6, Q[1] + 3.2)), x40 = x0 + 40 * sc, x44 = x0 + 44 * sc;
      ctx.fillStyle = rgba(C.ice, em); ctx.fillRect(x40 - 2, y - 24, 4, 76);
      ctx.fillStyle = rgba(C.mute, .8 * em); ctx.fillRect(x44 - 1, y - 24, 2, 76);
      ctx.font = '500 30px "PingFang SC"'; ctx.textAlign = 'center';
      ctx.fillStyle = rgba(C.ice, em); ctx.fillText('标准工时 40', x40, y + 96);
      ctx.fillStyle = rgba(C.mute, em); ctx.fillText('劳动法 44', x44 + 30, y - 40);
    },
    txt: [
      { h: '企业员工 · 周平均工作时间', c: 'k', x: L + 6, y: 230, at: [1, .2] },
      { h: '', c: 'n2', x: L, y: 290, at: [1, .4], fn: (lt, Q) => (WORK_H * eo(seg(lt, Q[1] + .6, Q[1] + 2.4))).toFixed(1) + '<span style="font:500 44px PingFang SC;color:#eef2f7"> 小时</span>' },
    ]
  },
  // 通勤：广州地铁
  S12: {
    vid: { src: 'gz-metro-door', in: 1, kb: [1.03, 1.1], grade: 'doc', dim: .25 },
    draw(ctx) { scrimX(ctx, 420, 1100, .82); },
    txt: [
      { h: '29%', c: 'n', x: L - 4, y: 220, at: [0, .6] },
      { h: '北京通勤者，单程 60 分钟以上', c: 'b', x: L + 6, y: 410, at: [0, 1.1] },
    ]
  },
  // 下班后：台灯下的笔记本 + 工作消息 + 判决
  S13: {
    vid: { src: 'laptop-lamp', in: 2, kb: [1.03, 1.1], pan: [0, 0, -30, 0] },
    draw(ctx, lt, D, Q) {
      scrimX(ctx, 560, 1150, .8);
      const fade = 1 - eo(seg(lt, Q[1] - .5, Q[1]));
      for (let k = 0; k < 5; k++) {      // 工作群消息不断弹出（示意）
        const e = eo(seg(lt, .3 + k * .55, .8 + k * .55)) * fade; if (e <= 0) continue;
        const y = 150 + k * 96 + (1 - e) * 20; ctx.globalAlpha = e;
        ctx.fillStyle = 'rgba(22,30,46,.88)'; rrect(ctx, 1180, y, 460, 80, 16); ctx.fill();
        ctx.fillStyle = rgba(C.cold, .9); rrect(ctx, 1198, y + 18, 44, 44, 10); ctx.fill();
        ctx.fillStyle = 'rgba(238,242,247,.85)'; ctx.fillRect(1260, y + 22, 220 + (k * 37) % 120, 14);
        ctx.fillStyle = 'rgba(200,215,240,.45)'; ctx.fillRect(1260, y + 46, 300 - (k * 53) % 140, 12);
        ctx.font = '400 22px "DIN Alternate"'; ctx.fillStyle = 'rgba(200,215,240,.6)'; ctx.textAlign = 'right'; ctx.fillText(`23:4${k + 3}`, 1622, y + 34);
        ctx.globalAlpha = 1;
      }
      const s = eo(seg(lt, Q[2] + .1, Q[2] + .5));   // 判决：盖章
      if (s > 0) {
        ctx.save(); ctx.translate(1440, 360); ctx.rotate(-.12); ctx.scale(lerp(1.6, 1, s), lerp(1.6, 1, s)); ctx.globalAlpha = s;
        ctx.strokeStyle = C.ember; ctx.lineWidth = 8; rrect(ctx, -170, -70, 340, 140, 12); ctx.stroke();
        ctx.font = '900 64px "Songti SC"'; ctx.fillStyle = C.ember; ctx.textAlign = 'center'; ctx.fillText('算加班', 0, 22); ctx.restore();
      }
    },
    txt: [
      { h: '84.7%', c: 'n', x: L - 4, y: 200, at: [0, .4], out: [1, -.5] },
      { h: '下班后，仍在看工作消息', c: 'b', x: L + 6, y: 390, at: [0, .8], out: [1, -.5] },
      { h: '595.8 <span style="font:500 44px PingFang SC;color:#eef2f7">小时</span>', c: 'n2', x: L, y: 240, at: [1, .4] },
      { h: '近一年，下班后和休息日的线上工作（原告主张）', c: 'b2', x: L + 6, y: 370, at: [1, .9] },
      { h: '「隐形加班第一案」· 酌定支付加班费 3 万元', c: 'b2', x: L + 10, y: 440, at: [2, .6] },
    ]
  },
  // 社会加速：高架车流延时
  S14: {
    vid: { src: 'highway-trails', in: 0, speed: .6, kb: [1.0, 1.15] },
    draw(ctx) { scrimX(ctx, 420, 1050, .6); },
    txt: [
      { h: '社会加速', c: 'k', x: L + 6, y: 240, at: [0, .4] },
      { h: '急速的静止', c: 'h', x: L, y: 290, at: [1, .3] },
    ]
  },
  CH3: chapter(3, '为什么总是赢不了', false, { src: 'cd-night-street', in: 0 }),
  // 熬夜在做什么：条形图（背景：床头灯下刷手机）
  S15: {
    vid: { src: 'bed-phone-dark', in: 4, kb: [1.05, 1.12], grade: BLUR(.5) },
    draw(ctx, lt, D, Q) {
      const rows = [['刷短视频', .716, '71.6%', C.amber], ['打游戏', .361, '36.1%', C.cold], ['看剧', .359, '35.9%', C.cold], ['加班', .236, '23.6%', '#7d8fae']];
      rows.forEach(([lab, v, s, col], i) => hbar(ctx, 980, 250 + i * 120, 620, 34, v, col, eo(seg(lt, (i < 3 ? Q[1] : Q[2]) + .3 + (i < 3 ? i : 0) * .35, (i < 3 ? Q[1] : Q[2]) + 1.4 + (i < 3 ? i : 0) * .35)), lab, s));
    },
    txt: [
      { h: '熬夜的时候，<br>在做什么', c: 'h2', x: L, y: 250, at: [0, .6] },
    ]
  },
  // 信息流：手指在屏幕上滑
  S16: {
    vid: { src: 'hands-typing', in: 1, kb: [1.04, 1.12], grade: 'night' },
    draw(ctx, lt, D, Q) {
      scrimX(ctx, 460, 1100, .75);
      const sp = lerp(120, 900, ease(seg(lt, 0, Q[2] + .4))), off = (lt * sp) % 150, stop = eo(seg(lt, Q[2] + .4, Q[2] + 1.2));
      ctx.save(); ctx.beginPath(); rrect(ctx, 1200, 110, 400, 620, 30); ctx.clip();
      ctx.fillStyle = 'rgba(12,18,30,.85)'; ctx.fillRect(1200, 110, 400, 620);
      for (let i = -1; i < 6; i++) { const y = 130 + i * 150 - off * (1 - stop); ctx.fillStyle = `hsla(${(i * 67 + Math.floor(lt * sp / 150) * 67) % 360},45%,55%,.55)`; rrect(ctx, 1222, y, 356, 130, 16); ctx.fill(); }
      ctx.restore(); ctx.strokeStyle = 'rgba(200,215,240,.5)'; ctx.lineWidth = 3; rrect(ctx, 1200, 110, 400, 620, 30); ctx.stroke();
    },
    txt: [
      { h: '继续看：<span class="am">0</span> 个决定', c: 'h2', x: L, y: 250, at: [1, .2] },
      { h: '停下来：<span class="am">1</span> 次意志力', c: 'h2', x: L, y: 360, at: [2, .2] },
    ]
  },
  // 外卖骑手：南宁夜街，电动车穿行
  S17: {
    vid: { src: 'nn-night-street', in: .5, kb: [1.03, 1.1], dim: .2 },
    draw(ctx) { scrimX(ctx, 760, 1350, .86); },
    txt: [
      { h: '凌晨收工', c: 'k', x: L + 6, y: 240, at: [0, .4] },
      { h: '3–4 小时，一部短剧', c: 'h2', x: L, y: 290, at: [0, 1.0] },
      { h: '一晚，五六十元', c: 'b', x: L + 6, y: 400, at: [1, .6] },
    ]
  },
  // 白天按小时 / 深夜按秒
  S18: {
    vid: { src: 'gz-tram', in: 2, kb: [1.08, 1.12], grade: BLUR(.5) },
    draw(ctx, lt, D, Q) {
      const e1 = eo(seg(lt, Q[0] + .3, Q[0] + 1.6)), e2 = eo(seg(lt, Q[1] + .2, Q[1] + 1.4));
      for (let i = 0; i < 9; i++) {      // 白天：一小时一格，被领走
        const a = e1 * clamp((lt - Q[0] - .5) * 1.2 - i * .15 + 1);
        ctx.fillStyle = rgba(C.cold, .65 * a); rrect(ctx, 760 + i * 92, 260, 80, 80, 10); ctx.fill();
      }
      const n = Math.floor(clamp((lt - Q[1] - .3) / 2.4) * 120);
      for (let i = 0; i < 120 * e2; i++) {   // 深夜：一秒一格，被广告领走
        const x = 760 + (i % 30) * 28, y = 440 + Math.floor(i / 30) * 28;
        ctx.fillStyle = rgba(i < n ? C.amber : '#5c6f8c', i < n ? .85 : .3); ctx.fillRect(x, y, 22, 22);
      }
    },
    txt: [
      { h: '白天 · 按小时', c: 'b', x: L + 6, y: 270, at: [0, .2] },
      { h: '→ 老板', c: 'b2', x: L + 6, y: 335, at: [0, 2.2] },
      { h: '深夜 · 按秒', c: 'b', x: L + 6, y: 460, at: [1, .1], css: 'color:#ffb35a' },
      { h: '→ 广告', c: 'b2', x: L + 6, y: 525, at: [1, 2.0] },
    ]
  },
  // 清晨：闹钟、疲惫的脸
  S19: {
    vid: [{ src: 'alarm', in: 2, kb: [1.0, 1.06], grade: 'doc' }, { t0: 3.8, src: 'alarm', in: 12.6, kb: [1.02, 1.06], grade: 'doc' }],
    draw(ctx, lt, D) { scrimX(ctx, 560, 1200, .72); },
    txt: [
      { h: '07:00', c: 'en', x: L + 6, y: 250, at: .3, css: 'font-size:40px;color:#ffb35a' },
      { h: '又输了一晚', c: 'h', x: L, y: 300, at: [1, .3] },
    ]
  },
  CH4: chapter(4, '我们交出去的', false, { src: 'sz-skyline-b', in: 1 }),
  // 睡眠剥夺实验：两条曲线（背景：地铁扶梯，虚化）
  S20: {
    vid: { src: 'gz-metro-escalator2', in: .5, speed: .6, kb: [1.08, 1.12], grade: BLUR(.45) },
    draw(ctx, lt, D, Q) {
      const x0 = 980, x1 = 1640, y0 = 160, y1 = 600, e = ease(seg(lt, Q[1] + .2, Q[1] + 3)), e2 = ease(seg(lt, Q[2] + .1, Q[2] + 2));
      ctx.strokeStyle = 'rgba(200,215,240,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, y1); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.font = '400 24px "DIN Alternate"'; ctx.fillStyle = 'rgba(200,215,240,.6)'; ctx.textAlign = 'center';
      for (let d = 0; d <= 14; d += 2) ctx.fillText(d, lerp(x0, x1, d / 14), y1 + 36);
      const curve = (f, col, k, w) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); for (let i = 0; i <= 60 * k; i++) { const t = i / 60; const x = lerp(x0, x1, t), y = f(t); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); };
      curve(t => lerp(y0 + 40, y1 - 40, t), C.amber, e, 6);                                // 实际表现：一路下滑
      curve(t => y0 + 40 + 120 * (1 - Math.exp(-t * 5)), C.cold, e2, 4);                 // 自我感觉：很快持平
      ctx.font = '500 26px "PingFang SC"'; ctx.textAlign = 'left';
      if (e > .9) { ctx.fillStyle = C.amber; ctx.fillText('实际表现', x1 - 230, 390); }
      if (e2 > .9) { ctx.fillStyle = C.cold; ctx.fillText('自我感觉', x1 - 120, y0 + 130); }
    },
    txt: [
      { h: '每晚 6 小时 × 14 天', c: 'h2', x: L, y: 250, at: [1, .2] },
      { h: '≈ 通宵 1 夜', c: 'n2', x: L, y: 360, at: [1, 1.4] },
      { h: '每晚 4 小时 × 14 天 ≈ 通宵 2 夜', c: 'b2', x: L + 6, y: 490, at: [1, 2.4] },
    ]
  },
  // 睡眠债 + 心血管风险（背景：深圳夜景，虚化）
  S21: {
    vid: { src: 'hz-river-night', in: 8, kb: [1.08, 1.12], grade: BLUR(.42) },
    draw(ctx, lt, D, Q) {
      const k = 1 - eo(seg(lt, Q[1] - .4, Q[1] + .1));
      if (k > 0) {        // 一周睡眠：工作日短、周末补长，但债还在
        const hrs = [6, 6.1, 5.9, 6, 6.2, 8.6, 8.8], days = '一二三四五六日';
        hrs.forEach((h, i) => {
          const e = eo(seg(lt, .2 + i * .15, .9 + i * .15)) * k, x = 1000 + i * 90, hh = h * 40 * e;
          ctx.fillStyle = rgba(i > 4 ? C.ice : C.cold, .75 * k); ctx.fillRect(x, 600 - hh, 56, hh);
          ctx.font = '500 26px "PingFang SC"'; ctx.textAlign = 'center'; ctx.fillStyle = rgba('#d7e6fa', .8 * k); ctx.fillText(days[i], x + 28, 640);
        });
        ctx.setLineDash([8, 8]); ctx.strokeStyle = rgba(C.ember, .7 * k); ctx.beginPath(); ctx.moveTo(990, 600 - 8 * 40); ctx.lineTo(1630, 600 - 8 * 40); ctx.stroke(); ctx.setLineDash([]);
      }
      const e = eo(seg(lt, Q[1] + .3, Q[1] + 1.3));
      if (e > 0) {        // 心电线
        ctx.strokeStyle = rgba(C.ember, .9 * e); ctx.lineWidth = 4; ctx.beginPath();
        const ph = (lt * 220) % 300;
        for (let x = 960; x <= 1660; x += 4) { const u = (x - 960 + ph) % 300; const y = 420 - (u > 130 && u < 150 ? (u - 130) * 9 : u >= 150 && u < 170 ? (170 - u) * 9 - 60 : 0); x === 960 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
        ctx.stroke();
      }
    },
    txt: [
      { h: '周末补觉 ≠ 还清', c: 'h2', x: L, y: 260, at: [0, .3], out: [1, -.4] },
      { h: '+25%', c: 'n', x: L - 4, y: 200, at: [1, .1] },
      { h: '零点后入睡（对比 22:00–22:59）<br>心血管病风险', c: 'b', x: L + 6, y: 390, at: [1, .5] },
    ]
  },
  // 24/7：深圳彻夜亮着的楼
  S22: {
    vid: [{ src: 'sz-skyline-led', in: .5, kb: [1.0, 1.1], pan: [0, 0, 40, 10] }, { t0: 7.2, src: 'sh-lujiazui-night', in: 6, kb: [1.04, 1.12], pan: [0, 0, -40, 0] }],
    draw(ctx, lt, D, Q) { scrimX(ctx, 520, 1150, .7); },
    txt: [
      { h: '睡眠，是资本<br>唯一还没征用的时间', c: 'q', x: L, y: 240, at: [1, .2], out: [2, -.2] },
      { h: '— 乔纳森·克拉里', c: 'b2', x: L + 6, y: 430, at: [1, .8], out: [2, -.2] },
      { h: '最后一块<br>只属于自己的时间', c: 'h2', x: L, y: 260, at: [3, .9] },
    ]
  },
  CH5: chapter(5, '出路不在深夜', true, { src: 'cq-twilight', in: 1 }),
  // 读书：暖色、松弛
  S23: {
    vid: { src: 'reading-bed', in: 4, kb: [1.02, 1.1], pan: [0, 0, 30, 0], grade: 'warm' },
    draw(ctx) { scrimX(ctx, 300, 900, .45); },
    txt: [
      { h: '出路不在深夜', c: 'k', x: L + 6, y: 220, at: [0, .2] },
      { h: '一本书 · 一个人<br>发会儿呆', c: 'h2', x: L, y: 280, at: [3, .4] },
    ]
  },
  // 白天争：重庆，夜色退去、天亮（延时倒放）
  S24: {
    vid: { src: 'cq-twilight', in: 35.5, speed: -2.2, kb: [1.0, 1.08], grade: 'warm' },
    draw(ctx) { scrimX(ctx, 520, 1150, .62); },
    txt: [
      { h: '下班就是下班', c: 'h', x: L, y: 220, at: [1, .3] },
      { h: '「隐形加班」二审被判为加班 · 2022', c: 'b2', x: L + 6, y: 400, at: [2, .3] },
      { h: '「离线休息权」相关提案 · 2024–2026', c: 'b2', x: L + 6, y: 460, at: [2, .8] },
    ]
  },
  // 回到开头：她放下手机，睡着了
  S25: {
    vid: { src: 'bed-phone-lamp', in: 22, kb: [1.08, 1.0], grade: 'warm', dim: .15 },
    draw(ctx, lt, D, Q) { ctx.fillStyle = `rgba(4,7,13,${.45 * eo(seg(lt, Q[1] - .5, Q[1] + .5))})`; ctx.fillRect(0, 0, W, H); },
    txt: [{ h: '深夜偷回来的时间，<br>不该再交出去。', c: 'q', x: 0, y: 280, w: W, a: 'center', at: [1, .2] }],
  },
  S26: {
    vid: { src: 'sz-skyline-b', in: 1, speed: .7, kb: [1.12, 1.04], grade: 'warm', dim: .5 },
    draw(ctx) {},
    txt: [
      { h: '我想夺回的，<br>到底是什么？', c: 'h', x: 0, y: 240, w: W, a: 'center', at: [1, .3] },
      { h: '评论区，说说你的答案', c: 'b2', x: 0, y: 520, w: W, a: 'center', at: [1, 3.0] },
    ], fadeOut: .8
  },
};
