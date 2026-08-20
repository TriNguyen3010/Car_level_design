"""Cut a 3x3 sheet of white reference cars into recolour-ready layers.

For each cell it does three things the recolour pipeline depends on:

  1. Removes the backdrop by flood-filling inward from the cell border, so the
     dark windshield — which is close to the backdrop in colour but fully
     enclosed by the body — is never eaten.
  2. Splits body from trim. Anything dark (glass, grille, tyres) becomes an
     untinted detail layer; the pale bodywork becomes the base layer. Without
     this split a pink car ends up with pink windows.
  3. Stretches the body's luminance across the full range. The reference cars
     sit in a narrow bright band, and the colour ramp needs the whole 0..1
     range to produce shading rather than a flat wash.

    python3 tools/slice_sheet.py <sheet.png> [--cols 3] [--rows 3] [--size 512]
"""
import argparse
import os
from collections import deque
from PIL import Image, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'assets', 'shapes')

DARK_LO, DARK_HI = 110, 178     # luminance band where body fades into trim


def lum(p):
    return 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]


def backdrop_mask(cell, tol=46):
    """Flood fill from every border pixel. Returns a set of background pixels."""
    w, h = cell.size
    px = cell.load()
    seeds = []
    for x in range(w):
        seeds.append((x, 0)); seeds.append((x, h - 1))
    for y in range(h):
        seeds.append((0, y)); seeds.append((w - 1, y))

    ref = px[0, 0]
    seen = bytearray(w * h)
    q = deque()
    for s in seeds:
        p = px[s]
        if abs(p[0] - ref[0]) + abs(p[1] - ref[1]) + abs(p[2] - ref[2]) < tol * 3:
            i = s[1] * w + s[0]
            if not seen[i]:
                seen[i] = 1
                q.append(s)
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if not (0 <= nx < w and 0 <= ny < h):
                continue
            i = ny * w + nx
            if seen[i]:
                continue
            p = px[nx, ny]
            if abs(p[0] - ref[0]) + abs(p[1] - ref[1]) + abs(p[2] - ref[2]) < tol * 3:
                seen[i] = 1
                q.append((nx, ny))
    return seen


def smoothstep(a, b, x):
    if b == a:
        return 0.0
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def process_cell(cell, size):
    w, h = cell.size
    px = cell.load()
    bg = backdrop_mask(cell)

    alpha = Image.new('L', (w, h), 0)
    ap = alpha.load()
    for y in range(h):
        row = y * w
        for x in range(w):
            ap[x, y] = 0 if bg[row + x] else 255

    # drop the one-pixel ring where car and backdrop blend, then feather
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
    ap = alpha.load()

    body_lums = [lum(px[x, y]) for y in range(h) for x in range(w)
                 if ap[x, y] > 200 and lum(px[x, y]) >= DARK_HI]
    if not body_lums:
        body_lums = [128.0]
    lo, hi = min(body_lums), max(body_lums)
    if hi - lo < 20:
        lo, hi = hi - 60, hi

    base = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    detail = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    bp, dp = base.load(), detail.load()

    for y in range(h):
        for x in range(w):
            a = ap[x, y]
            if a == 0:
                continue
            p = px[x, y]
            l = lum(p)
            dark = 1.0 - smoothstep(DARK_LO, DARK_HI, l)      # 1 = trim, 0 = bodywork
            if dark < 0.999:
                t = (l - lo) / (hi - lo) if hi > lo else 0.5
                g = int(max(0, min(255, 26 + t * 229)))       # stretch to 26..255
                bp[x, y] = (g, g, g, int(a * (1 - dark)))
            if dark > 0.001:
                dp[x, y] = (p[0], p[1], p[2], int(a * dark))

    box = alpha.getbbox()
    if box:
        base = base.crop(box)
        detail = detail.crop(box)

    bw, bh = base.size
    side = max(bw, bh)
    pad = int(side * 0.06)
    canvas = side + pad * 2
    ox, oy = (canvas - bw) // 2, (canvas - bh) // 2

    def place(img):
        sq = Image.new('RGBA', (canvas, canvas), (0, 0, 0, 0))
        sq.paste(img, (ox, oy))
        return sq.resize((size, size), Image.LANCZOS)

    return place(base), place(detail)


def main():
    ap_ = argparse.ArgumentParser()
    ap_.add_argument('sheet')
    ap_.add_argument('--cols', type=int, default=3)
    ap_.add_argument('--rows', type=int, default=3)
    ap_.add_argument('--size', type=int, default=512)
    a = ap_.parse_args()

    os.makedirs(OUT, exist_ok=True)
    sheet = Image.open(a.sheet).convert('RGB')
    W, H = sheet.size
    cw, ch = W / a.cols, H / a.rows

    n = 0
    for r in range(a.rows):
        for c in range(a.cols):
            cell = sheet.crop((int(c * cw), int(r * ch), int((c + 1) * cw), int((r + 1) * ch)))
            base, detail = process_cell(cell, a.size)
            n += 1
            base.save(os.path.join(OUT, 'shape%d_base.png' % n))
            detail.save(os.path.join(OUT, 'shape%d_detail.png' % n))
            print('shape%d' % n, base.size)
    print('%d shape -> assets/shapes/' % n)


if __name__ == '__main__':
    main()
