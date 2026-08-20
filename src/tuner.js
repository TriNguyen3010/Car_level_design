/* High-level difficulty tuning.
 *
 * "Make this level harder" is not one edit — it is a choice between five levers
 * that feel completely different to play. So rather than guess at their effect,
 * the tuner builds a candidate level for each lever, actually playtests it, and
 * reports the measured change in difficulty. The designer picks by outcome.
 *
 * Every lever preserves the colour-count invariant, so a suggestion is never
 * an unplayable level.
 */
(function (global) {
  'use strict';

  var E = global.Engine, S = global.Solver, P = global.Playtest, G = global.Gen;
  var REV = 'REV';

  function clone(L) { return JSON.parse(JSON.stringify(L)); }
  function readGrid(L) {
    return L.grid.map(function (col) {
      return col.map(function (spec) {
        var s = String(spec), h = s.charAt(0) === '?';
        return { c: h ? s.slice(1) : s, h: h };
      });
    });
  }
  function writeGrid(g) {
    return g.map(function (col) { return col.map(function (x) { return (x.h ? '?' : '') + x.c; }); });
  }
  function padColor(L) { return String(L.pad).replace(/^\?/, ''); }
  function countColors(L) {
    var counts = {}, g = readGrid(L);
    g.forEach(function (col) { col.forEach(function (x) { counts[x.c] = (counts[x.c] || 0) + 1; }); });
    var p = padColor(L);
    counts[p] = (counts[p] || 0) + 1;
    return counts;
  }
  function realColors(L) {
    return Object.keys(countColors(L)).filter(function (k) { return k !== REV; });
  }
  function hiddenCount(L) {
    var n = 0;
    readGrid(L).forEach(function (col) { col.forEach(function (x) { if (x.h) n++; }); });
    return n;
  }

  /* ---------- difficulty score ---------- */

  function measure(level, runs) {
    var out = { valid: E.validate(level).ok };
    if (!out.valid) return out;

    var pt = P.runSync(level, runs || 600, { seed: 4242 });
    var careful = pt.profiles[0], avg = pt.profiles[1], sloppy = pt.profiles[2];

    /* A careful player's 10th percentile is the practical optimum: cheaper than
     * IDA* and a better reference for budget than a solve no human will find. */
    var opt = careful.p[0.1] || careful.p[0.5];
    var g = S.greedySolve(E.createState(level), false);
    var shape = g.won ? S.pathShape(level, g.moves) : null;

    var cells = level.cols * level.rows;
    var slack = opt ? level.moves / opt : null;
    var failRate = 1 - avg.winRateAtBudget;
    var thinking = shape ? Math.min(1, (shape.choiceRatio + 0.5 * shape.dumpRatio) / 0.5) : 0;
    var pressure = slack ? Math.max(0, Math.min(1, (2.2 - slack) / 1.4)) : 0;
    var info = hiddenCount(level) / cells;
    var grind = opt ? Math.min(1, (opt / cells) / 1.2) : 0;

    out.D = Math.round(100 * (0.38 * failRate + 0.25 * thinking + 0.15 * pressure + 0.09 * info + 0.13 * grind));
    out.depth = Math.round(100 * (shape ? shape.choiceRatio + 0.4 * shape.dumpRatio : 0));
    out.practicalOpt = opt;
    out.slack = slack;
    out.winCareful = careful.winRateAtBudget;
    out.winAvg = avg.winRateAtBudget;
    out.winSloppy = sloppy.winRateAtBudget;
    out.ceiling = avg.ceiling;
    out.choiceRatio = shape ? shape.choiceRatio : null;
    out.dumpRatio = shape ? shape.dumpRatio : null;
    out.colors = realColors(level).length;
    out.strays = strayCount(level);
    out.hidden = hiddenCount(level);
    out.budgetFor75 = avg.budgetFor[75];
    out.budgetFor60 = avg.budgetFor[60];
    return out;
  }

  /* ---------- column target assignment ---------- */

  function assignTargets(L) {
    var g = readGrid(L), counts = countColors(L), rows = L.rows;
    var capacity = {}, colors = [];
    Object.keys(counts).forEach(function (k) {
      if (k === REV) return;
      var cap = Math.floor(counts[k] / rows);
      if (cap > 0) { capacity[k] = cap; colors.push(k); }
    });

    var pairs = [];
    for (var c = 0; c < L.cols; c++) {
      var have = {};
      g[c].forEach(function (x) { if (x.c !== REV) have[x.c] = (have[x.c] || 0) + 1; });
      colors.forEach(function (k) { pairs.push({ col: c, color: k, n: have[k] || 0 }); });
    }
    pairs.sort(function (a, b) { return b.n - a.n; });

    var target = new Array(L.cols).fill(null);
    pairs.forEach(function (p) {
      if (target[p.col] != null) return;
      if (!capacity[p.color]) return;
      target[p.col] = p.color;
      capacity[p.color]--;
    });
    for (var i = 0; i < L.cols; i++) {
      if (target[i] == null) {
        var left = colors.filter(function (k) { return capacity[k] > 0; });
        target[i] = left.length ? left[0] : colors[0];
        if (capacity[target[i]]) capacity[target[i]]--;
      }
    }
    return target;
  }

  function strayCount(L) {
    var g = readGrid(L), target = assignTargets(L), n = 0;
    for (var c = 0; c < L.cols; c++) {
      for (var r = 0; r < L.rows; r++) if (g[c][r].c !== target[c]) n++;
    }
    return n;
  }

  /* ---------- levers (each preserves colour counts) ---------- */

  function addStrays(L, k, seed) {
    var out = clone(L), g = readGrid(out), rnd = S.mulberry32(seed || 11);
    var done = 0, guard = 0;
    while (done < k && guard++ < k * 80 + 300) {
      var a = (rnd() * out.cols) | 0, b = (rnd() * out.cols) | 0;
      if (a === b) continue;
      var ra = (rnd() * out.rows) | 0, rb = (rnd() * out.rows) | 0;
      if (g[a][ra].c === g[b][rb].c) continue;
      var t = g[a][ra]; g[a][ra] = g[b][rb]; g[b][rb] = t;
      done++;
    }
    out.grid = writeGrid(g);
    return out;
  }

  function removeStrays(L, k) {
    var out = clone(L), g = readGrid(out), target = assignTargets(out);
    var fixed = 0, guard = 0;
    while (fixed < k && guard++ < k * 40 + 200) {
      var moved = false;
      for (var a = 0; a < out.cols && !moved; a++) {
        for (var ra = 0; ra < out.rows && !moved; ra++) {
          if (g[a][ra].c === target[a] || g[a][ra].c === REV) continue;
          var want = g[a][ra].c;
          for (var b = 0; b < out.cols && !moved; b++) {
            if (b === a || target[b] !== want) continue;
            /* prefer the swap that fixes both columns at once */
            var pick = -1;
            for (var rb = 0; rb < out.rows; rb++) {
              if (g[b][rb].c === target[b]) continue;
              if (g[b][rb].c === target[a]) { pick = rb; break; }
              if (pick < 0) pick = rb;
            }
            if (pick < 0) continue;
            var t = g[a][ra]; g[a][ra] = g[b][pick]; g[b][pick] = t;
            fixed++; moved = true;
          }
        }
      }
      if (!moved) break;
    }
    out.grid = writeGrid(g);
    return out;
  }

  /* Fewer colours means two columns end up sharing one, which is the only thing
   * that gives the player a genuine choice of where to drop the pad car. */
  function mergeColors(L) {
    var counts = countColors(L), colors = realColors(L);
    if (colors.length < 3) return null;
    colors.sort(function (a, b) { return counts[a] - counts[b]; });
    var keep = colors[1], drop = colors[0];
    var out = clone(L), g = readGrid(out);
    g.forEach(function (col) { col.forEach(function (x) { if (x.c === drop) x.c = keep; }); });
    out.grid = writeGrid(g);
    if (padColor(out) === drop) out.pad = (String(out.pad).charAt(0) === '?' ? '?' : '') + keep;
    return out;
  }

  function splitColors(L, palette) {
    var counts = countColors(L), rows = L.rows;
    var donor = realColors(L).filter(function (k) { return counts[k] >= 2 * rows; })
      .sort(function (a, b) { return counts[b] - counts[a]; })[0];
    if (!donor) return null;
    var used = countColors(L);
    var fresh = Object.keys(palette).filter(function (k) { return !used[k]; })[0];
    if (!fresh) return null;
    var out = clone(L), g = readGrid(out), left = rows;
    for (var c = 0; c < out.cols && left > 0; c++) {
      for (var r = 0; r < out.rows && left > 0; r++) {
        if (g[c][r].c === donor) { g[c][r].c = fresh; left--; }
      }
    }
    if (left > 0) return null;
    out.grid = writeGrid(g);
    return out;
  }

  function setHidden(L, n, seed) {
    var out = clone(L), g = readGrid(out), rnd = S.mulberry32(seed || 17);
    g.forEach(function (col) { col.forEach(function (x) { x.h = false; }); });
    var left = Math.max(0, Math.min(n, out.cols * out.rows - 1)), guard = 0;
    while (left > 0 && guard++ < 4000) {
      var c = (rnd() * out.cols) | 0, r = (rnd() * out.rows) | 0;
      if (g[c][r].h) continue;
      g[c][r].h = true; left--;
    }
    out.grid = writeGrid(g);
    return out;
  }

  function setSlack(L, slack, opt) {
    var out = clone(L);
    out.moves = Math.max(1, Math.ceil(opt * slack));
    return out;
  }

  /* Resizing cannot preserve a hand-authored layout, so it regenerates one at
   * the same stray density and colour count. */
  function resize(L, dCols, dRows, palette) {
    var cols = L.cols + dCols, rows = L.rows + dRows;
    if (cols < 2 || rows < 2 || cols > 9 || rows > 9) return null;
    var nColors = Math.min(cols, realColors(L).length);
    var density = strayCount(L) / (L.cols * L.rows);
    var names = realColors(L).slice(0, nColors);
    while (names.length < nColors) names.push(Object.keys(palette)[names.length]);
    var lv = G.generate({
      cols: cols, rows: rows, colors: names,
      strays: Math.max(1, Math.round(density * cols * rows)),
      hidden: Math.round(hiddenCount(L) / (L.cols * L.rows) * cols * rows),
      revInGrid: padColor(L) !== REV,
      seed: 31
    });
    var out = clone(L);
    out.cols = cols; out.rows = rows; out.grid = lv.grid; out.pad = lv.pad;
    return out;
  }

  /* ---------- suggestions ---------- */

  function buildCandidates(L, dir, palette, base) {
    var cells = L.cols * L.rows, out = [];
    var opt = base.practicalOpt || Math.ceil(cells / 2);
    var step = Math.max(2, Math.round(cells * 0.22));

    if (dir === 'harder') {
      out.push({ key: 'colors-', lever: { vi: 'Số màu', en: 'Colours' },
        label: { vi: 'Gộp 2 màu: ' + base.colors + ' → ' + (base.colors - 1) + ' màu',
                 en: 'Merge two colours: ' + base.colors + ' → ' + (base.colors - 1) },
        why: { vi: 'Tăng ĐỘ SÂU chứ thường không tăng độ khó: 2 cột cùng màu cho player nhiều chỗ nhả xe đúng hơn nên ít move phí. Dùng khi level bị chê nhạt chứ không phải khi cần siết.',
               en: 'Raises DEPTH, usually not difficulty: two columns of one colour give the player more correct places to drop, so fewer moves are wasted. Use it when a level feels bland, not when it needs tightening.' },
        level: mergeColors(L) });
      out.push({ key: 'strays+', lever: { vi: 'Xe lạ', en: 'Strays' },
        label: { vi: 'Thêm ' + step + ' xe lạ (' + base.strays + ' → ~' + (base.strays + step) + ')',
                 en: 'Add ' + step + ' strays (' + base.strays + ' → ~' + (base.strays + step) + ')' },
        why: { vi: 'Cột có ≥2 xe lạ thì auto-sort không kích, player phải tự lo thứ tự.',
               en: 'With 2+ strays in a column auto-sort never fires, so the player works out the order.' },
        level: addStrays(L, step, 11) });
      out.push({ key: 'budget-', lever: { vi: 'Move budget', en: 'Move budget' },
        label: { vi: 'Siết budget ' + L.moves + ' → ' + Math.ceil(opt * 1.35) + ' (slack 1.35x)',
                 en: 'Tighten budget ' + L.moves + ' → ' + Math.ceil(opt * 1.35) + ' (slack 1.35x)' },
        why: { vi: 'Biến move count thành sức ép thật thay vì con số trang trí.',
               en: 'Turns the move count into real pressure instead of decoration.' },
        level: setSlack(L, 1.35, opt) });
      out.push({ key: 'hidden+', lever: { vi: 'Xe ẩn', en: 'Hidden cars' },
        label: { vi: 'Xe ẩn ' + base.hidden + ' → ' + (base.hidden + Math.max(2, Math.round(cells * 0.12))),
                 en: 'Hidden cars ' + base.hidden + ' → ' + (base.hidden + Math.max(2, Math.round(cells * 0.12))) },
        why: { vi: 'Chặn lập kế hoạch. Ẩn lộ ngay khi cột bị tap nên tác dụng ngắn, đừng lạm dụng.',
               en: 'Blocks planning. Hidden cars reveal as soon as their column is tapped, so the effect is brief — do not overuse it.' },
        level: setHidden(L, base.hidden + Math.max(2, Math.round(cells * 0.12)), 17) });
      out.push({ key: 'rows+', lever: { vi: 'Kích thước', en: 'Board size' },
        label: { vi: 'Thêm 1 hàng: ' + L.cols + '×' + L.rows + ' → ' + L.cols + '×' + (L.rows + 1),
                 en: 'Add a row: ' + L.cols + '×' + L.rows + ' → ' + L.cols + '×' + (L.rows + 1) },
        why: { vi: 'Cột dài hơn ⇒ xe lạ nằm sâu hơn ⇒ tốn nhiều move để moi ra. Sinh lại layout.',
               en: 'Longer columns bury strays deeper, so digging them out costs more moves. Regenerates the layout.' },
        level: resize(L, 0, 1, palette) });
    } else {
      out.push({ key: 'colors+', lever: { vi: 'Số màu', en: 'Colours' },
        label: { vi: 'Tách thêm 1 màu: ' + base.colors + ' → ' + (base.colors + 1) + ' màu',
                 en: 'Split off a colour: ' + base.colors + ' → ' + (base.colors + 1) },
        why: { vi: 'Giảm ĐỘ SÂU: mỗi màu 1 cột riêng ⇒ xe văng ra chỉ hợp đúng 1 cột ⇒ chuỗi tự dẫn đường. Cảnh báo: có thể làm tỉ lệ thua TĂNG vì ít chỗ nhả xe đúng hơn.',
               en: 'Lowers DEPTH: one column per colour means the ejected car fits exactly one place and the chain leads itself. Warning — it can RAISE the loss rate, since there are fewer correct places to drop.' },
        level: splitColors(L, palette) });
      out.push({ key: 'strays-', lever: { vi: 'Xe lạ', en: 'Strays' },
        label: { vi: 'Bớt ' + step + ' xe lạ (' + base.strays + ' → ~' + Math.max(1, base.strays - step) + ')',
                 en: 'Remove ' + step + ' strays (' + base.strays + ' → ~' + Math.max(1, base.strays - step) + ')' },
        why: { vi: 'Cột chỉ còn 1 xe lạ thì auto-sort lo hết, tap 1 phát là xong cột.',
               en: 'With one stray left, auto-sort handles it and a single tap finishes the column.' },
        level: removeStrays(L, step) });
      out.push({ key: 'budget+', lever: { vi: 'Move budget', en: 'Move budget' },
        label: { vi: 'Nới budget ' + L.moves + ' → ' + Math.ceil(opt * 2.2) + ' (slack 2.2x)',
                 en: 'Loosen budget ' + L.moves + ' → ' + Math.ceil(opt * 2.2) + ' (slack 2.2x)' },
        why: { vi: 'Cho phép sai vài nước mà không thua.',
               en: 'Allows a few wrong moves without losing.' },
        level: setSlack(L, 2.2, opt) });
      if (base.hidden > 0) {
        out.push({ key: 'hidden-', lever: { vi: 'Xe ẩn', en: 'Hidden cars' },
          label: { vi: 'Xe ẩn ' + base.hidden + ' → ' + Math.max(0, base.hidden - Math.max(2, Math.round(cells * 0.12))),
                   en: 'Hidden cars ' + base.hidden + ' → ' + Math.max(0, base.hidden - Math.max(2, Math.round(cells * 0.12))) },
          why: { vi: 'Trả lại thông tin để player lập kế hoạch được.',
                 en: 'Gives information back so the player can plan.' },
          level: setHidden(L, Math.max(0, base.hidden - Math.max(2, Math.round(cells * 0.12))), 17) });
      }
      out.push({ key: 'rows-', lever: { vi: 'Kích thước', en: 'Board size' },
        label: { vi: 'Bớt 1 hàng: ' + L.cols + '×' + L.rows + ' → ' + L.cols + '×' + (L.rows - 1),
                 en: 'Remove a row: ' + L.cols + '×' + L.rows + ' → ' + L.cols + '×' + (L.rows - 1) },
        why: { vi: 'Cột ngắn hơn ⇒ moi xe lạ ra rẻ hơn. Sinh lại layout.',
               en: 'Shorter columns make digging out a stray cheaper. Regenerates the layout.' },
        level: resize(L, 0, -1, palette) });
    }
    return out.filter(function (x) {
      if (!x.level || !E.validate(x.level).ok) return false;
      if (x.key.indexOf('budget') === 0 && x.level.moves === L.moves) return false;
      return JSON.stringify(x.level) !== JSON.stringify(L);
    });
  }

  /* Chunked: each candidate is a real playtest, not an estimate. */
  function suggest(L, dir, palette, opts, onProgress, onDone) {
    opts = opts || {};
    var runs = opts.runs || 900;
    var base = measure(L, runs);
    if (!base.valid) { onDone({ base: base, items: [] }); return; }
    var cands = buildCandidates(L, dir, palette, base);
    var i = 0, results = [];

    function step() {
      if (i >= cands.length) {
        results.sort(function (a, b) {
          return dir === 'harder' ? b.delta - a.delta : a.delta - b.delta;
        });
        onDone({ base: base, dir: dir, items: results });
        return;
      }
      var c = cands[i++];
      var m = measure(c.level, runs);
      results.push(Object.assign({}, c, {
        measure: m,
        delta: (m.D || 0) - base.D,
        deltaDepth: (m.depth || 0) - (base.depth || 0)
      }));
      if (onProgress) onProgress(i, cands.length);
      setTimeout(step, 0);
    }
    setTimeout(step, 0);
  }

  global.Tuner = {
    measure: measure,
    suggest: suggest,
    assignTargets: assignTargets,
    strayCount: strayCount,
    levers: {
      addStrays: addStrays, removeStrays: removeStrays,
      mergeColors: mergeColors, splitColors: splitColors,
      setHidden: setHidden, setSlack: setSlack, resize: resize
    }
  };
})(typeof self !== 'undefined' ? self : this);
