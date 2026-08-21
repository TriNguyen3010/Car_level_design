/* Loads src/*.js the same way tools/make_sets.js does — the modules attach
 * themselves to `self`. */
'use strict';
global.self = global;
['engine', 'levels', 'solver', 'gen', 'gameconfig'].forEach(function (m) {
  require(process.cwd() + '/src/' + m + '.js');
});

var H = require('./harness.js');
require('./engine.test.js');
require('./gen.test.js');
require('./gameconfig.test.js');
H.run();
