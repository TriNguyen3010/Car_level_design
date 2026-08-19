/* The tool itself: play the level, read its difficulty numbers, edit it,
 * tune the feel, export the set. */
(function (global) {
  'use strict';

  var E = global.Engine, S = global.Solver, G = global.Gen, F = global.Feel;
  var PT = global.Playtest, T = global.Tuner;
  var REV = 'REV';

  var PALETTE = Object.assign({}, global.LevelData.palette);
  var levels = JSON.parse(JSON.stringify(global.LevelData.levels));
  var idx = 0;
  var state = null;
  var history = [];
  var analysisCache = {};        // level index -> analysis
  var brush = 'yellow';
  var busy = false;
  var autoTimer = null;

  var $ = function (id) { return document.getElementById(id); };
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }
  function el(tag, cls, parent, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }
  function pct(x) { return x == null ? '—' : Math.round(x * 100) + '%'; }
  function colorHex(name) { return name === REV ? '#3a4050' : (PALETTE[name] || '#888'); }
  function level() { return levels[idx]; }

  /* ---------------- board ---------------- */

  var stage = $('stage');
  var overlays = Array.prototype.slice.call(stage.querySelectorAll('.overlay'));
  var renderer = new global.Renderer(stage, {
    palette: PALETTE,
    onTapColumn: function (c) { tapColumn(c); }
  });
  overlays.forEach(function (o) { stage.appendChild(o); });

  function loadLevel(i) {
    if (i < 0 || i >= levels.length) return;
    idx = i;
    lastMeasure = null;
    stopAutoplay();
    var v = E.validate(level());
    if (!v.ok) {
      state = null;
      renderTop();
      renderEditor();
      renderPlayMetrics(null);
      $('moveLog').textContent = 'Level không hợp lệ:\n- ' + v.errors.join('\n- ');
      return;
    }
    state = E.createState(level());
    history = [];
    stage.className = 'stage theme-' + (level().theme || 'city');
    overlays.forEach(function (o) { stage.appendChild(o); });
    renderer.render(state);
    renderTop();
    renderEditor();
    renderPlayMetrics(analysisCache[idx]);
    logMoves();
  }

  function tapColumn(c) {
    if (busy || !state || state.status !== 'playing') return;
    if (state.locked[c]) { renderer.flashColumn(c, 'bad'); F.Sfx.invalid(); return; }
    history.push(E.cloneState(state));
    if (history.length > 200) history.shift();
    var ev = E.applyMove(state, c);
    if (!ev) return;
    busy = true;
    renderer.animateMove(state, ev, function () {
      setTimeout(function () { busy = false; }, F.get('inputLock'));
    });
    renderTop();
    logMoves(ev);
  }

  function restart() { loadLevel(idx); }

  function undo() {
    stopAutoplay();
    if (!history.length) return;
    state = history.pop();
    renderer.render(state);
    renderTop();
    logMoves();
  }

  function hint() {
    if (!state || state.status !== 'playing') return;
    var r = S.solve(state, { nodeCap: 150000 });
    if (r.solved && r.moves.length) {
      renderer.flashColumn(r.moves[0], 'hint');
      note('hint: cột ' + (r.moves[0] + 1) + ', còn ' + r.moves.length + ' move tối ưu');
    } else {
      var g = S.greedySolve(state, false);
      if (g.won && g.moves.length) {
        renderer.flashColumn(g.moves[0], 'hint');
        note('hint (greedy, solver hết node): cột ' + (g.moves[0] + 1));
      } else note('không tìm được lời giải từ thế này');
    }
  }

  function stopAutoplay() {
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
    $('autoplay').textContent = 'Autoplay';
  }

  function autoplay() {
    if (autoTimer) { stopAutoplay(); return; }
    if (!state) return;
    var r = S.solve(state, { nodeCap: 250000 });
    var moves = r.solved ? r.moves : (S.greedySolve(state, false).moves || []);
    if (!moves.length) { note('không có lời giải để autoplay'); return; }
    $('autoplay').textContent = 'Stop';
    var i = 0;
    (function step() {
      if (i >= moves.length || !state || state.status !== 'playing') { stopAutoplay(); return; }
      tapColumn(moves[i++]);
      autoTimer = setTimeout(step, F.moveDuration(true, state.rows) + F.get('inputLock') + 90);
    })();
  }

  function note(msg) {
    var log = $('moveLog');
    log.textContent = msg + '\n' + log.textContent;
  }

  function logMoves(ev) {
    if (!state) return;
    var parts = [];
    parts.push('moves ' + state.movesUsed + '/' + state.budget +
               '   pad: ' + state.pad.color +
               '   xong ' + state.locked.filter(Boolean).length + '/' + state.cols + ' cột');
    if (ev) {
      parts.push('tap cột ' + (ev.col + 1) + ' — chèn ' + ev.inserted.color + ', văng ra ' + ev.ejected.color +
                 (ev.completed.length ? '  ✅ cột ' + ev.completed.map(function (c) { return c + 1; }).join(',') : '') +
                 (ev.autoSorted.length ? '  ↧ auto-sort cột ' + ev.autoSorted.map(function (m) { return m.col + 1; }).join(',') : ''));
    }
    var good = S.goodColumns(state, true).map(function (c) { return c + 1; });
    parts.push('cột nhận được xe trên pad (theo mắt player): ' + (good.length ? good.join(', ') : 'không có → phải đổ bừa'));
    $('moveLog').textContent = parts.join('\n');
  }

  function renderTop() {
    var L = level();
    $('lvName').textContent = L.id != null ? L.id : (idx + 1);
    $('lvCount').textContent = '(' + (idx + 1) + '/' + levels.length + ')';
    $('sizeBadge').textContent = L.cols + '×' + L.rows;
    var mb = $('movesBadge');
    if (state) {
      mb.innerHTML = 'Moves <b>' + state.movesLeft + '</b> / ' + state.budget;
      mb.className = 'badge' + (state.movesLeft <= 3 ? ' warn' : '');
      var sb = $('statusBadge');
      sb.textContent = state.status;
      sb.className = 'badge ' + (state.status === 'won' ? 'good' : state.status === 'lost' ? 'bad' : '');
    } else {
      mb.innerHTML = 'Moves <b>—</b>';
      $('statusBadge').textContent = 'invalid';
      $('statusBadge').className = 'badge bad';
    }
    $('prevLv').disabled = idx === 0;
    $('nextLv').disabled = idx === levels.length - 1;
  }

  /* ---------------- metrics ---------------- */

  function metricCard(parent, key, value, note, cls) {
    var m = el('div', 'metric' + (cls ? ' ' + cls : ''), parent);
    el('div', 'k', m, key);
    el('div', 'v', m, value);
    if (note) el('div', 'n', m, note);
  }

  function slackClass(s) {
    if (s == null) return '';
    if (s < 1.15) return 'bad';
    if (s < 1.35 || s > 3) return 'warn';
    return 'good';
  }
  function naiveClass(w) {
    if (w == null) return '';
    if (w > 0.97) return 'bad';
    if (w > 0.9) return 'warn';
    return 'good';
  }
  function choiceClass(c) {
    if (c == null) return '';
    if (c < 0.1) return 'bad';
    if (c < 0.25) return 'warn';
    return 'good';
  }

  function renderPlayMetrics(a) {
    var box = clear($('playMetrics'));
    var L = level();
    metricCard(box, 'grid', L.cols + '×' + L.rows, (L.cols * L.rows + 1) + ' xe');
    metricCard(box, 'budget', String(L.moves));
    var v = E.validate(L);
    metricCard(box, 'màu', String(Object.keys(v.counts || {}).filter(function (k) { return k !== REV; }).length),
               v.hidden ? v.hidden + ' xe ẩn' : 'không xe ẩn');
    if (!a) {
      metricCard(box, 'phân tích', '—', 'bấm Analyze ở tab Tune');
      return;
    }
    metricCard(box, 'minMoves', String(a.minMoves) + (a.exact ? '' : '~'), a.exact ? 'tối ưu' : 'greedy (chưa chắc tối ưu)');
    metricCard(box, 'slack', a.slack ? a.slack.toFixed(1) + 'x' : '—', 'budget / minMoves', slackClass(a.slack));
    metricCard(box, 'forced', pct(a.forcedRatio), 'không có lựa chọn');
    metricCard(box, 'choice', pct(a.choiceRatio), '≥2 cột nhận được', choiceClass(a.choiceRatio));
    metricCard(box, 'dump', pct(a.dumpRatio), 'buộc đổ bừa');
    metricCard(box, 'naiveWin', pct(a.naive.winRate), 'player bấm greedy', naiveClass(a.naive.winRate));
  }

  function analyzeCurrent() {
    var L = level();
    var v = E.validate(L);
    if (!v.ok) { renderTuneFlags(null, v); return; }
    var btn = $('analyze');
    btn.disabled = true; btn.textContent = 'đang chạy…';
    setTimeout(function () {
      var a = S.analyze(L, {
        nodeCap: +$('nodeCap').value || 300000,
        runs: +$('runs').value || 300,
        eps: +$('eps').value || 0,
        seed: 12345
      });
      analysisCache[idx] = a;
      renderTuneMetrics(a);
      renderTuneFlags(a, v);
      renderPlayMetrics(a);
      $('solutionLog').textContent = a.solution
        ? 'dài ' + a.solution.length + ' move' + (a.exact ? ' (tối ưu)' : ' (greedy)') +
          '\ncột: ' + a.solution.map(function (c) { return c + 1; }).join(' → ') +
          '\nnodes ' + a.nodes + ', ' + a.solveMs + 'ms'
        : 'không tìm được lời giải (nodes ' + a.nodes + ')';
      btn.disabled = false; btn.textContent = 'Analyze level này';
      renderSetTable();
    }, 20);
  }

  function renderTuneMetrics(a) {
    var box = clear($('tuneMetrics'));
    if (!a) return;
    metricCard(box, 'minMoves', String(a.minMoves) + (a.exact ? '' : '~'), a.exact ? 'IDA* tối ưu' : 'greedy upper bound');
    metricCard(box, 'budget', String(a.budget));
    metricCard(box, 'slack', a.slack ? a.slack.toFixed(2) + 'x' : '—', 'budget / minMoves', slackClass(a.slack));
    metricCard(box, 'forced', pct(a.forcedRatio), null);
    metricCard(box, 'choice', pct(a.choiceRatio), 'quyết định thật', choiceClass(a.choiceRatio));
    metricCard(box, 'dump', pct(a.dumpRatio), 'đổ bừa');
    metricCard(box, 'branch', a.branchFactor ? a.branchFactor.toFixed(1) : '—', 'cột hợp lệ / lượt');
    metricCard(box, 'naiveWin', pct(a.naive.winRate), a.naive.runs + ' playout', naiveClass(a.naive.winRate));
    metricCard(box, 'hết moves', pct(a.naive.outOfMoves), 'player thua vì hết move');
    metricCard(box, 'naive moves', a.naive.avgMoves ? a.naive.avgMoves.toFixed(1) : '—', 'khi thắng');
    metricCard(box, 'xe ẩn', String(a.hidden));
    if (a.trap) {
      metricCard(box, 'trap', a.trap.avgExtraMoves == null ? '—' : '+' + a.trap.avgExtraMoves.toFixed(1),
                 'move phí khi tap sai (' + a.trap.samples + ' mẫu)');
    }
  }

  function renderTuneFlags(a, v) {
    var box = clear($('tuneFlags'));
    if (v && !v.ok) {
      v.errors.forEach(function (e) { el('div', 'flag bad', box, '✖ ' + e); });
      return;
    }
    if (!a) { el('div', 'flag', box, 'chưa analyze'); return; }
    var f = [];
    if (a.unsolvable) f.push(['bad', 'Level không giải được.']);
    if (a.slack != null) {
      if (a.slack > 3) f.push(['bad', 'slack ' + a.slack.toFixed(1) + 'x — budget quá thoải mái, move count không tạo áp lực. Đặt ' +
        Math.ceil(a.minMoves * 1.6) + ' thay vì ' + a.budget + '.']);
      else if (a.slack < 1.15) f.push(['warn', 'slack ' + a.slack.toFixed(2) + 'x — gần như phải đi tối ưu tuyệt đối mới thắng.']);
      else f.push(['good', 'slack ' + a.slack.toFixed(2) + 'x hợp lý.']);
    }
    if (a.choiceRatio != null) {
      if (a.choiceRatio < 0.1) f.push(['bad', 'choice ' + pct(a.choiceRatio) +
        ' — chuỗi cưỡng bức, player chỉ đi theo xe văng ra. Thêm 2 cột cùng màu, hoặc cột có ≥2 xe lạ.']);
      else if (a.choiceRatio < 0.25) f.push(['warn', 'choice ' + pct(a.choiceRatio) + ' — vẫn còn ít quyết định thật.']);
      else f.push(['good', 'choice ' + pct(a.choiceRatio) + ' — có puzzle thật.']);
    }
    if (a.naive.winRate > 0.97) f.push(['bad', 'naiveWin ' + pct(a.naive.winRate) + ' — player bấm bừa cũng thắng.']);
    else if (a.naive.winRate < 0.35) f.push(['warn', 'naiveWin ' + pct(a.naive.winRate) + ' — có thể quá gắt cho level đầu.']);
    else f.push(['good', 'naiveWin ' + pct(a.naive.winRate) + ' — có tỉ lệ fail thật.']);
    if (a.hidden && a.hidden / (a.cols * a.rows) > 0.3) {
      f.push(['warn', 'xe ẩn chiếm ' + pct(a.hidden / (a.cols * a.rows)) + ' bàn — player mất khả năng lập kế hoạch.']);
    }
    if (!a.exact) f.push(['warn', 'solver hết node cap, minMoves là chặn trên từ greedy chứ chưa chắc tối ưu.']);
    f.forEach(function (x) { el('div', 'flag ' + x[0], box, x[1]); });
  }

  /* ---------------- difficulty tuner ---------------- */

  var lastMeasure = null;

  function bandClass(d) {
    if (d == null) return '';
    if (d < 20) return 'bad';           // nobody can lose this
    if (d > 70) return 'warn';
    return 'good';
  }

  function renderTunerScore(m) {
    var box = clear($('tunerScore'));
    if (!m || !m.valid) { metricCard(box, 'độ khó', '—', 'level chưa hợp lệ'); return; }
    metricCard(box, 'độ khó', String(m.D), '0 = ai cũng thắng, 100 = gần như thua', bandClass(m.D));
    metricCard(box, 'độ sâu', String(m.depth), '% lượt có quyết định thật', m.depth < 10 ? 'bad' : m.depth < 25 ? 'warn' : 'good');
    metricCard(box, 'win — giỏi', pct(m.winCareful), 'lỗi tay 2%');
    metricCard(box, 'win — trung bình', pct(m.winAvg), 'lỗi tay 10%', naiveClass(m.winAvg));
    metricCard(box, 'win — ẩu', pct(m.winSloppy), 'lỗi tay 25%');
    metricCard(box, 'slack', m.slack ? m.slack.toFixed(2) + 'x' : '—', 'budget / lời giải thực tế', slackClass(m.slack));
    metricCard(box, 'xe lạ', String(m.strays), 'xe không nằm đúng cột màu của nó');
    metricCard(box, 'màu / cột', m.colors + ' / ' + level().cols,
               m.colors < level().cols ? 'có cột trùng màu → có lựa chọn' : 'mỗi màu 1 cột → chuỗi ép');
  }

  function measureCurrent() {
    var v = E.validate(level());
    if (!v.ok) { lastMeasure = null; renderTunerScore(null); return null; }
    lastMeasure = T.measure(level(), 900);
    renderTunerScore(lastMeasure);
    return lastMeasure;
  }

  function askSuggestions(dir) {
    var v = E.validate(level());
    if (!v.ok) { note('level chưa hợp lệ'); return; }
    var box = clear($('suggestions'));
    el('div', 'hint', box, 'đang playtest từng phương án…');
    $('wantHarder').disabled = $('wantEasier').disabled = true;
    T.suggest(level(), dir, PALETTE, { runs: +$('suggestRuns').value || 900 },
      function (i, n) { $('suggestProgress').textContent = i + '/' + n; },
      function (res) {
        $('wantHarder').disabled = $('wantEasier').disabled = false;
        $('suggestProgress').textContent = '';
        lastMeasure = res.base;
        renderTunerScore(res.base);
        renderSuggestions(res);
      });
  }

  function renderSuggestions(res) {
    var box = clear($('suggestions'));
    if (!res.items.length) { el('div', 'hint', box, 'không có phương án nào áp dụng được'); return; }
    el('div', 'hint', box, 'Xếp theo tác động ĐO ĐƯỢC lên độ khó, không phải phỏng đoán — mỗi phương án được playtest thật. ' +
      'Δkhó là tỉ lệ thua, Δsâu là số quyết định. Hai trục này đi ngược nhau khá thường xuyên.');
    res.items.forEach(function (item) {
      var card = el('div', 'card', box);
      var head = el('div', 'row', card);
      head.style.marginBottom = '4px';
      var dK = el('span', 'badge ' + (item.delta > 0 ? 'bad' : item.delta < 0 ? 'good' : ''), head,
                  (item.delta > 0 ? '+' : '') + item.delta + ' khó');
      var dD = el('span', 'badge ' + (item.deltaDepth > 0 ? 'good' : item.deltaDepth < 0 ? 'warn' : ''), head,
                  (item.deltaDepth > 0 ? '+' : '') + item.deltaDepth + ' sâu');
      el('b', null, head, item.lever);
      var apply = el('button', 'primary', head, 'Áp dụng');
      apply.addEventListener('click', function () {
        levels[idx] = item.level;
        analysisCache = {};
        afterEdit();
        renderSetTable();
        measureCurrent();
        note('đã áp dụng: ' + item.label);
      });
      el('div', null, card, item.label);
      el('div', 'hint', card, item.why);
      el('div', 'hint', card,
        'sau khi áp dụng: win giỏi ' + pct(item.measure.winCareful) +
        ' · trung bình ' + pct(item.measure.winAvg) +
        ' · ẩu ' + pct(item.measure.winSloppy) +
        ' · slack ' + (item.measure.slack ? item.measure.slack.toFixed(2) + 'x' : '—') +
        ' · budget ' + item.level.moves);
    });
  }

  /* ---------------- 10k playtest ---------------- */

  var lastPt = null;

  var ptWorker = null;
  function getWorker() {
    if (ptWorker !== null) return ptWorker;
    try { ptWorker = new Worker('src/playtest-worker.js'); }
    catch (e) { ptWorker = false; }          // file:// blocks workers — fall back
    return ptWorker;
  }

  function runPlaytest() {
    var v = E.validate(level());
    if (!v.ok) { note('level chưa hợp lệ'); return; }
    var btn = $('runPlaytest');
    btn.disabled = true;
    clear($('ptSummary')); clear($('ptCurve')); clear($('ptHist')); clear($('ptFlags'));
    var L = JSON.parse(JSON.stringify(level()));
    var runs = +$('ptRuns').value || 10000;
    var opts = { blind: $('ptBlind').checked, seed: 4242 };
    $('ptProgress').textContent = 'đang chạy…';

    var w = getWorker();
    if (w) {
      w.onmessage = function (e) {
        btn.disabled = false;
        if (!e.data.ok) { $('ptProgress').textContent = 'lỗi: ' + e.data.error; return; }
        $('ptProgress').textContent = e.data.report.ms + 'ms';
        lastPt = e.data.report;
        renderPlaytest(e.data.report);
      };
      w.onerror = function (err) {
        ptWorker = false;                    // retry on the main thread
        w.terminate();
        btn.disabled = false;
        note('worker lỗi (' + err.message + '), chạy trên main thread');
        runPlaytest();
      };
      w.postMessage({ cmd: 'run', level: L, runs: runs, opts: opts });
      return;
    }

    setTimeout(function () {
      var t0 = Date.now();
      var res = PT.runSync(L, runs, opts);
      var rep = {
        level: { id: L.id, cols: L.cols, rows: L.rows, moves: L.moves },
        ms: Date.now() - t0, totalRuns: res.totalRuns, profiles: res.profiles
      };
      btn.disabled = false;
      $('ptProgress').textContent = rep.ms + 'ms';
      lastPt = rep;
      renderPlaytest(rep);
    }, 20);
  }

  function renderPlaytest(rep) {
    var box = clear($('ptSummary'));
    var t = el('table', 'grid', box);
    var hr = el('tr', null, el('thead', null, t));
    ['player', 'lỗi tay', 'win @ budget ' + rep.level.moves, 'trần win', 'p50', 'p90', 'budget 90%', 'budget 75%', 'budget 60%'].forEach(function (h) { el('th', null, hr, h); });
    var tb = el('tbody', null, t);
    rep.profiles.forEach(function (p) {
      var tr = el('tr', null, tb);
      tr.style.cursor = 'default';
      el('td', null, tr, p.name);
      el('td', null, tr, Math.round(p.eps * 100) + '%');
      el('td', naiveClass(p.winRateAtBudget) ? 'f-' + naiveClass(p.winRateAtBudget) : '', tr, pct(p.winRateAtBudget));
      el('td', null, tr, pct(p.ceiling));
      el('td', null, tr, String(p.p[0.5] == null ? '—' : p.p[0.5]));
      el('td', null, tr, String(p.p[0.9] == null ? '—' : p.p[0.9]));
      el('td', null, tr, String(p.budgetFor[90] == null ? 'không đạt' : p.budgetFor[90]));
      el('td', null, tr, String(p.budgetFor[75] == null ? 'không đạt' : p.budgetFor[75]));
      el('td', null, tr, String(p.budgetFor[60] == null ? 'không đạt' : p.budgetFor[60]));
    });

    renderPtCurve(rep);
    renderPtHist(rep);

    var f = clear($('ptFlags'));
    var avg = rep.profiles[1];
    if (avg.winRateAtBudget > 0.97) {
      f.appendChild(mkFlag('bad', 'Budget ' + rep.level.moves + ' cho win ' + pct(avg.winRateAtBudget) +
        ' — move count không phải là cơ chế ở level này. Muốn 75% thì đặt ' + avg.budgetFor[75] + '.'));
    } else if (avg.winRateAtBudget < 0.4) {
      f.appendChild(mkFlag('warn', 'Win chỉ ' + pct(avg.winRateAtBudget) + ' — gắt. Budget cho 75% là ' + avg.budgetFor[75] + '.'));
    } else {
      f.appendChild(mkFlag('good', 'Win ' + pct(avg.winRateAtBudget) + ' ở budget ' + rep.level.moves + ' — vùng hợp lý.'));
    }
    if (avg.ceiling < 0.99) {
      f.appendChild(mkFlag('warn', pct(1 - avg.ceiling) + ' lượt chơi không bao giờ thắng dù budget vô hạn — ' +
        'player greedy tự dồn mình vào thế kẹt. Trung bình xong ' +
        (avg.avgColumnsOnStuck == null ? '?' : avg.avgColumnsOnStuck.toFixed(1)) + '/' + rep.level.cols + ' cột trước khi bí.'));
    }
    var spread = rep.profiles[0].winRateAtBudget - rep.profiles[2].winRateAtBudget;
    f.appendChild(mkFlag(spread > 0.3 ? 'good' : 'warn',
      'Chênh lệch giỏi vs ẩu: ' + pct(spread) + (spread > 0.3 ? ' — kỹ năng có thưởng.' : ' — kỹ năng gần như không ăn thua.')));
    var dumps = avg.avgDumps;
    f.appendChild(mkFlag('', 'Trung bình ' + dumps.toFixed(1) + ' lượt/ván không có cột nào nhận được xe trên pad (phải đổ bừa), ' +
      'và ' + avg.avgGoodColumns.toFixed(2) + ' cột nhận được mỗi lượt.'));
  }

  function mkFlag(cls, text) {
    var d = document.createElement('div');
    d.className = 'flag' + (cls ? ' ' + cls : '');
    d.textContent = text;
    return d;
  }

  function renderPtCurve(rep) {
    var box = clear($('ptCurve'));
    var W = 660, H = 220, padL = 40, padB = 26, padT = 10;
    var maxB = Math.max.apply(null, rep.profiles.map(function (p) { return p.maxBudget; }));
    var colors = ['#4ec97a', '#4a90d9', '#e05c4c'];
    function X(b) { return padL + (b / maxB) * (W - padL - 12); }
    function Y(w) { return padT + (1 - w) * (H - padT - padB); }
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto">';
    svg += '<rect width="' + W + '" height="' + H + '" fill="#10131a" rx="8"/>';
    [0.25, 0.5, 0.6, 0.75, 0.9].forEach(function (w) {
      svg += '<line x1="' + padL + '" y1="' + Y(w) + '" x2="' + (W - 12) + '" y2="' + Y(w) +
             '" stroke="#2b3140" stroke-width="1"/>' +
             '<text x="6" y="' + (Y(w) + 3) + '" fill="#93a0b3" font-size="9">' + Math.round(w * 100) + '%</text>';
    });
    rep.profiles.forEach(function (p, i) {
      var pts = p.curve.filter(function (_, j) { return j % 1 === 0; })
        .map(function (c) { return X(c.budget) + ',' + Y(c.winRate); });
      svg += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + colors[i] + '" stroke-width="2"/>';
    });
    var bx = X(rep.level.moves);
    svg += '<line x1="' + bx + '" y1="' + padT + '" x2="' + bx + '" y2="' + (H - padB) +
           '" stroke="#e8b13a" stroke-width="2" stroke-dasharray="4 3"/>';
    svg += '<text x="' + (bx + 4) + '" y="' + (padT + 11) + '" fill="#e8b13a" font-size="10">budget ' + rep.level.moves + '</text>';
    svg += '<text x="' + padL + '" y="' + (H - 8) + '" fill="#93a0b3" font-size="9">0 move</text>';
    svg += '<text x="' + (W - 60) + '" y="' + (H - 8) + '" fill="#93a0b3" font-size="9">' + maxB + ' move</text>';
    svg += '</svg>';
    box.innerHTML = svg;
    var legend = el('div', 'hint', box, '');
    rep.profiles.forEach(function (p, i) {
      var sp = el('span', null, legend, '■ ' + p.name + '  ');
      sp.style.color = colors[i];
    });
    el('span', null, legend, ' — kẻ vàng là budget đang đặt. Đọc: kéo dọc theo đường tới win rate muốn, rồi nhìn xuống trục để lấy budget.');
  }

  function renderPtHist(rep) {
    var box = clear($('ptHist'));
    var p = rep.profiles[1];
    var keys = Object.keys(p.histogram).map(Number).sort(function (a, b) { return a - b; });
    if (!keys.length) { el('div', 'hint', box, 'không có ván nào thắng'); return; }
    var lo = keys[0], hi = keys[keys.length - 1];
    var maxN = Math.max.apply(null, keys.map(function (k) { return p.histogram[k]; }));
    var W = 660, H = 120, padB = 18;
    var bw = (W - 10) / (hi - lo + 1);
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto">';
    svg += '<rect width="' + W + '" height="' + H + '" fill="#10131a" rx="8"/>';
    for (var k = lo; k <= hi; k++) {
      var n = p.histogram[k] || 0;
      var h = (H - padB - 6) * (n / maxN);
      var x = 5 + (k - lo) * bw;
      var over = k > rep.level.moves;
      svg += '<rect x="' + x + '" y="' + (H - padB - h) + '" width="' + Math.max(1, bw - 1) +
             '" height="' + h + '" fill="' + (over ? '#e05c4c' : '#4a90d9') + '"/>';
    }
    var bx2 = 5 + (rep.level.moves - lo + 1) * bw;
    if (rep.level.moves >= lo && rep.level.moves <= hi) {
      svg += '<line x1="' + bx2 + '" y1="0" x2="' + bx2 + '" y2="' + (H - padB) + '" stroke="#e8b13a" stroke-width="2"/>';
    }
    svg += '<text x="5" y="' + (H - 5) + '" fill="#93a0b3" font-size="9">' + lo + '</text>';
    svg += '<text x="' + (W - 30) + '" y="' + (H - 5) + '" fill="#93a0b3" font-size="9">' + hi + '</text>';
    svg += '</svg>';
    box.innerHTML = svg;
    el('div', 'hint', box, 'player trung bình. Cột đỏ = số ván cần nhiều move hơn budget hiện tại, tức là thua.');
  }

  /* ---------------- editor ---------------- */

  function renderBrushes() {
    var box = clear($('brushes'));
    Object.keys(PALETTE).forEach(function (name) {
      var b = el('div', 'sw' + (brush === name ? ' on' : ''), box);
      b.style.background = PALETTE[name];
      b.title = name;
      b.addEventListener('click', function () { brush = name; renderBrushes(); });
    });
    var r = el('div', 'sw rev' + (brush === REV ? ' on' : ''), box);
    r.title = 'xe ngược chiều';
    r.addEventListener('click', function () { brush = REV; renderBrushes(); });
  }

  function cellNode(spec, onPaint, onToggle) {
    var hidden = String(spec).charAt(0) === '?';
    var color = hidden ? String(spec).slice(1) : String(spec);
    var n = el('div', 'editCell' + (hidden ? ' hid' : '') + (color === REV ? ' rev' : ''));
    if (color !== REV) n.style.background = colorHex(color);
    n.title = color + (hidden ? ' (ẩn)' : '');
    n.addEventListener('click', onPaint);
    n.addEventListener('contextmenu', function (e) { e.preventDefault(); onToggle(); });
    return n;
  }

  function renderEditor() {
    var L = level();
    $('edCols').value = L.cols; $('edRows').value = L.rows;
    $('edMoves').value = L.moves; $('edTheme').value = L.theme || 'city';

    var wrap = clear($('editGrid'));
    var g = el('div', 'editGrid', wrap);
    g.style.gridTemplateColumns = 'repeat(' + L.cols + ', 30px)';
    for (var r = 0; r < L.rows; r++) {
      for (var c = 0; c < L.cols; c++) {
        g.appendChild(cellNode(L.grid[c][r], paint(c, r), toggleHidden(c, r)));
      }
    }
    var pad = clear($('padCell'));
    pad.appendChild(cellNode(L.pad, paintPad, togglePadHidden));
    renderCounts();
  }

  function paint(c, r) {
    return function () {
      var L = level();
      L.grid[c][r] = ($('brushHidden').checked && brush !== REV ? '?' : '') + brush;
      afterEdit();
    };
  }
  function toggleHidden(c, r) {
    return function () {
      var L = level(), s = String(L.grid[c][r]);
      L.grid[c][r] = s.charAt(0) === '?' ? s.slice(1) : '?' + s;
      afterEdit();
    };
  }
  function paintPad() {
    level().pad = ($('brushHidden').checked && brush !== REV ? '?' : '') + brush;
    afterEdit();
  }
  function togglePadHidden() {
    var s = String(level().pad);
    level().pad = s.charAt(0) === '?' ? s.slice(1) : '?' + s;
    afterEdit();
  }

  function afterEdit() {
    lastMeasure = null;
    delete analysisCache[idx];
    loadLevel(idx);
    renderTuneMetrics(null);
    renderTuneFlags(null, E.validate(level()));
    $('solutionLog').textContent = 'level đã đổi — analyze lại';
  }

  function renderCounts() {
    var L = level(), v = E.validate(L);
    var box = clear($('counts'));
    var counts = v.counts || {};
    Object.keys(counts).sort().forEach(function (k) {
      var n = counts[k];
      var bad = k !== REV && n % L.rows !== 0 && (n - 1) % L.rows !== 0;
      var pill = el('div', 'countPill' + (bad ? ' bad' : ''), box);
      var sw = el('i', null, pill);
      sw.style.background = colorHex(k);
      el('span', null, pill, k + ' ' + n + (k === REV ? '' : ' (' + (n / L.rows).toFixed(2).replace('.00', '') + ' cột)'));
    });
    var fl = clear($('editFlags'));
    if (v.ok) {
      el('div', 'flag good', fl, '✔ hợp lệ — ' + v.total + ' xe = ' + L.cols + '×' + L.rows + '+1, xe kết thúc trên pad có thể là: ' + v.padCandidates.join(', '));
    } else {
      v.errors.forEach(function (e) { el('div', 'flag bad', fl, '✖ ' + e); });
      el('div', 'flag warn', fl, 'quy tắc: tổng xe = cols×rows+1; mỗi màu phải đủ bội số của rows (' + L.rows + ') sau khi để lại đúng 1 xe trên pad.');
    }
  }

  function resizeLevel(cols, rows) {
    var L = level(), grid = [];
    var fill = Object.keys(PALETTE)[0];
    for (var c = 0; c < cols; c++) {
      grid[c] = [];
      for (var r = 0; r < rows; r++) {
        grid[c][r] = (L.grid[c] && L.grid[c][r] != null) ? L.grid[c][r] : fill;
      }
    }
    L.cols = cols; L.rows = rows; L.grid = grid;
    afterEdit();
  }

  function generateInto() {
    var L = level();
    var names = Object.keys(PALETTE).slice(0, Math.max(1, +$('genColors').value || 4));
    var lv = G.generate({
      cols: L.cols, rows: L.rows, colors: names,
      strays: +$('genStrays').value || 0,
      hidden: +$('genHidden').value || 0,
      revInGrid: $('genRevInGrid').checked,
      seed: +$('genSeed').value || 1
    });
    var ab = G.autoBudget(lv, +$('slackTarget').value || 1.6, 200000);
    L.grid = lv.grid; L.pad = lv.pad;
    L.moves = ab ? ab.budget : L.moves;
    afterEdit();
    note(ab ? ('generated: minMoves ' + ab.minMoves + (ab.exact ? '' : '~') + ', budget ' + ab.budget)
            : 'generated (không đo được minMoves)');
  }

  /* ---------------- feel ---------------- */

  function renderFeel() {
    var box = clear($('feelSliders'));
    F.SLIDERS.forEach(function (def) {
      var key = def[0], label = def[1], min = def[2], max = def[3], step = def[4], unit = def[5];
      var row = el('div', 'slider', box);
      el('label', null, row, label);
      if (unit === 'ease') {
        var sel = el('select', null, row);
        Object.keys(F.EASINGS).forEach(function (name) {
          var o = el('option', null, sel, name);
          o.value = name;
        });
        sel.value = F.get(key);
        sel.addEventListener('change', function () { F.set(key, sel.value); syncFeelJson(); });
        el('output', null, row, '');
      } else {
        var input = el('input', null, row);
        input.type = 'range'; input.min = min; input.max = max; input.step = step;
        input.value = F.get(key);
        var out = el('output', null, row, F.get(key) + unit);
        input.addEventListener('input', function () {
          var v = parseFloat(input.value);
          F.set(key, v);
          out.textContent = v + unit;
          if (key === 'carScale' || key === 'cellGap' || key === 'shadowStrength') {
            if (state) renderer.render(state);
          }
          syncFeelJson();
        });
      }
    });
    var sel = clear($('feelPreset'));
    Object.keys(F.PRESETS).forEach(function (name) {
      var o = el('option', null, sel, name);
      o.value = name;
    });
    syncFeelJson();
  }

  function syncFeelJson() { $('feelJson').value = JSON.stringify(F.toJSON(), null, 2); }

  /* ---------------- level set ---------------- */

  function renderSetTable() {
    var t = clear($('setTable'));
    var head = el('thead', null, t), hr = el('tr', null, head);
    ['lv', 'size', 'màu', 'ẩn', 'budget', 'min', 'slack', 'forced', 'choice', 'dump', 'naiveWin'].forEach(function (h) {
      el('th', null, hr, h);
    });
    var body = el('tbody', null, t);
    levels.forEach(function (L, i) {
      var a = analysisCache[i], v = E.validate(L);
      var tr = el('tr', i === idx ? 'on' : '', body);
      tr.addEventListener('click', function () { loadLevel(i); renderSetTable(); });
      el('td', null, tr, (L.id != null ? L.id : i + 1) + (v.ok ? '' : ' ✖'));
      el('td', null, tr, L.cols + '×' + L.rows);
      el('td', null, tr, String(Object.keys(v.counts || {}).filter(function (k) { return k !== REV; }).length));
      el('td', null, tr, String(v.hidden || 0));
      el('td', null, tr, String(L.moves));
      if (!a) { var td = el('td', null, tr, '—'); td.colSpan = 5; return; }
      el('td', null, tr, String(a.minMoves) + (a.exact ? '' : '~'));
      el('td', slackClass(a.slack) ? 'f-' + slackClass(a.slack) : '', tr, a.slack ? a.slack.toFixed(1) + 'x' : '—');
      el('td', null, tr, pct(a.forcedRatio));
      el('td', choiceClass(a.choiceRatio) ? 'f-' + choiceClass(a.choiceRatio) : '', tr, pct(a.choiceRatio));
      el('td', null, tr, pct(a.dumpRatio));
      el('td', naiveClass(a.naive.winRate) ? 'f-' + naiveClass(a.naive.winRate) : '', tr, pct(a.naive.winRate));
    });
    renderCurve();
  }

  function renderCurve() {
    var box = clear($('curve'));
    var have = levels.map(function (L, i) { return analysisCache[i]; });
    if (!have.some(Boolean)) { el('div', 'hint', box, 'chạy Analyze cả set để thấy curve'); return; }
    var W = 640, H = 170, padL = 34, padB = 22, n = levels.length;
    var maxMin = Math.max.apply(null, have.map(function (a) { return a && a.minMoves || 0; }).concat([1]));
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto">';
    svg += '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#10131a" rx="8"/>';
    var bw = (W - padL - 10) / n;
    for (var i = 0; i < n; i++) {
      var a = have[i], x = padL + i * bw;
      if (a && a.minMoves) {
        var h = (H - padB - 12) * (a.minMoves / maxMin);
        svg += '<rect x="' + (x + bw * 0.18) + '" y="' + (H - padB - h) + '" width="' + (bw * 0.34) +
               '" height="' + h + '" fill="#4a90d9" rx="2"/>';
      }
      svg += '<text x="' + (x + bw * 0.35) + '" y="' + (H - 7) + '" fill="#93a0b3" font-size="9" text-anchor="middle">' +
             (levels[i].id != null ? levels[i].id : i + 1) + '</text>';
    }
    function line(key, color, scale) {
      var pts = [];
      for (var j = 0; j < n; j++) {
        var aa = have[j];
        if (!aa) continue;
        var val = key === 'naive' ? aa.naive.winRate : aa[key];
        if (val == null) continue;
        var yy = (H - padB - 12) * (1 - Math.min(1, val / scale)) + 6;
        pts.push((padL + j * bw + bw * 0.35) + ',' + yy);
      }
      if (pts.length < 2) return '';
      return '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + color + '" stroke-width="2"/>';
    }
    svg += line('choiceRatio', '#4ec97a', 1);
    svg += line('naive', '#e05c4c', 1);
    svg += line('slack', '#e8b13a', 4);
    svg += '<text x="4" y="14" fill="#93a0b3" font-size="9">1.0</text>';
    svg += '<text x="4" y="' + (H - padB) + '" fill="#93a0b3" font-size="9">0</text>';
    svg += '</svg>';
    box.innerHTML = svg;
    el('div', 'hint', box, 'cột xanh = minMoves (scale ' + maxMin + ') · ' +
      'xanh lá = choice · đỏ = naiveWin · vàng = slack (scale 4x). ' +
      'Curve tốt: xanh lá đi lên, đỏ đi xuống, vàng phẳng quanh 1.5–2x.');
  }

  function runAll() {
    var btn = $('runAll');
    btn.disabled = true;
    var i = 0;
    (function step() {
      if (i >= levels.length) {
        btn.disabled = false; btn.textContent = 'Analyze cả set';
        renderSetTable(); renderPlayMetrics(analysisCache[idx]);
        return;
      }
      btn.textContent = 'đang chạy ' + (i + 1) + '/' + levels.length + '…';
      var L = levels[i];
      if (E.validate(L).ok) {
        analysisCache[i] = S.analyze(L, {
          nodeCap: +$('nodeCap').value || 300000,
          runs: +$('runs').value || 300,
          eps: +$('eps').value || 0,
          seed: 12345,
          trap: false
        });
      }
      i++;
      renderSetTable();
      setTimeout(step, 10);
    })();
  }

  function exportJSON() {
    var used = {};
    levels.forEach(function (L) {
      for (var c = 0; c < L.cols; c++) {
        for (var r = 0; r < L.rows; r++) {
          var s = String(L.grid[c][r]).replace(/^\?/, '');
          if (s !== REV) used[s] = 1;
        }
      }
      var p = String(L.pad).replace(/^\?/, '');
      if (p !== REV) used[p] = 1;
    });
    var pal = {};
    Object.keys(PALETTE).forEach(function (k) { if (used[k]) pal[k] = PALETTE[k]; });
    var out = {
      version: 1,
      note: 'grid[col][row], row 0 = đỉnh cột. "REV" = xe ngược chiều. "?" = xe ẩn.',
      palette: pal,
      feel: F.toJSON(),
      levels: levels.map(function (L, i) {
        var o = { id: L.id != null ? L.id : i + 1, cols: L.cols, rows: L.rows, moves: L.moves };
        if (L.theme) o.theme = L.theme;
        if (L.tutorial) o.tutorial = L.tutorial;
        if (L.unlock) o.unlock = L.unlock;
        o.pad = L.pad;
        o.grid = L.grid;
        var a = analysisCache[i];
        if (a && a.minMoves != null) {
          o.metrics = {
            minMoves: a.minMoves, exact: !!a.exact,
            slack: +(a.slack || 0).toFixed(2),
            forced: +(a.forcedRatio || 0).toFixed(3),
            choice: +(a.choiceRatio || 0).toFixed(3),
            dump: +(a.dumpRatio || 0).toFixed(3),
            naiveWinRate: +a.naive.winRate.toFixed(3)
          };
        }
        return o;
      })
    };
    $('exportJson').value = JSON.stringify(out, null, 2);
    return out;
  }

  function download() {
    var data = exportJSON();
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'car-levels.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function importJSON() {
    var txt = $('exportJson').value.trim();
    if (!txt) return;
    var data;
    try { data = JSON.parse(txt); } catch (e) { alert('JSON lỗi: ' + e.message); return; }
    if (!data.levels || !data.levels.length) { alert('không thấy mảng levels'); return; }
    if (data.palette) Object.assign(PALETTE, data.palette);
    if (data.feel) { F.load(data.feel); renderFeel(); }
    levels = data.levels;
    analysisCache = {};
    idx = 0;
    renderBrushes();
    loadLevel(0);
    renderSetTable();
  }

  /* ---------------- wiring ---------------- */

  $('prevLv').addEventListener('click', function () { loadLevel(idx - 1); renderSetTable(); });
  $('nextLv').addEventListener('click', function () { loadLevel(idx + 1); renderSetTable(); });
  $('restart').addEventListener('click', restart);
  $('undo').addEventListener('click', undo);
  $('hint').addEventListener('click', hint);
  $('autoplay').addEventListener('click', autoplay);

  $('analyze').addEventListener('click', analyzeCurrent);
  $('wantHarder').addEventListener('click', function () { askSuggestions('harder'); });
  $('wantEasier').addEventListener('click', function () { askSuggestions('easier'); });
  $('runPlaytest').addEventListener('click', runPlaytest);
  $('applyBudget').addEventListener('click', function () {
    var a = analysisCache[idx];
    if (!a || a.minMoves == null) { note('analyze trước đã'); return; }
    level().moves = Math.max(1, Math.ceil(a.minMoves * (+$('slackTarget').value || 1.6)));
    afterEdit();
    renderSetTable();
  });

  $('edCols').addEventListener('change', function () { resizeLevel(+this.value, level().rows); });
  $('edRows').addEventListener('change', function () { resizeLevel(level().cols, +this.value); });
  $('edMoves').addEventListener('change', function () { level().moves = Math.max(1, +this.value); afterEdit(); });
  $('edTheme').addEventListener('change', function () { level().theme = this.value; loadLevel(idx); });
  $('genBtn').addEventListener('click', generateInto);

  $('feelPreset').addEventListener('change', function () { F.applyPreset(this.value); renderFeel(); if (state) renderer.render(state); });
  $('feelReset').addEventListener('click', function () { F.reset(); renderFeel(); if (state) renderer.render(state); });
  $('sfxOn').addEventListener('change', function () { F.set('sfxOn', this.checked ? 1 : 0); syncFeelJson(); });
  $('useSprites').addEventListener('change', function () {
    F.set('sprites', this.checked ? 1 : 0);
    syncFeelJson();
    if (state) renderer.render(state);
  });
  $('feelLoad').addEventListener('click', function () {
    try { F.load(JSON.parse($('feelJson').value)); renderFeel(); if (state) renderer.render(state); }
    catch (e) { alert('feel JSON lỗi: ' + e.message); }
  });
  $('feelCopy').addEventListener('click', function () { $('feelJson').select(); document.execCommand('copy'); });

  $('runAll').addEventListener('click', runAll);
  $('exportBtn').addEventListener('click', exportJSON);
  $('downloadBtn').addEventListener('click', download);
  $('importBtn').addEventListener('click', importJSON);
  $('addLevel').addEventListener('click', function () {
    var L = level();
    levels.splice(idx + 1, 0, {
      id: levels.length + 1, cols: L.cols, rows: L.rows, moves: L.moves,
      theme: L.theme, pad: REV,
      grid: G.generate({ cols: L.cols, rows: L.rows, colors: Object.keys(PALETTE).slice(0, L.cols), strays: 4, seed: levels.length + 1 }).grid
    });
    analysisCache = {};
    loadLevel(idx + 1); renderSetTable();
  });
  $('dupLevel').addEventListener('click', function () {
    var copy = JSON.parse(JSON.stringify(level()));
    copy.id = levels.length + 1;
    levels.splice(idx + 1, 0, copy);
    analysisCache = {};
    loadLevel(idx + 1); renderSetTable();
  });
  $('delLevel').addEventListener('click', function () {
    if (levels.length < 2) return;
    levels.splice(idx, 1);
    analysisCache = {};
    loadLevel(Math.min(idx, levels.length - 1)); renderSetTable();
  });

  Array.prototype.forEach.call(document.querySelectorAll('#tabs button'), function (b) {
    b.addEventListener('click', function () {
      Array.prototype.forEach.call(document.querySelectorAll('#tabs button'), function (x) { x.classList.remove('on'); });
      Array.prototype.forEach.call(document.querySelectorAll('.panel'), function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      document.querySelector('.panel[data-panel="' + b.dataset.tab + '"]').classList.add('on');
      if (b.dataset.tab === 'set') renderSetTable();
      if (b.dataset.tab === 'tune' && !lastMeasure) measureCurrent();
    });
  });

  document.addEventListener('keydown', function (e) {
    if (/input|textarea|select/i.test(e.target.tagName)) return;
    if (e.key >= '1' && e.key <= '9') tapColumn(+e.key - 1);
    else if (e.key === 'r') restart();
    else if (e.key === 'u' || e.key === 'z') undo();
    else if (e.key === 'h') hint();
    else if (e.key === 'ArrowLeft') { loadLevel(idx - 1); renderSetTable(); }
    else if (e.key === 'ArrowRight') { loadLevel(idx + 1); renderSetTable(); }
  });

  var rt = null;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { if (state) renderer.render(state); }, 120);
  });

  renderBrushes();
  renderFeel();
  loadLevel(0);
  renderSetTable();
  global.CarTool = {
    levels: function () { return levels; },
    stateNow: function () { return state; },
    analysis: function () { return analysisCache; },
    load: loadLevel
  };
})(window);
