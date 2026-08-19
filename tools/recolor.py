"""Batch recolour, same algorithm as recolor.html.

Reads the palette straight out of src/levels.js so the CLI and the tool can
never drift apart, then writes assets/car_<name>.png for every colour.

    python3 tools/recolor.py [--size 512] [--shadow 0.45] [--light 0.72]
                             [--mid 0.52] [--sat 0.15]
"""
import argparse
import json
import os
import re
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
ASSETS = os.path.join(ROOT, 'assets')


def load_palette():
    src = open(os.path.join(ROOT, 'src', 'levels.js')).read()
    block = re.search(r'var PALETTE = \{(.*?)\};', src, re.S).group(1)
    return dict(re.findall(r"(\w+)\s*:\s*'(#[0-9a-fA-F]{6})'", block))


def hex2rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def recolor(base, rgb, shadow, light, mid, sat):
    """Map source luminance onto a ramp built from the target colour: dark end
    is the colour darkened, the midpoint is the colour itself, the bright end
    washes toward white. Keeps all original shading, and unlike a hue rotate it
    still works for pale targets like beige and white."""
    r0, g0, b0 = rgb
    avg = (r0 + g0 + b0) / 3
    tr, tg, tb = (max(0, min(255, avg + (c - avg) * (1 + sat))) for c in rgb)

    px = base.load()
    w, h = base.size
    out = Image.new('RGBA', (w, h))
    op = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                op[x, y] = (0, 0, 0, 0)
                continue
            l = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0
            if l <= mid:
                t = l / mid if mid > 0 else 0.0
                nr = tr * (1 - shadow) + (tr - tr * (1 - shadow)) * t
                ng = tg * (1 - shadow) + (tg - tg * (1 - shadow)) * t
                nb = tb * (1 - shadow) + (tb - tb * (1 - shadow)) * t
            else:
                t = (l - mid) / (1 - mid)
                nr = tr + (255 - tr) * light * t
                ng = tg + (255 - tg) * light * t
                nb = tb + (255 - tb) * light * t
            op[x, y] = (int(nr), int(ng), int(nb), a)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--size', type=int, default=256)
    ap.add_argument('--shadow', type=float, default=0.45)
    ap.add_argument('--light', type=float, default=0.72)
    ap.add_argument('--mid', type=float, default=0.52)
    ap.add_argument('--sat', type=float, default=0.15)
    a = ap.parse_args()

    base_path = os.path.join(ASSETS, 'car_base.png')
    if not os.path.exists(base_path):
        raise SystemExit('thiếu assets/car_base.png — xem ASSETS.md')
    base = Image.open(base_path).convert('RGBA').resize((a.size, a.size), Image.LANCZOS)

    def optional(name):
        p = os.path.join(ASSETS, name)
        if not os.path.exists(p):
            return None
        return Image.open(p).convert('RGBA').resize((a.size, a.size), Image.LANCZOS)

    detail = optional('car_detail.png')
    shadow_layer = optional('car_shadow.png')

    palette = load_palette()
    atlas = {'size': a.size, 'frames': {}}
    for i, (name, hexcode) in enumerate(sorted(palette.items())):
        body = recolor(base, hex2rgb(hexcode), a.shadow, a.light, a.mid, a.sat)
        canvas = Image.new('RGBA', (a.size, a.size), (0, 0, 0, 0))
        if shadow_layer:
            canvas = Image.alpha_composite(canvas, shadow_layer)
        canvas = Image.alpha_composite(canvas, body)
        if detail:
            canvas = Image.alpha_composite(canvas, detail)
        canvas.save(os.path.join(ASSETS, 'car_%s.png' % name))
        atlas['frames'][name] = {'i': i, 'w': a.size, 'h': a.size}
        print('car_%s.png' % name, hexcode)

    json.dump(atlas, open(os.path.join(ASSETS, 'cars_atlas.json'), 'w'), indent=2)
    print('%d màu @ %dpx' % (len(palette), a.size))


if __name__ == '__main__':
    main()
