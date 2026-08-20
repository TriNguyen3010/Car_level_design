/* Difficulty templates.
 *
 * A template is not a magic slider. It is a target written in the knobs the
 * tool already has — how many colours per column, how many stray cars, how
 * much of the board is hidden, how tight the budget is — plus the measured
 * bands a level must land in to count as that tier. So every template can be
 * read, argued with, and edited.
 *
 * Each tier deliberately leans on ONE axis. That is the whole point: four
 * levels that are all "hard" in the same way is one level repeated four times.
 * The axes, in the order the evidence says they matter:
 *
 *   budget    the only real source of failure — this game has no dead ends
 *   routing   colours < columns, so the player chooses where to drop
 *   density   columns holding 2+ strays, where auto-sort stays silent
 *   info      hidden cars, which block planning until a column is tapped
 */
(function (global) {
  'use strict';

  var E = global.Engine, S = global.Solver, G = global.Gen, T = global.Tuner;

  var TEMPLATES = {
    'tap-lai': {
      tier: 1,
      name: 'Độ 1 · Tập lái',
      axis: 'Không trục nào — dạy luật',
      focus:
        'Mỗi màu đúng một cột nên xe văng ra tự chỉ đường cho nước sau; mỗi cột ' +
        'chỉ một xe lạ nên auto-sort lo hết. Player chỉ cần hiểu "tap cột cùng màu".',
      why:
        'Budget rộng gấp 3 lần lời giải để cả người bấm ẩu cũng không thua. Thua ' +
        'ở tier này không dạy được gì — player chưa biết mình sai ở đâu.',
      when: 'Level 1–8. Đây chính là setup 10 level hiện tại.',
      minCols: 3, minRows: 3,
      build: { colorRatio: 1.0, strayDensity: 0.14, hiddenRatio: 0, slack: 3.0 },
      target: {
        winCareful: [0.97, 1.0], winAvg: [0.95, 1.0], winSloppy: [0.72, 1.0],
        depth: [0, 14], dumpRatio: [0, 0.22], slack: [2.6, 3.4], hiddenRatio: [0, 0]
      }
    },

    'gio-cao-diem': {
      tier: 2,
      name: 'Độ 2 · Giờ cao điểm',
      axis: 'Sức ép budget',
      focus:
        'Giữ nguyên cấu trúc dễ đọc của Tập lái — mỗi màu một cột, xe lạ thưa — ' +
        'rồi siết budget về 1.65 lần lời giải. Player thua vì <b>tiêu move phí</b>, ' +
        'không vì bí đường.',
      why:
        'Game này không có ngõ cụt nên budget là nguồn thua duy nhất. Đây là tier ' +
        'đầu tiên có tỉ lệ thua thật, và là chỗ đầu tiên booster Undo có lý do tồn ' +
        'tại: mỗi nước sai ăn thẳng vào budget. Đo được: player ẩu tụt xuống 26–58% ' +
        'trong khi player giỏi vẫn 99–100% — đúng nghĩa kỹ năng có thưởng.',
      when: 'Level 9–25.',
      minCols: 4, minRows: 5,
      build: { colorRatio: 1.0, strayDensity: 0.26, hiddenRatio: 0, slack: 1.65 },
      target: {
        winCareful: [0.90, 1.0], winAvg: [0.80, 0.95], winSloppy: [0.28, 0.72],
        depth: [0, 20], dumpRatio: [0, 0.26], slack: [1.50, 1.85], hiddenRatio: [0, 0]
      }
    },

    'bai-chat': {
      tier: 3,
      name: 'Độ 3 · Bãi chật',
      axis: 'Độ sâu định tuyến',
      focus:
        'Số màu <b>ít hơn</b> số cột nên có cột trùng màu và player phải chọn nhả ' +
        'xe vào đâu. Mật độ xe lạ cao để nhiều cột có ≥2 xe lạ — auto-sort im lặng, ' +
        'player tự tính thứ tự moi ra.',
      why:
        'Ít màu hơn số cột cho player <b>nhiều chỗ nhả xe đúng hơn</b>, nên nó tự ' +
        'động bớt move phí và triệt tiêu một phần sức ép budget. Ở slack 1.60 đo ' +
        'được win trung bình 83–98% — ngang hệt Độ 2, tức là sâu hơn mà không khó ' +
        'hơn. Nên slack ở đây phải siết về <b>1.42</b> mới bù lại được và giữ thang ' +
        '1→4 đúng thứ tự. Bài học: gộp màu và siết budget <b>trừ nhau</b>, không cộng.',
      when: 'Level 26–60. Level 6 hiện tại là mẫu gần nhất.',
      minCols: 5, minRows: 5,
      build: { colorRatio: 0.60, strayDensity: 0.34, hiddenRatio: 0, slack: 1.42 },
      target: {
        winCareful: [0.80, 1.0], winAvg: [0.62, 0.80], winSloppy: [0.18, 0.60],
        depth: [22, 100], dumpRatio: [0, 0.28], slack: [1.30, 1.55], hiddenRatio: [0, 0]
      }
    },

    'gio-dem': {
      tier: 4,
      name: 'Độ 4 · Giờ đêm',
      axis: 'Thiếu thông tin, cộng dồn cả ba trục',
      focus:
        'Ẩn ~24% bàn, số màu ít hơn số cột, mật độ xe lạ cao nhất, budget siết về ' +
        '1.45x. Tier khó nhất và là tier duy nhất player ẩu gần như không qua.',
      why:
        'Xe ẩn lộ ngay khi cột bị tap nên một mình nó chỉ chặn được lượt lập kế ' +
        'hoạch đầu của mỗi cột — đo được chỉ +9 điểm khó. Ở slack 1.45 tier này còn ' +
        'ra win trung bình 70–98%, tức <b>không khó hơn Độ 3</b>. Xe ẩn chỉ thành ' +
        'trục thật khi ghép với budget rất chặt: nước tap để dò màu cũng là nước ' +
        'tiêu budget. Nên slack phải về <b>1.28</b>. Đừng đẩy xe ẩn quá 30% bàn — ' +
        'quá ngưỡng đó thành đoán, không phải chơi.',
      when: 'Level 60+, hoặc daily challenge. Nên gate bằng booster.',
      minCols: 5, minRows: 6,
      build: { colorRatio: 0.60, strayDensity: 0.42, hiddenRatio: 0.24, slack: 1.28 },
      target: {
        winCareful: [0.55, 0.98], winAvg: [0.35, 0.62], winSloppy: [0, 0.35],
        depth: [16, 100], dumpRatio: [0, 0.32], slack: [1.16, 1.40], hiddenRatio: [0.18, 0.30]
      }
    }
  };

  var LABELS = {
    winCareful: 'win — giỏi', winAvg: 'win — trung bình', winSloppy: 'win — ẩu',
    depth: 'độ sâu', dumpRatio: 'dump', slack: 'slack', hiddenRatio: 'tỉ lệ xe ẩn'
  };
  var AS_PCT = { winCareful: 1, winAvg: 1, winSloppy: 1, dumpRatio: 1, hiddenRatio: 1 };

  function readMetric(key, level, m) {
    if (key === 'hiddenRatio') return m.hidden / (level.cols * level.rows);
    if (key === 'depth') return m.depth;
    return m[key];
  }

  function fmt(key, v) {
    if (v == null) return '—';
    if (AS_PCT[key]) return Math.round(v * 100) + '%';
    if (key === 'slack') return v.toFixed(2) + 'x';
    return String(Math.round(v));
  }

  /* Per-criterion pass/fail against a tier's bands. */
  function check(level, m, key) {
    var tpl = TEMPLATES[key];
    if (!tpl || !m || !m.valid) return null;
    var rows = [], pass = 0;
    Object.keys(tpl.target).forEach(function (k) {
      var band = tpl.target[k], v = readMetric(k, level, m);
      var ok = v != null && v >= band[0] - 1e-9 && v <= band[1] + 1e-9;
      if (ok) pass++;
      rows.push({
        key: k, label: LABELS[k] || k, ok: ok,
        value: fmt(k, v),
        band: fmt(k, band[0]) + ' – ' + fmt(k, band[1]),
        low: v != null && v < band[0]
      });
    });
    return { key: key, name: tpl.name, rows: rows, pass: pass, total: rows.length };
  }

  /* Distance from a tier, 0 = inside every band. Used for both fitting and
   * for telling the designer which tier a level currently resembles. */
  function distance(level, m, key) {
    var tpl = TEMPLATES[key];
    if (!tpl || !m || !m.valid) return Infinity;
    var d = 0;
    Object.keys(tpl.target).forEach(function (k) {
      var band = tpl.target[k], v = readMetric(k, level, m);
      if (v == null) { d += 1; return; }
      var span = Math.max(1e-6, band[1] - band[0]);
      if (v < band[0]) d += (band[0] - v) / span;
      else if (v > band[1]) d += (v - band[1]) / span;
    });
    return d;
  }

  function classify(level, m) {
    var best = null;
    Object.keys(TEMPLATES).forEach(function (k) {
      var d = distance(level, m, k);
      if (!best || d < best.distance) best = { key: k, name: TEMPLATES[k].name, distance: d };
    });
    return best;
  }

  /* Turn a tier's build spec into concrete generator arguments. */
  function buildArgs(level, key, palette, seed) {
    var tpl = TEMPLATES[key], b = tpl.build;
    var cols = level.cols, rows = level.rows, cells = cols * rows;
    var nColors = Math.max(1, Math.min(cols, Math.round(cols * b.colorRatio)));

    /* Prefer the colours the level already uses so a retint does not also
     * change the level's look. */
    var have = Object.keys(E.validate(level).counts || {})
      .filter(function (c) { return c !== E.REV; });
    var names = have.slice(0, nColors);
    Object.keys(palette).forEach(function (c) {
      if (names.length < nColors && names.indexOf(c) < 0) names.push(c);
    });

    return {
      cols: cols, rows: rows, colors: names,
      strays: Math.max(1, Math.round(cells * b.strayDensity)),
      hidden: Math.round(cells * b.hiddenRatio),
      revInGrid: String(level.pad).replace(/^\?/, '') !== E.REV,
      seed: seed
    };
  }

  /* The escalation plan: grow to the tier's minimum, widen the search, add a
   * row, then add a column. Shared by the main thread and the worker so both
   * escalate identically. */
  function plan(level, key) {
    var tpl = TEMPLATES[key];
    var c0 = Math.max(level.cols, tpl.minCols || 2);
    var r0 = Math.max(level.rows, tpl.minRows || 2);
    var steps = [
      { cols: c0, rows: r0, tries: 8, label: c0 + '×' + r0 },
      { cols: c0, rows: r0, tries: 16, label: c0 + '×' + r0 + ', tìm rộng hơn' }
    ];
    if (r0 < 9) steps.push({ cols: c0, rows: r0 + 1, tries: 12, label: c0 + '×' + (r0 + 1) + ', thêm 1 hàng' });
    if (c0 < 9 && r0 < 9) steps.push({ cols: c0 + 1, rows: r0 + 1, tries: 12, label: (c0 + 1) + '×' + (r0 + 1) });
    return steps;
  }

  function blankAt(level, cols, rows) {
    var out = JSON.parse(JSON.stringify(level));
    out.cols = cols; out.rows = rows; out.pad = E.REV;
    out.grid = [];
    for (var c = 0; c < cols; c++) {
      out.grid[c] = [];
      for (var r = 0; r < rows; r++) out.grid[c][r] = 'yellow';
    }
    return out;
  }

  /* Yield-free single-candidate fit. */
  function fitSyncOnce(level, key, palette, seed, runs) {
    var tpl = TEMPLATES[key];
    var args = buildArgs(level, key, palette, seed);
    var lv = G.generate(args);
    var cand = JSON.parse(JSON.stringify(level));
    cand.grid = lv.grid; cand.pad = lv.pad;
    if (!E.validate(cand).ok) return null;
    var probe = T.measure(cand, Math.max(240, Math.round(runs / 2)));
    if (!probe.valid || !probe.practicalOpt) return null;
    cand.moves = Math.max(1, Math.ceil(probe.practicalOpt * tpl.build.slack));
    var r = refineBudget(cand, key, runs);
    var m = r.measure;
    return { level: r.level, measure: m, distance: distance(r.level, m, key), check: check(r.level, m, key), seed: seed };
  }

  /* Whole escalation, no yields. onStep(frac, text) is called synchronously. */
  function fitOneSync(level, key, palette, seedBase, runs, onStep) {
    var steps = plan(level, key), best = null, log = [];
    for (var si = 0; si < steps.length; si++) {
      var st = steps[si];
      var probe = blankAt(level, st.cols, st.rows);
      for (var i = 0; i < st.tries; i++) {
        var res = fitSyncOnce(probe, key, palette, seedBase + si * 131 + i * 31, runs);
        if (res && (!best || res.distance < best.distance)) best = res;
        if (onStep) {
          onStep((si + (i + 1) / st.tries) / steps.length,
                 'bước ' + (si + 1) + '/' + steps.length + ' · ' + st.label + ' · bàn thử ' + (i + 1) + '/' + st.tries);
        }
        if (best && best.check.pass === best.check.total) break;
      }
      log.push(st.label + ': ' + (best ? best.check.pass + '/' + best.check.total : 'không sinh được'));
      if (best && best.check.pass === best.check.total) break;
    }
    return { best: best, log: log, steps: steps.length };
  }

  /* Build several candidates and keep the one that lands closest to the tier.
   * One generated board is a coin flip; a small search is not.
   *
   * The budget is set from the careful player's 10th-percentile move count —
   * the same number check() divides by. Using Gen.autoBudget here instead would
   * divide by the solver's optimum, so a level built for slack 1.6 could measure
   * anywhere from 1.4 to 2.5 and the slack criterion would be meaningless. */
  function fit(level, key, palette, opts, onProgress, onDone) {
    opts = opts || {};
    var tries = opts.tries || 8, runs = opts.runs || 600;
    var tpl = TEMPLATES[key];
    var i = 0, best = null;

    function step() {
      if (i >= tries) { onDone(best); return; }
      var seed = (opts.seed || 1) * 977 + i * 31;
      var args = buildArgs(level, key, palette, seed);
      var lv = G.generate(args);
      var cand = JSON.parse(JSON.stringify(level));
      cand.grid = lv.grid; cand.pad = lv.pad;

      if (E.validate(cand).ok) {
        /* first pass only to learn the practical optimum */
        var probe = T.measure(cand, Math.max(240, Math.round(runs / 2)));
        if (probe.valid && probe.practicalOpt) {
          cand.moves = Math.max(1, Math.ceil(probe.practicalOpt * tpl.build.slack));
          var r = refineBudget(cand, key, runs);
          var lvl = r.level, m = r.measure;
          var d = distance(lvl, m, key);
          if (!best || d < best.distance) {
            best = { level: lvl, measure: m, distance: d, check: check(lvl, m, key), seed: seed };
          }
        }
      }
      i++;
      if (onProgress) onProgress(i, tries);
      setTimeout(step, 0);
    }
    setTimeout(step, 0);
  }

  /* Win rate rises monotonically with the budget, so the budget that lands
   * winAvg inside the tier's band can be bisected for. Staying inside the tier's
   * own slack band keeps the two criteria from fighting each other. */
  function refineBudget(cand, key, runs, measured) {
    var tpl = TEMPLATES[key], band = tpl.target.winAvg, sb = tpl.target.slack;
    var m = measured || T.measure(cand, runs);
    if (!m.valid || !m.practicalOpt) return { level: cand, measure: m };
    var opt = m.practicalOpt;
    var lo = Math.max(1, Math.ceil(opt * sb[0]));
    var hi = Math.max(lo, Math.floor(opt * sb[1]));
    var bestPick = { level: cand, measure: m, miss: bandMiss(m.winAvg, band) };

    for (var step = 0; step < 5 && lo <= hi; step++) {
      var mid = (lo + hi) >> 1;
      var probe = JSON.parse(JSON.stringify(cand));
      probe.moves = mid;
      var pm = T.measure(probe, runs);
      var miss = bandMiss(pm.winAvg, band);
      if (miss < bestPick.miss) bestPick = { level: probe, measure: pm, miss: miss };
      if (miss === 0) break;
      if (pm.winAvg > band[1]) hi = mid - 1;      // too easy, spend less
      else lo = mid + 1;                          // too hard, allow more
    }
    return bestPick;
  }

  function bandMiss(v, band) {
    if (v == null) return 1;
    if (v < band[0]) return band[0] - v;
    if (v > band[1]) return v - band[1];
    return 0;
  }

  function sizeWarning(level, key) {
    var tpl = TEMPLATES[key];
    if (!tpl) return null;
    var needC = tpl.minCols || 2, needR = tpl.minRows || 2;
    if (level.cols >= needC && level.rows >= needR) return null;
    return 'Bàn ' + level.cols + '×' + level.rows + ' nhỏ hơn mức tối thiểu ' +
           needC + '×' + needR + ' của tier này. Bàn ngắn thì lời giải ngắn, ' +
           'nên không đủ số nước để player kịp thua — siết knob nào cũng không tới dải mục tiêu.';
  }

  /* Re-budget an existing level to a tier's slack without touching its grid. */
  function rebudget(level, key, runs) {
    var tpl = TEMPLATES[key];
    if (!tpl) return null;
    var m = T.measure(level, runs || 600);
    if (!m.valid || !m.practicalOpt) return null;
    var out = JSON.parse(JSON.stringify(level));
    out.moves = Math.max(1, Math.ceil(m.practicalOpt * tpl.build.slack));
    return out;
  }

  function toJSON() { return JSON.parse(JSON.stringify(TEMPLATES)); }
  function load(obj) {
    if (!obj || typeof obj !== 'object') return false;
    Object.keys(TEMPLATES).forEach(function (k) { delete TEMPLATES[k]; });
    Object.keys(obj).forEach(function (k) { TEMPLATES[k] = obj[k]; });
    return true;
  }

  global.Difficulty = {
    TEMPLATES: TEMPLATES, LABELS: LABELS,
    check: check, distance: distance, classify: classify,
    buildArgs: buildArgs, fit: fit, plan: plan, fitSyncOnce: fitSyncOnce, fitOneSync: fitOneSync,
    rebudget: rebudget, refineBudget: refineBudget,
    sizeWarning: sizeWarning, toJSON: toJSON, load: load
  };
})(typeof self !== 'undefined' ? self : this);
