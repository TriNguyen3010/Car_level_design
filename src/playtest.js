/* Mass playtest.
 *
 * Every run is played with an UNLIMITED move budget and we record how many moves
 * the player actually needed. That single pass gives the whole budget curve for
 * free: the win rate at any budget B is just the share of runs that finished in
 * B moves or fewer. So instead of asking "does 50 moves work?" the tool answers
 * "what budget buys the win rate you want?".
 *
 * Three player profiles run side by side, because a level that is fine for a
 * careful player and impossible for a careless one is a different problem from
 * a level that is simply long.
 */
(function (global) {
  'use strict';

  var E = global.Engine, S = global.Solver;

  var PROFILES = [
    { key: 'careful', name: 'giỏi',       eps: 0.02, noise: 3 },
    { key: 'average', name: 'trung bình', eps: 0.10, noise: 6 },
    { key: 'sloppy',  name: 'ẩu',         eps: 0.25, noise: 10 }
  ];

  /* Measured over 134 sloppy games across four levels, IDA* found a solution
   * from every single lost position and declared none unsolvable. The game has
   * no dead ends: the only way to fail is to run out of budget. So a run that
   * reaches this cap is the greedy policy cycling, NOT a board that cannot be
   * won — the reports must not confuse the two. */
  var HARD_CAP = 600;

  function runOne(level, profile, rnd, blind) {
    var s = E.createState(level);
    s.movesLeft = 1e9;
    if (s.status === 'lost') s.status = 'playing';
    var dumps = 0, goodSum = 0, decisions = 0, firstMove = -1, guard = 0;

    while (s.status === 'playing' && guard++ < HARD_CAP) {
      var ms = E.legalMoves(s);
      if (!ms.length) break;
      var good = S.goodColumns(s, blind).length;
      if (good === 0) dumps++;
      goodSum += good;
      decisions++;

      var pick;
      if (rnd() < profile.eps) {
        pick = ms[(rnd() * ms.length) | 0];
      } else {
        pick = ms[0];
        var best = -Infinity;
        for (var j = 0; j < ms.length; j++) {
          var v = S.greedyScore(s, ms[j], blind) + (rnd() - 0.5) * profile.noise;
          if (v > best) { best = v; pick = ms[j]; }
        }
      }
      if (firstMove < 0) firstMove = pick;
      E.applyMove(s, pick);
    }

    var won = s.status === 'won';
    return {
      won: won,
      moves: won ? s.movesUsed : null,
      dumps: dumps,
      avgGood: decisions ? goodSum / decisions : 0,
      firstMove: firstMove,
      columnsDone: s.locked.filter(Boolean).length
    };
  }

  function emptyAcc(cols) {
    return {
      runs: 0, wins: 0, neverWin: 0,
      moveCounts: {},           // movesUsed -> n
      dumpSum: 0, goodSum: 0,
      firstMove: new Array(cols).fill(0),
      stuckColumns: 0
    };
  }

  function accumulate(acc, r) {
    acc.runs++;
    acc.dumpSum += r.dumps;
    acc.goodSum += r.avgGood;
    if (r.firstMove >= 0) acc.firstMove[r.firstMove]++;
    if (r.won) {
      acc.wins++;
      acc.moveCounts[r.moves] = (acc.moveCounts[r.moves] || 0) + 1;
    } else {
      acc.neverWin++;
      acc.stuckColumns += r.columnsDone;
    }
  }

  /* Win rate as a function of the move budget, straight from the histogram. */
  function budgetCurve(acc, maxBudget) {
    var keys = Object.keys(acc.moveCounts).map(Number).sort(function (a, b) { return a - b; });
    var curve = [], cum = 0, k = 0;
    for (var b = 1; b <= maxBudget; b++) {
      while (k < keys.length && keys[k] <= b) { cum += acc.moveCounts[keys[k]]; k++; }
      curve.push({ budget: b, winRate: cum / acc.runs });
    }
    return curve;
  }

  function budgetFor(acc, targetWin, maxBudget) {
    var curve = budgetCurve(acc, maxBudget);
    for (var i = 0; i < curve.length; i++) if (curve[i].winRate >= targetWin) return curve[i].budget;
    return null;                                    // unreachable at any budget
  }

  function percentiles(acc, ps) {
    var keys = Object.keys(acc.moveCounts).map(Number).sort(function (a, b) { return a - b; });
    var out = {}, total = acc.wins, cum = 0, i = 0;
    ps.forEach(function (p) {
      var want = total * p;
      while (i < keys.length && cum < want) { cum += acc.moveCounts[keys[i]]; i++; }
      out[p] = keys.length ? keys[Math.max(0, i - 1)] : null;
    });
    return out;
  }

  function summarise(level, acc) {
    var maxKey = Object.keys(acc.moveCounts).map(Number).reduce(function (a, b) { return Math.max(a, b); }, 0);
    var maxBudget = Math.max(level.moves * 2, maxKey + 4, 20);
    var pc = percentiles(acc, [0.1, 0.25, 0.5, 0.75, 0.9, 0.95]);
    var curve = budgetCurve(acc, maxBudget);
    var atBudget = curve[Math.min(curve.length - 1, level.moves - 1)];
    return {
      runs: acc.runs,
      winRateAtBudget: atBudget ? atBudget.winRate : 0,
      noConvergeRate: acc.neverWin / acc.runs,  // policy cycled, not an unwinnable board
      ceiling: acc.wins / acc.runs,             // win rate of this policy at any budget
      p: pc,
      avgDumps: acc.dumpSum / acc.runs,
      avgGoodColumns: acc.goodSum / acc.runs,
      firstMove: acc.firstMove.map(function (n) { return n / acc.runs; }),
      avgColumnsOnLoop: acc.neverWin ? acc.stuckColumns / acc.neverWin : null,
      curve: curve,
      maxBudget: maxBudget,
      budgetFor: {
        90: budgetFor(acc, 0.90, maxBudget),
        75: budgetFor(acc, 0.75, maxBudget),
        60: budgetFor(acc, 0.60, maxBudget),
        45: budgetFor(acc, 0.45, maxBudget)
      },
      histogram: acc.moveCounts
    };
  }

  /* Chunked so a 10k run never freezes the page. onProgress(done, total). */
  function run(level, totalRuns, opts, onProgress, onDone) {
    opts = opts || {};
    var blind = opts.blind !== false;
    var profiles = opts.profiles || PROFILES;
    var perProfile = Math.max(1, Math.floor(totalRuns / profiles.length));
    var accs = profiles.map(function () { return emptyAcc(level.cols); });
    var rnds = profiles.map(function (p, i) { return S.mulberry32((opts.seed || 4242) + i * 7919); });
    var pi = 0, done = 0, total = perProfile * profiles.length;
    var chunk = opts.chunk || 400;
    var t0 = Date.now();

    function step() {
      var n = 0;
      while (n < chunk && pi < profiles.length) {
        if (accs[pi].runs >= perProfile) { pi++; continue; }
        accumulate(accs[pi], runOne(level, profiles[pi], rnds[pi], blind));
        n++; done++;
      }
      if (onProgress) onProgress(done, total);
      if (pi < profiles.length) setTimeout(step, 0);
      else {
        onDone({
          level: { id: level.id, cols: level.cols, rows: level.rows, moves: level.moves },
          ms: Date.now() - t0,
          totalRuns: total,
          profiles: profiles.map(function (p, i) {
            return Object.assign({ key: p.key, name: p.name, eps: p.eps }, summarise(level, accs[i]));
          })
        });
      }
    }
    setTimeout(step, 0);
  }

  /* Blocking version for scripts and for the fast scoring the tuner needs. */
  function runSync(level, totalRuns, opts) {
    opts = opts || {};
    var blind = opts.blind !== false;
    var profiles = opts.profiles || PROFILES;
    var perProfile = Math.max(1, Math.floor(totalRuns / profiles.length));
    var out = [];
    profiles.forEach(function (p, i) {
      var acc = emptyAcc(level.cols), rnd = S.mulberry32((opts.seed || 4242) + i * 7919);
      for (var n = 0; n < perProfile; n++) accumulate(acc, runOne(level, p, rnd, blind));
      out.push(Object.assign({ key: p.key, name: p.name, eps: p.eps }, summarise(level, acc)));
    });
    return { totalRuns: perProfile * profiles.length, profiles: out };
  }

  global.Playtest = {
    PROFILES: PROFILES,
    run: run,
    runSync: runSync,
    runOne: runOne,
    budgetFor: budgetFor
  };
})(typeof self !== 'undefined' ? self : this);
