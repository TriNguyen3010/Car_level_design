# Chuẩn bị asset

## Cách nên làm: 1 xe trung tính, đổi màu bằng code

Đưa em **một** chiếc xe màu trắng/xám, em sinh ra cả 18 màu. Mở `recolor.html`, thả file vào, kéo 4 slider, download.

Lý do không nên gen 18 ảnh riêng bằng AI: mỗi lần gen ra một hình dạng hơi khác — gương lệch vài pixel, mui cao thấp không đều, viền dày mỏng khác nhau. Xếp 25 xe cạnh nhau trên lưới là lộ ngay. Đổi màu bằng code thì hình dạng **giống nhau tuyệt đối**, chỉ pixel màu đổi.

### File `car_base.png` — bắt buộc

| | |
|---|---|
| Kích thước | **512 × 512**, vuông |
| Nền | **trong suốt** (alpha thật, không phải nền trắng) |
| Góc nhìn | từ trên xuống, đầu xe hướng **xuống dưới** — như trong game |
| Xe chiếm | ~86% chiều ngang, ~92% chiều dọc, chừa lề để bóng và gương không bị cắt |
| Màu | **trắng / xám trung tính**. Không cam, không xanh — màu nào cũng thành ám màu đó sau khi nhuộm |
| Sáng tối | phải có. Vùng tối nhất ~25% xám, sáng nhất ~95%. Nếu ảnh phẳng lì thì nhuộm ra sẽ phẳng lì |
| Không có | bóng đổ xuống nền (tách ra file riêng) |

Thuật toán đọc **độ sáng** của từng pixel rồi ánh xạ lên dải màu đích: tối → màu đậm, giữa → đúng màu, sáng → màu nhạt về phía trắng. Nên toàn bộ khối, đổ bóng, phản chiếu của bản gốc được giữ nguyên.

### File `car_detail.png` — nên có

Kính, đèn pha, lưới tản nhiệt, viền đen, mắt. Vẽ **đúng vị trí trên cùng canvas 512×512**, phần còn lại trong suốt.

Lớp này **không bị nhuộm**. Không có nó thì kính cũng bị nhuộm theo màu xe — xe hồng sẽ có kính hồng. Chấp nhận được nhưng xấu hơn rõ.

### File `car_shadow.png` — tuỳ chọn

Bóng đổ xuống mặt đường, xám đen mờ, cùng canvas 512×512. Nằm dưới cùng, không bị nhuộm.

---

## Nếu a vẫn muốn gen từng ảnh bằng AI

Bắt buộc **fix seed và chỉ đổi đúng chữ màu** trong prompt, rồi vẫn phải kiểm tra chồng hình lên nhau xem có lệch không.

```
top-down view of a cute cartoon car, {COLOR} glossy body, seen directly from
above, front of the car pointing toward the bottom of the frame, soft studio
lighting from the upper left, subtle ambient occlusion under the body,
rounded chunky proportions, mobile puzzle game asset, clean vector-like
shading, centered, transparent background, no shadow on the ground,
no background elements, square 1:1
```

Bảng màu chuẩn (lấy từ `src/levels.js`, hex phải khớp thì UI mới đồng bộ):

| tên | hex | | tên | hex | | tên | hex |
|---|---|---|---|---|---|---|---|
| magenta | `#e0479f` | | mint | `#5fd0a8` | | orange | `#e8792b` |
| pink | `#ec5a8a` | | teal | `#3e9e9e` | | red | `#e04a3c` |
| purple | `#9b3fc4` | | cyan | `#5ecfe0` | | brown | `#a86a35` |
| violet | `#6f74c9` | | blue | `#4a90d9` | | beige | `#e2c9a4` |
| lime | `#8ec63f` | | navy | `#59689f` | | gray | `#7d7d7d` |
| green | `#57ad33` | | yellow | `#f0c132` | | white | `#dbe2ea` |

---

## Các asset còn lại

Xe chỉ là một phần. Danh sách đủ để thay hết đồ hoạ placeholder hiện tại:

| File | Kích thước | Ghi chú |
|---|---|---|
| `car_base.png` | 512² | như trên |
| `car_detail.png` | 512² | như trên |
| `car_shadow.png` | 512² | như trên |
| `car_wrongway.png` | 512² | **xe biển ngược chiều** — thân xám đậm, biển tròn đỏ viền trắng gạch ngang ở giữa nắp ca-pô. Không nhuộm màu, chỉ 1 file |
| `car_hidden.png` | 512² | **xe ẩn** — thân đen bóng, dấu `?` tím phát sáng. Không nhuộm màu, chỉ 1 file |
| `car_eyes_happy.png` | 512² | mắt cười, đè lên xe khi cột hoàn thành |
| `gate_arrow.png` | 128 × 96 | mũi tên kép chỉ xuống dưới đáy cột, trắng mờ |
| `gate_check.png` | 128 × 128 | badge ✓ xanh khi cột xong |
| `pad.png` | 512 × 220 | bệ tròn xanh dưới xe chờ |
| `lot_frame.png` | 9-slice | khung bãi đỗ, viền vạch trắng đứt |
| `road_tile.png` | 256² lặp | mặt đường tối trong bãi |
| `bg_city.png` / `bg_suburb.png` | 1080 × 1920 | 2 theme, level 1–5 và 6–10 |

Tất cả PNG-24 có alpha. Đặt hết vào thư mục `assets/`.

---

## Xem thử ngay trong tool

Bỏ file vào `assets/` theo đúng tên `car_<màu>.png` (ví dụ `car_magenta.png`), rồi bật **dùng sprite** ở tab Feel. Xe CSS hiện tại nằm dưới làm lớp dự phòng — file nào thiếu thì tự động rơi về xe vẽ bằng CSS, không vỡ layout.

`recolor.html` đặt tên file xuất ra đúng chuẩn này sẵn.
