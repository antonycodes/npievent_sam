# Hướng dẫn liên kết dữ liệu từ Lark Base

Dashboard đọc **4 bảng** trong Lark Base (Bitable): `DS thu cũ` (nuôi cụm
**Kỹ thuật** trên sơ đồ — tên bảng Lark không đổi), `DS Tư vấn`, `Check in`,
`Danh sách đơn hàng`. (Không còn `DS backup` — cụm Backup đã bỏ khỏi sơ đồ.)
Có **2 cách** kết nối:

| Cách | Khi nào dùng | Ưu / Nhược |
| ---- | ------------ | ---------- |
| **1. Proxy / Webhook** (khuyến nghị) | Production | Giữ secret ở server, không lộ token, không dính CORS. Cần dựng 1 endpoint nhỏ. |
| **2. Direct API** | Test nhanh nội bộ | Cắm thẳng token vào web. **Lộ token + dính CORS + token hết hạn ~2h** → không nên cho production. |

---

## 0. Chuẩn bị: tên cột phải khớp

App map dữ liệu theo **tên cột hiển thị** trong Lark. Mặc định khớp workbook
`NPI_Testing_2.2`. Nếu base của bạn đặt tên khác → sửa trong
`src/config/larkConfig.ts` (`DS_FIELDS`, `DS_STATUS_FIELDS`, `CHECKIN_FIELDS`).

**2 bảng DS** (mỗi dòng = 1 bàn) cần các cột — `DS thu cũ` nay nuôi cụm **Kỹ
thuật** (KT1–KT3) trên sơ đồ, tên bảng/cột Lark giữ nguyên như cũ:

| Ý nghĩa | DS thu cũ (→ Kỹ thuật) | DS Tư vấn |
| ------- | --------- | --------- |
| Mã bàn | `STT bàn` | `STT bàn` |
| Nhân viên | `Nhân viên` | `NV Tư vấn` |
| Đang tiếp nhận | `SL TC tiếp nhận` | `Sl TV tiếp nhận` |
| Hoàn tất | `SL TC hoàn tất` | `Sl TV hoàn tất` |
| Khách chờ | `SL Khách chờ` | `Sl khách chờ` |

**Khối Status** (tên cột giống nhau ở cả 2 bảng DS):
`STT gần nhất (helper)` · `Trạng thái gần nhất (helper)` ·
`Khách gần nhất (helper)` · `Trạng thái hiện tại (kết quả chính)`

> `Trạng thái hiện tại` quyết định màu: **"Đang tư vấn"** → Đỏ ·
> **"Rảnh"** → Xanh · **"Chưa có dữ liệu"** → Xám.

**Bảng `Check in`** cần: `STT` · `Họ và tên` · `SP 1` · `Note UDTT`
(dùng cho số đã check-in + Tên sản phẩm + Ghi chú thanh toán, join theo tên khách).

**Bảng `Danh sách đơn hàng`**: chỉ cần **số dòng** = tổng khách đăng ký (Số tổng)
cho phễu check-in ở sidebar. Không cần cột cụ thể.

Mã bàn (`STT bàn`) phải trùng `TC1..TC10 / TV1..TV18` (join key giữ nguyên
"TC"/"TV" dù sơ đồ hiển thị "KT") để khớp 9 node trên sơ đồ — app chỉ dùng
`TC1-TC3` và `TV1-TV6`, các dòng dư (TC4+, TV7+) bị bỏ qua chứ không lỗi.

---

## Cách 1 — Proxy / Webhook (khuyến nghị)

Ý tưởng: web **không** gọi thẳng Lark. Bạn dựng 1 endpoint HTTPS (serverless /
Node / Cloudflare Worker…) đứng giữa: nhận request từ web → tự lấy token → gọi
Lark → trả JSON về. Token/secret nằm ở server, an toàn.

### 1.1 Web gọi endpoint như thế nào

App sẽ `GET ${VITE_LARK_API_URL}/<tableKey>` với `tableKey` ∈
`dsTradein` · `dsConsult` · `checkin` · `orders` (+ `txConsult` tùy chọn).

Mỗi endpoint phải trả về đúng **envelope list-records của Lark**:

```json
{ "code": 0, "msg": "success",
  "data": { "items": [ { "record_id": "rec...", "fields": { "STT bàn": "TV1", ... } } ],
            "has_more": false, "total": 6 } }
```

### 1.2 Cấu hình web (`.env.local`)

```bash
VITE_LARK_API_URL=https://your-proxy.example.com/api/lark
VITE_LARK_POLL_MS=30000
# để trống app token/direct vars ở cách 2
```

### 1.3 Ví dụ proxy (Node/Express — rút gọn)

```js
import express from 'express';
const app = express();

const APP_ID = process.env.LARK_APP_ID;
const APP_SECRET = process.env.LARK_APP_SECRET;
const APP_TOKEN = process.env.LARK_APP_TOKEN;      // app_token của Bitable
const TABLE = {                                    // table_id từng bảng
  dsTradein: process.env.TB_DS_TRADEIN,             // nuôi cụm Kỹ thuật (KT)
  dsConsult: process.env.TB_DS_CONSULT,
  checkin:   process.env.TB_CHECKIN,
  orders:    process.env.TB_ORDERS,   // Danh sách đơn hàng (Số tổng)
};
const HOST = 'https://open.larksuite.com';         // hoặc open.feishu.cn

async function token() {                            // tenant_access_token (~2h)
  const r = await fetch(`${HOST}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET }),
  });
  return (await r.json()).tenant_access_token;
}

app.get('/api/lark/:key', async (req, res) => {
  const tableId = TABLE[req.params.key];
  if (!tableId) return res.status(404).json({ code: 404, msg: 'unknown table' });
  const t = await token();
  const url = `${HOST}/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${tableId}/records?page_size=500`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${t}` } });
  res.set('Access-Control-Allow-Origin', '*');     // cho web gọi được
  res.json(await r.json());                         // đã đúng format Lark
});

app.listen(3000);
```

> Nên **cache token** (~1h55) thay vì lấy mỗi request. Có thể cache cả kết quả
> vài giây để giảm tải khi nhiều máy cùng mở.

---

## Cách 2 — Direct API (chỉ để test)

Web gọi thẳng Lark bằng `tenant_access_token`. ⚠️ Token sẽ **lộ trong trình
duyệt**, hết hạn ~2h, và thường **bị CORS** khi gọi từ domain khác. Chỉ dùng để
thử nhanh.

### 2.1 Lấy `app_token` và `table_id`

Mở base trên trình duyệt, URL dạng:

```
https://xxx.larksuite.com/base/<APP_TOKEN>?table=<TABLE_ID>&view=...
                                ^^^^^^^^^^^        ^^^^^^^^^^
```

- `APP_TOKEN` = đoạn sau `/base/`.
- `TABLE_ID` = tham số `table=` (mở lần lượt từng bảng DS + Check in để lấy 4 id).

### 2.2 Lấy `tenant_access_token`

1. Vào **Lark Developer Console** → tạo **Custom App**.
2. Lấy `App ID` + `App Secret`.
3. Cấp quyền (Permissions): **`bitable:app:readonly`** (đọc Bitable).
4. Thêm app làm **collaborator** của base (Share → thêm app, quyền xem).
5. Gọi API lấy token (hết hạn ~2h → phải lấy lại):

```bash
curl -X POST https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal \
  -H 'Content-Type: application/json' \
  -d '{"app_id":"cli_xxx","app_secret":"yyy"}'
# → { "tenant_access_token": "t-xxxx", "expire": 7200 }
```

### 2.3 Cấu hình web (`.env.local`)

```bash
VITE_LARK_HOST=https://open.larksuite.com        # hoặc open.feishu.cn (bản CN)
VITE_LARK_APP_TOKEN=<APP_TOKEN>
VITE_LARK_ACCESS_TOKEN=<tenant_access_token>
VITE_LARK_TABLE_DS_TRADEIN=<table_id DS thu cũ — nuôi cụm Kỹ thuật (KT)>
VITE_LARK_TABLE_DS_CONSULT=<table_id DS Tư vấn>
VITE_LARK_TABLE_CHECKIN=<table_id Check in>
VITE_LARK_POLL_MS=30000
```

App tự gọi: `GET {HOST}/open-apis/bitable/v1/apps/{APP_TOKEN}/tables/{TABLE_ID}/records?page_size=500`
với header `Authorization: Bearer {token}`.

---

## 3. Chạy & kiểm tra

```bash
npm install
npm run dev        # hoặc npm run build && npm run preview
```

- Góc phải header đổi từ **"Mock data"** (vàng) sang **"Lark Base (live · 30s)"**
  (xanh) khi có `VITE_LARK_API_URL` hoặc `VITE_LARK_APP_TOKEN`.
- Thấy **"Cập nhật: hh:mm:ss"** → đã đồng bộ thành công; tự làm mới mỗi **30s**.
- Nếu hiện **"Lỗi đồng bộ"** → mở DevTools > Network xem lỗi:
  - **CORS** → dùng Cách 1 (proxy) hoặc bật CORS ở proxy.
  - **401/403** → token sai/hết hạn hoặc app chưa được share vào base.
  - **field trống / bàn xám hết** → tên cột không khớp → sửa `larkConfig.ts`.

## 4. Bảo mật

- **Không commit** `.env.local` (đã nằm trong `.gitignore`).
- Production: **luôn** dùng Cách 1 để không lộ `App Secret` / token ra client.
- Đổi `VITE_LARK_POLL_MS` nếu muốn refresh nhanh/chậm hơn 30s.
