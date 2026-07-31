# NPI Event · Coordinator Dashboard

Bảng điều khiển sơ đồ **tương tác thời gian thực** cho điều phối viên sự kiện ra
mắt iPhone (cellphoneS). Mô phỏng layout sự kiện thành lưới tọa độ, đồng bộ trạng
thái bàn từ **Lark Base (Bitable)** qua HTTPS, tự cập nhật mỗi 30 giây.

## Tính năng

- **9 bàn tương tác**: 3 Kỹ thuật (KT1–KT3) · 6 Tư vấn (TV1–TV6). Cụm Kỹ thuật
  thay cho "Thu cũ" cũ và đọc đúng bảng Lark đó, không đổi; không còn cụm Backup.
- **Màu trạng thái**: `Sl … tiếp nhận > 0` → **Đỏ** (đang tiếp nhận), ngược lại →
  **Xanh** (trống); **Xám** = chưa có dữ liệu. Badge cam = số khách đang chờ.
- **Click bàn → popover chi tiết**: Tên NV · STT Khách · Tên sản phẩm (SP 1) ·
  Ghi chú thanh toán · Khách đang chờ.
- **Sidebar**: Tổng khách đã Check-in + breakdown Tiếp nhận/Trống/Chờ mỗi cụm.
- **Bộ lọc nhanh**: "Chỉ hiện bàn trống", "Chỉ hiện bàn KT".
- **Auto-refresh 30s** (polling) + thanh trạng thái đồng bộ.
- **Trang Cài đặt Lark** (`#/settings`): nhập key kết nối và ánh xạ tên cột Lark
  ↔ trường web ngay trong web (không cần sửa code/env) — xem mục dưới.

## Trang Cài đặt Lark (`#/settings`)

Mở link **"Cài đặt Lark"** ở header. Cho phép cấu hình **runtime** (lưu vào
`localStorage`, áp dụng ngay, dashboard tự đồng bộ lại):

1. **Nguồn dữ liệu**: Mock (mẫu) hoặc Lark Base (thật).
2. **Kết nối**: chọn **Proxy/Webhook** (nhập API URL) hoặc **Direct API** (Host,
   App Token, Access Token + 5 Table ID) + chu kỳ làm mới.
3. **Ánh xạ trường**: điền tên cột Lark cho từng trường web (3 bảng DS + khối
   Status + Check in). Để trống = dùng mặc định.
4. **Kiểm tra kết nối** (thử fetch, báo số bàn/check-in/đơn), **Lưu & đồng bộ**,
   **Khôi phục mặc định**.

> Cấu hình `.env` chỉ là **giá trị khởi tạo**; trang Cài đặt ghi đè lúc chạy.
> Chi tiết lấy token/table id + dựng proxy: xem `docs/LARK_SETUP.md`.

## Công nghệ

Vite 6 · React 18 · TypeScript · TailwindCSS 3.

## Chạy dự án

```bash
npm install
npm run dev      # dev server — mặc định chạy mock data (từ file NPI_Testing_2)
npm run build    # typecheck + build production
npm run preview  # xem bản build
```

## Kiến trúc dữ liệu

Ứng dụng đọc dữ liệu từ Lark (xem `memory.md §4` để biết chi tiết schema thật):

| Vai trò            | Bảng                                        | Dùng cho                          |
| ------------------ | -------------------------------------------- | --------------------------------- |
| Danh sách bàn (DS) | `DS thu cũ` (→ cụm Kỹ thuật) · `DS Tư vấn`   | Mã bàn, nhân viên, số liệu live   |
| Check-in           | `Check in`                                   | Trạng thái/khách hiện tại + ghi chú thanh toán |
| Đăng ký            | `Danh sách đơn hàng`                         | Tổng số đăng ký (mẫu số phễu)     |

- **Màu bàn** lấy từ DS `Trạng thái hiện tại`.
- **Chi tiết khách** join theo tên từ `Check in`. Không còn bảng/cụm Backup.

## Cấu hình Lark Base

> 📖 Hướng dẫn liên kết chi tiết (lấy token, table id, dựng proxy, xử lý CORS):
> xem **[`docs/LARK_SETUP.md`](docs/LARK_SETUP.md)**.

Copy `.env.example` → `.env.local`:

- **Mode 1 (khuyến nghị):** `VITE_LARK_API_URL` = proxy/webhook HTTPS do bạn kiểm
  soát. Client gọi `${VITE_LARK_API_URL}/<tableKey>` với `tableKey` ∈
  `dsTradein dsConsult checkin orders txConsult` (`dsTradein` nay nuôi cụm Kỹ
  thuật, tên bảng Lark không đổi; `txConsult` tùy chọn), mỗi endpoint trả JSON
  list-records của Lark. (Giữ secret server-side, tránh CORS.)
- **Mode 2 (trực tiếp):** `VITE_LARK_APP_TOKEN` + `VITE_LARK_ACCESS_TOKEN` +
  các biến `VITE_LARK_TABLE_*` (mỗi Table_ID).
- Không cấu hình gì → chạy mock data đi kèm. `VITE_LARK_POLL_MS` mặc định 30000.

Tên cột mặc định khớp workbook `NPI_Testing_2` và nằm trong
`src/config/larkConfig.ts` (`DS_FIELDS` / `TX_FIELDS` / `CHECKIN_FIELDS`) — sửa ở
đó nếu base của bạn đặt tên cột khác.

## Cấu trúc

Xem `memory.md` để biết kiến trúc đầy đủ, schema dữ liệu thật, tọa độ layout và
tiến độ từng bước.
