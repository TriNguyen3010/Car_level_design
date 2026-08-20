/* The tool itself: play the level, read its difficulty numbers, edit it,
 * tune the feel, export the set. */
(function (global) {
  'use strict';

  var E = global.Engine, S = global.Solver, G = global.Gen, F = global.Feel;
  var PT = global.Playtest, T = global.Tuner, DF = global.Difficulty;
  /* Aliases deliberately NOT named t or L: both are long-standing local names in
   this file (a tier, a level) and would be shadowed inside callbacks. */
  var I = global.I18N, tr = I.t, loc = I.L;
  var REV = 'REV';

  var PALETTE = Object.assign({}, global.LevelData.palette);
  var DEFAULT_TEMPLATES = global.Difficulty.toJSON();
  var levelHistory = [];
  var tierOf = {};        // level index -> tier currently loaded
  var lockedTier = {};    // level index -> tier the designer signed off
  var SETS = global.LevelSets ? JSON.parse(JSON.stringify(global.LevelSets.SETS)) : null;
  var SET_ORDER = global.LevelSets ? global.LevelSets.order.slice() : [];
  var currentSet = SETS ? 'default' : null;
  var levels = SETS ? SETS[currentSet].levels : JSON.parse(JSON.stringify(global.LevelData.levels));
  var idx = 0;

  function setSpec() { return SETS ? SETS[currentSet] : { name: '', breathers: [], rhythmOn: 'winAvg' }; }

  /* The picker leads with the difficulty word and colours by difficulty, because
   * "Nhịp" tells a reader nothing about how hard the campaign is. The poetic name
   * and the intent live in the tooltip and in the Nhật ký panel. The tier range
   * under each label says how hard in the tool's own vocabulary. */
  function setWord(k) {
    return tr({ 'default': 'setPickWordDefault', easy: 'setPickWordEasy',
                medium: 'setPickWordMedium', hard: 'setPickWordHard' }[k] || k);
  }
  var SET_WORD = new Proxy({}, { get: function (_, k) { return setWord(String(k)); } });

  /* Start arrow peak, not a min-max range: the ranges overlap at the low end
   * ("bậc 1–7" vs "bậc 2–10") which muddles which campaign is harder. The peak
   * on the right orders them at a glance — 4, 7, 10. */
  function tierRange(key) {
    var ts = SETS[key].levels.map(function (L) { return L.tier; }).filter(Boolean);
    if (!ts.length) return I.m('xTierSpanWide');
    return I.m('xStepSpan', ts[0], Math.max.apply(null, ts));
  }

  function renderSetPick() {
    if (!SETS) return;
    var box = clear($('setPick'));
    SET_ORDER.forEach(function (k) {
      var b = el('button', currentSet === k ? 'on' : '', box);
      b.dataset.set = k;
      el('b', null, b, SET_WORD[k] || loc(SETS[k].label));
      el('span', null, b, tierRange(k));
      b.title = loc(SETS[k].name) + ' — ' + loc(SETS[k].intent).replace(/<[^>]+>/g, '') +
                '\n\n' + tr('setPickT');
      b.addEventListener('click', function () { askSwitchSet(k); });
    });
  }

  /* Switching campaign restarts from level 1 — the sets are different curves,
   * so carrying a level index across them would land the player mid-ramp. */
  function askSwitchSet(key) {
    if (!SETS || !SETS[key] || key === currentSet) return;
    var from = SETS[currentSet], to = SETS[key];
    global.Modal.open({
      title: tr('switchSetQ') + ' ' + (SET_WORD[key] || loc(to.label)) + '?',
      wide: true,
      body:
        '<b>' + (SET_WORD[currentSet] || loc(from.label)) + '</b> (' + tierRange(currentSet) + ')' +
        '  →  <b>' + (SET_WORD[key] || loc(to.label)) + '</b> (' + tierRange(key) + ')' +
        '<div class="flag warn" style="margin-top:9px">' + tr('switchWarn') + '</div>' +
        '<div style="margin-top:8px">' + loc(to.intent) + '</div>',
      actions: [
        { label: tr('switchGo'), primary: true, fn: function () { switchSet(key); } },
        { label: tr('stayOn') + ' ' + (SET_WORD[currentSet] || loc(from.label)), fn: function () { renderSetPick(); } }
      ]
    });
  }

  function switchSet(key) {
    if (!SETS || !SETS[key] || key === currentSet) return;
    currentSet = key;
    levels = SETS[key].levels;
    analysisCache = {};
    lastMeasure = null;
    levelHistory.length = 0;
    tierOf = {}; lockedTier = {};
    idx = 0;
    renderSetPick();
    renderCurveTab();
    renderBanner();
    loadLevel(0);
    renderSetTable();
    renderJournal();
    note(I.m('logSetSwitch', loc(SETS[key].name), loc(SETS[key].label)));
  }
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

  var boardVisible = true;
  var pendingRender = false;

  function drawBoard() {
    if (!state) return;
    if (!boardVisible) { pendingRender = true; return; }
    renderer.render(state);
  }

  function setBoardVisible(v) {
    boardVisible = v;
    document.body.classList.toggle('board-hidden', !v);
    $('boardToggle').textContent = (v ? '👁 ' : '🙈 ') + tr(v ? 'hideBoard' : 'showBoard');
    /* Always redraw on reveal, not only when a draw was queued: the stage box
     * changed while it was collapsed, so the old geometry is stale either way. */
    if (v) { pendingRender = false; if (state) renderer.render(state); }
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
      $('moveLog').textContent = tr('invalidLevelHead') + '\n- ' + v.errors.join('\n- ');
      return;
    }
    state = E.createState(level());
    assignShapes(state, (level().id != null ? level().id : idx + 1) * 7919 + level().cols);
    history = [];
    stage.className = 'stage theme-' + (level().theme || 'city');
    stage.appendChild(resultNode);
    continuesUsed = 0;
    startRun();
    drawBoard();
    showResult();
    renderPlaytuneBar();
    ensureTier();
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
    if (!boardVisible) {
      pendingRender = true;
      renderTop();
      logMoves(ev);
      showResult();
      if (state.status !== 'playing') logAttempt(state.status === 'won' ? 'win' : 'lose');
      return;
    }
    busy = true;
    renderer.animateMove(state, ev, function () {
      setTimeout(function () { busy = false; }, F.get('inputLock'));
      showResult();
      if (state.status !== 'playing') logAttempt(state.status === 'won' ? 'win' : 'lose');
    });
    renderTop();
    logMoves(ev);
  }

  function restart() { loadLevel(idx); }

  function undo() {
    stopAutoplay();
    if (!history.length) return;
    runUndos++;
    state = history.pop();
    assignShapes(state, (level().id != null ? level().id : idx + 1) * 7919 + level().cols);
    stage.classList.remove('won', 'lost');
    drawBoard();
    hideResult();
    renderTop();
    logMoves();
  }

  function hint() {
    if (!state || state.status !== 'playing') return;
    var r = S.solve(state, { nodeCap: 150000 });
    if (r.solved && r.moves.length) {
      renderer.flashColumn(r.moves[0], 'hint');
      note(I.m('logHint', r.moves[0] + 1, r.moves.length));
    } else {
      var g = S.greedySolve(state, false);
      if (g.won && g.moves.length) {
        renderer.flashColumn(g.moves[0], 'hint');
        note(I.m('logHintGreedy', g.moves[0] + 1));
      } else note(I.m('logNoSol'));
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
    if (!moves.length) { note(I.m('logNoAuto')); return; }
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
    parts.push(I.m('logHead', state.movesUsed, state.budget, state.pad.color,
                    state.locked.filter(Boolean).length, state.cols));
    if (ev) {
      parts.push(I.m('logTap', ev.col + 1, ev.inserted.color, ev.ejected.color) +
                 (ev.completed.length ? I.m('logDone', ev.completed.map(function (c) { return c + 1; }).join(',')) : '') +
                 (ev.autoSorted.length ? I.m('logSort', ev.autoSorted.map(function (x) { return x.col + 1; }).join(',')) : ''));
    }
    var good = S.goodColumns(state, true).map(function (c) { return c + 1; });
    parts.push(I.m('logGood', good.length ? good.join(', ') : I.t('logNoGood') === 'logNoGood' ? I.m('logNoGood') : I.m('logNoGood')));
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

  function guideHtml() {
    return I.m('xGuide') +
      '<div class="guide-modes">' +
        '<b>' + tr('modeTest') + '</b><span>' + I.m('xGuideTest') + '</span>' +
        '<b>' + tr('modePlaytune') + '</b><span>' + I.m('xGuidePlay') + '</span>' +
        '<b>' + tr('modeDesign') + '</b><span>' + I.m('xGuideDesign') + '</span>' +
      '</div>' +
      '<div class="flag">' + I.m('xGuideTab') +
      ' <span class="help" data-help="do-sau"></span> ' + I.m('xGuideTabB') + '</div>';
  }

  function showGuide(force) {
    if (!force) {
      try { if (localStorage.getItem(SEEN_KEY)) return; } catch (e) {}
    }
    global.Modal.open({
      title: tr('guideTitle'),
      body: guideHtml(),
      wide: true,
      sticky: true,
      actions: [
        { label: tr('understood'), primary: true, fn: function () {
            try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) {}
          } },
        { label: tr('later'), fn: function () {} }
      ]
    });
  }

  /* ---------------- modes ----------------
   * Test is what the tool opens in: play the level and read its numbers, with
   * nothing on screen that can change it. Design adds the authoring surface.
   * Keeping them apart means a playtest session can never be a level edit by
   * accident, which is the only way the numbers stay trustworthy. */

  var TAB_MODES = {
    tune: 'design', edit: 'design', feel: 'design',
    journal: 'playtune'
  };
  var mode = 'test';

  function setMode(m) {
    mode = m;
    document.body.dataset.mode = m;
    Array.prototype.forEach.call(document.querySelectorAll('#modeSwitch button'), function (b) {
      b.classList.toggle('on', b.dataset.mode === m);
    });
    var hint = $('modeHint');
    if (hint) {
      hint.className = 'flag ' + (m === 'test' ? 'warn' : m === 'playtune' ? '' : 'good');
      hint.innerHTML = I.m(m === 'test' ? 'xModeTest' : m === 'playtune' ? 'xModePlaytune' : 'xModeDesign');
    }
    var active = document.querySelector('#tabs button.on');
    if (active && TAB_MODES[active.dataset.tab] && TAB_MODES[active.dataset.tab] !== m) switchTab('curve');
    renderPlaytuneBar();
    /* The strip is useless without a tier, and the tier comes from a measure —
     * so entering the mode pays for one rather than showing dead buttons. */
    if (m === 'playtune') ensureTier();
  }

  function ensureTier() {
    if (mode !== 'playtune') return;
    if (tierOf[idx] || (lastMeasure && lastMeasure.valid)) { renderPlaytuneBar(); return; }
    if (!E.validate(level()).ok) { renderPlaytuneBar(); return; }
    var bar = $('playtuneBar');
    bar.innerHTML = '<span class="est">' + tr('detectingTier') + '</span>';
    setTimeout(function () {
      lastMeasure = T.measure(level(), 600);
      renderTunerScore(lastMeasure);
      renderPlaytuneBar();
      renderJournal();
    }, 20);
  }

  /* ---------------- play & tune ----------------
   * Judging difficulty by playing, not by reading numbers. Bump the level's
   * tier in place, replay, and every attempt is logged with BOTH the designer's
   * own result and the solver's estimate — because one playthrough by the person
   * who built the level is n=1 by someone who already knows the trick, and
   * without the estimate beside it this loop ratchets difficulty up until only
   * the author can finish the game.
   */

  var attempts = [];
  var runStart = null;
  var runUndos = 0;

  function tierNow() {
    var t = tierOf[idx];
    if (t) return t;
    if (level().tier) return level().tier;
    var m = lastMeasure;
    if (m && m.valid) {
      var c = DF.classify(level(), m);
      var tp = DF.TEMPLATES[c.key];
      if (tp) return tp.tier;
    }
    return null;
  }

  function tierKey(t) { return 't' + t; }
  function maxTier() { return Object.keys(DF.TEMPLATES).length; }

  function renderPlaytuneBar() {
    var box = clear($('playtuneBar'));
    if (mode !== 'playtune') return;
    var tier = tierNow();
    var tpl = tier ? DF.TEMPLATES[tierKey(tier)] : null;
    var locked = lockedTier[idx];

    var lbl = el('span', 'tierNow', box);
    lbl.innerHTML = tpl
      ? I.m('xLevelStep', level().id != null ? level().id : idx + 1, tier, loc(tpl.group))
      : I.m('xLevelNoStep', level().id != null ? level().id : idx + 1);
    if (locked) {
      var pill = el('span', 'tierPill set', box, tr('lockedBadge') + ' ' + locked);
      pill.style.marginLeft = '2px';
    }
    if (tpl) {
      el('span', 'est', box, I.m('xEstimate',
        Math.round(tpl.target.winAvg[0] * 100), Math.round(tpl.target.winAvg[1] * 100),
        Math.round(tpl.target.winSloppy[0] * 100), Math.round(tpl.target.winSloppy[1] * 100)));
    }
    el('span', 'grow', box);

    var down = el('button', null, box, tr('lowerTier'));
    down.disabled = !tier || tier <= 1;
    down.addEventListener('click', function () { goTier(tier - 1); });

    var up = el('button', 'primary', box, tr('raiseTier'));
    up.disabled = !tier || tier >= maxTier();
    up.addEventListener('click', function () { goTier(tier + 1); });

    var reroll = el('button', null, box, tr('rerollBoard'));
    reroll.disabled = !tier;
    reroll.addEventListener('click', function () { goTier(tier, true); });

    var lock = el('button', 'lock', box, locked === tier ? tr('lockedAlready') : tr('lockTier') + ' ' + (tier || '?'));
    lock.disabled = !tier || locked === tier;
    lock.addEventListener('click', function () { lockTier(tier); });
  }

  /* Regenerate this level at a tier. Runs in the worker so the UI stays live. */
  function goTier(tierTo, reroll) {
    if (!tierTo || tierTo < 1 || tierTo > maxTier()) return;
    var key = tierKey(tierTo);
    var tpl = DF.TEMPLATES[key];
    var seedBase = (+($('tplSeed') && $('tplSeed').value) || 1) + (reroll ? (tierSeedBump[idx] = (tierSeedBump[idx] || 0) + 7) : 0);

    var prog = global.Modal.progress(tr('buildingTier') + ' ' + tierTo,
      '<b>' + loc(tpl.name) + '</b> · ' + tr('axisWord') + ': ' + loc(tpl.axis) + '<br>' + loc(tpl.focus));

    var items = [{ at: idx, level: JSON.parse(JSON.stringify(level())) }];
    var handled = false;
    function land(best) {
      if (handled) return;
      handled = true;
      global.Modal.close();
      if (!best) { global.Modal.alert(tr('cannotBuild'), I.m('dNoBoardAt', tierTo)); return; }
      tierOf[idx] = tierTo;
      applyLevelChanges([{ at: idx, level: best.level }], tr('stepRange') + ' ' + tierTo + ' · level ' + (level().id != null ? level().id : idx + 1));
      lastMeasure = best.measure;
      renderTunerScore(best.measure);
      renderPlaytuneBar();
      renderJournal();
      startRun();
      note(I.m('logTierBuilt', tierTo, best.level.cols + '×' + best.level.rows, best.level.moves,
                best.check.pass, best.check.total));
    }

    var job = workerJob({
      cmd: 'fitRange', items: items, key: key, palette: PALETTE,
      templates: DF.toJSON(), seed: seedBase, runs: 600
    }, function (p) { prog.update(p.frac, p.text); },
       function (d) { land(d.results[0] && d.results[0].best); },
       function () {
         var r = DF.fitOneSync(items[0].level, key, PALETTE, seedBase, 500, null);
         land(r && r.best);
       });
    if (!job) {
      var r = DF.fitOneSync(items[0].level, key, PALETTE, seedBase, 500, null);
      land(r && r.best);
    }
  }
  var tierSeedBump = {};

  function lockTier(tier) {
    lockedTier[idx] = tier;
    logAttempt('lock');
    renderPlaytuneBar();
    renderJournal();
    renderSetTable();
    var warn = curveWarnings();
    if (warn.length) {
      global.Modal.open({
        title: I.m('dSignedFor', tier, level().id != null ? level().id : idx + 1),
        body: tr('curveIssues') + '<ul class="modal-steps">' +
              warn.map(function (w) { return '<li>' + w + '</li>'; }).join('') + '</ul>',
        actions: [
          { label: tr('nextLevelBtn'), primary: true, fn: function () { if (idx < levels.length - 1) goNextLevel(); } },
          { label: tr('stayHere'), fn: function () {} }
        ]
      });
    } else if (idx < levels.length - 1) {
      global.Modal.open({
        title: I.m('dSignedOff', tier),
        body: I.m('dSignedOffB', level().id != null ? level().id : idx + 1, tier) + ' ' + tr('curveSmooth'),
        actions: [
          { label: tr('nextLevelBtn'), primary: true, fn: goNextLevel },
          { label: tr('stayHere'), fn: function () {} }
        ]
      });
    }
  }

  function startRun() { runStart = Date.now(); runUndos = 0; }

  function logAttempt(kind) {
    if (mode !== 'playtune' || !state) return;
    var t = tierNow();
    var tpl = t ? DF.TEMPLATES[tierKey(t)] : null;
    attempts.push({
      at: idx,
      level: level().id != null ? level().id : idx + 1,
      tier: t,
      kind: kind,                       // 'win' | 'lose' | 'chốt'
      movesUsed: state.movesUsed,
      movesLeft: state.movesLeft,
      budget: state.budget,
      size: level().cols + '×' + level().rows,
      seconds: runStart ? Math.round((Date.now() - runStart) / 1000) : null,
      undos: runUndos,
      continues: continuesUsed,
      estAvg: tpl ? tpl.target.winAvg : null,
      estSloppy: tpl ? tpl.target.winSloppy : null
    });
    renderJournal();
  }

  /* Complains about the SHAPE of the ramp, not about each step.
   *
   * Two of the campaigns dip on purpose — a breather after a new mechanic is
   * what makes the player feel competent rather than lucky — so a per-step
   * "this one is easier than the last" check would have the tool scolding its
   * own design. What matters is the trend across the whole run, a dip deep
   * enough to read as a collapse, and a rise steep enough to wall. */
  function curveWarnings() {
    var out = [], seq = [], spec = setSpec();
    var breathers = spec.breathers || [];
    for (var i = 0; i < levels.length; i++) {
      var t = lockedTier[i] || tierOf[i] || levels[i].tier;
      if (t) seq.push({ i: i, id: levels[i].id != null ? levels[i].id : i + 1, t: t });
    }
    if (seq.length < 3) return out;

    var n = seq.length, sx = 0, sy = 0, sxy = 0, sxx = 0;
    seq.forEach(function (p, k) { sx += k; sy += p.t; sxy += k * p.t; sxx += k * k; });
    var slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    if (slope <= 0.02) {
      out.push(I.m('wTrend', slope.toFixed(2)));
    }

    for (var k = 1; k < seq.length; k++) {
      var a = seq[k - 1], b = seq[k];
      var declared = breathers.indexOf(b.id) >= 0;
      if (b.t - a.t >= 3) {
        out.push(I.m('wJump', a.id, b.id, b.t - a.t));
      }
      if (b.t < a.t && !declared && a.t - b.t >= 3) {
        out.push(I.m('wDrop', b.id, a.t - b.t, a.id));
      }
    }

    var last = seq[seq.length - 1], peak = seq.reduce(function (m, p) { return p.t > m.t ? p : m; }, seq[0]);
    if (last.t === peak.t && last.i === peak.i && currentSet !== 'hard') {
      out.push(I.m('wEndPeak', last.id));
    }
    return out;
  }

  function renderSetIntent() {
    var box = $('setIntent');
    if (!box) return;
    clear(box);
    var spec = setSpec();
    if (!spec) return;
    var head = el('div', null, box);
    el('span', 'nm', head, SET_WORD[currentSet] || loc(spec.label));
    el('span', 'lb', head, loc(spec.name) + (tiersOf(currentSet).some(Boolean) ? ' · ' + tierRange(currentSet) : ''));
    var seq = el('div', 'seq', box);
    var parts = levels.map(function (L, i) {
      var t = lockedTier[i] || tierOf[i] || L.tier;
      var isB = (spec.breathers || []).indexOf(L.id != null ? L.id : i + 1) >= 0;
      return isB ? '<i>' + (t || '-') + '</i>' : String(t || '-');
    });
    seq.innerHTML = tr('legTier') + ': ' + parts.join(' ') +
      '  <span style="color:var(--ink-dim)">(' + tr('legBreather').replace('● = ', '') + ')</span>';
  }

  function renderJournal() {
    renderSetIntent();
    var box = clear($('journalSet'));
    var t = el('table', 'grid', box);
    var hr = el('tr', null, el('thead', null, t));
    ['colLevel', 'colSize', 'colBudget', 'colWorking', 'colLocked', 'colRuns']
      .forEach(function (k) { el('th', null, hr, tr(k)); });
    var tb = el('tbody', null, t);
    levels.forEach(function (L, i) {
      var tr = el('tr', i === idx ? 'on' : '', tb);
      tr.addEventListener('click', function () { loadLevel(i); renderJournal(); renderPlaytuneBar(); });
      el('td', null, tr, String(L.id != null ? L.id : i + 1));
      el('td', null, tr, L.cols + '×' + L.rows);
      el('td', null, tr, String(L.moves));
      var declared = tierOf[i] || L.tier;
      el('td', null, tr, declared ? String(declared) + (tierOf[i] ? '' : ' ' + tr('fromSet')) : '—');
      var td = el('td', null, tr);
      var pill = el('span', 'tierPill' + (lockedTier[i] ? ' set' : ''), td, lockedTier[i] ? String(lockedTier[i]) : '—');
      el('td', null, tr, String(attempts.filter(function (a) { return a.at === i; }).length));
    });

    var warn = curveWarnings();
    if (warn.length) {
      var wb = el('div', 'flags', box);
      wb.style.marginTop = '8px';
      warn.forEach(function (w) { el('div', 'flag warn', wb).innerHTML = w; });
    }

    renderTierCurve();

    var log = clear($('journalLog'));
    $('journalCount').textContent = attempts.length + ' ' + tr('runs');
    if (!attempts.length) { el('div', 'hint', log, tr('noRunsYet')); return; }
    attempts.slice().reverse().forEach(function (a) {
      var row = el('div', 'jrow ' + (a.kind === 'win' ? 'win' : a.kind === 'lose' ? 'lose' : ''), log);
      el('span', null, row, 'Lv ' + a.level);
      el('span', 'tierPill', row, String(a.tier == null ? '?' : a.tier));
      var mid = el('span', 'oc', row);
      mid.innerHTML = tr(a.kind === 'win' ? 'won' : a.kind === 'lose' ? 'lost' : 'signedOff') +
        ' <span class="dim">· ' + a.movesUsed + '/' + a.budget + ' move' +
        (a.kind === 'win' ? ', ' + tr('spare') + ' ' + a.movesLeft : '') +
        (a.undos ? ', undo ' + a.undos : '') +
        (a.continues ? ', continue ' + a.continues : '') +
        (a.seconds != null ? ', ' + a.seconds + 's' : '') + '</span>';
      el('span', 'dim', row, a.size);
      el('span', 'dim', row, a.estAvg ? tr('estAvg') + ' ' + Math.round(a.estAvg[0] * 100) + '–' + Math.round(a.estAvg[1] * 100) + '%' : '');
    });
  }

  function renderTierCurve() {
    var box = clear($('journalCurve'));
    var any = levels.some(function (L, i) { return lockedTier[i] || tierOf[i]; });
    if (!any) { el('div', 'hint', box, tr('noTierLocked')); return; }
    var W = 640, H = 150, padL = 26, padB = 20, n = levels.length;
    var bw = (W - padL - 10) / n, mx = maxTier();
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto">';
    svg += '<rect width="' + W + '" height="' + H + '" fill="#10131a" rx="8"/>';
    for (var g = 1; g <= mx; g += 3) {
      var y = H - padB - (H - padB - 10) * (g / mx);
      svg += '<line x1="' + padL + '" y1="' + y + '" x2="' + (W - 8) + '" y2="' + y + '" stroke="#2b3140"/>' +
             '<text x="4" y="' + (y + 3) + '" fill="#93a0b3" font-size="9">' + g + '</text>';
    }
    var pts = [];
    for (var i = 0; i < n; i++) {
      var t = lockedTier[i] || tierOf[i];
      var x = padL + i * bw + bw * 0.5;
      if (t) {
        var yy = H - padB - (H - padB - 10) * (t / mx);
        pts.push(x + ',' + yy);
        svg += '<circle cx="' + x + '" cy="' + yy + '" r="4" fill="' + (lockedTier[i] ? '#3f9c5a' : '#7a52d0') + '"/>';
      }
      svg += '<text x="' + x + '" y="' + (H - 6) + '" fill="#93a0b3" font-size="9" text-anchor="middle">' +
             (levels[i].id != null ? levels[i].id : i + 1) + '</text>';
    }
    if (pts.length > 1) svg += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="#3f9c5a" stroke-width="2"/>';
    svg += '</svg>';
    box.innerHTML = svg;
    el('div', 'hint', box, tr('curveLegend'));
  }

  /* ---------------- difficulty tab ----------------
   * Charts first. A campaign is a shape, and a shape is something you look at;
   * ten rows of numbers make the reader rebuild the shape in their head. */

  var SET_COLOR = { 'default': '#8a93a3', easy: '#4ec97a', medium: '#e8b13a', hard: '#e05c4c' };
  var measuredSet = {};        // set key -> [{winCareful, winAvg, winSloppy}]

  function tiersOf(key) {
    return SETS[key].levels.map(function (L) { return L.tier || null; });
  }

  /* All four campaigns on one axis, so the three approaches are visibly
   * different rather than three tables you compare by eye. */
  function drawCompare() {
    var box = clear($('curveCompare'));
    var W = 660, H = 210, padL = 30, padB = 24, padT = 12;
    var n = Math.max.apply(null, SET_ORDER.map(function (k) { return SETS[k].levels.length; }));
    var mx = 10;
    function X(i) { return padL + (i / Math.max(1, n - 1)) * (W - padL - 14); }
    function Y(t) { return padT + (1 - (t - 1) / (mx - 1)) * (H - padT - padB); }

    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto">';
    svg += '<rect width="' + W + '" height="' + H + '" fill="#10131a" rx="8"/>';
    for (var t = 1; t <= mx; t += 3) {
      svg += '<line x1="' + padL + '" y1="' + Y(t) + '" x2="' + (W - 14) + '" y2="' + Y(t) +
             '" stroke="#2b3140"/><text x="6" y="' + (Y(t) + 3) + '" fill="#93a0b3" font-size="9">' +
             I.t('legTier') + ' ' + t + '</text>';
    }
    SET_ORDER.forEach(function (k) {
      var ts = tiersOf(k), col = SET_COLOR[k], pts = [], dots = '';
      ts.forEach(function (v, i) {
        if (!v) return;
        pts.push(X(i) + ',' + Y(v));
        var isB = (SETS[k].breathers || []).indexOf(SETS[k].levels[i].id) >= 0;
        if (isB) dots += '<circle cx="' + X(i) + '" cy="' + Y(v) + '" r="4" fill="' + col + '"/>';
      });
      if (pts.length > 1) {
        svg += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + col +
               '" stroke-width="' + (k === currentSet ? 3 : 1.6) + '"' +
               (k === currentSet ? '' : ' opacity=".45"') + '/>' + dots;
      }
    });
    for (var i = 0; i < n; i++) {
      svg += '<text x="' + X(i) + '" y="' + (H - 7) + '" fill="#93a0b3" font-size="9" text-anchor="middle">' +
             (i + 1) + '</text>';
    }
    svg += '</svg>';
    box.innerHTML = svg;
    var lg = el('div', 'legend', box);
    SET_ORDER.forEach(function (k) {
      var sp = el('span', null, lg);
      sp.innerHTML = '<i style="background:' + SET_COLOR[k] + '"></i>' +
        (SET_WORD[k] || loc(SETS[k].label)) + (k === currentSet ? ' (' + tr('active') + ')' : '');
    });
    el('span', null, lg, tr('legBreather'));
  }

  /* Tier as bars, the win rate players actually get as a line on top. The two
   * disagree often enough that showing only tiers would mislead. */
  function drawActive() {
    var box = clear($('curveActive'));
    var spec = setSpec(), key = currentSet;
    var ts = tiersOf(key), n = ts.length;
    var mea = measuredSet[key];
    if (!ts.some(Boolean)) {
      el('div', 'flag', box).innerHTML =
        tr('setWord') + ' <b>' + (SET_WORD[key] || loc(setSpec().label)) + '</b> ' + tr('noTierSet');
      if (mea) {
        var W2 = 660, H2 = 150, pl = 32, pr = 34, pb = 22, pt = 10;
        var bw2 = (W2 - pl - pr) / n;
        function Yw2(w) { return pt + (1 - w) * (H2 - pt - pb); }
        var g = '<svg viewBox="0 0 ' + W2 + ' ' + H2 + '" style="width:100%;height:auto">';
        g += '<rect width="' + W2 + '" height="' + H2 + '" fill="#10131a" rx="8"/>';
        [0.5, 1].forEach(function (w) {
          g += '<line x1="' + pl + '" y1="' + Yw2(w) + '" x2="' + (W2 - pr) + '" y2="' + Yw2(w) +
               '" stroke="#242936"/><text x="' + (W2 - pr + 4) + '" y="' + (Yw2(w) + 3) +
               '" fill="#93a0b3" font-size="9">' + Math.round(w * 100) + '%</text>';
        });
        [['winCareful', '#4ec97a'], ['winAvg', '#4a90d9'], ['winSloppy', '#e05c4c']].forEach(function (m) {
          var pts = mea.map(function (r, i) { return r ? (pl + i * bw2 + bw2 * 0.5) + ',' + Yw2(r[m[0]]) : null; }).filter(Boolean);
          if (pts.length > 1) g += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + m[1] + '" stroke-width="2"/>';
        });
        for (var q = 0; q < n; q++) {
          g += '<text x="' + (pl + q * bw2 + bw2 * 0.5) + '" y="' + (H2 - 6) +
               '" fill="#93a0b3" font-size="9" text-anchor="middle">' + (q + 1) + '</text>';
        }
        g += '</svg>';
        var wrap = el('div', null, box);
        wrap.innerHTML = g;
        el('div', 'legend', box).innerHTML =
          '<span><i style="background:#4ec97a"></i>' + tr('legWinC') + '</span>' +
          '<span><i style="background:#4a90d9"></i>' + tr('legWinA') + '</span>' +
          '<span><i style="background:#e05c4c"></i>' + tr('legWinS') + '</span>';
      }
      return;
    }
    var metric = spec.rhythmOn || 'winAvg';
    var W = 660, H = 230, padL = 32, padR = 34, padB = 24, padT = 12;
    var bw = (W - padL - padR) / n;
    function Yt(t) { return padT + (1 - (t - 1) / 9) * (H - padT - padB); }
    function Yw(w) { return padT + (1 - w) * (H - padT - padB); }

    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto">';
    svg += '<rect width="' + W + '" height="' + H + '" fill="#10131a" rx="8"/>';
    [0.25, 0.5, 0.75, 1].forEach(function (w) {
      svg += '<line x1="' + padL + '" y1="' + Yw(w) + '" x2="' + (W - padR) + '" y2="' + Yw(w) +
             '" stroke="#242936"/><text x="' + (W - padR + 4) + '" y="' + (Yw(w) + 3) +
             '" fill="#93a0b3" font-size="9">' + Math.round(w * 100) + '%</text>';
    });
    for (var i = 0; i < n; i++) {
      var t = ts[i];
      if (!t) continue;
      var isB = (spec.breathers || []).indexOf(SETS[key].levels[i].id) >= 0;
      var h = (H - padT - padB) * ((t - 1) / 9);
      svg += '<rect x="' + (padL + i * bw + bw * 0.2) + '" y="' + (H - padB - h) +
             '" width="' + (bw * 0.6) + '" height="' + h + '" rx="2" fill="' +
             (isB ? '#3f9c5a' : '#3d4657') + '"/>';
      svg += '<text x="' + (padL + i * bw + bw * 0.5) + '" y="' + (H - padB - h - 4) +
             '" fill="#c8d0dc" font-size="9" text-anchor="middle">' + t + '</text>';
    }
    if (mea) {
      [['winCareful', '#4ec97a'], ['winAvg', '#4a90d9'], ['winSloppy', '#e05c4c']].forEach(function (m) {
        var pts = mea.map(function (r, i) {
          return r ? (padL + i * bw + bw * 0.5) + ',' + Yw(r[m[0]]) : null;
        }).filter(Boolean);
        if (pts.length > 1) {
          svg += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + m[1] +
                 '" stroke-width="' + (m[0] === metric ? 2.6 : 1.5) + '"' +
                 (m[0] === metric ? '' : ' opacity=".55"') + '/>';
        }
      });
    }
    for (var j = 0; j < n; j++) {
      svg += '<text x="' + (padL + j * bw + bw * 0.5) + '" y="' + (H - 7) +
             '" fill="#93a0b3" font-size="9" text-anchor="middle">' + (j + 1) + '</text>';
    }
    svg += '<text x="4" y="' + (padT + 8) + '" fill="#93a0b3" font-size="9">' + tr('legTier') + ' 10</text>';
    svg += '</svg>';
    box.innerHTML = svg;
    var lg = el('div', 'legend', box);
    lg.innerHTML =
      '<span><i style="background:#3d4657;height:8px"></i>' + tr('legTier') + '</span>' +
      '<span><i style="background:#3f9c5a;height:8px"></i>' + tr('legTierB') + '</span>' +
      (mea ? '<span><i style="background:#4ec97a"></i>' + tr('legWinC') + '</span>' +
             '<span><i style="background:#4a90d9"></i>' + tr('legWinA') + '</span>' +
             '<span><i style="background:#e05c4c"></i>' + tr('legWinS') + '</span>' +
             '<span>' + tr(metric === 'winSloppy' ? 'legRhythmSlo' : 'legRhythmAvg') + '</span>'
          : '<span>' + tr('pressMeasure') + '</span>');
  }

  function miniThumb(parent, L) {
    var g = el('div', 'miniThumb', parent);
    g.style.gridTemplateColumns = 'repeat(' + L.cols + ', 8px)';
    var target = T.assignTargets(L);
    for (var r = 0; r < L.rows; r++) {
      for (var c = 0; c < L.cols; c++) {
        var spec = String(L.grid[c][r]);
        var hidden = spec.charAt(0) === '?';
        var color = hidden ? spec.slice(1) : spec;
        var rev = color === E.REV;
        var stray = !rev && !hidden && color !== target[c];
        var n = el('i', (rev ? 'rev' : '') + (hidden ? ' hid' : '') + (stray ? ' stray' : ''), g);
        if (!rev && !hidden) n.style.background = colorHex(color);
      }
    }
  }

  function drawLevels() {
    var box = clear($('curveLevels'));
    var spec = setSpec(), key = currentSet, mea = measuredSet[key];
    levels.forEach(function (L, i) {
      var tier = L.tier;
      var tpl = tier ? DF.TEMPLATES['t' + tier] : null;
      var isB = (spec.breathers || []).indexOf(L.id != null ? L.id : i + 1) >= 0;
      var row = el('div', 'lvRow' + (isB ? ' breather' : ''), box);

      var no = el('div', 'no', row);
      no.innerHTML = '<b>' + (L.id != null ? L.id : i + 1) + '</b>' + (tier ? I.t('tierShort') + ' ' + tier : '');
      miniThumb(row, L);

      var txt = el('div', 'txt', row);
      el('div', 'feel', txt, tpl ? loc(tpl.feel) : tr('noTierRow'));
      var meta = el('div', 'meta', txt);
      meta.innerHTML = L.cols + '×' + L.rows + ' · ' + tr('budget') + ' ' + L.moves +
        (tpl ? ' · ' + tr('group') + ' ' + I.loc(tpl.group) : '') +
        (isB ? ' · <span class="bt">' + tr('breatherTag') + '</span>' : '');

      var barBox = el('div', null, row);
      if (mea && mea[i]) {
        winBars(barBox, { medians: mea[i] });
      } else if (tpl) {
        winBars(barBox, tpl);
        el('div', 'meta', barBox, tr('tierEstimate'));
      }
    });
  }

  function renderCurveTab() {
    if (!SETS) return;
    var spec = setSpec();
    var nB = (spec.breathers || []).length;
    var ts = tiersOf(currentSet).filter(Boolean);
    $('curveWho').innerHTML = tr('setWord') + ' <b>' + (SET_WORD[currentSet] || loc(spec.label)) + '</b>' +
      (ts.length ? ' · ' + tierRange(currentSet) : '') +
      (nB ? ' · ' + nB + ' ' + tr('breathersN') : '');
    drawCompare();
    drawActive();
    drawLevels();
  }

  function measureWholeSet() {
    var key = currentSet;
    var btn = $('curveMeasure');
    btn.disabled = true;
    var items = levels.map(function (L, i) { return { at: i, level: JSON.parse(JSON.stringify(L)) }; });
    var out = [], k = 0;
    function step() {
      if (k >= items.length) {
        measuredSet[key] = out;
        btn.disabled = false;
        $('curveProgress').textContent = '';
        renderCurveTab();
        return;
      }
      $('curveProgress').textContent = (k + 1) + '/' + items.length;
      setTimeout(function () {
        var m = T.measure(items[k].level, 700);
        out.push(m.valid ? { winCareful: m.winCareful, winAvg: m.winAvg, winSloppy: m.winSloppy } : null);
        k++;
        step();
      }, 0);
    }
    step();
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
    drawBoard();
    renderTop();
    logMoves();
    hideResult();
    note(I.m('logContinue', extra, continuesUsed, MAX_CONTINUE));
  }

  function resultPlan(s) {
    var done = s.locked.filter(Boolean).length;

    if (s.status === 'won') {
      var spare = s.movesLeft;
      var last = idx >= levels.length - 1;
      var plan = {
        title: tr('cleared'),
        sub: I.m('resWinSub', s.movesUsed, s.budget, spare),
        primary: last
          ? { label: tr('replayLevel'), fn: restart }
          : { label: I.m('resNextLevel', levels[idx + 1].id != null ? levels[idx + 1].id : idx + 2), fn: goNextLevel },
        secondary: last
          ? [{ label: tr('backToFirst'), fn: function () { loadLevel(0); renderSetTable(); } }]
          : [{ label: tr('replay'), fn: restart }]
      };
      var a = analysisCache[idx];
      if (spare / s.budget > 0.5) {
        plan.note = I.m('resTooLoose', spare, s.budget);
      } else if (spare <= 1) {
        plan.note = I.m('resTight', spare);
      }
      return plan;
    }

    /* lost */
    var need = movesNeededFrom(s);
    var plan2 = { title: tr('outOfMoves'), sub: I.m('resLoseSub', done, s.cols, s.movesUsed) };

    if (!need) {
      plan2.primary = { label: tr('replay'), fn: restart };
      plan2.secondary = [{ label: tr('undoOne'), fn: undo }];
      plan2.note = I.m('resUnknown');
      return plan2;
    }

    var canContinue = continuesUsed < MAX_CONTINUE && need.n <= CONTINUE_MOVES;
    if (canContinue) {
      plan2.primary = { label: '+' + CONTINUE_MOVES + ' ' + tr('continueFor'), fn: function () { continueRun(CONTINUE_MOVES); } };
      plan2.secondary = [{ label: tr('replay'), fn: restart }];
      plan2.note = I.m('resSellMoment', need.n);
      return plan2;
    }

    plan2.primary = { label: tr('replay'), fn: restart };
    plan2.secondary = [{ label: tr('undoOne'), fn: undo }];
    if (continuesUsed >= MAX_CONTINUE) {
      plan2.note = I.m('resNoContinue', MAX_CONTINUE);
    } else {
      plan2.note = I.m('resTooFar', need.n, need.exact ? '' : '~', CONTINUE_MOVES);
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
    el('div', 'result-tap', card, tr('tapAnywhere') + ' ' + plan.primary.label.replace(/^[↺+]\s*/, '').toLowerCase());
    if (plan.note) el('div', 'result-note', card).innerHTML = plan.note;

    /* tapping anywhere outside the card takes the smart action */
    resultNode.onclick = plan.primary.fn;
  }

  /* ---------------- tuning history ---------------- */


  /* One entry can cover many levels, so applying a tier across a range is a
   * single Hoàn tác rather than eight. */
  function applyLevelChanges(items, label) {
    var snap = items.map(function (it) {
      return { at: it.at, level: JSON.parse(JSON.stringify(levels[it.at])) };
    });
    levelHistory.push({ label: label, items: snap });
    items.forEach(function (it) { levels[it.at] = it.level; });
    analysisCache = {};
    lastMeasure = null;
    loadLevel(items.length === 1 ? items[0].at : idx);
    renderSetTable();
    renderBanner();
  }

  function applyLevelChange(newLevel, label) {
    applyLevelChanges([{ at: idx, level: newLevel }], label);
  }

  function revertLevelChange() {
    var last = levelHistory.pop();
    if (!last) return;
    last.items.forEach(function (it) { levels[it.at] = it.level; });
    analysisCache = {};
    lastMeasure = null;
    loadLevel(Math.min(last.items[0].at, levels.length - 1));
    renderSetTable();
    renderBanner();
    note(I.m('logReverted', last.label));
  }

  function renderBanner() {
    var box = clear($('tuneBanner'));
    if (!levelHistory.length) return;
    var last = levelHistory[levelHistory.length - 1];
    var what = el('span', 'what', box);
    what.innerHTML = I.m('xTrying', last.label);
    el('span', 'grow', box);
    var play = el('button', 'primary', box, I.m('xTryPlay'));
    play.addEventListener('click', function () { switchTab('play'); restart(); });
    var keep = el('button', null, box, I.m('xKeep'));
    keep.addEventListener('click', function () {
      levelHistory.length = 0;
      renderBanner();
      note(I.m('logKept'));
    });
    var back = el('button', null, box, I.m('xUndoN', levelHistory.length));
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
    metricCard(box, 'grid', L.cols + '×' + L.rows, I.m('mCars', L.cols * L.rows + 1));
    metricCard(box, tr('budget'), String(L.moves));
    var v = E.validate(L);
    metricCard(box, tr('colorCount'), String(Object.keys(v.counts || {}).filter(function (k) { return k !== REV; }).length),
               v.hidden ? I.m('mHiddenN', v.hidden) : I.m('mNoHidden'), '', 'mau-cot');
    if (!a) {
      metricCard(box, I.m('mAnalysis'), '—', I.m('mNotMeasured'));
      return;
    }
    metricCard(box, 'minMoves', String(a.minMoves) + (a.exact ? '' : '~'), I.m(a.exact ? 'mOptimal' : 'mGreedyMaybe'));
    metricCard(box, 'slack', a.slack ? a.slack.toFixed(1) + 'x' : '—', I.m('mBudgetOver'), slackClass(a.slack));
    metricCard(box, 'forced', pct(a.forcedRatio), I.m('mNoChoice'));
    metricCard(box, 'choice', pct(a.choiceRatio), I.m('mTwoPlus'), choiceClass(a.choiceRatio), 'do-sau');
    metricCard(box, 'dump', pct(a.dumpRatio), I.m('mDumpNote'));
    metricCard(box, 'naiveWin', pct(a.naive.winRate), I.m('mGreedyPlayer'), naiveClass(a.naive.winRate), 'naive-win');
  }

  function analyzeCurrent() {
    var L = level();
    var v = E.validate(L);
    if (!v.ok) { renderTuneFlags(null, v); return; }
    var btn = $('analyze');
    btn.disabled = true; btn.textContent = tr('running');
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
        ? I.m('xSolLen', a.solution.length, a.exact ? tr('optimalSuffix') : ' (greedy)',
              a.solution.map(function (c) { return c + 1; }).join(' → '), a.nodes, a.solveMs)
        : I.m('xNoSolNodes', a.nodes);
      btn.disabled = false; btn.textContent = tr('analyzeThis');
      renderSetTable();
    }, 20);
  }

  function renderTuneMetrics(a) {
    var box = clear($('tuneMetrics'));
    if (!a) return;
    metricCard(box, 'minMoves', String(a.minMoves) + (a.exact ? '' : '~'), I.m(a.exact ? 'mIdaOptimal' : 'mGreedyUpper'), '', 'minmoves');
    metricCard(box, tr('budget'), String(a.budget));
    metricCard(box, 'slack', a.slack ? a.slack.toFixed(2) + 'x' : '—', I.m('mBudgetOver'), slackClass(a.slack), 'slack');
    metricCard(box, 'forced', pct(a.forcedRatio), null, '', 'forced-choice-dump');
    metricCard(box, 'choice', pct(a.choiceRatio), I.m('mRealDecide'), choiceClass(a.choiceRatio), 'do-sau');
    metricCard(box, 'dump', pct(a.dumpRatio), I.m('mDumpNote'), '', 'forced-choice-dump');
    metricCard(box, 'branch', a.branchFactor ? a.branchFactor.toFixed(1) : '—', I.m('mBranchNote'));
    metricCard(box, 'naiveWin', pct(a.naive.winRate), I.m('mPlayoutN', a.naive.runs), naiveClass(a.naive.winRate), 'naive-win');
    metricCard(box, tr('mOutOfMoves'), pct(a.naive.outOfMoves), I.m('mLostBudget'));
    metricCard(box, 'naive moves', a.naive.avgMoves ? a.naive.avgMoves.toFixed(1) : '—', I.m('mWhenWon'));
    metricCard(box, tr('hiddenCars'), String(a.hidden), null, '', 'xe-an');
    if (a.trap) {
      metricCard(box, 'trap', a.trap.avgExtraMoves == null ? '—' : '+' + a.trap.avgExtraMoves.toFixed(1),
                 I.m('mTrapNote', a.trap.samples), '', 'trap');
    }
  }

  function renderTuneFlags(a, v) {
    var box = clear($('tuneFlags'));
    if (v && !v.ok) {
      v.errors.forEach(function (e) { el('div', 'flag bad', box, '✖ ' + e); });
      return;
    }
    if (!a) { el('div', 'flag', box, I.m('xNotMeasured')); return; }
    var f = [];
    if (a.unsolvable) f.push(['bad', I.m('vUnsolvable')]);
    if (a.slack != null) {
      if (a.slack > 3) f.push(['bad', I.m('vSlackLoose', a.slack.toFixed(1), Math.ceil(a.minMoves * 1.6), a.budget)]);
      else if (a.slack < 1.15) f.push(['warn', I.m('vSlackTight', a.slack.toFixed(2))]);
      else f.push(['good', I.m('vSlackOk', a.slack.toFixed(2))]);
    }
    if (a.choiceRatio != null) {
      if (a.choiceRatio < 0.1) f.push(['bad', I.m('vChoiceLow', pct(a.choiceRatio))]);
      else if (a.choiceRatio < 0.25) f.push(['warn', I.m('vChoiceMid', pct(a.choiceRatio))]);
      else f.push(['good', I.m('vChoiceOk', pct(a.choiceRatio))]);
    }
    if (a.naive.winRate > 0.97) f.push(['bad', I.m('vNaiveHigh', pct(a.naive.winRate))]);
    else if (a.naive.winRate < 0.35) f.push(['warn', I.m('vNaiveLow', pct(a.naive.winRate))]);
    else f.push(['good', I.m('vNaiveOk', pct(a.naive.winRate))]);
    if (a.hidden && a.hidden / (a.cols * a.rows) > 0.3) {
      f.push(['warn', I.m('vHiddenMuch', pct(a.hidden / (a.cols * a.rows)))]);
    }
    if (!a.exact) f.push(['warn', I.m('vCapped')]);
    f.forEach(function (x) { el('div', 'flag ' + x[0], box, x[1]); });
  }

  /* ---------------- difficulty templates ---------------- */

  function tierThumb(parent, key) {
    var sp = DF.sample(key, PALETTE, 5, 5);
    if (!sp) return;
    var wrap = el('div', null, parent);
    var g = el('div', 'tpl-thumb', wrap);
    g.style.gridTemplateColumns = 'repeat(' + sp.cols + ', 13px)';
    for (var r = 0; r < sp.rows; r++) {
      for (var c = 0; c < sp.cols; c++) {
        var cell = sp.grid[c][r];
        var n = el('i', (cell.rev ? 'rev' : '') + (cell.hidden ? ' hid' : '') + (cell.stray ? ' stray' : ''), g);
        if (!cell.rev && !cell.hidden) n.style.background = colorHex(cell.color);
        n.title = cell.hidden ? tr('xHiddenCell') : cell.rev ? tr('xRevCell')
          : (cell.stray ? I.m('xStrayCell', cell.color) : cell.color);
      }
    }
    el('div', 'thumbLegend', wrap, I.m('xColOfN', sp.colors, sp.cols));
  }

  function winBars(parent, tpl) {
    var box = el('div', 'bars', parent);
    box.title = tr('barsTitle');
    var med = tpl.medians || {};
    [[tr('skillful'), med.winCareful, '#4ec97a'],
     [I.get() === 'vi' ? 'TB' : 'avg', med.winAvg, '#4a90d9'],
     [tr('careless'), med.winSloppy, '#e05c4c']].forEach(function (row) {
      var grp = el('span', 'grp', box);
      el('span', 'who', grp, row[0]);
      var track = el('span', 'track', grp);
      var fill = el('i', null, track);
      fill.style.width = Math.round((row[1] || 0) * 100) + '%';
      fill.style.background = row[2];
      el('span', 'pct', grp, Math.round((row[1] || 0) * 100) + '%');
    });
  }

  function renderTemplates() {
    var box = clear($('tplCards'));
    var m = lastMeasure;
    var L = level();

    if (m && m.valid) {
      var best = DF.classify(L, m);
      $('tplNow').innerHTML = I.m('xClosest', loc(best.name), best.distance.toFixed(2));
    } else {
      $('tplNow').textContent = tr('measureFirst');
    }

    Object.keys(DF.TEMPLATES).forEach(function (key) {
      var tpl = DF.TEMPLATES[key];
      var chk = m && m.valid ? DF.check(L, m, key) : null;
      var sp = DF.sample(key, PALETTE, 5, 5);
      var card = el('div', 'tpl' + (chk && chk.pass === chk.total ? ' match' : ''), box);

      var head = el('div', 'tpl-head', card);
      el('span', 'tpl-name', head, loc(tpl.name));
      el('span', 'tpl-axis', head, tr('axisWord') + ': ' + loc(tpl.axis));
      if (chk) {
        el('span', 'badge ' + (chk.pass === chk.total ? 'good' : chk.pass >= chk.total - 2 ? 'warn' : 'bad'),
           head, chk.pass + '/' + chk.total + ' ' + tr('criteria'));
      }
      el('span', 'grow', head).style.flex = '1';
      var apply = el('button', 'primary', head, tr('applyTo') + ' ' + scopeNow().label);
      apply.addEventListener('click', function () { fitTemplate(key); });
      var reb = el('button', null, head, tr('rebudgetOnly'));
      reb.title = tr('rebudgetT');
      reb.addEventListener('click', function () { rebudgetTemplate(key); });

      var top = el('div', 'tpl-top', card);
      tierThumb(top, key);
      var mid2 = el('div', 'tpl-mid', top);
      winBars(mid2, tpl);

      var strays = 0, hid = 0;
      sp.grid.forEach(function (col) {
        col.forEach(function (x) { if (x.stray) strays++; if (x.hidden) hid++; });
      });
      var det = el('details', 'tpl-why', mid2);
      el('summary', null, det, '▸ ' + loc(tpl.feel));
      var body = el('div', 'body', det);
      body.innerHTML =
        '<div class="tpl-facts">' +
        I.m('xSampleFacts', sp.cols, sp.rows, strays,
            hid ? I.m('mHiddenN', hid) : I.m('mNoHidden'),
            sp.solve ? '. ' + I.m('xSolFor', sp.solve, sp.budget) : '',
            loc(tpl.when), tpl.minCols, tpl.minRows) + '</div>' +
        '<div style="margin-top:6px">' + loc(tpl.focus) + '<br><br>' + loc(tpl.why) + '</div>';

      var warn = DF.sizeWarning(L, key);
      if (warn) el('div', 'flag warn', card, warn).style.marginTop = '8px';

      /* Seven rows per card times ten cards is seventy lines of mostly ticks.
       * Only the criteria that MISS are worth screen space; the badge already
       * carries the score, and the full list is one click away. */
      if (chk) {
        var cbox = el('div', 'tpl-check', card);
        var missed = chk.rows.filter(function (r) { return !r.ok; });
        missed.forEach(function (r) {
          var row = el('div', 'crit', cbox);
          el('span', 'm', row, '✗');
          el('span', 'lbl', row, r.label);
          el('span', null, row, r.value);
          el('span', 'band', row, tr('needWord') + ' ' + r.band);
        });
        var all = el('details', 'tpl-why', cbox);
        el('summary', null, all, missed.length
          ? tr('allCriteria') + ' ' + chk.total + ' ' + tr('criteria')
          : '▸ ' + chk.total + '/' + chk.total + ' ' + tr('seeDetail'));
        var ab = el('div', 'body', all);
        chk.rows.forEach(function (r) {
          var row = el('div', 'crit', ab);
          el('span', r.ok ? 'y' : 'm', row, r.ok ? '✓' : '✗');
          el('span', 'lbl', row, r.label);
          el('span', null, row, r.value);
          el('span', 'band', row, tr('needWord') + ' ' + r.band);
        });
      }
    });
    $('tplJson').value = JSON.stringify(DF.toJSON(), null, 2);
  }

  /* Returns {kind, from, to, label} for whatever the scope control says. */
  function scopeNow() {
    var v = $('tplScope') ? $('tplScope').value : 'one';
    if (v === 'all') {
      return { kind: 'all', from: 0, to: levels.length - 1, label: I.m('allNLevels', levels.length) };
    }
    if (v === 'range') {
      var a = Math.max(1, +$('tplFrom').value || 1) - 1;
      var b = Math.min(levels.length, +$('tplTo').value || levels.length) - 1;
      if (b < a) { var t = a; a = b; b = t; }
      return { kind: 'range', from: a, to: b, label: 'level ' + (a + 1) + '–' + (b + 1) };
    }
    return { kind: 'one', from: idx, to: idx, label: tr('thisLevel') };
  }

  function fitTemplateRange(key, from, to, scopeLabel) {
    var tpl = DF.TEMPLATES[key];
    var items = [];
    for (var i = from; i <= to; i++) {
      if (levels[i] && E.validate(levels[i]).ok) {
        items.push({ at: i, level: JSON.parse(JSON.stringify(levels[i])) });
      }
    }
    if (!items.length) { global.Modal.alert(tr('notGenerated'), I.m('dNoValidLv')); return; }

    var job = null, cancelled = false;
    var prog = global.Modal.open({
      title: tr('applyTo') + ' ' + (scopeLabel || items.length + ' ' + tr('levelsWord')) + ' — ' + loc(tpl.name),
      body: I.m('dPerLevelNote'),
      sticky: true,
      actions: [{ label: tr('cancel'), keepOpen: true, danger: true, fn: function () {
        cancelled = true;
        if (job) job.cancel();
        global.Modal.close();
        note(I.m('logCancelled', loc(tpl.name)));
      } }]
    });
    var bar = document.createElement('div');
    bar.className = 'modal-progress';
    bar.innerHTML = '<i></i>';
    prog.body.appendChild(bar);
    var noteEl = document.createElement('div');
    noteEl.className = 'modal-note';
    prog.body.appendChild(noteEl);

    function finish(results, ms) {
      if (cancelled) return;
      global.Modal.close();
      var applied = results.filter(function (o) { return o.best; })
                           .map(function (o) { return { at: o.at, level: o.best.level }; });
      if (!applied.length) {
        global.Modal.alert(tr('notGenerated'), I.m('dNothingValid', loc(tpl.name)));
        return;
      }
      var allPass = results.every(function (o) { return o.best && o.best.check.pass === o.best.check.total; });
      var rowsHtml = results.map(function (o) {
        var L0 = levels[o.at], b = o.best;
        var id = L0.id != null ? L0.id : o.at + 1;
        if (!b) return '<div class="crit"><span class="m">✗</span><span class="lbl">Level ' + id +
                       '</span><span>—</span><span class="band">' + tr('notGenerated') + '</span></div>';
        var c = b.check, ok = c.pass === c.total;
        return '<div class="crit"><span class="' + (ok ? 'y' : 'm') + '">' + (ok ? '✓' : '✗') +
               '</span><span class="lbl">Level ' + id + '</span><span>' +
               b.level.cols + '×' + b.level.rows + ' · ' + b.level.moves + ' move' +
               '</span><span class="band">' + c.pass + '/' + c.total + ' ' + tr('criteria') + '</span></div>';
      }).join('');

      global.Modal.open({
        title: allPass ? I.m('dGenDone', results.length) : tr('someShort'),
        wide: true,
        body: '<b>' + loc(tpl.name) + '</b> · ' + tr('axisWord') + ': ' + loc(tpl.axis) +
              ' · ' + (ms != null ? (ms / 1000).toFixed(1) + 's' : '') +
              '<div style="margin-top:9px">' + rowsHtml + '</div>' +
              (allPass ? '' : '<div class="flag warn" style="margin-top:8px">' + I.m('dTryHarder') + '</div>') +
              (results.length >= levels.length && levels.length > 3
                ? '<div class="flag warn" style="margin-top:8px">' + I.m('wFlatSet') + '</div>' : ''),
        actions: [
          { label: I.m('dApplyN', applied.length), primary: true, fn: function () {
              applyLevelChanges(applied, loc(tpl.name) + ' × ' + applied.length);
              measureCurrent();
              note(I.m('logTierApplied', loc(tpl.name), applied.length));
            } },
          { label: tr('discard'), fn: function () { renderTemplates(); } }
        ]
      });
    }

    job = workerJob({
      cmd: 'fitRange', items: items, key: key, palette: PALETTE,
      templates: DF.toJSON(), seed: +$('tplSeed').value || 1, runs: 600
    }, function (p) {
      bar.firstChild.style.width = Math.round(p.frac * 100) + '%';
      noteEl.textContent = p.text;
    }, function (d) {
      finish(d.results, d.ms);
    }, function (err) {
      global.Modal.close();
      note(I.m('logWorkerFail', err));
      fitTemplateRangeFallback(key, from, to, scopeLabel);
    });
  }

  /* Used only when Workers are unavailable, e.g. opened over file://. */
  function fitTemplateRangeFallback(key, from, to, scopeLabel) {
    var tpl = DF.TEMPLATES[key];
    var idxs = [];
    for (var i = from; i <= to; i++) if (levels[i] && E.validate(levels[i]).ok) idxs.push(i);
    if (!idxs.length) return;
    var prog = global.Modal.progress(tr('applyTo') + ' ' + (scopeLabel || idxs.length + ' ' + tr('levelsWord')) + ' — ' + loc(tpl.name), '');
    var out = [], k = 0;
    function nextLevel() {
      if (k >= idxs.length) {
        prog.close();
        var applied = out.filter(function (o) { return o.best; })
                         .map(function (o) { return { at: o.at, level: o.best.level }; });
        if (applied.length) applyLevelChanges(applied, tpl.name + ' × ' + applied.length + ' level');
        measureCurrent();
        return;
      }
      var at = idxs[k], L0 = levels[at];
      fitOne(L0, key, (+$('tplSeed').value || 1) + at * 17, function (frac, text) {
        prog.update((k + frac) / idxs.length, 'level ' + (L0.id != null ? L0.id : at + 1) + ' · ' + text);
      }, function (best) { out.push({ at: at, best: best }); k++; nextLevel(); });
    }
    nextLevel();
  }

  function fitTemplate(key) {
    var sc = scopeNow();
    if (sc.kind !== 'one') { fitTemplateRange(key, sc.from, sc.to, sc.label); return; }
    if (!E.validate(level()).ok) { global.Modal.alert(tr('notGenerated'), I.m('dInvalidNow')); return; }
    var tpl = DF.TEMPLATES[key];
    var L = level();
    var steps = fitPlan(L, tpl);
    var grew = steps[0].cols !== L.cols || steps[0].rows !== L.rows;

    var head = '<b>' + loc(tpl.name) + '</b> — ' + tr('axisWord') + ': ' + loc(tpl.axis);
    if (grew) {
      head += '<br>' + I.m('dGrowBoard', L.cols + '×' + L.rows,
        (tpl.minCols || 2) + '×' + (tpl.minRows || 2), steps[0].cols + '×' + steps[0].rows);
    }
    var prog = global.Modal.progress(tr('buildingBoards'), head);

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
        prog.update((si + i / n) / steps.length, I.m('dStepOf', si + 1, steps.length, st.label, i, n));
      }, function (res) {
        if (res && (!best || res.distance < best.distance)) best = res;
        log.push(st.label + ': ' + (res ? res.check.pass + '/' + res.check.total : tr('notGenerated')));
        si++;
        if (best && best.check.pass === best.check.total) finish();
        else runStep();
      });
    }

    function finish() {
      prog.close();
      if (!best) {
        global.Modal.alert(tr('notGenerated'),
          I.m('dNothingValid', '<b>' + loc(tpl.name) + '</b>') + '<br><br>' + log.join('<br>'));
        renderTemplates();
        return;
      }
      var c = best.check, all = c.pass === c.total;
      var lv = best.level;
      var body = '<b>' + loc(tpl.name) + '</b> · ' + lv.cols + '×' + lv.rows +
                 ' · ' + tr('budget') + ' <b>' + lv.moves + '</b>' +
                 (all ? ' · <span style="color:var(--good)">' + tr('metAll') + ' ' + c.total + ' ' + tr('criteria') + '</span>'
                      : ' · <span style="color:var(--warn)">' + tr('met') + ' ' + c.pass + '/' + c.total + '</span>') +
                 '<div style="margin-top:9px">' + critTable(c) + '</div>' +
                 '<ul class="modal-steps">' + log.map(function (l) { return '<li>' + l + '</li>'; }).join('') + '</ul>' +
                 (all ? '' : '<div class="flag warn" style="margin-top:8px">' + I.m('dStepsTried', steps.length) + '</div>');

      global.Modal.open({
        title: all ? tr('builtDone') : tr('nearlyThere'),
        body: body,
        wide: true,
        actions: [
          { label: tr('apply'), primary: true, fn: function () {
              applyLevelChange(lv, loc(tpl.name) + ' ' + lv.cols + '×' + lv.rows);
              lastMeasure = best.measure;
              renderTunerScore(best.measure);
              renderTemplates();
              note(I.m('logTplResult', loc(tpl.name), c.pass, c.total, lv.cols + '×' + lv.rows, lv.moves));
            } },
          { label: tr('rerollSeed'), fn: function () {
              $('tplSeed').value = (+$('tplSeed').value || 1) + 1;
              fitTemplate(key);
            } },
          { label: tr('discard'), fn: function () { renderTemplates(); } }
        ]
      });
    }

    runStep();
  }

  function rebudgetTemplate(key) {
    var m = lastMeasure && lastMeasure.valid ? lastMeasure : T.measure(level(), 600);
    var r = DF.refineBudget(JSON.parse(JSON.stringify(level())), key, 600, m);
    if (!r) { note(I.m('logNoOpt')); return; }
    applyLevelChange(r.level, 'budget theo ' + DF.TEMPLATES[key].name + ' → ' + r.level.moves);
    lastMeasure = r.measure;
    renderTunerScore(r.measure);
    renderTemplates();
    note(I.m('logBudgetSet', r.level.moves, pct(r.measure.winAvg)));
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
    if (!m || !m.valid) { metricCard(box, tr('mDiffLbl'), '—', I.m('logInvalid')); return; }
    metricCard(box, tr('mDiffLbl'), String(m.D), I.m('mDiffNote'), bandClass(m.D), 'do-kho');
    metricCard(box, tr('mDepthLbl'), String(m.depth), I.m('mDepthNote'), m.depth < 10 ? 'bad' : m.depth < 25 ? 'warn' : 'good', 'do-sau');
    metricCard(box, tr('mWinC'), pct(m.winCareful), I.m('mMistake', 2), '', 'loi-tay');
    metricCard(box, tr('mWinA'), pct(m.winAvg), I.m('mMistake', 10), naiveClass(m.winAvg), 'loi-tay');
    metricCard(box, tr('mWinS'), pct(m.winSloppy), I.m('mMistake', 25), '', 'loi-tay');
    metricCard(box, 'slack', m.slack ? m.slack.toFixed(2) + 'x' : '—', I.m('mSlackNote'), slackClass(m.slack), 'slack');
    metricCard(box, tr('strayCars'), String(m.strays), I.m('mStrayNote'), '', 'xe-la');
    metricCard(box, tr('mColCol'), m.colors + ' / ' + level().cols,
               I.m(m.colors < level().cols ? 'mColShare' : 'mColOne'), '', 'mau-cot');
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
    if (!v.ok) { note(I.m('logInvalid')); return; }
    var box = clear($('suggestions'));
    el('div', 'hint', box, I.m('xRunning'));
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
    if (!res.items.length) { el('div', 'hint', box, I.m('xNoOption')); return; }
    el('div', 'hint', box, I.m('xSortHint'));
    res.items.forEach(function (item) {
      var card = el('div', 'card', box);
      var head = el('div', 'row', card);
      head.style.marginBottom = '4px';
      var dK = el('span', 'badge ' + (item.delta > 0 ? 'bad' : item.delta < 0 ? 'good' : ''), head,
                  (item.delta > 0 ? '+' : '') + item.delta + ' ' + tr('xHard'));
      var dD = el('span', 'badge ' + (item.deltaDepth > 0 ? 'good' : item.deltaDepth < 0 ? 'warn' : ''), head,
                  (item.deltaDepth > 0 ? '+' : '') + item.deltaDepth + ' ' + tr('xDeep'));
      var lname = el('b', null, head, loc(item.lever));
      var leverTopic = { 'colors-': 'gop-mau', 'colors+': 'gop-mau', 'strays+': 'xe-la', 'strays-': 'xe-la',
                         'budget-': 'slack', 'budget+': 'slack', 'hidden+': 'xe-an', 'hidden-': 'xe-an',
                         'rows+': 'mau-cot', 'rows-': 'mau-cot' }[item.key];
      if (leverTopic) lname.appendChild(global.Help.badge(leverTopic));
      var apply = el('button', 'primary', head, tr('apply'));
      apply.addEventListener('click', function () {
        applyLevelChange(item.level, loc(item.label));
        measureCurrent();
        note(I.m('logApplied', loc(item.label)));
      });
      var tryIt = el('button', null, head, I.m('xTryPlay'));
      tryIt.addEventListener('click', function () {
        applyLevelChange(item.level, loc(item.label));
        measureCurrent();
        switchTab('play');
      });
      el('div', null, card, loc(item.label));
      el('div', 'hint', card, loc(item.why));
      el('div', 'hint', card, I.m('xAfterApply', pct(item.measure.winCareful), pct(item.measure.winAvg),
        pct(item.measure.winSloppy), item.measure.slack ? item.measure.slack.toFixed(2) + 'x' : '—',
        item.level.moves));
    });
  }

  /* ---------------- 10k playtest ---------------- */

  var lastPt = null;

  var ptWorker = null;
  function getWorker() {
    if (ptWorker !== null) return ptWorker;
    try { ptWorker = new Worker('src/worker.js'); }
    catch (e) { ptWorker = false; }          // file:// blocks workers — fall back
    return ptWorker;
  }

  /* One-shot worker call. onProgress gets {frac, text}. */
  function workerJob(msg, onProgress, onDone, onFail) {
    var w = getWorker();
    if (!w) { onFail('no-worker'); return null; }
    var handler = function (e) {
      var d = e.data;
      if (d.type === 'progress') { if (onProgress) onProgress(d); return; }
      w.removeEventListener('message', handler);
      w.removeEventListener('error', errh);
      if (!d.ok) { onFail(d.error || tr('workerErr')); return; }
      onDone(d);
    };
    var errh = function (err) {
      w.removeEventListener('message', handler);
      w.removeEventListener('error', errh);
      ptWorker = false;
      onFail(err.message || 'worker crash');
    };
    w.addEventListener('message', handler);
    w.addEventListener('error', errh);
    w.postMessage(msg);
    return { cancel: function () {
      w.removeEventListener('message', handler);
      w.removeEventListener('error', errh);
      w.terminate();
      ptWorker = null;                       // next job gets a fresh worker
    } };
  }

  function runPlaytest() {
    var v = E.validate(level());
    if (!v.ok) { note(I.m('logInvalid')); return; }
    var btn = $('runPlaytest');
    btn.disabled = true;
    clear($('ptSummary')); clear($('ptCurve')); clear($('ptHist')); clear($('ptFlags'));
    var L = JSON.parse(JSON.stringify(level()));
    var runs = +$('ptRuns').value || 10000;
    var opts = { blind: $('ptBlind').checked, seed: 4242 };
    $('ptProgress').textContent = tr('running');

    var ok = workerJob({ cmd: 'run', level: L, runs: runs, opts: opts }, null,
      function (d) {
        btn.disabled = false;
        $('ptProgress').textContent = d.report.ms + 'ms';
        lastPt = d.report;
        renderPlaytest(d.report);
      },
      function (err) {
        btn.disabled = false;
        note(I.m('logWorkerFail', err));
        runPlaytestMain(L, runs, opts, btn);
      });
    if (ok) return;

    runPlaytestMain(L, runs, opts, btn);
  }

  function runPlaytestMain(L, runs, opts, btn) {
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
    var heads = [[tr('player'), ''], [tr('mistakeRate'), 'loi-tay'], [tr('winAtBudget') + ' ' + rep.level.moves, ''],
                 [tr('ceilingWord'), 'ceiling'], ['p50', ''], ['p90', ''],
                 [tr('budgetFor') + ' 90%', 'budget-curve'], [tr('budgetFor') + ' 75%', 'budget-curve'],
                 [tr('budgetFor') + ' 60%', 'budget-curve']];
    heads.forEach(function (h) {
      var th = el('th', null, hr, h[0]);
      if (h[1]) th.appendChild(global.Help.badge(h[1]));
    });
    var tb = el('tbody', null, t);
    rep.profiles.forEach(function (p) {
      var tr = el('tr', null, tb);
      tr.style.cursor = 'default';
      el('td', null, tr, loc(p.name));
      el('td', null, tr, Math.round(p.eps * 100) + '%');
      el('td', naiveClass(p.winRateAtBudget) ? 'f-' + naiveClass(p.winRateAtBudget) : '', tr, pct(p.winRateAtBudget));
      el('td', null, tr, pct(p.ceiling));
      el('td', null, tr, String(p.p[0.5] == null ? '—' : p.p[0.5]));
      el('td', null, tr, String(p.p[0.9] == null ? '—' : p.p[0.9]));
      el('td', null, tr, String(p.budgetFor[90] == null ? tr('unreachable') : p.budgetFor[90]));
      el('td', null, tr, String(p.budgetFor[75] == null ? tr('unreachable') : p.budgetFor[75]));
      el('td', null, tr, String(p.budgetFor[60] == null ? tr('unreachable') : p.budgetFor[60]));
    });

    renderPtCurve(rep);
    renderPtHist(rep);

    var f = clear($('ptFlags'));
    var avg = rep.profiles[1];
    if (avg.winRateAtBudget > 0.97) {
      f.appendChild(mkFlag('bad', I.m('pWinTooHigh', rep.level.moves, pct(avg.winRateAtBudget), avg.budgetFor[75])));
    } else if (avg.winRateAtBudget < 0.4) {
      f.appendChild(mkFlag('warn', I.m('pWinTooLow', pct(avg.winRateAtBudget), avg.budgetFor[75])));
    } else {
      f.appendChild(mkFlag('good', I.m('pWinOk', pct(avg.winRateAtBudget), rep.level.moves)));
    }
    if (avg.ceiling < 0.99) {
      f.appendChild(mkFlag('warn', I.m('pNoConverge', pct(1 - avg.ceiling),
        avg.avgColumnsOnLoop == null ? '?' : avg.avgColumnsOnLoop.toFixed(1), rep.level.cols)));
    }
    var spread = rep.profiles[0].winRateAtBudget - rep.profiles[2].winRateAtBudget;
    f.appendChild(mkFlag(spread > 0.3 ? 'good' : 'warn',
      I.m('pSpread', pct(spread), I.m(spread > 0.3 ? 'pSkillPays' : 'pSkillFlat'))));
    var dumps = avg.avgDumps;
    f.appendChild(mkFlag('', I.m('pDumps', dumps.toFixed(1), avg.avgGoodColumns.toFixed(2))));
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
      var sp = el('span', null, legend, '■ ' + loc(p.name) + '  ');
      sp.style.color = colors[i];
    });
    el('span', null, legend, ' — ' + tr('curveNote'));
  }

  function renderPtHist(rep) {
    var box = clear($('ptHist'));
    var p = rep.profiles[1];
    var keys = Object.keys(p.histogram).map(Number).sort(function (a, b) { return a - b; });
    if (!keys.length) { el('div', 'hint', box, tr('noWins')); return; }
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
    el('div', 'hint', box, tr('histNote'));
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
    r.title = tr('revCarName');
    r.addEventListener('click', function () { brush = REV; renderBrushes(); });
  }

  function cellNode(spec, onPaint, onToggle) {
    var hidden = String(spec).charAt(0) === '?';
    var color = hidden ? String(spec).slice(1) : String(spec);
    var n = el('div', 'editCell' + (hidden ? ' hid' : '') + (color === REV ? ' rev' : ''));
    if (color !== REV) n.style.background = colorHex(color);
    n.title = color + (hidden ? tr('hiddenSuffix') : '');
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
    $('solutionLog').textContent = tr('levelChanged');
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
      el('span', null, pill, k + ' ' + n + (k === REV ? '' : ' (' + I.m('xCols', (n / L.rows).toFixed(2).replace('.00', '')) + ')'));
    });
    var fl = clear($('editFlags'));
    if (v.ok) {
      el('div', 'flag good', fl, I.m('xValidOk', v.total, L.cols, L.rows, v.padCandidates.join(', ')));
    } else {
      v.errors.forEach(function (e) { el('div', 'flag bad', fl, '✖ ' + e); });
      el('div', 'flag warn', fl, I.m('xValidRule', L.rows));
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
    note(ab ? I.m('logGen', ab.minMoves + (ab.exact ? '' : '~'), ab.budget) : I.m('logGenNoMin'));
  }

  /* ---------------- feel ---------------- */

  function renderFeel() {
    var box = clear($('feelSliders'));
    F.SLIDERS.forEach(function (def) {
      var key = def[0], label = loc(def[1]), min = def[2], max = def[3], step = def[4], unit = def[5];
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
          if (key === 'carScale' || key === 'cellGap' || key === 'shadowStrength' || key === 'shapeCount') {
            drawBoard();
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
    ['lv', tr('colSize'), tr('colorCount'), tr('hiddenWord'), tr('budget'), 'min', 'slack', 'forced', 'choice', 'dump', 'naiveWin'].forEach(function (h) {
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
    if (!have.some(Boolean)) { el('div', 'hint', box, tr('runAllForCurve')); return; }
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
    el('div', 'hint', box, I.m('setCurveLegend', maxMin));
  }

  function runAll() {
    var btn = $('runAll');
    btn.disabled = true;
    var i = 0;
    (function step() {
      if (i >= levels.length) {
        btn.disabled = false; btn.textContent = tr('analyzeAll');
        renderSetTable(); renderPlayMetrics(analysisCache[idx]);
        return;
      }
      btn.textContent = tr('runningOf') + ' ' + (i + 1) + '/' + levels.length + '…';
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
      version: 2,
      note: I.m('exportNote'),
      palette: pal,
      feel: F.toJSON(),
      currentSet: currentSet,
      sets: SETS ? SET_ORDER.reduce(function (acc, k) {
        acc[k] = {
          name: SETS[k].name, label: SETS[k].label, intent: SETS[k].intent,
          breathers: SETS[k].breathers, rhythmOn: SETS[k].rhythmOn,
          levels: SETS[k].levels
        };
        return acc;
      }, {}) : undefined,
      levels: levels.map(function (L, i) {
        var o = { id: L.id != null ? L.id : i + 1, cols: L.cols, rows: L.rows, moves: L.moves };
        if (L.theme) o.theme = L.theme;
        if (L.tutorial) o.tutorial = L.tutorial;
        if (L.unlock) o.unlock = L.unlock;
        if (lockedTier[i]) o.tier = lockedTier[i];
        else if (tierOf[i]) o.tierWorking = tierOf[i];
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
    try { data = JSON.parse(txt); } catch (e) { global.Modal.alert(tr('dJsonErr'), e.message); return; }
    if (!data.levels || !data.levels.length) { global.Modal.alert(tr('dImportErr'), I.m('dNoLevels')); return; }
    if (data.palette) Object.assign(PALETTE, data.palette);
    if (data.feel) { F.load(data.feel); renderFeel(); }
    if (data.sets && SETS) {
      Object.keys(data.sets).forEach(function (k) { SETS[k] = data.sets[k]; });
      currentSet = data.currentSet && SETS[data.currentSet] ? data.currentSet : SET_ORDER[0];
      levels = SETS[currentSet].levels;
      renderSetPick();
    } else {
      levels = data.levels;
    }
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
    b.disabled = true; b.textContent = tr('measuring');
    $('analyzePlayNote').textContent = '';
    setTimeout(function () {
      analyzeCurrent();
      measureCurrent();
      b.disabled = false; b.textContent = tr('measureAgain');
      var a = analysisCache[idx];
      $('analyzePlayNote').textContent = a && a.minMoves != null
        ? tr('solutionIs') + ' ' + a.minMoves + (a.exact ? '' : '~') + ' move · ' + tr('budget') + ' ' + level().moves
        : '';
    }, 20);
  });
  Array.prototype.forEach.call(document.querySelectorAll('#modeSwitch button'), function (b) {
    b.addEventListener('click', function () { setMode(b.dataset.mode); });
  });
  renderSetPick();
  $('curveMeasure').addEventListener('click', measureWholeSet);
  $('journalClear').addEventListener('click', function () {
    global.Modal.open({
      title: tr('dClearLogQ'),
      body: I.m('dClearLogB', attempts.length),
      actions: [
        { label: tr('dDelete'), danger: true, fn: function () { attempts = []; renderJournal(); } },
        { label: tr('dKeep'), primary: true, fn: function () {} }
      ]
    });
  });
  $('journalCopy').addEventListener('click', function () {
    var out = {
      tiers: levels.map(function (L, i) {
        return { level: L.id != null ? L.id : i + 1, tier: lockedTier[i] || null, working: tierOf[i] || null };
      }),
      attempts: attempts
    };
    var ta = document.createElement('textarea');
    ta.value = JSON.stringify(out, null, 2);
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    note(I.m('logCopied', attempts.length));
  });
  $('helpGuide').addEventListener('click', function () { showGuide(true); });
  $('boardToggle').addEventListener('click', function () { setBoardVisible(!boardVisible); });
  $('tplScope').addEventListener('change', function () {
    $('tplRange').style.display = this.value === 'range' ? '' : 'none';
    if (!(+$('tplTo').value > 0) || +$('tplTo').value > levels.length) $('tplTo').value = levels.length;
    renderTemplates();
  });
  ['tplFrom', 'tplTo'].forEach(function (id) {
    $(id).addEventListener('change', renderTemplates);
  });
  $('tplLoad').addEventListener('click', function () {
    try {
      DF.load(JSON.parse($('tplJson').value));
      renderTemplates();
      note(I.m('logTplLoaded'));
    } catch (e) { global.Modal.alert(tr('dTplJsonErr'), e.message); }
  });
  $('tplReset').addEventListener('click', function () {
    DF.load(DEFAULT_TEMPLATES);
    renderTemplates();
    note(I.m('logTplReset'));
  });
  $('wantHarder').addEventListener('click', function () { askSuggestions('harder'); });
  $('wantEasier').addEventListener('click', function () { askSuggestions('easier'); });
  $('runPlaytest').addEventListener('click', runPlaytest);
  $('applyBudget').addEventListener('click', function () {
    var a = analysisCache[idx];
    if (!a || a.minMoves == null) { note(I.m('logAnalyzeFirst')); return; }
    var nb = JSON.parse(JSON.stringify(level()));
    nb.moves = Math.max(1, Math.ceil(a.minMoves * (+$('slackTarget').value || 1.6)));
    applyLevelChange(nb, 'budget → ' + nb.moves);
  });

  $('edCols').addEventListener('change', function () { resizeLevel(+this.value, level().rows); });
  $('edRows').addEventListener('change', function () { resizeLevel(level().cols, +this.value); });
  $('edMoves').addEventListener('change', function () { level().moves = Math.max(1, +this.value); afterEdit(); });
  $('edTheme').addEventListener('change', function () { level().theme = this.value; loadLevel(idx); });
  $('genBtn').addEventListener('click', generateInto);

  $('feelPreset').addEventListener('change', function () { F.applyPreset(this.value); renderFeel(); drawBoard(); });
  $('feelReset').addEventListener('click', function () { F.reset(); renderFeel(); drawBoard(); });
  $('sfxOn').addEventListener('change', function () { F.set('sfxOn', this.checked ? 1 : 0); syncFeelJson(); });
  $('useSprites').addEventListener('change', function () {
    F.set('sprites', this.checked ? 1 : 0);
    syncFeelJson();
    drawBoard();
  });
  $('feelLoad').addEventListener('click', function () {
    try { F.load(JSON.parse($('feelJson').value)); renderFeel(); drawBoard(); }
    catch (e) { global.Modal.alert(tr('dFeelJsonErr'), e.message); }
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
      if (b.dataset.tab === 'journal') renderJournal();
      if (b.dataset.tab === 'curve') renderCurveTab();
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
    else if (e.key === 'b' || e.key === 'B') setBoardVisible(!boardVisible);
    else if (e.key === 'ArrowLeft') { loadLevel(idx - 1); renderSetTable(); }
    else if (e.key === 'ArrowRight') { loadLevel(idx + 1); renderSetTable(); }
  });

  /* The first render can land before fonts and layout settle, which leaves the
   * board measured against a stale box until something triggers a resize. */
  requestAnimationFrame(function () { requestAnimationFrame(drawBoard); });
  window.addEventListener('load', drawBoard);

  var rt = null;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(drawBoard, 120);
  });

  fetch('src/tool.js', { method: 'HEAD', cache: 'no-store' }).then(function (r) {
    var t = r.headers.get('Last-Modified');
    var d = t ? new Date(t) : null;
    $('buildStamp').textContent = 'build ' + (d
      ? d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      : '?');
  }).catch(function () { $('buildStamp').textContent = 'build ?'; });

  I.apply();
  I.onChange(function () {
    I.apply();
    renderFeel();
    renderSetPick();
    renderTemplates();
    renderPlaytuneBar();
    renderJournal();
    renderCurveTab();
    renderSetTable();
    renderBanner();
    setMode(mode);
    setBoardVisible(boardVisible);
    if (state) { renderTop(); logMoves(); showResult(); }
    if (lastPt) renderPlaytest(lastPt);
    renderPlayMetrics(analysisCache[idx]);
  });
  $('langToggle').addEventListener('click', function () { I.set(I.get() === 'vi' ? 'en' : 'vi'); });

  renderBrushes();
  renderFeel();
  renderTemplates();
  renderBanner();
  setMode('test');
  setBoardVisible(true);
  loadLevel(0);
  renderJournal();
  renderCurveTab();
  showGuide(false);

  /* Sprites arrive asynchronously; redraw once they do. */
  if (global.Sprites) {
    global.Sprites.load().then(function (n) {
      if (n) drawBoard();
      if (n) note(I.m('logShapes', n));
    });
  }
  renderSetTable();
  global.CarTool = {
    levels: function () { return levels; },
    /* Scripting hooks — assign tiers from the console without replaying, and
     * read back the ramp complaints. */
    lockTierAt: function (i, t) {
      lockedTier[i] = t; tierOf[i] = t;
      renderJournal(); renderPlaytuneBar(); renderSetTable();
      return curveWarnings();
    },
    tiers: function () { return { working: tierOf, locked: lockedTier }; },
    attempts: function () { return attempts; },
    curveWarnings: function () { return curveWarnings(); },
    stateNow: function () { return state; },
    analysis: function () { return analysisCache; },
    load: loadLevel
  };
})(window);
