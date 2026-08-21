/* Turn configLevel_gen40/tool_set_40.json into src/set40.js — a fifth campaign
 * that ships with the tool, so opening the page shows 40 levels without an
 * import step.
 *
 *   node tools/make_40.js --out configLevel_gen40 && node tools/pack_40.js
 */
'use strict';
var fs = require('fs');

var IN = process.argv[2] || 'configLevel_gen40/tool_set_40.json';
var OUT = process.argv[3] || 'src/set40.js';
var bundle = JSON.parse(fs.readFileSync(IN, 'utf8'));
var levels = bundle.levels;

function line(L) {
  var head = { id: L.id, tier: L.tier, cols: L.cols, rows: L.rows, moves: L.moves, theme: L.theme, pad: L.pad };
  var out = '    { ' + Object.keys(head).map(function (k) {
    return k + ': ' + JSON.stringify(head[k]);
  }).join(', ');
  if (L.lockedCols) out += ',\n      lockedCols: ' + JSON.stringify(L.lockedCols);
  if (L.coloredCols) out += ',\n      coloredCols: ' + JSON.stringify(L.coloredCols);
  out += ',\n      grid: ' + JSON.stringify(L.grid) + ' },';
  return out;
}

var body = [
  '/* The shipped 40-level campaign. Generated — do not hand-edit.',
  ' *',
  ' *   node tools/make_40.js --out configLevel_gen40 --tries 10',
  ' *   node tools/pack_40.js',
  ' *',
  ' * Teaching order: hidden cars from level 9, coloured columns from 21, locked',
  ' * columns from 31. Every new mechanic lands on a step DROP so the level that',
  ' * introduces it is easier than the one before it. Budgets are fitted to each',
  ' * step\'s win-rate band by bisection rather than by multiplying the optimum,',
  ' * because the ladder\'s slack numbers were measured before these two',
  ' * mechanics existed. Measured curve and per-level numbers:',
  ' * configLevel_gen40/README.md',
  ' */',
  '(function (global) {',
  "  'use strict';",
  '',
  '  var LEVELS = [',
  levels.map(line).join('\n'),
  '  ];',
  '',
  '  var S = global.LevelSets;',
  '  if (!S) return;',
  "  S.SETS['gen40'] = {",
  "    name: { vi: '40 level', en: '40 levels' },",
  "    label: { vi: '40 level', en: '40 levels' },",
  "    intent: { vi: 'Bộ đầy đủ 40 level. Xe ẩn từ level 9, cột màu từ 21, cột khoá từ 31 — mỗi cơ chế mới vào ở một bậc tụt.',",
  "              en: 'The full 40-level run. Hidden cars from level 9, coloured columns from 21, locked columns from 31 — each new mechanic arrives on a step drop.' },",
  "    note: '',",
  "    rhythmOn: 'winAvg',",
  '    breathers: [9, 14, 17, 21, 25, 27, 29, 31, 35],',
  '    levels: LEVELS',
  '  };',
  "  /* first in the picker: this is the campaign; the four short sets stay for",
  "   * comparing curves. */",
  "  if (S.order.indexOf('gen40') < 0) S.order.unshift('gen40');",
  "})(typeof self !== 'undefined' ? self : this);",
  ''
].join('\n');

fs.writeFileSync(OUT, body);
console.log(OUT + ': ' + levels.length + ' levels, ' +
  levels.filter(function (L) { return L.lockedCols; }).length + ' with locked columns, ' +
  levels.filter(function (L) { return L.coloredCols; }).length + ' with coloured columns');
