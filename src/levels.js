/* The 10 levels transcribed from the reference screenshots.
 * grid[c][r]: c = column left to right, r = row top to bottom.
 * "REV" = wrong-way car, "?" prefix = hidden car.
 * Hidden car colours in L8/L9 are inferred from the colour-count invariant
 * (total = cols*rows+1, every colour a multiple of rows) — the counts are forced,
 * the slot-by-slot assignment is a best guess.
 */
(function (global) {
  'use strict';

  var PALETTE = {
    magenta: '#e0479f', pink: '#ec5a8a', purple: '#9b3fc4', violet: '#6f74c9',
    lime:    '#8ec63f', green:  '#57ad33', mint:   '#5fd0a8', teal:   '#3e9e9e',
    cyan:    '#5ecfe0', blue:   '#4a90d9', navy:   '#59689f',
    yellow:  '#f0c132', orange: '#e8792b', red:    '#e04a3c', brown:  '#a86a35',
    beige:   '#e2c9a4', gray:   '#7d7d7d', white:  '#dbe2ea'
  };

  var LEVELS = [
    { id: 1, cols: 4, rows: 4, moves: 30, theme: 'city',
      tutorial: 'Match the colored car to its column',
      pad: 'lime',
      grid: [
        ['magenta','magenta','magenta','yellow'],
        ['lime','lime','lime','cyan'],
        ['yellow','yellow','yellow','REV'],
        ['cyan','cyan','cyan','magenta']
      ] },

    { id: 2, cols: 4, rows: 5, moves: 30, theme: 'city',
      unlock: 'undo',
      pad: 'yellow',
      grid: [
        ['cyan','cyan','REV','cyan','cyan'],
        ['magenta','magenta','magenta','magenta','beige'],
        ['beige','beige','beige','beige','cyan'],
        ['yellow','yellow','yellow','yellow','magenta']
      ] },

    { id: 3, cols: 4, rows: 5, moves: 60, theme: 'city',
      pad: 'REV',
      grid: [
        ['blue','blue','blue','lime','lime'],
        ['orange','orange','orange','orange','blue'],
        ['lime','lime','lime','blue','beige'],
        ['beige','beige','beige','beige','orange']
      ] },

    { id: 4, cols: 5, rows: 5, moves: 50, theme: 'city',
      pad: 'magenta',
      grid: [
        ['lime','lime','yellow','red','lime'],
        ['blue','yellow','yellow','blue','magenta'],
        ['yellow','yellow','REV','red','red'],
        ['red','blue','blue','red','lime'],
        ['magenta','magenta','blue','magenta','lime']
      ] },

    { id: 5, cols: 5, rows: 5, moves: 45, theme: 'city',
      pad: 'purple',
      grid: [
        ['cyan','yellow','yellow','cyan','purple'],
        ['lime','lime','yellow','beige','lime'],
        ['yellow','yellow','REV','beige','beige'],
        ['purple','purple','cyan','purple','lime'],
        ['beige','cyan','cyan','beige','lime']
      ] },

    { id: 6, cols: 5, rows: 6, moves: 35, theme: 'suburb',
      pad: 'magenta',
      grid: [
        ['yellow','magenta','mint','yellow','magenta','yellow'],
        ['yellow','yellow','yellow','magenta','magenta','mint'],
        ['mint','mint','REV','magenta','yellow','yellow'],
        ['magenta','magenta','magenta','yellow','yellow','mint'],
        ['magenta','yellow','mint','magenta','yellow','magenta']
      ] },

    { id: 7, cols: 5, rows: 5, moves: 45, theme: 'suburb',
      pad: 'beige',
      grid: [
        ['beige','beige','beige','lime','navy'],
        ['navy','navy','purple','blue','beige'],
        ['lime','lime','blue','lime','blue'],
        ['blue','blue','lime','purple','navy'],
        ['purple','purple','REV','purple','navy']
      ] },

    { id: 8, cols: 5, rows: 5, moves: 60, theme: 'suburb',
      unlock: 'surprise',
      pad: 'beige',
      grid: [
        ['yellow','yellow','?yellow','blue','mint'],
        ['orange','orange','mint','?yellow','beige'],
        ['beige','REV','?orange','mint','yellow'],
        ['blue','beige','blue','?beige','orange'],
        ['mint','mint','?blue','orange','blue']
      ] },

    { id: 9, cols: 5, rows: 5, moves: 50, theme: 'suburb',
      pad: 'gray',
      grid: [
        ['pink','cyan','?gray','?pink','white'],
        ['gray','violet','?gray','?cyan','cyan'],
        ['violet','pink','?gray','?white','pink'],
        ['cyan','violet','?violet','?white','cyan'],
        ['pink','white','?violet','?REV','white']
      ] },

    { id: 10, cols: 6, rows: 6, moves: 50, theme: 'suburb',
      pad: 'REV',
      grid: [
        ['purple','purple','mint','beige','lime','beige'],
        ['lime','navy','purple','beige','purple','navy'],
        ['mint','mint','purple','mint','lime','brown'],
        ['beige','beige','navy','beige','brown','lime'],
        ['navy','lime','brown','brown','lime','mint'],
        ['brown','brown','navy','navy','mint','purple']
      ] }
  ];

  global.LevelData = { palette: PALETTE, levels: LEVELS };
})(window);
