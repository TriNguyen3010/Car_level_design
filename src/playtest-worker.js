/* Runs the 10k playtest off the main thread.
 * A background browser tab clamps setTimeout to ~1s, which turned a 300ms job
 * into 18s of chunk-yield overhead. Worker timers are not throttled and the UI
 * never blocks, so the whole run happens in one go. */
importScripts('engine.js', 'solver.js', 'playtest.js');

self.onmessage = function (e) {
  var msg = e.data;
  if (msg.cmd !== 'run') return;
  try {
    var t0 = Date.now();
    var res = self.Playtest.runSync(msg.level, msg.runs, msg.opts || {});
    self.postMessage({
      ok: true,
      report: {
        level: { id: msg.level.id, cols: msg.level.cols, rows: msg.level.rows, moves: msg.level.moves },
        ms: Date.now() - t0,
        totalRuns: res.totalRuns,
        profiles: res.profiles
      }
    });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err && err.message || err) });
  }
};
