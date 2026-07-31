/**
 * FilterBar — quick focus toggles for the coordinator.
 *
 * Non-matching desks are dimmed (not removed) so spatial context is kept.
 */
export interface DeskFilters {
  onlyVacant: boolean;
  onlyKythuat: boolean;
  onlyDeviceAccepted: boolean;
}

interface FilterBarProps {
  filters: DeskFilters;
  onChange: (next: DeskFilters) => void;
  /** Số khách đã "End flow" — hiện badge trên nút. */
  endFlowCount: number;
  /** Bảng End Flow đang mở hay không (viền nổi bật khi mở). */
  endFlowOpen: boolean;
  onToggleEndFlow: () => void;
}

export default function FilterBar({ filters, onChange, endFlowCount, endFlowOpen, onToggleEndFlow }: FilterBarProps) {
  const toggle = (key: keyof DeskFilters) =>
    onChange({ ...filters, [key]: !filters[key] });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">
        Lọc nhanh
      </span>
      <Chip active={filters.onlyVacant} onClick={() => toggle('onlyVacant')}>
        Chỉ hiện bàn trống
      </Chip>
      <Chip active={filters.onlyKythuat} onClick={() => toggle('onlyKythuat')}>
        Chỉ hiện bàn KT
      </Chip>
      <Chip active={filters.onlyDeviceAccepted} onClick={() => toggle('onlyDeviceAccepted')}>
        Chỉ hiện đã thu thiết bị
      </Chip>
      <Chip active={endFlowOpen} onClick={onToggleEndFlow}>
        End Flow{endFlowCount > 0 ? ` (${endFlowCount})` : ''}
      </Chip>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        // min-h-8 keeps the chips comfortably tappable on a tablet.
        'flex min-h-8 items-center rounded-full border px-3 text-xs font-medium transition',
        active
          ? 'border-brand bg-brand text-white shadow-sm'
          : 'border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
