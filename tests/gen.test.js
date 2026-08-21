'use strict';
var H = require('./harness.js'), test = H.test, eq = H.eq, ok = H.ok;
var E = self.Engine, G = self.Gen;

function gen(extra) {
  var opts = {
    cols: 5, rows: 4, colors: ['yellow', 'blue', 'red', 'green', 'pink'],
    strays: 8, seed: 11, revInGrid: true
  };
  Object.keys(extra || {}).forEach(function (k) { opts[k] = extra[k]; });
  var lv = G.generate(opts);
  lv.moves = 60;
  return lv;
}

test('generated levels carry the column rules they were asked for', function () {
  var lv = gen({ lockedCols: [{ col: 4, need: 2 }], coloredCols: [{ col: 1, color: 'red' }] });
  eq(lv.lockedCols, [{ col: 4, need: 2 }]);
  eq(lv.coloredCols, [{ col: 1, color: 'red' }]);
  ok(E.validate(lv).ok, JSON.stringify(E.validate(lv).errors));
});

test('a coloured column asks for a colour the board can actually supply', function () {
  var lv = gen({ coloredCols: [{ col: 1, color: 'red' }] });
  var counts = E.validate(lv).counts;
  ok(counts.red >= lv.rows, 'red = ' + counts.red + ', rows = ' + lv.rows);
});

test('maxColorMatch caps how sorted a column starts', function () {
  var lv = gen({ maxColorMatch: 2, strays: 12 });
  var worst = Math.max.apply(null, lv.grid.map(G.biggestRun));
  ok(worst <= 2, 'biggest run was ' + worst);
});

test('no cap means the generator is free to leave a solved column', function () {
  var lv = gen({ strays: 0 });
  ok(Math.max.apply(null, lv.grid.map(G.biggestRun)) > 2, 'expected a mostly solved board');
});

/* ---- legalize ---- */

function box(cols, rows, fill) {
  var grid = [];
  for (var c = 0; c < cols; c++) {
    grid[c] = [];
    for (var r = 0; r < rows; r++) grid[c][r] = fill;
  }
  return { cols: cols, rows: rows, moves: 30, pad: 'REV', grid: grid };
}

var PAL = ['magenta', 'pink', 'purple', 'violet', 'lime', 'green', 'yellow', 'cyan'];

test('legalize leaves an already legal board alone', function () {
  var L = {
    cols: 3, rows: 3, moves: 20, pad: 'REV',
    grid: [['magenta', 'pink', 'magenta'], ['pink', 'magenta', 'pink'], ['purple', 'purple', 'purple']]
  };
  var before = JSON.stringify(L.grid);
  G.legalize(L, PAL);
  eq(JSON.stringify(L.grid), before);
  eq(L.pad, 'REV');
  ok(E.validate(L).ok, JSON.stringify(E.validate(L).errors));
});

test('legalize fixes the board a shrink-then-grow resize leaves behind', function () {
  /* exactly what the editor produced: every hole filled with the first palette
   * colour, so magenta ends up 5 on a 3-row board */
  var L = {
    cols: 3, rows: 3, moves: 10, pad: 'magenta',
    grid: [['magenta', 'purple', 'magenta'], ['purple', 'pink', 'pink'], ['purple', 'magenta', 'magenta']]
  };
  eq(E.validate(L).ok, false);
  G.legalize(L, PAL);
  var v = E.validate(L);
  ok(v.ok, JSON.stringify(v.errors));
  Object.keys(v.counts).forEach(function (k) {
    if (k === 'REV') return;
    ok(v.counts[k] % L.rows === 0, k + ' = ' + v.counts[k] + ', rows = ' + L.rows);
  });
});

test('legalize grows a board into legal shape', function () {
  var L = box(3, 3, 'magenta');
  L.cols = 5;                       // two columns of holes, the resize case
  L.grid.push([null, null, null], [null, null, null]);
  G.legalize(L, PAL);
  ok(E.validate(L).ok, JSON.stringify(E.validate(L).errors));
  eq(L.grid.length, 5);
});

test('legalize keeps a coloured column supplied', function () {
  var L = box(4, 4, 'magenta');
  L.coloredCols = [{ col: 2, color: 'cyan' }];
  G.legalize(L, PAL);
  var v = E.validate(L);
  ok(v.ok, JSON.stringify(v.errors));
  ok(v.counts.cyan >= L.rows, 'cyan = ' + v.counts.cyan);
});
