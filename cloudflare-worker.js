/**
 * Lark Base proxy — Cloudflare Worker (module syntax).
 *
 * Deploy: `npx wrangler deploy cloudflare-worker.js` (hoặc dán vào Workers editor).
 * Biến bí mật đặt bằng `wrangler secret put <NAME>` hoặc trong dashboard Workers:
 *   LARK_APP_ID, LARK_APP_SECRET, LARK_HOST, LARK_APP_TOKEN,
 *   TB_DS_TRADEIN, TB_DS_CONSULT, TB_DS_BACKUP, TB_CHECKIN, TB_ORDERS, TB_TX_CONSULT
 *
 * Dashboard trỏ vào:  API URL = https://<worker>.workers.dev/api/lark
 * (Worker lấy tên bảng ở segment cuối, nên /api/lark/<table> hay /<table> đều được.)
 */
const TABLE_ENV = {
  dsTradein: 'TB_DS_TRADEIN',
  dsConsult: 'TB_DS_CONSULT',
  dsBackup: 'TB_DS_BACKUP',
  checkin: 'TB_CHECKIN',
  orders: 'TB_ORDERS',
  txConsult: 'TB_TX_CONSULT',
};

let cachedToken = null;
let tokenExpiresAt = 0;

async function getToken(env, host) {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;
  const r = await fetch(`${host}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: env.LARK_APP_ID, app_secret: env.LARK_APP_SECRET }),
  });
  const j = await r.json();
  if (j.code !== 0) throw new Error(`token error: ${j.msg} (code ${j.code})`);
  cachedToken = j.tenant_access_token;
  tokenExpiresAt = Date.now() + (j.expire - 120) * 1000;
  return cachedToken;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    const table = new URL(request.url).pathname.split('/').filter(Boolean).pop();
    const host = (env.LARK_HOST || 'https://open.larksuite.com').replace(/\/+$/, '');
    const tableId = env[TABLE_ENV[table]];

    if (!tableId) return json({ code: 0, msg: 'success', data: { items: [], has_more: false, total: 0 } });

    try {
      const token = await getToken(env, host);
      let items = [];
      let pageToken;
      do {
        const u = new URL(`${host}/open-apis/bitable/v1/apps/${env.LARK_APP_TOKEN}/tables/${tableId}/records`);
        u.searchParams.set('page_size', '500');
        if (pageToken) u.searchParams.set('page_token', pageToken);
        const r = await fetch(u, { headers: { Authorization: `Bearer ${token}` } });
        const jj = await r.json();
        if (jj.code !== 0) return json(jj);
        items = items.concat(jj.data?.items ?? []);
        pageToken = jj.data?.has_more ? jj.data.page_token : null;
      } while (pageToken);

      return json({ code: 0, msg: 'success', data: { items, has_more: false, total: items.length } });
    } catch (e) {
      return json({ code: -1, msg: String(e?.message || e), data: { items: [] } }, 500);
    }
  },
};
