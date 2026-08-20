/* Runtime car sprites: N body shapes x the whole palette, tinted on a canvas.
 *
 * Shape is purely cosmetic. Two cars of the same colour are the same piece no
 * matter which body they wear, exactly like real traffic — which is the point:
 * it stops a grid of 36 identical silhouettes looking like wallpaper without
 * adding a single rule to the game.
 *
 * Combinations are tinted on demand and cached, so a level only ever pays for
 * the colours and shapes it actually shows.
 */
(function (global) {
  'use strict';

  var REV = 'REV';
  var DIR = 'assets/shapes/';
  var MAX_SHAPES = 9;
  var RENDER = 256;

  /* Same ramp as tools/recolor.py — dark end darkened, midpoint the colour
   * itself, bright end washed toward white. */
  var TINT = { shadow: 0.34, light: 0.46, mid: 0.60, sat: 0.26 };

  var shapes = [];              // {base: Image, detail: Image}
  var cache = {};
  var loading = null;

  function hex2rgb(h) {
    h = String(h).replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  function loadImage(src) {
    return new Promise(function (res) {
      var img = new Image();
      img.onload = function () { res(img); };
      img.onerror = function () { res(null); };
      img.src = src;
    });
  }

  function load() {
    if (loading) return loading;
    var jobs = [];
    for (var i = 1; i <= MAX_SHAPES; i++) {
      jobs.push(Promise.all([
        loadImage(DIR + 'shape' + i + '_base.png'),
        loadImage(DIR + 'shape' + i + '_detail.png')
      ]));
    }
    loading = Promise.all(jobs).then(function (pairs) {
      shapes = pairs.filter(function (p) { return p[0]; })
                    .map(function (p) { return { base: p[0], detail: p[1] }; });
      return shapes.length;
    });
    return loading;
  }

  function count() { return shapes.length; }

  function tint(ctx, rgb) {
    var img = ctx.getImageData(0, 0, RENDER, RENDER), d = img.data;
    var avg = (rgb[0] + rgb[1] + rgb[2]) / 3;
    var tr = Math.max(0, Math.min(255, avg + (rgb[0] - avg) * (1 + TINT.sat)));
    var tg = Math.max(0, Math.min(255, avg + (rgb[1] - avg) * (1 + TINT.sat)));
    var tb = Math.max(0, Math.min(255, avg + (rgb[2] - avg) * (1 + TINT.sat)));
    var dark = TINT.shadow, light = TINT.light, mid = TINT.mid;
    for (var i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      var l = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
      var t;
      if (l <= mid) {
        t = mid > 0 ? l / mid : 0;
        d[i]     = tr * (1 - dark) + (tr * dark) * t;
        d[i + 1] = tg * (1 - dark) + (tg * dark) * t;
        d[i + 2] = tb * (1 - dark) + (tb * dark) * t;
      } else {
        t = (l - mid) / (1 - mid);
        d[i]     = tr + (255 - tr) * light * t;
        d[i + 1] = tg + (255 - tg) * light * t;
        d[i + 2] = tb + (255 - tb) * light * t;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function signOverlay(ctx) {
    var c = RENDER / 2, cy = RENDER * 0.47, r = RENDER * 0.19;
    ctx.beginPath(); ctx.arc(c, cy, r + RENDER * 0.022, 0, 6.284);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.beginPath(); ctx.arc(c, cy, r, 0, 6.284);
    ctx.fillStyle = '#d8332b'; ctx.fill();
    ctx.fillStyle = '#fff';
    var bw = r * 0.62, bh = r * 0.17;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(c - bw, cy - bh, bw * 2, bh * 2, bh);
    else ctx.rect(c - bw, cy - bh, bw * 2, bh * 2);
    ctx.fill();
  }

  function questionOverlay(ctx) {
    ctx.save();
    ctx.font = '700 ' + Math.round(RENDER * 0.42) + 'px -apple-system, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(125,127,230,.9)';
    ctx.shadowBlur = RENDER * 0.09;
    ctx.fillStyle = '#7d7fe6';
    ctx.fillText('?', RENDER / 2, RENDER * 0.47);
    ctx.restore();
  }

  /* kind: a palette name, 'REV', or 'hidden'. */
  function get(kind, shapeIdx, palette) {
    if (!shapes.length) return null;
    var s = shapes[((shapeIdx % shapes.length) + shapes.length) % shapes.length];
    var key = kind + '|' + shapes.indexOf(s);
    if (cache[key]) return cache[key];

    var cv = document.createElement('canvas');
    cv.width = cv.height = RENDER;
    var ctx = cv.getContext('2d', { willReadFrequently: true });

    var rgb, showDetail = true;
    if (kind === REV) { rgb = hex2rgb('#3a4050'); }
    else if (kind === 'hidden') { rgb = hex2rgb('#161a26'); showDetail = false; }
    else { rgb = hex2rgb((palette && palette[kind]) || '#888888'); }

    ctx.drawImage(s.base, 0, 0, RENDER, RENDER);
    tint(ctx, rgb);
    if (showDetail && s.detail) ctx.drawImage(s.detail, 0, 0, RENDER, RENDER);
    if (kind === REV) signOverlay(ctx);
    if (kind === 'hidden') questionOverlay(ctx);

    cache[key] = cv.toDataURL('image/png');
    return cache[key];
  }

  function clearCache() { cache = {}; }

  global.Sprites = {
    load: load, count: count, get: get, clearCache: clearCache,
    MAX_SHAPES: MAX_SHAPES, TINT: TINT
  };
})(typeof self !== 'undefined' ? self : this);
