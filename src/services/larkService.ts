/**
 * larkService — fetch every table the dashboard needs, in parallel.
 *
 * `fetchLarkData` returns the raw records for the 4 core logical tables (2 DS
 * registries + Check in + Orders), plus `txConsult` when configured. In mock
 * mode it returns the bundled workbook fixtures instead of hitting the network.
 */
import type { LarkRuntimeConfig } from '@/config/larkConfig';
import { toRuntimeConfig } from '@/config/larkSettings';
import { mockLarkTables } from '@/data/mockLarkData';
import { fetchTableRecords } from './larkClient';
import type { LarkTables, TableKey } from './larkTypes';

/** Bảng bắt buộc. `txConsult` là tùy chọn (chỉ fetch khi có nguồn). */
const CORE_KEYS: TableKey[] = ['dsTradein', 'dsConsult', 'checkin', 'orders'];

export async function fetchLarkData(
  cfg: LarkRuntimeConfig = toRuntimeConfig(),
  signal?: AbortSignal,
): Promise<LarkTables> {
  if (cfg.useMock) return mockLarkTables;

  const keys = [...CORE_KEYS];
  // Proxy phục vụ mọi tableKey; direct cần table id riêng.
  if (cfg.apiUrl || cfg.tableIds.txConsult) keys.push('txConsult');

  const result: LarkTables = {
    dsTradein: [],
    dsConsult: [],
    checkin: [],
    orders: [],
    txConsult: [],
  };
  await Promise.all(
    keys.map(async (key) => {
      result[key] = await fetchTableRecords(cfg, key, signal);
    }),
  );
  return result;
}
