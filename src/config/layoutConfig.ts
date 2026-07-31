/**
 * layoutConfig — the 9 interactive positions mapped to board coordinates.
 *
 * Coordinates are percentages of a 16:9 board, redrawn from the new floor-plan
 * reference image (2026-07-30):
 *   - Khu vực kỹ thuật (KT) : 3 staff in a row, top-center-left  → 3
 *   - Khu vực tư vấn (TV)   : 3 vertical pairs, across the bottom → 6
 * "Bàn thu cũ" is replaced by "Kỹ thuật" and "Backup" no longer exists in
 * this floor plan. Total = 9.
 */
import type { ClusterKey, TablePosition } from '@/types/desk';

/**
 * Desk-code prefix SHOWN ON SCREEN — the ops-facing IDs are KT1–KT3 (Kỹ
 * thuật), TV1–TV6 (Tư vấn). See `ID_PREFIX` below for the (different) prefix
 * used as the Lark join key.
 */
export const CLUSTER_PREFIX: Record<ClusterKey, string> = {
  kythuat: 'KT',
  consult: 'TV',
};

/**
 * Desk-code prefix used as the LARK JOIN KEY. `kythuat` deliberately keeps the
 * old "TC" codes: the connected Lark base still has a "DS thu cũ" table with
 * "STT bàn" = TC1/TC2/TC3 and nobody has renamed it there yet — only the
 * on-screen label changes to "KT" (see types/desk.ts's `TablePosition` doc).
 * Once a real "DS Kỹ thuật" table exists, change this together with the Lark
 * table/field wiring in larkConfig.ts.
 */
const ID_PREFIX: Record<ClusterKey, string> = {
  kythuat: 'TC',
  consult: 'TV',
};

/**
 * Minimum spacing between two adjacent desk centers, in board percent.
 *
 * A node is `--node` tall (index.css: 5.5% of the board height) and its row of
 * STT dots hangs `node/2 + 2px + dot` ≈ 5.5% of the height below the center, so
 * two rows need ≈ 8.5% plus breathing room. Columns only have to clear the node
 * width plus a 2-dot row (≈ 3.5% of the height ≈ 2.5% of a 16:9 width), but are
 * kept well above that so a 3-dot row still fits between two neighbours.
 */
const MIN_ROW_PITCH = 11; // % of board height
const MIN_COL_PITCH = 6; // % of board width

/** Assert a coordinate axis leaves enough room for the node + dot marks. */
function assertPitch(cluster: ClusterKey, axis: 'x' | 'y', values: number[], min: number): void {
  const sorted = [...values].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i += 1) {
    const gap = sorted[i] - sorted[i - 1];
    if (gap < min) {
      throw new Error(
        `layoutConfig: ${cluster} ${axis} spacing ${gap}% < ${min}% — desk nodes and ` +
          `their STT dots would overlap. Move the coordinates apart (or shrink --node).`,
      );
    }
  }
}

/** Assert spacing on the de-duplicated x/y values actually used by a cluster. */
function assertGridSpacing(cluster: ClusterKey, positions: TablePosition[]): void {
  assertPitch(cluster, 'x', [...new Set(positions.map((p) => p.x))], MIN_COL_PITCH);
  assertPitch(cluster, 'y', [...new Set(positions.map((p) => p.y))], MIN_ROW_PITCH);
}

/**
 * Build a grid of positions for one cluster (row-major: left→right within a
 * row, then top→bottom). Desk id/label = `${prefix}${n}` (1-based, unpadded).
 * @param cluster  cluster key (drives the id/label prefix)
 * @param xs       column center X positions (%)
 * @param ys       row center Y positions (%)
 */
function buildGrid(cluster: ClusterKey, xs: number[], ys: number[]): TablePosition[] {
  assertPitch(cluster, 'x', xs, MIN_COL_PITCH);
  assertPitch(cluster, 'y', ys, MIN_ROW_PITCH);
  const labelPrefix = CLUSTER_PREFIX[cluster];
  const idPrefix = ID_PREFIX[cluster];
  const out: TablePosition[] = [];
  let i = 0;
  for (const y of ys) {
    for (const x of xs) {
      i += 1;
      out.push({ id: `${idPrefix}${i}`, cluster, label: `${labelPrefix}${i}`, x, y });
    }
  }
  return out;
}

// ── Khu vực kỹ thuật (KT) — 3 nhân viên xếp hàng ngang, phía trên ───────────
export const KYTHUAT_POSITIONS = buildGrid('kythuat', [34, 41, 48], [16]);

// ── Khu vực tư vấn (TV) — 3 cặp bàn xếp dọc (tv1/2, tv3/4, tv5/6) ──────────
// Numbering runs top→bottom WITHIN a group, then group-by-group left→right
// (matches the reference image) — not a plain row-major grid, so the
// positions are listed explicitly instead of through buildGrid.
export const CONSULT_POSITIONS: TablePosition[] = [
  { id: 'TV1', cluster: 'consult', label: 'TV1', x: 14, y: 62 },
  { id: 'TV2', cluster: 'consult', label: 'TV2', x: 14, y: 78 },
  { id: 'TV3', cluster: 'consult', label: 'TV3', x: 32, y: 62 },
  { id: 'TV4', cluster: 'consult', label: 'TV4', x: 32, y: 78 },
  { id: 'TV5', cluster: 'consult', label: 'TV5', x: 50, y: 62 },
  { id: 'TV6', cluster: 'consult', label: 'TV6', x: 50, y: 78 },
];
assertGridSpacing('consult', CONSULT_POSITIONS);

/** All 9 positions, flat. */
export const ALL_POSITIONS: TablePosition[] = [
  ...KYTHUAT_POSITIONS,
  ...CONSULT_POSITIONS,
];

/** Human-readable Vietnamese names per cluster, for legends/labels. */
export const CLUSTER_LABELS: Record<ClusterKey, string> = {
  kythuat: 'Kỹ thuật',
  consult: 'Tư vấn',
};

// Compile-time sanity: the new floor plan mandates exactly 9 positions (3/6).
if (KYTHUAT_POSITIONS.length !== 3 || CONSULT_POSITIONS.length !== 6) {
  throw new Error(
    `layoutConfig: expected 3/6 positions, got ` +
      `${KYTHUAT_POSITIONS.length}/${CONSULT_POSITIONS.length}`,
  );
}
