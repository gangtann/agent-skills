"""Tile PNGs into one image for fast visual review.

  python contact_sheet.py OUT.png [--cols 2] img1.png img2.png ...
  python contact_sheet.py OUT_PREFIX --deck PREVIEW_DIR [--cols 2] [--per 6]
      -> OUT_PREFIX1.png, OUT_PREFIX2.png ... (6 slides per sheet by default)
"""
import sys, glob
from PIL import Image


def sheet(files, out, cols=2):
    ims = [Image.open(f).convert("RGB") for f in files]
    h0 = ims[0].height
    ims = [im.resize((int(im.width * h0 / im.height), h0)) for im in ims]
    w = max(im.width for im in ims)
    rows = (len(ims) + cols - 1) // cols
    canvas = Image.new("RGB", (cols * w + (cols - 1) * 10, rows * h0 + (rows - 1) * 10), (120, 120, 120))
    for i, im in enumerate(ims):
        canvas.paste(im, ((i % cols) * (w + 10), (i // cols) * (h0 + 10)))
    canvas.save(out)
    print(out)


if __name__ == "__main__":
    args = sys.argv[1:]
    cols = int(args[args.index("--cols") + 1]) if "--cols" in args else 2
    per = int(args[args.index("--per") + 1]) if "--per" in args else 6
    if "--deck" in args:
        files = sorted(glob.glob(args[args.index("--deck") + 1] + "/s*.png"))
        for g in range(0, len(files), per):
            sheet(files[g:g + per], f"{args[0]}{g // per + 1}.png", cols)
    else:
        rest = [a for k, a in enumerate(args[1:], 1) if not a.startswith("--") and args[k - 1] != "--cols"]
        sheet(rest, args[0], cols)
