/**
 * Sidebar — operational summary for the coordinator.
 *
 * Shows the total checked-in customers (from the Lark "Check in" table) and a
 * per-cluster breakdown of occupied / available / waiting to spot bottlenecks.
 */
import { CLUSTER_LABELS } from '@/config/layoutConfig';
import type { ClusterKey, DashboardSummary } from '@/types/desk';

interface SidebarProps {
  summary: DashboardSummary;
}

const ORDER: ClusterKey[] = ['kythuat', 'consult'];

export default function Sidebar({ summary }: SidebarProps) {
  const c = summary.customers;
  return (
    /*
      Rail on the right from `lg` up (tablet landscape / desktop); when it wraps
      under the board (tablet portrait) the four cards become one compact row so
      the summary never pushes the floor map off screen.
    */
    <aside className="w-full shrink-0 lg:w-56 xl:w-64">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-1 lg:gap-4">
        {/* Customer funnel */}
        <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm xl:p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-neutral-400">
            Khách đã Check-in
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-neutral-800 xl:text-3xl">{c.checkedIn}</span>
            <span className="text-base font-semibold text-neutral-400 xl:text-lg">
              / {c.totalRegistered}
            </span>
          </div>
          <div className="mt-2 space-y-2 border-t border-neutral-100 pt-2 xl:mt-3 xl:pt-3">
            <Ratio label="Check-in / Tổng đăng ký" num={c.checkedIn} den={c.totalRegistered} numClass="text-neutral-800" barClass="bg-neutral-400" />
            <Ratio label="Đang tư vấn / Check-in" num={c.consulting} den={c.checkedIn} numClass="text-occupied" barClass="bg-occupied" />
            <Ratio label="Chưa được phục vụ / Check-in" num={c.notServed} den={c.checkedIn} numClass="text-amber-600" barClass="bg-amber-500" />
          </div>
        </div>

        {/* Per-cluster breakdown */}
        {ORDER.map((key) => {
          const s = summary.byCluster[key];
          return (
            <div key={key} className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm xl:p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-neutral-800">
                  {CLUSTER_LABELS[key]}
                </span>
                <span className="shrink-0 text-xs text-neutral-400">
                  {s.withData}/{s.total} bàn
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Metric label="Tiếp nhận" value={s.occupied} className="text-occupied" />
                <Metric label="Trống" value={s.available} className="text-vacant" />
                <Metric label="Chờ" value={s.waiting} className="text-amber-600" />
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function Ratio({
  label,
  num,
  den,
  numClass,
  barClass,
}: {
  label: string;
  num: number;
  den: number;
  numClass: string;
  barClass: string;
}) {
  const pct = den > 0 ? Math.min(100, (num / den) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs leading-tight text-neutral-500">{label}</span>
        <span className="shrink-0 whitespace-nowrap text-sm font-semibold">
          <span className={numClass}>{num}</span>
          <span className="text-neutral-400"> / {den}</span>
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-100">
        <div
          className={`h-full rounded-full ${barClass}`}
          style={{ width: `${pct}%` }}
          title={`${Math.round(pct)}%`}
        />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div>
      <div className={`text-xl font-bold ${className}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-neutral-400">{label}</div>
    </div>
  );
}
