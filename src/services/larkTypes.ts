/**
 * Lark Base (Bitable) wire-format types.
 *
 * The list-records endpoint returns
 *   { code, msg, data: { items: LarkRecord[], has_more, page_token, total } }
 * Each record has a `record_id` and a `fields` object keyed by the column's
 * display name. Cell values vary by field type — string, number, boolean, an
 * array of rich-text segments (formula/text fields, e.g. "Done in Flow" →
 * `[{text: "Tư vấn", type: "text"}]`), an array of bare strings (link/lookup
 * fields, e.g. "TV_Nsư Tư vấn" → `["optxXl70bv"]`, no `.text` wrapper), OR an
 * array of person objects (a "person" link field, e.g. "NV Tư vấn" →
 * `[{id, name, email, avatar_url}]`, no `.text`, use `.name`) — the mapper
 * coerces all three shapes.
 */
export interface LarkTextSegment {
  text?: string;
  /** Person/link field (vd "Nhân viên") không có `.text` — dùng tên hiển thị này thay. */
  name?: string;
  type?: string;
}

export type LarkCellValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Array<LarkTextSegment | string>;

export interface LarkRecord {
  record_id: string;
  fields: Record<string, LarkCellValue>;
}

export interface LarkListResponse {
  code: number;
  msg: string;
  data: {
    items: LarkRecord[];
    has_more: boolean;
    page_token?: string;
    total: number;
  };
}

/**
 * The four logical tables the dashboard reads: the 2 DS registries (status +
 * staff + latest customer — `dsTradein` now feeds the "Kỹ thuật" cluster,
 * table name unchanged), Check in (checked-in customers), and Orders
 * ("Danh sách đơn hàng" — total registered, for the check-in funnel).
 */
export type TableKey =
  | 'dsTradein'
  | 'dsConsult'
  | 'checkin'
  | 'orders'
  | 'txConsult'; // bảng giao dịch Tư vấn — danh sách khách "Tiếp nhận" theo bàn

/** Raw records for every table, as returned by the service. */
export type LarkTables = Record<TableKey, LarkRecord[]>;
