/**
 * CustomerPopover — thông tin 1 khách khi bấm vào chấm STT.
 *
 * Neo ngay dưới bàn (nơi có các chấm), tự kẹp mép trái/phải, đóng bằng ×/Escape.
 */
import { useEffect } from 'react';
import { CLUSTER_LABELS } from '@/config/layoutConfig';
import type { DeskCustomer, DeskData } from '@/types/desk';

interface CustomerPopoverProps {
  desk: DeskData;
  customer: DeskCustomer;
  onClose: () => void;
}

function translateX(x: number): string {
  if (x < 20) return '-15%';
  if (x > 80) return '-85%';
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

export default function CustomerPopover({ desk, customer, onClose }: CustomerPopoverProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const { x, y, label, cluster, staffName } = desk;
  // Bung xuống dưới chấm STT như trước; nhưng nếu bàn đã ở nửa dưới board thì
  // bung lên trên bàn để card (giờ dài hơn, có thêm dòng "Check thu máy cũ")
  // không bị cắt bởi mép dưới board (overflow-hidden).
  const below = y < 45;
  const transform = below
    ? `translate(${translateX(x)}, 40px)`
    : `translate(${translateX(x)}, calc(-100% - 16px))`;

  return (
    <div
      className="absolute z-50"
      style={{ left: `${x}%`, top: `${y}%`, transform }}
      role="dialog"
      aria-label={`Khách STT ${customer.stt ?? ''}`}
    >
      <div className="w-60 rounded-lg border border-amber-300 bg-white p-3 shadow-xl">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-bold text-white">
              {customer.stt ?? '•'}
            </span>
            <div className="text-sm font-bold text-neutral-800">
              {customer.name ?? 'Khách'}
            </div>
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
          <Row label="Vị trí" value={`${CLUSTER_LABELS[cluster]} · ${label}`} />
          <Row label="Nhân viên" value={staffName ?? null} />
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
