/* The tool itself: play the level, read its difficulty numbers, edit it,
 * tune the feel, export the set. */
(function (global) {
  'use strict';

  var E = global.Engine, S = global.Solver, G = global.Gen, F = global.Feel;
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
