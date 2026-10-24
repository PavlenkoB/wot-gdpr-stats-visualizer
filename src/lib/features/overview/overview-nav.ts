/**
 * overview-nav.ts — the bento's KEYBOARD TARGETS, decided from rectangles
 * (13-10, D-16).
 *
 * ## Why this is a pure module
 *
 * `vitest.config.ts` has no Svelte plugin and runs in Node, so no component can
 * be mounted in a unit test. The only DOM question keyboard navigation asks is
 * "where is each tile on screen", and the component answers it by handing in
 * bounding rectangles. Everything after that — which tile an arrow key lands
 * on — is a function over plain numbers, proved here.
 *
 * ## The rules (UI-SPEC Interaction Contract)
 *
 * - The rectangles arrive in DOM order, Pinned group first.
 * - ArrowLeft / ArrowRight step one tile in DOM order. Nothing wraps.
 * - Home / End go to the first / last tile.
 * - ArrowUp / ArrowDown are a port of the sketch's `vertical`: the nearest tile
 *   in the adjacent row whose horizontal extent overlaps the current tile's,
 *   by bounding rectangle and not by DOM order. Smaller vertical distance
 *   wins, then the larger overlap, and an exact tie goes to the EARLIER tile
 *   in DOM order.
 * - The roving tab stop is the last focused tile, initially the first.
 *
 * Nothing here imports anything.
 */

/** A tile's bounding rectangle, in any one consistent coordinate space. */
export interface TileRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** The keys the bento answers to. */
export type NavKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End';

const NAV_KEYS: readonly string[] = [
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
];

/** Whether a `KeyboardEvent.key` is one of the navigation keys. */
export function isNavKey(key: string): key is NavKey {
  return NAV_KEYS.includes(key);
}

/** One pixel of slack: layout rounding must not decide a tie. */
const EPSILON = 1;

/**
 * The nearest tile above or below that overlaps horizontally.
 *
 * A port of the sketch's `vertical`, branch for branch: skip a candidate that
 * is behind the current tile (`dy` below -1) or overlaps it by a pixel or
 * less; keep the candidate with the smaller `dy` (a difference above one pixel
 * decides), and among equal `dy` (within a pixel) the strictly larger overlap,
 * so the earlier tile in DOM order wins an exact tie.
 */
function vertical(direction: 1 | -1, current: number, rects: readonly TileRect[]): number | null {
  const r = rects[current];
  let best: number | null = null;
  let bestDy = Infinity;
  let bestOverlap = 0;
  for (let i = 0; i < rects.length; i += 1) {
    if (i === current) continue;
    const q = rects[i];
    const dy = direction > 0 ? q.top - r.bottom : r.top - q.bottom;
    if (dy < -EPSILON) continue;
    const overlap = Math.min(r.right, q.right) - Math.max(r.left, q.left);
    if (overlap <= EPSILON) continue;
    if (dy < bestDy - EPSILON || (Math.abs(dy - bestDy) <= EPSILON && overlap > bestOverlap)) {
      best = i;
      bestDy = dy;
      bestOverlap = overlap;
    }
  }
  return best;
}

/**
 * The index of the tile a key moves to, or `null` when it moves nowhere.
 *
 * `rects` are in DOM order. An empty list, or a `current` outside it, returns
 * `null`. Left and right return `null` at the ends: no key wraps.
 */
export function nextTileIndex(
  key: NavKey,
  current: number,
  rects: readonly TileRect[],
): number | null {
  if (rects.length === 0) return null;
  if (!Number.isInteger(current) || current < 0 || current >= rects.length) return null;
  switch (key) {
    case 'Home':
      return 0;
    case 'End':
      return rects.length - 1;
    case 'ArrowLeft':
      return current > 0 ? current - 1 : null;
    case 'ArrowRight':
      return current < rects.length - 1 ? current + 1 : null;
    case 'ArrowDown':
      return vertical(1, current, rects);
    case 'ArrowUp':
      return vertical(-1, current, rects);
  }
}

/**
 * The index of the roving tab stop.
 *
 * The last focused tile, or the first when none has been focused or the
 * focused one is no longer in the list. `-1` for an empty list.
 */
export function rovingIndex(ids: readonly string[], current: string | null): number {
  if (ids.length === 0) return -1;
  if (current === null) return 0;
  const index = ids.indexOf(current);
  return index === -1 ? 0 : index;
}
