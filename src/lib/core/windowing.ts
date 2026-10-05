/**
 * Windowing arithmetic shared by every windowed table (05-12, hoisted in 06-10).
 *
 * The vehicle table (Phase 5) and the login table (Phase 6) draw the same way:
 * a fixed row height, a bounded number of rows in the DOM and two spacers that
 * stand in for the rest. The arithmetic lives here, with no Svelte, no copy and
 * no feature import, so both tables read one definition and a fix reaches both.
 *
 * `vehicle-model.ts` re-exports every name below, so each existing import of
 * them from there (the vehicle table, its tests and the Phase 5 layout guards)
 * is unchanged.
 */

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
