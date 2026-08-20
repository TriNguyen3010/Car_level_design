/* Game feel — every timing, easing and juice value in one place, plus the
 * slider definitions the tool builds its Feel tab from. Nothing here affects
 * the puzzle; it is all presentation, which is exactly why it lives apart
 * from the engine. */
(function (global) {
  'use strict';

  var EASINGS = {
    linear:      'linear',
    smooth:      'cubic-bezier(.25,.1,.25,1)',
    out:         'cubic-bezier(.16,.84,.28,1)',
    outStrong:   'cubic-bezier(.08,.9,.2,1)',
    inOut:       'cubic-bezier(.55,.06,.35,.95)',
    back:        'cubic-bezier(.34,1.56,.64,1)',
    backStrong:  'cubic-bezier(.28,1.9,.5,1)',
    anticipate:  'cubic-bezier(.7,-.4,.3,1.3)'
  };

  var DEFAULTS = {
    insertDuration: 260,
    insertEase: 'outStrong',
    cascadeDuration: 190,
    cascadeStagger: 26,
    cascadeEase: 'out',
    ejectDuration: 300,
    ejectEase: 'back',
    autoSortDelay: 140,
    autoSortDuration: 260,
    autoSortEase: 'back',
    completeDelay: 90,
    completePop: 1.14,
    completeDuration: 300,
    inputLock: 180,
    padBob: 3,
    padBobDuration: 1600,
    carScale: 1,
    cellGap: 0.02,
    shadowStrength: 0.45,
    sfxOn: 1,
    sfxVolume: 0.25,
    sprites: 1,
    shapeCount: 6,
    spritePath: 'assets/car_{color}.png'
  };

  /* [key, label, min, max, step, unit] */
  var SLIDERS = [
    ['insertDuration',   'Insert — xe bay lên đỉnh',      60, 700, 10, 'ms'],
    ['insertEase',       'Insert easing',                 null, null, null, 'ease'],
    ['cascadeDuration',  'Cascade — cả cột dồn xuống',    60, 600, 10, 'ms'],
    ['cascadeStagger',   'Cascade stagger / hàng',         0, 120,  2, 'ms'],
    ['cascadeEase',      'Cascade easing',                null, null, null, 'ease'],
    ['ejectDuration',    'Eject — xe đáy văng ra pad',    60, 800, 10, 'ms'],
    ['ejectEase',        'Eject easing',                  null, null, null, 'ease'],
    ['autoSortDelay',    'Auto-sort delay',                0, 800, 10, 'ms'],
    ['autoSortDuration', 'Auto-sort duration',            60, 800, 10, 'ms'],
    ['autoSortEase',     'Auto-sort easing',              null, null, null, 'ease'],
    ['completeDelay',    'Complete delay',                 0, 600, 10, 'ms'],
    ['completePop',      'Complete pop scale',             1, 1.5, 0.01, 'x'],
    ['completeDuration', 'Complete duration',             60, 800, 10, 'ms'],
    ['inputLock',        'Input lock sau mỗi tap',         0, 800, 10, 'ms'],
    ['padBob',           'Pad idle bob',                   0,  12,  1, 'px'],
    ['padBobDuration',   'Pad bob chu kỳ',               400,4000,100, 'ms'],
    ['carScale',         'Car scale trong ô',            0.6,   1, 0.01, 'x'],
    ['cellGap',          'Cell gap',                       0, 0.2, 0.005, 'x'],
    ['shadowStrength',   'Shadow',                         0,   1, 0.02, ''],
    ['sfxVolume',        'SFX volume',                     0,   1, 0.02, ''],
    ['shapeCount',       'Số kiểu dáng xe dùng',           1,   9,  1, ' kiểu']
  ];

  var PRESETS = {
    'Default':  {},
    'Snappy':   { insertDuration: 150, cascadeDuration: 110, cascadeStagger: 12,
                  ejectDuration: 180, inputLock: 90, autoSortDelay: 60,
                  autoSortDuration: 150, completeDuration: 200 },
    'Juicy':    { insertDuration: 340, cascadeDuration: 260, cascadeStagger: 44,
                  ejectDuration: 420, ejectEase: 'backStrong', inputLock: 260,
                  autoSortDelay: 220, autoSortDuration: 380, completePop: 1.24,
                  completeDuration: 420 },
    'Sluggish': { insertDuration: 520, cascadeDuration: 420, cascadeStagger: 70,
                  ejectDuration: 600, inputLock: 500, autoSortDelay: 400,
                  autoSortDuration: 520 }
  };

  var current = Object.assign({}, DEFAULTS);

  function get(k) { return current[k]; }
  function set(k, v) { current[k] = v; }
  function all() { return current; }
  function ease(k) { return EASINGS[current[k]] || current[k] || 'linear'; }
  function reset() { current = Object.assign({}, DEFAULTS); }
  function applyPreset(name) { current = Object.assign({}, DEFAULTS, PRESETS[name] || {}); }
  function toJSON() { return JSON.parse(JSON.stringify(current)); }
  function load(obj) { current = Object.assign({}, DEFAULTS, obj || {}); }

  /* Total time a move takes to settle — drives how long input stays locked. */
  function moveDuration(hasAutoSort, rows) {
    var base = Math.max(current.insertDuration,
                        current.cascadeDuration + current.cascadeStagger * ((rows || 5) - 1),
                        current.ejectDuration);
    if (hasAutoSort) base += current.autoSortDelay + current.autoSortDuration;
    return base;
  }

  /* Tiny synth so audio timing can be tuned without shipping any assets. */
  var ctx = null;
  function actx() {
    if (!ctx && (global.AudioContext || global.webkitAudioContext)) {
      ctx = new (global.AudioContext || global.webkitAudioContext)();
    }
    return ctx;
  }
  function blip(freq, dur, type, gainMul) {
    if (!current.sfxOn || !current.sfxVolume) return;
    var a = actx();
    if (!a) return;
    if (a.state === 'suspended') a.resume();
    var o = a.createOscillator(), g = a.createGain();
    o.type = type || 'triangle';
    o.frequency.setValueAtTime(freq, a.currentTime);
    var vol = current.sfxVolume * (gainMul == null ? 1 : gainMul);
    g.gain.setValueAtTime(vol, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
    o.connect(g); g.connect(a.destination);
    o.start(); o.stop(a.currentTime + dur + 0.02);
  }
  var Sfx = {
    insert:  function () { blip(520, 0.09, 'triangle'); },
    eject:   function () { blip(300, 0.12, 'sawtooth', 0.5); },
    sort:    function () { blip(660, 0.07, 'sine', 0.7); },
    complete:function () { blip(784, 0.16, 'sine'); setTimeout(function () { blip(1046, 0.22, 'sine'); }, 90); },
    win:     function () { [659, 784, 988, 1318].forEach(function (f, i) { setTimeout(function () { blip(f, 0.24, 'sine'); }, i * 110); }); },
    lose:    function () { blip(180, 0.35, 'square', 0.4); },
    invalid: function () { blip(140, 0.1, 'square', 0.35); }
  };

  global.Feel = {
    EASINGS: EASINGS, DEFAULTS: DEFAULTS, SLIDERS: SLIDERS, PRESETS: PRESETS,
    get: get, set: set, all: all, ease: ease, reset: reset,
    applyPreset: applyPreset, toJSON: toJSON, load: load,
    moveDuration: moveDuration, Sfx: Sfx
  };
})(typeof self !== 'undefined' ? self : this);
