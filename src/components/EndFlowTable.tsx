/**
 * EndFlowTable — modal liệt kê toàn bộ khách đã hoàn tất toàn bộ quy trình
 * (Check-in "End flow" = "End flow"), dạng bảng thay vì chấm STT trên board.
 * Mở từ nút "End Flow" ở khu vực Lọc nhanh.
 */
import { useEffect } from 'react';
import type { WaitingCustomer } from '@/types/desk';

interface EndFlowTableProps {
  customers: WaitingCustomer[];
  onClose: () => void;
}

export default function EndFlowTable({ customers, onClose }: EndFlowTableProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-label="End Flow"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-3xl overflow-auto rounded-xl bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-neutral-800">
            End Flow — Đã hoàn tất toàn bộ ({customers.length})
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-lg leading-none text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            ×
          </button>
        </div>

        {customers.length === 0 ? (
          <p className="py-8 text-center text-sm italic text-neutral-400">
            Chưa có khách nào hoàn tất toàn bộ quy trình.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  <th className="py-2 pr-3">STT</th>
                  <th className="py-2 pr-3">Họ và tên</th>
                  <th className="py-2 pr-3">Tên sản phẩm</th>
                  <th className="py-2 pr-3">Ghi chú thanh toán</th>
                  <th className="py-2 pr-3">Check thu máy cũ</th>
                  <th className="py-2">Khâu cuối</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c, i) => (
                  <tr key={i} className="border-b border-neutral-100 last:border-0">
                    <td className="py-2 pr-3 font-semibold text-neutral-800">{c.stt ?? '—'}</td>
                    <td className="py-2 pr-3 font-medium text-neutral-800">{c.name ?? '—'}</td>
                    <td className="py-2 pr-3 text-neutral-600">{c.productName ?? '—'}</td>
                    <td className="py-2 pr-3 text-neutral-600">{c.paymentNote ?? '—'}</td>
                    <td className={`py-2 pr-3 ${c.deviceAccepted ? 'font-bold text-red-600' : 'text-neutral-600'}`}>
                      {c.deviceAccepted ? 'Đã nghiệm thu' : 'Chưa nghiệm thu'}
                    </td>
                    <td className="py-2 text-neutral-600">{c.doneInFlow ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
