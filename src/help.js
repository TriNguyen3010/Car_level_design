/* Click-to-open explanations for every number the tool reports.
 * Examples are taken from the real levels, not invented, so the wording and
 * the numbers on screen can never disagree. */
(function (global) {
  'use strict';

  var TOPICS = {

    'do-kho': {
      title: { vi: 'Độ khó (0–100)', en: 'Difficulty (0–100)' },
      body: { vi: 'Tỉ lệ <b>thua</b>. Càng cao càng khó. Ghép từ 5 thành phần, nặng nhất là tỉ lệ thua thật đo bằng playtest.',
              en: 'The <b>loss</b> rate. Higher is harder. Five components, weighted heaviest on the real loss rate measured by playtest.' },
      list: { vi: ['38% — tỉ lệ thua của player trung bình ở đúng budget đang đặt',
                   '25% — số lượt phải suy nghĩ (độ sâu)',
                   '15% — budget chặt hay lỏng (slack)',
                   '13% — level dài hay ngắn',
                   '9% — số xe ẩn'],
              en: ['38% — the average player\'s loss rate at the current budget',
                   '25% — how many turns require thought (depth)',
                   '15% — how tight the budget is (slack)',
                   '13% — how long the level runs',
                   '9% — how many cars are hidden'] },
      note: { vi: 'Dưới 20 = gần như không ai thua được. Trên 70 = rất gắt.',
              en: 'Under 20 nobody can really lose. Over 70 is brutal.' }
    },

    'do-sau': {
      title: { vi: 'Độ sâu (0–100)', en: 'Depth (0–100)' },
      body: { vi: '% số lượt mà player có <b>từ 2 cột trở lên</b> để nhả xe trên pad vào mà không tạo thêm rác. Có ≥2 lựa chọn = phải suy nghĩ. Chỉ có 1 = tay tự đi, không phải puzzle.',
              en: 'The share of turns where <b>two or more</b> columns can take the pad car without adding mess. Two options means a decision. One means your hand plays it for you — not a puzzle.' },
      example: { vi: '<b>Level 1 — độ sâu 0.</b> Xe pad màu lime. Chỉ cột 2 là cột lime:\n' +
                     '  cột1  magenta magenta magenta yellow\n' +
                     '  cột2  lime    lime    lime    cyan     ← chỗ duy nhất\n' +
                     '  cột3  yellow  yellow  yellow  REV\n' +
                     '  cột4  cyan    cyan    cyan    magenta\n' +
                     'Không có gì để chọn. Xe văng ra lại chỉ đường cho nước sau. Cả level là 1 chuỗi ép.\n\n' +
                     '<b>Level 6 — độ sâu 29%.</b> Chỉ 3 màu cho 5 cột, nên magenta chiếm 2 cột.\n' +
                     'Xe pad màu magenta, cả cột 4 và cột 5 đều nhận được:\n' +
                     '  cột4  magenta magenta magenta yellow  yellow  mint\n' +
                     '  cột5  magenta yellow  mint    magenta yellow  magenta\n' +
                     'Chọn cột 4 thì văng ra mint. Chọn cột 5 thì văng ra magenta. Hai nước đi\n' +
                     'dẫn tới hai ván khác hẳn nhau — đây mới là quyết định thật.',
                 en: '<b>Level 1 — depth 0.</b> The pad car is lime. Only column 2 is lime:\n' +
                     '  col1  magenta magenta magenta yellow\n' +
                     '  col2  lime    lime    lime    cyan     ← the only place\n' +
                     '  col3  yellow  yellow  yellow  REV\n' +
                     '  col4  cyan    cyan    cyan    magenta\n' +
                     'Nothing to choose. The ejected car dictates the next move. The level is one forced chain.\n\n' +
                     '<b>Level 6 — depth 29%.</b> Three colours for five columns, so magenta owns two.\n' +
                     'The pad car is magenta and both column 4 and column 5 accept it:\n' +
                     '  col4  magenta magenta magenta yellow  yellow  mint\n' +
                     '  col5  magenta yellow  mint    magenta yellow  magenta\n' +
                     'Column 4 ejects mint, column 5 ejects magenta. Two moves leading to two\n' +
                     'completely different runs — that is a real decision.' },
      note: { vi: 'Độ sâu và độ khó là 2 trục KHÁC NHAU. Level nhạt (sâu thấp) và level dễ (khó thấp) là 2 bệnh khác nhau.',
              en: 'Depth and difficulty are DIFFERENT axes. A bland level (low depth) and an easy level (low difficulty) are different ailments.' }
    },

    'loi-tay': {
      title: { vi: 'Lỗi tay', en: 'Mistake rate' },
      body: { vi: 'Xác suất mỗi lượt player bấm <b>đại một cột bất kỳ</b> thay vì cột tốt nhất. Đây là cách mô phỏng player thật: nhìn nhầm màu, bấm trượt, hoặc lười nghĩ.',
              en: 'The chance, each turn, that the player taps <b>a random column</b> instead of the best one. It models real play: misreading a colour, a fat finger, or not bothering to think.' },
      example: { vi: 'Lỗi tay 10% trên một level dài 20 nước:\n' +
                     '  18 nước bấm đúng cột tốt nhất\n' +
                     '   2 nước bấm ngẫu nhiên\n\n' +
                     'Mỗi nước bấm bừa nhả xe sai màu vào một cột đang sạch, tạo thêm 1 xe lạ\n' +
                     'phải dọn — thường tốn 2–4 nước để gỡ. Nên 2 lần lỡ tay có thể ngốn 8 nước.\n' +
                     'Đó là lý do budget chặt phạt player ẩu nặng hơn nhiều so với player giỏi.',
                 en: 'A 10% mistake rate on a 20-move level:\n' +
                     '  18 moves tap the best column\n' +
                     '   2 moves tap at random\n\n' +
                     'Each careless tap drops a wrong colour into a clean column, creating one\n' +
                     'more stray to clear — usually 2–4 moves to undo. So two slips can cost 8.\n' +
                     'That is why a tight budget punishes the careless player far more than the careful one.' },
      list: { vi: ['<b>giỏi</b> — lỗi tay 2%, gần như luôn bấm đúng',
                   '<b>trung bình</b> — lỗi tay 10%, mốc chính để đặt budget',
                   '<b>ẩu</b> — lỗi tay 25%, player vừa xem TV vừa chơi'],
              en: ['<b>careful</b> — 2%, almost always taps right',
                   '<b>average</b> — 10%, the reference for setting a budget',
                   '<b>careless</b> — 25%, playing with the TV on'] },
      note: { vi: 'Chênh lệch win giữa giỏi và ẩu chính là "kỹ năng có được thưởng không". Chênh dưới 30% nghĩa là chơi giỏi cũng vô ích.',
              en: 'The win gap between careful and careless IS "does skill pay?". Under 30 points, playing well buys nothing.' }
    },

    'slack': {
      title: { vi: 'Slack', en: 'Slack' },
      body: { vi: '<b>budget ÷ số nước thực sự cần</b>. Đo budget đang thừa bao nhiêu.',
              en: '<b>budget ÷ moves actually needed</b>. It measures how much budget is spare.' },
      example: { vi: '<b>Level 1.</b> Giải tối ưu hết 4 nước. Budget đang đặt 30.\n' +
                     '  slack = 30 ÷ 4 = 7.5x  →  thừa 26 nước\n' +
                     'Player phải bấm sai 26 lần mới thua. Con số "30 moves" trên màn hình\n' +
                     'chỉ là trang trí, không phải cơ chế.\n\n' +
                     '<b>Nếu đặt budget 6:</b>\n' +
                     '  slack = 6 ÷ 4 = 1.5x  →  được phép sai 2 nước\n' +
                     'Giờ mới có sức ép, và booster Undo mới có lý do tồn tại.',
                 en: '<b>Level 1.</b> The optimum is 4 moves. The budget is 30.\n' +
                     '  slack = 30 ÷ 4 = 7.5x  →  26 moves spare\n' +
                     'The player must tap wrong 26 times to lose. "30 moves" on screen is\n' +
                     'decoration, not a mechanic.\n\n' +
                     '<b>At a budget of 6:</b>\n' +
                     '  slack = 6 ÷ 4 = 1.5x  →  two mistakes allowed\n' +
                     'Now there is pressure, and the Undo booster has a reason to exist.' },
      list: { vi: ['dưới 1.15x — phải đi gần như tối ưu tuyệt đối, quá gắt',
                   '<b>1.4x – 2.2x — vùng nên nhắm</b>',
                   'trên 3x — budget vô nghĩa'],
              en: ['below 1.15x — near-perfect play required, too harsh',
                   '<b>1.4x – 2.2x — the zone to aim for</b>',
                   'above 3x — the budget is meaningless'] },
      note: { vi: '"Số nước thực sự cần" lấy từ playtest (mốc 10% nhanh nhất của player giỏi), không phải lời giải hoàn hảo mà không ai tìm ra.',
              en: '"Moves actually needed" comes from playtest — the careful player\'s fastest 10% — not a perfect solution nobody finds.' }
    },

    'playout-runs': {
      title: { vi: 'Playout / phương án', en: 'Playouts per option' },
      body: { vi: 'Số ván máy tự chơi thử để chấm điểm <b>mỗi</b> phương án. Chia đều cho 3 hạng player — 900 nghĩa là 300 ván giỏi + 300 trung bình + 300 ẩu.',
              en: 'How many runs are simulated to score <b>each</b> option, split evenly across the three profiles — 900 means 300 careful + 300 average + 300 careless.' },
      list: { vi: ['Có tác động: quyết định con số Δkhó chính xác đến đâu, và chạy nhanh hay chậm.',
                   'KHÔNG có tác động: không làm level khó hơn hay dễ hơn. Chỉ là cỡ mẫu đo.'],
              en: ['It affects how precise the Δhard figure is, and how long the run takes.',
                   'It does NOT make the level harder or easier. It is only the sample size.'] },
      example: { vi: 'Đo thật trên Level 4, chạy lại 9 lần với seed khác nhau:\n' +
                     '  150 playout  → win dao động ±8.1%   → Δkhó nhiễu ±3.1 điểm\n' +
                     '  300 playout  → win dao động ±3.4%   → Δkhó nhiễu ±1.3 điểm\n' +
                     '  900 playout  → win dao động ±3.2%   → Δkhó nhiễu ±1.2 điểm  ← mặc định\n' +
                     ' 2700 playout  → win dao động ±1.9%   → Δkhó nhiễu ±0.7 điểm\n\n' +
                     'Nên: chênh lệch Δkhó dưới 2 điểm thì coi như ngang nhau, đừng tin thứ tự.\n' +
                     'Chênh trên 5 điểm thì thứ tự đáng tin. Cần chắc hơn thì nâng lên 2700.',
                 en: 'Measured on Level 4, re-run nine times with different seeds:\n' +
                     '   150 playouts → win varies ±8.1%   → Δhard noise ±3.1 points\n' +
                     '   300 playouts → win varies ±3.4%   → Δhard noise ±1.3 points\n' +
                     '   900 playouts → win varies ±3.2%   → Δhard noise ±1.2 points  ← default\n' +
                     '  2700 playouts → win varies ±1.9%   → Δhard noise ±0.7 points\n\n' +
                     'So: a Δhard gap under 2 points is a tie — do not trust the ordering.\n' +
                     'Over 5 points the ordering is reliable. For more certainty, raise it to 2700.' },
      note: { vi: 'Sai số giảm theo căn bậc hai — muốn chính xác gấp đôi phải chạy gấp 4 lần.',
              en: 'Error falls with the square root — twice the precision costs four times the runs.' }
    },

    'gop-mau': {
      title: { vi: 'Gộp 2 màu', en: 'Merging two colours' },
      body: { vi: 'Lấy 2 màu ít xe nhất, <b>sơn hết xe của màu này thành màu kia</b>. Số cột giữ nguyên, nên màu mới sẽ chiếm 2 cột thay vì 1.',
              en: 'Take the two least common colours and <b>repaint every car of one into the other</b>. The column count is unchanged, so the surviving colour now owns two columns instead of one.' },
      example: { vi: '<b>Level 4</b> — 5 cột, 5 màu, mỗi màu đúng 5 xe cho 1 cột:\n' +
                     '  blue 5   lime 5   magenta 5   red 5   yellow 5   + 1 xe ngược chiều\n\n' +
                     'Gộp lime vào yellow:\n' +
                     '  blue 5   magenta 5   red 5   <b>yellow 10</b>   + 1 xe ngược chiều\n\n' +
                     'yellow giờ đủ 10 xe = <b>2 cột</b>. Xe pad màu yellow có 2 chỗ để nhả.',
                 en: '<b>Level 4</b> — five columns, five colours, exactly five cars each:\n' +
                     '  blue 5   lime 5   magenta 5   red 5   yellow 5   + 1 wrong-way car\n\n' +
                     'Merge lime into yellow:\n' +
                     '  blue 5   magenta 5   red 5   <b>yellow 10</b>   + 1 wrong-way car\n\n' +
                     'Yellow now has ten cars = <b>two columns</b>. A yellow pad car has two homes.' },
      note: { vi: 'Cảnh báo đo được: gộp màu làm <b>độ sâu tăng nhưng độ khó GIẢM</b>. Nhiều chỗ nhả xe đúng hơn ⇒ ít nước phí ⇒ dễ thắng hơn. Dùng khi level bị chê nhạt, không phải khi cần siết.',
              en: 'Measured warning: merging raises <b>depth but LOWERS difficulty</b>. More correct places to drop means fewer wasted moves, so it is easier to win. Use it when a level feels bland, not when it needs tightening.' }
    },

    'xe-la': {
      title: { vi: 'Xe lạ', en: 'Stray cars' },
      body: { vi: 'Số xe không nằm đúng cột màu của nó. Mỗi xe lạ bắt buộc phải bị văng ra khỏi cột, nên nó là sàn dưới của số nước cần đi.',
              en: 'Cars that are not in their colour\'s column. Every stray must be ejected, so the count is a floor on the moves required.' },
      example: { vi: 'Cột đích là yellow:\n' +
                     '  yellow yellow yellow <b>red</b>     → 1 xe lạ. Auto-sort lo được:\n' +
                     '                                       khi xe pad là yellow, red tự trôi\n' +
                     '                                       xuống đáy, tap 1 phát là xong cột.\n\n' +
                     '  yellow <b>red</b> yellow <b>blue</b>   → 2 xe lạ. Auto-sort KHÔNG kích.\n' +
                     '                                       Player phải tự tính thứ tự moi ra.',
                 en: 'Target colour is yellow:\n' +
                     '  yellow yellow yellow <b>red</b>     → one stray. Auto-sort handles it:\n' +
                     '                                       when the pad car is yellow, red slides\n' +
                     '                                       to the bottom and one tap finishes it.\n\n' +
                     '  yellow <b>red</b> yellow <b>blue</b>   → two strays. Auto-sort does NOT fire.\n' +
                     '                                       The player works out the order.' },
      note: { vi: 'Đây là chỗ ranh giới quan trọng: <b>1 xe lạ = miễn phí, 2 xe lạ = phải nghĩ.</b> Muốn khó hơn thì đẩy các cột qua mốc 2.',
              en: 'This is the important threshold: <b>one stray is free, two require thought.</b> To make a level harder, push columns past two.' }
    },

    'mau-cot': {
      title: { vi: 'Số màu / số cột', en: 'Colours / columns' },
      body: { vi: 'Tỉ lệ này quyết định level có quyết định thật hay không.',
              en: 'This ratio decides whether the level contains any real decision.' },
      list: { vi: ['<b>màu = cột</b> — mỗi màu đúng 1 cột. Xe văng ra chỉ hợp đúng 1 chỗ. Chuỗi ép, độ sâu ≈ 0.',
                   '<b>màu &lt; cột</b> — có màu chiếm 2 cột. Player phải chọn. Đây là cách duy nhất tạo độ sâu.'],
              en: ['<b>colours = columns</b> — one column each. The ejected car fits exactly one place. A forced chain, depth ≈ 0.',
                   '<b>colours &lt; columns</b> — some colour owns two columns. The player must choose. This is the only way to create depth.'] },
      example: { vi: 'Level 1–5, 7–10: màu = cột  → độ sâu 0–6%\n' +
                     'Level 6: 3 màu / 5 cột      → độ sâu 29%\n\n' +
                     'Level 6 là level duy nhất trong 10 level đầu có puzzle thật, và nó\n' +
                     'khác mọi level khác đúng ở chỗ này.',
                 en: 'Levels 1–5 and 7–10: colours = columns  → depth 0–6%\n' +
                     'Level 6: 3 colours / 5 columns           → depth 29%\n\n' +
                     'Level 6 is the only one of the first ten with a real puzzle, and this\n' +
                     'is the single thing that differs.' },
      note: { vi: 'Kích thước bàn KHÔNG phải trục độ sâu. Bàn 6×6 mà mỗi màu 1 cột vẫn nhạt hơn bàn 4×4 có 2 cột trùng màu.',
              en: 'Board size is NOT the depth axis. A 6×6 with one colour per column is blander than a 4×4 where two columns share one.' }
    },

    'minmoves': {
      title: { vi: 'minMoves', en: 'minMoves' },
      body: { vi: 'Số nước của lời giải <b>tối ưu tuyệt đối</b>, tìm bằng IDA*. Solver nhìn thấy cả xe ẩn nên đây là chặn dưới lý thuyết, không phải thứ player đạt được.',
              en: 'The length of the <b>absolute optimum</b>, found with IDA*. The solver sees hidden cars, so this is a theoretical floor rather than something a player reaches.' },
      note: { vi: 'Dấu <b>~</b> nghĩa là solver hết ngân sách tìm kiếm, con số là lời giải greedy tìm được nên có thể chưa tối ưu. Để đặt budget thì dùng playtest chuẩn hơn.',
              en: 'A <b>~</b> means the solver ran out of search budget and the number is a greedy solution, possibly not optimal. For setting a budget, the playtest is the better reference.' }
    },

    'naive-win': {
      title: { vi: 'naiveWin', en: 'naiveWin' },
      body: { vi: 'Tỉ lệ thắng của player bấm theo bản năng, có lỗi tay, và <b>không nhìn thấy màu xe ẩn</b>.',
              en: 'The win rate of a player tapping on instinct, making mistakes, and <b>unable to see hidden colours</b>.' },
      list: { vi: ['trên 97% — bấm bừa cũng thắng, level không có thử thách',
                   '55–85% — vùng lành mạnh, có fail thật nên booster mới có ý nghĩa',
                   'dưới 35% — gắt, cân nhắc cho level đầu game'],
              en: ['above 97% — careless tapping wins; no challenge',
                   '55–85% — healthy: real failures, so boosters mean something',
                   'below 35% — harsh; think twice for early levels'] }
    },

    'ceiling': {
      title: { vi: 'Trần win', en: 'Win ceiling' },
      body: { vi: 'Tỉ lệ thắng của <b>chính kiểu chơi đó</b> nếu budget là vô hạn. Dưới 100% nghĩa là có những ván player bấm theo bản năng bị <b>lặp vòng</b> — đẩy xe qua lại giữa hai cột mà không tiến thêm.',
              en: 'The win rate of <b>that style of play</b> with an unlimited budget. Below 100% means some runs have the instinctive player <b>cycling</b> — shuffling cars between two columns without progress.' },
      note: { vi: 'Đây KHÔNG phải thế cờ chết. Xem mục "Game không có ngõ cụt". Trần thấp là tín hiệu level dễ làm player thật thấy bế tắc dù vẫn còn cửa thắng — đáng lo không kém gì thua thật.',
              en: 'These are NOT dead positions — see "The game has no dead ends". A low ceiling signals a level that feels stuck to real players even though a win remains available, which is as worrying as a genuine loss.' }
    },

    'no-dead-end': {
      title: { vi: 'Game không có ngõ cụt', en: 'The game has no dead ends' },
      body: { vi: 'Em kiểm tra 134 thế cờ dở sau khi chơi ẩu trên 4 level: IDA* tìm ra lời giải cho <b>toàn bộ 134 thế</b>, không thế nào bị tuyên bố vô nghiệm.',
              en: 'Across 134 lost positions from sloppy play on four levels, IDA* found a solution for <b>all 134</b> and declared none unsolvable.' },
      example: { vi: 'the co dang do sau khi choi au: 134\n' +
                     '  van giai duoc : 108\n' +
                     '  that su chet  :   0   ← không có thế nào chết\n' +
                     '  solver het node:  26   ← chỉ là hết ngân sách tìm, không phải vô nghiệm',
                 en: 'lost positions after careless play: 134\n' +
                     '  still solvable  : 108\n' +
                     '  genuinely dead  :   0   ← no position was dead\n' +
                     '  solver out of nodes: 26   ← only out of search budget, not unsolvable' },
      list: { vi: ['Lý do: chỉ cần còn 2 cột chưa khoá là đủ chỗ để đảo xe về đúng chỗ.',
                   'Cột chỉ khoá khi đã thuần một màu, nên không bao giờ khoá nhầm.'],
              en: ['Why: two unlocked columns are enough room to sort cars back into place.',
                   'A column only locks once it is already mono-colour, so it can never lock wrong.'] },
      note: { vi: 'Hệ quả cho thiết kế: <b>nguồn thua duy nhất là move budget</b>. Không có "chơi hỏng bàn". Đó là lý do budget là đòn bẩy độ khó mạnh nhất, và cũng là lý do phải đo budget bằng playtest chứ không đặt số tròn.',
              en: 'Design consequence: <b>the budget is the only source of failure</b>. There is no "ruined board". That is why the budget is the strongest difficulty lever, and why it must be measured by playtest rather than set to a round number.' }
    },

    'template': {
      title: { vi: 'Template độ khó', en: 'Difficulty templates' },
      body: { vi: 'Thang <b>10 bậc</b>, bậc 1 dễ nhất đến bậc 10 khó nhất. Mỗi bậc là một mục tiêu viết bằng đúng các knob đang có — số màu trên số cột, mật độ xe lạ, tỉ lệ xe ẩn, slack — cộng dải số mà level phải rơi vào mới được tính là bậc đó.',
              en: 'A <b>ten-step</b> ladder, step 1 easiest to step 10 hardest. Each step is a target written in the knobs the tool already has — colours per column, stray density, hidden ratio, slack — plus the measured bands a level must land in to count as that step.' },
      list: { vi: ['<b>Ảnh thu nhỏ</b> là bàn mẫu thật ở bậc đó. Xe <b>viền trắng</b> là xe lạ. Ô <b>tối viền tím</b> là xe ẩn. Chú thích dưới ảnh cho biết bao nhiêu màu trên bao nhiêu cột.',
                   '<b>Câu trong ngoặc kép</b> là cảm giác chơi, không phải cơ chế. Phần cơ chế nằm trong mục "Vì sao".',
                   '<b>Ba thanh</b> là tỉ lệ thắng của player giỏi / trung bình / ẩu, lấy từ trung vị đo được.',
                   '<b>x/7 tiêu chí</b> là level đang mở đạt bao nhiêu dải của bậc đó.'],
              en: ['The <b>thumbnail</b> is a real generated board at that step. <b>White-outlined</b> cars are strays; <b>dark cells with a violet rim</b> are hidden. The caption says how many colours across how many columns.',
                   'The <b>quoted line</b> is how it feels to play, not how it works. The mechanics sit under "Why".',
                   'The <b>three bars</b> are the win rates for the careful / average / careless player, from the measured medians.',
                   '<b>x/7 criteria</b> is how many of that step\'s bands the open level lands in.'] },
      example: { vi: 'Nhìn ảnh thu nhỏ là biết bậc đó khó theo kiểu gì:\n\n' +
                     '  bậc 1   5 màu / 5 cột   mỗi cột một màu riêng, 0-2 xe lạ\n' +
                     '  bậc 5   4 màu / 5 cột   bắt đầu có cột trùng màu\n' +
                     '  bậc 7   3 màu / 5 cột   ba cột cùng màu, 2-3 xe lạ mỗi cột\n' +
                     '  bậc 10  2 màu / 5 cột   cộng thêm 8 ô bị ẩn',
                 en: 'The thumbnail tells you what kind of hard a step is:\n\n' +
                     '  step 1   5 colours / 5 cols   one colour per column, 0-2 strays\n' +
                     '  step 5   4 colours / 5 cols   columns start sharing a colour\n' +
                     '  step 7   3 colours / 5 cols   three share one, 2-3 strays each\n' +
                     '  step 10  2 colours / 5 cols   plus 8 hidden cells' },
      note: { vi: 'Mọi con số <b>đo ra</b>, không đoán: sinh 3 bàn ở mỗi kích thước trong 4 kích thước cho từng bậc rồi playtest. Win trung vị của player trung bình xuống đơn điệu 100 · 99 · 97 · 93 · 88 · 83 · 79 · 72 · 58 · 52. Hai điều curve đó nói ra: bậc 1–4 gần như không làm player trung bình thua nhưng cắt một nửa player ẩu; và <b>gộp màu làm level sâu hơn nhưng hơi dễ hơn</b>, nên slack phải siết xuyên qua khúc chuyển ở bậc 6, không thì thang đứng lại.',
              en: 'Every number is <b>measured</b>, not guessed: three boards at each of four sizes per step, then playtested. The average player\'s median win falls monotonically 100 · 99 · 97 · 93 · 88 · 83 · 79 · 72 · 58 · 52. Two things that curve says: steps 1–4 barely trouble the average player while halving the careless one; and <b>merging colours makes a level deeper but slightly easier</b>, so slack must keep tightening through the step-6 transition or the ladder stalls.' }
    },

    'trap': {
      title: { vi: 'Trap', en: 'Trap' },
      body: { vi: 'Bấm sai <b>một</b> nước thì tốn thêm trung bình bao nhiêu nước để gỡ.',
              en: 'How many extra moves <b>one</b> wrong tap costs on average.' },
      example: { vi: 'trap +1  → sai gần như không bị phạt, level tha thứ quá dễ dãi\n' +
                     'trap +4  → mỗi lần sai ăn đứt 4 nước budget, sai 2 lần là hết cửa',
                 en: 'trap +1  → mistakes go almost unpunished; the level is too forgiving\n' +
                     'trap +4  → each mistake eats four moves of budget; two and it is over' },
      note: { vi: 'Trap cao + slack chặt = level căng. Trap thấp + slack rộng = level ru ngủ.',
              en: 'High trap with tight slack makes a tense level. Low trap with loose slack makes a lullaby.' }
    },

    'forced-choice-dump': {
      title: { vi: 'forced / choice / dump', en: 'forced / choice / dump' },
      body: { vi: 'Ba nhóm này cộng lại bằng 100%. Chúng phân loại từng lượt theo số cột nhận được xe trên pad mà không tạo thêm rác.',
              en: 'These three sum to 100%. They classify each turn by how many columns can take the pad car without adding mess.' },
      list: { vi: ['<b>forced</b> — đúng 1 cột nhận được. Không có gì để chọn.',
                   '<b>choice</b> — từ 2 cột trở lên. Đây là độ sâu.',
                   '<b>dump</b> — không cột nào nhận được. Buộc phải nhả bừa và tự tạo thêm xe lạ.'],
              en: ['<b>forced</b> — exactly one column takes it. Nothing to choose.',
                   '<b>choice</b> — two or more. This is depth.',
                   '<b>dump</b> — none. You must drop it badly and create a stray.'] },
      note: { vi: 'dump 5–20% là gia vị tốt: nó tạo những lượt player phải chọn "đổ rác vào đâu cho ít đau nhất". Dump 0% thường đi kèm level nhạt.',
              en: '5–20% dump is good seasoning: it creates turns where the player picks the least painful place to dump. 0% dump usually means a bland level.' }
    },

    'xe-an': {
      title: { vi: 'Xe ẩn (?)', en: 'Hidden cars (?)' },
      body: { vi: 'Xe giấu màu, <b>lộ ngay khi nó di chuyển</b> — tức lần đầu cột đó bị tap.',
              en: 'Cars with their colour concealed, <b>revealed the moment they move</b> — the first time their column is tapped.' },
      note: { vi: 'Vì lộ sớm nên tác dụng ngắn: nó chỉ chặn được lượt lập kế hoạch đầu tiên cho mỗi cột. Đừng dùng như trục độ khó chính. Level 9 ẩn 10/25 ô là quá nhiều, player mất khả năng tính trước.',
              en: 'Because they reveal early, the effect is brief: they only block the first planning turn per column. Do not use it as the main difficulty axis. Level 9 hides 10 of 25 cells, which is too many — the player cannot plan at all.' }
    },

    'xe-nguoc-chieu': {
      title: { vi: 'Xe ngược chiều', en: 'The wrong-way car' },
      body: { vi: 'Xe <b>không màu</b>. Cột nào chứa nó thì không bao giờ hoàn thành được, nên nó luôn phải bị đẩy đi.',
              en: 'A <b>colourless</b> car. Any column holding it can never be complete, so it always has to be moved on.' },
      note: { vi: 'Nó chính là xe lẻ thứ <b>cols×rows+1</b> — không bắt buộc phải đặt vào đâu cả, và khi thắng thì nó nằm lại trên pad. Đây là lý do tổng số xe luôn lẻ ra 1.',
              en: 'It is the <b>cols×rows+1</b>-th car — never required to be placed anywhere, and on a win it is the one left on the pad. That is why the car count is always one over.' }
    },

    'budget-curve': {
      title: { vi: 'Đường cong budget → win rate', en: 'The budget → win-rate curve' },
      body: { vi: 'Mỗi ván được chơi với budget <b>vô hạn</b> rồi ghi lại số nước thực dùng. Từ đó suy ra win rate ở bất kỳ budget nào: chính là tỉ lệ ván về đích trong ngần ấy nước.',
              en: 'Every run is played with an <b>unlimited</b> budget and the moves actually used are recorded. The win rate at any budget follows: it is the share of runs that finished within that many moves.' },
      note: { vi: 'Cách đọc: chọn win rate muốn ở trục dọc, dò ngang tới đường của hạng player mình nhắm, rồi nhìn xuống trục ngang lấy budget. Kẻ vàng là budget đang đặt.',
              en: 'How to read it: pick the win rate you want on the vertical axis, run across to the profile you are targeting, then down to the budget. The amber line is the current budget.' }
    },

    'auto-sort': {
      title: { vi: 'Auto-sort', en: 'Auto-sort' },
      body: { vi: 'Sau mỗi nước, cột nào chỉ còn <b>thiếu đúng 1 xe</b> đúng màu với xe đang trên pad thì xe lạ duy nhất của nó tự trôi xuống đáy.',
              en: 'After every move, any column that is <b>exactly one car short</b> in the pad car\'s colour has its single stray slide to the bottom.' },
      example: { vi: 'Xe pad: yellow.  Cột:  yellow yellow <b>REV</b> yellow yellow\n' +
                     'Auto-sort dời REV xuống đáy:  yellow yellow yellow yellow <b>REV</b>\n' +
                     'Giờ tap cột này: yellow chèn vào đỉnh, REV văng ra, cột xong.',
                 en: 'Pad car: yellow.  Column:  yellow yellow <b>REV</b> yellow yellow\n' +
                     'Auto-sort moves REV to the bottom:  yellow yellow yellow yellow <b>REV</b>\n' +
                     'Now tap it: yellow enters the top, REV ejects, the column is done.' },
      note: { vi: 'Đây là lý do 1 xe lạ gần như miễn phí. Nó nằm trong engine chứ không phải hiệu ứng UI — nếu để ở UI thì mọi con số solver đo được sẽ sai.',
              en: 'This is why one stray is nearly free. It lives in the engine, not as a UI effect — put it in the UI and every solver measurement is wrong.' }
    }
  };

  /* Every field is a {vi, en} pair; list is {vi: [...], en: [...]}. */
  function LL(v) {
    if (v == null) return v;
    if (global.I18N) return global.I18N.L(v);
    return v.en != null ? v.en : (v.vi != null ? v.vi : v);
  }

  var pop = null;

  function close() {
    if (pop) { pop.remove(); pop = null; }
    document.querySelectorAll('.help.on').forEach(function (b) { b.classList.remove('on'); });
  }

  function open(badge) {
    var t = TOPICS[badge.dataset.help];
    if (!t) return;
    close();
    badge.classList.add('on');

    pop = document.createElement('div');
    pop.className = 'help-pop';

    var h = document.createElement('div');
    h.className = 'help-title';
    h.textContent = LL(t.title);
    pop.appendChild(h);

    if (t.body) {
      var b = document.createElement('div');
      b.className = 'help-body';
      b.innerHTML = LL(t.body);
      pop.appendChild(b);
    }
    if (t.list) {
      var ul = document.createElement('ul');
      ul.className = 'help-list';
      (LL(t.list) || []).forEach(function (li) {
        var n = document.createElement('li');
        n.innerHTML = li;
        ul.appendChild(n);
      });
      pop.appendChild(ul);
    }
    if (t.example) {
      var pre = document.createElement('pre');
      pre.className = 'help-ex';
      pre.innerHTML = LL(t.example);
      pop.appendChild(pre);
    }
    if (t.note) {
      var n2 = document.createElement('div');
      n2.className = 'help-note';
      n2.innerHTML = LL(t.note);
      pop.appendChild(n2);
    }
    var x = document.createElement('button');
    x.className = 'help-close';
    x.textContent = '×';
    x.addEventListener('click', close);
    pop.appendChild(x);

    document.body.appendChild(pop);

    var r = badge.getBoundingClientRect();
    var w = pop.offsetWidth, h2 = pop.offsetHeight;
    var left = Math.min(Math.max(8, r.left - 12), window.innerWidth - w - 8);
    var top = r.bottom + 8;
    if (top + h2 > window.innerHeight - 8) top = Math.max(8, r.top - h2 - 8);
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
  }

  document.addEventListener('click', function (e) {
    var badge = e.target.closest ? e.target.closest('.help') : null;
    if (badge) { e.stopPropagation(); if (badge.classList.contains('on')) close(); else open(badge); return; }
    if (pop && !e.target.closest('.help-pop')) close();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  window.addEventListener('resize', close);

  /* Build a badge node for code that renders panels dynamically. */
  function badge(topic) {
    var b = document.createElement('span');
    b.className = 'help';
    b.dataset.help = topic;
    b.title = 'giải thích';
    return b;
  }

  global.Help = { TOPICS: TOPICS, badge: badge, close: close };
})(typeof self !== 'undefined' ? self : this);
