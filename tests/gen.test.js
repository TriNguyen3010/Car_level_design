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

/* ---- paint swaps instead of overwriting ---- */

function three() {
  return {
    cols: 3, rows: 3, moves: 20, pad: 'REV',
    grid: [['magenta', 'pink', 'magenta'], ['pink', 'magenta', 'pink'], ['purple', 'purple', 'purple']]
  };
}

test('painting a colour the board already has keeps it legal', function () {
  var L = three();
  var res = G.paintSwap(L, { c: 0, r: 0 }, 'purple', PAL);
  eq(res.mode, 'swap');
  eq(L.grid[0][0], 'purple');
  var v = E.validate(L);
  ok(v.ok, JSON.stringify(v.errors));
  eq(v.counts.purple, 3);
  eq(v.counts.magenta, 3);
});

test('painting the same colour twice is a no-op, not a swap', function () {
  var L = three();
  eq(G.paintSwap(L, { c: 2, r: 0 }, 'purple', PAL).mode, 'noop');
  eq(JSON.stringify(L.grid), JSON.stringify(three().grid));
});

test('painting a colour the board lacks hands one column over to it', function () {
  var L = three();
  var res = G.paintSwap(L, { c: 0, r: 0 }, 'cyan', PAL);
  eq(res.retinted, 3);
  eq(L.grid[0][0], 'cyan');
  var v = E.validate(L);
  ok(v.ok, JSON.stringify(v.errors));
  eq(v.counts.cyan, 3);
});

test('painting REV moves the one wrong-way car rather than adding another', function () {
  var L = three();
  L.grid[1][1] = 'REV';
  L.pad = 'magenta';
  G.paintSwap(L, { c: 0, r: 0 }, 'REV', PAL);
  eq(L.grid[0][0], 'REV');
  var v = E.validate(L);
  eq(v.counts.REV, 1);
  ok(v.ok, JSON.stringify(v.errors));
});

test('painting the pad swaps with a car on the board', function () {
  var L = three();
  var res = G.paintSwap(L, { pad: true }, 'pink', PAL);
  eq(res.mode, 'swap');
  eq(L.pad, 'pink');
  var v = E.validate(L);
  ok(v.ok, JSON.stringify(v.errors));
  eq(v.counts.REV, 1);
});

test('a hidden car keeps its cover when it is swapped', function () {
  var L = three();
  L.grid[2][0] = '?purple';
  G.paintSwap(L, { c: 0, r: 0 }, 'purple', PAL);
  var specs = [].concat.apply([], L.grid);
  eq(specs.filter(function (x) { return String(x).charAt(0) === '?'; }).length, 1);
});

test('a new colour can be introduced when the pad holds one of the victim cars', function () {
  /* magenta is 3 cars but one of them sits on the pad, so only two are on the
   * grid — the case that used to report "not enough cars" */
  var L = {
    cols: 3, rows: 3, moves: 10, pad: 'magenta',
    grid: [['magenta', 'purple', 'magenta'], ['purple', 'pink', 'REV'], ['purple', 'pink', 'pink']]
  };
  ok(E.validate(L).ok, 'fixture should start legal');
  var res = G.paintSwap(L, { pad: true }, 'white', PAL);
  ok(res.mode !== 'fail', JSON.stringify(res));
  eq(L.pad, 'white');
  var v = E.validate(L);
  ok(v.ok, JSON.stringify(v.errors));
  eq(v.counts.white, 3);
  eq(v.counts.REV, 1);
});

test('a new colour never eats the colour a coloured column demands', function () {
  var L = {
    cols: 3, rows: 3, moves: 20, pad: 'REV',
    grid: [['magenta', 'pink', 'magenta'], ['pink', 'magenta', 'pink'], ['purple', 'purple', 'purple']],
    coloredCols: [{ col: 2, color: 'purple' }, { col: 0, color: 'magenta' }]
  };
  ok(E.validate(L).ok, 'fixture should start legal');
  /* pink is the only colour with cars to spare */
  var res = G.paintSwap(L, { c: 1, r: 0 }, 'cyan', PAL);
  ok(res.mode !== 'fail', JSON.stringify(res));
  eq(res.from, 'pink');
  var v = E.validate(L);
  ok(v.ok, JSON.stringify(v.errors));
  eq(v.counts.purple, 3);
  eq(v.counts.magenta, 3);
});

test('with nothing to spare the stroke is refused instead of breaking the level', function () {
  var L = {
    cols: 3, rows: 3, moves: 20, pad: 'REV',
    grid: [['magenta', 'magenta', 'magenta'], ['pink', 'pink', 'pink'], ['purple', 'purple', 'purple']],
    coloredCols: [{ col: 0, color: 'magenta' }, { col: 1, color: 'pink' }, { col: 2, color: 'purple' }]
  };
  var res = G.paintSwap(L, { c: 1, r: 0 }, 'cyan', PAL);
  eq(res.mode, 'fail');
  eq(res.reason, 'reserved');
  ok(E.validate(L).ok, 'the board must be untouched');
});
