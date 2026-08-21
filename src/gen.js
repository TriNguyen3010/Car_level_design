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

  /* Which colour owns each column. Coloured columns get what they asked for,
   * then whatever the board already uses most, then unused palette entries. */
  function columnColors(level, paletteNames) {
    var cols = level.cols, want = [], seen = {};
    (level.coloredCols || []).forEach(function (x) {
      if (x && x.color && !seen[x.color]) { seen[x.color] = 1; want.push(x.color); }
    });
    var counts = {};
    for (var c = 0; c < cols; c++) {
      for (var r = 0; r < level.rows; r++) {
        var cell = (level.grid[c] || [])[r];
        if (cell == null) continue;
        var col = String(cell).replace(/^\?/, '');
        if (col === REV) continue;
        counts[col] = (counts[col] || 0) + 1;
      }
    }
    Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })
      .forEach(function (k) { if (!seen[k]) { seen[k] = 1; want.push(k); } });
    (paletteNames || []).forEach(function (k) { if (!seen[k]) { seen[k] = 1; want.push(k); } });
    while (want.length < cols) want.push(want[want.length - 1] || 'yellow');
    return want.slice(0, cols);
  }

  /* Make a board legal again without redrawing it.
   *
   * Resizing is the case that needs this: dropping a column throws cars away and
   * adding one invents them, and either way the colour counts stop being whole
   * columns, so the level reads "invalid" with no obvious cause. Here the exact
   * bag of cars a legal board needs is built first — rows cars per column colour
   * plus the one odd car — and then the existing grid is walked cell by cell,
   * keeping every colour the bag can still afford. So a legal board comes back
   * unchanged and an illegal one only loses the cells it could not pay for. */
  function legalize(level, paletteNames) {
    var cols = level.cols, rows = level.rows;
    var want = columnColors(level, paletteNames);
    var bag = {};
    want.forEach(function (k) { bag[k] = (bag[k] || 0) + rows; });
    bag[REV] = (bag[REV] || 0) + 1;                  /* the car that ends on the pad */

    var grid = [], holes = [];
    for (var c = 0; c < cols; c++) {
      grid[c] = [];
      for (var r = 0; r < rows; r++) {
        var cell = (level.grid[c] || [])[r];
        var spec = cell == null ? '' : String(cell);
        var hid = spec.charAt(0) === '?';
        var col = hid ? spec.slice(1) : spec;
        if (col && bag[col] > 0) { bag[col]--; grid[c][r] = (hid ? '?' : '') + col; }
        else { grid[c][r] = null; holes.push([c, r]); }
      }
    }

    /* REV last: a cell can hold it, but leaving it for the pad is the tidier
     * board and the one every hand-built level in this repo uses. */
    var pool = [];
    Object.keys(bag).forEach(function (k) {
      if (k === REV) return;
      for (var i = 0; i < bag[k]; i++) pool.push(k);
    });
    for (var h = 0; h < holes.length; h++) {
      var at = holes[h];
      grid[at[0]][at[1]] = pool.length ? pool.shift() : REV;
      if (!pool.length && bag[REV] > 0 && grid[at[0]][at[1]] === REV) bag[REV]--;
    }

    var pad = pool.length ? pool.shift() : (bag[REV] > 0 ? REV : 'yellow');
    level.grid = grid;
    level.pad = pad;
    return level;
  }

  function specParse(spec) {
    var v = String(spec == null ? '' : spec);
    var hid = v.charAt(0) === '?';
    return { hidden: hid, color: hid ? v.slice(1) : v };
  }

  function specMake(hidden, color) { return (hidden ? '?' : '') + color; }

  function readAt(level, at) {
    return specParse(at.pad ? level.pad : level.grid[at.c][at.r]);
  }

  function writeAt(level, at, spec) {
    if (at.pad) level.pad = spec; else level.grid[at.c][at.r] = spec;
  }

  function countColors(level) {
    var counts = {};
    for (var c = 0; c < level.cols; c++) {
      for (var r = 0; r < level.rows; r++) {
        var k = specParse(level.grid[c][r]).color;
        if (k) counts[k] = (counts[k] || 0) + 1;
      }
    }
    var p = specParse(level.pad).color;
    if (p) counts[p] = (counts[p] || 0) + 1;
    return counts;
  }

  function samePlace(a, b) {
    if (a.pad || b.pad) return !!a.pad === !!b.pad;
    return a.c === b.c && a.r === b.r;
  }

  /* Every car of one colour, worst donor first: a car sitting in a column where
   * its colour is a stray costs nothing to give away, while the last car of a
   * nearly finished column costs a lot. */
  function donors(level, color, exclude) {
    var perCol = [];
    for (var c = 0; c < level.cols; c++) {
      var n = 0;
      for (var r = 0; r < level.rows; r++) if (specParse(level.grid[c][r]).color === color) n++;
      perCol[c] = n;
    }
    var out = [];
    for (var c2 = 0; c2 < level.cols; c2++) {
      for (var r2 = 0; r2 < level.rows; r2++) {
        if (specParse(level.grid[c2][r2]).color !== color) continue;
        var at = { c: c2, r: r2 };
        if (exclude && samePlace(at, exclude)) continue;
        out.push({ at: at, cost: perCol[c2] * 10 + (level.rows - r2) });
      }
    }
    if (specParse(level.pad).color === color && !(exclude && exclude.pad)) {
      out.push({ at: { pad: true }, cost: -1 });         /* the pad car is free */
    }
    out.sort(function (a, b) { return a.cost - b.cost; });
    return out.map(function (x) { return x.at; });
  }

  /* How many cars of a colour the level cannot afford to lose: a coloured column
   * demands a whole column of the colour it asks for. */
  function reserved(level) {
    var floor = {}, rows = level.rows;
    (level.coloredCols || []).forEach(function (x) {
      if (x && x.color) floor[x.color] = (floor[x.color] || 0) + rows;
    });
    return floor;
  }

  /* Paint by SWAPPING two cars rather than overwriting one.
   *
   * Overwriting a cell changes the colour counts, and this game needs every
   * colour to fill whole columns, so one brush stroke used to make a level
   * invalid with nothing on screen saying which other cell to fix. A swap moves
   * a car instead of inventing one, so validity is preserved by construction —
   * the same reason generate() only ever swaps.
   *
   * Painting a colour the board does not hold yet cannot be a swap, so one
   * column's worth of some other colour is handed over first and the swap runs
   * after. Returns what it did so the editor can say so.
   */
  function paintSwap(level, at, color, palette) {
    var rows = level.rows;
    var cur = readAt(level, at);
    if (cur.color === color) return { mode: 'noop', retinted: 0 };

    var retinted = 0, from = null;
    var counts = countColors(level);
    if (color !== REV && !counts[color]) {
      /* Prefer to take the cars off the colour under the brush — that is the
       * one the designer is already replacing. */
      var floor = reserved(level);
      var spare = function (k) {
        return k !== REV && counts[k] - rows >= (floor[k] || 0);
      };
      var victim = (cur.color && spare(cur.color)) ? cur.color : null;
      if (!victim) {
        Object.keys(counts).forEach(function (k) {
          if (!spare(k)) return;
          if (!victim || counts[k] > counts[victim]) victim = k;
        });
      }
      if (!victim) return { mode: 'fail', retinted: 0, reason: 'reserved' };
      /* The pad car counts toward the colour like any other, so it has to be
       * available to retint too — leaving it out left the victim one car short
       * whenever the pad happened to be holding one of them. */
      var spots = donors(level, victim, null);
      /* the car under the brush goes first, so the stroke always lands */
      if (cur.color === victim) {
        spots = [at].concat(spots.filter(function (x) { return !samePlace(x, at); }));
      }
      for (var i = 0; i < spots.length && retinted < rows; i++) {
        var was = readAt(level, spots[i]);
        writeAt(level, spots[i], specMake(was.hidden, color));
        retinted++;
      }
      from = victim;
      if (retinted < rows) return { mode: 'fail', retinted: retinted, from: from };
      cur = readAt(level, at);
      if (cur.color === color) return { mode: 'retint', retinted: retinted, from: from };
    }

    var pick = donors(level, color, at)[0];
    if (!pick) return { mode: retinted ? 'retint' : 'fail', retinted: retinted, from: from };
    var other = readAt(level, pick);
    writeAt(level, at, specMake(cur.hidden, other.color));
    writeAt(level, pick, specMake(other.hidden, cur.color));
    return {
      mode: retinted ? 'retint' : 'swap',
      retinted: retinted, from: from,
      gave: cur.color, took: other.color,
      at: pick
    };
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
    biggestRun: biggestRun, capMatches: capMatches,
    columnColors: columnColors, legalize: legalize, paintSwap: paintSwap
  };
})(typeof self !== 'undefined' ? self : this);
