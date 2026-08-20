# Car Sort — Level & Feel Tool

Web prototype + level editor. Mở bằng:

```bash
python3 tools/serve.py 5173
```

rồi vào `http://localhost:5173`. Không build step, không dependency.

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

Bốn tier, mỗi tier **tì vào một trục khác nhau**. Bốn tier cùng khó theo một kiểu thì chỉ là một level lặp lại bốn lần.

| Tier | Trục | Knob | win TB | Độ sâu | Bàn tối thiểu |
|---|---|---|---|---|---|
| **Tập lái** | không — dạy luật | màu=cột · lạ 14% · slack 3.0x | 95–100% | ≤14 | 3×3 |
| **Giờ cao điểm** | sức ép budget | màu=cột · lạ 26% · slack 1.65x | 72–95% | ≤20 | 4×5 |
| **Bãi chật** | độ sâu định tuyến | màu 0.6×cột · lạ 34% · slack 1.60x | 68–92% | ≥22 | 5×5 |
| **Giờ đêm** | thiếu thông tin, cộng dồn | màu 0.6×cột · lạ 42% · **ẩn 24%** · slack 1.45x | 45–80% | ≥16 | 5×6 |

**Bãi chật không khó hơn Giờ cao điểm** — đo trên 14 bàn từ 4×5 đến 6×6, win của player trung bình gần y hệt, chỉ độ sâu là khác. Nguyên nhân: ít màu hơn số cột cho player nhiều chỗ nhả xe đúng hơn nên bớt move phí, triệt tiêu phần nào sức ép budget. Thang độ khó thật là **Tập lái → Giờ cao điểm ≈ Bãi chật → Giờ đêm**; thang độ sâu là **Tập lái → Giờ cao điểm → Bãi chật ≈ Giờ đêm**. Xen kẽ hai tier giữa để đổi vị, đừng coi là hai bậc.

Mỗi thẻ có:
- **Áp dụng** — sinh thử N bàn theo knob của tier, playtest thật từng bàn, giữ bàn rơi gần dải mục tiêu nhất, rồi dò budget trong dải slack cho tới khi win rate vào dải.
- **Chỉ đặt lại budget** — giữ nguyên lưới a đã vẽ, chỉ dò budget.
- **x/7 tiêu chí** — level hiện tại đạt bao nhiêu dải, kèm giá trị thật vs dải cần.

Dòng đầu cho biết level đang giống tier nào. Toàn bộ template nằm trong `src/difficulty.js` và sửa được ngay trong UI qua ô **Sửa template (JSON)**.

Dải mục tiêu **đo ra chứ không đoán**: sinh 12 bàn cho mỗi spec trên 4 kích thước rồi lấy dải thực tế. Kiểm chứng lại: 14/14 trường hợp hợp lệ đạt 7/7.

Bàn quá nhỏ so với tier thì tool cảnh báo — bàn ngắn thì lời giải ngắn, không đủ số nước để player kịp thua, siết knob nào cũng không tới dải.

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

## Hai chế độ

Tool mở ra ở **Test**. Bấm **⚙ Level Design** ở góc phải trên để vào chế độ chỉnh sửa, bấm **▶ Test** để quay lại.

| | Test | Level Design |
|---|---|---|
| Tab | Play · Playtest · Level Set | thêm Tune · Edit · Feel |
| Level Set | chỉ xem bảng + curve | thêm +Level / Duplicate / Delete / Export / Import |
| Sửa được level | không | có |

Tách ra để một buổi playtest không bao giờ vô tình thành một buổi sửa level — đó là điều kiện để các con số còn đáng tin. Ở chế độ Design có vạch vàng trên thanh menu để a luôn biết mình đang ở đâu.

Chế độ Test vẫn có nút **Đo level này** ở tab Play và toàn bộ report Playtest, nên vẫn phân tích được đầy đủ.

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

## Phím tắt

`1`-`9` tap cột · `r` restart · `u`/`z` undo · `h` hint · `←`/`→` đổi level

## Git

`main` giữ bản trước khi có tuner/playtest/asset. Muốn quay lại: `git checkout main`.

## Export

Tab **Level Set** → `Xuất JSON set` / `Download .json`. File gồm `palette`, `feel`, và mảng `levels`; level nào đã analyze thì có kèm `metrics`.
