/**
 * larkConfig — types + DEFAULT column maps / connection for the Lark integration.
 *
 * These are the compile-time defaults (matching the `NPI_Testing_2.2` workbook,
 * seeded from `VITE_*` env). At runtime they can be overridden from the in-app
 * Settings page — see `larkSettings.ts`, which is what the app actually reads.
 */
import type { ClusterKey } from '@/types/desk';
import type { TableKey } from '@/services/larkTypes';

const env = import.meta.env;

export const DEFAULT_HOST =
  (env.VITE_LARK_HOST as string | undefined)?.replace(/\/+$/, '') ?? 'https://open.larksuite.com';

/** Column names in a DS registry table → domain. */
export interface DsFieldMap {
  code: string;
  staff: string;
  received: string;
  completed: string;
  waiting: string;
}

/** DS "Status" block columns (same in all 3 DS tables). */
export interface DsStatusFieldMap {
  sttRecent: string;
  statusRecent: string;
  customerRecent: string;
  currentStatus: string;
}

/** Check-in table columns. */
export interface CheckinFieldMap {
  stt: string;
  name: string;
  product: string;
  note: string;
  deviceAccepted: string;
  /**
   * Cột "Thu cũ check" — single-select, tuỳ event có thể có ≥ 2 lựa chọn (vd
   * "❌ KHÔNG THU CŨ ❌" / "✅ CÓ THU CŨ ✅" / "♻️ THU CŨ SAU ♻️" — danh sách
   * lựa chọn có thể đổi trong Lark) nên hiển thị NGUYÊN VĂN lựa chọn đang chọn,
   * không rút gọn thành cờ đúng/sai. Khác với `deviceAccepted` ("Check nghiệm
   * thu" — đã/chưa NGHIỆM THU máy cũ đó, việc khác).
   */
  oldDeviceCheck: string;
  /** Khâu vừa hoàn tất (formula) — dùng cho dòng "Trạng thái" ở "Chờ điều phối". */
  doneInFlow: string;
  /** Đã xong toàn bộ quy trình chưa (formula) — giá trị "End flow" | "In flow". */
  endFlow: string;
  /** Thời điểm check-in — dùng để sắp khách theo thứ tự trước/sau khi 1 NV phục vụ nhiều khách cùng lúc. */
  time: string;
  /**
   * Khoá nhân viên phụ trách khách này ở từng cụm (giá trị nội bộ Lark, không
   * cần là tên NV). Tên field vẫn giữ hậu tố "Tradein" — cụm "kythuat" (KT) đọc
   * đúng field/bảng Lark này KHÔNG ĐỔI (xem layoutConfig.ts's `ID_PREFIX`
   * comment): chỉ nhãn hiển thị trên sơ đồ đổi thành "KT", còn kết nối Lark
   * "Thu cũ" cũ giữ nguyên cho tới khi có bảng "Kỹ thuật" thật.
   */
  staffTradein: string;
  staffConsult: string;
  /** Trạng thái khách ở từng cụm — "Tiếp nhận" nghĩa là đang được NV đó phục vụ. */
  statusTradein: string;
  statusConsult: string;
}

/** Transaction table columns (danh sách khách tiếp nhận theo bàn). */
export interface TxFieldMap {
  deskCode: string; // cột mã bàn (vd TV_MãNV)
  status: string; // cột trạng thái
  stt: string; // STT khách
  name: string; // tên khách
}

/** All field maps bundled — what the mapper needs. */
export interface FieldConfig {
  ds: Record<ClusterKey, DsFieldMap>;
  dsStatus: DsStatusFieldMap;
  checkin: CheckinFieldMap;
  txConsult: TxFieldMap;
}

// `kythuat` reads the same "DS thu cũ" columns as before (SL TC ...) — the
// Lark base hasn't been renamed, only the cluster's on-screen label has.
export const DEFAULT_DS_FIELDS: Record<ClusterKey, DsFieldMap> = {
  kythuat: { code: 'STT bàn', staff: 'Nhân viên', received: 'SL TC tiếp nhận', completed: 'SL TC hoàn tất', waiting: 'SL Khách chờ' },
  consult: { code: 'STT bàn', staff: 'NV Tư vấn', received: 'Sl TV tiếp nhận', completed: 'Sl TV hoàn tất', waiting: 'Sl khách chờ' },
};

export const DEFAULT_DS_STATUS_FIELDS: DsStatusFieldMap = {
  sttRecent: 'STT gần nhất (helper)',
  statusRecent: 'Trạng thái gần nhất (helper)',
  customerRecent: 'Khách gần nhất (helper)',
  currentStatus: 'Trạng thái hiện tại (kết quả chính)',
};

export const DEFAULT_CHECKIN_FIELDS: CheckinFieldMap = {
  stt: 'STT',
  name: 'Họ và tên',
  product: 'SP 1',
  note: 'Note UDTT',
  deviceAccepted: 'Check nghiệm thu',
  oldDeviceCheck: 'Thu cũ check',
  doneInFlow: 'Done in Flow',
  endFlow: 'End flow',
  time: 'Thời gian',
  staffTradein: 'TC_Nsư thu cũ',
  staffConsult: 'TV_Nsư Tư vấn',
  statusTradein: 'Status in thu cũ',
  statusConsult: 'Status in tư vấn',
};

export const DEFAULT_TX_CONSULT_FIELDS: TxFieldMap = {
  deskCode: 'TV_MãNV',
  status: 'Trạng thái',
  stt: 'STT',
  name: 'Họ và tên',
};

/** Giá trị `Trạng thái` (bảng giao dịch) nghĩa là "đã tiếp nhận". */
export const STATUS_RECEIVED = 'Tiếp nhận';

/** Giá trị `Trạng thái gần nhất` (DS) nghĩa là bàn vừa hoàn tất 1 khách. */
export const STATUS_COMPLETED = 'Hoàn tất';

/**
 * `Trạng thái hiện tại` → desk UI status — chỉ 2 màu:
 *   "Đang tư vấn" → occupied (đỏ) · else (kể cả "Rảnh"/"Chưa có dữ liệu") → available (xanh).
 */
export const STATUS_OCCUPIED_HINT = 'đang';
export const STATUS_FREE_HINT = 'rảnh';

/** Bitable table ids, one per logical table (direct mode). */
export type TableIdMap = Record<TableKey, string | undefined>;

/** The connection config the client/service consume. */
export interface LarkRuntimeConfig {
  useMock: boolean;
  apiUrl?: string;
  host: string;
  appToken?: string;
  accessToken?: string;
  tableIds: TableIdMap;
  pollMs: number;
}

/** Env-seeded defaults for first run (before the user opens Settings). */
export const ENV_DEFAULTS = {
  apiUrl: (env.VITE_LARK_API_URL as string | undefined) || '',
  host: DEFAULT_HOST,
  appToken: (env.VITE_LARK_APP_TOKEN as string | undefined) || '',
  accessToken: (env.VITE_LARK_ACCESS_TOKEN as string | undefined) || '',
  pollMs: Number(env.VITE_LARK_POLL_MS) > 0 ? Number(env.VITE_LARK_POLL_MS) : 30000,
  useMock:
    env.VITE_LARK_USE_MOCK === 'true' || (!env.VITE_LARK_API_URL && !env.VITE_LARK_APP_TOKEN),
  tableIds: {
    dsTradein: (env.VITE_LARK_TABLE_DS_TRADEIN as string | undefined) || '',
    dsConsult: (env.VITE_LARK_TABLE_DS_CONSULT as string | undefined) || '',
    checkin: (env.VITE_LARK_TABLE_CHECKIN as string | undefined) || '',
    orders: (env.VITE_LARK_TABLE_ORDERS as string | undefined) || '',
    txConsult: (env.VITE_LARK_TABLE_TX_CONSULT as string | undefined) || '',
  } as Record<TableKey, string>,
} as const;
