"""Generate a neutral placeholder car so the recolour pipeline can be tested
before the real art exists.

Outputs the exact three layers ASSETS.md asks for:
  car_base.png    body only, neutral grey with shading  -> this is what gets tinted
  car_detail.png  glass / lights / grill / outline      -> never tinted
  car_shadow.png  ground shadow                         -> never tinted
"""
from PIL import Image, ImageDraw, ImageFilter
import os

S = 512
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets')
os.makedirs(OUT, exist_ok=True)

BODY = (58, 22, 454, 486)      # left, top, right, bottom
RADIUS = 96


def silhouette():
    m = Image.new('L', (S, S), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle(BODY, radius=RADIUS, fill=255)
    # wing mirrors sit on the body, so they are body-coloured and belong here
    d.rounded_rectangle((34, 176, 74, 224), radius=14, fill=255)
    d.rounded_rectangle((438, 176, 478, 224), radius=14, fill=255)
    return m


def vertical_ramp(top, bottom):
    g = Image.new('L', (1, S))
    px = g.load()
    for y in range(S):
        t = y / (S - 1)
        px[0, y] = int(round(top + (bottom - top) * t))
    return g.resize((S, S))


def build_base():
    sil = silhouette()
    lum = vertical_ramp(232, 118)

    # roof reads as a raised block: a soft bright cap over the upper third
    roof = Image.new('L', (S, S), 0)
    ImageDraw.Draw(roof).rounded_rectangle((104, 44, 408, 268), radius=88, fill=255)
    roof = roof.filter(ImageFilter.GaussianBlur(34))
    lum = Image.composite(Image.new('L', (S, S), 255), lum,
                          roof.point(lambda v: int(v * 0.42)))

    # a narrow specular streak along the top edge of the roof
    spec = Image.new('L', (S, S), 0)
    ImageDraw.Draw(spec).rounded_rectangle((132, 60, 380, 132), radius=46, fill=255)
    spec = spec.filter(ImageFilter.GaussianBlur(22))
    lum = Image.composite(Image.new('L', (S, S), 255), lum,
                          spec.point(lambda v: int(v * 0.55)))

    # ambient occlusion: darken wherever we are close to the silhouette edge
    inner = sil.filter(ImageFilter.MinFilter(9)).filter(ImageFilter.GaussianBlur(11))
    edge = Image.eval(inner, lambda v: 255 - v)
    lum = Image.composite(Image.new('L', (S, S), 40), lum,
                          edge.point(lambda v: int(v * 0.62)))

    rgb = Image.merge('RGB', (lum, lum, lum))
    out = rgb.convert('RGBA')
    out.putalpha(sil)
    return out


def build_detail():
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # windscreen
    d.rounded_rectangle((132, 218, 380, 320), radius=42, fill=(38, 46, 62, 190))
    d.rounded_rectangle((146, 228, 366, 268), radius=30, fill=(96, 116, 142, 130))

    # headlights
    for cx in (128, 384):
        d.ellipse((cx - 40, 366, cx + 40, 434), fill=(255, 252, 236, 235))
        d.ellipse((cx - 24, 378, cx + 8, 406), fill=(255, 255, 255, 255))

    # grill
    d.rounded_rectangle((178, 438, 334, 468), radius=13, fill=(26, 28, 36, 210))

    # outline, drawn from the silhouette so it hugs the mirrors too
    sil = silhouette()
    ring = Image.eval(sil, lambda v: 255 if v > 128 else 0)
    shrunk = ring.filter(ImageFilter.MinFilter(7))
    stroke = Image.eval(Image.merge('L', (ring,)), lambda v: v)
    stroke = Image.composite(Image.new('L', (S, S), 255), Image.new('L', (S, S), 0), ring)
    stroke = Image.eval(stroke, lambda v: v)
    outline = Image.new('RGBA', (S, S), (18, 20, 26, 255))
    mask = Image.composite(Image.new('L', (S, S), 0), ring, shrunk)
    outline.putalpha(mask.point(lambda v: int(v * 0.55)))
    img = Image.alpha_composite(outline, img)
    return img


def build_shadow():
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((72, 60, 440, 500), radius=RADIUS, fill=(0, 0, 0, 150))
    return img.filter(ImageFilter.GaussianBlur(20))


for name, img in (('car_base', build_base()),
                  ('car_detail', build_detail()),
                  ('car_shadow', build_shadow())):
    p = os.path.join(OUT, name + '.png')
    img.save(p)
    print('wrote', os.path.relpath(p), img.size)
