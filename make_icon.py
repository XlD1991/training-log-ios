#!/usr/bin/env python3
"""Generate iOS app icons: white background + blue dumbbell (RGB, no alpha).

Three visual variants are available. VARIANT below decides which one is
written to Resources/ as the three required PNGs. All variants are also
rendered at 1024 into build/icon-preview/ for side-by-side comparison.

  A  disc    - short bar + rounded oval weight plates + white center hubs
  B  block   - thick rounded plates separated by thin white gaps
  C  tilt    - single-color silhouette rotated for a dynamic look

After changing VARIANT, run `python rebrand.py old.ipa new.ipa` to apply the
new icon (and display name) to an existing IPA. No rebuild / no Mac needed.
"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "Resources")
PREVIEW = os.path.join(ROOT, "build", "icon-preview")

VARIANT = "E"

BLUE = (26, 92, 208)
BLUE_DARK = (20, 74, 176)
BLUE_LIGHT = (104, 156, 240)
WHITE = (255, 255, 255)

SUPERSAMPLE = 4


def make(size, variant):
    s = size * SUPERSAMPLE
    im = Image.new("RGB", (s, s), WHITE)
    d = ImageDraw.Draw(im)
    u = s / 1024.0

    def rr(x0, y0, x1, y1, radius, fill):
        d.rounded_rectangle(
            [x0 * u, y0 * u, x1 * u, y1 * u],
            radius=radius * u,
            fill=fill,
        )

    def oval(x0, y0, x1, y1, fill):
        d.ellipse([x0 * u, y0 * u, x1 * u, y1 * u], fill=fill)

    if variant == "A":
        rr(300, 442, 724, 582, 70, BLUE)          # thick bar
        oval(120, 332, 340, 692, BLUE)            # left weight plate
        oval(684, 332, 904, 692, BLUE)            # right weight plate
        oval(200, 482, 260, 542, WHITE)           # left hub
        oval(764, 482, 824, 542, WHITE)           # right hub
    elif variant == "B":
        rr(380, 466, 644, 558, 46, BLUE)
        rr(220, 308, 380, 716, 64, BLUE)
        rr(644, 308, 804, 716, 64, BLUE)
        rr(132, 372, 208, 652, 36, BLUE)
        rr(816, 372, 892, 652, 36, BLUE)
    elif variant == "E":
        # minimal: one thick plate per side + thick grip, no inner detail
        rr(300, 450, 724, 574, 62, BLUE)          # grip
        rr(150, 306, 340, 718, 50, BLUE)          # left plate
        rr(684, 306, 874, 718, 50, BLUE)          # right plate
    elif variant == "D":
        # stepped weight plates, separated by white gaps
        rr(340, 448, 684, 576, 64, BLUE)          # center grip, tucked under plates
        rr(644, 300, 736, 724, 36, BLUE)          # right inner
        rr(758, 336, 836, 688, 32, BLUE)          # right middle
        rr(858, 372, 920, 652, 28, BLUE)          # right outer
        rr(288, 300, 380, 724, 36, BLUE)          # left inner
        rr(188, 336, 266, 688, 32, BLUE)          # left middle
        rr(104, 372, 166, 652, 28, BLUE)          # left outer
    elif variant == "C":
        rr(340, 470, 684, 554, 42, BLUE)
        rr(210, 330, 340, 694, 55, BLUE)
        rr(684, 330, 814, 694, 55, BLUE)
        rr(160, 380, 210, 644, 25, BLUE)
        rr(814, 380, 864, 644, 25, BLUE)

    if variant == "C":
        im = im.rotate(-28, resample=Image.BICUBIC, expand=False, fillcolor=WHITE)
    if SUPERSAMPLE > 1:
        im = im.resize((size, size), Image.LANCZOS)
    return im


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(PREVIEW, exist_ok=True)
    print("shipped variant:", VARIANT)
    for size, name in [(1024, "Icon-1024.png"),
                       (120, "Icon-60@2x.png"),
                       (180, "Icon-60@3x.png")]:
        path = os.path.join(OUT, name)
        make(size, VARIANT).save(path, "PNG")
        print("  %-18s %4d x %4d  RGB" % (name, size, size))
    for variant, label in [("A", "A-disc"), ("B", "B-block"), ("C", "C-tilt")]:
        path = os.path.join(PREVIEW, label + ".png")
        make(1024, variant).save(path, "PNG")
        print("  preview:", path)


if __name__ == "__main__":
    main()
