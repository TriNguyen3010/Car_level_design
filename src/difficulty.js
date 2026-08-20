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

  /* The 10-step ladder.
   *
   * Rows are [colorRatio, strayDensity, hiddenRatio, slack] plus the measured
   * medians the bands are built from. Every number came from generating three
   * boards at each of four sizes per step and playtesting them; nothing here is
   * a guess. Median win for the average player steps down
   *   100 · 99 · 97 · 93 · 88 · 83 · 79 · 72 · 58 · 52
   * so the numbers are a real ordering rather than four axes wearing a ladder.
   *
   * Two things the shape of that curve tells level design:
   *
   * Steps 1-4 barely move the average player (100 to 93) but halve the careless
   * one (94 to 40). Early difficulty is about punishing inattention, not skill.
   *
   * Budget carries the whole ladder. Dropping colours below the column count at
   * step 6 makes a level DEEPER but slightly EASIER — more columns accept the
   * pad car, so fewer moves are wasted — so slack has to keep tightening
   * through that transition or the ladder stalls. Measured directly: at slack
   * 1.48 step 6 came out easier than step 5.
   */
  var LADDER = [
    /* cr   sd    hid   slack  waMed wsMed wcMed  minC minR  group */
    [1.00, 0.12, 0.00, 3.20, 1.00, 0.94, 1.00, 3, 3, 0],
    [1.00, 0.20, 0.00, 2.10, 0.99, 0.70, 1.00, 3, 3, 0],
    [1.00, 0.26, 0.00, 1.72, 0.97, 0.59, 1.00, 4, 5, 1],
    [1.00, 0.30, 0.00, 1.56, 0.93, 0.40, 1.00, 4, 5, 1],
    [1.00, 0.36, 0.00, 1.44, 0.88, 0.39, 1.00, 4, 5, 1],
    [0.62, 0.38, 0.00, 1.34, 0.83, 0.39, 0.99, 5, 5, 2],
    [0.60, 0.42, 0.00, 1.26, 0.79, 0.38, 0.98, 5, 5, 2],
    [0.60, 0.46, 0.00, 1.20, 0.72, 0.31, 0.96, 5, 5, 2],
    [0.60, 0.44, 0.18, 1.15, 0.58, 0.25, 0.93, 5, 6, 3],
    [0.60, 0.48, 0.26, 1.10, 0.52, 0.22, 0.90, 5, 6, 3]
  ];

  var GROUPS = [
    { name: 'Tập lái', axis: 'dạy luật',
      focus: 'Mỗi màu đúng một cột nên xe văng ra tự chỉ đường cho nước sau, và mỗi cột chỉ một xe lạ nên auto-sort lo hết. Player chỉ cần hiểu "tap cột cùng màu".',
      why: 'Budget rộng gấp 2–3 lần lời giải để cả người bấm ẩu cũng không thua. Thua ở đây không dạy được gì — player chưa biết mình sai ở đâu.' },
    { name: 'Giờ cao điểm', axis: 'sức ép budget',
      focus: 'Giữ cấu trúc dễ đọc — mỗi màu một cột — rồi siết budget dần. Player thua vì <b>tiêu move phí</b>, không vì bí đường.',
      why: 'Game không có ngõ cụt nên budget là nguồn thua duy nhất. Đây là nơi booster Undo có lý do tồn tại: mỗi nước sai ăn thẳng vào budget. Đo được: bậc 3 đến 5 gần như không làm player giỏi thua, nhưng player ẩu tụt từ 59% xuống 39%.' },
    { name: 'Bãi chật', axis: 'độ sâu định tuyến',
      focus: 'Số màu <b>ít hơn</b> số cột nên có cột trùng màu và player phải chọn nhả xe vào đâu. Mật độ xe lạ cao để nhiều cột có ≥2 xe lạ — auto-sort im lặng.',
      why: 'Bật trục này làm level <b>sâu hơn nhưng hơi dễ hơn</b>: nhiều cột nhận được xe trên pad hơn nên bớt move phí. Đo trực tiếp — ở slack 1.48 bậc 6 ra dễ hơn bậc 5. Nên slack phải tiếp tục siết qua khúc chuyển này, không thì thang đứng lại.' },
    { name: 'Giờ đêm', axis: 'thiếu thông tin, cộng dồn',
      focus: 'Ẩn 18–26% bàn, cộng lên trên cả hai trục kia, budget siết gần sát lời giải.',
      why: 'Xe ẩn lộ ngay khi cột bị tap nên một mình nó yếu — chỉ chặn được lượt lập kế hoạch đầu của mỗi cột. Nó chỉ thành trục thật khi budget đã rất chặt: lúc đó nước tap để dò màu cũng là nước tiêu budget. Đừng quá 30% bàn, quá ngưỡng đó thành đoán chứ không phải chơi.' }
  ];

  var WHEN = [
    'Level 1–4, dạy luật.', 'Level 5–8.',
    'Level 9–16.', 'Level 17–24.', 'Level 25–34.',
    'Level 35–45.', 'Level 46–58.', 'Level 59–72.',
    'Level 73–88, nên gate bằng booster.', 'Level 89+ hoặc daily challenge.'
  ];

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  function buildLadder() {
    var out = {};
    LADDER.forEach(function (row, i) {
      var tier = i + 1;
      var cr = row[0], sd = row[1], hid = row[2], slack = row[3];
      var wa = row[4], ws = row[5], wc = row[6];
      var g = GROUPS[row[9]];
      out['t' + tier] = {
        tier: tier,
        group: g.name,
        name: 'Bậc ' + tier + ' · ' + g.name,
        axis: g.axis,
        focus: g.focus,
        why: g.why,
        when: WHEN[i],
        minCols: row[7], minRows: row[8],
        build: { colorRatio: cr, strayDensity: sd, hiddenRatio: hid, slack: slack },
        target: {
          winCareful: [clamp01(wc - 0.12), 1.0],
          winAvg: [clamp01(wa - 0.08), clamp01(wa + 0.06)],
          winSloppy: [clamp01(ws - 0.17), clamp01(ws + 0.19)],
          depth: tier <= 5 ? [0, 22] : [14, 100],
          dumpRatio: [0, 0.34],
          slack: [slack * 0.92, slack * 1.12],
          hiddenRatio: hid === 0 ? [0, 0] : [clamp01(hid - 0.07), clamp01(hid + 0.11)]
        }
      };
    });
    return out;
  }

  var TEMPLATES = buildLadder();

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
    TEMPLATES: TEMPLATES, LABELS: LABELS, LADDER: LADDER, GROUPS: GROUPS,
    rebuild: function () { load(buildLadder()); return TEMPLATES; },
    check: check, distance: distance, classify: classify,
    buildArgs: buildArgs, fit: fit, plan: plan, fitSyncOnce: fitSyncOnce, fitOneSync: fitOneSync,
    rebudget: rebudget, refineBudget: refineBudget,
    sizeWarning: sizeWarning, toJSON: toJSON, load: load
  };
})(typeof self !== 'undefined' ? self : this);
