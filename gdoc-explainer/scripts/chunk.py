"""Split a request list into sequential batches of roughly <= N KB each.

Usage: python3 chunk.py <reqs.json> <out_prefix> [max_kb=28]
Writes <out_prefix>_0.json, _1.json, ... Send them strictly in order, each exactly once,
each with a fresh writeControl.requiredRevisionId. Never resend a chunk that succeeded.
"""
import json
import sys

src, prefix = sys.argv[1], sys.argv[2]
limit = int(sys.argv[3] if len(sys.argv) > 3 else 28) * 1024
reqs = json.load(open(src, encoding="utf-8"))
chunks, cur, size = [], [], 0
for r in reqs:
    n = len(json.dumps(r, ensure_ascii=False, separators=(",", ":")).encode())
    if cur and size + n > limit:
        chunks.append(cur)
        cur, size = [], 0
    cur.append(r)
    size += n
if cur:
    chunks.append(cur)
for i, c in enumerate(chunks):
    path = f"{prefix}_{i}.json"
    json.dump(c, open(path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(path, len(c), "requests", len(json.dumps(c, ensure_ascii=False, separators=(",", ":"))), "chars")
