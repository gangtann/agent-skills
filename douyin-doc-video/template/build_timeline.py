"""根据每句旁白的实测时长生成 timeline.json（画面、字幕、音乐都对齐它）。
用法: python3 build_timeline.py [durs.json]   # 不给就按 ~285 字/分估算，只用于出预览
script.json 里 text 为空、shot 为 TITLE 或 CH<n> 的条目是片名卡/章节卡（无旁白，固定时长）。
"""
import json, re, sys

S = json.load(open('script.json'))
spoken = [l for l in S if l['text']]
if len(sys.argv) > 1:
    durs = json.load(open(sys.argv[1]))
else:
    durs = [0.205 * len(re.findall(r'[一-鿿〇0-9]', l['text'])) + 0.2 for l in spoken]
assert len(durs) == len(spoken), (len(durs), len(spoken))

def card(sid): return sid == 'TITLE' or re.fullmatch(r'CH\d+', sid) is not None
CARD_LEN = {'TITLE': 3.6}          # 章节卡默认 3.0
GAP_LINE, GAP_SHOT, LEAD = 0.32, 0.75, 1.6
TAIL = 3.2      # 最后一句后的停留
SOURCES = 4.5   # 片尾资料来源卡

t = LEAD
lines, shots, k, prev = [], {}, 0, None
for item in S:
    sid = item['shot']
    if card(sid):
        if prev and not card(prev):
            t += GAP_SHOT - GAP_LINE
        d = CARD_LEN.get(sid, 3.0)
        shots[sid] = [round(t, 3), round(t + d, 3)]
        t += d + 0.25
        prev = sid
        continue
    if prev and prev != sid and not card(prev):
        t += GAP_SHOT - GAP_LINE
    d = durs[k]; k += 1
    lines.append(dict(shot=sid, text=item['text'], start=round(t, 3), end=round(t + d, 3)))
    if sid not in shots:
        shots[sid] = [round(t, 3), None]
    shots[sid][1] = round(t + d, 3)
    t += d + GAP_LINE
    prev = sid

# 画面区间：每个镜头从自己第一句前 0.35s 开始，到下一个镜头开始为止
order = list(shots.keys())
for i, sid in enumerate(order):
    a = 0.0 if i == 0 else shots[sid][0] - (0.0 if card(sid) else 0.35)
    if i + 1 < len(order):
        nxt = order[i + 1]; b = shots[nxt][0] - (0.0 if card(nxt) else 0.35)
    else:
        b = shots[sid][1] + TAIL
    shots[sid] = [round(a, 3), round(b, 3)]
src0 = shots[order[-1]][1]
shots['SRC'] = [src0, round(src0 + SOURCES, 3)]
total = round(src0 + SOURCES, 2)
json.dump(dict(lines=lines, shots=shots, order=order + ['SRC'], total=total),
          open('timeline.json', 'w'), ensure_ascii=False, indent=1)
print('lines', len(lines), 'total', total, 's =', round(total / 60, 2), 'min')
