/* The tool itself: play the level, read its difficulty numbers, edit it,
 * tune the feel, export the set. */
(function (global) {
  'use strict';

  var E = global.Engine, S = global.Solver, G = global.Gen, F = global.Feel;
  var PT = global.Playtest, T = global.Tuner, DF = global.Difficulty;
  var REV = 'REV';

  var PALETTE = Object.assign({}, global.LevelData.palette);
  var DEFAULT_TEMPLATES = global.Difficulty.toJSON();
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
  var resultNode = $('result');
  var renderer = new global.Renderer(stage, {
    palette: PALETTE,
    onTapColumn: function (c) { tapColumn(c); }
  });
  stage.appendChild(resultNode);

  /* Body shape is decoration only — the engine never sees it. Seeded by level
   * so a restart shows the same traffic, and always drawn from the full set of
   * nine so changing the "how many shapes" slider does not reshuffle the board. */
  function assignShapes(s, seed) {
    var rnd = S.mulberry32(seed), MAX = (global.Sprites && global.Sprites.MAX_SHAPES) || 9;
    for (var c = 0; c < s.cols; c++) {
      for (var r = 0; r < s.rows; r++) s.grid[c][r].shape = (rnd() * MAX) | 0;
    }
    s.pad.shape = (rnd() * MAX) | 0;
  }

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
    assignShapes(state, (level().id != null ? level().id : idx + 1) * 7919 + level().cols);
    history = [];
    stage.className = 'stage theme-' + (level().theme || 'city');
    stage.appendChild(resultNode);
    continuesUsed = 0;
    renderer.render(state);
    showResult();
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
      showResult();
    });
    renderTop();
    logMoves(ev);
  }

  function restart() { loadLevel(idx); }

  function undo() {
    stopAutoplay();
    if (!history.length) return;
    state = history.pop();
    assignShapes(state, (level().id != null ? level().id : idx + 1) * 7919 + level().cols);
    stage.classList.remove('won', 'lost');
    renderer.render(state);
    hideResult();
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

  /* ---------------- welcome ----------------
   * The tool opens with three tabs instead of six, which reads as fewer
   * features rather than a deliberate split, so the split gets explained once
   * up front. Dismissal is remembered; the Hướng dẫn button reopens it. */

  var SEEN_KEY = 'carsort.guide.v1';

  var GUIDE_HTML =
    '<b>Tool này có 2 chế độ.</b> Tách riêng để một buổi playtest không bao giờ vô tình ' +
    'thành một buổi sửa level — đó là điều kiện để các con số còn đáng tin.' +

    '<div class="card" style="margin-top:11px">' +
      '<div style="font-size:14px;font-weight:700;color:var(--ink)">▶ Test <span style="font-weight:400;color:var(--ink-dim);font-size:12px">— mặc định khi mở tool</span></div>' +
      '<div style="margin:5px 0"><b>Mục tiêu:</b> chơi thật và đọc chỉ số. Không sửa được gì, kể cả vô tình.</div>' +
      '<b>Làm được:</b>' +
      '<ul class="modal-steps">' +
        '<li>Chơi level — click cột hoặc bấm phím <b>1–9</b></li>' +
        '<li><b>Đo level này</b> → lời giải tối ưu, slack, độ sâu, win rate của 3 hạng player</li>' +
        '<li><b>Playtest</b> → chạy 10.000 ván, ra đường cong budget → win rate</li>' +
        '<li><b>Level Set</b> → bảng chỉ số cả set + curve (chỉ xem)</li>' +
      '</ul>' +
    '</div>' +

    '<div class="card">' +
      '<div style="font-size:14px;font-weight:700;color:var(--ink)">⚙ Level Design</div>' +
      '<div style="margin:5px 0"><b>Mục tiêu:</b> sửa level và cân độ khó.</div>' +
      '<b>Thêm 3 tab:</b>' +
      '<ul class="modal-steps">' +
        '<li><b>Tune</b> → 4 template độ khó (Tập lái · Giờ cao điểm · Bãi chật · Giờ đêm), ' +
            'và gợi ý khó/dễ hơn — mỗi phương án được playtest thật rồi xếp theo tác động đo được</li>' +
        '<li><b>Edit</b> → vẽ lưới, đổi kích thước bàn, generate</li>' +
        '<li><b>Feel</b> → timing animation, kiểu dáng xe, SFX</li>' +
        '<li><b>Level Set</b> → thêm / nhân bản / xoá level, export JSON</li>' +
      '</ul>' +
      'Sửa gì cũng vào chồng <b>Hoàn tác</b> ở banner trên cùng, nên không thí nghiệm nào là một chiều.' +
    '</div>' +

    '<div class="flag" style="margin-top:4px">Đổi chế độ bằng nút góc phải trên. Ở Level Design có ' +
    'vạch vàng trên thanh menu để luôn biết mình đang ở đâu. Mọi con số đều có dấu ' +
    '<span class="help" data-help="do-sau"></span> bấm được để xem giải thích kèm ví dụ.</div>';

  function showGuide(force) {
    if (!force) {
      try { if (localStorage.getItem(SEEN_KEY)) return; } catch (e) {}
    }
    global.Modal.open({
      title: 'Hai chế độ của tool',
      body: GUIDE_HTML,
      wide: true,
      sticky: true,
      actions: [
        { label: 'Tôi đã hiểu rồi', primary: true, fn: function () {
            try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) {}
          } },
        { label: 'Để sau', fn: function () {} }
      ]
    });
  }

  /* ---------------- modes ----------------
   * Test is what the tool opens in: play the level and read its numbers, with
   * nothing on screen that can change it. Design adds the authoring surface.
   * Keeping them apart means a playtest session can never be a level edit by
   * accident, which is the only way the numbers stay trustworthy. */

  var DESIGN_TABS = { tune: 1, edit: 1, feel: 1 };
  var mode = 'test';

  function setMode(m) {
    mode = m;
    document.body.dataset.mode = m;
    var hint = $('modeHint');
    if (hint) {
      hint.className = 'flag ' + (m === 'test' ? 'warn' : 'good');
      hint.innerHTML = m === 'test'
        ? 'Đang ở <b>Test</b> — chỉ chơi và đọc chỉ số. Sửa lưới, 4 template độ khó, ' +
          'cân độ khó và game feel nằm sau nút <b>⚙ Level Design</b> ở góc phải trên.'
        : 'Đang ở <b>Level Design</b> — đủ 6 tab. <b>Tune</b> có 4 template độ khó và ' +
          'gợi ý khó/dễ hơn, <b>Edit</b> vẽ lưới, <b>Feel</b> tinh chỉnh animation và kiểu dáng xe.';
    }
    var btn = $('modeToggle');
    btn.textContent = m === 'test' ? '⚙ Level Design' : '▶ Test';
    btn.title = m === 'test'
      ? 'Vào chế độ chỉnh sửa: sửa lưới, cân độ khó, tinh chỉnh game feel'
      : 'Về chế độ chơi thử: chỉ chơi và đọc chỉ số, không sửa được gì';
    var active = document.querySelector('#tabs button.on');
    if (m === 'test' && active && DESIGN_TABS[active.dataset.tab]) switchTab('play');
  }

  /* ---------------- result screen ---------------- */

  var MAX_CONTINUE = 1;
  var CONTINUE_MOVES = 5;
  var continuesUsed = 0;

  /* How many more moves would actually finish from where the player is stuck.
   * Offering "+5 moves" on a board that needs 14 more is a lie, and on a board
   * that cannot be finished at all it is a worse one. */
  function movesNeededFrom(s) {
    var r = S.solve(s, { nodeCap: 120000 });
    if (r.solved) return { n: r.minMoves, exact: true };
    var g = S.greedySolve(s, false);
    if (g.won) return { n: g.moves.length, exact: false };
    return null;
  }

  function goNextLevel() { loadLevel(idx + 1); renderSetTable(); }

  function continueRun(extra) {
    continuesUsed++;
    state.movesLeft += extra;
    state.status = 'playing';
    stage.classList.remove('lost');
    renderer.render(state);
    renderTop();
    logMoves();
    hideResult();
    note('+' + extra + ' move (lần continue ' + continuesUsed + '/' + MAX_CONTINUE + ')');
  }

  function resultPlan(s) {
    var done = s.locked.filter(Boolean).length;

    if (s.status === 'won') {
      var spare = s.movesLeft;
      var last = idx >= levels.length - 1;
      var plan = {
        title: 'HOÀN THÀNH',
        sub: s.movesUsed + '/' + s.budget + ' move · thừa ' + spare,
        primary: last
          ? { label: 'Chơi lại level này', fn: restart }
          : { label: 'Level ' + (levels[idx + 1].id != null ? levels[idx + 1].id : idx + 2) + ' →', fn: goNextLevel },
        secondary: last
          ? [{ label: '↺ Về level đầu', fn: function () { loadLevel(0); renderSetTable(); } }]
          : [{ label: '↺ Chơi lại', fn: restart }]
      };
      var a = analysisCache[idx];
      if (spare / s.budget > 0.5) {
        plan.note = 'Còn thừa <b>' + spare + '/' + s.budget + '</b> move. Budget đang rộng quá — ' +
                    'chạy Playtest rồi đặt lại theo mốc win 75%.';
      } else if (spare <= 1) {
        plan.note = 'Thắng sát nút (' + spare + ' move dư). Budget đang chặt — kiểm tra player ẩu có qua nổi không.';
      }
      return plan;
    }

    /* lost */
    var need = movesNeededFrom(s);
    var plan2 = { title: 'HẾT MOVE', sub: 'xong ' + done + '/' + s.cols + ' cột · dùng ' + s.movesUsed + ' move' };

    if (!need) {
      plan2.primary = { label: '↺ Chơi lại', fn: restart };
      plan2.secondary = [{ label: 'Undo 1 nước', fn: undo }];
      plan2.note = 'Solver không đo được trong ngân sách tìm kiếm nên chưa biết cần thêm bao nhiêu move. ' +
                   '<b>Không có nghĩa là thế cờ chết</b> — game này không có ngõ cụt, mọi thế đều giải được.';
      return plan2;
    }

    var canContinue = continuesUsed < MAX_CONTINUE && need.n <= CONTINUE_MOVES;
    if (canContinue) {
      plan2.primary = { label: '+' + CONTINUE_MOVES + ' move, chơi tiếp', fn: function () { continueRun(CONTINUE_MOVES); } };
      plan2.secondary = [{ label: '↺ Chơi lại', fn: restart }];
      plan2.note = 'Chỉ còn thiếu <b>' + need.n + ' move</b> là xong. Đây đúng là khoảnh khắc ' +
                   'bán booster — player đã đầu tư cả ván và chỉ hụt một chút.';
      return plan2;
    }

    plan2.primary = { label: '↺ Chơi lại', fn: restart };
    plan2.secondary = [{ label: 'Undo 1 nước', fn: undo }];
    if (continuesUsed >= MAX_CONTINUE) {
      plan2.note = 'Đã dùng hết ' + MAX_CONTINUE + ' lần continue trong ván này.';
    } else {
      plan2.note = 'Còn cần <b>' + need.n + ' move' + (need.exact ? '' : '~') + '</b> nữa mới xong, ' +
                   'nên +' + CONTINUE_MOVES + ' move không đủ cứu. Thua từ quá sớm — ' +
                   'không phải khoảnh khắc bán booster.';
    }
    return plan2;
  }

  function hideResult() { clear(resultNode); }

  function showResult() {
    clear(resultNode);
    if (!state || state.status === 'playing') return;
    var plan = resultPlan(state);

    var card = el('div', 'result-card', resultNode);
    card.addEventListener('click', function (e) { e.stopPropagation(); });
    el('div', 'result-title', card, plan.title);
    el('div', 'result-sub', card, plan.sub);

    var pb = el('button', 'result-primary', card, plan.primary.label);
    pb.addEventListener('click', plan.primary.fn);

    if (plan.secondary && plan.secondary.length) {
      var row = el('div', 'result-secondary', card);
      plan.secondary.forEach(function (sec) {
        var b = el('button', null, row, sec.label);
        b.addEventListener('click', sec.fn);
      });
    }
    el('div', 'result-tap', card, 'bấm bất kỳ đâu để ' + plan.primary.label.replace(/^[↺+]\s*/, '').toLowerCase());
    if (plan.note) el('div', 'result-note', card).innerHTML = plan.note;

    /* tapping anywhere outside the card takes the smart action */
    resultNode.onclick = plan.primary.fn;
  }

  /* ---------------- tuning history ---------------- */

  var levelHistory = [];

  function applyLevelChange(newLevel, label) {
    levelHistory.push({ label: label, level: JSON.parse(JSON.stringify(levels[idx])), at: idx });
    levels[idx] = newLevel;
    analysisCache = {};
    lastMeasure = null;
    loadLevel(idx);
    renderSetTable();
    renderBanner();
  }

  function revertLevelChange() {
    var last = levelHistory.pop();
    if (!last) return;
    levels[last.at] = last.level;
    analysisCache = {};
    lastMeasure = null;
    loadLevel(last.at);
    renderSetTable();
    renderBanner();
    note('đã hoàn tác: ' + last.label);
  }

  function renderBanner() {
    var box = clear($('tuneBanner'));
    if (!levelHistory.length) return;
    var last = levelHistory[levelHistory.length - 1];
    var what = el('span', 'what', box);
    what.innerHTML = 'Đang thử: <b>' + last.label + '</b>';
    el('span', 'grow', box);
    var play = el('button', 'primary', box, '▶ Chơi thử');
    play.addEventListener('click', function () { switchTab('play'); restart(); });
    var keep = el('button', null, box, '✔ Giữ');
    keep.addEventListener('click', function () {
      levelHistory.length = 0;
      renderBanner();
      note('đã giữ thay đổi');
    });
    var back = el('button', null, box, '↶ Hoàn tác (' + levelHistory.length + ')');
    back.addEventListener('click', revertLevelChange);
  }

  function switchTab(name) {
    var btn = document.querySelector('#tabs button[data-tab="' + name + '"]');
    if (btn) btn.click();
  }

  /* ---------------- metrics ---------------- */

  function metricCard(parent, key, value, note, cls, topic) {
    var m = el('div', 'metric' + (cls ? ' ' + cls : ''), parent);
    var k = el('div', 'k', m, key);
    if (topic) k.appendChild(global.Help.badge(topic));
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
               v.hidden ? v.hidden + ' xe ẩn' : 'không xe ẩn', '', 'mau-cot');
    if (!a) {
      metricCard(box, 'phân tích', '—', 'bấm Analyze ở tab Tune');
      return;
    }
    metricCard(box, 'minMoves', String(a.minMoves) + (a.exact ? '' : '~'), a.exact ? 'tối ưu' : 'greedy (chưa chắc tối ưu)');
    metricCard(box, 'slack', a.slack ? a.slack.toFixed(1) + 'x' : '—', 'budget / minMoves', slackClass(a.slack));
    metricCard(box, 'forced', pct(a.forcedRatio), 'không có lựa chọn');
    metricCard(box, 'choice', pct(a.choiceRatio), '≥2 cột nhận được', choiceClass(a.choiceRatio), 'do-sau');
    metricCard(box, 'dump', pct(a.dumpRatio), 'buộc đổ bừa');
    metricCard(box, 'naiveWin', pct(a.naive.winRate), 'player bấm greedy', naiveClass(a.naive.winRate), 'naive-win');
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
    metricCard(box, 'minMoves', String(a.minMoves) + (a.exact ? '' : '~'), a.exact ? 'IDA* tối ưu' : 'greedy upper bound', '', 'minmoves');
    metricCard(box, 'budget', String(a.budget));
    metricCard(box, 'slack', a.slack ? a.slack.toFixed(2) + 'x' : '—', 'budget / minMoves', slackClass(a.slack), 'slack');
    metricCard(box, 'forced', pct(a.forcedRatio), null, '', 'forced-choice-dump');
    metricCard(box, 'choice', pct(a.choiceRatio), 'quyết định thật', choiceClass(a.choiceRatio), 'do-sau');
    metricCard(box, 'dump', pct(a.dumpRatio), 'đổ bừa', '', 'forced-choice-dump');
    metricCard(box, 'branch', a.branchFactor ? a.branchFactor.toFixed(1) : '—', 'cột hợp lệ / lượt');
    metricCard(box, 'naiveWin', pct(a.naive.winRate), a.naive.runs + ' playout', naiveClass(a.naive.winRate), 'naive-win');
    metricCard(box, 'hết moves', pct(a.naive.outOfMoves), 'player thua vì hết move');
    metricCard(box, 'naive moves', a.naive.avgMoves ? a.naive.avgMoves.toFixed(1) : '—', 'khi thắng');
    metricCard(box, 'xe ẩn', String(a.hidden), null, '', 'xe-an');
    if (a.trap) {
      metricCard(box, 'trap', a.trap.avgExtraMoves == null ? '—' : '+' + a.trap.avgExtraMoves.toFixed(1),
                 'move phí khi tap sai (' + a.trap.samples + ' mẫu)', '', 'trap');
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

  /* ---------------- difficulty templates ---------------- */

  function renderTemplates() {
    var box = clear($('tplCards'));
    var m = lastMeasure;
    var L = level();

    if (m && m.valid) {
      var best = DF.classify(L, m);
      $('tplNow').innerHTML = 'Level này gần nhất với <b>' + best.name + '</b> (lệch ' +
        best.distance.toFixed(2) + ' — 0 là nằm trong mọi dải)';
    } else {
      $('tplNow').textContent = 'bấm Đo / Muốn khó hơn để có số so sánh';
    }

    Object.keys(DF.TEMPLATES).forEach(function (key) {
      var tpl = DF.TEMPLATES[key];
      var chk = m && m.valid ? DF.check(L, m, key) : null;
      var warn = DF.sizeWarning(L, key);
      var card = el('div', 'tpl' + (chk && chk.pass === chk.total ? ' match' : ''), box);

      var head = el('div', 'tpl-head', card);
      el('span', 'tpl-name', head, tpl.name);
      el('span', 'tpl-axis', head, 'trục: ' + tpl.axis);
      if (chk) {
        el('span', 'badge ' + (chk.pass === chk.total ? 'good' : chk.pass >= chk.total - 2 ? 'warn' : 'bad'),
           head, chk.pass + '/' + chk.total + ' tiêu chí');
      }
      el('span', 'grow', head).style.flex = '1';

      var apply = el('button', 'primary', head, 'Áp dụng');
      apply.addEventListener('click', function () { fitTemplate(key); });
      var reb = el('button', null, head, 'Chỉ đặt lại budget');
      reb.title = 'Giữ nguyên lưới, chỉ đặt budget theo slack của tier';
      reb.addEventListener('click', function () { rebudgetTemplate(key); });

      el('div', 'tpl-body', card).innerHTML = tpl.focus;
      el('div', 'tpl-body', card).innerHTML = tpl.why;
      el('div', 'tpl-when', card, 'Dùng cho: ' + tpl.when +
        '  ·  tối thiểu ' + (tpl.minCols || 2) + '×' + (tpl.minRows || 2));

      var knobs = el('div', 'tpl-knobs', card);
      var b = tpl.build;
      [['số màu / số cột', b.colorRatio.toFixed(2)],
       ['mật độ xe lạ', Math.round(b.strayDensity * 100) + '%'],
       ['xe ẩn', Math.round(b.hiddenRatio * 100) + '%'],
       ['slack', b.slack.toFixed(2) + 'x']].forEach(function (kv) {
        el('span', 'knob', knobs).innerHTML = kv[0] + ' <b>' + kv[1] + '</b>';
      });

      if (warn) el('div', 'flag warn', card, warn).style.marginTop = '8px';

      if (chk) {
        var cbox = el('div', 'tpl-check', card);
        chk.rows.forEach(function (r) {
          var row = el('div', 'crit', cbox);
          el('span', r.ok ? 'y' : 'm', row, r.ok ? '✓' : '✗');
          el('span', 'lbl', row, r.label);
          el('span', null, row, r.value);
          el('span', 'band', row, 'cần ' + r.band);
        });
      }
    });
    $('tplJson').value = JSON.stringify(DF.toJSON(), null, 2);
  }

  function critTable(chk) {
    return chk.rows.map(function (r) {
      return '<div class="crit"><span class="' + (r.ok ? 'y' : 'm') + '">' + (r.ok ? '✓' : '✗') +
             '</span><span class="lbl">' + r.label + '</span><span>' + r.value +
             '</span><span class="band">cần ' + r.band + '</span></div>';
    }).join('');
  }

  /* Applying a tier should end with a level that IS that tier, so the fit
   * escalates instead of giving up: grow the board to the tier's minimum if it
   * is too small, then widen the seed search, then add a row. It stops at the
   * first board that passes every criterion, and if nothing does it says which
   * criteria it could not reach rather than just failing. */
  function fitPlan(L, tpl) {
    var c0 = Math.max(L.cols, tpl.minCols || 2);
    var r0 = Math.max(L.rows, tpl.minRows || 2);
    var steps = [
      { cols: c0, rows: r0, tries: 8, label: c0 + '×' + r0 },
      { cols: c0, rows: r0, tries: 16, label: c0 + '×' + r0 + ', tìm rộng hơn' }
    ];
    if (r0 < 9) steps.push({ cols: c0, rows: r0 + 1, tries: 12, label: c0 + '×' + (r0 + 1) + ', thêm 1 hàng' });
    if (c0 < 9 && r0 < 9) steps.push({ cols: c0 + 1, rows: r0 + 1, tries: 12, label: (c0 + 1) + '×' + (r0 + 1) });
    return steps;
  }

  function fitTemplate(key) {
    if (!E.validate(level()).ok) { global.Modal.alert('Chưa sinh được', 'Level hiện tại không hợp lệ.'); return; }
    var tpl = DF.TEMPLATES[key];
    var L = level();
    var steps = fitPlan(L, tpl);
    var grew = steps[0].cols !== L.cols || steps[0].rows !== L.rows;

    var head = '<b>' + tpl.name + '</b> — trục: ' + tpl.axis;
    if (grew) {
      head += '<br>Bàn ' + L.cols + '×' + L.rows + ' nhỏ hơn mức tối thiểu ' +
              (tpl.minCols || 2) + '×' + (tpl.minRows || 2) + ' của tier, nên sẽ mở rộng lên <b>' +
              steps[0].cols + '×' + steps[0].rows + '</b>. Bàn ngắn thì lời giải ngắn, không đủ số nước để player kịp thua.';
    }
    var prog = global.Modal.progress('Đang sinh bàn đạt tiêu chí', head);

    var si = 0, best = null, log = [];

    function runStep() {
      if (si >= steps.length) { finish(); return; }
      var st = steps[si];
      var probe = JSON.parse(JSON.stringify(L));
      probe.cols = st.cols; probe.rows = st.rows;
      probe.grid = [];
      for (var c = 0; c < st.cols; c++) {
        probe.grid[c] = [];
        for (var r = 0; r < st.rows; r++) probe.grid[c][r] = 'yellow';
      }
      probe.pad = 'REV';

      DF.fit(probe, key, PALETTE, {
        tries: st.tries, runs: 600,
        seed: (+$('tplSeed').value || 1) + si * 131
      }, function (i, n) {
        prog.update((si + i / n) / steps.length, 'bước ' + (si + 1) + '/' + steps.length +
                    ' · ' + st.label + ' · bàn thử ' + i + '/' + n);
      }, function (res) {
        if (res && (!best || res.distance < best.distance)) best = res;
        log.push(st.label + ': ' + (res ? res.check.pass + '/' + res.check.total : 'không sinh được'));
        si++;
        if (best && best.check.pass === best.check.total) finish();
        else runStep();
      });
    }

    function finish() {
      prog.close();
      if (!best) {
        global.Modal.alert('Không sinh được',
          'Không tạo được bàn hợp lệ nào cho tier <b>' + tpl.name + '</b>.<br><br>' + log.join('<br>'));
        renderTemplates();
        return;
      }
      var c = best.check, all = c.pass === c.total;
      var lv = best.level;
      var body = '<b>' + tpl.name + '</b> · bàn <b>' + lv.cols + '×' + lv.rows +
                 '</b> · budget <b>' + lv.moves + '</b>' +
                 (all ? ' · <span style="color:var(--good)">đạt cả ' + c.total + ' tiêu chí</span>'
                      : ' · <span style="color:var(--warn)">đạt ' + c.pass + '/' + c.total + '</span>') +
                 '<div style="margin-top:9px">' + critTable(c) + '</div>' +
                 '<ul class="modal-steps">' + log.map(function (l) { return '<li>' + l + '</li>'; }).join('') + '</ul>' +
                 (all ? '' : '<div class="flag warn" style="margin-top:8px">Đã thử hết ' + steps.length +
                    ' bước mà vẫn lệch. Tăng "số bàn thử", đổi seed, hoặc nới dải của tier trong phần Sửa template.</div>');

      global.Modal.open({
        title: all ? 'Đã sinh xong' : 'Gần đạt',
        body: body,
        wide: true,
        actions: [
          { label: 'Áp dụng', primary: true, fn: function () {
              applyLevelChange(lv, 'template ' + tpl.name + ' ' + lv.cols + '×' + lv.rows);
              lastMeasure = best.measure;
              renderTunerScore(best.measure);
              renderTemplates();
              note('template ' + tpl.name + ': ' + c.pass + '/' + c.total + ' tiêu chí, bàn ' +
                   lv.cols + '×' + lv.rows + ', budget ' + lv.moves);
            } },
          { label: 'Sinh lại (seed khác)', fn: function () {
              $('tplSeed').value = (+$('tplSeed').value || 1) + 1;
              fitTemplate(key);
            } },
          { label: 'Bỏ', fn: function () { renderTemplates(); } }
        ]
      });
    }

    runStep();
  }

  function rebudgetTemplate(key) {
    var m = lastMeasure && lastMeasure.valid ? lastMeasure : T.measure(level(), 600);
    var r = DF.refineBudget(JSON.parse(JSON.stringify(level())), key, 600, m);
    if (!r) { note('không đo được lời giải để đặt budget'); return; }
    applyLevelChange(r.level, 'budget theo ' + DF.TEMPLATES[key].name + ' → ' + r.level.moves);
    lastMeasure = r.measure;
    renderTunerScore(r.measure);
    renderTemplates();
    note('budget → ' + r.level.moves + ' (win trung bình ' + pct(r.measure.winAvg) + ')');
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
    metricCard(box, 'độ khó', String(m.D), '0 = ai cũng thắng, 100 = gần như thua', bandClass(m.D), 'do-kho');
    metricCard(box, 'độ sâu', String(m.depth), '% lượt có quyết định thật', m.depth < 10 ? 'bad' : m.depth < 25 ? 'warn' : 'good', 'do-sau');
    metricCard(box, 'win — giỏi', pct(m.winCareful), 'lỗi tay 2%', '', 'loi-tay');
    metricCard(box, 'win — trung bình', pct(m.winAvg), 'lỗi tay 10%', naiveClass(m.winAvg), 'loi-tay');
    metricCard(box, 'win — ẩu', pct(m.winSloppy), 'lỗi tay 25%', '', 'loi-tay');
    metricCard(box, 'slack', m.slack ? m.slack.toFixed(2) + 'x' : '—', 'budget / lời giải thực tế', slackClass(m.slack), 'slack');
    metricCard(box, 'xe lạ', String(m.strays), 'xe không nằm đúng cột màu của nó', '', 'xe-la');
    metricCard(box, 'màu / cột', m.colors + ' / ' + level().cols,
               m.colors < level().cols ? 'có cột trùng màu → có lựa chọn' : 'mỗi màu 1 cột → chuỗi ép',
               '', 'mau-cot');
  }

  function measureCurrent() {
    var v = E.validate(level());
    if (!v.ok) { lastMeasure = null; renderTunerScore(null); renderTemplates(); return null; }
    lastMeasure = T.measure(level(), 900);
    renderTunerScore(lastMeasure);
    renderTemplates();
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
      var lname = el('b', null, head, item.lever);
      var leverTopic = { 'Số màu': 'gop-mau', 'Xe lạ': 'xe-la', 'Move budget': 'slack',
                         'Xe ẩn': 'xe-an', 'Kích thước': 'mau-cot' }[item.lever];
      if (leverTopic) lname.appendChild(global.Help.badge(leverTopic));
      var apply = el('button', 'primary', head, 'Áp dụng');
      apply.addEventListener('click', function () {
        applyLevelChange(item.level, item.label);
        measureCurrent();
        note('đã áp dụng: ' + item.label);
      });
      var tryIt = el('button', null, head, '▶ Chơi thử');
      tryIt.addEventListener('click', function () {
        applyLevelChange(item.level, item.label);
        measureCurrent();
        switchTab('play');
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
    var heads = [['player', ''], ['lỗi tay', 'loi-tay'], ['win @ budget ' + rep.level.moves, ''],
                 ['trần win', 'ceiling'], ['p50', ''], ['p90', ''],
                 ['budget 90%', 'budget-curve'], ['budget 75%', 'budget-curve'], ['budget 60%', 'budget-curve']];
    heads.forEach(function (h) {
      var th = el('th', null, hr, h[0]);
      if (h[1]) th.appendChild(global.Help.badge(h[1]));
    });
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
      f.appendChild(mkFlag('warn', pct(1 - avg.ceiling) + ' lượt chơi không về đích dù budget vô hạn. ' +
        'KHÔNG phải thế cờ chết — game này không có ngõ cụt, mọi thế đều giải được. ' +
        'Đây là player bấm theo bản năng bị lặp vòng: đẩy xe qua lại giữa hai cột mà không tiến. ' +
        'Trung bình kẹt ở ' + (avg.avgColumnsOnLoop == null ? '?' : avg.avgColumnsOnLoop.toFixed(1)) +
        '/' + rep.level.cols + ' cột. Level dễ gây lặp vòng thì player thật sẽ thấy bế tắc dù vẫn còn cửa.'));
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
    var next = JSON.parse(JSON.stringify(L));
    next.grid = lv.grid; next.pad = lv.pad;
    next.moves = ab ? ab.budget : L.moves;
    applyLevelChange(next, 'generate ' + L.cols + '×' + L.rows);
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
    $('useSprites').checked = !!F.get('sprites');
    $('sfxOn').checked = !!F.get('sfxOn');
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
    try { data = JSON.parse(txt); } catch (e) { global.Modal.alert('JSON lỗi', e.message); return; }
    if (!data.levels || !data.levels.length) { global.Modal.alert('Import lỗi', 'Không thấy mảng <b>levels</b> trong JSON.'); return; }
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
  $('analyzePlay').addEventListener('click', function () {
    var b = $('analyzePlay');
    b.disabled = true; b.textContent = 'đang đo…';
    $('analyzePlayNote').textContent = '';
    setTimeout(function () {
      analyzeCurrent();
      measureCurrent();
      b.disabled = false; b.textContent = 'Đo lại';
      var a = analysisCache[idx];
      $('analyzePlayNote').textContent = a && a.minMoves != null
        ? 'lời giải ' + a.minMoves + (a.exact ? '' : '~') + ' move · budget ' + level().moves
        : '';
    }, 20);
  });
  $('modeToggle').addEventListener('click', function () { setMode(mode === 'test' ? 'design' : 'test'); });
  $('helpGuide').addEventListener('click', function () { showGuide(true); });
  $('tplLoad').addEventListener('click', function () {
    try {
      DF.load(JSON.parse($('tplJson').value));
      renderTemplates();
      note('đã nạp template');
    } catch (e) { global.Modal.alert('Template JSON lỗi', e.message); }
  });
  $('tplReset').addEventListener('click', function () {
    DF.load(DEFAULT_TEMPLATES);
    renderTemplates();
    note('template về mặc định');
  });
  $('wantHarder').addEventListener('click', function () { askSuggestions('harder'); });
  $('wantEasier').addEventListener('click', function () { askSuggestions('easier'); });
  $('runPlaytest').addEventListener('click', runPlaytest);
  $('applyBudget').addEventListener('click', function () {
    var a = analysisCache[idx];
    if (!a || a.minMoves == null) { note('analyze trước đã'); return; }
    var nb = JSON.parse(JSON.stringify(level()));
    nb.moves = Math.max(1, Math.ceil(a.minMoves * (+$('slackTarget').value || 1.6)));
    applyLevelChange(nb, 'budget → ' + nb.moves);
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
    catch (e) { global.Modal.alert('Feel JSON lỗi', e.message); }
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
      if (b.dataset.tab === 'tune') { if (!lastMeasure) measureCurrent(); else renderTemplates(); }
    });
  });

  document.addEventListener('keydown', function (e) {
    if (/input|textarea|select/i.test(e.target.tagName)) return;
    if (state && state.status !== 'playing' && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      var pb = resultNode.querySelector('.result-primary');
      if (pb) pb.click();
      return;
    }
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

  fetch('src/tool.js', { method: 'HEAD', cache: 'no-store' }).then(function (r) {
    var t = r.headers.get('Last-Modified');
    var d = t ? new Date(t) : null;
    $('buildStamp').textContent = 'build ' + (d
      ? d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      : '?');
  }).catch(function () { $('buildStamp').textContent = 'build ?'; });

  renderBrushes();
  renderFeel();
  renderTemplates();
  renderBanner();
  setMode('test');
  loadLevel(0);
  showGuide(false);

  /* Sprites arrive asynchronously; redraw once they do. */
  if (global.Sprites) {
    global.Sprites.load().then(function (n) {
      if (n && state) renderer.render(state);
      if (n) note(n + ' kiểu dáng xe đã nạp');
    });
  }
  renderSetTable();
  global.CarTool = {
    levels: function () { return levels; },
    stateNow: function () { return state; },
    analysis: function () { return analysisCache; },
    load: loadLevel
  };
})(window);
