/* Generate a 40-level campaign that teaches every mechanic in order, then write
 * both formats: the client config files and one bundle the tool can import.
 *
 *   node tools/make_40.js --out configLevel_gen40
 *   node tools/make_40.js --tries 12 --hard        # wider search, bake the board
 *
 * The ramp is the measured 10-step ladder from src/difficulty.js (stray
 * density, hidden ratio and slack per step), plus a schedule for the four
 * things a player has to be taught one at a time:
 *
 *   hidden cars      from level 9
 *   coloured columns from level 21
 *   locked columns   from level 31
 *
 * Every new mechanic lands on a step DROP, so the level that introduces it is
 * easier than the one before — the player meets one new rule, not a new rule
 * plus a harder board. Breathers sit at 9, 14, 17, 25, 29 and 35.
 */
'use strict';
global.self = global;
['engine', 'levels', 'solver', 'gen', 'playtest', 'tuner', 'difficulty', 'gameconfig']
  .forEach(function (m) { require(process.cwd() + '/src/' + m + '.js'); });

var fs = require('fs'), path = require('path');
var E = self.Engine, S = self.Solver, G = self.Gen, DF = self.Difficulty, GC = self.GameConfig;
var T = self.Tuner;
var PALETTE = Object.keys(self.LevelData.palette);

function arg(name, dflt) {
  var i = process.argv.indexOf('--' + name);
  if (i < 0) return dflt;
  var v = process.argv[i + 1];
  return v && v.charAt(0) !== '-' ? v : true;
}

var OUT = String(arg('out', 'configLevel_gen40'));
var TRIES = +arg('tries', 8);
var HARD = !!arg('hard', false);
/* The client's KindList is one unique kind per column, so a board that runs
 * fewer colours than columns cannot be written to that format at all. Default
 * to one colour per column and keep the ladder's routing axis behind a flag. */
var ROUTING = !!arg('routing', false);

/* rows, cols, step, hidden cars, coloured columns, locked column needs */
var PLAN = [
  [3, 3,  1, 0, 0, []],
  [3, 3,  1, 0, 0, []],
  [3, 4,  2, 0, 0, []],
  [3, 4,  2, 0, 0, []],
  [4, 4,  3, 0, 0, []],
  [4, 4,  3, 0, 0, []],
  [4, 5,  4, 0, 0, []],
  [4, 5,  4, 0, 0, []],
  [4, 5,  3, 2, 0, []],          /* 9  hidden cars arrive on a step drop */
  [4, 5,  4, 3, 0, []],
  [5, 5,  5, 0, 0, []],
  [5, 5,  5, 0, 0, []],
  [5, 5,  6, 0, 0, []],
  [5, 5,  4, 3, 0, []],          /* 14 breather */
  [5, 5,  6, 0, 0, []],
  [5, 5,  7, 0, 0, []],
  [4, 5,  5, 0, 0, []],          /* 17 breather */
  [4, 5,  6, 4, 0, []],
  [5, 5,  7, 5, 0, []],
  [4, 6,  6, 0, 0, []],
  [4, 5,  5, 0, 1, []],          /* 21 coloured columns arrive on a step drop */
  [5, 6,  6, 2, 2, []],
  [5, 6,  6, 3, 2, []],
  [5, 6,  7, 0, 3, []],
  [5, 6,  5, 0, 1, []],          /* 25 breather */
  [5, 6,  7, 2, 1, []],
  [4, 6,  7, 3, 2, []],
  [5, 6,  8, 2, 2, []],
  [5, 5,  6, 0, 1, []],          /* 29 breather */
  [5, 6,  8, 2, 2, []],
  [4, 6,  6, 0, 2, [1]],         /* 31 locked columns arrive on a step drop */
  [4, 6,  7, 3, 2, [1]],
  [5, 6,  8, 0, 3, []],
  [5, 6,  8, 0, 2, [2]],
  [5, 6,  7, 0, 2, [1, 2]],      /* 35 breather, but two locks */
  [5, 6,  9, 6, 3, [1]],
  [4, 6,  8, 7, 2, [2]],
  [5, 6,  9, 0, 2, [2, 3]],
  [5, 6,  9, 8, 2, [1]],
  [5, 6, 10, 4, 4, [2, 3]]       /* 40 finale */
];

/* Rules go on columns that are spread out and never share a column: a locked
 * column that also demands one colour reads as a single unfair wall. */
function pickColumns(cols, nColored, nLocked, seed) {
  var order = [], i;
  for (i = 0; i < cols; i++) order.push(i);
  /* deterministic shuffle, stable per level */
  var rnd = S.mulberry32(seed);
  for (i = order.length - 1; i > 0; i--) {
    var j = (rnd() * (i + 1)) | 0, t = order[i];
    order[i] = order[j]; order[j] = t;
  }
  return { colored: order.slice(0, nColored).sort(f), locked: order.slice(nColored, nColored + nLocked).sort(f) };
  function f(a, b) { return a - b; }
}

function build(lvIndex) {
  var row = PLAN[lvIndex];
  var rows = row[0], cols = row[1], step = row[2], hidden = row[3];
  var nColored = row[4], needs = row[5];
  var tplKey = 't' + step, tpl = DF.TEMPLATES[tplKey], b = tpl.build;
  var cells = cols * rows;
  var nColors = ROUTING ? Math.max(1, Math.min(cols, Math.round(cols * b.colorRatio))) : cols;

  /* Rotate the palette so 40 levels do not all wear the same four colours. */
  var names = [];
  for (var k = 0; k < nColors; k++) names.push(PALETTE[(lvIndex * 3 + k) % PALETTE.length]);

  nColored = Math.min(nColored, Math.max(0, nColors - 1));
  var nLocked = Math.min(needs.length, Math.max(0, cols - nColored - 1));
  var spots = pickColumns(cols, nColored, nLocked, lvIndex * 977 + 13);
  var coloredCols = spots.colored.map(function (c, i) { return { col: c, color: names[i % names.length] }; });
  var lockedCols = spots.locked.map(function (c, i) { return { col: c, need: Math.min(needs[i], cols - 1) }; });

  var target = tpl.medians.winAvg;
  /* Cars sealed inside a locked column can be exactly the cars the first two
   * completions need, which makes the board unsolvable in a way validate cannot
   * see without solving. So the search backs off: the planned locks, then the
   * same locks asking for one clear each, then no locks. */
  var phases = [lockedCols];
  if (lockedCols.length) {
    phases.push(lockedCols.map(function (x) { return { col: x.col, need: 1 }; }));
    phases.push([]);
  }
  /* A shallow board is the one failure this search keeps producing: a low stray
   * density on a small grid can leave a level that solves itself in three taps.
   * So every candidate has to clear a depth floor that ramps with the campaign,
   * measured in moves per cell, and the stray count ramps across the tries to
   * give the search something deeper to find. */
  var floor = Math.round(cells * (0.55 + 0.40 * lvIndex / (PLAN.length - 1)));
  var best = null, deepest = null, phase = 0;
  for (phase = 0; phase < phases.length && !best && !deepest; phase++) {
  lockedCols = phases[phase];
  for (var t = 0; t < TRIES; t++) {
    var mess = b.strayDensity + (0.85 - b.strayDensity) * (TRIES < 2 ? 0 : t / (TRIES - 1));
    var lv = G.generate({
      cols: cols, rows: rows, colors: names,
      strays: Math.max(1, Math.round(cells * mess)),
      hidden: Math.min(hidden, Math.floor(cells * 0.3)),
      revInGrid: true,
      seed: (lvIndex + 1) * 7919 + t,
      maxColorMatch: step >= 6 ? Math.max(2, rows - 2) : 0,
      lockedCols: lockedCols,
      coloredCols: coloredCols
    });
    lv.moves = 999;
    if (!E.validate(lv).ok) continue;
    var probe = S.analyze(lv, { runs: 100, nodeCap: 60000, trap: false });
    if (!probe.valid || !probe.minMoves) continue;
    lv.moves = Math.max(2, Math.ceil(probe.minMoves * b.slack));
    var a = S.analyze(lv, { runs: 160, nodeCap: 60000, trap: false });
    if (!a.minMoves) continue;
    if (!deepest || a.minMoves > deepest.a.minMoves) deepest = { level: lv, a: a };
    if (a.minMoves < floor) continue;
    var cost = Math.abs((a.naive.winRate || 0) - target);
    if (!best || cost < best.cost) best = { cost: cost, level: lv, a: a };
  }
  }
  if (!best) best = deepest;                     /* floor unreachable at this size */
  if (!best) return null;
  best.floor = floor;
  best.phase = phase - 1;

  var L = best.level;
  L.id = lvIndex + 1;
  L.tier = step;
  L.theme = lvIndex < 10 ? 'city' : 'suburb';
  /* The ladder's slack numbers were measured WITHOUT locked or coloured columns,
   * so a level carrying one of those rules needs its own budget: fit the budget
   * to the step's win-rate band instead of multiplying the optimum by a
   * constant. Bisection, because win rate is monotone in budget. */
  var fit = fitBudget(L, tplKey);
  var final = S.analyze(L, { runs: 300, nodeCap: 200000, trap: false });
  return { level: L, a: final, m: fit.m, miss: fit.miss, floor: best.floor,
           short: final.minMoves < best.floor, phase: best.phase };
}

function fitBudget(L, key) {
  var band = DF.TEMPLATES[key].target.winAvg;
  var m0 = T.measure(L, 400);
  var opt = m0.practicalOpt || Math.max(2, L.cols * L.rows);
  var lo = Math.max(2, Math.ceil(opt)), hi = Math.ceil(opt * 3.2), best = null;
  for (var i = 0; i < 7 && lo <= hi; i++) {
    var mid = (lo + hi) >> 1;
    var probe = JSON.parse(JSON.stringify(L));
    probe.moves = mid;
    var m = T.measure(probe, 500);
    var w = m.winAvg;
    var miss = w == null ? 1 : (w < band[0] ? band[0] - w : (w > band[1] ? w - band[1] : 0));
    if (!best || miss < best.miss) best = { moves: mid, m: m, miss: miss };
    if (miss === 0) break;
    if (w > band[1]) hi = mid - 1; else lo = mid + 1;
  }
  L.moves = best.moves;
  best.m = T.measure(L, 900);
  return best;
}

fs.mkdirSync(OUT, { recursive: true });
var made = [], bundle = [];
console.log('lv  size  step  min    budget slack  winAvg band        sloppy hid  rules');
for (var i = 0; i < PLAN.length; i++) {
  var got = build(i);
  if (!got) { console.log(String(i + 1).padStart(2) + '  FAILED to generate'); continue; }
  var L = got.level, a = got.a;
  var cfg = GC.toConfig(L, {
    level: L.id, minMove: a.minMoves, hardConfig: HARD,
    maxAttempts: 1000, lockedShuffleSteps: 0
  });
  fs.writeFileSync(path.join(OUT, GC.fileName(cfg)), GC.stringify(cfg) + '\n');
  made.push(cfg);
  bundle.push(L);
  var rules = (L.lockedCols || []).map(function (x) { return 'lock' + (x.col + 1) + ':' + x.need; })
    .concat((L.coloredCols || []).map(function (x) { return 'col' + (x.col + 1) + ':' + x.color; })).join(' ');
  var band = DF.TEMPLATES['t' + L.tier].target.winAvg;
  var pct = function (v) { return v == null ? '—' : Math.round(v * 100) + '%'; };
  console.log(
    String(L.id).padStart(2) + (got.short ? '! ' : '  ') + (L.cols + 'x' + L.rows).padEnd(5) +
    ' ' + String(L.tier).padStart(4) +
    '  ' + (String(a.minMoves) + (a.exact ? '' : '~')).padEnd(6) +
    ' ' + String(L.moves).padEnd(6) +
    ' ' + (got.m.slack ? got.m.slack.toFixed(2) + 'x' : '—').padEnd(6) +
    ' ' + pct(got.m.winAvg).padEnd(6) +
    ' ' + (pct(band[0]) + '-' + pct(band[1])).padEnd(11) +
    ' ' + pct(got.m.winSloppy).padEnd(6) +
    ' ' + String(a.hidden).padEnd(4) + ' ' + rules +
    (got.miss ? '   OFF-BAND' : '') +
    (got.phase ? '   LOCKS-RELAXED(' + got.phase + ')' : ''));
}

/* One bundle the tool's Level Set → Import can swallow whole. */
fs.writeFileSync(path.join(OUT, 'tool_set_40.json'), JSON.stringify({
  version: 2,
  note: 'generated by tools/make_40.js',
  palette: self.LevelData.palette,
  levels: bundle
}, null, 2) + '\n');

console.log('\n' + made.length + ' config file(s) + tool_set_40.json in ' + OUT);
