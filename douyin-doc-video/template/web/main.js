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
// 字幕：长句按标点切成 ≤17 字的段，按字数分配时长
function chunks(text) {
  const parts = text.split(/(?<=[，。；：、？])/).filter(Boolean), out = [];
  let cur = '';
  for (const p of parts) { if ((cur + p).replace(/[，。；：、]/g, '').length > 17 && cur) { out.push(cur); cur = p; } else cur += p; }
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
function currentShot(t) { for (const id of TL.order) { const [a, b] = TL.shots[id]; if (t >= a && t < b) return id; } return TL.order[TL.order.length - 1]; }

window.render = function (t) {
  const id = currentShot(t), sh = SH[id], [a, b] = TL.shots[id], lt = t - a, D = b - a, Q = cuesOf(id);
  for (const k in boxes) boxes[k].style.display = k === id ? 'block' : 'none';
  box(id).style.display = 'block';
  // 3D 层
  if (sh.gl) { glc.style.opacity = 1; City.render(sh.gl, lt, clamp(lt / D), sh.glo || {}); } else glc.style.opacity = 0;
  // 2D 层
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  ctx.clearRect(0, 0, W, H);
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
