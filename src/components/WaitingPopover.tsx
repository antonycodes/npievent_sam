/**
 * WaitingPopover — thông tin 1 khách đang ở khu vực chờ ngoài bàn (chưa gán
 * vào bàn cụ thể): "Chờ check-in" hoặc "Chờ điều phối".
 *
 * Cùng phong cách với `CustomerPopover` nhưng neo theo toạ độ khu vực chờ
 * (cố định, không phải toạ độ bàn) và luôn bung lên phía trên vì cả 2 khu vực
 * nằm sát mép dưới board.
 */
import { useEffect } from 'react';
import type { WaitingZoneKey } from '@/components/LayoutDashboard';
import type { ClusterKey, WaitingCustomer } from '@/types/desk';

interface WaitingPopoverProps {
  zoneLabel: string;
  zone: WaitingZoneKey;
  customer: WaitingCustomer;
  x: number;
  y: number;
  onClose: () => void;
}

/** Fallback nếu Check-in chưa có "Done in Flow" — suy từ cụm vừa hoàn tất. */
const STAGE_NAME: Record<ClusterKey, string> = {
  kythuat: 'Kỹ thuật',
  consult: 'Tư vấn',
};

/** "Done in Flow" cũng dùng giá trị này cho khách chưa xong khâu nào — không tính là tên khâu. */
const NOT_A_STAGE = 'check in';

function statusTextFor(zone: WaitingZoneKey, customer: WaitingCustomer): string {
  if (zone === 'checkin') return 'Đã check-in — chờ điều phối vào bàn';
  const doneInFlow = customer.doneInFlow?.trim().toLowerCase() === NOT_A_STAGE ? null : customer.doneInFlow;
  const stage = doneInFlow || (customer.fromCluster ? STAGE_NAME[customer.fromCluster] : null);
  return stage ? `Đã hoàn tất "Khâu ${stage}"` : 'Đã hoàn tất 1 khâu — chờ điều phối';
}

function translateX(x: number): string {
  if (x < 20) return '-5%';
  if (x > 80) return '-95%';
  return '-50%';
}

/**
 * "Thu cũ check" là single-select — số lựa chọn tuỳ event (vd "Không thu cũ" /
 * "Có thu cũ" / "Thu cũ sau", có thể đổi trong Lark) nên tô màu theo TỪ KHOÁ
 * trong nhãn thay vì so khớp cứng 1 chuỗi cố định.
 */
function oldDeviceCheckTone(value: string | null | undefined): 'red' | 'amber' | undefined {
  const s = value?.toLowerCase() ?? '';
  if (!s || s.includes('không')) return undefined;
  if (s.includes('sau')) return 'amber';
  if (s.includes('có')) return 'red';
  return undefined;
}

export default function WaitingPopover({ zoneLabel, zone, customer, x, y, onClose }: WaitingPopoverProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="absolute z-50"
      style={{ left: `${x}%`, top: `${y}%`, transform: `translate(${translateX(x)}, calc(-100% - 10px))` }}
      role="dialog"
      aria-label={`Khách STT ${customer.stt ?? ''}`}
    >
      <div className="w-60 rounded-lg border border-amber-300 bg-white p-3 shadow-xl">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-bold text-white">
              {customer.stt ?? '•'}
            </span>
            <div className="text-sm font-bold text-neutral-800">{customer.name ?? 'Khách'}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="flex h-7 w-7 items-center justify-center rounded text-lg leading-none text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            ×
          </button>
        </div>

        <dl className="space-y-1.5 text-sm">
          <Row label="Khu vực" value={zoneLabel} />
          <Row label="Trạng thái" value={statusTextFor(zone, customer)} />
          <Row label="Tên sản phẩm" value={customer.productName ?? null} />
          <Row label="Ghi chú thanh toán" value={customer.paymentNote ?? null} />
          <Row
            label="Check thu máy cũ"
            value={customer.deviceAccepted ? 'Đã nghiệm thu' : 'Chưa nghiệm thu'}
            tone={customer.deviceAccepted ? 'red' : undefined}
          />
          <Row
            label="Thu cũ check"
            value={customer.oldDeviceCheck ?? null}
            tone={oldDeviceCheckTone(customer.oldDeviceCheck)}
          />
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
  tone?: 'red' | 'amber';
}) {
  const cls =
    tone === 'red' ? 'font-bold text-red-600' : tone === 'amber' ? 'font-semibold text-amber-600' : 'font-medium text-neutral-800';
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-neutral-500">{label}</dt>
      <dd className={`text-right ${cls}`}>{value && value.trim() ? value : '—'}</dd>
    </div>
  );
}
