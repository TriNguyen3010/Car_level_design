/* Generate the three difficulty campaigns over 10 levels and verify the SHAPE
 * of the measured win-rate curve, not just that each level hits its tier.
 * Tier maps to a win-rate BAND, so a sawtooth in tier numbers does not
 * guarantee a sawtooth in what players actually experience. */
global.self = global;
['engine','levels','solver','gen','playtest','tuner','difficulty']
  .forEach(m => require(process.cwd() + '/src/' + m + '.js'));
const E = self.Engine, Df = self.Difficulty, T = self.Tuner, pal = self.LevelData.palette;

const SETS = {
  easy: {
    name: 'Dẫn tay', label: 'Dễ',
    /* Rhythm measured on the CARELESS player, not the average one: in tiers 1-4
     * the average player sits at 98-100% and has no room to feel a dip, and an
     * easy campaign is aimed at people who make mistakes anyway. The level-6
     * drop is two tiers deep because a one-tier dip did not register at all. */
    tiers: [1, 1, 2, 2, 3, 1, 3, 4, 4, 3],
    sizes: [[4,4],[4,4],[4,5],[4,5],[4,5],[4,4],[4,5],[5,5],[5,5],[4,5]],
    breathers: [6, 10],
    rhythmOn: 'winSloppy'
  },
  medium: {
    name: 'Nhịp', label: 'Trung',
    tiers: [1, 2, 3, 2, 4, 5, 6, 5, 7, 6],
    sizes: [[4,4],[4,5],[4,5],[4,5],[5,5],[5,5],[5,5],[5,5],[5,6],[5,6]],
    breathers: [4, 8, 10],
    rhythmOn: 'winAvg'
  },
  hard: {
    name: 'Thử ngay', label: 'Khó',
    /* Ends ON its peak, unlike the other two. The campaign's job is to filter,
     * so clearing level 10 is the signal — not a soft landing into level 11. */
    tiers: [2, 4, 6, 5, 7, 8, 7, 9, 8, 10],
    sizes: [[4,5],[5,5],[5,5],[5,5],[5,5],[5,6],[5,6],[5,6],[5,6],[6,6]],
    breathers: [4, 7, 9],
    rhythmOn: 'winAvg'
  }
};

function blank(cols, rows, id) {
  const grid = [];
  for (let c = 0; c < cols; c++) {
    grid[c] = [];
    for (let r = 0; r < rows; r++) grid[c][r] = 'yellow';
  }
  return { id, cols, rows, moves: 30, theme: id <= 5 ? 'city' : 'suburb', pad: 'REV', grid };
}

function buildSet(key) {
  const spec = SETS[key], out = [];
  const metric = spec.rhythmOn || 'winAvg';
  spec.tiers.forEach((tier, i) => {
    const tpl = Df.TEMPLATES['t' + tier];
    const cols = Math.max(spec.sizes[i][0], tpl.minCols);
    const rows = Math.max(spec.sizes[i][1], tpl.minRows);
    const isBreather = spec.breathers.includes(i + 1);

    /* Adjacent tiers have overlapping win-rate bands, so a breather generated
     * at the middle of its band can measure HARDER than the peak it follows.
     * A breather is supposed to feel like relief, so it gets the easy end of
     * its band: try several seeds and keep the highest-scoring one that still
     * meets every criterion. */
    const seeds = isBreather ? [0, 1, 2, 3, 4, 5, 6, 7] : [0];
    let best = null;
    for (const sd of seeds) {
      const r = Df.fitOneSync(blank(cols, rows, i + 1), 't' + tier, pal, 100 + i * 13 + sd * 211, 700, null);
      if (!r.best) continue;
      const full = r.best.check.pass === r.best.check.total;
      const score = (full ? 1 : 0) * 1000 + r.best.measure[metric] * 100;
      if (!best || score > best.score) best = { score, r: r.best };
    }
    if (!best) { out.push(null); return; }
    const lv = best.r.level;
    lv.id = i + 1;
    lv.tier = tier;
    out.push({ level: lv, tier, check: best.r.check, m: best.r.measure });
  });
  return out;
}

function shapeReport(key, rows) {
  const spec = SETS[key];
  const key2 = spec.rhythmOn || 'winAvg';
  const wa = rows.map(r => r ? r.m[key2] : null);
  const ws = rows.map(r => r ? r.m.winSloppy : null);
  console.log('\n=== ' + spec.name + ' (' + spec.label + ') ===');
  console.log('lv  bậc  bàn   budget  giỏi   TB    ẩu   tiêu chí');
  rows.forEach((r, i) => {
    if (!r) { console.log(String(i+1).padStart(2), ' KHÔNG SINH ĐƯỢC'); return; }
    console.log(
      String(i + 1).padStart(2),
      String(r.tier).padStart(4),
      (r.level.cols + 'x' + r.level.rows).padStart(5),
      String(r.level.moves).padStart(7),
      (r.m.winCareful * 100).toFixed(0).padStart(5) + '%',
      (r.m.winAvg * 100).toFixed(0).padStart(4) + '%',
      (r.m.winSloppy * 100).toFixed(0).padStart(4) + '%',
      (r.check.pass + '/' + r.check.total).padStart(6),
      spec.breathers.includes(i + 1) ? '  ← chỗ nghỉ chủ ý' : ''
    );
  });

  /* trend: least-squares slope over the measured average-player win rate */
  const n = wa.filter(v => v != null).length;
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  wa.forEach((v, i) => { if (v == null) return; sx += i; sy += v; sxy += i * v; sxx += i * i; });
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  console.log('xu hướng (' + key2 + '): ' + (slope * 100).toFixed(2) + ' điểm / level  (âm = khó dần)');

  /* do the intended breathers actually read as relief? */
  spec.breathers.forEach(b => {
    const i = b - 1;
    if (!wa[i] || !wa[i - 1]) return;
    const d = (wa[i] - wa[i - 1]) * 100;
    console.log('  chỗ nghỉ lv' + b + ': ' + key2 + ' ' + (d >= 0 ? '+' : '') + d.toFixed(0) +
                ' điểm so với lv' + (b - 1) + (d > 2 ? '  ✓ cảm được' : '  ✗ KHÔNG cảm được'));
  });
  const fails = rows.filter(r => r && r.check.pass !== r.check.total).length;
  console.log('level chưa đạt đủ tiêu chí: ' + fails + '/' + rows.length);
  return rows;
}

const built = {};
Object.keys(SETS).forEach(k => { built[k] = shapeReport(k, buildSet(k)); });

require('fs').writeFileSync('/tmp/sets.json', JSON.stringify(
  Object.fromEntries(Object.entries(built).map(([k, rows]) => [k, {
    name: SETS[k].name, label: SETS[k].label, breathers: SETS[k].breathers,
    levels: rows.map(r => r && r.level)
  }])), null, 1));
console.log('\n-> /tmp/sets.json');
