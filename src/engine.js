/* Car Sort — pure game logic.
 *
 * Board model
 *   grid[c][r]  column c, row r.  r = 0 is the TOP row, r = rows-1 is the BOTTOM row.
 *   Cars are inserted at the TOP of a column, the whole column shifts down one slot,
 *   and the BOTTOM car is ejected onto the pad, becoming the next car to place.
 *   A column whose cars are all the same colour is complete: it locks and can no
 *   longer be tapped.  The level is won when every column is complete.
 *   Total cars is always cols*rows + 1 — the one extra car ends up on the pad.
 *
 * Special car (REV)
 *   The "wrong way" car.  Colourless: a column holding it can never be complete,
 *   and it is never required to be placed — it is the car that ends on the pad.
 *
 * Hidden cars ("?")
 *   Reveal as soon as they move, i.e. the first time their column is tapped.
 *
 * Auto-sort
 *   After every move, any unlocked column that is one car short of complete in the
 *   pad car's colour has its single odd car relocated to the bottom slot, so that
 *   tapping that column both completes it and ejects the odd car.
 *
 * No DOM, no timers, no randomness in here.
 */
(function (global) {
  'use strict';

  var REV = 'REV';
  var nextId = 1;

  function parseCell(spec) {
    var hidden = false, v = String(spec);
    if (v.charAt(0) === '?') { hidden = true; v = v.slice(1); }
    return { color: v, hidden: hidden, id: nextId++ };
  }

  function cellToSpec(cell) { return (cell.hidden ? '?' : '') + cell.color; }

  function createState(level) {
    var cols = level.cols, rows = level.rows, grid = new Array(cols);
    for (var c = 0; c < cols; c++) {
      grid[c] = new Array(rows);
      for (var r = 0; r < rows; r++) grid[c][r] = parseCell(level.grid[c][r]);
    }
    var state = {
      cols: cols,
      rows: rows,
      grid: grid,
      pad: parseCell(level.pad),
      locked: new Array(cols).fill(false),
      budget: level.moves,
      movesLeft: level.moves,
      movesUsed: 0,
      status: 'playing'
    };
    normalize(state);
    return state;
  }

  function cloneState(s) {
    var grid = new Array(s.cols);
    for (var c = 0; c < s.cols; c++) {
      var src = s.grid[c], col = new Array(s.rows);
      for (var r = 0; r < s.rows; r++) {
        var x = src[r];
        col[r] = { color: x.color, hidden: x.hidden, id: x.id };
      }
      grid[c] = col;
    }
    return {
      cols: s.cols, rows: s.rows, grid: grid,
      pad: { color: s.pad.color, hidden: s.pad.hidden, id: s.pad.id },
      locked: s.locked.slice(),
      budget: s.budget, movesLeft: s.movesLeft, movesUsed: s.movesUsed,
      status: s.status
    };
  }

  function columnComplete(s, c) {
    var col = s.grid[c], first = col[0].color;
    if (first === REV || col[0].hidden) return false;
    for (var r = 1; r < s.rows; r++) {
      if (col[r].hidden || col[r].color !== first) return false;
    }
    return true;
  }

  function isWon(s) {
    for (var c = 0; c < s.cols; c++) if (!s.locked[c]) return false;
    return true;
  }

  /* Relocate the single odd car of a nearly-finished column to the bottom slot. */
  function autoSort(s) {
    var moved = [], pad = s.pad.color;
    if (pad === REV || s.pad.hidden) return moved;
    for (var c = 0; c < s.cols; c++) {
      if (s.locked[c]) continue;
      var col = s.grid[c], R = s.rows, same = 0, oddRow = -1, blocked = false;
      for (var r = 0; r < R; r++) {
        if (col[r].hidden) { blocked = true; break; }
        if (col[r].color === pad) same++;
        else if (oddRow < 0) oddRow = r;
      }
      if (blocked) continue;
      if (same !== R - 1) continue;          // not one car short of complete
      if (oddRow < 0 || oddRow === R - 1) continue;   // already at the bottom
      col.push(col.splice(oddRow, 1)[0]);
      moved.push({ col: c, from: oddRow, to: R - 1 });
    }
    return moved;
  }

  function normalize(s) {
    var completed = [];
    for (var c = 0; c < s.cols; c++) {
      if (!s.locked[c] && columnComplete(s, c)) { s.locked[c] = true; completed.push(c); }
    }
    var sorted = autoSort(s);
    s.status = isWon(s) ? 'won' : (s.movesLeft <= 0 ? 'lost' : 'playing');
    return { completed: completed, autoSorted: sorted };
  }

  function legalMoves(s) {
    var out = [];
    if (s.status !== 'playing') return out;
    for (var c = 0; c < s.cols; c++) if (!s.locked[c]) out.push(c);
    return out;
  }

  /* Mutates s. Returns an event describing what happened, or null if illegal. */
  function applyMove(s, c) {
    if (s.status !== 'playing' || s.locked[c]) return null;
    var col = s.grid[c], R = s.rows;
    var ejected = col[R - 1];
    var inserted = s.pad;
    for (var r = R - 1; r > 0; r--) col[r] = col[r - 1];
    col[0] = inserted;
    s.pad = ejected;
    for (var r2 = 0; r2 < R; r2++) col[r2].hidden = false;   // the whole column moved
    ejected.hidden = false;
    s.movesUsed++;
    s.movesLeft--;

    var preSortIds = new Array(s.cols);
    for (var cc = 0; cc < s.cols; cc++) {
      preSortIds[cc] = s.grid[cc].map(function (x) { return x.id; });
    }

    var norm = normalize(s);
    return {
      col: c,
      inserted: inserted,
      ejected: ejected,
      completed: norm.completed,
      autoSorted: norm.autoSorted,
      preSortIds: norm.autoSorted.length ? preSortIds : null,
      status: s.status
    };
  }

  function stateKey(s) {
    var out = '';
    for (var c = 0; c < s.cols; c++) {
      for (var r = 0; r < s.rows; r++) out += s.grid[c][r].color + ',';
      out += '|';
    }
    return out + '#' + s.pad.color;
  }

  function countCars(level) {
    var counts = {}, n = 0;
    for (var c = 0; c < level.cols; c++) {
      for (var r = 0; r < level.rows; r++) {
        var cell = parseCell(level.grid[c][r]);
        counts[cell.color] = (counts[cell.color] || 0) + 1;
        n++;
      }
    }
    var pad = parseCell(level.pad);
    counts[pad.color] = (counts[pad.color] || 0) + 1;
    n++;
    return { counts: counts, total: n };
  }

  /* Structural validation. Catches the mistakes that make a level unwinnable
   * no matter how it is played. */
  function validate(level) {
    var errors = [], warnings = [];
    var cols = level.cols, rows = level.rows;

    if (!(cols >= 2 && rows >= 2)) errors.push('cols/rows phải >= 2');
    if (!level.grid || level.grid.length !== cols) {
      errors.push('grid có ' + (level.grid ? level.grid.length : 0) + ' cột, khai báo ' + cols);
      return { ok: false, errors: errors, warnings: warnings };
    }
    for (var c = 0; c < cols; c++) {
      if (!level.grid[c] || level.grid[c].length !== rows) {
        errors.push('cột ' + (c + 1) + ' có ' + (level.grid[c] || []).length + ' ô, khai báo ' + rows);
      }
    }
    if (errors.length) return { ok: false, errors: errors, warnings: warnings };

    var info = countCars(level);
    var expected = cols * rows + 1;
    if (info.total !== expected) {
      errors.push('tổng xe ' + info.total + ', phải là ' + expected + ' (cols*rows+1)');
    }

    var revs = info.counts[REV] || 0;
    if (revs > 1) errors.push(revs + ' xe ngược chiều, tối đa 1');

    /* Exactly one car ends on the pad. So there must be a colour we can drop one
     * of such that every remaining colour fills a whole number of columns. */
    var colors = Object.keys(info.counts), leftOut = [];
    for (var i = 0; i < colors.length; i++) {
      var k = colors[i], ok = true, columnsUsed = 0;
      for (var j = 0; j < colors.length; j++) {
        var kk = colors[j], n = info.counts[kk] - (kk === k ? 1 : 0);
        if (n === 0) continue;
        if (kk === REV) { ok = false; break; }        // REV can never fill a column
        if (n % rows !== 0) { ok = false; break; }
        columnsUsed += n / rows;
      }
      if (ok && columnsUsed === cols) leftOut.push(k);
    }
    if (!leftOut.length && !errors.length) {
      errors.push('không có cách chia: mỗi màu phải đủ bội số của rows (' + rows +
                  ') sau khi để lại đúng 1 xe trên pad');
    }

    var hidden = 0;
    for (var cc = 0; cc < cols; cc++) {
      for (var rr = 0; rr < rows; rr++) {
        if (String(level.grid[cc][rr]).charAt(0) === '?') hidden++;
      }
    }
    if (!(level.moves > 0)) errors.push('moves phải > 0');

    return {
      ok: errors.length === 0,
      errors: errors,
      warnings: warnings,
      counts: info.counts,
      total: info.total,
      hidden: hidden,
      padCandidates: leftOut
    };
  }

  /* Serialise a live state back into level data — used by the editor. */
  function stateToLevel(s, base) {
    var grid = new Array(s.cols);
    for (var c = 0; c < s.cols; c++) grid[c] = s.grid[c].map(cellToSpec);
    var out = {
      cols: s.cols, rows: s.rows, moves: s.budget,
      pad: cellToSpec(s.pad), grid: grid
    };
    if (base) {
      if (base.id != null) out.id = base.id;
      if (base.name) out.name = base.name;
      if (base.tutorial) out.tutorial = base.tutorial;
      if (base.theme) out.theme = base.theme;
    }
    return out;
  }

  global.Engine = {
    REV: REV,
    parseCell: parseCell,
    cellToSpec: cellToSpec,
    createState: createState,
    cloneState: cloneState,
    columnComplete: columnComplete,
    isWon: isWon,
    normalize: normalize,
    legalMoves: legalMoves,
    applyMove: applyMove,
    stateKey: stateKey,
    countCars: countCars,
    validate: validate,
    stateToLevel: stateToLevel
  };
})(window);
