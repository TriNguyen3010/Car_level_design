# 40 level sinh bằng `tools/make_40.js`

Sinh lại + đóng gói vào tool:

```bash
node tools/make_40.js --out configLevel_gen40 --tries 10
node tools/pack_40.js
```

- `level_1.json` … `level_40.json` — format client `ConfigVersion: 1`.
- `tool_set_40.json` — bundle nạp tay vào tool (tab Level Set → textarea Export → `Import từ textarea`). Bình thường không cần: `pack_40.js` đã nhét bộ này vào `src/set40.js`, mở tool là có.

**Mỗi cột đúng 1 màu, không trùng** — vì `KindList` của client là 1 kind/cột và không lặp. Muốn quay lại trục "màu ít hơn cột" của thang 10 bậc thì chạy với `--routing`, nhưng bàn đó **không viết được** ra format client.

## Lịch dạy cơ chế

| Cơ chế | Vào từ level | Tổng trên cả bộ |
|---|---|---|
| Xe ẩn | 9 | 59 xe |
| Cột màu | 21 | 41 cột trên 20 level |
| Cột khoá | 31 | 11 cột trên 9 level, `need` 1–2 |

Mỗi cơ chế mới rơi vào **bậc tụt** (21 tụt về bậc 5, 31 tụt về bậc 6) — player gặp 1 luật mới, không phải luật mới cộng bàn khó hơn. Breather ở 9, 14, 17, 21, 25, 27, 29, 31, 35.

## Số đo

`winAvg` = player trung bình, đo bằng playtest ở đúng budget của level. `band` = dải của bậc trong `src/difficulty.js`. Budget **fit theo band bằng bisection**, không nhân slack cố định — thang 10 bậc đo khi chưa có cột khoá/cột màu nên nhân hằng số ra sai (lần thử đầu: level 21 rơi xuống 19% win).

| lv | size | bậc | min | budget | slack | winAvg | band | player ẩu | luật cột |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 3x3 | 1 | 5 | 10 | 2.00x | 99% | 92%-100% | 96% | — |
| 2 | 3x3 | 1 | 5 | 10 | 2.00x | 100% | 92%-100% | 95% | — |
| 3 | 4x3 | 2 | 8 | 23 | 2.09x | 100% | 91%-100% | 100% | — |
| 4 | 4x3 | 2 | 7 | 15 | 2.14x | 100% | 91%-100% | 91% | — |
| 5 | 4x4 | 3 | 12 | 25 | 2.08x | 99% | 89%-100% | 90% | — |
| 6 | 4x4 | 3 | 11 | 23 | 2.09x | 100% | 89%-100% | 90% | — |
| 7 | 5x4 | 4 | 15 | 27 | 1.50x | 93% | 85%-99% | 68% | — |
| 8 | 5x4 | 4 | 14 | 25 | 1.79x | 94% | 85%-99% | 65% | — |
| 9 | 5x4 | 3 | 13 | 27 | 2.08x | 99% | 89%-100% | 84% | — |
| 10 | 5x4 | 4 | 15 | 29 | 1.81x | 98% | 85%-99% | 74% | — |
| 11 | 5x5 | 5 | 18 | 27 | 1.50x | 86% | 80%-94% | 35% | — |
| 12 | 5x5 | 5 | 22~ | 33 | 1.50x | 88% | 80%-94% | 39% | — |
| 13 | 5x5 | 6 | 24~ | 34 | 1.48x | 85% | 75%-89% | 36% | — |
| 14 | 5x5 | 4 | 21~ | 33 | 1.50x | 86% | 85%-99% | 37% | — |
| 15 | 5x5 | 6 | 19 | 30 | 1.50x | 82% | 75%-89% | 31% | — |
| 16 | 5x5 | 7 | 20 | 34 | 1.36x | 80% | 71%-85% | 34% | — |
| 17 | 5x4 | 5 | 14 | 24 | 1.50x | 93% | 80%-94% | 54% | — |
| 18 | 5x4 | 6 | 14 | 21 | 1.50x | 84% | 75%-89% | 39% | — |
| 19 | 5x5 | 7 | 23~ | 33 | 1.50x | 86% | 71%-85% | 35% | — |
| 20 | 6x4 | 6 | 18 | 26 | 1.24x | 84% | 75%-89% | 38% | — |
| 21 | 5x4 | 5 | 15 | 20 | 1.33x | 86% | 80%-94% | 44% | col3:mint |
| 22 | 6x5 | 6 | 29~ | 40 | 1.38x | 82% | 75%-89% | 28% | col1:blue col3:navy |
| 23 | 6x5 | 6 | 30~ | 43 | 1.54x | 89% | 75%-89% | 32% | col2:orange col4:red |
| 24 | 6x5 | 7 | 38~ | 61 | 2.10x | 78% | 71%-85% | 53% | col2:beige col4:gray col6:white |
| 25 | 6x5 | 5 | 25~ | 38 | 1.52x | 88% | 80%-94% | 31% | col6:magenta |
| 26 | 6x5 | 7 | 26~ | 36 | 1.38x | 81% | 71%-85% | 21% | col2:violet |
| 27 | 6x4 | 7 | 20~ | 25 | 1.25x | 82% | 71%-85% | 26% | col1:mint col5:teal |
| 28 | 6x5 | 8 | 33~ | 41 | 1.24x | 69% | 64%-78% | 20% | col1:blue col4:navy |
| 29 | 5x5 | 6 | 27~ | 55 | 2.12x | 88% | 75%-89% | 72% | col4:orange |
| 30 | 6x5 | 8 | 36~ | 44 | 1.33x | 66% | 64%-78% | 21% | col2:beige col3:gray |
| 31 ⚠ | 6x4 | 6 | 18 | 38 | 2.11x | 84% | 75%-89% | 58% | lock2:1 col4:magenta col6:pink |
| 32 | 6x4 | 7 | 25~ | 36 | 1.50x | 82% | 71%-85% | 37% | lock4:1 col1:violet col3:lime |
| 33 | 6x5 | 8 | 39~ | 49 | 1.53x | 69% | 64%-78% | 28% | col2:mint col3:teal col5:cyan |
| 34 | 6x5 | 8 | 27~ | 37 | 1.37x | 71% | 64%-78% | 11% | lock1:1 col4:blue col6:navy _(khoá đã hạ về need 1 để bàn giải được)_ |
| 35 | 6x5 | 7 | 33~ | 47 | 1.52x | 74% | 71%-85% | 18% | lock1:1 lock5:2 col3:orange col6:red |
| 36 | 6x5 | 9 | 36~ | 45 | 1.25x | 56% | 50%-64% | 22% | lock3:1 col4:beige col5:gray col6:white |
| 37 | 6x4 | 8 | 22~ | 29 | 1.53x | 74% | 64%-78% | 26% | lock5:2 col2:magenta col4:pink |
| 38 | 6x5 | 9 | 31~ | 36 | 1.16x | 56% | 50%-64% | 11% | lock1:1 lock6:1 col2:violet col4:lime _(khoá đã hạ về need 1 để bàn giải được)_ |
| 39 | 6x5 | 9 | 34~ | 44 | 1.52x | 68% | 50%-64% | 19% | lock2:1 col1:mint col6:teal |
| 40 | 6x5 | 10 | 29~ | 36 | 1.24x | 51% | 44%-58% | 9% | lock1:2 col2:blue col3:navy col5:yellow col6:orange |

`~` sau `min` = IDA* hết node nên số đó là **chặn trên của greedy**, không phải optimum. `⚠` = bàn nông hơn sàn độ sâu (sàn = số ô × 0.55→0.95 theo level).

## Chưa khớp cái gì

- `ExtraColumnsCount = 0` cả 40 file. Tool fill kín bàn, chưa mô phỏng cột/ô trống — client thêm cột trống thì level **dễ hơn** số đo ở đây.
- `Seed = 0`, client tự roll bàn. Muốn ship đúng bàn này thì sinh lại với `--hard` để kèm `Map` / `CarShape` / `DummyType`.
- Xe nằm trong cột khoá có thể chính là xe cần để clear 2 cột đầu — bàn thành không giải được mà `validate` không thấy nếu không giải thử. Generator lùi dần: khoá như kế hoạch → khoá `need 1` → bỏ khoá. Level 34 và 38 đã lùi 1 bước.
