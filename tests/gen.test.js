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
