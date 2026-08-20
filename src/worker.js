/* Off-thread compute for the two jobs that would otherwise stall the page:
 * the mass playtest and fitting difficulty tiers.
 *
 * Both used to yield with setTimeout to keep the UI alive, and a background
 * browser tab clamps those to ~1s each. Fitting a tier across ten levels does
 * hundreds of yields, which turned a few seconds of work into several minutes
 * the moment the user looked at another tab. Worker timers are not throttled
 * and nothing here touches the DOM, so both jobs run straight through. */
importScripts('engine.js', 'solver.js', 'playtest.js', 'gen.js', 'tuner.js', 'difficulty.js');

function runPlaytest(msg) {
  var t0 = Date.now();
  var res = self.Playtest.runSync(msg.level, msg.runs, msg.opts || {});
  return {
    level: { id: msg.level.id, cols: msg.level.cols, rows: msg.level.rows, moves: msg.level.moves },
    ms: Date.now() - t0,
    totalRuns: res.totalRuns,
    profiles: res.profiles
  };
}

function runFitRange(msg) {
  if (msg.templates) self.Difficulty.load(msg.templates);
  var t0 = Date.now();
  var out = [];
  msg.items.forEach(function (it, k) {
    var r = self.Difficulty.fitOneSync(
      it.level, msg.key, msg.palette, msg.seed + it.at * 17, msg.runs || 600,
      function (frac, text) {
        self.postMessage({
          type: 'progress', k: k, total: msg.items.length,
          frac: (k + frac) / msg.items.length,
          text: 'level ' + (it.level.id != null ? it.level.id : it.at + 1) +
                ' (' + (k + 1) + '/' + msg.items.length + ') · ' + text
        });
      });
    out.push({ at: it.at, best: r.best, log: r.log, steps: r.steps });
  });
  return { results: out, ms: Date.now() - t0 };
}

self.onmessage = function (e) {
  var msg = e.data;
  try {
    if (msg.cmd === 'run') {
      self.postMessage({ ok: true, type: 'done', report: runPlaytest(msg) });
    } else if (msg.cmd === 'fitRange') {
      var r = runFitRange(msg);
      self.postMessage({ ok: true, type: 'fitDone', results: r.results, ms: r.ms });
    }
  } catch (err) {
    self.postMessage({ ok: false, type: 'error', error: String((err && err.message) || err) });
  }
};
