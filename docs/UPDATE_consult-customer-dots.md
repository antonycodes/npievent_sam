# UPDATE SPEC — Chấm STT khách đã tiếp nhận dưới bàn Tư vấn

> **Mục đích:** tài liệu để một phiên Claude Code khác triển khai tính năng này
> vào dự án `npievent` (NPI Event · Coordinator Dashboard).
> Đọc kèm: `docs/PROJECT_OVERVIEW.md` (kiến trúc), `memory.md` (nhật ký).

---

## 1. Yêu cầu

Dưới mỗi **bàn Tư vấn** (cluster `consult`, mã `TV1…TV18`), hiển thị các **chấm
tròn nhỏ**, **mỗi chấm = 1 khách đang được NV đó tiếp nhận**, bên trong là **STT
khách**. Giống ảnh mẫu: TV2 (đỏ) có 2 chấm cam bên dưới.

- Khách hiển thị = **khách đã "Tiếp nhận"** (đang được phục vụ tại bàn đó).
- **1 nhân viên tư vấn tiếp nhận tối đa 2 khách** → tối đa **2 chấm/bàn**.
- Mục tiêu vận hành: nhìn sơ đồ biết ngay **mỗi NV đang follow mấy khách** và
  **họ là ai** (STT trên chấm; tên khi hover/click).
- Màu chấm: **cam** (`bg-amber-500`) chữ trắng, giống ảnh. (Khác với badge "khách
  chờ" hiện có ở góc phải node — badge đó là *đang chờ*, còn đây là *đã tiếp nhận*;
  cân nhắc gộp/ phân biệt, xem §7.)

Phạm vi: theo yêu cầu chỉ áp dụng **bàn Tư vấn**. Code nên viết tổng quát để bật
cho cụm khác sau này (cấu hình 1 cờ per-cluster).

---

## 2. Bối cảnh dữ liệu hiện tại (vì sao cần đổi nguồn)

Hiện mỗi bàn chỉ lấy **1 khách "gần nhất"** từ khối Status của bảng DS:
`STT gần nhất (helper)` + `Khách gần nhất (helper)` → `DeskLiveState.customerSTT`
/ `customerName` (xem `src/services/larkMapper.ts`, `src/types/desk.ts`).

→ Để hiện **≤2 khách/bàn**, phải có nguồn liệt kê **danh sách khách đang tiếp
nhận theo từng bàn**. Có 2 phương án (chọn 1, khuyến nghị A):

### Phương án A (khuyến nghị) — dùng bảng giao dịch "Tư vấn"
Bảng `Tư vấn` (đã từng dùng ở bản 2.1) có mỗi dòng = 1 phiên phục vụ, gồm:
`TV_MãNV`(= mã bàn TVn) · `Trạng thái`(Tiếp nhận/Hoàn tất) · `STT`(khách) ·
`Họ và tên` · `SP 1`.
→ Nhóm theo `TV_MãNV`, lọc `Trạng thái == "Tiếp nhận"`, lấy tối đa 2 → danh sách
khách đang tiếp nhận của bàn. **Cần thêm lại bảng này vào TableKey/service** (xem
lịch sử: nó đã bị gỡ ở 2.2, chỉ cần thêm lại cho cụm consult).

### Phương án B — thêm cột helper vào bảng `DS Tư vấn`
Thêm các cột: `STT khách 1`, `Khách 1`, `STT khách 2`, `Khách 2` (do người quản
lý base Lark tạo bằng công thức). Mapper đọc thẳng, không cần bảng giao dịch.
Đơn giản về code nhưng cần chỉnh cấu trúc base.

> Dù chọn A hay B, giữ nguyên triết lý **cấu hình runtime** (tên cột/bảng khai báo
> trong `larkSettings` để đổi ở trang `/#/settings`, không hard-code).

---

## 3. Thay đổi kiểu dữ liệu — `src/types/desk.ts`

Thêm cấu trúc khách + trường danh sách:

```ts
/** Một khách đang được tiếp nhận tại bàn. */
export interface DeskCustomer {
  stt: string | null;   // STT khách (hiển thị trên chấm)
  name: string | null;  // tên (hiển thị khi hover/popover)
}

export interface DeskLiveState {
  // …giữ nguyên các trường cũ…
  /** Khách đang "Tiếp nhận" tại bàn (đã cắt tối đa theo capacity). */
  receivedCustomers: DeskCustomer[];
}
```

Hằng số capacity:
```ts
/** Số khách tối đa 1 nhân viên tiếp nhận đồng thời (theo cụm). */
export const DESK_CAPACITY: Record<ClusterKey, number> = {
  tradein: 1,
  consult: 2,   // yêu cầu hiện tại
  backup: 1,
};
```

Lưu ý: `customerSTT`/`customerName` cũ vẫn giữ (cho popover/summary hiện tại).
`receivedCustomers[0]` nên trùng "khách gần nhất". `computeSummary` (phễu
"Đang tư vấn") vẫn đếm **khách distinct theo tên** — cân nhắc đổi để đếm theo
`receivedCustomers` cho chính xác hơn (xem §7).

---

## 4. Cấu hình nguồn (nếu chọn Phương án A)

Trong `src/services/larkTypes.ts` thêm lại table key:
```ts
export type TableKey =
  | 'dsTradein' | 'dsConsult' | 'dsBackup' | 'checkin' | 'orders'
  | 'txConsult'; // bảng giao dịch Tư vấn (danh sách khách tiếp nhận)
```
- `src/services/larkService.ts`: thêm `'txConsult'` vào `TABLE_KEYS`.
- `src/config/larkConfig.ts`: thêm map cột giao dịch + status "Tiếp nhận":
  ```ts
  export interface TxFieldMap { deskCode; status; stt; name; }
  export const DEFAULT_TX_CONSULT_FIELDS: TxFieldMap = {
    deskCode: 'TV_MãNV', status: 'Trạng thái', stt: 'STT', name: 'Họ và tên',
  };
  export const STATUS_RECEIVED = 'Tiếp nhận';
  ```
- `src/config/larkSettings.ts`: thêm `tableIds.txConsult`, `fields.txConsult`
  (TxFieldMap) vào `LarkSettings` + `defaultSettings()` + `hydrate()` +
  `toRuntimeConfig()`/`toFieldConfig()`; thêm ô nhập tương ứng ở `SettingsPage`.
- `.env.example` + `docs/LARK_SETUP.md`: thêm `txConsult` vào danh sách tableKey.

---

## 5. Mapper — `src/services/larkMapper.ts`

Sau khi dựng `statesById` từ DS, bổ sung `receivedCustomers`:

**Phương án A:**
```ts
// Nhóm txConsult theo mã bàn, lọc "Tiếp nhận", cắt theo capacity.
function indexReceived(rows, fm /*TxFieldMap*/, cap) {
  const m = new Map<string, DeskCustomer[]>();
  for (const r of rows) {
    if (cellToString(r.fields[fm.status]) !== STATUS_RECEIVED) continue;
    const code = cellToString(r.fields[fm.deskCode]);
    if (!code) continue;
    const list = m.get(code) ?? [];
    if (list.length < cap) {
      list.push({ stt: cellToString(r.fields[fm.stt]), name: cellToString(r.fields[fm.name]) });
      m.set(code, list);
    }
  }
  return m;
}
```
Rồi khi tạo mỗi `statesById[code]`, set `receivedCustomers: received.get(code) ?? []`.
Với các cụm không có nguồn danh sách (tradein/backup) → fallback:
`receivedCustomers = occupied && customerName ? [{stt: customerSTT, name: customerName}] : []`.

**Phương án B:** đọc thẳng `STT khách 1/2`, `Khách 1/2` từ DS row, bỏ dòng rỗng,
cắt theo `DESK_CAPACITY[cluster]`.

Đảm bảo `receivedCustomers` **luôn tồn tại** (mảng rỗng khi không có).

---

## 6. UI — chấm STT dưới bàn

Có 2 chỗ có thể render (khuyến nghị **6a** để không phá layout node):

### 6a. Trong `LayoutDashboard.tsx` (một lớp overlay riêng)
Sau vòng render `desks.map(... <Desk/> ...)`, thêm vòng render chấm cho bàn có
`receivedCustomers.length > 0`:
```tsx
{desks.map((d) =>
  (d.receivedCustomers?.length ?? 0) > 0 ? (
    <div
      key={`dots-${d.id}`}
      className="absolute z-10 flex -translate-x-1/2 gap-1"
      style={{ left: `${d.x}%`, top: `calc(${d.y}% + 22px)` }}  // ngay dưới node
    >
      {d.receivedCustomers!.map((c, i) => (
        <span
          key={i}
          title={c.name ?? ''}
          className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white shadow"
        >
          {c.stt ?? '•'}
        </span>
      ))}
    </div>
  ) : null,
)}
```
- Node cao `h-9` (36px); offset `+22px` đặt chấm ngay dưới. Tinh chỉnh nếu cần.
- Chỉ áp dụng cụm consult: thêm điều kiện `d.cluster === 'consult'` nếu muốn giới
  hạn đúng yêu cầu (khuyến nghị dùng `DESK_CAPACITY[d.cluster] > 1` hoặc cờ riêng).

### 6b. (thay thế) render bên trong `Desk.tsx`
Thêm prop `customers?: DeskCustomer[]` và render cụm chấm absolute dưới node.
Nhược điểm: chồng với badge "khách chờ" hiện có ở góc phải — cần bố trí lại.

---

## 7. Popover & Sidebar — hiển thị "ai"

- `DeskPopover.tsx`: khi bàn occupied, **liệt kê danh sách khách tiếp nhận** thay
  vì chỉ 1 khách. Ví dụ thêm khối:
  ```tsx
  <div className="text-neutral-500">Khách đang tiếp nhận ({desk.receivedCustomers?.length ?? 0}/{DESK_CAPACITY[desk.cluster]})</div>
  {desk.receivedCustomers?.map((c,i)=>(
    <div key={i} className="flex justify-between"><span>#{c.stt}</span><span className="font-medium">{c.name ?? '—'}</span></div>
  ))}
  ```
  Giữ các dòng SP/Ghi chú thanh toán cho khách chính (`receivedCustomers[0]`), hoặc
  bỏ nếu muốn gọn.
- `computeSummary` (types/desk.ts): cân nhắc đổi "Đang tư vấn" và "serving" sang
  đếm theo tổng `receivedCustomers` (distinct theo `stt` hoặc `name`) để khớp khi
  1 bàn có 2 khách. Hiện tại đang đếm distinct theo `customerName` (1 khách/bàn).

---

## 8. Mock để test — `src/data/mockLarkData.ts`

Cập nhật mock để có bàn Tư vấn với **2 khách tiếp nhận** (khớp ảnh: TV2 có 2 chấm).

**Nếu Phương án A**, thêm mảng `txConsult` (được `mockLarkTables` export) gồm các
dòng "Tiếp nhận" theo `TV_MãNV`:
```ts
const txConsult: LarkRecord[] = [
  { record_id:'tv_a', fields:{ 'TV_MãNV':'TV2','Trạng thái':'Tiếp nhận', STT:3, 'Họ và tên':'Phạm Đức Dũng' } },
  { record_id:'tv_b', fields:{ 'TV_MãNV':'TV2','Trạng thái':'Tiếp nhận', STT:9, 'Họ và tên':'Trần Văn B' } },
  { record_id:'tv_c', fields:{ 'TV_MãNV':'TV4','Trạng thái':'Tiếp nhận', STT:13,'Họ và tên':'Võ Xuân Phong' } },
];
export const mockLarkTables: LarkTables = { dsTradein, dsConsult, dsBackup, checkin, orders, txConsult };
```
(TV2/TV4 vẫn phải là "Đang tư vấn" trong `dsConsult` để node đỏ — đã có sẵn.)

**Nếu Phương án B**, thêm cột `STT khách 1/2`, `Khách 1/2` vào các dòng `dsConsult`.

Ghi chú: `DEFAULT_FIELD_CONFIG` (mock) cần bao gồm map cột giao dịch/helper mới.

---

## 9. Ràng buộc / edge cases

- **Tối đa 2**: cắt cứng theo `DESK_CAPACITY[cluster]` trong mapper (không tin
  tưởng dữ liệu vào — nếu Lark trả 3 dòng "Tiếp nhận" cho 1 bàn, chỉ lấy 2 và có
  thể cảnh báo).
- Bàn "Rảnh"/"Chưa có dữ liệu" → `receivedCustomers = []` (không có chấm).
- STT rỗng → hiển thị `•` thay vì trống.
- Trùng badge "khách chờ": badge góc phải = *đang chờ*; chấm dưới = *đã tiếp nhận*.
  Nếu gây rối, đổi màu/kí hiệu để phân biệt (vd chờ = viền cam, tiếp nhận = nền cam).

---

## 10. Checklist file cần sửa

- [ ] `src/types/desk.ts` — `DeskCustomer`, `receivedCustomers`, `DESK_CAPACITY`,
      (tuỳ chọn) cập nhật `computeSummary`.
- [ ] `src/services/larkTypes.ts` — thêm `txConsult` (nếu PA A).
- [ ] `src/config/larkConfig.ts` — `TxFieldMap` + defaults + `STATUS_RECEIVED`.
- [ ] `src/config/larkSettings.ts` — tableId + field map + form labels.
- [ ] `src/services/larkService.ts` — thêm `'txConsult'` vào fetch.
- [ ] `src/services/larkMapper.ts` — dựng `receivedCustomers`.
- [ ] `src/components/LayoutDashboard.tsx` (hoặc `Desk.tsx`) — render chấm STT.
- [ ] `src/components/DeskPopover.tsx` — liệt kê khách tiếp nhận.
- [ ] `src/data/mockLarkData.ts` — mock 2 khách cho 1 bàn Tư vấn.
- [ ] `src/pages/SettingsPage.tsx` + `.env.example` + `docs/LARK_SETUP.md` — nếu
      thêm bảng/cột mới.
- [ ] Cập nhật `docs/PROJECT_OVERVIEW.md` + `memory.md`.

---

## 11. Cách kiểm thử

```bash
npm run build            # phải pass (tsc + vite)
npm run preview          # mở http://localhost:4173
```
Kỳ vọng (mock): dưới **TV2** có **2 chấm cam** mang STT (vd 3, 9), **TV4** có 1
chấm; hover chấm hiện tên; click bàn → popover liệt kê khách tiếp nhận (x/2).
Nên chụp screenshot đối chiếu ảnh mẫu.

---

## 12. Gợi ý prompt cho phiên Claude Code khác

> "Đọc `docs/UPDATE_consult-customer-dots.md` và triển khai theo Phương án A.
> Thêm `receivedCustomers` (tối đa 2) cho bàn Tư vấn lấy từ bảng giao dịch `Tư
> vấn` (lọc Trạng thái='Tiếp nhận' theo `TV_MãNV`), render chấm STT màu cam dưới
> mỗi bàn Tư vấn, liệt kê khách trong popover, cập nhật mock để TV2 có 2 khách,
> giữ nguyên cơ chế cấu hình runtime ở trang Cài đặt. Build pass và chụp màn hình
> đối chiếu."
