"""Render a Drive PDF export to PNG pages for a visual check.

Usage: python3 render_pdf.py <export.json|export.pdf> <out_dir> [dpi=110] [first_page] [last_page]
<export.json> is the saved result of Drive download_file_content (exportMimeType application/pdf);
its "content" field is base64. Needs PyMuPDF (`import fitz`).
"""
import base64
import json
import sys
from pathlib import Path

import fitz

src, out = Path(sys.argv[1]), Path(sys.argv[2])
dpi = int(sys.argv[3]) if len(sys.argv) > 3 else 110
raw = src.read_bytes()
if not raw.startswith(b"%PDF"):
    raw = base64.b64decode(json.loads(raw)["content"])
out.mkdir(parents=True, exist_ok=True)
(out / "export.pdf").write_bytes(raw)
doc = fitz.open(stream=raw, filetype="pdf")
a = int(sys.argv[4]) - 1 if len(sys.argv) > 4 else 0
b = int(sys.argv[5]) if len(sys.argv) > 5 else doc.page_count
for i in range(a, min(b, doc.page_count)):
    p = out / f"p{i + 1}.png"
    doc[i].get_pixmap(dpi=dpi).save(p)
    print(p)
print(doc.page_count, "pages total")
