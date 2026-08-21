/* Zero-dependency test runner. The repo has no package.json on purpose, so
 * tests are plain node: `node tests/run.js`. */
'use strict';

var tests = [];
var failures = [];

function test(name, fn) { tests.push({ name: name, fn: fn }); }

function eq(got, want, msg) {
  var a = JSON.stringify(got), b = JSON.stringify(want);
  if (a !== b) throw new Error((msg || 'not equal') + '\n  got:  ' + a + '\n  want: ' + b);
}

function ok(v, msg) { if (!v) throw new Error(msg || 'expected truthy, got ' + JSON.stringify(v)); }

function includes(arr, v, msg) {
  if (arr.indexOf(v) < 0) throw new Error((msg || 'missing') + ': ' + JSON.stringify(v) + ' not in ' + JSON.stringify(arr));
}

function run() {
  tests.forEach(function (t) {
    try { t.fn(); process.stdout.write('  ok   ' + t.name + '\n'); }
    catch (e) { failures.push(t.name); process.stdout.write('  FAIL ' + t.name + '\n       ' + e.message.replace(/\n/g, '\n       ') + '\n'); }
  });
  process.stdout.write('\n' + (tests.length - failures.length) + '/' + tests.length + ' passed\n');
  if (failures.length) process.exit(1);
}

module.exports = { test: test, eq: eq, ok: ok, includes: includes, run: run };
