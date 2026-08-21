/* Game config I/O — the JSON the client actually ships.
 *
 * The client config is a GENERATOR BRIEF, not a board: NumQueue x
 * (NumPerRow + ExtraColumnsCount) slots, one kind per filled column, and a
 * [MinMove, MaxMove] band the generated board has to land in, retried up to
 * MaxAttempts times. So exporting is mostly translating this tool's vocabulary
 * (cols/rows/colours) into that brief, and importing means running the same
 * search here so the designer sees a real board.
 *
 *   config            tool
 *   NumQueue          rows
 *   NumPerRow         cols - ExtraColumnsCount
 *   ExtraColumnsCount level.extraColumns — free columns the client adds; this
 *                     tool does not simulate empty slots, so it is carried
 *                     through untouched and only shrinks NumPerRow
 *   KindList          one kind per colour on the board, in column order
 *   MinMove/MaxMove   solver optimum / move budget
 *   MaxColorMatch     biggest same-colour run a column starts with
 *   LockedColumns     lockedCols, 1-based        {Column, Counter}
 *   ColoredColumns-   coloredCols, 1-based
 *     Location
 *
 * Optional "hard config": Map / CarShape / DummyType / DummyShape write the
 * exact board out too, for levels the designer wants shipped as-is instead of
 * regenerated on the device.
 */
(function (global) {
  'use strict';

  var E = global.Engine, S = global.Solver, G = global.Gen;
  var REV = 'REV';

  /* Colour -> kind. Fixed table on purpose: the same colour has to be the same
   * car in every level, otherwise level 3's "a1" and level 9's "a1" are
   * different vehicles and the KindList stops being reviewable. Letter is the
   * body family, digit the colour inside it. */
  var KIND = {
    yellow: 'a1', magenta: 'a2', pink: 'a3', purple: 'a4', violet: 'a5', lime: 'a6', green: 'a7',
    mint: 'b1', teal: 'b2', cyan: 'b3', blue: 'b4', navy: 'b5', orange: 'b6', red: 'b7',
    brown: 'c1', beige: 'c2', gray: 'c3', white: 'c4'
  };
  var REV_KIND = 'rev';

  /* float32 0.15 promoted to double. The client writes this literal, and JS
   * prints the same value as ...448, so the exact digits are pinned here and
   * restored by stringify(). */
  var RATIO_LITERAL = '0.15000000596046449';
  var RATIO = 0.15000000596046449;

  function colorToKind(color) { return color === REV ? REV_KIND : (KIND[color] || null); }

  function kindToColor(kind) {
    if (kind === REV_KIND) return REV;
    var keys = Object.keys(KIND);
    for (var i = 0; i < keys.length; i++) if (KIND[keys[i]] === kind) return keys[i];
    return null;
  }

  function bare(spec) { return String(spec).replace(/^\?/, ''); }
  function isHidden(spec) { return String(spec).charAt(0) === '?'; }

  /* Colours in column order, first appearance wins — so KindList reads left to
   * right the way the board does. */
  function kindList(level) {
    var seen = {}, out = [];
    for (var c = 0; c < level.cols; c++) {
      for (var r = 0; r < level.rows; r++) {
        var color = bare(level.grid[c][r]);
        if (color === REV || seen[color]) continue;
        seen[color] = 1;
        var k = colorToKind(color);
        if (k) out.push(k);
      }
    }
    return out;
  }

  /* How sorted the board starts: the biggest same-colour run inside a column.
   * The client uses it as a generation ceiling, so it is measured, not chosen. */
  function maxColorMatch(level) {
    var best = 1;
    for (var c = 0; c < level.cols; c++) {
      var counts = {};
      for (var r = 0; r < level.rows; r++) {
        var color = bare(level.grid[c][r]);
        if (color === REV) continue;
        counts[color] = (counts[color] || 0) + 1;
        if (counts[color] > best) best = counts[color];
      }
    }
    return best;
  }

  function hiddenCount(level) {
    var n = 0;
    for (var c = 0; c < level.cols; c++) {
      for (var r = 0; r < level.rows; r++) if (isHidden(level.grid[c][r])) n++;
    }
    if (isHidden(level.pad)) n++;
    return n;
  }

  function solveMin(level, nodeCap) {
    var sol = S.solve(E.createState(level), { nodeCap: nodeCap || 200000 });
    if (sol.solved) return { minMove: sol.minMoves, exact: true };
    var g = S.greedySolve(E.createState(level), false);
    return g.won ? { minMove: g.moves.length, exact: false } : { minMove: null, exact: false };
  }

  /* Row-major, the way the client reads Map. */
  function rowMajor(level, pick) {
    var out = [];
    for (var r = 0; r < level.rows; r++) {
      for (var c = 0; c < level.cols; c++) out.push(pick(level.grid[c][r], c, r));
    }
    return out;
  }

  function shapeIndex(kind) {
    if (!kind || kind === REV_KIND) return 0;
    return 'abc'.indexOf(kind.charAt(0)) + 1;
  }

  /* opts: {minMove, nodeCap, seed, maxAttempts, lockedShuffleSteps, hardConfig, level: number} */
  function toConfig(level, opts) {
    opts = opts || {};
    var extra = Math.max(0, level.extraColumns | 0);
    var minMove = opts.minMove;
    if (minMove == null) minMove = solveMin(level, opts.nodeCap).minMove;

    var cfg = {
      ConfigVersion: 1,
      MapLevel: opts.level != null ? opts.level : (level.id != null ? level.id : 1),
      Seed: opts.seed || 0,
      NumQueue: level.rows,
      NumPerRow: level.cols - extra,
      ExtraColumnsCount: extra,
      ColorList: [],
      KindList: kindList(level),
      MinMove: minMove == null ? 0 : minMove,
      MaxMove: level.moves,
      MaxColorMatch: maxColorMatch(level),
      ColoredColumnsLocation: (level.coloredCols || []).map(function (x) { return x.col + 1; }),
      LockedColumns: (level.lockedCols || []).map(function (x) {
        return { Column: x.col + 1, Counter: x.need };
      }),
      NumHiddenCar: hiddenCount(level),
      LockedShuffleRatio: RATIO,
      LockedShuffleSteps: opts.lockedShuffleSteps || 0,
      MaxAttempts: opts.maxAttempts || 1000
    };

    if (opts.hardConfig) {
      cfg.Map = rowMajor(level, function (spec) { return colorToKind(bare(spec)) || REV_KIND; });
      cfg.CarShape = rowMajor(level, function (spec) { return shapeIndex(colorToKind(bare(spec))); });
      cfg.HiddenColorCar = rowMajor(level, function (spec) { return isHidden(spec) ? 1 : 0; });
      cfg.DummyType = colorToKind(bare(level.pad)) || REV_KIND;
      cfg.DummyShape = shapeIndex(colorToKind(bare(level.pad)));
    }
    return cfg;
  }

  /* JSON.stringify prints LockedShuffleRatio as ...448 — same double, different
   * digits from what the client writes. Pin the literal so a re-export of an
   * untouched level diffs clean. */
  function stringify(cfg) {
    return JSON.stringify(cfg, null, 4)
      .replace(/("LockedShuffleRatio":\s*)[0-9.eE+-]+/, '$1' + RATIO_LITERAL);
  }

  function fileName(cfg) { return 'level_' + cfg.MapLevel + '.json'; }

  /* ---- import ---- */

  function specsFromConfig(cfg, cols) {
    var locked = (cfg.LockedColumns || []).map(function (x) {
      return { col: (x.Column | 0) - 1, need: x.Counter | 0 };
    }).filter(function (x) { return x.col >= 0 && x.col < cols; });
    var colored = (cfg.ColoredColumnsLocation || []).map(function (n) {
      return { col: (n | 0) - 1 };
    }).filter(function (x) { return x.col >= 0 && x.col < cols; });
    return { locked: locked, colored: colored };
  }

  function levelFromMap(cfg) {
    var cols = (cfg.NumPerRow | 0) + (cfg.ExtraColumnsCount | 0), rows = cfg.NumQueue | 0;
    var grid = [];
    for (var c = 0; c < cols; c++) grid[c] = new Array(rows);
    for (var r = 0; r < rows; r++) {
      for (var c2 = 0; c2 < cols; c2++) {
        var v = cfg.Map[r * cols + c2];
        var color = typeof v === 'string' ? kindToColor(v) : null;
        var hid = cfg.HiddenColorCar && cfg.HiddenColorCar[r * cols + c2] ? '?' : '';
        grid[c2][r] = hid + (color || 'yellow');
      }
    }
    var padKind = cfg.DummyType;
    var pad = typeof padKind === 'string' ? (kindToColor(padKind) || REV) : REV;
    return { cols: cols, rows: rows, moves: cfg.MaxMove, pad: pad, grid: grid };
  }

  /* No Map in the file means the client rolls the board itself, so roll one
   * here the same way: keep generating until the optimum lands inside
   * [MinMove, MaxMove], giving up after MaxAttempts. */
  function levelFromParams(cfg, opts) {
    opts = opts || {};
    var cols = (cfg.NumPerRow | 0) + (cfg.ExtraColumnsCount | 0), rows = cfg.NumQueue | 0;
    var colors = (cfg.KindList || []).map(kindToColor).filter(Boolean);
    if (!colors.length) colors = ['yellow'];
    var specs = specsFromConfig(cfg, cols);
    var colored = specs.colored.map(function (x, i) {
      return { col: x.col, color: colors[i % colors.length] };
    });
    var attempts = Math.min(cfg.MaxAttempts || 1000, opts.maxAttempts || 60);
    var best = null;
    /* Stray count is what moves the optimum, so it ramps across the attempts:
     * a low band is met early, a high one needs a badly shuffled board. */
    for (var i = 0; i < attempts; i++) {
      var mess = 0.22 + 0.68 * (attempts < 2 ? 1 : i / (attempts - 1));
      var lv = G.generate({
        cols: cols, rows: rows, colors: colors,
        strays: Math.max(1, Math.round(cols * rows * mess)),
        hidden: cfg.NumHiddenCar | 0,
        revInGrid: false,
        seed: (cfg.Seed || 0) * 1000 + i + 1,
        maxColorMatch: cfg.MaxColorMatch || 0,
        lockedCols: specs.locked,
        coloredCols: colored
      });
      lv.moves = cfg.MaxMove;
      lv.id = cfg.MapLevel;
      lv.extraColumns = cfg.ExtraColumnsCount | 0;
      if (!E.validate(lv).ok) continue;
      var m = solveMin(lv, opts.nodeCap || 120000);
      if (m.minMove == null) continue;
      if (!best || Math.abs(m.minMove - cfg.MinMove) < Math.abs(best.minMove - cfg.MinMove)) {
        best = { level: lv, minMove: m.minMove, exact: m.exact, tries: i + 1 };
      }
      if (m.minMove >= cfg.MinMove && m.minMove <= cfg.MaxMove) {
        return { level: lv, minMove: m.minMove, exact: m.exact, tries: i + 1, inBand: true };
      }
    }
    if (!best) return null;
    best.inBand = false;
    return best;
  }

  function fromConfig(cfg, opts) {
    if (cfg.Map && cfg.Map.length) {
      var lv = levelFromMap(cfg);
      lv.id = cfg.MapLevel;
      lv.extraColumns = cfg.ExtraColumnsCount | 0;
      var specs = specsFromConfig(cfg, lv.cols);
      if (specs.locked.length) lv.lockedCols = specs.locked;
      if (specs.colored.length) {
        lv.coloredCols = specs.colored.map(function (x) {
          return { col: x.col, color: bare(lv.grid[x.col][0]) };
        });
      }
      return { level: lv, minMove: cfg.MinMove, inBand: true, tries: 0 };
    }
    return levelFromParams(cfg, opts);
  }

  global.GameConfig = {
    KIND: KIND,
    REV_KIND: REV_KIND,
    colorToKind: colorToKind,
    kindToColor: kindToColor,
    kindList: kindList,
    maxColorMatch: maxColorMatch,
    hiddenCount: hiddenCount,
    toConfig: toConfig,
    fromConfig: fromConfig,
    stringify: stringify,
    fileName: fileName
  };
})(typeof self !== 'undefined' ? self : this);
