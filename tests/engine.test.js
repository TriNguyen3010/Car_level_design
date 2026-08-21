'use strict';
var H = require('./harness.js'), test = H.test, eq = H.eq, ok = H.ok;
var E = self.Engine;

function lv(extra) {
  var L = {
    cols: 4, rows: 2, moves: 30, pad: 'REV',
    grid: [['yellow', 'blue'], ['blue', 'yellow'], ['red', 'green'], ['green', 'red']]
  };
  Object.keys(extra || {}).forEach(function (k) { L[k] = extra[k]; });
  return L;
}

/* ---- locked columns ---- */

test('locked column is sealed while too few columns are done', function () {
  var s = E.createState(lv({ lockedCols: [{ col: 3, need: 1 }] }));
  eq(s.sealed, [false, false, false, true]);
  eq(E.legalMoves(s), [0, 1, 2]);
});

test('tapping a sealed column is refused', function () {
  var s = E.createState(lv({ lockedCols: [{ col: 3, need: 1 }] }));
  eq(E.applyMove(s, 3), null);
  eq(s.movesUsed, 0);
});

test('seal opens as soon as the required number of columns is complete', function () {
  var s = E.createState(lv({ lockedCols: [{ col: 3, need: 1 }] }));
  E.applyMove(s, 0);                       // REV in, blue out
  eq(s.pad.color, 'blue');
  var ev = E.applyMove(s, 1);               // blue in, completes column 1
  eq(ev.completed, [1]);
  eq(ev.unsealed, [3]);
  eq(s.sealed[3], false);
  H.includes(E.legalMoves(s), 3);
});

test('a seal that can never open is a validation error', function () {
  var v = E.validate(lv({ lockedCols: [{ col: 3, need: 4 }] }));
  eq(v.ok, false);
  ok(/clear 4 cột/.test(v.errors.join(' ')), 'expected the unlock-order error, got ' + JSON.stringify(v.errors));
});

test('every column locked is a validation error', function () {
  var v = E.validate(lv({ lockedCols: [{ col: 0, need: 1 }, { col: 1, need: 1 }, { col: 2, need: 1 }, { col: 3, need: 1 }] }));
  eq(v.ok, false);
  ok(/không tap được/.test(v.errors.join(' ')), v.errors.join(' '));
});

test('no legal move left and not won reads as lost, not as playing', function () {
  var s = E.createState({
    cols: 2, rows: 2, moves: 30, pad: 'REV',
    grid: [['yellow', 'yellow'], ['blue', 'red']],
    lockedCols: [{ col: 1, need: 2 }]
  });
  eq(s.locked[0], true);          // column 0 is already one colour
  eq(s.sealed[1], true);          // needs 2 done, only 1 is
  eq(s.status, 'lost');
});

/* ---- coloured columns ---- */

function colored() {
  return {
    cols: 3, rows: 2, moves: 30, pad: 'REV',
    grid: [['yellow', 'yellow'], ['blue', 'blue'], ['red', 'red']],
    coloredCols: [{ col: 0, color: 'blue' }]
  };
}

test('a single-colour column does not complete in the wrong colour', function () {
  var s = E.createState(colored());
  eq(s.locked, [false, true, true]);
  eq(s.status, 'playing');
});

test('the same column completes in the colour it asks for', function () {
  var L = colored();
  L.grid = [['blue', 'blue'], ['yellow', 'yellow'], ['red', 'red']];
  L.coloredCols = [{ col: 0, color: 'blue' }];
  var s = E.createState(L);
  eq(s.locked[0], true);
  eq(s.status, 'won');
});

test('auto-sort leaves a coloured column alone when the pad car is the wrong colour', function () {
  var L = {
    cols: 3, rows: 3, moves: 30, pad: 'yellow',
    grid: [['blue', 'blue', 'yellow'], ['yellow', 'yellow', 'blue'], ['red', 'red', 'red']],
    coloredCols: [{ col: 0, color: 'blue' }]
  };
  var s = E.createState(L);
  eq(s.grid[0].map(function (x) { return x.color; }), ['blue', 'blue', 'yellow']);
  var s2 = E.createState({
    cols: 3, rows: 3, moves: 30, pad: 'yellow',
    grid: [['blue', 'blue', 'yellow'], ['yellow', 'yellow', 'blue'], ['red', 'red', 'red']]
  });
  eq(s2.grid[1].map(function (x) { return x.color; }), ['yellow', 'yellow', 'blue']);
});

test('a colour the board cannot supply is a validation error', function () {
  var L = lv({ coloredCols: [{ col: 0, color: 'blue' }, { col: 1, color: 'blue' }] });
  var v = E.validate(L);
  eq(v.ok, false);
  ok(/đòi màu blue/.test(v.errors.join(' ')), v.errors.join(' '));
});

test('stateToLevel round-trips both mechanics', function () {
  var L = lv({ lockedCols: [{ col: 3, need: 1 }], coloredCols: [{ col: 0, color: 'yellow' }] });
  var out = E.stateToLevel(E.createState(L), L);
  eq(out.lockedCols, [{ col: 3, need: 1 }]);
  eq(out.coloredCols, [{ col: 0, color: 'yellow' }]);
});
