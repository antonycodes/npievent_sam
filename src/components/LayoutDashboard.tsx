/**
 * LayoutDashboard — the interactive floor-plan board.
 *
 * Renders a 16:9 stage mirroring the new KT/Tư vấn floor-plan reference: 2
 * dashed zone boxes (Khu vực kỹ thuật, Khu vực tư vấn) as a backdrop, plus the
 * 9 interactive desks (driven by the `desks` array) with a few purely
 * decorative "customer" dots echoing the reference image, plus 1 merged
 * waiting-area box (khách nhận STT và đợi) on the right for customers not yet
 * assigned to a desk. "End Flow" (đã hoàn tất toàn bộ) is a separate table
 * view, not a board zone — see EndFlowTable, opened from a button in FilterBar.
 */
import { deskUiStatus, type DeskData, type WaitingCustomer } from '@/types/desk';
import Desk from './Desk';

/** Khu vực chờ ngoài bàn (dùng để phân biệt khi bấm 1 chấm STT). */
export type WaitingZoneKey = 'checkin' | 'dispatch';

/**
 * Toạ độ neo (giữa hộp, %) — dùng chung cho popover ở DashboardPage. Cả 2 khu
 * giờ dùng chung 1 hộp hiển thị (xem `WaitingZone` bên dưới) nên trỏ về cùng
 * 1 điểm neo, gần đáy hộp để popover (luôn bung lên trên) có đủ chỗ.
 */
export const WAITING_ZONE_ANCHOR: Record<WaitingZoneKey, { x: number; y: number }> = {
  checkin: { x: 80, y: 90 },
  dispatch: { x: 80, y: 90 },
};

interface LayoutDashboardProps {
  desks: DeskData[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** Bấm 1 chấm STT khách (deskId + vị trí trong receivedCustomers). */
  onSelectCustomer?: (deskId: string, index: number) => void;
  /** Chấm khách đang chọn (viền nổi bật). */
  selectedCustomer?: { deskId: string; index: number } | null;
  /** Đã check-in (có STT), chưa từng vào bàn nào — chờ điều phối lần đầu. */
  waitingCheckin?: WaitingCustomer[];
  /** Vừa hoàn tất 1 cụm, bàn đang rảnh — chờ điều phối sang cụm tiếp theo. */
  waitingDispatch?: WaitingCustomer[];
  /** Bấm 1 chấm STT ở khu vực chờ (zone + vị trí trong mảng tương ứng). */
  onSelectWaiting?: (zone: WaitingZoneKey, index: number) => void;
  /** Chấm khách chờ đang chọn (viền nổi bật). */
  selectedWaiting?: { zone: WaitingZoneKey; index: number } | null;
  /** Ids to fade out (filtered) — dimmed and non-interactive. */
  dimmedIds?: Set<string>;
  /** Optional overlay (e.g. the popover) drawn on top of the board. */
  overlay?: React.ReactNode;
}

/**
 * Số chấm STT hiển thị tối đa dưới 1 node — phần dư gộp thành "+n".
 * Bằng DESK_CAPACITY (2 khách/NV) nên bình thường không bao giờ bị gộp; giới hạn
 * này giữ cho hàng chấm luôn hẹp hơn khoảng cách giữa 2 bàn cạnh nhau, kể cả khi
 * dữ liệu Lark trả về nhiều khách bất thường trên cùng 1 bàn.
 */
const MAX_DESK_DOTS = 2;

/** Khung nét đứt cho 1 khu vực lớn (Kỹ thuật/Tư vấn) — nhãn ghim mép trên, không che các node bên trong. */
function ZoneBox({ label, className }: { label: string; className: string }) {
  return (
    <div className={`absolute rounded-lg border border-dashed border-neutral-300 ${className}`}>
      <span className="absolute left-1/2 top-[2%] -translate-x-1/2 whitespace-nowrap text-[length:var(--label-fs)] font-bold uppercase leading-none tracking-wide text-neutral-400">
        {label}
      </span>
    </div>
  );
}

/**
 * Chấm trang trí (không tương tác, không gắn dữ liệu) — biểu diễn khách đứng/
 * ngồi tại khu vực, đúng theo ảnh mẫu (đỏ = khách khu Tư vấn, xanh dương =
 * khách khu Kỹ thuật). Khác với chấm STT thật (cam) dưới mỗi bàn.
 */
function DecorDot({ x, y, className }: { x: number; y: number; className: string }) {
  return (
    <span
      className={`absolute h-[var(--dot)] w-[var(--dot)] -translate-x-1/2 -translate-y-1/2 rounded-full border shadow-sm ${className}`}
      style={{ left: `${x}%`, top: `${y}%` }}
    />
  );
}

/** 1 khách chờ, gắn kèm khu vực gốc + vị trí trong mảng đó (để bấm mở đúng popover). */
interface WaitingItem {
  zone: WaitingZoneKey;
  index: number;
  customer: WaitingCustomer;
}

/** Hộp khu vực chờ: nhãn + các chấm STT (bấm để xem chi tiết khách). */
function WaitingZone({
  label,
  items,
  className,
  selectedWaiting,
  onSelect,
}: {
  label: string;
  items: WaitingItem[];
  className: string;
  selectedWaiting?: { zone: WaitingZoneKey; index: number } | null;
  onSelect?: (zone: WaitingZoneKey, index: number) => void;
}) {
  return (
    <div
      className={`absolute flex flex-col rounded-lg border border-dashed border-amber-300 bg-amber-50/60 p-[1.5%] text-center ${className}`}
    >
      <div className="flex shrink-0 items-center justify-center gap-1 text-[length:var(--label-fs)] font-semibold uppercase leading-tight tracking-wide text-amber-700">
        <span>{label}</span>
        {items.length > 0 && (
          <span className="rounded-full bg-amber-200/80 px-1 leading-tight text-amber-800">
            {items.length}
          </span>
        )}
      </div>
      {/* Cuộn thay vì cắt cụt khi khu vực chờ đông khách. */}
      <div className="mt-[3%] flex min-h-0 flex-1 flex-wrap content-start items-start justify-center gap-[var(--dot-gap)] overflow-y-auto">
        {items.length === 0 ? (
          <span className="text-[length:var(--label-sm-fs)] italic text-neutral-400">
            Không có khách
          </span>
        ) : (
          items.map((item) => {
            const active = selectedWaiting?.zone === item.zone && selectedWaiting?.index === item.index;
            return (
              <button
                key={`${item.zone}-${item.index}`}
                type="button"
                title={`${item.customer.stt ? `#${item.customer.stt} · ` : ''}${item.customer.name ?? ''}`}
                onClick={() => onSelect?.(item.zone, item.index)}
                className={[
                  'flex h-[var(--zone-dot)] min-w-[var(--zone-dot)] shrink-0 items-center justify-center',
                  'rounded-full bg-amber-500 px-[3px] text-[length:var(--zone-dot-fs)] font-bold leading-none',
                  'text-white shadow ring-1 ring-white transition hover:scale-110',
                  active ? 'z-30 scale-110 ring-2 ring-blue-500 ring-offset-1' : '',
                ].join(' ')}
              >
                {item.customer.stt ?? '•'}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function LayoutDashboard({
  desks,
  selectedId,
  onSelect,
  onSelectCustomer,
  selectedCustomer,
  waitingCheckin = [],
  waitingDispatch = [],
  onSelectWaiting,
  selectedWaiting,
  dimmedIds,
  overlay,
}: LayoutDashboardProps) {
  const combinedWaiting: WaitingItem[] = [
    ...waitingCheckin.map((customer, index): WaitingItem => ({ zone: 'checkin', index, customer })),
    ...waitingDispatch.map((customer, index): WaitingItem => ({ zone: 'dispatch', index, customer })),
  ];

  return (
    <div className="board relative aspect-video w-full [@media(max-aspect-ratio:8/5)]:aspect-[2360/1640]">
      {/* Board visuals clip to the rounded card; popovers stay outside this
          layer (below) so they're never cut off near the board's edges. */}
      <div className="absolute inset-0 overflow-hidden rounded-xl border border-neutral-300 bg-neutral-50 shadow-inner">
        {/* ── Khu vực kỹ thuật (KT) — khung + "màn hình" trang trí + khách trang trí ── */}
        <ZoneBox label="Khu vực kỹ thuật" className="left-[24%] top-[3%] h-[39%] w-[33%]" />
        <div
          className="absolute rounded-md border border-blue-300 bg-blue-50/60"
          style={{ left: '32%', top: '23%', width: '20%', height: '8%' }}
        />
        {[34, 41, 48].map((x) => (
          <DecorDot key={`kt-cust-${x}`} x={x} y={37} className="border-blue-700 bg-blue-500" />
        ))}

        {/* ── Khu vực tư vấn — khung + khách trang trí 2 bên mỗi cặp bàn ── */}
        <ZoneBox label="Khu vực tư vấn" className="left-[1%] top-[45%] h-[53%] w-[61%]" />
        {[14, 32, 50].flatMap((gx) =>
          [gx - 7, gx + 7].flatMap((x) =>
            [55, 63, 71, 79].map((y) => (
              <DecorDot key={`tv-cust-${x}-${y}`} x={x} y={y} className="border-red-500 bg-red-400" />
            )),
          ),
        )}

        {/* ── Khu vực khách nhận STT và đợi (gộp "Đã check-in" + "Chờ điều phối") ── */}
        <WaitingZone
          label="Khách nhận STT và đợi"
          items={combinedWaiting}
          selectedWaiting={selectedWaiting}
          onSelect={onSelectWaiting}
          className="left-[64%] top-[3%] h-[92%] w-[33%]"
        />

        {/* ── Interactive desks (9) ─────────────────────────────────── */}
        {desks.map((d) => (
          <Desk
            key={d.id}
            id={d.id}
            label={d.label}
            status={deskUiStatus(d)}
            staffName={d.staffName}
            customerSTT={d.customerSTT}
            waiting={d.waiting}
            x={d.x}
            y={d.y}
            selected={selectedId === d.id}
            dimmed={dimmedIds?.has(d.id)}
            onClick={onSelect}
          />
        ))}

        {/* ── Chấm STT khách đã tiếp nhận (mọi cụm) — bấm để xem khách ──
            Luôn là 1 hàng chấm NGAY DƯỚI node (không còn badge đè lên node), đặt
            cách node đúng `--dot-offset` nên không bao giờ chồng lên nhãn bàn
            hay lên hàng bàn phía dưới. */}
        {desks.map((d) => {
          const list = d.receivedCustomers ?? [];
          if (list.length === 0) return null;
          const dim = dimmedIds?.has(d.id) ? 'pointer-events-none opacity-15' : '';
          const shown = list.slice(0, MAX_DESK_DOTS);
          const overflow = list.length - shown.length;

          return (
            <div
              key={`dots-${d.id}`}
              className={`absolute z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-[var(--dot-gap)] ${dim}`}
              style={{ left: `${d.x}%`, top: `calc(${d.y}% + var(--dot-offset))` }}
            >
              {shown.map((c, i) => {
                const active = selectedCustomer?.deskId === d.id && selectedCustomer?.index === i;
                return (
                  <button
                    key={i}
                    type="button"
                    title={`${c.stt ? `#${c.stt} · ` : ''}${c.name ?? ''}`}
                    onClick={() => onSelectCustomer?.(d.id, i)}
                    className={[
                      'flex h-[var(--dot)] min-w-[var(--dot)] shrink-0 items-center justify-center',
                      'rounded-full bg-amber-500 px-[2px] text-[length:var(--dot-fs)] font-bold leading-none',
                      'text-white shadow ring-1 ring-white transition hover:scale-125',
                      active ? 'z-30 scale-125 ring-2 ring-blue-500 ring-offset-1' : '',
                    ].join(' ')}
                  >
                    {c.stt ?? '•'}
                  </button>
                );
              })}
              {overflow > 0 && (
                <span
                  title={`Thêm ${overflow} khách — bấm vào bàn để xem đầy đủ`}
                  className="flex h-[var(--dot)] items-center justify-center rounded-full bg-amber-700 px-[3px] text-[length:var(--dot-fs)] font-bold leading-none text-white shadow ring-1 ring-white"
                >
                  +{overflow}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Overlay (popover) — outside the clipped layer above ────── */}
      {overlay}
    </div>
  );
}
