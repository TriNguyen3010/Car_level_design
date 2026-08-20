/* Four campaigns over the same ten levels.
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
    },
    'easy': {
      name: 'Dẫn tay',
      label: 'Dễ',
      intent:
        'Không ai được thua trong 10 level đầu — thua ở đây là mất install, không phải tạo ' +
        'thử thách. Nhịp dạy → tập → củng cố: sau mỗi level giới thiệu cái mới thì level sau ' +
        'sụt xuống để player làm lại thứ vừa học trong điều kiện dễ, để cảm giác "mình làm ' +
        'được" chứ không phải "mình vừa may".',
      note:
        'Nhịp của bộ này đo trên player ẩu, không phải trung bình: ở bậc 1–4 player trung ' +
        'bình ngồi ở 98–100% nên không có chỗ để cảm thấy sụt. Chỗ nghỉ ở level 6 sâu hai ' +
        'bậc, vì sụt một bậc đo ra không cảm được gì.',
      rhythmOn: 'winSloppy',
      breathers: [6, 10],
      levels: [
        { id: 1, tier: 1, cols: 4, rows: 4, moves: 26, theme: 'city', pad: 'REV',
          grid: [["pink","yellow","magenta","yellow"],["magenta","magenta","magenta","yellow"],["pink","pink","yellow","pink"],["purple","purple","purple","purple"]] },
        { id: 2, tier: 1, cols: 4, rows: 4, moves: 26, theme: 'city', pad: 'REV',
          grid: [["yellow","yellow","magenta","yellow"],["magenta","yellow","magenta","magenta"],["pink","purple","pink","pink"],["purple","purple","pink","purple"]] },
        { id: 3, tier: 2, cols: 4, rows: 5, moves: 26, theme: 'city', pad: 'REV',
          grid: [["pink","yellow","yellow","yellow","yellow"],["magenta","magenta","magenta","yellow","magenta"],["pink","purple","pink","purple","magenta"],["pink","pink","purple","purple","purple"]] },
        { id: 4, tier: 2, cols: 4, rows: 5, moves: 24, theme: 'city', pad: 'REV',
          grid: [["yellow","yellow","magenta","pink","purple"],["yellow","magenta","magenta","purple","magenta"],["pink","pink","pink","pink","yellow"],["purple","purple","magenta","yellow","purple"]] },
        { id: 5, tier: 3, cols: 4, rows: 5, moves: 25, theme: 'city', pad: 'REV',
          grid: [["magenta","yellow","magenta","yellow","purple"],["pink","magenta","yellow","magenta","purple"],["pink","pink","pink","pink","magenta"],["purple","yellow","purple","yellow","purple"]] },
        { id: 6, tier: 1, cols: 4, rows: 4, moves: 23, theme: 'suburb', pad: 'REV',
          grid: [["yellow","yellow","yellow","yellow"],["magenta","magenta","pink","magenta"],["magenta","pink","pink","purple"],["purple","purple","purple","pink"]] },
        { id: 7, tier: 3, cols: 4, rows: 5, moves: 28, theme: 'suburb', pad: 'REV',
          grid: [["yellow","yellow","pink","yellow","magenta"],["magenta","purple","magenta","magenta","purple"],["yellow","pink","purple","pink","pink"],["yellow","purple","purple","pink","magenta"]] },
        { id: 8, tier: 4, cols: 5, rows: 5, moves: 35, theme: 'suburb', pad: 'REV',
          grid: [["pink","purple","purple","violet","yellow"],["purple","yellow","magenta","violet","magenta"],["yellow","pink","pink","magenta","pink"],["purple","magenta","yellow","yellow","purple"],["magenta","pink","violet","violet","violet"]] },
        { id: 9, tier: 4, cols: 5, rows: 5, moves: 32, theme: 'suburb', pad: 'REV',
          grid: [["magenta","violet","yellow","yellow","yellow"],["magenta","yellow","purple","magenta","violet"],["pink","pink","magenta","pink","violet"],["violet","purple","magenta","purple","yellow"],["purple","purple","pink","violet","pink"]] },
        { id: 10, tier: 3, cols: 4, rows: 5, moves: 31, theme: 'suburb', pad: 'REV',
          grid: [["magenta","yellow","magenta","yellow","yellow"],["yellow","magenta","yellow","purple","magenta"],["purple","magenta","pink","pink","pink"],["purple","purple","pink","purple","pink"]] },
      ]
    },
    'medium': {
      name: 'Nhịp',
      label: 'Trung',
      intent:
        'Dạy player rằng độ khó có nhịp, để một level khó đọc thành "level này khó thôi, ' +
        'level sau đỡ" chứ không thành tường chắn. Leo 2–3 level rồi thả 1. Level 10 cố ý ' +
        'không phải đỉnh, để bước sang level 11 với cảm giác thành thạo.',
      note:
        'Chu kỳ 3 chứ không phải 2 — trên 10 level, chu kỳ 2 chỉ cho 5 đỉnh và player đọc ' +
        'thành lộn xộn chứ không ra nhịp.',
      rhythmOn: 'winAvg',
      breathers: [4, 8, 10],
      levels: [
        { id: 1, tier: 1, cols: 4, rows: 4, moves: 26, theme: 'city', pad: 'REV',
          grid: [["pink","yellow","magenta","yellow"],["magenta","magenta","magenta","yellow"],["pink","pink","yellow","pink"],["purple","purple","purple","purple"]] },
        { id: 2, tier: 2, cols: 4, rows: 5, moves: 28, theme: 'city', pad: 'REV',
          grid: [["yellow","yellow","pink","yellow","yellow"],["pink","yellow","magenta","magenta","magenta"],["purple","magenta","pink","pink","pink"],["magenta","purple","purple","purple","purple"]] },
        { id: 3, tier: 3, cols: 4, rows: 5, moves: 25, theme: 'city', pad: 'REV',
          grid: [["pink","yellow","yellow","yellow","yellow"],["magenta","magenta","magenta","yellow","pink"],["pink","purple","magenta","purple","magenta"],["pink","pink","purple","purple","purple"]] },
        { id: 4, tier: 2, cols: 4, rows: 5, moves: 28, theme: 'city', pad: 'REV',
          grid: [["yellow","yellow","purple","yellow","yellow"],["purple","purple","magenta","magenta","magenta"],["magenta","pink","pink","pink","pink"],["magenta","purple","pink","purple","yellow"]] },
        { id: 5, tier: 4, cols: 5, rows: 5, moves: 25, theme: 'city', pad: 'REV',
          grid: [["pink","yellow","yellow","yellow","purple"],["yellow","magenta","purple","purple","violet"],["pink","pink","magenta","pink","pink"],["magenta","purple","purple","yellow","violet"],["violet","violet","magenta","magenta","violet"]] },
        { id: 6, tier: 5, cols: 5, rows: 5, moves: 26, theme: 'suburb', pad: 'REV',
          grid: [["yellow","yellow","violet","violet","pink"],["purple","magenta","pink","magenta","magenta"],["pink","pink","pink","purple","yellow"],["magenta","purple","purple","magenta","yellow"],["violet","violet","violet","yellow","purple"]] },
        { id: 7, tier: 6, cols: 5, rows: 5, moves: 21, theme: 'suburb', pad: 'REV',
          grid: [["yellow","yellow","pink","magenta","yellow"],["pink","pink","yellow","pink","magenta"],["yellow","magenta","magenta","magenta","pink"],["yellow","yellow","yellow","magenta","magenta"],["yellow","magenta","yellow","magenta","magenta"]] },
        { id: 8, tier: 5, cols: 5, rows: 5, moves: 34, theme: 'suburb', pad: 'REV',
          grid: [["purple","yellow","yellow","yellow","pink"],["violet","magenta","purple","magenta","magenta"],["violet","yellow","pink","pink","pink"],["magenta","pink","magenta","yellow","purple"],["purple","purple","violet","violet","violet"]] },
        { id: 9, tier: 7, cols: 5, rows: 6, moves: 26, theme: 'suburb', pad: 'REV',
          grid: [["magenta","magenta","magenta","yellow","yellow","magenta"],["magenta","yellow","magenta","yellow","yellow","magenta"],["pink","pink","yellow","pink","yellow","yellow"],["yellow","magenta","pink","yellow","yellow","magenta"],["magenta","pink","magenta","magenta","pink","yellow"]] },
        { id: 10, tier: 6, cols: 5, rows: 6, moves: 33, theme: 'suburb', pad: 'REV',
          grid: [["yellow","magenta","yellow","magenta","magenta","pink"],["magenta","yellow","yellow","yellow","magenta","yellow"],["yellow","yellow","pink","pink","magenta","pink"],["pink","pink","yellow","magenta","yellow","yellow"],["yellow","magenta","magenta","magenta","magenta","magenta"]] },
      ]
    },
    'hard': {
      name: 'Thử ngay',
      label: 'Khó',
      intent:
        'Lọc và tôn trọng. Nhắm player đã quen thể loại — 8 level tutorial làm họ bỏ game. ' +
        'Đỉnh sớm ở level 3 để phát tín hiệu "game này không phải đồ chơi". Kết đúng ở đỉnh, ' +
        'khác hai bộ kia: nhiệm vụ của bộ này là lọc, nên qua được level 10 chính là tín ' +
        'hiệu.',
      note:
        'Chỗ nghỉ nông hơn hai bộ kia và không level nào cho player trung bình trên 99%. ' +
        'Player ẩu tụt xuống 7% ở level 10 — đó là chủ ý.',
      rhythmOn: 'winAvg',
      breathers: [4, 7, 9],
      levels: [
        { id: 1, tier: 2, cols: 4, rows: 5, moves: 32, theme: 'city', pad: 'REV',
          grid: [["yellow","pink","magenta","purple","yellow"],["purple","magenta","magenta","magenta","yellow"],["pink","pink","yellow","pink","pink"],["purple","purple","magenta","yellow","purple"]] },
        { id: 2, tier: 4, cols: 5, rows: 5, moves: 27, theme: 'city', pad: 'REV',
          grid: [["yellow","yellow","yellow","magenta","purple"],["pink","yellow","magenta","magenta","violet"],["purple","magenta","magenta","pink","purple"],["yellow","pink","purple","pink","pink"],["violet","violet","violet","purple","violet"]] },
        { id: 3, tier: 6, cols: 5, rows: 5, moves: 30, theme: 'city', pad: 'REV',
          grid: [["yellow","magenta","yellow","magenta","yellow"],["magenta","yellow","pink","yellow","pink"],["pink","magenta","pink","magenta","magenta"],["yellow","magenta","yellow","magenta","magenta"],["pink","magenta","yellow","yellow","yellow"]] },
        { id: 4, tier: 5, cols: 5, rows: 5, moves: 31, theme: 'city', pad: 'REV',
          grid: [["yellow","yellow","yellow","violet","purple"],["purple","magenta","violet","pink","magenta"],["pink","yellow","pink","magenta","pink"],["pink","yellow","magenta","purple","violet"],["magenta","violet","purple","purple","violet"]] },
        { id: 5, tier: 7, cols: 5, rows: 5, moves: 23, theme: 'city', pad: 'REV',
          grid: [["magenta","yellow","yellow","pink","yellow"],["yellow","magenta","yellow","magenta","magenta"],["pink","yellow","magenta","pink","magenta"],["yellow","magenta","yellow","yellow","pink"],["yellow","magenta","magenta","magenta","pink"]] },
        { id: 6, tier: 8, cols: 5, rows: 6, moves: 24, theme: 'suburb', pad: 'REV',
          grid: [["yellow","yellow","yellow","magenta","magenta","magenta"],["magenta","yellow","magenta","pink","magenta","magenta"],["pink","pink","pink","pink","yellow","magenta"],["magenta","magenta","yellow","yellow","pink","yellow"],["magenta","yellow","yellow","yellow","magenta","yellow"]] },
        { id: 7, tier: 7, cols: 5, rows: 6, moves: 37, theme: 'suburb', pad: 'REV',
          grid: [["yellow","magenta","pink","yellow","magenta","magenta"],["magenta","pink","magenta","yellow","magenta","pink"],["yellow","pink","yellow","yellow","magenta","pink"],["yellow","yellow","magenta","pink","magenta","magenta"],["yellow","magenta","yellow","yellow","yellow","magenta"]] },
        { id: 8, tier: 9, cols: 5, rows: 6, moves: 25, theme: 'suburb', pad: 'REV',
          grid: [["pink","?yellow","yellow","yellow","pink","yellow"],["yellow","magenta","magenta","yellow","magenta","pink"],["yellow","pink","pink","?magenta","yellow","magenta"],["magenta","?yellow","magenta","magenta","magenta","magenta"],["?magenta","yellow","?yellow","magenta","pink","yellow"]] },
        { id: 9, tier: 8, cols: 5, rows: 6, moves: 28, theme: 'suburb', pad: 'REV',
          grid: [["yellow","magenta","pink","pink","pink","yellow"],["yellow","magenta","magenta","yellow","magenta","magenta"],["magenta","magenta","magenta","yellow","pink","yellow"],["yellow","yellow","yellow","magenta","magenta","yellow"],["magenta","pink","magenta","yellow","yellow","pink"]] },
        { id: 10, tier: 10, cols: 6, rows: 6, moves: 35, theme: 'suburb', pad: 'REV',
          grid: [["yellow","?purple","yellow","yellow","magenta","?magenta"],["purple","purple","magenta","pink","magenta","yellow"],["magenta","yellow","?pink","yellow","?yellow","magenta"],["purple","magenta","?pink","?purple","?purple","?magenta"],["magenta","pink","pink","yellow","yellow","magenta"],["yellow","yellow","magenta","magenta","yellow","?pink"]] },
      ]
    }
  };

  SETS['default'].levels = global.LevelData.levels;

  global.LevelSets = {
    SETS: SETS,
    order: ['default', 'easy', 'medium', 'hard']
  };
})(typeof self !== 'undefined' ? self : this);
