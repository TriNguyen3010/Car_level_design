/* Board renderer. Owns geometry and animation only — it never decides anything
 * about the puzzle. Every duration and easing comes from Feel, which is the
 * whole point: game feel is tuned here without touching the rules. */
(function (global) {
  'use strict';

  var E = global.Engine, F = global.Feel;
  var REV = 'REV';

  function el(tag, cls, parent) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (parent) parent.appendChild(n);
    return n;
  }

  function spriteFor(car, palette) {
    var kind = car.hidden ? 'hidden' : car.color;
    var Sp = global.Sprites;
    if (Sp && Sp.count()) {
      var limit = Math.max(1, Math.min(Sp.count(), F.get('shapeCount') || 1));
      return Sp.get(kind, (car.shape || 0) % limit, palette);
    }
    var pattern = F.get('spritePath') || 'assets/car_{color}.png';
    return pattern.replace('{color}', car.hidden ? 'hidden' : (car.color === REV ? 'wrongway' : car.color));
  }

  function Renderer(stage, opts) {
    this.stage = stage;
    this.opts = opts || {};
    this.palette = this.opts.palette || {};
    this.cars = {};                 // car id -> element
    this.gates = [];
    this.hits = [];
    this.state = null;
    this.geom = null;
    this.busy = false;
    this.onTapColumn = this.opts.onTapColumn || function () {};

    stage.innerHTML = '';
    stage.classList.add('stage');
    this.lot = el('div', 'lot', stage);
    this.lotInner = el('div', 'lot-inner', this.lot);
    this.gateRow = el('div', 'gate-row', stage);
    this.padSpot = el('div', 'pad-spot', stage);
    this.carLayer = el('div', 'car-layer', stage);
    this.hitLayer = el('div', 'hit-layer', stage);
    this.fxLayer = el('div', 'fx-layer', stage);
  }

  Renderer.prototype.measure = function () {
    var s = this.state, box = this.stage.getBoundingClientRect();
    var W = box.width, H = box.height;
    var margin = Math.max(10, W * 0.035);
    var lotPad = Math.max(6, W * 0.018);
    var gateH = Math.max(22, H * 0.032);
    var padZone = Math.max(84, H * 0.17);

    var availW = W - margin * 2 - lotPad * 2;
    var availH = H - margin - gateH - padZone - lotPad * 2;
    var cell = Math.min(availW / s.cols, availH / s.rows);
    cell = Math.max(24, cell);

    var lotW = cell * s.cols + lotPad * 2;
    var lotH = cell * s.rows + lotPad * 2;
    var lotX = (W - lotW) / 2;
    var lotY = margin;

    this.geom = {
      W: W, H: H, cell: cell, lotPad: lotPad, gateH: gateH,
      lotX: lotX, lotY: lotY, lotW: lotW, lotH: lotH,
      innerX: lotX + lotPad, innerY: lotY + lotPad,
      padX: (W - cell) / 2,
      padY: lotY + lotH + gateH + Math.max(18, H * 0.035)
    };

    var g = this.geom;
    this.lot.style.cssText = 'left:' + g.lotX + 'px;top:' + g.lotY + 'px;width:' + g.lotW + 'px;height:' + g.lotH + 'px';
    this.lotInner.style.cssText = 'inset:' + g.lotPad + 'px';
    this.gateRow.style.cssText = 'left:' + g.innerX + 'px;top:' + (g.lotY + g.lotH) + 'px;width:' + (g.cell * s.cols) + 'px;height:' + g.gateH + 'px';
    this.padSpot.style.cssText = 'left:' + (g.padX - g.cell * 0.22) + 'px;top:' + (g.padY + g.cell * 0.42) + 'px;width:' + (g.cell * 1.44) + 'px;height:' + (g.cell * 0.62) + 'px';
    return g;
  };

  Renderer.prototype.slotPos = function (c, r) {
    var g = this.geom;
    return { x: g.innerX + c * g.cell, y: g.innerY + r * g.cell };
  };

  Renderer.prototype.carBox = function () {
    var g = this.geom, scale = F.get('carScale'), gap = F.get('cellGap');
    var w = g.cell * scale * (1 - gap);
    return { w: w, h: w * 1.14, offX: (g.cell - w) / 2, offY: (g.cell - w * 1.14) / 2 };
  };

  Renderer.prototype.colorOf = function (car) {
    if (car.color === REV) return '#3a4050';
    return this.palette[car.color] || car.color || '#888';
  };

  Renderer.prototype.buildCar = function (car) {
    var node = el('div', 'car');
    el('div', 'car-body', node);
    el('div', 'car-roof', node);
    el('div', 'car-glass', node);
    el('div', 'car-grill', node);
    var lights = el('div', 'car-lights', node);
    el('i', null, lights); el('i', null, lights);
    var eyes = el('div', 'car-eyes', node);
    el('i', null, eyes); el('i', null, eyes);
    el('div', 'car-sign', node);
    var q = el('div', 'car-q', node);
    q.textContent = '?';
    var sprite = document.createElement('img');
    sprite.className = 'car-sprite';
    sprite.alt = '';
    sprite.addEventListener('error', function () { sprite.dataset.missing = '1'; });
    sprite.addEventListener('load', function () { delete sprite.dataset.missing; });
    node.appendChild(sprite);
    this.carLayer.appendChild(node);
    this.cars[car.id] = node;
    return node;
  };

  Renderer.prototype.paintCar = function (car, node, complete) {
    var box = this.carBox();
    node.style.width = box.w + 'px';
    node.style.height = box.h + 'px';
    node.style.setProperty('--car-color', this.colorOf(car));
    node.style.setProperty('--shadow', F.get('shadowStrength'));
    node.classList.toggle('is-hidden', !!car.hidden);
    node.classList.toggle('is-rev', car.color === REV && !car.hidden);
    node.classList.toggle('is-happy', !!complete);

    /* The sprite is an overlay, not a replacement: if the file is missing the
     * image just stays hidden and the CSS car shows through unchanged. */
    var sprite = node.querySelector('.car-sprite');
    if (sprite) {
      var want = F.get('sprites') ? spriteFor(car, this.palette) : null;
      if (want) {
        if (sprite.getAttribute('src') !== want) sprite.setAttribute('src', want);
        node.classList.add('use-sprite');
      } else {
        node.classList.remove('use-sprite');
      }
    }
  };

  /* layout: id -> {c,r} for cars on the board. Cars not listed go to the pad. */
  Renderer.prototype.place = function (layout, timing) {
    var box = this.carBox(), g = this.geom, self = this;
    Object.keys(this.cars).forEach(function (id) {
      var node = self.cars[id], spot = layout[id];
      var x, y, t = timing && timing[id];
      if (spot) {
        var p = self.slotPos(spot.c, spot.r);
        x = p.x + box.offX; y = p.y + box.offY;
      } else {
        x = g.padX + box.offX; y = g.padY + box.offY;
      }
      node.style.transition = t
        ? 'transform ' + t.dur + 'ms ' + t.ease + ' ' + (t.delay || 0) + 'ms'
        : 'none';
      node.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
      node.style.zIndex = spot ? (100 - spot.r) : 200;
    });
  };

  Renderer.prototype.layoutOf = function (state) {
    var out = {};
    for (var c = 0; c < state.cols; c++) {
      for (var r = 0; r < state.rows; r++) out[state.grid[c][r].id] = { c: c, r: r };
    }
    return out;
  };

  Renderer.prototype.layoutFromIds = function (idGrid) {
    var out = {};
    for (var c = 0; c < idGrid.length; c++) {
      for (var r = 0; r < idGrid[c].length; r++) out[idGrid[c][r]] = { c: c, r: r };
    }
    return out;
  };

  Renderer.prototype.syncCars = function (state) {
    var live = {}, self = this;
    for (var c = 0; c < state.cols; c++) {
      for (var r = 0; r < state.rows; r++) {
        var car = state.grid[c][r];
        live[car.id] = 1;
        var node = this.cars[car.id] || this.buildCar(car);
        this.paintCar(car, node, state.locked[c]);
      }
    }
    live[state.pad.id] = 1;
    var padNode = this.cars[state.pad.id] || this.buildCar(state.pad);
    this.paintCar(state.pad, padNode, false);
    padNode.classList.add('is-pad');
    Object.keys(this.cars).forEach(function (id) {
      if (!live[id]) { self.cars[id].remove(); delete self.cars[id]; }
      else if (+id !== state.pad.id) self.cars[id].classList.remove('is-pad');
    });
  };

  Renderer.prototype.syncGates = function (state) {
    var g = this.geom;
    if (this.gates.length !== state.cols) {
      this.gateRow.innerHTML = '';
      this.hitLayer.innerHTML = '';
      this.gates = [];
      this.hits = [];
      var self = this;
      for (var c = 0; c < state.cols; c++) {
        var gate = el('div', 'gate', this.gateRow);
        el('div', 'gate-arrow', gate);
        el('div', 'gate-check', gate);
        el('div', 'gate-lock', gate);
        el('div', 'gate-want', gate);
        this.gates.push(gate);
        var hit = el('div', 'hit', this.hitLayer);
        hit.dataset.col = c;
        hit.addEventListener('click', (function (col) {
          return function () { self.onTapColumn(col); };
        })(c));
        this.hits.push(hit);
      }
    }
    for (var i = 0; i < state.cols; i++) {
      this.gates[i].style.width = g.cell + 'px';
      this.gates[i].classList.toggle('done', state.locked[i]);

      /* A sealed column shows what it is waiting for, a coloured one shows the
       * colour it accepts — both are rules the player cannot guess from the cars. */
      var sealed = !!(state.sealed && state.sealed[i]);
      var want = state.want ? state.want[i] : null;
      this.gates[i].classList.toggle('sealed', sealed);
      var lock = this.gates[i].querySelector('.gate-lock');
      lock.textContent = sealed ? '🔒 ' + Math.max(0, state.need[i] - state.done) : '';
      var chip = this.gates[i].querySelector('.gate-want');
      chip.style.display = want ? '' : 'none';
      if (want) chip.style.background = this.palette[want] || want;

      this.hits[i].style.cssText = 'left:' + (g.innerX + i * g.cell) + 'px;top:' + g.innerY +
        'px;width:' + g.cell + 'px;height:' + (g.cell * state.rows + g.gateH) + 'px';
      this.hits[i].classList.toggle('locked', state.locked[i] || sealed);
      this.hits[i].classList.toggle('wants', !!want);
      if (want) this.hits[i].style.setProperty('--want', this.palette[want] || want);
    }
    this.lotInner.style.setProperty('--cols', state.cols);
    this.lotInner.style.setProperty('--cell', g.cell + 'px');
  };

  /* Full redraw with no animation. */
  Renderer.prototype.render = function (state) {
    this.state = state;
    this.measure();
    this.syncCars(state);
    this.syncGates(state);
    this.place(this.layoutOf(state), null);
    this.stage.classList.toggle('won', state.status === 'won');
    this.stage.classList.toggle('lost', state.status === 'lost');
  };

  /* Animate one move. `event` comes straight from Engine.applyMove. */
  Renderer.prototype.animateMove = function (state, event, done) {
    var self = this;
    var prevIds = event.preSortIds;
    this.state = state;
    this.measure();
    this.syncCars(state);
    this.syncGates(state);

    var insertedId = event.inserted.id, ejectedId = event.ejected.id;
    var timing = {};
    var R = state.rows;

    timing[insertedId] = { dur: F.get('insertDuration'), ease: F.ease('insertEase') };
    timing[ejectedId] = { dur: F.get('ejectDuration'), ease: F.ease('ejectEase') };

    var movedColumn = prevIds ? prevIds[event.col] : state.grid[event.col].map(function (x) { return x.id; });
    for (var r = 0; r < R; r++) {
      var id = movedColumn[r];
      if (id === insertedId || id === ejectedId) continue;
      timing[id] = {
        dur: F.get('cascadeDuration'),
        ease: F.ease('cascadeEase'),
        delay: (R - 1 - r) * F.get('cascadeStagger')
      };
    }

    var midLayout = prevIds ? this.layoutFromIds(prevIds) : this.layoutOf(state);
    this.place(midLayout, timing);
    F.Sfx.insert();
    setTimeout(function () { F.Sfx.eject(); }, Math.min(120, F.get('insertDuration') * 0.5));

    var settle = Math.max(F.get('insertDuration'),
                          F.get('cascadeDuration') + F.get('cascadeStagger') * (R - 1),
                          F.get('ejectDuration'));

    if (event.completed.length) {
      setTimeout(function () {
        F.Sfx.complete();
        event.completed.forEach(function (c) { self.popColumn(c); });
      }, settle + F.get('completeDelay'));
    }

    var after = settle;
    if (prevIds && event.autoSorted.length) {
      after += F.get('autoSortDelay') + F.get('autoSortDuration');
      setTimeout(function () {
        var t = {};
        event.autoSorted.forEach(function (m) {
          var col = state.grid[m.col];
          for (var r2 = 0; r2 < state.rows; r2++) {
            t[col[r2].id] = { dur: F.get('autoSortDuration'), ease: F.ease('autoSortEase') };
          }
          self.gates[m.col].classList.add('nudge');
          setTimeout(function () { self.gates[m.col].classList.remove('nudge'); }, 400);
        });
        F.Sfx.sort();
        self.place(self.layoutOf(state), t);
      }, settle + F.get('autoSortDelay'));
    }

    setTimeout(function () {
      self.stage.classList.toggle('won', state.status === 'won');
      self.stage.classList.toggle('lost', state.status === 'lost');
      if (state.status === 'won') F.Sfx.win();
      if (state.status === 'lost') F.Sfx.lose();
      if (done) done();
    }, after + (event.completed.length ? F.get('completeDelay') + F.get('completeDuration') : 0));

    return after;
  };

  Renderer.prototype.popColumn = function (c) {
    var state = this.state, self = this;
    for (var r = 0; r < state.rows; r++) {
      var node = this.cars[state.grid[c][r].id];
      if (!node) continue;
      node.style.setProperty('--pop', F.get('completePop'));
      node.style.setProperty('--pop-dur', F.get('completeDuration') + 'ms');
      node.classList.remove('pop');
      void node.offsetWidth;
      node.classList.add('pop');
    }
    setTimeout(function () {
      for (var r2 = 0; r2 < state.rows; r2++) {
        var n = self.cars[state.grid[c][r2].id];
        if (n) n.classList.remove('pop');
      }
    }, F.get('completeDuration') + 40);
  };

  Renderer.prototype.flashColumn = function (c, cls) {
    var hit = this.hits[c];
    if (!hit) return;
    hit.classList.add(cls || 'hint');
    setTimeout(function () { hit.classList.remove(cls || 'hint'); }, 700);
  };

  Renderer.prototype.shake = function () {
    var self = this;
    this.stage.classList.add('shake');
    setTimeout(function () { self.stage.classList.remove('shake'); }, 260);
  };

  global.Renderer = Renderer;
})(typeof self !== 'undefined' ? self : this);
