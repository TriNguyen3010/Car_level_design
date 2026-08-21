/* Car Sort — solver + difficulty metrics.
 *
 * Two things matter for tuning this game, and they are not the same thing:
 *   minMoves      the omniscient optimum. Sets the move budget (budget = minMoves * slack).
 *   choice mix    how often the player actually has a decision to make.
 *
 * The second one is the real difficulty dial. Because auto-sort completes a column
 * the instant the pad car matches it, a level where every column holds exactly one
 * stray car solves itself: each ejection dictates the next tap. That is a forced
 * chain, not a puzzle. Levels get hard when several columns share the pad's colour
 * (a real branch), when a column holds two or more strays (auto-sort stays silent),
 * or when no column matches the pad at all (a forced dump that adds mess).
 */
(function (global) {
  'use strict';

  var E = global.Engine;
  var REV = 'REV';

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* Most common real colour in a column. blind = ignore cars still hidden. */
  function dominant(col, R, blind) {
    var counts = {}, best = null, bc = 0;
    for (var r = 0; r < R; r++) {
      var x = col[r];
      if (x.color === REV) continue;
      if (blind && x.hidden) continue;
      var n = (counts[x.color] || 0) + 1;
      counts[x.color] = n;
      if (n > bc) { bc = n; best = x.color; }
    }
    return { color: best, count: bc, counts: counts };
  }

  /* Lower bound: every car that does not belong in its column must be ejected,
   * and one move ejects one car. Minimised over the column's possible target
   * colour, which keeps it admissible. */
  function columnMisplaced(s, c) {
    var col = s.grid[c], R = s.rows, seen = {};
    /* A coloured column has no choice of target, so the bound is exact rather
     * than minimised — still admissible, and much tighter. */
    if (s.want[c]) {
      var mis = 0;
      for (var w = 0; w < R; w++) if (col[w].color !== s.want[c]) mis++;
      return mis;
    }
    for (var r = 0; r < R; r++) if (col[r].color !== REV) seen[col[r].color] = 1;
    var keys = Object.keys(seen);
    if (!keys.length) return R;
    var best = R;
    for (var i = 0; i < keys.length; i++) {
      var mis = 0;
      for (var r2 = 0; r2 < R; r2++) if (col[r2].color !== keys[i]) mis++;
      if (mis < best) best = mis;
    }
    return best;
  }

  function heuristic(s) {
    var t = 0;
    for (var c = 0; c < s.cols; c++) if (!s.locked[c]) t += columnMisplaced(s, c);
    t = Math.max(0, t - 1);                 // one car is allowed to finish on the pad
    if (t === 0 && !E.isWon(s)) t = 1;
    return t;
  }

  function greedyScore(s, c, blind) {
    var col = s.grid[c], R = s.rows, pad = s.pad.color;
    var d = dominant(col, R, blind), score = 0;
    /* A coloured column only ever wants one colour: dropping anything else in
     * is pure mess, and dropping the right colour is the only progress. */
    if (s.want[c]) {
      var have = 0;
      for (var wr = 0; wr < R; wr++) {
        if (blind && col[wr].hidden) continue;
        if (col[wr].color === s.want[c]) have++;
      }
      var atBottom = col[R - 1].color === s.want[c];
      if (pad === s.want[c]) {
        return (have === R - 1 ? 1000 : 200 + have * 10) + (atBottom ? -20 : 30);
      }
      /* Wrong colour. Still ranked rather than flat-rejected: a flat penalty
       * makes every coloured column equally bad, the tie breaks on column index,
       * and the playout walks in circles instead of finishing. Undoing progress
       * costs more, and ejecting a wrong car from it is worth something. */
      return -120 - have * 20 + (atBottom ? -30 : 25);
    }
    if (pad !== REV) {
      var padCount = 0;
      for (var r = 0; r < R; r++) {
        if (blind && col[r].hidden) continue;
        if (col[r].color === pad) padCount++;
      }
      if (padCount === R - 1) score += 1000;              // completes this column now
      else if (d.color === pad) score += 200 + padCount * 10;
      else score -= 100 + d.count * 10;                   // spoils another colour's column
    } else {
      score -= 50;                                        // the wrong-way car always costs
      score += (R - d.count) * 5;                         // dump it in the messiest column
    }
    var bottom = col[R - 1];
    var bColor = (blind && bottom.hidden) ? null : bottom.color;
    if (bColor !== d.color) score += 30;                  // ejecting a stray is progress
    if (bColor === pad) score -= 20;
    return score;
  }

  /* Columns where the pad car belongs — i.e. taps that do not add new mess. */
  function goodColumns(s, blind) {
    var out = [], pad = s.pad.color;
    if (pad === REV) return out;
    for (var i = 0, ms = E.legalMoves(s); i < ms.length; i++) {
      var c = ms[i];
      if (s.want[c]) { if (s.want[c] === pad) out.push(c); continue; }
      var d = dominant(s.grid[c], s.rows, blind);
      if (d.color === pad) out.push(c);
    }
    return out;
  }

  function unbounded(state) {
    var s = E.cloneState(state);
    s.movesLeft = 1e9;
    s.status = E.isWon(s) ? 'won' : 'playing';
    return s;
  }

  /* IDA* on the exact optimum. Returns a move list when it finds one. */
  function solve(state, opts) {
    opts = opts || {};
    var nodeCap = opts.nodeCap || 300000;
    var maxDepth = opts.maxDepth || 120;
    var root = unbounded(state);
    var nodes = 0, capped = false, visited;

    function dfs(s, g, bound, path) {
      nodes++;
      if (nodes > nodeCap) { capped = true; return { found: false, next: Infinity }; }
      var f = g + heuristic(s);
      if (f > bound) return { found: false, next: f };
      if (E.isWon(s)) return { found: true, path: path.slice() };
      var key = E.stateKey(s), prev = visited.get(key);
      if (prev !== undefined && prev <= g) return { found: false, next: Infinity };
      visited.set(key, g);

      var ms = E.legalMoves(s);
      ms.sort(function (a, b) { return greedyScore(s, b, false) - greedyScore(s, a, false); });
      var next = Infinity;
      for (var i = 0; i < ms.length; i++) {
        var ns = E.cloneState(s);
        E.applyMove(ns, ms[i]);
        path.push(ms[i]);
        var r = dfs(ns, g + 1, bound, path);
        path.pop();
        if (r.found) return r;
        if (capped) return { found: false, next: Infinity };
        if (r.next < next) next = r.next;
      }
      return { found: false, next: next };
    }

    var bound = heuristic(root);
    while (bound <= maxDepth) {
      visited = new Map();
      var r = dfs(root, 0, bound, []);
      if (r.found) return { solved: true, moves: r.path, minMoves: r.path.length, nodes: nodes, exact: true };
      if (capped) return { solved: false, exact: false, lowerBound: bound, nodes: nodes, capped: true };
      if (r.next === Infinity) return { solved: false, exact: true, unsolvable: true, nodes: nodes };
      bound = r.next;
    }
    return { solved: false, exact: false, lowerBound: bound, nodes: nodes, capped: true };
  }

  /* Deterministic omniscient greedy — an upper bound when IDA* runs out of budget. */
  function greedySolve(state, blind) {
    var s = unbounded(state), path = [], guard = 0;
    while (s.status === 'playing' && guard++ < 4000) {
      var ms = E.legalMoves(s);
      if (!ms.length) break;
      var pick = ms[0], bs = -Infinity;
      for (var i = 0; i < ms.length; i++) {
        var v = greedyScore(s, ms[i], !!blind);
        if (v > bs) { bs = v; pick = ms[i]; }
      }
      E.applyMove(s, pick);
      path.push(pick);
    }
    return { won: E.isWon(s), moves: path };
  }

  /* A player who cannot see through the "?" cars, plays greedily, and slips
   * occasionally. Win rate inside the real move budget is the single most
   * honest difficulty number this tool produces. */
  function playouts(level, runs, eps, seed) {
    var rnd = mulberry32(seed || 12345), wins = 0, sum = 0, fails = 0, timeouts = 0;
    for (var i = 0; i < runs; i++) {
      var s = E.createState(level), guard = 0;
      while (s.status === 'playing' && guard++ < 4000) {
        var ms = E.legalMoves(s);
        if (!ms.length) break;
        var pick;
        if (rnd() < eps) pick = ms[(rnd() * ms.length) | 0];
        else {
          pick = ms[0];
          var bs = -Infinity;
          for (var j = 0; j < ms.length; j++) {
            var v = greedyScore(s, ms[j], true) + (rnd() - 0.5) * 6;
            if (v > bs) { bs = v; pick = ms[j]; }
          }
        }
        E.applyMove(s, pick);
      }
      if (s.status === 'won') { wins++; sum += s.movesUsed; }
      else if (s.status === 'lost') fails++;
      else timeouts++;
    }
    return {
      runs: runs,
      winRate: wins / runs,
      avgMoves: wins ? sum / wins : null,
      outOfMoves: fails / runs,
      stuck: timeouts / runs
    };
  }

  /* Walk a solution and classify each decision point. */
  function pathShape(level, moves) {
    var s = E.createState(level);
    s.movesLeft = 1e9;
    var forced = 0, choice = 0, dump = 0, branch = 0, n = 0;
    for (var i = 0; i < moves.length; i++) {
      var good = goodColumns(s, false).length;
      var legal = E.legalMoves(s).length;
      if (good === 0) dump++; else if (good === 1) forced++; else choice++;
      branch += legal;
      n++;
      if (!E.applyMove(s, moves[i])) break;
    }
    return {
      length: n,
      forcedRatio: n ? forced / n : 0,
      choiceRatio: n ? choice / n : 0,
      dumpRatio: n ? dump / n : 0,
      branchFactor: n ? branch / n : 0
    };
  }

  /* How much a wrong tap costs. Sampled, because it means re-solving. */
  function trapCost(level, moves, opts) {
    opts = opts || {};
    var samples = opts.samples || 6, cap = opts.nodeCap || 40000;
    var s = E.createState(level);
    s.movesLeft = 1e9;
    var step = Math.max(1, Math.floor(moves.length / samples));
    var extras = [], unrecoverable = 0, tested = 0;

    for (var i = 0; i < moves.length; i++) {
      if (i % step === 0 && tested < samples) {
        var ms = E.legalMoves(s);
        for (var j = 0; j < ms.length; j++) {
          if (ms[j] === moves[i]) continue;
          var alt = E.cloneState(s);
          alt.movesLeft = 1e9;
          E.applyMove(alt, ms[j]);
          var r = solve(alt, { nodeCap: cap });
          var remaining = moves.length - i;
          if (r.solved) extras.push((1 + r.minMoves) - remaining);
          else unrecoverable++;
          tested++;
          break;                                  // one wrong tap per sampled state
        }
      }
      if (!E.applyMove(s, moves[i])) break;
    }
    var avg = extras.length ? extras.reduce(function (a, b) { return a + b; }, 0) / extras.length : null;
    return { samples: tested, avgExtraMoves: avg, unknown: unrecoverable };
  }

  function analyze(level, opts) {
    opts = opts || {};
    var out = { id: level.id, cols: level.cols, rows: level.rows, budget: level.moves };
    var v = E.validate(level);
    out.valid = v.ok;
    out.errors = v.errors;
    out.hidden = v.hidden;
    out.colors = Object.keys(v.counts || {}).filter(function (k) { return k !== REV; }).length;
    if (!v.ok) return out;

    var t0 = Date.now();
    var sol = solve(E.createState(level), { nodeCap: opts.nodeCap || 300000 });
    out.solveMs = Date.now() - t0;
    out.nodes = sol.nodes;

    if (sol.solved) {
      out.minMoves = sol.minMoves;
      out.exact = true;
      out.solution = sol.moves;
    } else if (sol.unsolvable) {
      out.unsolvable = true;
      out.errors = out.errors.concat(['solver: không có lời giải']);
      return out;
    } else {
      var g = greedySolve(E.createState(level), false);
      out.exact = false;
      out.lowerBound = sol.lowerBound;
      out.minMoves = g.won ? g.moves.length : null;      // upper bound stand-in
      out.greedyMoves = g.won ? g.moves.length : null;
      out.solution = g.won ? g.moves : null;
    }

    if (out.solution) {
      out.slack = level.moves / out.solution.length;
      var shape = pathShape(level, out.solution);
      out.pathLength = shape.length;
      out.forcedRatio = shape.forcedRatio;
      out.choiceRatio = shape.choiceRatio;
      out.dumpRatio = shape.dumpRatio;
      out.branchFactor = shape.branchFactor;
      if (opts.trap !== false && out.exact) {
        out.trap = trapCost(level, out.solution, { samples: 6, nodeCap: 40000 });
      }
    }
    out.naive = playouts(level, opts.runs || 200, opts.eps != null ? opts.eps : 0.08, opts.seed || 12345);
    return out;
  }

  global.Solver = {
    analyze: analyze,
    solve: solve,
    greedySolve: greedySolve,
    playouts: playouts,
    pathShape: pathShape,
    trapCost: trapCost,
    goodColumns: goodColumns,
    greedyScore: greedyScore,
    dominant: dominant,
    heuristic: heuristic,
    mulberry32: mulberry32
  };
})(typeof self !== 'undefined' ? self : this);
