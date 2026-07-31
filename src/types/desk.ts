/**
 * Domain types for the Coordinator dashboard (spec v3 — KT/TV floor plan).
 *
 * A "desk" is one interactive floor position (KT/TV). Its static shape
 * (id, cluster, label, coords) comes from layoutConfig; its live state comes
 * from the Lark "DS *" registry tables (staff + counts) plus, best-effort, the
 * transaction tables (current customer detail). See memory.md §4.
 */

/** Physical cluster a desk belongs to. */
export type ClusterKey = 'kythuat' | 'consult';

/**
 * Static definition of one desk position on the map.
 *
 * `id` is the JOIN KEY against Lark rows and `label` is what's shown on
 * screen — usually identical, but the `kythuat` cluster keeps `id` on the old
 * "TC" codes (matching the live "DS thu cũ" table, unchanged) while `label`
 * shows the new "KT" codes, so the floor plan can be relabeled without
 * touching the Lark side. See layoutConfig.ts.
 */
export interface TablePosition {
  /** Desk code = join key, e.g. "TV7". */
  id: string;
  cluster: ClusterKey;
  /** Label rendered on the node (may differ from `id` — see above). */
  label: string;
  /** Node center X as a percentage (0–100) of the board width. */
  x: number;
  /** Node center Y as a percentage (0–100) of the board height. */
  y: number;
}

/** Visual state of a desk node — chỉ 2 màu: xanh (rảnh) / đỏ (có khách). */
export type DeskUiStatus = 'available' | 'occupied';

/** Một khách đang được tiếp nhận tại bàn (chấm STT dưới node). */
export interface DeskCustomer {
  stt: string | null; // STT khách (hiển thị trên chấm)
  name: string | null; // tên (hiển thị khi hover / trong popover)
  productName?: string | null; // SP 1 (join Check in theo tên)
  paymentNote?: string | null; // Note UDTT (join Check in theo tên)
  deviceAccepted?: boolean | null; // Đã nghiệm thu thiết bị (join Check in theo tên)
  oldDeviceCheck?: string | null; // Cột "Thu cũ check" — nguyên văn lựa chọn (join Check in theo tên)
}

/** Số khách tối đa 1 nhân viên tiếp nhận đồng thời (theo cụm). */
export const DESK_CAPACITY: Record<ClusterKey, number> = {
  kythuat: 2,
  consult: 2,
};

/**
 * Một khách đang ở khu vực chờ ngoài bàn (chưa gán vào bàn cụ thể):
 *   - "Chờ check-in": đã check-in (có STT) nhưng chưa từng xuất hiện ở bàn nào.
 *   - "Chờ điều phối": vừa hoàn tất 1 cụm (`fromCluster`) và đang rảnh, chờ
 *     điều phối viên đưa sang cụm tiếp theo.
 */
export interface WaitingCustomer extends DeskCustomer {
  /** Cụm vừa hoàn tất — chỉ có ở nhóm "Chờ điều phối". */
  fromCluster?: ClusterKey | null;
  /** Tên khâu vừa hoàn tất, lấy trực tiếp từ Check-in cột "Done in Flow". */
  doneInFlow?: string | null;
}

/**
 * Live per-desk state merged from the DS registry (+ transaction join).
 * All fields optional so a desk with no data still renders (as available).
 */
export interface DeskLiveState {
  /** Assigned staff — DS `NV Tư vấn` / `Nhân viên`. */
  staffName: string | null;
  /** DS `Sl … tiếp nhận` — currently being served. */
  received: number;
  /** DS `Sl … hoàn tất` — completed. */
  completed: number;
  /** DS `Sl khách chờ` — waiting (bottleneck signal). */
  waiting: number;
  /** DS `Trạng thái hiện tại` — "Đang tư vấn" / "Rảnh" / "Chưa có dữ liệu". */
  currentStatus: string | null;
  /** Derived from currentStatus → occupied (red). */
  isOccupied: boolean;
  /** true once this desk was seen in the data (chỉ dùng cho thống kê "X/Y bàn"). */
  hasData: boolean;
  // ── Customer detail (only when occupied), from DS + Check in ──
  customerSTT: string | null; // STT gần nhất
  customerName: string | null; // Khách gần nhất
  productName: string | null; // SP 1 (Check in, by name)
  paymentNote: string | null; // Note UDTT (Check in, by name)
  deviceAccepted: boolean | null; // Đã nghiệm thu thiết bị (Check in, by name)
  /** Mọi khách đang "Tiếp nhận" cùng lúc bởi NV phụ trách bàn này, sắp theo thời gian check-in. */
  receivedCustomers: DeskCustomer[];
}

/** A position combined with its (optional) live state — one rendered node. */
export type DeskData = TablePosition & Partial<DeskLiveState>;

/**
 * Derive the visual status — chỉ 2 màu, không còn "chưa có dữ liệu" (grey):
 * bàn không có khách (kể cả khi Lark báo "Chưa có dữ liệu", hoặc không khớp
 * bàn nào) đều coi là "available" (xanh). `isOccupied` (khi có) là nguồn đáng
 * tin cậy nhất — mapper tính nó có xét cả trường hợp nhiều khách/bàn (DS chỉ
 * theo dõi 1 khách/bàn nên `Trạng thái hiện tại` có thể báo "Rảnh" sai ngay
 * khi khách GẦN NHẤT xong, dù NV đó vẫn còn đang phục vụ khách khác). Khi gọi
 * với object chưa có `isOccupied` (vd bên trong mapper, lúc đang tính toán),
 * rơi về suy từ text `Trạng thái hiện tại` như cũ: "Đang tư vấn" → occupied.
 */
export function deskUiStatus(d: Partial<DeskLiveState> | undefined): DeskUiStatus {
  if (d?.isOccupied) return 'occupied';
  const s = (d?.currentStatus ?? '').toLowerCase();
  if (s.includes('đang')) return 'occupied'; // Đang tư vấn / Đang tiếp nhận
  return 'available'; // Rảnh, Chưa có dữ liệu, hoặc không có bàn nào khớp
}

/** Aggregated counts for one cluster. */
export interface ClusterSummary {
  total: number; // fixed map nodes in this cluster
  withData: number; // nodes matched to a DS row
  occupied: number;
  available: number;
  waiting: number; // sum of khách chờ
}

/** Customer funnel for the sidebar card (distinct customers by name). */
export interface CustomerFunnel {
  totalRegistered: number; // Số tổng (Danh sách đơn hàng)
  checkedIn: number; // SL khách đã check-in
  consulting: number; // đang ở bàn Tư vấn
  serving: number; // đang được phục vụ ở bất kỳ bàn nào
  notServed: number; // đã check-in nhưng chưa được phục vụ
}

/** Whole-board summary for the sidebar. */
export interface DashboardSummary {
  byCluster: Record<ClusterKey, ClusterSummary>;
  customers: CustomerFunnel;
}

const CLUSTERS: ClusterKey[] = ['kythuat', 'consult'];

/**
 * Compute per-cluster summary + customer funnel from the rendered desks.
 * `totalRegistered` / `checkedIn` come from the Orders / Check-in tables.
 * Served counts are **distinct customers by name** (one person may occupy
 * several desks across stages, so counting desks would over-count).
 */
export function computeSummary(
  desks: DeskData[],
  opts: { totalRegistered?: number; checkedIn?: number } = {},
): DashboardSummary {
  const byCluster = Object.fromEntries(
    CLUSTERS.map((c) => [c, { total: 0, withData: 0, occupied: 0, available: 0, waiting: 0 }]),
  ) as Record<ClusterKey, ClusterSummary>;

  const servedNames = new Set<string>();
  const consultingNames = new Set<string>();

  for (const d of desks) {
    const s = byCluster[d.cluster];
    s.total += 1;
    const u = deskUiStatus(d);
    if (d.hasData) {
      s.withData += 1;
      s.waiting += d.waiting ?? 0;
    }
    if (u === 'occupied') {
      s.occupied += 1;
      if (d.customerName) {
        servedNames.add(d.customerName);
        if (d.cluster === 'consult') consultingNames.add(d.customerName);
      }
    } else if (u === 'available') {
      s.available += 1;
    }
  }

  const checkedIn = opts.checkedIn ?? 0;
  const serving = servedNames.size;
  const customers: CustomerFunnel = {
    totalRegistered: opts.totalRegistered ?? 0,
    checkedIn,
    consulting: consultingNames.size,
    serving,
    notServed: Math.max(0, checkedIn - serving),
  };

  return { byCluster, customers };
}
