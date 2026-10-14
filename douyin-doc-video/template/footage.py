"""实拍素材：下载（只限白名单素材站）→ 授权台账 → 转码成可逐帧渲染的片段。
  python3 footage.py add <文件直链> --page <素材页网址> --author 作者 [--id 名字] [--license 协议] [--kind video|music|sfx]
        下载到 footage/raw/，登记到 footage/ledger.json（来源、作者、协议、大小、sha256、日期），打印文件名/来源/大小
  python3 footage.py prep <id> [--ss 起点秒] [--t 时长秒]
        视频 → footage/<id>.mp4：裁满画幅（format.json），30fps，全 I 帧（逐帧精确跳转），无声
        音频 → footage/<id>.wav：48k 立体声
  python3 footage.py list                   列出台账
  python3 footage.py credits [输出.md]      生成 素材授权.md（交付目录里放一份）
白名单（用户 2026-10-14 确认）：Pexels、Pixabay、Coverr（视频，免署名可商用）；Mixkit 只限 Free License；Freesound 只限 CC0。
需要 PATH 里有 ffmpeg。
"""
import sys, os, json, hashlib, argparse, subprocess, datetime, urllib.request, urllib.parse, re

SITES = {   # 站点 → (默认协议, 协议页)
    'pexels.com': ('Pexels License', 'https://www.pexels.com/license/'),
    'pixabay.com': ('Pixabay Content License', 'https://pixabay.com/service/license-summary/'),
    'coverr.co': ('Coverr License', 'https://coverr.co/license'),
    'mixkit.co': ('Mixkit Free License', 'https://mixkit.co/license/'),
    'freesound.org': ('CC0 1.0', 'https://creativecommons.org/publicdomain/zero/1.0/'),
}
LEDGER = 'footage/ledger.json'
PORT = os.path.exists('format.json') and json.load(open('format.json')).get('format') == 'portrait'
W, H = (1080, 1920) if PORT else (1920, 1080)


def site_of(url):
    host = urllib.parse.urlparse(url).hostname or ''
    return next((s for s in SITES if host == s or host.endswith('.' + s)), None)


def load():
    return json.load(open(LEDGER)) if os.path.exists(LEDGER) else []


def save(rows):
    os.makedirs('footage', exist_ok=True)
    json.dump(rows, open(LEDGER, 'w'), ensure_ascii=False, indent=1)


def add(a):
    site = site_of(a.page)
    if not site: sys.exit(f'拒绝：{a.page} 不在白名单素材站（{", ".join(SITES)}）。白名单外的来源要先问用户。')
    if not a.url.startswith('https://'): sys.exit('拒绝：文件直链必须是 https')
    lic = a.license or SITES[site][0]
    if site == 'mixkit.co' and 'free' not in lic.lower(): sys.exit('拒绝：Mixkit 只能用标着 Free License 的素材（Restricted 不可商用）')
    if site == 'freesound.org' and 'cc0' not in lic.lower(): sys.exit('拒绝：Freesound 只能用 CC0 的声音（--license CC0）')
    rows = load()
    sid = a.id or re.sub(r'[^a-z0-9]+', '-', urllib.parse.urlparse(a.page).path.lower()).strip('-')[-40:] or f'clip{len(rows) + 1}'
    if any(r['id'] == sid for r in rows): sys.exit(f'台账里已有 {sid}')
    os.makedirs('footage/raw', exist_ok=True)
    ext = os.path.splitext(urllib.parse.urlparse(a.url).path)[1] or '.mp4'
    dst = f'footage/raw/{sid}{ext}'
    req = urllib.request.Request(a.url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=120) as r, open(dst, 'wb') as f:
        final = r.geturl()
        if not site_of(final) and not a.cdn_ok:
            f.close(); os.remove(dst)
            sys.exit(f'拒绝：直链跳转到了白名单以外的域名 {urllib.parse.urlparse(final).hostname}（确认是该站的 CDN 后加 --cdn-ok）')
        while chunk := r.read(1 << 20): f.write(chunk)
    size = os.path.getsize(dst); sha = hashlib.sha256(open(dst, 'rb').read()).hexdigest()
    kind = a.kind or ('video' if ext.lower() in ('.mp4', '.mov', '.webm', '.m4v') else 'sfx')
    rows.append({'id': sid, 'kind': kind, 'site': site, 'page': a.page, 'url': a.url, 'author': a.author or '',
                 'license': lic, 'license_url': SITES[site][1], 'file': dst, 'bytes': size, 'sha256': sha,
                 'date': datetime.date.today().isoformat(), 'note': a.note or ''})
    save(rows)
    print(f'已下载 {os.path.basename(dst)}  来源 {a.page}  大小 {size / 1e6:.1f}MB  协议 {lic}')


def prep(a):
    r = next((r for r in load() if r['id'] == a.id), None) or sys.exit(f'台账里没有 {a.id}')
    cut = (['-ss', str(a.ss)] if a.ss else []) + (['-t', str(a.t)] if a.t else [])
    if r['kind'] == 'video':
        out = f'footage/{a.id}.mp4'
        vf = f'scale={W}:{H}:force_original_aspect_ratio=increase:flags=lanczos,crop={W}:{H},fps=30,format=yuv420p'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', *cut, '-i', r['file'], '-an', '-vf', vf, '-c:v', 'libx264',
                        '-preset', 'medium', '-crf', '16', '-g', '1', '-bf', '0', '-movflags', '+faststart', out], check=True)
    else:
        out = f'footage/{a.id}.wav'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', *cut, '-i', r['file'], '-ar', '48000', '-ac', '2', out], check=True)
    dur = float(subprocess.run(['ffmpeg', '-i', out], capture_output=True, text=True).stderr.split('Duration: ')[1].split(',')[0].split(':')[-1])
    print(f'{out}  {dur:.2f}s')


def credits(out):
    rows = load()
    lines = ['# 素材授权台账', '', '本片使用的第三方实拍素材与声音。全部来自用户确认的白名单素材站，协议允许免署名商用；下表留作授权凭证。', '',
             '| # | 素材 | 类型 | 来源页 | 作者 | 协议 | 下载日期 | sha256 |', '|---|---|---|---|---|---|---|---|']
    for i, r in enumerate(rows, 1):
        lines.append(f"| {i} | {r['id']} | {r['kind']} | {r['page']} | {r['author']} | [{r['license']}]({r['license_url']}) | {r['date']} | {r['sha256'][:12]} |")
    lines += ['', '注意：Pexels/Pixabay/Coverr 不提供肖像与物权授权。画面里可辨认的人不能被放在负面语境里，不能暗示其代言；避开可辨认的品牌标志。']
    open(out, 'w').write('\n'.join(lines) + '\n'); print(out, len(rows), '条')


p = argparse.ArgumentParser(); sp = p.add_subparsers(dest='cmd', required=True)
x = sp.add_parser('add'); x.add_argument('url'); x.add_argument('--page', required=True); x.add_argument('--author')
x.add_argument('--id'); x.add_argument('--license'); x.add_argument('--kind', choices=['video', 'music', 'sfx'])
x.add_argument('--note'); x.add_argument('--cdn-ok', action='store_true')
x = sp.add_parser('prep'); x.add_argument('id'); x.add_argument('--ss', type=float); x.add_argument('--t', type=float)
sp.add_parser('list')
x = sp.add_parser('credits'); x.add_argument('out', nargs='?', default='素材授权.md')
a = p.parse_args()
if a.cmd == 'add': add(a)
elif a.cmd == 'prep': prep(a)
elif a.cmd == 'list':
    for r in load(): print(f"{r['id']:<28} {r['kind']:<6} {r['site']:<14} {r['bytes'] / 1e6:6.1f}MB  {r['license']}  {r['page']}")
else: credits(a.out)
