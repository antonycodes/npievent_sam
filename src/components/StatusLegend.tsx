/**
 * StatusLegend — the color key shown above the board.
 */
export default function StatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs md:text-sm">
      <span className="flex items-center gap-2">
        <span className="inline-block h-4 w-4 rounded-full bg-vacant" />
        Trống (Available)
      </span>
      <span className="flex items-center gap-2">
        <span className="inline-block h-4 w-4 rounded-full bg-occupied" />
        Đang tiếp nhận (Occupied)
      </span>
      <span className="flex items-center gap-2 text-amber-600">
        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white">
          n
        </span>
        Khách đang chờ
      </span>
    </div>
  );
}
