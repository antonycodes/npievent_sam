/**
 * SettingsPage — connect the dashboard to a real Lark Base at runtime.
 *
 * Enter the connection keys (proxy URL, or app token + table ids + access token)
 * and map each Lark column name to the corresponding web field. Settings are
 * saved to localStorage and applied immediately (the dashboard re-syncs).
 */
import { useMemo, useState } from 'react';
import {
  CHECKIN_LABELS,
  DS_FIELD_LABELS,
  DS_STATUS_LABELS,
  TABLE_LABELS,
  TX_FIELD_LABELS,
  defaultSettings,
  larkSettingsStore,
  toFieldConfig,
  toRuntimeConfig,
  useLarkSettings,
  type ConnMode,
  type LarkSettings,
} from '@/config/larkSettings';
import type { CheckinFieldMap, DsFieldMap, DsStatusFieldMap, TxFieldMap } from '@/config/larkConfig';
import { fetchLarkData } from '@/services/larkService';
import { mapDeskStates } from '@/services/larkMapper';
import type { TableKey } from '@/services/larkTypes';

const clone = (s: LarkSettings): LarkSettings => JSON.parse(JSON.stringify(s));

type TestResult = { ok: true; desks: number; checkIn: number; orders: number } | { ok: false; msg: string };

export default function SettingsPage() {
  const saved = useLarkSettings();
  const [draft, setDraft] = useState<LarkSettings>(() => clone(saved));
  const [savedTick, setSavedTick] = useState(false);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<TestResult | null>(null);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);

  const setTop = <K extends keyof LarkSettings>(k: K, v: LarkSettings[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const setTableId = (key: TableKey, v: string) =>
    setDraft((d) => ({ ...d, tableIds: { ...d.tableIds, [key]: v } }));

  const setDsField = (table: 'dsTradein' | 'dsConsult', k: keyof DsFieldMap, v: string) =>
    setDraft((d) => ({ ...d, fields: { ...d.fields, [table]: { ...d.fields[table], [k]: v } } }));

  const setStatusField = (k: keyof DsStatusFieldMap, v: string) =>
    setDraft((d) => ({ ...d, fields: { ...d.fields, dsStatus: { ...d.fields.dsStatus, [k]: v } } }));

  const setCheckinField = (k: keyof CheckinFieldMap, v: string) =>
    setDraft((d) => ({ ...d, fields: { ...d.fields, checkin: { ...d.fields.checkin, [k]: v } } }));

  const setTxField = (k: keyof TxFieldMap, v: string) =>
    setDraft((d) => ({ ...d, fields: { ...d.fields, txConsult: { ...d.fields.txConsult, [k]: v } } }));

  const save = () => {
    larkSettingsStore.save(clone(draft));
    setSavedTick(true);
    setTimeout(() => setSavedTick(false), 1500);
  };

  const resetDefaults = () => setDraft(defaultSettings());

  const runTest = async () => {
    setTesting(true);
    setTest(null);
    try {
      const cfg = toRuntimeConfig({ ...draft, useMock: false });
      const tables = await fetchLarkData(cfg);
      const mapped = mapDeskStates(tables, toFieldConfig(draft));
      setTest({
        ok: true,
        desks: Object.keys(mapped.statesById).length,
        checkIn: mapped.totalCheckIn,
        orders: mapped.totalRegistered,
      });
    } catch (e) {
      setTest({ ok: false, msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setTesting(false);
    }
  };

  const DS_TABLES: Array<['dsTradein' | 'dsConsult', string]> = [
    ['dsTradein', 'DS Kỹ thuật (bảng Lark "Thu cũ" cũ)'],
    ['dsConsult', 'DS Tư vấn'],
  ];

  return (
    <div className="min-h-full bg-neutral-100 text-neutral-800">
      <header className="border-b border-neutral-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Cài đặt · Kết nối Lark Base</h1>
            <p className="text-sm text-neutral-500">
              Nhập key kết nối và ánh xạ tên cột Lark ↔ trường trong web để đồng bộ dữ liệu.
            </p>
          </div>
          <a
            href="#/"
            className="rounded border border-neutral-300 px-3 py-1 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
          >
            ← Về sơ đồ
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-6 py-6">
        {/* Nguồn dữ liệu */}
        <Section title="1 · Nguồn dữ liệu">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="src"
              checked={draft.useMock}
              onChange={() => setTop('useMock', true)}
            />
            <span>Mock (dữ liệu mẫu, không cần Lark)</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="src"
              checked={!draft.useMock}
              onChange={() => setTop('useMock', false)}
            />
            <span>Lark Base (dữ liệu thật, tự làm mới)</span>
          </label>
        </Section>

        {/* Kết nối */}
        <Section title="2 · Kết nối Lark" disabled={draft.useMock}>
          <div className="flex flex-wrap gap-4">
            <ModeRadio mode={draft.mode} value="proxy" onPick={(m) => setTop('mode', m)}>
              Proxy / Webhook (khuyến nghị)
            </ModeRadio>
            <ModeRadio mode={draft.mode} value="direct" onPick={(m) => setTop('mode', m)}>
              Direct API
            </ModeRadio>
          </div>

          {draft.mode === 'proxy' ? (
            <Input
              label="API URL (proxy)"
              placeholder="https://proxy-cua-ban/api/lark"
              value={draft.apiUrl}
              onChange={(v) => setTop('apiUrl', v)}
              hint="Client gọi {URL}/dsTradein, /dsConsult, /checkin, /orders"
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Host" value={draft.host} onChange={(v) => setTop('host', v)} />
              <Input label="App Token" value={draft.appToken} onChange={(v) => setTop('appToken', v)} />
              <Input
                label="Access Token (Bearer)"
                value={draft.accessToken}
                onChange={(v) => setTop('accessToken', v)}
              />
            </div>
          )}

          <Input
            label="Chu kỳ làm mới (giây)"
            type="number"
            value={String(draft.pollSeconds)}
            onChange={(v) => setTop('pollSeconds', Math.max(5, Number(v) || 30))}
          />

          {draft.mode === 'direct' && (
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(TABLE_LABELS) as TableKey[]).map((k) => (
                <Input
                  key={k}
                  label={`Table ID · ${TABLE_LABELS[k]}`}
                  value={draft.tableIds[k] ?? ''}
                  onChange={(v) => setTableId(k, v)}
                />
              ))}
            </div>
          )}
        </Section>

        {/* Ánh xạ trường */}
        <Section title="3 · Ánh xạ trường (tên cột Lark → trường web)">
          <p className="text-xs text-neutral-500">
            Điền đúng <b>tên cột hiển thị</b> trong Lark cho từng trường. Để trống = dùng mặc định.
          </p>

          {DS_TABLES.map(([table, label]) => (
            <MapBlock key={table} title={label}>
              {(Object.keys(DS_FIELD_LABELS) as Array<keyof DsFieldMap>).map((k) => (
                <Input
                  key={k}
                  label={DS_FIELD_LABELS[k]}
                  value={draft.fields[table][k]}
                  onChange={(v) => setDsField(table, k, v)}
                />
              ))}
            </MapBlock>
          ))}

          <MapBlock title="Khối Status (chung 3 bảng DS)">
            {(Object.keys(DS_STATUS_LABELS) as Array<keyof DsStatusFieldMap>).map((k) => (
              <Input
                key={k}
                label={DS_STATUS_LABELS[k]}
                value={draft.fields.dsStatus[k]}
                onChange={(v) => setStatusField(k, v)}
              />
            ))}
          </MapBlock>

          <MapBlock title="Check in">
            {(Object.keys(CHECKIN_LABELS) as Array<keyof CheckinFieldMap>).map((k) => (
              <Input
                key={k}
                label={CHECKIN_LABELS[k]}
                value={draft.fields.checkin[k]}
                onChange={(v) => setCheckinField(k, v)}
              />
            ))}
          </MapBlock>

          <MapBlock title="Giao dịch Tư vấn (chấm STT khách tiếp nhận)">
            {(Object.keys(TX_FIELD_LABELS) as Array<keyof TxFieldMap>).map((k) => (
              <Input
                key={k}
                label={TX_FIELD_LABELS[k]}
                value={draft.fields.txConsult[k]}
                onChange={(v) => setTxField(k, v)}
              />
            ))}
          </MapBlock>
        </Section>

        {/* Actions */}
        <div className="sticky bottom-0 flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 bg-white/95 p-3 shadow-sm backdrop-blur">
          <button
            type="button"
            onClick={save}
            disabled={!dirty}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-40"
          >
            Lưu &amp; đồng bộ
          </button>
          <button
            type="button"
            onClick={runTest}
            disabled={draft.useMock || testing}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
          >
            {testing ? 'Đang kiểm tra…' : 'Kiểm tra kết nối'}
          </button>
          <button
            type="button"
            onClick={resetDefaults}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Khôi phục mặc định
          </button>

          {savedTick && <span className="text-sm font-medium text-emerald-600">✓ Đã lưu</span>}
          {test?.ok && (
            <span className="text-sm text-emerald-700">
              ✓ OK — {test.desks} bàn · {test.checkIn} check-in · {test.orders} đơn
            </span>
          )}
          {test && !test.ok && (
            <span className="max-w-md truncate text-sm text-red-600" title={test.msg}>
              ✗ {test.msg}
            </span>
          )}
        </div>
      </main>
    </div>
  );
}

function Section({ title, disabled, children }: { title: string; disabled?: boolean; children: React.ReactNode }) {
  return (
    <section className={`rounded-xl border border-neutral-200 bg-white p-4 shadow-sm ${disabled ? 'opacity-50' : ''}`}>
      <h2 className="mb-3 font-bold text-neutral-800">{title}</h2>
      <fieldset disabled={disabled} className="space-y-3">
        {children}
      </fieldset>
    </section>
  );
}

function MapBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{title}</div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  hint,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-neutral-500">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-neutral-300 px-2 py-1.5 text-sm focus:border-brand focus:outline-none"
      />
      {hint && <span className="text-[10px] text-neutral-400">{hint}</span>}
    </label>
  );
}

function ModeRadio({
  mode,
  value,
  onPick,
  children,
}: {
  mode: ConnMode;
  value: ConnMode;
  onPick: (m: ConnMode) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="radio" name="mode" checked={mode === value} onChange={() => onPick(value)} />
      <span>{children}</span>
    </label>
  );
}
