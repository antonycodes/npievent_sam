/**
 * larkMapper — turn raw Lark tables into per-desk live state.
 *
 * As of NPI_Testing_2.2 each DS registry row carries the desk's current status
 * and latest customer, so occupancy comes straight from DS:
 *   - status  ← `Trạng thái hiện tại` ("Đang tư vấn" → occupied, "Rảnh" → free)
 *   - khách "gần nhất" ← `Khách gần nhất` — chỉ dùng làm ANCHOR để tìm khoá NV
 *     (xem `indexActiveByStaffKey`), không dùng để giới hạn còn 1 khách/bàn.
 * Danh sách khách ĐANG được phục vụ tại 1 bàn lấy từ Check-in: mọi khách có
 * cùng "khoá NV phụ trách" (theo cụm) với khách anchor VÀ đang ở trạng thái
 * "Tiếp nhận" ở cụm đó — nên 1 NV phục vụ nhiều khách cùng lúc hiện đúng ở CẢ
 * 2 cụm (Kỹ thuật/Tư vấn), không chỉ Tư vấn như cách cũ (qua bảng riêng
 * "Giao dịch Tư vấn"). Khách được sắp theo "Thời gian" check-in tăng dần.
 *
 * Cụm "kythuat" (KT) đọc đúng bảng/cột Lark "Thu cũ" cũ (dsTradein,
 * staffTradein, statusTradein) không đổi — chỉ nhãn hiển thị trên sơ đồ đổi
 * thành "KT". "Backup" không còn tồn tại trong sơ đồ mới, đã bỏ khỏi mapper.
 */
import {
  STATUS_COMPLETED,
  STATUS_RECEIVED,
  type CheckinFieldMap,
  type FieldConfig,
} from '@/config/larkConfig';
import { toFieldConfig } from '@/config/larkSettings';
import {
  deskUiStatus,
  type ClusterKey,
  type DeskCustomer,
  type DeskLiveState,
  type WaitingCustomer,
} from '@/types/desk';
import type { LarkCellValue, LarkRecord, LarkTables } from './larkTypes';

export function cellToString(v: LarkCellValue): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (Array.isArray(v)) {
    // 3 dạng thấy được từ Lark thật: rich-text segment ({text,type}, vd
    // "Done in Flow"), mảng string trần (link/lookup field, vd "TV_Nsư Tư
    // vấn" → ["optxXl70bv"]), và mảng object người dùng (person field, vd
    // "NV Tư vấn" → [{id,name,email,...}], không có `.text`) — xử lý cả 3.
    const s = v
      .map((seg) => (typeof seg === 'string' ? seg : seg?.text ?? seg?.name ?? ''))
      .join('')
      .trim();
    return s || null;
  }
  return null;
}

export function cellToNumber(v: LarkCellValue): number {
  if (typeof v === 'number') return v;
  const s = cellToString(v);
  const n = s == null ? NaN : Number(s);
  return Number.isFinite(n) ? n : 0;
}

const TRUTHY_TEXT = new Set(['true', '1', 'x', 'có', 'yes', 'checked']);

/**
 * Coerce a Lark cell to boolean. Handles a plain checkbox (boolean) and the
 * real "Check nghiệm thu" field, which is a FORMULA column rendering as a
 * colored tag string — "✅ Đã nghiệm thu (1) máy" / "❌ Chưa nghiệm thu máy" —
 * so match by emoji/keyword rather than exact string (the trailing count varies).
 */
export function cellToBool(v: LarkCellValue): boolean {
  if (typeof v === 'boolean') return v;
  const s = cellToString(v);
  if (!s) return false;
  const norm = s.trim().toLowerCase();
  if (norm.includes('✅') || norm.includes('đã nghiệm thu')) return true;
  if (norm.includes('❌') || norm.includes('chưa nghiệm thu')) return false;
  return TRUTHY_TEXT.has(norm);
}

const CLUSTERS: ClusterKey[] = ['kythuat', 'consult'];
// `kythuat` still reads the "dsTradein" Lark table (unchanged) — see the
// module doc above and layoutConfig.ts's `ID_PREFIX` comment.
const DS_KEY = { kythuat: 'dsTradein', consult: 'dsConsult' } as const;

export interface MappedData {
  statesById: Record<string, DeskLiveState>;
  totalCheckIn: number;
  totalRegistered: number;
  /** Đã check-in (có STT) nhưng chưa từng xuất hiện ở bàn nào — chờ điều phối lần đầu. */
  waitingCheckin: WaitingCustomer[];
  /** Vừa hoàn tất 1 cụm, bàn đang rảnh, chưa được điều phối sang cụm tiếp theo. */
  waitingDispatch: WaitingCustomer[];
  /** Đã hoàn tất toàn bộ quy trình (Check-in cột "End flow" = "End flow"). */
  endFlow: WaitingCustomer[];
}

const END_FLOW_DONE = 'end flow';

/** Check-in "End flow" — "End flow" (đã xong toàn bộ) vs "In flow" (đang trong luồng). */
function isEndFlowValue(v: LarkCellValue): boolean {
  const s = cellToString(v);
  return s ? s.trim().toLowerCase() === END_FLOW_DONE : false;
}

interface CheckinIndexEntry {
  stt: string | null;
  product: string | null;
  note: string | null;
  deviceAccepted: boolean;
  /** Cột "Thu cũ check" — nguyên văn lựa chọn (single-select, có thể ≥ 2 tuỳ chọn). */
  oldDeviceCheck: string | null;
  /** Khâu vừa hoàn tất (Check-in cột "Done in Flow") — chỉ có ý nghĩa khi khách đã xong 1 khâu. */
  doneInFlow: string | null;
  /** Đã hoàn tất toàn bộ quy trình (Check-in cột "End flow"). */
  endFlow: boolean;
  /** Khoá NV phụ trách khách này, theo từng cụm (giá trị nội bộ Lark, opaque). */
  staffKey: Record<ClusterKey, string | null>;
}

/**
 * Index Check-in rows by customer name.
 *
 * Check-in's `STT` is the ONE canonical queue number for a customer — assigned
 * once at check-in and unchanged for the whole event. DS tables also carry a
 * local "STT gần nhất (helper)" per stage, but that is a per-stage helper, not
 * an identity — never use it to label a customer.
 */
function indexCheckinByName(rows: LarkRecord[], fm: CheckinFieldMap): Map<string, CheckinIndexEntry> {
  const m = new Map<string, CheckinIndexEntry>();
  for (const r of rows) {
    const name = cellToString(r.fields[fm.name]);
    if (name) {
      m.set(name, {
        stt: cellToString(r.fields[fm.stt]),
        product: cellToString(r.fields[fm.product]),
        note: cellToString(r.fields[fm.note]),
        deviceAccepted: cellToBool(r.fields[fm.deviceAccepted]),
        oldDeviceCheck: cellToString(r.fields[fm.oldDeviceCheck]),
        doneInFlow: cellToString(r.fields[fm.doneInFlow]),
        endFlow: isEndFlowValue(r.fields[fm.endFlow]),
        staffKey: {
          kythuat: cellToString(r.fields[fm.staffTradein]),
          consult: cellToString(r.fields[fm.staffConsult]),
        },
      });
    }
  }
  return m;
}

const STAFF_FIELD: Record<ClusterKey, keyof CheckinFieldMap> = {
  kythuat: 'staffTradein',
  consult: 'staffConsult',
};
const STATUS_FIELD: Record<ClusterKey, keyof CheckinFieldMap> = {
  kythuat: 'statusTradein',
  consult: 'statusConsult',
};

/**
 * Gom khách đang "Tiếp nhận" (Check-in) theo cụm + khoá NV phụ trách, sắp
 * theo "Thời gian" check-in tăng dần (ai check-in trước lên trước). Đây là
 * nguồn cho phép 1 NV hiện đủ TẤT CẢ khách đang phục vụ cùng lúc, ở cả 3 cụm.
 */
function indexActiveByStaffKey(
  rows: LarkRecord[],
  fm: CheckinFieldMap,
  checkinByName: Map<string, CheckinIndexEntry>,
): Record<ClusterKey, Map<string, DeskCustomer[]>> {
  const result: Record<ClusterKey, Map<string, DeskCustomer[]>> = {
    kythuat: new Map(),
    consult: new Map(),
  };

  for (const cluster of CLUSTERS) {
    const staffField = fm[STAFF_FIELD[cluster]];
    const statusField = fm[STATUS_FIELD[cluster]];
    const entries: Array<{ staffKey: string; time: number; customer: DeskCustomer }> = [];

    for (const r of rows) {
      const staffKey = cellToString(r.fields[staffField]);
      if (!staffKey || cellToString(r.fields[statusField]) !== STATUS_RECEIVED) continue;
      const name = cellToString(r.fields[fm.name]);
      if (!name) continue;
      const ci = checkinByName.get(name);
      entries.push({
        staffKey,
        time: cellToNumber(r.fields[fm.time]),
        customer: {
          stt: ci?.stt ?? null,
          name,
          productName: ci?.product ?? null,
          paymentNote: ci?.note ?? null,
          deviceAccepted: ci?.deviceAccepted ?? null,
          oldDeviceCheck: ci?.oldDeviceCheck ?? null,
        },
      });
    }

    entries.sort((a, b) => a.time - b.time);
    for (const e of entries) {
      const list = result[cluster].get(e.staffKey) ?? [];
      list.push(e.customer);
      result[cluster].set(e.staffKey, list);
    }
  }

  return result;
}

export function mapDeskStates(tables: LarkTables, fields: FieldConfig = toFieldConfig()): MappedData {
  const { ds, dsStatus, checkin } = fields;
  const checkinByName = indexCheckinByName(tables.checkin, checkin);
  // Khách đang "Tiếp nhận" theo cụm + khoá NV — cho phép 1 NV hiện nhiều khách
  // cùng lúc ở cả 3 cụm (không chỉ Tư vấn).
  const activeByStaffKey = indexActiveByStaffKey(tables.checkin, checkin, checkinByName);
  const statesById: Record<string, DeskLiveState> = {};

  // Đang được phục vụ ở BẤT KỲ bàn nào ngay lúc này (mọi cụm).
  const activeNames = new Set<string>();
  // Đã từng xuất hiện ở bất kỳ bàn nào (mọi trạng thái) — dùng để loại khỏi "Chờ check-in".
  const everSeenNames = new Set<string>();
  // Ứng viên "chờ điều phối": bàn vừa hoàn tất (Trạng thái gần nhất) và hiện đang rảnh.
  const completedCandidates: WaitingCustomer[] = [];

  for (const cluster of CLUSTERS) {
    const dsFm = ds[cluster];

    for (const rec of tables[DS_KEY[cluster]]) {
      const code = cellToString(rec.fields[dsFm.code]);
      if (!code) continue;

      const currentStatus = cellToString(rec.fields[dsStatus.currentStatus]);
      const customerRecent = cellToString(rec.fields[dsStatus.customerRecent]);

      if (customerRecent) everSeenNames.add(customerRecent);

      // "Khách gần nhất" chỉ dùng làm ANCHOR để suy staffKey của bàn này —
      // tra bất kể DS đang báo gì, vì DS chỉ theo dõi 1 khách/bàn nên
      // `Trạng thái hiện tại` có thể báo "Rảnh" ngay khi khách gần nhất vừa
      // xong, dù NV đó vẫn còn đang phục vụ khách KHÁC (nhiều khách/bàn).
      const anchorCi = customerRecent ? checkinByName.get(customerRecent) : undefined;
      const staffKey = anchorCi?.staffKey[cluster] ?? null;
      const grouped = staffKey ? activeByStaffKey[cluster].get(staffKey) : undefined;
      const hasActiveGroup = (grouped?.length ?? 0) > 0;

      // Occupied = có nhóm khách thật sự đang "Tiếp nhận" (đáng tin hơn, xét
      // đúng nhiều khách/bàn), HOẶC (fallback) DS tự báo đang bận — dùng khi
      // Check-in chưa có staffKey cho khách này.
      const dsOccupied = deskUiStatus({ currentStatus, hasData: true }) === 'occupied';
      const occupied = hasActiveGroup || dsOccupied;

      // Fallback về đúng 1 khách "gần nhất" — CHỈ khi Check-in chưa gom được
      // nhóm nào (anchor có thể đã "Hoàn tất" nên không còn trong nhóm active;
      // nếu vẫn nhét anchor vào đây thì fallback sẽ SỐNG LẠI đúng người vừa
      // hoàn tất, ghi đè lên nhóm — không dùng anchor khi đã có nhóm thật).
      const fallback: DeskCustomer[] =
        !hasActiveGroup && dsOccupied && customerRecent
          ? [
              {
                stt: anchorCi?.stt ?? null,
                name: customerRecent,
                productName: anchorCi?.product ?? null,
                paymentNote: anchorCi?.note ?? null,
                deviceAccepted: anchorCi?.deviceAccepted ?? null,
                oldDeviceCheck: anchorCi?.oldDeviceCheck ?? null,
              },
            ]
          : [];
      const receivedCustomers: DeskCustomer[] = hasActiveGroup ? grouped! : fallback;
      for (const c of receivedCustomers) if (c.name) activeNames.add(c.name);

      // Các field "1 khách" (legacy, chủ yếu phục vụ nhánh fallback/hiện thị
      // rút gọn) — lấy từ khách ĐẦU TIÊN trong `receivedCustomers` thật sự,
      // KHÔNG phải luôn là anchor (anchor có thể đã xong trong khi nhóm vẫn
      // còn người khác) — tránh gán `activeNames` sai cho người đã hoàn tất.
      const primary = receivedCustomers[0];
      const customerSTT = primary?.stt ?? null;
      const customerName = primary?.name ?? null;
      const productName = primary?.productName ?? null;
      const paymentNote = primary?.paymentNote ?? null;
      const deviceAccepted = primary?.deviceAccepted ?? null;

      statesById[code] = {
        staffName: cellToString(rec.fields[dsFm.staff]),
        received: cellToNumber(rec.fields[dsFm.received]),
        completed: cellToNumber(rec.fields[dsFm.completed]),
        // Guard against spreadsheet formula artifacts (e.g. -1).
        waiting: Math.max(0, cellToNumber(rec.fields[dsFm.waiting])),
        currentStatus,
        isOccupied: occupied,
        hasData: true,
        customerSTT,
        customerName,
        productName,
        paymentNote,
        deviceAccepted,
        receivedCustomers,
      };
    }
  }

  // Ứng viên "chờ điều phối" — quét theo TỪNG KHÁCH qua Check-in
  // (`Status in <cụm>` = "Hoàn tất"), KHÔNG theo bàn: 1 bàn có thể vừa hoàn
  // tất 1 khách trong khi NV đó vẫn đang phục vụ khách khác cùng lúc — DS chỉ
  // báo "Hoàn tất"/"Rảnh" ở cấp CẢ BÀN nên bỏ sót đúng ca này (occupied vẫn
  // true vì còn khách khác). `activeNames`/`dispatchSeen`/`endFlow` xử lý loại
  // trùng bên dưới, nên chỉ cần đẩy hết ứng viên vào đây.
  for (const cluster of CLUSTERS) {
    const statusField = checkin[STATUS_FIELD[cluster]];
    for (const r of tables.checkin) {
      if (cellToString(r.fields[statusField]) !== STATUS_COMPLETED) continue;
      const name = cellToString(r.fields[checkin.name]);
      if (!name) continue;
      const ci = checkinByName.get(name);
      completedCandidates.push({
        stt: ci?.stt ?? null,
        name,
        productName: ci?.product ?? null,
        paymentNote: ci?.note ?? null,
        deviceAccepted: ci?.deviceAccepted ?? null,
        oldDeviceCheck: ci?.oldDeviceCheck ?? null,
        fromCluster: cluster,
        doneInFlow: ci?.doneInFlow ?? null,
      });
    }
  }

  // "Chờ điều phối": hoàn tất 1 khâu nhưng chưa đang được phục vụ ở đâu khác
  // (đã dispatch rồi thì loại; đã "End flow" toàn bộ thì cũng loại — không cần
  // điều phối thêm nữa; 1 khách chỉ hiện 1 lần dù hoàn tất ở nhiều bàn).
  const dispatchSeen = new Set<string>();
  const waitingDispatch: WaitingCustomer[] = [];
  for (const cand of completedCandidates) {
    if (!cand.name || activeNames.has(cand.name) || dispatchSeen.has(cand.name)) continue;
    if (checkinByName.get(cand.name)?.endFlow) continue;
    dispatchSeen.add(cand.name);
    waitingDispatch.push(cand);
  }

  // "Chờ check-in": đã check-in (có STT) nhưng chưa từng xuất hiện ở bàn nào.
  const waitingCheckin: WaitingCustomer[] = [];
  for (const r of tables.checkin) {
    const name = cellToString(r.fields[checkin.name]);
    if (!name || everSeenNames.has(name) || activeNames.has(name)) continue;
    waitingCheckin.push({
      stt: cellToString(r.fields[checkin.stt]),
      name,
      productName: cellToString(r.fields[checkin.product]),
      paymentNote: cellToString(r.fields[checkin.note]),
      deviceAccepted: cellToBool(r.fields[checkin.deviceAccepted]),
      oldDeviceCheck: cellToString(r.fields[checkin.oldDeviceCheck]),
    });
  }

  // "End Flow": đã hoàn tất toàn bộ quy trình (Check-in cột "End flow").
  const endFlow: WaitingCustomer[] = [];
  for (const [name, ci] of checkinByName) {
    if (!ci.endFlow) continue;
    endFlow.push({
      stt: ci.stt,
      name,
      productName: ci.product,
      paymentNote: ci.note,
      deviceAccepted: ci.deviceAccepted,
      oldDeviceCheck: ci.oldDeviceCheck,
      doneInFlow: ci.doneInFlow,
    });
  }

  const totalCheckIn = new Set(
    tables.checkin
      .map((r) => cellToString(r.fields[checkin.stt]))
      .filter((s): s is string => Boolean(s)),
  ).size;

  // "Danh sách đơn hàng" — total registered (row count).
  const totalRegistered = tables.orders?.length ?? 0;

  return { statesById, totalCheckIn, totalRegistered, waitingCheckin, waitingDispatch, endFlow };
}
