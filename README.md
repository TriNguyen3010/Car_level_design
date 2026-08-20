# Car Sort — Level & Feel Tool

Web prototype + level editor. Mở bằng:

```bash
python3 tools/serve.py 5173
```

rồi vào `http://localhost:5173`. Không build step, không dependency.

**Dùng `tools/serve.py`, đừng dùng `python3 -m http.server`** — bản mặc định để Chrome cache `src/*.js` sau khi sửa file, và cái đó hiện ra y hệt "sửa xong mà không thấy đổi gì".

Góc trái trên có badge **build hh:mm dd-mm** = thời điểm `src/tool.js` sửa lần cuối. Số đó không khớp với lần sửa gần nhất thì browser đang chạy bản cũ.

**Mở ra là chế độ Test — chỉ có 3 tab.** Bấm **⚙ Level Design** góc phải trên mới ra Tune (4 template độ khó + gợi ý khó/dễ), Edit (vẽ lưới), Feel (animation + kiểu dáng xe).

Lần đầu mở tool có popup **Bắt đầu ở đâu** — 4 bộ cấp độ, 3 chế độ mỗi cái một dòng, hết. Bấm **Tôi đã hiểu rồi** để không hiện lại; mở lại bằng nút **Hướng dẫn**.

Tool không dùng `alert`/`confirm` của trình duyệt — mọi hộp thoại là modal trong tool.

## Luật game (như code đang implement)

- `grid[col][row]`, **row 0 = đỉnh cột**.
- Tap 1 cột: xe trên pad **chèn vào đỉnh**, cả cột **dồn xuống 1 ô**, xe ở **đáy văng ra pad** và trở thành xe kế tiếp.
- Tổng xe luôn là `cols × rows + 1`. Đúng 1 xe lẻ kết thúc trên pad.
- Cột toàn 1 màu = hoàn thành, **khoá lại**, không tap được nữa. Win khi mọi cột hoàn thành.
- **Xe ngược chiều (`REV`)**: không màu. Cột chứa nó không bao giờ hoàn thành, và nó không bắt buộc phải đặt — nó chính là xe lẻ kết thúc trên pad.
- **Xe ẩn (`?`)**: lộ màu ngay khi di chuyển, tức lần đầu cột đó bị tap.
- **Auto-sort**: sau mỗi move, cột nào chỉ còn thiếu 1 xe đúng màu với xe trên pad thì xe lạ duy nhất của nó được dời xuống đáy — tap cột đó vừa hoàn thành cột vừa văng xe lạ ra.

## Kiến trúc

| File | Vai trò |
|---|---|
| `src/engine.js` | Luật thuần. Không DOM, không timer, không random. Tool và solver dùng chung. |
| `src/solver.js` | IDA* tìm `minMoves`, greedy upper bound, playout đo win rate, phân loại quyết định. |
| `src/gen.js` | Sinh level. Bắt đầu từ bàn đã giải rồi chỉ đổi chỗ 2 xe, nên luôn hợp lệ. |
| `src/playtest.js` | Chạy hàng vạn ván với budget vô hạn, dựng đường cong budget → win rate. |
| `src/playtest-worker.js` | Chạy playtest ngoài main thread. |
| `src/tuner.js` | Đòn bẩy độ khó + gợi ý có đo đạc. |
| `src/feel.js` | Mọi timing / easing / juice + SFX synth. Không ảnh hưởng luật. |
| `src/render.js` | Hình học bàn + animation. Mọi con số lấy từ `feel.js`. |
| `src/tool.js` | UI: play, tune, edit, feel, export. |

Auto-sort nằm trong `engine.js`, **không** nằm ở UI — nếu để ở UI thì solver sẽ đo sai.

## Template độ khó (tab Tune)

**Thang 10 bậc**, bậc 1 dễ nhất đến bậc 10 khó nhất. Bốn tên cũ thành **nhóm**, cho biết bậc đó khó theo kiểu gì.

| Bậc | Nhóm | màu/cột | xe lạ | ẩn | slack | win TB | win ẩu | bàn tối thiểu |
|---|---|---|---|---|---|---|---|---|
| 1 | Tập lái | 1.00 | 12% | 0 | 3.20x | 92–100% | 77–100% | 3×3 |
| 2 | Tập lái | 1.00 | 20% | 0 | 2.10x | 91–100% | 53–89% | 3×3 |
| 3 | Giờ cao điểm | 1.00 | 26% | 0 | 1.72x | 89–100% | 42–78% | 4×5 |
| 4 | Giờ cao điểm | 1.00 | 30% | 0 | 1.56x | 85–99% | 23–59% | 4×5 |
| 5 | Giờ cao điểm | 1.00 | 36% | 0 | 1.44x | 80–94% | 22–58% | 4×5 |
| 6 | Bãi chật | 0.62 | 38% | 0 | 1.34x | 75–89% | 22–58% | 5×5 |
| 7 | Bãi chật | 0.60 | 42% | 0 | 1.26x | 71–85% | 21–57% | 5×5 |
| 8 | Bãi chật | 0.60 | 46% | 0 | 1.20x | 64–78% | 14–50% | 5×5 |
| 9 | Giờ đêm | 0.60 | 44% | 18% | 1.15x | 50–64% | 8–44% | 5×6 |
| 10 | Giờ đêm | 0.60 | 48% | 26% | 1.10x | 44–58% | 5–41% | 5×6 |

Mọi con số **đo ra**: sinh 3 bàn ở mỗi kích thước trong 4 kích thước cho từng bậc rồi playtest. Win trung vị của player trung bình xuống đơn điệu **100 · 99 · 97 · 93 · 88 · 83 · 79 · 72 · 58 · 52**. Kiểm chứng lại: 40/40 (10 bậc × 4 kích thước) đạt 7/7 tiêu chí.

Hai điều hình dạng curve đó nói cho level design:

**Bậc 1–4 gần như không làm player trung bình thua** (100 → 93) nhưng **cắt một nửa player ẩu** (94 → 40). Độ khó đầu game là chuyện phạt sự lơ đễnh, không phải chuyện kỹ năng.

**Budget gánh cả cái thang.** Hạ số màu xuống dưới số cột ở bậc 6 làm level **sâu hơn nhưng hơi dễ hơn** — nhiều cột nhận được xe trên pad hơn nên bớt move phí. Đo trực tiếp: ở slack 1.48 bậc 6 ra dễ hơn bậc 5. Nên slack phải tiếp tục siết qua khúc chuyển đó, không thì thang đứng lại. **Gộp màu và siết budget trừ nhau, không cộng.**

### Phạm vi áp dụng

Ô **Áp dụng cho** có 3 lựa chọn:

| | |
|---|---|
| **chỉ level đang chọn** (mặc định) | chỉ ghi vào level đang mở |
| **toàn bộ level** | cả set, không cần nhập gì |
| **khoảng tuỳ chọn** | nhập từ/đến |

Mỗi level được sinh và playtest **riêng**, **giữ nguyên kích thước bàn của nó** (chỉ mở rộng nếu nhỏ hơn mức tối thiểu của bậc). Cả khoảng là **một** lần Hoàn tác, không phải 10 lần. Có nút **Huỷ** giữa lúc chạy.

Áp một bậc cho cả set thì tool cảnh báo curve sẽ phẳng và gợi ý chia khoảng.

Kiểm chứng: áp Độ 2 cho cả 10 level → **10/10 đạt 7/7 trong 1.7 giây**, một lần Hoàn tác trả lại đúng cả 10.

Việc này chạy trong Web Worker. Trước đó nó chunk bằng `setTimeout` trên luồng chính, và tab nền bóp mỗi `setTimeout` xuống ~1 giây — 10 level cần hàng trăm lần yield nên mất **nhiều phút** thay vì 1.7 giây.

Thẻ giữ ba thứ luôn hiện, còn lại gập:

- **Ảnh thu nhỏ của một bàn mẫu thật** ở bậc đó — xe viền trắng là xe lạ, ô tối viền tím là xe ẩn, chú thích dưới ảnh là *bao nhiêu màu trên bao nhiêu cột*. Nhìn ảnh là thấy ngay bậc 1 có 5 màu cho 5 cột còn bậc 7 chỉ 3 màu, tức có cột trùng màu.
- **Ba thanh win rate** trên một dòng: `giỏi ▬100% · TB ▬88% · ẩu ▬39%`.
- **Chỉ những tiêu chí đang lệch.** Badge đã ghi `6/7` nên hàng loạt dấu tích không cần chỗ; cả 7 tiêu chí nằm sau một cú bấm.

Gập lại: **câu cảm giác chơi** làm tiêu đề mục mở rộng — *"▸ Bấm sai 2–3 lần là thua. Đây là chỗ Undo bắt đầu đáng tiền."* — mở ra có số của bàn mẫu (*lời giải 17 move, cho 22*) và phần giải thích cơ chế.

Mỗi thẻ có:
- **Áp dụng** — sinh cho tới khi **đạt tiêu chí**, không chặn lại. Bàn nhỏ hơn mức tối thiểu thì tự mở rộng; vẫn lệch thì mở rộng tìm kiếm; vẫn lệch thì thêm 1 hàng. Kiểm chứng: 20/20 trường hợp bắt đầu từ 3×3 đến 6×6 đều đạt 7/7.
- **Chỉ đặt lại budget** — giữ nguyên lưới a đã vẽ, chỉ dò budget.
- **x/7 tiêu chí** — level hiện tại đạt bao nhiêu dải, kèm giá trị thật vs dải cần.

Dòng đầu cho biết level đang giống bậc nào. Toàn bộ template nằm trong `src/difficulty.js` và sửa được ngay trong UI qua ô **Sửa template (JSON)**.

Bàn quá nhỏ so với bậc thì tool tự mở rộng và nói rõ lý do — bàn ngắn thì lời giải ngắn, không đủ số nước để player kịp thua.

## Cân chỉnh ở mức cao (tab Tune)

Bấm **Muốn khó hơn** / **Muốn dễ hơn**. Tool dựng một level ứng viên cho từng đòn bẩy, **playtest thật từng cái**, rồi xếp theo tác động đo được. Không phỏng đoán.

Năm đòn bẩy, và chúng không giống nhau chút nào khi chơi:

| Đòn bẩy | Tác động điển hình |
|---|---|
| **Move budget** | Mạnh nhất khi slack đang lỏng. Siết từ 3x xuống 1.35x biến move count từ số trang trí thành sức ép thật. |
| **Kích thước (số hàng)** | Cột dài hơn ⇒ xe lạ nằm sâu hơn ⇒ tốn nhiều move moi ra. Rất gắt khi budget đã chặt. |
| **Số xe lạ** | Cột có ≥2 xe lạ thì auto-sort không kích, player phải tự lo thứ tự. |
| **Xe ẩn** | Chặn lập kế hoạch. Lộ ngay khi cột bị tap nên tác dụng ngắn — đừng lạm dụng. |
| **Số màu** | **Đổi ĐỘ SÂU, không đổi độ khó.** Ít màu hơn số cột ⇒ 2 cột cùng màu ⇒ nhiều quyết định thật, nhưng cũng nhiều chỗ nhả xe đúng hơn nên tỉ lệ thua thường **giảm**. |

Hai trục tách riêng: **độ khó** là tỉ lệ thua, **độ sâu** là số quyết định. Level nhạt và level dễ là hai bệnh khác nhau, thuốc cũng khác.

## Playtest (tab Playtest)

Chạy 10.000 ván với **budget không giới hạn** rồi ghi lại số move thực dùng, cho 3 hạng player (lỗi tay 2% / 10% / 25%). Một lượt chạy cho ra luôn cả đường cong, nên câu hỏi không còn là "50 move có ổn không" mà là **"muốn win rate bao nhiêu thì đặt budget mấy"**.

Chạy trong Web Worker (~1.2s cho 10k). Tab nền bóp `setTimeout` xuống 1s/lần nên chunk trên main thread từng mất 18s cho đúng công việc đó.

## Asset

Xem **ASSETS.md**. Tóm tắt: đưa 1 xe trắng/xám 512², em nhuộm ra cả 18 màu — hình dạng giống nhau tuyệt đối.

- `recolor.html` — thả file vào, kéo slider, download PNG hoặc spritesheet
- `tools/recolor.py` — bản CLI, đọc palette thẳng từ `src/levels.js`
- `tools/make_placeholder_car.py` — sinh xe placeholder để test pipeline trước khi có art thật

Bật **dùng sprite** ở tab Feel để xem ngay trong game. Thiếu file nào thì xe CSS tự động thế chỗ, không vỡ layout.

## Giải thích số ngay trong tool

Mọi chỉ số đều có dấu <b>?</b> bấm được, mở ra giải thích kèm ví dụ lấy từ chính 10 level này (`src/help.js`). Có badge cho: độ khó, độ sâu, lỗi tay, slack, playout/phương án, gộp 2 màu, xe lạ, màu/cột, forced/choice/dump, minMoves, naiveWin, trần win, trap, xe ẩn, xe ngược chiều, auto-sort, đường cong budget.

## Đọc số

| Số | Nghĩa | Vùng tốt |
|---|---|---|
| `minMoves` | lời giải tối ưu, solver thấy cả xe ẩn | — |
| `slack` | `budget / minMoves` | 1.4 – 2.2x |
| `forced` | % lượt chỉ có 1 cột nhận được xe trên pad | thấp |
| `choice` | % lượt có ≥2 cột nhận được — puzzle thật | > 25% |
| `dump` | % lượt không cột nào nhận được, buộc đổ bừa | 5 – 20% |
| `naiveWin` | % thắng của player bấm greedy, hay nhầm, **không thấy xe ẩn** | 55 – 85% |
| `trap` | số move phí trung bình khi tap sai 1 lần | > 2 |

`choice` là dial độ khó chính, không phải grid size. Cách tăng nó: **đặt số màu ít hơn số cột** — khi 2 cột cùng màu thì player phải chọn cột nào để nhả xe.

## Song ngữ

Mặc định **tiếng Anh**. Nút **VI / EN** ở thanh header đổi qua lại, và lựa chọn được ghi nhớ trong localStorage — đã chọn rồi thì lần sau luôn thắng mặc định. Hai cơ chế, cố ý tách:

- `I18N.t('key')` — nhãn và chuỗi ngắn, gom hết trong `src/i18n.js` (228 key) nên thiếu một cái là thấy ngay.
- `I18N.L({vi, en})` — nội dung dài **nằm cùng module nó thuộc về**: giải thích của một bậc ở `difficulty.js`, ý đồ của một bộ ở `sets.js`, 19 topic help ở `help.js`. Bê chúng sang một file dịch riêng là tách khỏi thứ chúng miêu tả.

Câu ghép đi qua `I18N.m('key', a, b)` với template `{0}` (152 template). **Không dịch từng mảnh ghép chuỗi** — trật tự từ hai thứ tiếng khác nhau, dán các mảnh đã dịch lại ra câu vô nghĩa.

Một cái bẫy gặp thật khi làm: alias `t` và `L` va với tên biến sẵn có trong `tool.js` (`t` là một bậc, `L` là một level), nên trong callback chúng bị shadow và nổ `t is not a function`. Alias đổi thành `tr` và `loc`.

## Bốn bộ cấp độ

Chọn bằng nhóm nút cùng hàng với 3 chế độ: `Gốc` · `Dễ` · `Trung bình` · `Khó`, mỗi nút kèm dải bậc `1→4` / `1→7` / `2→10` và tô màu theo độ khó. **Đổi bộ là về level 1** — mỗi bộ là một curve khác, giữ số level cũ sẽ rơi vào giữa ramp của bộ mới.

Nút dẫn bằng **từ độ khó** chứ không phải tên bộ, vì "Nhịp" không nói gì về việc nó khó cỡ nào. Tên bộ và ý đồ nằm ở tooltip và ở panel tab Nhật ký. Dạng `bắt đầu→đỉnh` chứ không phải min–max, vì min–max chồng nhau ở đầu dưới (`1–7` vs `2–10`) làm khó so; số đỉnh bên phải xếp thứ tự ngay: 4, 7, 10.

Một bộ là một **cách tiếp cận**, không phải một độ dốc. Mỗi bộ có ý đồ riêng và **cố ý không tuyến tính**, vì chỗ nghỉ sau một cơ chế mới là thứ làm player cảm thấy *mình làm được* thay vì *mình vừa may*.

| Bộ | Bậc theo level | Ý đồ |
|---|---|---|
| **Gốc** | — | Dựng từ ảnh chụp. Budget rộng 2.5–8.6x — gần như không thể thua. |
| **Dễ** (Dẫn tay) | `1 1 2 2 3 `**`1`**` 3 4 4 `**`3`** | Không ai được thua. Mỗi cơ chế mới xong thì hạ bậc cho player làm lại dễ. |
| **Trung bình** (Nhịp) | `1 2 3 `**`2`**` 4 5 6 `**`5`**` 7 `**`6`** | Độ khó có nhịp. Leo 2–3 level rồi thả 1. Level 10 không phải đỉnh. |
| **Khó** (Thử ngay) | `2 4 6 `**`5`**` 7 8 `**`7`**` 9 `**`8`**` 10` | Lọc player đã quen thể loại. Đỉnh sớm ở level 3, kết đúng ở đỉnh. |

Trong tool, ý đồ chỉ xuất hiện ở **hộp thoại lúc đổi bộ** — đó là lúc người đọc đang chọn, nên đó là lúc cần lý do. Tab Độ khó không có đoạn văn nào: biểu đồ ở ngay dưới, chữ đặt cạnh biểu đồ chỉ cạnh tranh với nó và thua. Header tab chỉ ghi dữ kiện: `Bộ Dễ · bậc 1→4 · 2 chỗ nghỉ chủ ý`. Lý luận đầy đủ nằm ở README này.

Số **đậm** là chỗ nghỉ chủ ý. Xu hướng đo được: **−4.41 / −2.15 / −4.89** điểm win mỗi level.

Đổi bộ có hộp thoại xác nhận, ghi rõ đang đi từ đâu sang đâu, dải bậc hai bên, ý đồ bộ mới, và **sẽ chơi lại từ level 1**.

Sinh lại: `node tools/make_sets.js && python3 tools/pack_sets.py`

### Tab Độ khó — tab đầu tiên, mặc định mở

Ưu tiên biểu đồ vì **một bộ cấp độ là một hình dạng**, mà hình dạng là thứ để nhìn — mười dòng số buộc người đọc tự dựng lại hình trong đầu.

- **Bốn bộ cạnh nhau** — bốn đường trên cùng một trục bậc, bộ đang chọn vẽ đậm, chỗ nghỉ chủ ý là điểm tròn. Ba cách tiếp cận khác nhau nhìn ra ngay chứ không phải so ba bảng.
- **Bộ đang chọn** — bậc là cột (cột xanh = chỗ nghỉ), **tỉ lệ thắng thật là đường vẽ trên đó**. Hai thứ này lệch nhau đủ thường xuyên nên chỉ vẽ bậc là gây hiểu sai. Bấm **Đo cả bộ** để thay ước lượng bằng số playtest thật.
- **Từng level** — ảnh thu nhỏ bàn thật (xe viền trắng = xe lạ, ô tối = xe ẩn), câu cảm giác chơi của bậc đó, kích thước / budget / nhóm, và ba thanh win rate. Dòng chỗ nghỉ tô xanh.

### Hai thứ chỉ lộ ra khi kiểm chứng hình dạng

Bậc ánh xạ sang một **dải** win rate, không phải một điểm, nên răng cưa trên số bậc chưa chắc thành răng cưa trên cảm giác. Kiểm chứng bằng cách playtest cả 30 level rồi soi hình dạng curve đo được — và nó bắt được hai lỗi:

**1. Dải của hai bậc cạnh nhau chồng lên nhau**, nên chỗ nghỉ sinh ở giữa dải có thể đo ra **khó hơn** cái đỉnh nó vừa theo sau. Bộ Trung level 8 (bậc 5) ban đầu ra 82% trong khi level 7 (bậc 6) ra 85%. Sửa: chỗ nghỉ luôn sinh ở **đầu dễ của dải** — thử nhiều seed, giữ cái điểm cao nhất mà vẫn đạt đủ tiêu chí.

**2. Chỗ nghỉ đào sâu ngay trước một đỉnh mới thì thành tường**, vì leo ra khỏi nó là 3 bậc. Chính **cảnh báo curve của tool** bắt được: *"Level 8 → 9 nhảy 3 bậc"*. Đã làm hai chỗ nghỉ giữa bộ nông đi một bậc.

Bộ Dễ có một điểm riêng: nhịp của nó đo trên **player ẩu**, không phải trung bình — ở bậc 1–4 player trung bình ngồi ở 98–100% nên không có chỗ mà cảm thấy sụt, và bộ Dễ vốn nhắm người hay sai. Chỗ nghỉ ở level 6 phải sâu **hai bậc** vì sụt một bậc đo ra không cảm được gì.

Kết quả: 8/8 chỗ nghỉ đều cảm được (+5 đến +24 điểm), 30/30 level sinh ra đạt đủ 7/7 tiêu chí của bậc mình.

### Cảnh báo curve theo xu hướng

Vì hai bộ **cố ý** đi lùi, cảnh báo không mắng từng bước nữa mà soi hình dạng: xu hướng hồi quy cả chuỗi phải đi lên, sụt sâu ≥3 bậc mà không khai là chỗ nghỉ thì báo, nhảy lên ≥3 bậc thì báo, và level cuối là đỉnh thì báo — trừ bộ Khó, nơi kết ở đỉnh là chủ ý.

## Ba chế độ

Chuyển bằng nhóm nút góc phải trên. Tool mở ra ở **Test**.

| | ▶ Test | 🎮 Chơi & cân | ⚙ Level Design |
|---|---|---|---|
| Mục tiêu | chơi và đọc chỉ số | thẩm định bậc bằng tay chơi | sửa lưới, cân bằng bảng số |
| Tab | Play · Playtest · Level Set | thêm **Nhật ký** | thêm Tune · Edit · Feel |
| Sửa level | không | chỉ qua nâng/hạ bậc, có log | tự do |

Tách Test ra để một buổi playtest không bao giờ vô tình thành buổi sửa level — đó là điều kiện để các con số còn đáng tin. Mỗi chế độ có màu vạch riêng trên thanh menu.

## Chơi & cân — thẩm định bậc bằng tay chơi

Ngược với tab Tune (cân bằng bảng số), đây là cân bằng cảm giác chơi. Thanh điều khiển nằm ngay dưới menu nên không phải rời bàn:

> Level 3 · **Bậc 2** · Tập lái · ước lượng win TB 91–100% · ẩu 53–89% — **− Hạ bậc** · **+ Nâng bậc** · **⟳ Đổi bàn khác cùng bậc** · **✓ Chốt bậc 2**

Vòng lặp: chơi → thấy dễ → Nâng bậc (bàn được dựng lại ở bậc mới, đạt đủ tiêu chí của bậc đó) → chơi lại → ưng thì Chốt. Sang level sau. Cuối cùng ra một bảng kiểu `L1=1 L2=2 L3=3 L4=5 …`.

**Nâng bậc dựng lại bàn**, vì bậc khác nghĩa là knob khác. Nên a đang thẩm định *bậc*, không phải so hai phiên bản của cùng một bàn. Bậc đúng mà bàn cụ thể khó chịu thì dùng **Đổi bàn khác cùng bậc**.

### Nhật ký

Ghi **mọi lượt**, cả thắng cả thua — "thua ở bậc 5" chính là bằng chứng bậc 4 là điểm ngọt. Mỗi dòng:

```
Lv 3 · bậc 2 · thắng · 16/21 move, thừa 5, 83s · 4×5 · máy đo TB 91–100%
```

Kết quả **của a** đặt cạnh **số máy đo**. Cái này bắt buộc: a chơi 1 lượt là n = 1, và a là người ra đề nên chơi giỏi hơn player thật nhiều. "Thắng còn 5 move" của a rất có thể là "player trung bình thua 30%". Không đặt hai số cạnh nhau thì vòng lặp này đẩy độ khó lên quá tay một cách hệ thống, và a ra một set chỉ a chơi được.

Thời gian giải cũng được bắt — solver không đo được nó, mà nó là tín hiệu game feel thật.

### Cảnh báo curve

Chốt bậc xong tool soi lại cả chuỗi và cảnh báo khi ramp gãy:

- **đi lùi** — `Level 5 (bậc 3) dễ hơn level 4 (bậc 8) — player đi tới sẽ thấy game nhẹ đi`
- **nhảy quá 2 bậc** — `Level 3 → 4 nhảy 5 bậc. Nhảy quá 2 bậc thường thành tường chắn, player rơi ở đây`
- **phẳng** — cả chuỗi cùng một bậc

Bậc đã chốt đi vào JSON export dưới khoá `tier`. Tab Nhật ký có nút Copy JSON cho cả bảng bậc + toàn bộ log.

Script được từ console: `CarTool.lockTierAt(i, tier)`, `CarTool.tiers()`, `CarTool.attempts()`, `CarTool.curveWarnings()`.

## Kiểu dáng xe

9 kiểu thân xe khác nhau, cùng một màu vẫn là cùng một loại — đúng như xe ngoài đường. Mục đích: 36 ô cùng silhouette trông như giấy dán tường, đổi kiểu dáng phá được cái đó mà không thêm một luật chơi nào.

Kiểu dáng gán theo seed của level nên restart vẫn ra đúng dàn xe cũ, và luôn bốc từ đủ 9 kiểu nên kéo slider "số kiểu dáng" không xáo lại bàn. Sprite nhuộm lúc chạy trên canvas rồi cache. Xem `ASSETS.md`.

## Test level vừa chỉnh

Bấm **Áp dụng** hoặc **▶ Chơi thử** trên thẻ gợi ý. Level được thay, bàn reset, và một banner hiện ra ở đầu màn hình:

> Đang thử: **Siết budget 50 → 22** · ▶ Chơi thử · ✔ Giữ · ↶ Hoàn tác (1)

**Hoàn tác** trả lại đúng level trước đó — xếp chồng nhiều lần được. Generate và Set budget cũng vào chồng này. **Giữ** xoá chồng khi a đã ưng.

## Màn hình kết quả

Khi ván kết thúc, bấm bất kỳ đâu là thực hiện hành động hợp lý nhất:

| Tình huống | Hành động chính |
|---|---|
| Thắng, còn level sau | Level tiếp theo |
| Thắng, level cuối | Chơi lại |
| Thua, chỉ thiếu ≤5 move | **+5 move chơi tiếp** — khoảnh khắc bán booster |
| Thua, còn cần nhiều move | Chơi lại (không mời booster vô ích) |
| Đã dùng hết lượt continue | Chơi lại |

Chỉ mời "+5 move" khi solver xác nhận 5 move **thật sự đủ** để về đích. Thẻ kết quả còn kèm nhận xét cho designer: thừa quá nửa budget thì nhắc siết, thắng sát nút thì nhắc kiểm tra player ẩu.

`Enter` / `Space` cũng chạy hành động chính.

## Game không có ngõ cụt

Kiểm tra 134 thế cờ dở sau khi chơi ẩu trên 4 level: IDA* giải được **toàn bộ 134**, không thế nào vô nghiệm. Chỉ cần còn 2 cột chưa khoá là đủ chỗ đảo xe, và cột chỉ khoá khi đã thuần màu nên không bao giờ khoá nhầm.

Hệ quả: **nguồn thua duy nhất là move budget.** Không có "chơi hỏng bàn". Vì vậy budget là đòn bẩy độ khó mạnh nhất, và phải đo bằng playtest chứ không đặt số tròn.

Những ván "không về đích dù budget vô hạn" trong report là player bản năng **lặp vòng**, không phải thế cờ chết — hai thứ khác nhau và tool ghi rõ.

## Thanh header

Hai hàng, mỗi hàng chia trái/phải. Hàng 1 là **lượt đang chơi**, hàng 2 là **bộ cấp độ và thông tin phụ**.

| | trái | phải |
|---|---|---|
| hàng 1 | ◀ Level ▶ · Moves · kích thước · Restart · Undo · Hint · Autoplay · Ẩn puzzle | chế độ |
| hàng 2 | bộ cấp độ | trạng thái · Hướng dẫn · build |

## Phím tắt

`1`-`9` tap cột · `r` restart · `u`/`z` undo · `h` hint · `b` ẩn/hiện puzzle · `←`/`→` đổi level

## Ẩn/hiện puzzle

Nút **Ẩn puzzle** thu khung bàn lại để bảng số và chart dùng hết chiều ngang — hữu ích khi đọc report Playtest hoặc curve.

Thuần hiển thị, không chạm engine: state, move count, cột đã khoá đều giữ nguyên, và tap cột trong lúc ẩn vẫn tính nước bình thường. Hình học bàn tính từ kích thước thật của khung nên khi ẩn mọi lệnh vẽ bị hoãn lại, hiện lên thì vẽ lại đúng.

## Git

`main` giữ bản trước khi có tuner/playtest/asset. Muốn quay lại: `git checkout main`.

## Export

Tab **Level Set** → `Xuất JSON set` / `Download .json`. File gồm `palette`, `feel`, và mảng `levels`; level nào đã analyze thì có kèm `metrics`.
