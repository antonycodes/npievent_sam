/**
 * Desk — a single interactive desk node on the floor map.
 *
 * Props follow the spec: `id`, `label`, `status`, `staffName`, `customerSTT`
 * (+ `waiting` bottleneck count and selection/click handlers). Color:
 *   occupied → red, available → green (kể cả khi Lark chưa có dữ liệu). Every
 *   desk is a circle now (KT and TV no longer have different shapes).
 */
import type { DeskUiStatus } from '@/types/desk';

export interface DeskProps {
  id: string;
  /** On-screen text (may differ from `id` — see TablePosition in types/desk.ts). */
  label: string;
  status: DeskUiStatus;
  staffName?: string | null;
  customerSTT?: string | null;
  /** DS "khách chờ" — shown as a small bottleneck badge when > 0. */
  waiting?: number;
  /** Node center position (percent of board). */
  x: number;
  y: number;
  selected?: boolean;
  /** Dimmed by an active filter — faded and non-interactive. */
  dimmed?: boolean;
  onClick?: (id: string) => void;
}

const TONE: Record<DeskUiStatus, string> = {
  available: 'bg-vacant border-green-700 text-white',
  occupied: 'bg-occupied border-red-800 text-white',
};

export default function Desk({
  id,
  label,
  status,
  waiting = 0,
  x,
  y,
  selected = false,
  dimmed = false,
  onClick,
}: DeskProps) {
  const interactive = Boolean(onClick) && !dimmed;
  return (
    <button
      type="button"
      aria-label={`Bàn ${label} — ${status}`}
      title={label}
      disabled={!interactive}
      onClick={() => interactive && onClick?.(id)}
      style={{ left: `${x}%`, top: `${y}%` }}
      className={[
        'absolute -translate-x-1/2 -translate-y-1/2 rounded-full',
        // Sized from the board scale (index.css) so the gap to the STT dots of
        // the row above stays proportional on every screen, iPad included.
        'flex h-[var(--node)] min-w-[var(--node)] items-center justify-center px-[0.2em]',
        'text-[length:var(--node-fs)] font-semibold leading-none',
        'border shadow-sm transition',
        interactive ? 'cursor-pointer hover:scale-110 hover:shadow-md' : 'cursor-default',
        dimmed ? 'pointer-events-none opacity-15' : '',
        selected ? 'z-20 scale-110 ring-2 ring-blue-500 ring-offset-1' : 'z-10',
        TONE[status],
      ].join(' ')}
    >
      {label}
      {waiting > 0 && (
        <span
          // Sits just outside the top-right edge — never on top of the label.
          style={{ right: 'calc(var(--dot) * -0.55)', top: 'calc(var(--dot) * -0.45)' }}
          className="absolute flex h-[var(--dot)] min-w-[var(--dot)] items-center justify-center rounded-full bg-amber-500 px-[2px] text-[length:var(--dot-fs)] font-bold leading-none text-white shadow ring-1 ring-white"
          title={`${waiting} khách đang chờ`}
        >
          {waiting}
        </span>
      )}
    </button>
  );
}
