// 时间线驱动：镜头切换、文字出现、字幕
const glc = document.getElementById('gl'), c2 = document.getElementById('c2'), fx = document.getElementById('fx');
const ctx = c2.getContext('2d'), fctx = fx.getContext('2d'), layer = document.getElementById('layer'), subEl = document.getElementById('sub');
City.init(glc);
const boxes = {};
const cuesOf = id => { const a = TL.shots[id][0]; return TL.lines.filter(l => l.shot === id).map(l => l.start - a); };
const at = (spec, Q) => spec == null ? null : (typeof spec === 'number' ? spec : (Q[spec[0]] ?? 0) + (spec[1] || 0));

function box(id) {
  if (boxes[id]) return boxes[id];
  const b = document.createElement('div'); b.style.display = 'none'; layer.appendChild(b);
  (SH[id].txt || []).forEach(d => {
    const e = document.createElement('div'); e.className = 'tx ' + (d.c || 'b'); e.innerHTML = d.h;
    e.style.left = d.x + 'px'; e.style.top = d.y + 'px'; if (d.w) e.style.width = d.w + 'px'; if (d.a) e.style.textAlign = d.a;
    if (d.css) e.style.cssText += d.css;
    b.appendChild(e); d._e = e;
  });
  return boxes[id] = b;
}
// 字幕：长句按标点切成 ≤FMT.sub.max 字的段（横屏 20，竖屏 17），按字数分配时长
function chunks(text) {
  const parts = text.split(/(?<=[，。；：、？])/).filter(Boolean), out = [];
  let cur = '';
  for (const p of parts) { if ((cur + p).replace(/[，。；：、]/g, '').length > FMT.sub.max && cur) { out.push(cur); cur = p; } else cur += p; }
  if (cur) out.push(cur);
  return out.map(s => s.replace(/[，。；、：]$/, ''));
}
function subtitle(t) {
  const l = TL.lines.find(l => t >= l.start - .04 && t < l.end + .18);
  if (!l) { subEl.textContent = ''; return; }
  const cs = chunks(l.text), n = cs.map(s => s.length), tot = n.reduce((a, b) => a + b, 0);
  let acc = l.start, k = 0;
  for (; k < cs.length - 1; k++) { acc += (l.end - l.start) * n[k] / tot; if (t < acc) break; }
  subEl.textContent = cs[k];
}
// 实拍素材层（footage.py prep 出来的 footage/<id>.mp4，全 I 帧，可逐帧精确跳转）
//   shot.vid = { src, in?:素材起点秒, speed?:1, kb?:[起始缩放, 结束缩放], pan?:[dx0,dy0,dx1,dy1], grade?:'night'|'warm'|'doc'|'none'|{f, tints:[[颜色,混合模式,不透明度]]}, dim?:0–1 }
//   或这样的数组，每项加 t0（镜头内秒）按时间硬切。素材画在 2D 层最底下，draw() 再往上叠压暗、图表和文字。
//   pan 的位移不能超过 (缩放-1)×W/2，否则露边。
const vids = {};
function vidEl(src) {
  if (vids[src]) return vids[src];
  const v = document.createElement('video'); v.muted = true; v.preload = 'auto'; v.src = '../footage/' + src + '.mp4';
  const ready = new Promise((ok, bad) => {
    v.addEventListener('loadeddata', ok, { once: true });
    v.addEventListener('error', () => bad(new Error('找不到素材 footage/' + src + '.mp4（先 python3 footage.py prep ' + src + '）')), { once: true });
  });
  return vids[src] = { v, ready };
}
const seekTo = (v, t) => Math.abs(v.currentTime - t) < 1e-4 ? null : new Promise(ok => { v.addEventListener('seeked', ok, { once: true }); v.currentTime = t; });
const GRADES = {   // 调色：滤镜 + 叠色 [颜色, 混合模式, 不透明度]。不要用深色 soft-light/overlay，夜景会被压暗一半
  night: { f: 'brightness(1.1) contrast(1.05) saturate(.85)', tints: [['#0e1c33', 'screen', 1]] },               // 黑位抬成藏青，保留暖色灯光（默认）
  warm: { f: 'brightness(1.08) contrast(1.04) saturate(.95)', tints: [['#1c1208', 'screen', 1], ['#ffb070', 'color', .12]] },  // 最后一章转暖
  doc: { f: 'brightness(1.05) contrast(1.05) saturate(.85)', tints: [['#0a1220', 'screen', 1]] },                 // 白天/室内，轻度统一
  none: { f: 'none' },
};
async function drawVid(ctx, spec, lt, D) {
  const list = Array.isArray(spec) ? spec : [spec];
  let i = 0; while (i + 1 < list.length && (list[i + 1].t0 || 0) <= lt) i++;
  const s = list[i], t0 = s.t0 || 0, t1 = i + 1 < list.length ? list[i + 1].t0 : D, p = ease(clamp((lt - t0) / Math.max(.01, t1 - t0)));
  const { v, ready } = vidEl(s.src); await ready;
  await seekTo(v, clamp((s.in || 0) + (lt - t0) * (s.speed ?? 1), 0, v.duration - 1 / 30));
  const k = lerp(...(s.kb || [1, 1]), p), pan = s.pan || [0, 0, 0, 0], g = typeof s.grade === 'object' ? s.grade : GRADES[s.grade || 'night'];
  ctx.save(); ctx.filter = g.f;
  ctx.translate(W / 2 + lerp(pan[0], pan[2], p), H / 2 + lerp(pan[1], pan[3], p)); ctx.scale(k, k); ctx.drawImage(v, -W / 2, -H / 2, W, H);
  ctx.restore();
  for (const [col, mode, al] of g.tints || []) { ctx.save(); ctx.globalCompositeOperation = mode; ctx.globalAlpha = al; ctx.fillStyle = col; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  if (s.dim) { ctx.fillStyle = `rgba(4,7,13,${s.dim})`; ctx.fillRect(0, 0, W, H); }
}
function currentShot(t) { for (const id of TL.order) { const [a, b] = TL.shots[id]; if (t >= a && t < b) return id; } return TL.order[TL.order.length - 1]; }

window.render = async function (t) {   // async：有实拍素材时要等视频跳转到位
  const id = currentShot(t), sh = SH[id], [a, b] = TL.shots[id], lt = t - a, D = b - a, Q = cuesOf(id);
  for (const k in boxes) boxes[k].style.display = k === id ? 'block' : 'none';
  box(id).style.display = 'block';
  // 3D 层
  if (sh.gl) { glc.style.opacity = 1; City.render(sh.gl, lt, clamp(lt / D), sh.glo || {}); } else glc.style.opacity = 0;
  // 2D 层
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  ctx.clearRect(0, 0, W, H);
  if (sh.vid) await drawVid(ctx, sh.vid, lt, D);
  if (sh.draw) { ctx.save(); sh.draw(ctx, lt, D, Q); ctx.restore(); }
  // 文字
  (sh.txt || []).forEach(d => {
    const s = at(d.at, Q) ?? .3, o = at(d.out, Q);
    let v = eo(seg(lt, s, s + (d.dur || .8)));
    if (o != null) v *= 1 - ease(seg(lt, o, o + .5));
    if (d.fn) d._e.innerHTML = d.fn(lt, Q);
    d._e.style.opacity = v;
    d._e.style.transform = `translateY(${(1 - v) * (d.rise ?? 22)}px)`;
    d._e.style.filter = v < 1 ? `blur(${(1 - v) * 8}px)` : 'none';
  });
  // 转场（黑场叠化）+ 颗粒暗角
  fctx.setTransform(1, 0, 0, 1, 0, 0); fctx.clearRect(0, 0, W, H);
  grainVignette(fctx, t, sh.grain ?? .045);
  const fin = sh.cutIn ? 1 : ease(seg(lt, 0, sh.fadeIn ?? .55)), fout = sh.cutOut ? 1 : ease(seg(b - t, 0, sh.fadeOut ?? .5));
  const dark = 1 - Math.min(fin, fout);
  if (dark > 0) { fctx.fillStyle = `rgba(3,5,10,${dark})`; fctx.fillRect(0, 0, W, H); }
  subtitle(t);
};
render(0);
