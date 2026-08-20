/* Click-to-open explanations for every number the tool reports.
 * Examples are taken from the real levels, not invented, so the wording and
 * the numbers on screen can never disagree. */
(function (global) {
  'use strict';

  var TOPICS = {

    'do-kho': {
      title: 'Độ khó (0–100)',
      body: 'Tỉ lệ <b>thua</b>. Càng cao càng khó. Ghép từ 5 thành phần, nặng nhất là tỉ lệ thua thật đo bằng playtest.',
      list: [
        '38% — tỉ lệ thua của player trung bình ở đúng budget đang đặt',
        '25% — số lượt phải suy nghĩ (độ sâu)',
        '15% — budget chặt hay lỏng (slack)',
        '13% — level dài hay ngắn',
        '9% — số xe ẩn'
      ],
      note: 'Dưới 20 = gần như không ai thua được. Trên 70 = rất gắt.'
    },

    'do-sau': {
      title: 'Độ sâu (0–100)',
      body: '% số lượt mà player có <b>từ 2 cột trở lên</b> để nhả xe trên pad vào mà không tạo thêm rác. Có ≥2 lựa chọn = phải suy nghĩ. Chỉ có 1 = tay tự đi, không phải puzzle.',
      example:
        '<b>Level 1 — độ sâu 0.</b> Xe pad màu lime. Chỉ cột 2 là cột lime:\n' +
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
      note: 'Độ sâu và độ khó là 2 trục KHÁC NHAU. Level nhạt (sâu thấp) và level dễ (khó thấp) là 2 bệnh khác nhau.'
    },

    'loi-tay': {
      title: 'Lỗi tay',
      body: 'Xác suất mỗi lượt player bấm <b>đại một cột bất kỳ</b> thay vì cột tốt nhất. Đây là cách mô phỏng player thật: nhìn nhầm màu, bấm trượt, hoặc lười nghĩ.',
      example:
        'Lỗi tay 10% trên một level dài 20 nước:\n' +
        '  18 nước bấm đúng cột tốt nhất\n' +
        '   2 nước bấm ngẫu nhiên\n\n' +
        'Mỗi nước bấm bừa nhả xe sai màu vào một cột đang sạch, tạo thêm 1 xe lạ\n' +
        'phải dọn — thường tốn 2–4 nước để gỡ. Nên 2 lần lỡ tay có thể ngốn 8 nước.\n' +
        'Đó là lý do budget chặt phạt player ẩu nặng hơn nhiều so với player giỏi.',
      list: [
        '<b>giỏi</b> — lỗi tay 2%, gần như luôn bấm đúng',
        '<b>trung bình</b> — lỗi tay 10%, mốc chính để đặt budget',
        '<b>ẩu</b> — lỗi tay 25%, player vừa xem TV vừa chơi'
      ],
      note: 'Chênh lệch win giữa giỏi và ẩu chính là "kỹ năng có được thưởng không". Chênh dưới 30% nghĩa là chơi giỏi cũng vô ích.'
    },

    'slack': {
      title: 'Slack',
      body: '<b>budget ÷ số nước thực sự cần</b>. Đo budget đang thừa bao nhiêu.',
      example:
        '<b>Level 1.</b> Giải tối ưu hết 4 nước. Budget đang đặt 30.\n' +
        '  slack = 30 ÷ 4 = 7.5x  →  thừa 26 nước\n' +
        'Player phải bấm sai 26 lần mới thua. Con số "30 moves" trên màn hình\n' +
        'chỉ là trang trí, không phải cơ chế.\n\n' +
        '<b>Nếu đặt budget 6:</b>\n' +
        '  slack = 6 ÷ 4 = 1.5x  →  được phép sai 2 nước\n' +
        'Giờ mới có sức ép, và booster Undo mới có lý do tồn tại.',
      list: [
        'dưới 1.15x — phải đi gần như tối ưu tuyệt đối, quá gắt',
        '<b>1.4x – 2.2x — vùng nên nhắm</b>',
        'trên 3x — budget vô nghĩa'
      ],
      note: '"Số nước thực sự cần" lấy từ playtest (mốc 10% nhanh nhất của player giỏi), không phải lời giải hoàn hảo mà không ai tìm ra.'
    },

    'playout-runs': {
      title: 'Playout / phương án',
      body: 'Số ván máy tự chơi thử để chấm điểm <b>mỗi</b> phương án. Chia đều cho 3 hạng player — 900 nghĩa là 300 ván giỏi + 300 trung bình + 300 ẩu.',
      list: [
        'Có tác động: quyết định con số Δkhó chính xác đến đâu, và chạy nhanh hay chậm.',
        'KHÔNG có tác động: không làm level khó hơn hay dễ hơn. Chỉ là cỡ mẫu đo.'
      ],
      example:
        'Đo thật trên Level 4, chạy lại 9 lần với seed khác nhau:\n' +
        '  150 playout  → win dao động ±8.1%   → Δkhó nhiễu ±3.1 điểm\n' +
        '  300 playout  → win dao động ±3.4%   → Δkhó nhiễu ±1.3 điểm\n' +
        '  900 playout  → win dao động ±3.2%   → Δkhó nhiễu ±1.2 điểm  ← mặc định\n' +
        ' 2700 playout  → win dao động ±1.9%   → Δkhó nhiễu ±0.7 điểm\n\n' +
        'Nên: chênh lệch Δkhó dưới 2 điểm thì coi như ngang nhau, đừng tin thứ tự.\n' +
        'Chênh trên 5 điểm thì thứ tự đáng tin. Cần chắc hơn thì nâng lên 2700.',
      note: 'Sai số giảm theo căn bậc hai — muốn chính xác gấp đôi phải chạy gấp 4 lần.'
    },

    'gop-mau': {
      title: 'Gộp 2 màu',
      body: 'Lấy 2 màu ít xe nhất, <b>sơn hết xe của màu này thành màu kia</b>. Số cột giữ nguyên, nên màu mới sẽ chiếm 2 cột thay vì 1.',
      example:
        '<b>Level 4</b> — 5 cột, 5 màu, mỗi màu đúng 5 xe cho 1 cột:\n' +
        '  blue 5   lime 5   magenta 5   red 5   yellow 5   + 1 xe ngược chiều\n\n' +
        'Gộp lime vào yellow:\n' +
        '  blue 5   magenta 5   red 5   <b>yellow 10</b>   + 1 xe ngược chiều\n\n' +
        'yellow giờ đủ 10 xe = <b>2 cột</b>. Cột 1 và cột 2 đều thành cột yellow:\n' +
        '  cột1  yellow yellow yellow red    yellow   ← đích: yellow\n' +
        '  cột2  blue   yellow yellow blue   magenta  ← đích: yellow\n' +
        '  cột3  yellow yellow REV    red    red      ← đích: red\n' +
        '  cột4  red    blue   blue   red    yellow   ← đích: blue\n' +
        '  cột5  magenta magenta blue magenta yellow  ← đích: magenta\n\n' +
        'Xe pad màu yellow giờ có 2 chỗ để nhả. Đó là quyết định.',
      note: 'Cảnh báo đo được: gộp màu làm <b>độ sâu tăng nhưng độ khó GIẢM</b>. Nhiều chỗ nhả xe đúng hơn ⇒ ít nước phí ⇒ dễ thắng hơn. Dùng khi level bị chê nhạt, không phải khi cần siết.'
    },

    'xe-la': {
      title: 'Xe lạ',
      body: 'Số xe không nằm đúng cột màu của nó. Mỗi xe lạ bắt buộc phải bị văng ra khỏi cột, nên nó là sàn dưới của số nước cần đi.',
      example:
        'Cột đích là yellow:\n' +
        '  yellow yellow yellow <b>red</b>     → 1 xe lạ. Auto-sort lo được:\n' +
        '                                       khi xe pad là yellow, red tự trôi\n' +
        '                                       xuống đáy, tap 1 phát là xong cột.\n\n' +
        '  yellow <b>red</b> yellow <b>blue</b>   → 2 xe lạ. Auto-sort KHÔNG kích.\n' +
        '                                       Player phải tự tính thứ tự moi ra.',
      note: 'Đây là chỗ ranh giới quan trọng: <b>1 xe lạ = miễn phí, 2 xe lạ = phải nghĩ.</b> Muốn khó hơn thì đẩy các cột qua mốc 2.'
    },

    'mau-cot': {
      title: 'Số màu / số cột',
      body: 'Tỉ lệ này quyết định level có quyết định thật hay không.',
      list: [
        '<b>màu = cột</b> — mỗi màu đúng 1 cột. Xe văng ra chỉ hợp đúng 1 chỗ. Chuỗi ép, độ sâu ≈ 0.',
        '<b>màu &lt; cột</b> — có màu chiếm 2 cột. Player phải chọn. Đây là cách duy nhất tạo độ sâu.'
      ],
      example:
        'Level 1–5, 7–10: màu = cột  → độ sâu 0–6%\n' +
        'Level 6: 3 màu / 5 cột      → độ sâu 29%\n\n' +
        'Level 6 là level duy nhất trong 10 level đầu có puzzle thật, và nó\n' +
        'khác mọi level khác đúng ở chỗ này.',
      note: 'Kích thước bàn KHÔNG phải trục độ sâu. Bàn 6×6 mà mỗi màu 1 cột vẫn nhạt hơn bàn 4×4 có 2 cột trùng màu.'
    },

    'minmoves': {
      title: 'minMoves',
      body: 'Số nước của lời giải <b>tối ưu tuyệt đối</b>, tìm bằng IDA*. Solver nhìn thấy cả xe ẩn nên đây là chặn dưới lý thuyết, không phải thứ player đạt được.',
      note: 'Dấu <b>~</b> nghĩa là solver hết ngân sách tìm kiếm, con số là lời giải greedy tìm được nên có thể chưa tối ưu. Để đặt budget thì dùng playtest chuẩn hơn.'
    },

    'naive-win': {
      title: 'naiveWin',
      body: 'Tỉ lệ thắng của player bấm theo bản năng, có lỗi tay, và <b>không nhìn thấy màu xe ẩn</b>.',
      list: [
        'trên 97% — bấm bừa cũng thắng, level không có thử thách',
        '55–85% — vùng lành mạnh, có fail thật nên booster mới có ý nghĩa',
        'dưới 35% — gắt, cân nhắc cho level đầu game'
      ]
    },

    'ceiling': {
      title: 'Trần win',
      body: 'Tỉ lệ thắng của <b>chính kiểu chơi đó</b> nếu budget là vô hạn. Dưới 100% nghĩa là có những ván player bấm theo bản năng bị <b>lặp vòng</b> — đẩy xe qua lại giữa hai cột mà không tiến thêm.',
      note: 'Đây KHÔNG phải thế cờ chết. Xem mục "Game không có ngõ cụt". Trần thấp là tín hiệu level dễ làm player thật thấy bế tắc dù vẫn còn cửa thắng — đáng lo không kém gì thua thật.'
    },

    'template': {
      title: 'Template độ khó',
      body: 'Bốn bậc, <b>Độ 1 dễ nhất đến Độ 4 khó nhất</b>. Mỗi bậc là một mục tiêu viết bằng đúng các knob đang có — số màu trên số cột, mật độ xe lạ, tỉ lệ xe ẩn, slack — cộng dải số mà level phải rơi vào mới được tính là bậc đó. Nên bậc nào cũng đọc được, phản biện được, sửa được (mở "Sửa template (JSON)").',
      example:
        'Mỗi bậc tì vào MỘT trục khác nhau. Bốn bậc cùng khó theo một kiểu\n' +
        'thì chỉ là một level lặp lại bốn lần.\n\n' +
        '  Độ 1  Tập lái        dạy luật        win TB  95-100%\n' +
        '  Độ 2  Giờ cao điểm   budget          win TB   80-95%\n' +
        '  Độ 3  Bãi chật       định tuyến      win TB   62-80%   độ sâu 22+\n' +
        '  Độ 4  Giờ đêm        thiếu thông tin win TB   35-62%   ẩn 18-30%\n\n' +
        'Dải win không chồng nhau, nên số 1-4 là thứ tự độ khó thật.',
      list: [
        '<b>Áp dụng cho</b> — chọn "chỉ level đang chọn" hoặc "nhiều level" rồi nhập khoảng. Cả khoảng là <b>một</b> lần Hoàn tác.',
        '<b>Áp dụng</b> — sinh cho tới khi đạt tiêu chí: bàn nhỏ hơn mức tối thiểu thì tự mở rộng, vẫn lệch thì tìm rộng hơn, vẫn lệch thì thêm 1 hàng.',
        '<b>Chỉ đặt lại budget</b> — giữ nguyên lưới đã vẽ, chỉ dò budget trong dải slack của bậc.'
      ],
      note: 'Để thang đúng thứ tự phải siết slack ở hai bậc trên. Đo được: Độ 3 ở slack 1.60 ra win TB 83–98% — <b>ngang hệt Độ 2</b>, tức sâu hơn mà không khó hơn, nên slack phải về 1.42. Độ 4 ở slack 1.45 ra 70–98%, không khó hơn Độ 3, nên phải về 1.28. Bài học: <b>gộp màu và siết budget trừ nhau, không cộng</b> — ít màu hơn số cột cho player nhiều chỗ nhả xe đúng hơn nên tự động bớt move phí.'
    },

    'no-dead-end': {
      title: 'Game không có ngõ cụt',
      body: 'Em kiểm tra 134 thế cờ dở sau khi chơi ẩu trên 4 level: IDA* tìm ra lời giải cho <b>toàn bộ 134 thế</b>, không thế nào bị tuyên bố vô nghiệm.',
      example:
        'the co dang do sau khi choi au: 134\n' +
        '  van giai duoc : 108\n' +
        '  that su chet  :   0   ← không có thế nào chết\n' +
        '  solver het node:  26   ← chỉ là hết ngân sách tìm, không phải vô nghiệm',
      list: [
        'Lý do: chỉ cần còn 2 cột chưa khoá là đủ chỗ để đảo xe về đúng chỗ.',
        'Cột chỉ khoá khi đã thuần một màu, nên không bao giờ khoá nhầm.'
      ],
      note: 'Hệ quả cho thiết kế: <b>nguồn thua duy nhất là move budget</b>. Không có "chơi hỏng bàn". Đó là lý do budget là đòn bẩy độ khó mạnh nhất, và cũng là lý do phải đo budget bằng playtest chứ không đặt số tròn.'
    },

    'trap': {
      title: 'Trap',
      body: 'Bấm sai <b>một</b> nước thì tốn thêm trung bình bao nhiêu nước để gỡ.',
      example:
        'trap +1  → sai gần như không bị phạt, level tha thứ quá dễ dãi\n' +
        'trap +4  → mỗi lần sai ăn đứt 4 nước budget, sai 2 lần là hết cửa',
      note: 'Trap cao + slack chặt = level căng. Trap thấp + slack rộng = level ru ngủ.'
    },

    'forced-choice-dump': {
      title: 'forced / choice / dump',
      body: 'Ba nhóm này cộng lại bằng 100%. Chúng phân loại từng lượt theo số cột nhận được xe trên pad mà không tạo thêm rác.',
      list: [
        '<b>forced</b> — đúng 1 cột nhận được. Không có gì để chọn.',
        '<b>choice</b> — từ 2 cột trở lên. Đây là độ sâu.',
        '<b>dump</b> — không cột nào nhận được. Buộc phải nhả bừa và tự tạo thêm xe lạ.'
      ],
      note: 'dump 5–20% là gia vị tốt: nó tạo những lượt player phải chọn "đổ rác vào đâu cho ít đau nhất". Dump 0% thường đi kèm level nhạt.'
    },

    'xe-an': {
      title: 'Xe ẩn (?)',
      body: 'Xe giấu màu, <b>lộ ngay khi nó di chuyển</b> — tức lần đầu cột đó bị tap.',
      note: 'Vì lộ sớm nên tác dụng ngắn: nó chỉ chặn được lượt lập kế hoạch đầu tiên cho mỗi cột. Đừng dùng như trục độ khó chính. Level 9 ẩn 10/25 ô là quá nhiều, player mất khả năng tính trước.'
    },

    'xe-nguoc-chieu': {
      title: 'Xe ngược chiều',
      body: 'Xe <b>không màu</b>. Cột nào chứa nó thì không bao giờ hoàn thành được, nên nó luôn phải bị đẩy đi.',
      note: 'Nó chính là xe lẻ thứ <b>cols×rows+1</b> — không bắt buộc phải đặt vào đâu cả, và khi thắng thì nó nằm lại trên pad. Đây là lý do tổng số xe luôn lẻ ra 1.'
    },

    'budget-curve': {
      title: 'Đường cong budget → win rate',
      body: 'Mỗi ván được chơi với budget <b>vô hạn</b> rồi ghi lại số nước thực dùng. Từ đó suy ra win rate ở bất kỳ budget nào: chính là tỉ lệ ván về đích trong ngần ấy nước.',
      note: 'Cách đọc: chọn win rate muốn ở trục dọc, dò ngang tới đường của hạng player mình nhắm, rồi nhìn xuống trục ngang lấy budget. Kẻ vàng là budget đang đặt.'
    },

    'auto-sort': {
      title: 'Auto-sort',
      body: 'Sau mỗi nước, cột nào chỉ còn <b>thiếu đúng 1 xe</b> đúng màu với xe đang trên pad thì xe lạ duy nhất của nó tự trôi xuống đáy.',
      example:
        'Xe pad: yellow.  Cột:  yellow yellow <b>REV</b> yellow yellow\n' +
        'Auto-sort dời REV xuống đáy:  yellow yellow yellow yellow <b>REV</b>\n' +
        'Giờ tap cột này: yellow chèn vào đỉnh, REV văng ra, cột xong.',
      note: 'Đây là lý do 1 xe lạ gần như miễn phí. Nó nằm trong engine chứ không phải hiệu ứng UI — nếu để ở UI thì mọi con số solver đo được sẽ sai.'
    }
  };

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
    h.textContent = t.title;
    pop.appendChild(h);

    if (t.body) {
      var b = document.createElement('div');
      b.className = 'help-body';
      b.innerHTML = t.body;
      pop.appendChild(b);
    }
    if (t.list) {
      var ul = document.createElement('ul');
      ul.className = 'help-list';
      t.list.forEach(function (li) {
        var n = document.createElement('li');
        n.innerHTML = li;
        ul.appendChild(n);
      });
      pop.appendChild(ul);
    }
    if (t.example) {
      var pre = document.createElement('pre');
      pre.className = 'help-ex';
      pre.innerHTML = t.example;
      pop.appendChild(pre);
    }
    if (t.note) {
      var n2 = document.createElement('div');
      n2.className = 'help-note';
      n2.innerHTML = t.note;
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
