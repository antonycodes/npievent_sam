/**
 * larkClient — HTTPS access to a single Lark Bitable table's records.
 *
 * Modes:
 *   1. Proxy/webhook: GET `${apiUrl}/${tableKey}` → Lark list-records JSON.
 *   2. Direct: GET the canonical Bitable URL for `appToken` + `tableIds[key]`.
 */
import type { LarkRuntimeConfig } from '@/config/larkConfig';
import type { LarkListResponse, LarkRecord, TableKey } from './larkTypes';

export class LarkApiError extends Error {
  constructor(message: string, readonly code?: number) {
    super(message);
    this.name = 'LarkApiError';
  }
}

export function buildTableUrl(cfg: LarkRuntimeConfig, key: TableKey): string {
  if (cfg.apiUrl) return `${cfg.apiUrl.replace(/\/+$/, '')}/${key}`;
  const tableId = cfg.tableIds[key];
  if (cfg.appToken && tableId) {
    const host = cfg.host.replace(/\/+$/, '');
    return (
      `${host}/open-apis/bitable/v1/apps/${encodeURIComponent(cfg.appToken)}` +
      `/tables/${encodeURIComponent(tableId)}/records?page_size=500`
    );
  }
  throw new LarkApiError(`Chưa cấu hình nguồn cho bảng "${key}" (cần API URL, hoặc App Token + Table ID).`);
}

/** Fetch + validate one table's records over HTTPS. */
export async function fetchTableRecords(
  cfg: LarkRuntimeConfig,
  key: TableKey,
  signal?: AbortSignal,
): Promise<LarkRecord[]> {
  const url = buildTableUrl(cfg, key);
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (cfg.accessToken) headers.Authorization = `Bearer ${cfg.accessToken}`;

  const res = await fetch(url, { headers, signal });
  if (!res.ok) throw new LarkApiError(`Lark HTTP ${res.status} ${res.statusText} (${key})`, res.status);

  const body = (await res.json()) as LarkListResponse;
  if (body.code !== 0) throw new LarkApiError(`Lark API error on ${key}: ${body.msg} (code ${body.code})`, body.code);
  return body.data?.items ?? [];
}
