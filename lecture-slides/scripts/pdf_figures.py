"""Pull figures and tables out of a paper PDF (or look at a reference deck PDF).

  scan  PDF                      list embedded images (xref, px size, bbox in pt) and
                                 Figure/Table caption blocks with their y position, per page
  blocks PDF PAGE                text blocks on one page with bboxes (to find a table's extent)
  image PDF XREF OUT.png         save an embedded raster figure at native resolution
  clip  PDF PAGE x0 y0 x1 y1 OUT.png [DPI]
                                 render a region (pt; page is 1-based) - use for vector
                                 tables/plots; default 300 dpi
  thumbs PDF OUTDIR [DPI]        render every page small (default 40 dpi) + print page text
                                 heads, for reading a reference deck's style

Coordinates are PDF points (1/72 in), origin top-left, as printed by scan/blocks.
Tip: crop tables WITHOUT their caption and cite them on the slide instead.
"""
import sys
import pymupdf as fitz


def scan(pdf):
    d = fitz.open(pdf)
    print(f"{d.page_count} pages, page size {d[0].rect}")
    for i, p in enumerate(d):
        imgs = [(x[0], x[2], x[3], [round(v) for v in r]) for x in p.get_images() for r in p.get_image_rects(x[0])]
        caps = [(round(b[1]), b[4][:70].replace("\n", " ")) for b in p.get_text("blocks")
                if b[4].lstrip().startswith(("Figure", "Table", "Fig."))]
        if imgs or caps:
            print(f"p{i + 1}: images(xref,w,h,bbox)={imgs}")
            for y, c in caps:
                print(f"     caption y={y}: {c}")


def blocks(pdf, page):
    p = fitz.open(pdf)[int(page) - 1]
    for b in p.get_text("blocks"):
        print([round(v) for v in b[:4]], b[4][:70].replace("\n", " | "))
    rules = sorted({round(r["rect"].y0) for r in p.get_drawings()})
    print("horizontal rule / drawing y positions:", rules[:40])


def image(pdf, xref, out):
    d = fitz.open(pdf)
    pix = fitz.Pixmap(d, int(xref))
    if pix.alpha or pix.n > 3:
        pix = fitz.Pixmap(fitz.csRGB, pix)
    pix.save(out)
    print(out, pix.width, pix.height)


def clip(pdf, page, x0, y0, x1, y1, out, dpi=300):
    d = fitz.open(pdf)
    d[int(page) - 1].get_pixmap(dpi=int(dpi), clip=fitz.Rect(*map(float, (x0, y0, x1, y1)))).save(out)
    print(out)


def thumbs(pdf, outdir, dpi=40):
    import os
    os.makedirs(outdir, exist_ok=True)
    d = fitz.open(pdf)
    for i, p in enumerate(d):
        p.get_pixmap(dpi=int(dpi)).save(f"{outdir}/p{i + 1:02d}.png")
        print(i + 1, p.get_text().strip().replace("\n", " | ")[:140])


if __name__ == "__main__":
    cmd, *a = sys.argv[1:] or ["-h"]
    fn = {"scan": scan, "blocks": blocks, "image": image, "clip": clip, "thumbs": thumbs}.get(cmd)
    if not fn:
        print(__doc__); sys.exit(1)
    fn(*a)
