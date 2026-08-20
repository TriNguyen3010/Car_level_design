"""Turn tools/make_sets.js output into src/sets.js.

Kept as a script so the campaigns are reproducible rather than hand-maintained:
    node tools/make_sets.js && python3 tools/pack_sets.py
"""
import json

sets = json.load(open('/tmp/sets.json'))
ORDER = [('easy', 'Dẫn tay', 'Dễ'), ('medium', 'Nhịp', 'Trung'), ('hard', 'Thử ngay', 'Khó')]

INTENT = {
    'easy': ('Không ai được thua trong 10 level đầu — thua ở đây là mất install, không phải tạo '
             'thử thách. Nhịp dạy → tập → củng cố: sau mỗi level giới thiệu cái mới thì level sau '
             'sụt xuống để player làm lại thứ vừa học trong điều kiện dễ, để cảm giác "mình làm '
             'được" chứ không phải "mình vừa may".'),
    'medium': ('Dạy player rằng độ khó có nhịp, để một level khó đọc thành "level này khó thôi, '
               'level sau đỡ" chứ không thành tường chắn. Leo 2–3 level rồi thả 1. Level 10 cố ý '
               'không phải đỉnh, để bước sang level 11 với cảm giác thành thạo.'),
    'hard': ('Lọc và tôn trọng. Nhắm player đã quen thể loại — 8 level tutorial làm họ bỏ game. '
             'Đỉnh sớm ở level 3 để phát tín hiệu "game này không phải đồ chơi". Kết đúng ở đỉnh, '
             'khác hai bộ kia: nhiệm vụ của bộ này là lọc, nên qua được level 10 chính là tín hiệu.'),
}
NOTE = {
    'easy': ('Nhịp của bộ này đo trên player ẩu, không phải trung bình: ở bậc 1–4 player trung bình '
             'ngồi ở 98–100% nên không có chỗ để cảm thấy sụt. Chỗ nghỉ ở level 6 sâu hai bậc, vì '
             'sụt một bậc đo ra không cảm được gì.'),
    'medium': ('Chu kỳ 3 chứ không phải 2 — trên 10 level, chu kỳ 2 chỉ cho 5 đỉnh và player đọc '
               'thành lộn xộn chứ không ra nhịp.'),
    'hard': ('Chỗ nghỉ nông hơn hai bộ kia và không level nào cho player trung bình trên 99%. '
             'Player ẩu tụt xuống 7% ở level 10 — đó là chủ ý.'),
}
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
      intent:
        'Bộ dựng lại từ ảnh chụp game tham chiếu. Giữ nguyên để so sánh — budget của nó ' +
        'rộng 2.5–8.6 lần lời giải nên gần như không thể thua.',
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
    out.append("      note:")
    out += js_string_block(NOTE[key], '        ')
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
