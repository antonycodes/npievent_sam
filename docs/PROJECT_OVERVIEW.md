# NPI Event · Coordinator Dashboard — Tổng hợp dự án

> Tài liệu tổng hợp toàn bộ mục tiêu, kiến trúc, schema dữ liệu và logic nghiệp vụ
> của dự án. Xem thêm: `README.md` (chạy nhanh), `docs/LARK_SETUP.md` (kết nối
> Lark), `memory.md` (nhật ký phát triển từng bước).

---

## 1. Mục tiêu & Đối tượng

Bảng điều khiển **sơ đồ tương tác thời gian thực** cho **điều phối viên** tại sự
kiện ra mắt iPhone (cellphoneS). Mô phỏng mặt bằng sự kiện thành lưới toạ độ, đồng
bộ trạng thái từng bàn từ **Lark Base (Bitable)** qua HTTPS, tự làm mới mỗi 30s.
Giúp điều phối gán khách vào bàn và phát hiện **nghẽn cổ chai** ở 2 khu vực:
**Kỹ thuật (KT) · Tư vấn**. (Bản trước có thêm "Thu cũ" và "Backup" — nay "KT"
thay cho "Thu cũ" và "Backup" đã bỏ khỏi sơ đồ; xem §11.)

**Công nghệ:** Vite 6 · React 18 · TypeScript · TailwindCSS 3. Không có backend
riêng — frontend đọc Lark trực tiếp hoặc qua một proxy do người dùng tự dựng.

---

## 2. Sơ đồ & 9 vị trí bàn

9 bàn tương tác, dựng từ ảnh mặt bằng mới thành hệ toạ độ **phần trăm trên board
16:9** (`src/config/layoutConfig.ts`).

| Cụm (khu vực) | Cluster key | Label prefix | Id (join key Lark) | Số lượng | Bố cục |
| ------------- | ----------- | ------------ | ------------------- | -------- | ------ |
| Kỹ thuật      | `kythuat`   | `KT`         | `TC1`–`TC3` (giữ nguyên "TC" — xem §5.4) | 3 | 1 hàng ngang |
| Tư vấn        | `consult`   | `TV`         | `TV1`–`TV6`          | 6        | 3 cặp dọc |

- **`id` = khoá join** giữa node trên sơ đồ và dòng dữ liệu trong Lark; **`label`**
  là chữ hiển thị trên node — 2 giá trị khác nhau ở cụm `kythuat` (id vẫn "TC..."
  để khớp bảng Lark "Thu cũ" cũ nguyên trạng, label hiển thị "KT...").
- Guard runtime khẳng định đúng 3/6 vị trí.
- Không còn cụm Backup và các vùng nền tĩnh cũ (Sân khấu, Upgrade, Bàn thu ngân,
  Cổng) — layout mới chỉ còn 2 khung khu vực (Kỹ thuật, Tư vấn) + 1 khu chờ STT
  gộp (xem §4).

---

## 3. Logic trạng thái & màu sắc

Màu bàn lấy từ cột **`Trạng thái hiện tại (kết quả chính)`** trong bảng DS
(`src/types/desk.ts` → `deskUiStatus`):

| `Trạng thái hiện tại` | UI status  | Màu    |
| --------------------- | ---------- | ------ |
| chứa "đang" (Đang tư vấn) | `occupied` | 🔴 Đỏ |
| "Rảnh"                | `available`| 🟢 Xanh |
| "Chưa có dữ liệu" / trống | `idle`  | ⚪ Xám |

- Bàn không có dòng DS khớp mã (vd KT thiếu dữ liệu ở TC1–TC3) → luôn xám.
- Badge cam trên node = số **khách đang chờ** (`Sl khách chờ`, >0). Giá trị âm
  (lỗi công thức) được kẹp về 0.

---

## 4. Tương tác (Dashboard `/#/`)

- **Click bàn → popover** (`DeskPopover.tsx`) neo tại vị trí bàn, tự lật
  trên/dưới + kẹp mép, đóng bằng `×`/Escape. Nội dung:
  - `Tên NV`, `Trạng thái`.
  - **Chỉ khi bàn "Đang tư vấn"**: `STT Khách`, `Khách`, `Tên sản phẩm`,
    `Ghi chú thanh toán`. Bàn trống → *"Bàn trống — chưa có thông tin khách."*
  - `Khách đang chờ` (nếu >0).
- **Bộ lọc nhanh** (`FilterBar.tsx`): "Chỉ hiện bàn trống", "Chỉ hiện bàn KT".
  Bàn không khớp bị **làm mờ** (giữ ngữ cảnh không gian), không xoá.
- **Thanh trạng thái** header: badge Mock/Live, giờ cập nhật, nút "Làm mới",
  link "Cài đặt Lark".

### Khu vực chờ ngoài bàn — "Khách nhận STT và đợi" (bên phải board)

`LayoutDashboard.tsx` gộp **2 danh sách** khách chưa gắn vào bàn cụ thể vào
**1 khung hiển thị duy nhất** (khớp ảnh mặt bằng mới) — bấm 1 chấm →
`WaitingPopover.tsx` (STT, tên, SP, ghi chú TT):

- **Chờ check-in**: khách đã check-in (có STT ở bảng `Check in`) nhưng **chưa
  từng xuất hiện** ở bất kỳ bàn DS nào (chưa được điều phối vào khâu nào cả).
- **Chờ điều phối**: khách vừa **hoàn tất** 1 khâu (`Trạng thái gần nhất` =
  "Hoàn tất") và bàn đó hiện đang **rảnh**, nhưng khách **chưa đang được phục
  vụ** ở bàn nào khác — tức đang chờ điều phối viên đưa sang khâu tiếp theo
  (vd: xong Kỹ thuật → chờ vào Tư vấn).

**Chỉ gộp phần hiển thị** — logic tính 2 danh sách này (`larkMapper.mapDeskStates`,
trả thêm `waitingCheckin` / `waitingDispatch`) và các state ở `DashboardPage`
(`selectedWaiting: {zone, index}`, cùng nhóm loại trừ lẫn nhau với
`selectedId`/`selectedCustomer`) giữ nguyên như cũ, không đổi — mỗi chấm trong
khung gộp vẫn nhớ khu vực gốc (`checkin`/`dispatch`) để mở đúng popover.

### Sidebar — phễu Check-in + số liệu cụm (`Sidebar.tsx`)

- **Phễu khách** (đếm **khách distinct theo tên** để không trùng khi 1 người qua
  nhiều bàn):
  - `Check-in / Tổng đăng ký` = số dòng `Check in` / số dòng `Danh sách đơn hàng`.
  - `Đang tư vấn / Check-in` = khách distinct ở bàn Tư vấn "đang tư vấn".
  - `Chưa được phục vụ / Check-in` = check-in − khách distinct đang được phục vụ.
- **Mỗi cụm**: `x/tổng bàn`, số Tiếp nhận / Trống / Chờ.

---

## 5. Nguồn dữ liệu Lark & Schema

App đọc **4 bảng** (map từ workbook thật `NPI_Testing_2.2`; không còn `DS backup`):

| Vai trò            | Bảng Lark                    | Dùng cho                          |
| ------------------ | ----------------------------- | --------------------------------- |
| Danh sách bàn (DS) | `DS thu cũ` (→ cụm Kỹ thuật) · `DS Tư vấn` | Mã bàn, nhân viên, số đếm, **khối Status** |
| Check-in           | `Check in`                    | Số đã check-in + SP + ghi chú TT  |
| Đăng ký            | `Danh sách đơn hàng`          | Số tổng (mẫu số phễu)             |

> **Quan trọng:** từ `NPI_Testing_2.2`, thông tin trạng thái + khách nằm ngay
> trong bảng DS (khối "Status"), nên **không cần** các bảng giao dịch riêng nữa.
> `DS thu cũ` chưa được đổi tên bên Lark — cụm `kythuat` (KT) trên sơ đồ đọc
> đúng bảng/cột này nguyên trạng, chỉ nhãn hiển thị đổi (xem §5.4).

### 5.1 Cột bảng DS (mặc định)

| Ý nghĩa | DS thu cũ (→ Kỹ thuật) | DS Tư vấn |
| ------- | --------- | --------- |
| Mã bàn | `STT bàn` | `STT bàn` |
| Nhân viên | `Nhân viên` | `NV Tư vấn` |
| Đang tiếp nhận | `SL TC tiếp nhận` | `Sl TV tiếp nhận` |
| Hoàn tất | `SL TC hoàn tất` | `Sl TV hoàn tất` |
| Khách chờ | `SL Khách chờ` | `Sl khách chờ` |

**Khối Status** (giống nhau ở cả 2 bảng DS):
`STT gần nhất (helper)` · `Trạng thái gần nhất (helper)` ·
`Khách gần nhất (helper)` · `Trạng thái hiện tại (kết quả chính)`

**Bảng `Check in`**: `STT` · `Họ và tên` · `SP 1` · `Note UDTT`.
**Bảng `Danh sách đơn hàng`**: chỉ cần **số dòng**.

### 5.2 Định dạng wire của Lark (list-records)

```json
{ "code": 0, "msg": "success",
  "data": { "items": [ { "record_id": "rec...", "fields": { "STT bàn": "TV1", ... } } ],
            "has_more": false, "total": 6 } }
```
Bộ map (`larkMapper.ts`) khoan dung với cell dạng **string / number / boolean /
mảng rich-text** `[{text}]`.

### 5.3 Kiểu domain (`src/types/desk.ts`)

```ts
type ClusterKey = 'kythuat' | 'consult';
type DeskUiStatus = 'available' | 'occupied';

interface TablePosition { id; cluster; label; x; y; }   // tĩnh, từ layoutConfig
// id = khoá join Lark, label = chữ hiển thị — khác nhau ở cụm kythuat (§2).

interface DeskLiveState {          // động, từ Lark
  staffName; received; completed; waiting;
  currentStatus;                   // "Đang tư vấn" | "Rảnh" | "Chưa có dữ liệu"
  isOccupied; hasData;
  customerSTT; customerName; productName; paymentNote;  // chỉ khi occupied
}

type DeskData = TablePosition & Partial<DeskLiveState>;
```

### 5.4 Quy tắc map (`larkMapper.mapDeskStates`)

- **Trạng thái/màu**: từ `Trạng thái hiện tại`.
- **Khách** (chỉ khi occupied): `customerSTT`←`STT gần nhất`,
  `customerName`←`Khách gần nhất`.
- **SP + ghi chú thanh toán**: join sang `Check in` **theo TÊN khách** (an toàn
  hơn STT vì STT có thể là số nội bộ của từng cụm).
- `totalCheckIn` = số STT distinct trong `Check in`;
  `totalRegistered` = số dòng `Danh sách đơn hàng`.

---

## 6. Tầng kết nối Lark (HTTPS)

`src/services/` + `src/config/`:

- **`larkClient.fetchTableRecords`** — GET 1 bảng, Bearer auth, validate
  `code===0`, `AbortSignal`.
- **`larkService.fetchLarkData`** — fetch song song 4 bảng core + `txConsult`
  tùy chọn (hoặc trả mock).
- **2 chế độ** (`larkSettings.toRuntimeConfig`):
  - **Proxy/Webhook** (khuyến nghị): `GET ${apiUrl}/<tableKey>` với tableKey ∈
    `dsTradein · dsConsult · checkin · orders` (+ `txConsult`). Proxy giữ secret,
    tránh CORS.
  - **Direct API**: `GET {host}/open-apis/bitable/v1/apps/{appToken}/tables/{tableId}/records?page_size=500`.
- **Polling 30s** (`pollMs`). Hook `useDashboardData` tự đồng bộ lại khi đổi settings.

> Chi tiết lấy token/table id + code proxy mẫu: `docs/LARK_SETUP.md`.

---

## 7. Cấu hình runtime (trang Cài đặt `/#/settings`)

Người dùng cấu hình **ngay trong web** (lưu `localStorage`, áp dụng ngay, không
cần sửa code/env) — `src/pages/SettingsPage.tsx` + `src/config/larkSettings.ts`:

1. **Nguồn dữ liệu**: Mock hay Lark Base.
2. **Kết nối**: Proxy (API URL) hoặc Direct (Host, App Token, Access Token +
   5 Table ID) + chu kỳ làm mới.
3. **Ánh xạ trường**: nhập tên cột Lark cho từng trường web (3 bảng DS + khối
   Status + Check in). Để trống = mặc định.
4. **Kiểm tra kết nối** (thử fetch, báo số bàn/check-in/đơn) · **Lưu & đồng bộ**
   · **Khôi phục mặc định**.

`.env` (VITE_LARK_*) chỉ là **giá trị khởi tạo lần đầu**; trang Cài đặt ghi đè.

---

## 8. Cây thư mục

```
src/
├── main.tsx                     entry React
├── App.tsx                      router hash (#/settings ↔ dashboard)
├── index.css                    Tailwind + reset
├── types/desk.ts                ClusterKey, DeskData, deskUiStatus, computeSummary, CustomerFunnel
├── config/
│   ├── layoutConfig.ts          9 vị trí (KT/TV, id join key riêng cho KT) + toạ độ + CLUSTER_LABELS
│   ├── larkConfig.ts            DEFAULT_* field maps + types + ENV_DEFAULTS + LarkRuntimeConfig
│   └── larkSettings.ts          store cấu hình runtime (localStorage) + toRuntimeConfig/toFieldConfig
├── data/mockLarkData.ts         fixtures theo NPI_Testing_2.2 (mock)
├── services/
│   ├── larkTypes.ts             kiểu wire Lark + TableKey (4 bảng core + txConsult)
│   ├── larkClient.ts            fetch 1 bảng qua HTTPS
│   ├── larkService.ts           fetch 4 bảng core song song (+ txConsult tùy chọn) / mock
│   └── larkMapper.ts            map records → DeskLiveState + phễu
├── hooks/useDashboardData.ts    đọc settings, fetch/poll hoặc mock → desks + summary
├── components/
│   ├── LayoutDashboard.tsx      board + nền + render Desk + overlay
│   ├── Desk.tsx                 1 node (màu/badge/dim/onClick)
│   ├── DeskPopover.tsx          popover chi tiết khách
│   ├── Sidebar.tsx              phễu check-in + số liệu cụm
│   ├── StatusLegend.tsx         chú thích màu
│   └── FilterBar.tsx            lọc nhanh
└── pages/
    ├── DashboardPage.tsx        trang sơ đồ chính
    └── SettingsPage.tsx         trang cài đặt Lark
```

---

## 9. Luồng dữ liệu (tóm tắt)

```
Lark Base (4 bảng core + txConsult tùy chọn)
   │  fetchLarkData (proxy/direct, 30s)   ── hoặc ──   mockLarkTables
   ▼
mapDeskStates(tables, fieldConfig)  →  { statesById, totalCheckIn, totalRegistered }
   ▼
useDashboardData  →  merge lên 9 ALL_POSITIONS  →  DeskData[]  +  computeSummary()
   ▼
DashboardPage → LayoutDashboard (màu, click) · Sidebar (phễu) · DeskPopover
```

Cấu hình từ `SettingsPage → larkSettingsStore (localStorage)` cấp `toRuntimeConfig`
và `toFieldConfig` cho service/mapper; đổi settings → hook tự re-sync.

---

## 10. Chạy & Deploy

```bash
npm install
npm run dev        # mặc định Mock, http://localhost:5173
npm run build      # tsc + vite build → dist/
npm run preview
```

**Deploy Vercel** (tự nhận Vite, không cần env/`vercel.json`):
`vercel --prod`, hoặc kéo-thả thư mục vào dashboard, hoặc import repo GitHub.

---

## 11. Lịch sử tiến hoá dữ liệu

- **v1**: schema giả định (isOccupied boolean, popover Tên NV/STT).
- **NPI_Testing_2 / 2.1**: DS là registry; màu từ `Sl tiếp nhận`; join khách qua
  cột mã bàn ở bảng giao dịch.
- **NPI_Testing_2.2**: DS có khối "Status" → màu từ `Trạng thái hiện
  tại`, khách lấy thẳng từ DS; bỏ bảng giao dịch; thêm bảng `Danh sách đơn hàng`
  cho phễu; thay trang Admin demo bằng trang Cài đặt Lark runtime.
- **Sơ đồ KT/TV (hiện tại, 2026-07-31)**: đổi sang mặt bằng mới theo ảnh tham
  chiếu — cụm "Thu cũ" (`tradein`/TC) đổi tên thành "Kỹ thuật" (`kythuat`/KT,
  còn 3 bàn KT1–KT3), cụm "Tư vấn" (TV) rút còn 6 bàn TV1–TV6 (3 cặp dọc), cụm
  "Backup" bị xoá hoàn toàn (kể cả khỏi tầng dữ liệu Lark). Kết nối Lark "Thu
  cũ" cũ (bảng/field/`dsTradein`) **giữ nguyên không đổi** — `kythuat` chỉ đổi
  *nhãn hiển thị*, id bàn vẫn "TC1–TC3" làm khoá join (`TablePosition.id` ≠
  `.label`, xem §2/§5.3). 2 khu chờ "Đã check-in"/"Chờ điều phối" gộp hiển thị
  thành 1 khung "Khách nhận STT và đợi" (logic/dữ liệu bên dưới không đổi).

Chi tiết từng bước & quyết định: xem `memory.md`.
