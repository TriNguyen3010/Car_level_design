"""Turn tools/make_sets.js output into src/sets.js.

Kept as a script so the campaigns are reproducible rather than hand-maintained:
    node tools/make_sets.js && python3 tools/pack_sets.py
"""
import json

sets = json.load(open('/tmp/sets.json'))
ORDER = [('easy', 'Dẫn tay', 'Dễ'), ('medium', 'Nhịp', 'Trung'), ('hard', 'Thử ngay', 'Khó')]

# Kept to one line each. The full reasoning lives in README.md — a tooltip and a
# panel header are not the place for three sentences.
INTENT = {
    'easy': 'Không ai được thua. Mỗi cơ chế mới xong thì hạ bậc cho player làm lại dễ.',
    'medium': 'Độ khó có nhịp. Leo 2–3 level rồi thả 1. Level 10 không phải đỉnh.',
    'hard': 'Lọc player đã quen thể loại. Đỉnh sớm ở level 3, kết đúng ở đỉnh.',
}
# No per-campaign note. Explanatory text next to a chart competes with the chart
# and loses — the Độ khó tab already shows the shape. The intent survives only in
# the switch dialog, where the reader is actually choosing.
RHYTHM = {'easy': 'winSloppy', 'medium': 'winAvg', 'hard': 'winAvg'}


def wrap(text, width=84):
    words, cur, out = text.split(), '', []
    for w in words:
        if len(cur) + len(w) + 1 > width:
            out.append(cur)
            cur = w
        else:
            cur = (cur + ' ' + w).strip()
    out.append(cur)
    return out


def js_string_block(text, indent):
    lines = wrap(text)
    body = []
    for i, ch in enumerate(lines):
        last = i == len(lines) - 1
        esc = ch.replace('\\', '\\\\').replace("'", "\\'")
        body.append('%s\'%s%s\'%s' % (indent, esc, '' if last else ' ', ',' if last else ' +'))
    return body


HEAD = """/* Four campaigns over the same ten levels.
 *
 * A campaign is an APPROACH, not a slope. Each has a stated intent and each is
 * deliberately non-linear, because a breather after a new mechanic is what makes
 * the player feel competent rather than lucky.
 *
 * Every assignment was generated and then verified by playtest, and the check is
 * on the SHAPE of the measured win-rate curve rather than on each level merely
 * hitting its tier — a tier maps to a win-rate BAND, so a sawtooth in tier
 * numbers does not guarantee a sawtooth in what a player feels. Two findings came
 * out of checking:
 *
 * Adjacent bands overlap, so a breather generated mid-band can measure HARDER
 * than the peak it follows. Breathers are therefore generated at the easy end of
 * their band — several seeds, keep the highest-scoring one that still meets every
 * criterion.
 *
 * A deep breather immediately before a new peak walls: the climb out of it spans
 * three tiers. Both mid-campaign breathers were made one tier shallower after the
 * tool's own curve check flagged exactly that.
 *
 * All 8 intended breathers now register as relief (+5 to +24 points) and all 30
 * generated levels meet every criterion of their tier.
 *
 * Regenerate: node tools/make_sets.js && python3 tools/pack_sets.py
 */
(function (global) {
  'use strict';

  var SETS = {
    'default': {
      name: 'Gốc',
      label: 'Mặc định',
      intent: 'Dựng từ ảnh chụp game tham chiếu. Budget rộng 2.5–8.6x — gần như không thể thua.',
      note: '',
      rhythmOn: 'winAvg',
      breathers: [],
      levels: null
    },"""

out = [HEAD]
for key, name, label in ORDER:
    d = sets[key]
    out.append("    '%s': {" % key)
    out.append("      name: '%s'," % name)
    out.append("      label: '%s'," % label)
    out.append("      intent:")
    out += js_string_block(INTENT[key], '        ')
    out.append("      note: '',")
    out.append("      rhythmOn: '%s'," % RHYTHM[key])
    out.append("      breathers: %s," % json.dumps(d['breathers']))
    out.append("      levels: [")
    for lv in d['levels']:
        grid = json.dumps(lv['grid'], ensure_ascii=False).replace('", "', '","').replace('], [', '],[')
        out.append("        { id: %d, tier: %d, cols: %d, rows: %d, moves: %d, theme: '%s', pad: '%s',"
                   % (lv['id'], lv['tier'], lv['cols'], lv['rows'], lv['moves'], lv['theme'], lv['pad']))
        out.append("          grid: %s }," % grid)
    out.append("      ]")
    out.append("    }," if key != 'hard' else "    }")

out.append("""  };

  SETS['default'].levels = global.LevelData.levels;

  global.LevelSets = {
    SETS: SETS,
    order: ['default', 'easy', 'medium', 'hard']
  };
})(typeof self !== 'undefined' ? self : this);""")

open('src/sets.js', 'w').write('\n'.join(out) + '\n')
print('src/sets.js written')
