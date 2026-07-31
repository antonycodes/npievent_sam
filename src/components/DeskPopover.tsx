/**
 * DeskPopover — detail card anchored at a clicked desk.
 *
 * Shows staff + the active customer's info for the coordinator:
 * Tên NV, STT Khách, Tên sản phẩm (SP 1), Ghi chú thanh toán, plus occupancy
 * and waiting count. Flips above/below by vertical position, clamps near edges,
 * and closes on the × button or Escape.
 */
import { useEffect } from 'react';
import { CLUSTER_LABELS } from '@/config/layoutConfig';
import { DESK_CAPACITY, deskUiStatus, type DeskData } from '@/types/desk';

interface DeskPopoverProps {
  desk: DeskData;
  onClose: () => void;
}

const STATUS_TEXT = {
  occupied: { label: 'Đang tiếp nhận', cls: 'bg-occupied' },
  available: { label: 'Trống', cls: 'bg-vacant' },
} as const;

function translateX(x: number): string {
  if (x < 20) return '-15%';
  if (x > 80) return '-85%';
  return '-50%';
}

export default function DeskPopover({ desk, onClose }: DeskPopoverProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const { x, y, label, cluster } = desk;
  const status = deskUiStatus(desk);
  const st = STATUS_TEXT[status];
  const below = y < 35;
  const transform = below
    ? `translate(${translateX(x)}, 16px)`
    : `translate(${translateX(x)}, calc(-100% - 16px))`;

  return (
    <div
      className="absolute z-40"
      style={{ left: `${x}%`, top: `${y}%`, transform }}
      role="dialog"
      aria-label={`Thông tin bàn ${label}`}
    >
      <div className="w-64 rounded-lg border border-neutral-200 bg-white p-3 shadow-xl">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">
              {CLUSTER_LABELS[cluster]}
            </div>
            <div className="text-sm font-bold text-neutral-800">Bàn {label}</div>
          </div>
          {/* Trạng thái + nút đóng nằm cùng hàng để không đè lên nhau. */}
          <div className="flex shrink-0 items-center gap-1">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold text-white ${st.cls}`}>
              {st.label}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-lg leading-none text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            >
              ×
            </button>
          </div>
        </div>

        <dl className="space-y-1.5 text-sm">
          <Row label="Tên NV" value={desk.staffName} />
          <Row label="Trạng thái" value={desk.currentStatus} />
          {status === 'occupied' ? (
            <>
              {(desk.receivedCustomers?.length ?? 0) > 0 ? (
                <div>
                  <div className="mb-1 text-neutral-500">
                    Khách đang tiếp nhận ({desk.receivedCustomers!.length}/{DESK_CAPACITY[cluster]})
                  </div>
                  <ul className="space-y-1">
                    {desk.receivedCustomers!.map((c, i) => (
                      <li key={i} className="flex items-center justify-between gap-2">
                        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white">
                          {c.stt ?? '•'}
                        </span>
                        <span
                          className={`flex-1 text-right ${c.deviceAccepted ? 'font-bold text-red-600' : 'font-medium text-neutral-800'}`}
                        >
                          {c.name ?? '—'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <>
                  <Row label="STT Khách" value={desk.customerSTT} />
                  <Row
                    label="Check thu máy cũ"
                    value={desk.deviceAccepted ? 'Đã nghiệm thu' : 'Chưa nghiệm thu'}
                    tone={desk.deviceAccepted ? 'red' : undefined}
                  />
                </>
              )}
              <Row label="Tên sản phẩm" value={desk.productName} />
              <Row label="Ghi chú thanh toán" value={desk.paymentNote} />
            </>
          ) : (
            <div className="pt-1 text-xs italic text-neutral-400">
              Bàn trống — chưa có thông tin khách.
            </div>
          )}
          {(desk.waiting ?? 0) > 0 && (
            <Row label="Khách đang chờ" value={String(desk.waiting)} tone="amber" />
          )}
        </dl>

      </div>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | null | undefined;
  tone?: 'amber' | 'red';
}) {
  const cls =
    tone === 'red' ? 'font-bold text-red-600' : tone === 'amber' ? 'font-medium text-amber-600' : 'font-medium text-neutral-800';
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-neutral-500">{label}</dt>
      <dd className={`text-right ${cls}`}>{value && value.trim() ? value : '—'}</dd>
    </div>
  );
}
