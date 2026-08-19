# Car Sort — Level & Feel Tool

Web prototype + level editor. Mở bằng:

```bash
python3 -m http.server 5173
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
| `src/feel.js` | Mọi timing / easing / juice + SFX synth. Không ảnh hưởng luật. |
| `src/render.js` | Hình học bàn + animation. Mọi con số lấy từ `feel.js`. |
| `src/tool.js` | UI: play, tune, edit, feel, export. |

Auto-sort nằm trong `engine.js`, **không** nằm ở UI — nếu để ở UI thì solver sẽ đo sai.

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

## Phím tắt

`1`-`9` tap cột · `r` restart · `u`/`z` undo · `h` hint · `←`/`→` đổi level

## Export

Tab **Level Set** → `Xuất JSON set` / `Download .json`. File gồm `palette`, `feel`, và mảng `levels`; level nào đã analyze thì có kèm `metrics`.
