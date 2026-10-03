/**
 * The vehicle table's decisions, as pure functions (05-09).
 *
 * Phase 4's rule, applied here before the component exists: THE MODEL HOLDS NO
 * WORDS AND BUILDS NO COPY. The table formats through the Phase 5 copy
 * inventory, the picker labels through the same inventory, and this module never
 * renders, rounds or groups anything.
 *
 * Vitest runs with no DOM, which is the reason any of this is here: sorting,
 * searching, counting, windowing and column selection are the decisions a reader
 * can get wrong, and inside a component none of them would be testable. Here they
 * are checked against the zero-import oracle and the hand answer key, and 05-12
 * becomes wiring.
 *
 * ## No locale collation, anywhere (T-05-28)
 *
 * Two viewers in two locales must agree on one order for one export, so every
 * string comparison here is the JavaScript relational operator on strings — code
 * unit order — and every case folding is the locale-independent method. A locale
 * collation would put `Ch99_<b>bold_markup` somewhere different for a German
 * reader, which is not a cosmetic difference: it changes which vehicle a reader
 * says they have.
 *
 * ## A special value is not a low value (D-09)
 *
 * `N/D`, `N/A`, a blank, an absent column, a ratio over zero battles and a
 * Warships per-type cell are six different sentences, none of which is a zero.
 * Every one of them sorts LAST in both directions, because a vehicle that never
 * fought is not "the vehicle with the fewest battles" and a cell the game does
 * not define is not "the cell with the smallest number".
 *
 * Decisions: D-08, D-11, D-12, D-14, D-25. Threats: T-05-26, T-05-27, T-05-28.
 */

import type { ColumnKind, VehicleCell, VehicleColumn, VehicleRow } from './vehicle-shared';

/**
 * One rendered row's height, from the UI-SPEC geometry row.
 *
 * A CONSTANT rather than a measured value, and that is the whole design: the
 * windowing arithmetic below can only be a pure function if the row height is
 * known without asking the DOM, so the stylesheet declares the same 40px and
 * nothing is ever measured.
 */
export const ROW_PX = 40;

/**
 * How many rows to draw above the first visible row and below the last.
 *
 * Six on each side, so a flick of the wheel does not outrun the rows already in
 * the DOM and the reader sees padding scroll in rather than a blank strip. It
 * costs twelve rows of DOM whatever the row count (D-14, T-05-26).
 */
export const OVERSCAN_ROWS = 6;

/**
 * The height the scroller is sized to, in pixels.
 *
 * The UI-SPEC caps the visible body at 480px, which is 12 rows: a scroller taller
 * than that pushes the rest of the page below the fold, and a shorter one shows
 * too few rows to be worth sorting.
 */
export const SCROLLER_MAX_PX = 480;

/** Which way a column is sorted, and by what. */
export interface SortState {
  key: string;
  dir: 'asc' | 'desc';
}

/**
 * D-12: the order the table opens with, and the order it returns to.
 *
 * Battles descending, because the question a reader opens a per-vehicle table
 * with is "which of these did I actually play", and the answer is the count.
 */
export const DEFAULT_SORT: SortState = { key: 'battles', dir: 'desc' };

/**
 * The direction a column takes the FIRST time it is clicked.
 *
 * A text column opens ascending, which is a name read from A to Z. Every other
 * kind opens descending, which is "biggest first" — a count, a rate, an average
 * and a date all have one obviously-interesting end, and showing it first is
 * what makes a table worth sorting.
 */
export function firstDirection(kind: ColumnKind): 'asc' | 'desc' {
  return kind === 'text' ? 'asc' : 'desc';
}

/**
 * What the next click on `key` sorts by.
 *
 * Three cases and no fourth. A NEW key takes its first direction; the CURRENT key
 * flips; and a key that is not a sortable column of this view returns the state
 * untouched, which is how the two Warships All-battles cells (D-08) stay inert
 * without the component having to know they are special.
 *
 * There is NO unsorted state. A table that could return to file order would have
 * a third arrow glyph and a third thing to remember, and the reader would have no
 * way to tell an unsorted table from a table sorted by a column it has forgotten.
 */
export function nextSort(
  current: SortState,
  key: string,
  columns: readonly VehicleColumn[],
): SortState {
  const column = columns.find((entry) => entry.key === key);
  if (column === undefined || !column.sortable) {
    return current;
  }
  if (current.key === key) {
    return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' };
  }
  return { key, dir: firstDirection(column.kind) };
}

/**
 * Plain code-unit string comparison — the relational operator on two strings.
 *
 * Spelled out as a named helper so the rule appears once and the "no locale
 * collation anywhere in this module" claim is checkable by reading it. This is the
 * same helper shape the independent oracle uses, deliberately: the two sides are
 * meant to agree because both chose the plain rule, not because they share code.
 */
function codeUnitLess(a: string, b: string): boolean {
  return a < b;
}

/**
 * Is this cell one of the six special values, or a date whose text does not parse?
 *
 * A date carries its wall-clock seconds beside its text (D-01: no instant, no
 * zone), and `k: null` means the text was not a date this reader's rules can
 * order. Both cases sort last, and neither is a value.
 */
function isUnorderable(cell: VehicleCell): boolean {
  if (cell.t === 'x') {
    return true;
  }
  return cell.t === 'd' && cell.k === null;
}

/**
 * The number a cell is compared by, or null when it is unorderable.
 *
 * A boolean becomes 1 or 0 so "yes" is above "no" when the direction is
 * descending, and a date becomes the seconds it carries rather than its text, so
 * the order is the wall clock the export recorded and not an alphabetical
 * accident over a `YYYY-MM-DD HH:MM:SS` string.
 */
function orderValue(cell: VehicleCell): number | string | null {
  if (isUnorderable(cell)) {
    return null;
  }
  switch (cell.t) {
    case 'n':
      return cell.v;
    case 'b':
      return cell.v ? 1 : 0;
    case 'd':
      return cell.k;
    case 's':
      return cell.v;
    case 'x':
      return null;
  }
}

/**
 * Sort a view's rows, returning a NEW array.
 *
 * The order is: the sorted column, then the cleaned vehicle id ascending in
 * code-unit order, then the row's original position. The last step makes the sort
 * total — without it, two rows that tie on both would have no defined order and
 * the table would reshuffle between two renders of the same data.
 *
 * Every row is kept, including one with no battles: a garage-only vehicle is a
 * row with a count of zero (D-12), not a row that disappears.
 *
 * A key that is not a column of this view returns the rows in their original
 * order rather than throwing, so a view whose columns changed under a stale sort
 * state degrades to file order instead of an empty table.
 */
export function sortRows(
  rows: readonly VehicleRow[],
  columns: readonly VehicleColumn[],
  sort: SortState,
): VehicleRow[] {
  const index = columns.findIndex((column) => column.key === sort.key);
  if (index < 0) {
    return [...rows];
  }

  const sign = sort.dir === 'asc' ? 1 : -1;
  const decorated = rows.map((row, position) => ({ row, position }));

  decorated.sort((a, b) => {
    const left = orderValue(a.row.cells[index] ?? { t: 'x', v: 'missing' });
    const right = orderValue(b.row.cells[index] ?? { t: 'x', v: 'missing' });

    // A special value is last in BOTH directions, so the direction is applied
    // only to the two present values and never to this decision.
    if (left === null || right === null) {
      if (left === null && right === null) {
        // Both unorderable: fall through to the id, so the order is still total.
      } else {
        return left === null ? 1 : -1;
      }
    } else if (left !== right) {
      // Two NUMBERS compare numerically; anything else compares as text. A
      // column's kind fixes its cells' types, so the mixed case is unreachable —
      // but coercing rather than assuming means a new cell kind cannot silently
      // produce the string comparison of `5` against `10`.
      const bothNumbers = typeof left === 'number' && typeof right === 'number';
      const less = bothNumbers ? left < right : String(left) < String(right);
      return less ? -sign : sign;
    }

    // Ties break by cleaned id ascending, always, whatever the direction is:
    // a tie is a tie, and which of two equal values comes first is not a
    // question about magnitude.
    if (a.row.id !== b.row.id) {
      return codeUnitLess(a.row.id, b.row.id) ? -1 : 1;
    }
    return a.position - b.position;
  });

  return decorated.map((entry) => entry.row);
}

/**
 * D-11: search the CLEANED vehicle id, case-insensitively, as a substring.
 *
 * The cleaned id and not the `nation:id` the export wrote, because the nation
 * is a prefix the reader did not type and a search for `china` is a search for
 * one vehicle, not for every Chinese tank in the account.
 *
 * Both sides fold with the locale-independent method, so a reader in any locale
 * gets the same matches (T-05-28). The query is trimmed, so a pasted value with a
 * trailing newline still matches, and an empty query returns every row rather
 * than none — "no filter" is not "no results".
 *
 * The order of the rows is untouched: filtering never reorders, so the sort the
 * reader chose survives typing in the box.
 */
export function filterRows(rows: readonly VehicleRow[], query: string): VehicleRow[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return [...rows];
  }
  return rows.filter((row) => row.id.toLowerCase().includes(needle));
}

/**
 * How many rows have fought no battles — the second figure on the count line.
 *
 * A row whose battles cell is a special is NOT counted: the export did not say
 * zero, and saying "1 vehicle with no battles" about a row whose battle count
 * could not be read would be a statement about the user's data (DATA-04).
 */
export function zeroBattleCount(rows: readonly VehicleRow[]): number {
  let count = 0;
  for (const row of rows) {
    if (row.battles === 0) {
      count += 1;
    }
  }
  return count;
}

/** The rows a windowed scroller should draw, and the padding around them. */
export interface WindowRange {
  /** First row index to draw, inclusive. */
  first: number;
  /** One PAST the last row index to draw, so `last` doubles as a row count. */
  last: number;
  padTopPx: number;
  padBottomPx: number;
}

/**
 * Which rows the table draws for a scroller at `scrollTop`, and the two spacers
 * that stand in for the rows it does not draw (D-14, T-05-26).
 *
 * This is what keeps the DOM at about thirty rows whatever the row count: a
 * 5,000-vehicle account draws the window and two padded spacers, not 5,000
 * elements. The two pads are what the scrollbar measures, so the geometry is
 * derived here rather than measured in the browser — which is exactly why it can
 * be a pure function and why {@link ROW_PX} is a constant.
 *
 * `last` is EXCLUSIVE — rows `first .. last - 1` are drawn — which is what makes
 * the two pads add up: `first + (last - first) + (rows - last) === rows`. At the
 * top of a 5,000-row list with a 480px viewport that is 0 drawn, `last` 18 and
 * `199,280`px below: eighteen rows above the fold's bottom edge (twelve visible
 * plus six of overscan) and 4,982 rows of spacer.
 *
 * Four clamps, and the last one is the one that matters:
 *
 *   1. an empty list gives an empty window and no padding, not a negative one;
 *   2. the first row is never below 0, so the top of the list has no space above
 *      it;
 *   3. the last row is never past the end, so the bottom has no space below it;
 *   4. a scroll offset left over from a list that has since SHRUNK is pulled
 *      back, so the window is the final rows of the list. Without this a filter
 *      that cut 5,000 rows to 30 would leave the window starting at row 494 and
 *      draw an empty table — which reads as "no data" for an account that has
 *      plenty of it (T-05-27).
 */
export function windowRange(
  scrollTop: number,
  viewportPx: number,
  total: number,
  overscan: number = OVERSCAN_ROWS,
): WindowRange {
  const rows = Math.max(0, Math.floor(total));
  if (rows === 0) {
    return { first: 0, last: 0, padTopPx: 0, padBottomPx: 0 };
  }

  const offset = Number.isFinite(scrollTop) ? Math.max(0, scrollTop) : 0;
  const viewport = Number.isFinite(viewportPx) ? Math.max(0, viewportPx) : 0;
  const extra = Math.max(0, Math.floor(overscan));

  // How many rows the viewport itself shows, at least one, so the pull-back
  // below always has a width to give back.
  const rowsInView = Math.max(1, Math.ceil(viewport / ROW_PX));

  const first = Math.max(0, Math.floor(offset / ROW_PX) - extra);
  const last = Math.min(rows, Math.ceil((offset + viewport) / ROW_PX) + extra);

  // Clamp 4: the offset is past the end of a list that shrank. Give back a
  // viewport's worth of rows at the end rather than the single final row, so the
  // reader lands on the end of the list rather than on one row of it.
  const pulledFirst = Math.min(first, Math.max(0, last - rowsInView));

  return {
    first: pulledFirst,
    last,
    padTopPx: pulledFirst * ROW_PX,
    padBottomPx: (rows - last) * ROW_PX,
  };
}

/**
 * The columns the table draws: the core six, then the picked extras IN PICK ORDER.
 *
 * Pick order rather than view order, because the reader chose the order and
 * reordering their choice behind their back would be the table second-guessing
 * them. A picked key that is not an extra of THIS view is ignored rather than
 * invented: the view is what the export actually had, and offering a column the
 * file has no cell for would draw a column of dashes.
 *
 * A repeated pick appears once, and a core column is never duplicated as an
 * extra, so the drawn width always matches the number of cells a row carries.
 */
export function visibleColumns(
  columns: readonly VehicleColumn[],
  pickedExtraKeys: readonly string[],
): VehicleColumn[] {
  const core = columns.filter((column) => column.core);
  const extras = columns.filter((column) => !column.core);

  const picked: VehicleColumn[] = [];
  const seen = new Set<string>();
  for (const key of pickedExtraKeys) {
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const column = extras.find((entry) => entry.key === key);
    if (column !== undefined) {
      picked.push(column);
    }
  }

  return [...core, ...picked];
}
