/* Level generator.
 *
 * Built so a generated level is valid by construction: start from a solved board,
 * then only ever SWAP two cars. A swap never changes colour counts, so the
 * "every colour is a multiple of rows, exactly one car left on the pad"
 * invariant survives every shuffle. Stray count is the difficulty dial.
 */
(function (global) {
  'use strict';

  var E = global.Engine, S = global.Solver;
  var REV = 'REV';

  function distributeColumns(cols, colors) {
    var out = [];
    for (var c = 0; c < cols; c++) out.push(colors[c % colors.length]);
    return out;
  }

  /* Biggest same-colour run inside a column — the client's MaxColorMatch. */
  function biggestRun(col) {
    var counts = {}, best = 0;
    for (var r = 0; r < col.length; r++) {
      if (col[r] === REV) continue;
      var k = String(col[r]).replace(/^\?/, '');
      counts[k] = (counts[k] || 0) + 1;
      if (counts[k] > best) best = counts[k];
    }
    return best;
  }

  /* Pull every column down to `cap` cars of one colour, still swapping only, so
   * the colour totals survive. Best effort: a board can be too small for a low
   * cap, and a guard beats an infinite loop. */
  function capMatches(grid, cols, rows, cap, rnd) {
    if (!(cap > 0) || cap >= rows) return;
    var guard = 0;
    while (guard++ < cols * rows * 20) {
      var worst = -1, worstColor = null, worstN = cap;
      for (var c = 0; c < cols; c++) {
        var counts = {};
        for (var r = 0; r < rows; r++) {
          var k = String(grid[c][r]);
          if (k === REV) continue;
          counts[k] = (counts[k] || 0) + 1;
          if (counts[k] > worstN) { worstN = counts[k]; worst = c; worstColor = k; }
        }
      }
      if (worst < 0) return;
      var moved = false;
      for (var i = 0; i < cols * rows && !moved; i++) {
        var oc = (rnd() * cols) | 0, or_ = (rnd() * rows) | 0;
        if (oc === worst) continue;
        var other = String(grid[oc][or_]);
        if (other === worstColor || other === REV) continue;
        if (biggestRun(grid[oc]) >= cap && other !== worstColor) {
          /* taking a car out of a full column is fine, putting one in is not */
          var after = grid[oc].filter(function (x, ix) { return ix !== or_; }).concat([worstColor]);
          if (biggestRun(after) > cap) continue;
        }
        for (var r2 = 0; r2 < rows; r2++) {
          if (String(grid[worst][r2]) !== worstColor) continue;
          grid[worst][r2] = other;
          grid[oc][or_] = worstColor;
          moved = true;
          break;
        }
      }
      if (!moved) return;
    }
  }

  /* opts: {cols, rows, colors:[names], strays, hidden, revInGrid, seed,
   *        maxColorMatch, lockedCols:[{col,need}], coloredCols:[{col,color}]} */
  function generate(opts) {
    var cols = opts.cols, rows = opts.rows;
    var colors = opts.colors.slice(0, cols);          // at most one colour per column
    if (!colors.length) colors = ['yellow'];
    var rnd = S.mulberry32(opts.seed == null ? 1 : opts.seed);
    var assign = distributeColumns(cols, colors);

    /* A coloured column asks for one colour, so that colour has to be the one
     * that column is built from — trade it with whichever column owns it now. */
    (opts.coloredCols || []).forEach(function (x) {
      if (!x || !x.color || !(x.col >= 0 && x.col < cols)) return;
      var at = assign.indexOf(x.color);
      if (at === x.col) return;
      if (at >= 0) { var t = assign[x.col]; assign[x.col] = assign[at]; assign[at] = t; }
      else assign[x.col] = x.color;
    });

    var grid = [];
    for (var c = 0; c < cols; c++) {
      grid[c] = [];
      for (var r = 0; r < rows; r++) grid[c][r] = assign[c];
    }

    /* The wrong-way car is the extra car. Either it sits on the pad and the board
     * is otherwise solved, or it displaces a car into the pad slot. */
    var pad;
    if (opts.revInGrid) {
      var rc = (rnd() * cols) | 0, rr = (rnd() * rows) | 0;
      pad = grid[rc][rr];
      grid[rc][rr] = REV;
    } else {
      pad = REV;
    }

    var strays = Math.max(0, opts.strays || 0), guard = 0;
    var swapped = 0;
    while (swapped < strays && guard++ < strays * 60 + 200) {
      var a = (rnd() * cols) | 0, b = (rnd() * cols) | 0;
      if (a === b) continue;
      var ra = (rnd() * rows) | 0, rb = (rnd() * rows) | 0;
      if (grid[a][ra] === grid[b][rb]) continue;
      var t = grid[a][ra]; grid[a][ra] = grid[b][rb]; grid[b][rb] = t;
      swapped++;
    }

    capMatches(grid, cols, rows, opts.maxColorMatch || 0, rnd);

    var level = {
      cols: cols, rows: rows, moves: 999,
      pad: pad, grid: grid
    };
    if (opts.lockedCols && opts.lockedCols.length) {
      level.lockedCols = opts.lockedCols.map(function (x) { return { col: x.col, need: x.need }; });
    }
    if (opts.coloredCols && opts.coloredCols.length) {
      level.coloredCols = opts.coloredCols.map(function (x) {
        return { col: x.col, color: x.color || assign[x.col] };
      });
    }

    var hide = Math.max(0, opts.hidden || 0), tries = 0;
    while (hide > 0 && tries++ < 500) {
      var hc = (rnd() * cols) | 0, hr = (rnd() * rows) | 0;
      var cell = String(grid[hc][hr]);
      if (cell.charAt(0) === '?') continue;
      grid[hc][hr] = '?' + cell;
      hide--;
    }

    return level;
  }

  /* Set the move budget from the actual optimum instead of a round number. */
  function autoBudget(level, slack, nodeCap) {
    var sol = S.solve(E.createState(level), { nodeCap: nodeCap || 200000 });
    var base = sol.solved ? sol.minMoves : null;
    if (base == null) {
      var g = S.greedySolve(E.createState(level), false);
      base = g.won ? g.moves.length : null;
    }
    if (base == null) return null;
    return { minMoves: base, exact: !!sol.solved, budget: Math.max(1, Math.ceil(base * slack)) };
  }

  /* Try several seeds, keep the one closest to the requested difficulty shape. */
  function search(opts) {
    var tries = opts.tries || 12;
    var target = opts.target || {};
    var best = null;
    for (var i = 0; i < tries; i++) {
      var lv = generate(Object.assign({}, opts, { seed: (opts.seed || 1) * 1000 + i }));
      var ab = autoBudget(lv, opts.slack || 1.6, 120000);
      if (!ab) continue;
      lv.moves = ab.budget;
      var a = S.analyze(lv, { runs: 120, nodeCap: 120000, trap: false });
      if (!a.valid || !a.minMoves) continue;
      var cost = 0;
      if (target.minMoves != null) cost += Math.abs(a.minMoves - target.minMoves) / Math.max(1, target.minMoves);
      if (target.choiceRatio != null) cost += Math.abs((a.choiceRatio || 0) - target.choiceRatio) * 2;
      if (target.naiveWinRate != null) cost += Math.abs(a.naive.winRate - target.naiveWinRate) * 2;
      if (!best || cost < best.cost) best = { cost: cost, level: lv, analysis: a };
    }
    return best;
  }

  global.Gen = {
    generate: generate, autoBudget: autoBudget, search: search,
    biggestRun: biggestRun, capMatches: capMatches
  };
})(typeof self !== 'undefined' ? self : this);
