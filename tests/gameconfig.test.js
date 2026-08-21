'use strict';
var H = require('./harness.js'), test = H.test, eq = H.eq, ok = H.ok;
var E = self.Engine, GC = self.GameConfig;

function base() {
  return {
    id: 7, cols: 4, rows: 3, moves: 40, pad: 'REV',
    grid: [
      ['yellow', 'blue', 'red'],
      ['blue', 'red', 'yellow'],
      ['red', 'yellow', 'green'],
      ['green', 'green', 'blue']
    ]
  };
}

test('config carries the level shape', function () {
  var cfg = GC.toConfig(base(), { minMove: 12 });
  eq(cfg.ConfigVersion, 1);
  eq(cfg.MapLevel, 7);
  eq(cfg.NumQueue, 3);
  eq(cfg.NumPerRow, 4);
  eq(cfg.ExtraColumnsCount, 0);
  eq(cfg.MinMove, 12);
  eq(cfg.MaxMove, 40);
  eq(cfg.KindList, ['a1', 'b4', 'b7', 'a7']);
});

test('extraColumns shrinks NumPerRow and keeps the column total', function () {
  var L = base();
  L.extraColumns = 1;
  var cfg = GC.toConfig(L, { minMove: 12 });
  eq(cfg.NumPerRow + cfg.ExtraColumnsCount, L.cols);
  eq(cfg.ExtraColumnsCount, 1);
});

test('MaxColorMatch is measured off the board', function () {
  var L = base();
  eq(GC.toConfig(L, { minMove: 1 }).MaxColorMatch, 2);   // column 4 holds two greens
  L.grid[0] = ['yellow', 'yellow', 'yellow'];
  eq(GC.toConfig(L, { minMove: 1 }).MaxColorMatch, 3);
});

test('both mechanics export 1-based, the way the client reads them', function () {
  var L = base();
  L.lockedCols = [{ col: 2, need: 2 }];
  L.coloredCols = [{ col: 0, color: 'yellow' }, { col: 3, color: 'green' }];
  var cfg = GC.toConfig(L, { minMove: 12 });
  eq(cfg.LockedColumns, [{ Column: 3, Counter: 2 }]);
  eq(cfg.ColoredColumnsLocation, [1, 4]);
});

test('hidden cars are counted, pad included', function () {
  var L = base();
  L.grid[1][1] = '?red';
  L.grid[2][0] = '?red';
  eq(GC.toConfig(L, { minMove: 1 }).NumHiddenCar, 2);
});

test('hard config writes the board row-major with the pad car', function () {
  var L = base();
  var cfg = GC.toConfig(L, { minMove: 12, hardConfig: true });
  eq(cfg.Map.length, 12);
  eq(cfg.Map.slice(0, 4), ['a1', 'b4', 'b7', 'a7']);   // top row, left to right
  eq(cfg.DummyType, 'rev');
  eq(cfg.CarShape.slice(0, 4), [1, 2, 2, 1]);
});

test('stringify pins the float32 ratio literal the client writes', function () {
  var txt = GC.stringify(GC.toConfig(base(), { minMove: 12 }));
  ok(txt.indexOf('"LockedShuffleRatio": 0.15000000596046449') > 0, txt);
});

test('a hard-config file round-trips back into a playable level', function () {
  var L = base();
  L.lockedCols = [{ col: 2, need: 2 }];
  L.coloredCols = [{ col: 0, color: 'yellow' }];
  var cfg = GC.toConfig(L, { minMove: 12, hardConfig: true });
  var back = GC.fromConfig(cfg).level;
  eq(back.cols, L.cols);
  eq(back.rows, L.rows);
  eq(back.grid, L.grid);
  eq(back.pad, 'REV');
  eq(back.lockedCols, [{ col: 2, need: 2 }]);
  eq(back.coloredCols, [{ col: 0, color: 'yellow' }]);
  ok(E.validate(back).ok, JSON.stringify(E.validate(back).errors));
});

test('a params-only file generates a board that validates', function () {
  var cfg = {
    ConfigVersion: 1, MapLevel: 21, Seed: 0,
    NumQueue: 4, NumPerRow: 4, ExtraColumnsCount: 0,
    ColorList: [], KindList: ['a1', 'b4', 'b7', 'a7'],
    MinMove: 18, MaxMove: 40, MaxColorMatch: 2,
    ColoredColumnsLocation: [2], LockedColumns: [{ Column: 4, Counter: 1 }],
    NumHiddenCar: 0, LockedShuffleRatio: 0.15, LockedShuffleSteps: 0, MaxAttempts: 1000
  };
  var got = GC.fromConfig(cfg, { maxAttempts: 12, nodeCap: 60000 });
  ok(got, 'no level came back');
  eq(got.level.cols, 4);
  eq(got.level.rows, 4);
  eq(got.level.lockedCols, [{ col: 3, need: 1 }]);
  eq(got.level.coloredCols.length, 1);
  eq(got.level.coloredCols[0].col, 1);
  ok(E.validate(got.level).ok, JSON.stringify(E.validate(got.level).errors));
});
