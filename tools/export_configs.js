/* Write one client config per level, the way configLevel_1_to_40/ is laid out.
 *
 *   node tools/export_configs.js                       # default set -> ./configLevel_out
 *   node tools/export_configs.js --set hard --out configLevel_1_to_40
 *   node tools/export_configs.js --hard                # bake Map/CarShape too
 *
 * Runs the solver for every level, so a 6x6 set takes a while. MinMove is the
 * real optimum where IDA* finds it and the greedy upper bound where it does not;
 * the run prints which is which.
 */
'use strict';
global.self = global;
['engine', 'levels', 'sets', 'solver', 'gen', 'gameconfig']
  .forEach(function (m) { require(process.cwd() + '/src/' + m + '.js'); });

var fs = require('fs'), path = require('path');
var E = self.Engine, S = self.Solver, GC = self.GameConfig;

function arg(name, dflt) {
  var i = process.argv.indexOf('--' + name);
  return i > 0 && process.argv[i + 1] && process.argv[i + 1].charAt(0) !== '-'
    ? process.argv[i + 1] : (i > 0 ? true : dflt);
}

var setKey = arg('set', 'default');
var outDir = arg('out', 'configLevel_out');
var hard = !!arg('hard', false);
var nodeCap = +arg('nodecap', 200000);

var sets = self.LevelSets.SETS;
if (!sets[setKey]) {
  console.error('unknown set "' + setKey + '". try: ' + Object.keys(sets).join(', '));
  process.exit(1);
}
var levels = sets[setKey].levels;

function minMove(L) {
  var sol = S.solve(E.createState(L), { nodeCap: nodeCap });
  if (sol.solved) return { n: sol.minMoves, exact: true };
  var g = S.greedySolve(E.createState(L), false);
  return { n: g.won ? g.moves.length : null, exact: false };
}

fs.mkdirSync(outDir, { recursive: true });
var written = 0, loose = 0;
levels.forEach(function (L, i) {
  var v = E.validate(L);
  if (!v.ok) { console.error('level ' + (i + 1) + ' invalid: ' + v.errors.join('; ')); return; }
  var m = minMove(L);
  if (!m.exact) loose++;
  var cfg = GC.toConfig(L, {
    level: L.id != null ? L.id : i + 1,
    minMove: m.n,
    hardConfig: hard,
    maxAttempts: +arg('attempts', 1000),
    lockedShuffleSteps: +arg('steps', 0)
  });
  var file = path.join(outDir, GC.fileName(cfg));
  fs.writeFileSync(file, GC.stringify(cfg) + '\n');
  written++;
  console.log(file + '  ' + cfg.NumQueue + 'x' + (cfg.NumPerRow + cfg.ExtraColumnsCount) +
              '  min ' + cfg.MinMove + (m.exact ? '' : '~') + '  max ' + cfg.MaxMove +
              '  kinds ' + cfg.KindList.length +
              (cfg.LockedColumns.length ? '  locked ' + JSON.stringify(cfg.LockedColumns) : '') +
              (cfg.ColoredColumnsLocation.length ? '  coloured ' + JSON.stringify(cfg.ColoredColumnsLocation) : ''));
});
console.log('\n' + written + ' file(s) in ' + outDir + (loose ? ', ' + loose + ' with an approximate MinMove' : ''));
