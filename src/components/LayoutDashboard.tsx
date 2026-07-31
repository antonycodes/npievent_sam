/**
 * LayoutDashboard — the interactive floor-plan board.
 *
 * Renders a 16:9 stage mirroring the new KT/Tư vấn floor-plan reference: 2
 * dashed zone boxes (Khu vực kỹ thuật, Khu vực tư vấn) as a backdrop, plus the
 * 9 interactive desks (driven by the `desks` array), plus 1 merged waiting-area
 * box (khách nhận STT và đợi) on the right for customers not yet assigned to a
 * desk. Both the waiting box and each Tư vấn desk's customer row render as a
 * FIXED grid of slots (empty ones stay visible) rather than a list that grows
 * with the data — per user feedback (2026-07-31), positions must stay stable
 * and fill left-to-right instead of reflowing. "End Flow" (đã hoàn tất toàn
 * bộ) is a separate table view, not a board zone — see EndFlowTable, opened
 * from a button in FilterBar.
 */
import { DESK_CAPACITY, deskUiStatus, type DeskCustomer, type DeskData, type WaitingCustomer } from '@/types/desk';
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
 * Cụm hiển thị các ô STT dưới bàn dạng LƯỚI CỐ ĐỊNH (đủ `DESK_CAPACITY[cluster]`
 * ô, ô trống vẫn hiện) thay vì chỉ hiện khi có khách — theo feedback: dễ thấy
 * ngay bàn đó còn bao nhiêu chỗ mà không cần đợi có khách mới xuất hiện hàng
 * chấm. Cụm khác (kythuat) giữ hành vi cũ: ẩn hẳn khi chưa có khách.
 */
const FIXED_SLOT_CLUSTERS = new Set(['consult']);

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
 * 1 ô STT — cam (có khách, bấm được) hoặc rỗng/viền chấm (chưa có khách,
 * không tương tác). `size`/`fontSize` là giá trị CSS thật (vd `'var(--dot)'`)
 * truyền qua inline style — KHÔNG ghép vào class Tailwind, vì class dựng động
 * lúc runtime (`` `h-[${x}]` ``) không được Tailwind quét thấy lúc build nên
 * sẽ không sinh CSS tương ứng.
 */
function SttSlot({
  customer,
  active,
  onClick,
  size,
  fontSize,
}: {
  customer: DeskCustomer | null;
  active?: boolean;
  onClick?: () => void;
  size: string;
  fontSize: string;
}) {
  if (!customer) {
    return (
      <span
        title="Còn trống"
        className="shrink-0 rounded-full border border-dashed border-amber-300 bg-amber-100/40"
        style={{ height: size, width: size }}
      />
    );
  }
  return (
    <button
      type="button"
      title={`${customer.stt ? `#${customer.stt} · ` : ''}${customer.name ?? ''}`}
      onClick={onClick}
      className={[
        'flex shrink-0 items-center justify-center rounded-full bg-amber-500 px-[2px] font-bold leading-none',
        'text-white shadow ring-1 ring-white transition hover:scale-125',
        active ? 'z-30 scale-125 ring-2 ring-blue-500 ring-offset-1' : '',
      ].join(' ')}
      style={{ height: size, width: size, fontSize }}
    >
      {customer.stt ?? '•'}
    </button>
  );
}

/** 1 khách chờ, gắn kèm khu vực gốc + vị trí trong mảng đó (để bấm mở đúng popover). */
interface WaitingItem {
  zone: WaitingZoneKey;
  index: number;
  customer: WaitingCustomer;
}

/** Số ô cố định trong khu "Khách nhận STT và đợi" — lưới 4 cột × 6 hàng. */
const WAITING_GRID_SIZE = 24;
const WAITING_GRID_COLS = 4;

/** Hộp khu vực chờ: lưới CỐ ĐỊNH 24 ô (ô trống vẫn hiện), điền trái→phải theo thứ tự khách. */
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
  const hasOverflow = items.length > WAITING_GRID_SIZE;
  const slotCount = WAITING_GRID_SIZE - (hasOverflow ? 1 : 0);
  const shown = items.slice(0, slotCount);
  const overflow = items.length - shown.length;

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
      <div
        className="mt-[3%] grid flex-1 content-center items-center justify-items-center gap-[8%]"
        style={{ gridTemplateColumns: `repeat(${WAITING_GRID_COLS}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: slotCount }, (_, i) => shown[i] ?? null).map((item, i) => {
          const active = Boolean(item) && selectedWaiting?.zone === item!.zone && selectedWaiting?.index === item!.index;
          return (
            <SttSlot
              key={i}
              customer={item?.customer ?? null}
              active={active}
              onClick={() => item && onSelect?.(item.zone, item.index)}
              size="var(--zone-dot)"
              fontSize="var(--zone-dot-fs)"
            />
          );
        })}
        {hasOverflow && (
          <span
            title={`Thêm ${overflow} khách`}
            className="flex h-[var(--zone-dot)] w-[var(--zone-dot)] shrink-0 items-center justify-center rounded-full bg-amber-700 px-[3px] text-[length:var(--zone-dot-fs)] font-bold leading-none text-white shadow ring-1 ring-white"
          >
            +{overflow}
          </span>
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
        {/* ── Khu vực kỹ thuật (KT) — khung gọn theo đúng 1 hàng node, không để
            trống thừa phía dưới như bản trước (cao 39% cho có 1 hàng). ── */}
        <ZoneBox label="Khu vực kỹ thuật" className="left-[4%] top-[3%] h-[21%] w-[57%]" />

        {/* ── Khu vực tư vấn — cùng khung X với Kỹ thuật (thẳng hàng), đủ cao
            cho 2 hàng bàn + chấm STT dưới mỗi bàn mà không để trống lớn giữa
            2 hàng (toạ độ hàng đã đo thật, xem layoutConfig.ts). ── */}
        <ZoneBox label="Khu vực tư vấn" className="left-[4%] top-[28%] h-[67%] w-[57%]" />

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

        {/* ── Ô STT khách đã tiếp nhận, ngay dưới mỗi bàn — bấm để xem khách ──
            Bàn Tư vấn: LƯỚI CỐ ĐỊNH đủ DESK_CAPACITY ô (ô trống vẫn hiện, điền
            trái→phải theo thứ tự check-in). Cụm khác: chỉ hiện khi có khách,
            như cũ. Đặt cách node đúng `--dot-offset` nên không chồng lên nhãn
            bàn hay hàng bàn phía dưới. */}
        {desks.map((d) => {
          const list = d.receivedCustomers ?? [];
          const fixedSlots = FIXED_SLOT_CLUSTERS.has(d.cluster);
          if (!fixedSlots && list.length === 0) return null;

          const dim = dimmedIds?.has(d.id) ? 'pointer-events-none opacity-15' : '';
          const cap = DESK_CAPACITY[d.cluster];
          const shown = list.slice(0, cap);
          const overflow = list.length - shown.length;
          const slots: Array<DeskCustomer | null> = fixedSlots
            ? Array.from({ length: cap }, (_, i) => shown[i] ?? null)
            : shown;

          return (
            <div
              key={`dots-${d.id}`}
              className={`absolute z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-[var(--dot-gap)] ${dim}`}
              style={{ left: `${d.x}%`, top: `calc(${d.y}% + var(--dot-offset))` }}
            >
              {slots.map((c, i) => {
                const active = Boolean(c) && selectedCustomer?.deskId === d.id && selectedCustomer?.index === i;
                return (
                  <SttSlot
                    key={i}
                    customer={c}
                    active={active}
                    onClick={() => onSelectCustomer?.(d.id, i)}
                    size="var(--dot)"
                    fontSize="var(--dot-fs)"
                  />
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
