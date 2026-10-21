/**
 * The pure decisions the two new-game panes share (plan 11-07).
 *
 * ## Why this module exists
 *
 * The HEAT and Warships components are wiring and markup; the choices they make
 * (which account's rows come first, when a table must be windowed, how a card
 * counts toward its pane header) live here so they can be unit-tested under
 * Node, where Vitest has no DOM. There is no Svelte, no copy and no DOM in this
 * file, and its only imports are types.
 *
 * ## Account order is a MAIN-THREAD concern
 *
 * The worker posts rows in first-seen account order. The page orders them by the
 * identity header's order (the tag map's key order, UI-SPEC "Ordering") so a
 * pane's rows and the header's account list read the same way. The map is
 * consulted through a `Map`, never an object keyed by account: the key is a zip
 * folder name, so a root literally called `__proto__` must be an ordinary key
 * (T-10-09).
 */

import type { AccountTagModel } from '../../shell/identity-model.ts';
import type { NewDataCardView, NewDataRowView } from './new-data-shared.ts';

/**
 * The most rows a card renders as a plain table (UI-SPEC Recorded Choice 5).
 *
 * Above this the table is windowed with `windowRange` at the constant row height
 * `ROW_PX` (40 px, `src/lib/core/windowing.ts`); that height is referenced here
 * and deliberately not redefined, so there is one place it can change.
 */
export const PLAIN_TABLE_MAX_ROWS = 500;

/** Does a table of this many rows need windowing? */
export function shouldWindow(rowCount: number): boolean {
  return rowCount > PLAIN_TABLE_MAX_ROWS;
}

/**
 * A stable sort of rows (or of any element with an `account`, such as the
 * Warplanes account blocks) by the position of each element's account in the
 * tag map's key order. A row whose account is not in the map goes last, keeping its
 * relative order; with no tags (one account) the input comes back unchanged.
 */
export function orderRowsByAccount<T extends { readonly account: string }>(
  rows: readonly T[],
  tags: ReadonlyMap<string, AccountTagModel> | null,
): readonly T[] {
  if (tags === null) return rows;
  const position = new Map<string, number>();
  for (const root of tags.keys()) position.set(root, position.size);
  const unknown = position.size;
  return rows
    .map((row, index) => ({ row, index, rank: position.get(row.account) ?? unknown }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.row);
}

/**
 * The first row of each account, in order of first appearance (the HEAT
 * account-statistics blocks show one block per account).
 */
export function firstRowPerAccount<T extends Pick<NewDataRowView, 'account'>>(
  rows: readonly T[],
): T[] {
  const seen = new Set<string>();
  const first: T[] = [];
  for (const row of rows) {
    if (seen.has(row.account)) continue;
    seen.add(row.account);
    first.push(row);
  }
  return first;
}

/** One card in a sentence-free form: its state and how many rows it shows. */
export interface CardSummary {
  status: NewDataCardView['status'];
  rows: number;
}

/** A card's state and ready row count (zero unless ready). */
export function cardSummary(card: NewDataCardView): CardSummary {
  return { status: card.status, rows: card.status === 'ready' ? card.rowCount : 0 };
}

/** A pane's cards counted by state, and the total ready rows. */
export interface ViewSummary {
  ready: number;
  noRows: number;
  skipped: number;
  notInExport: number;
  rows: number;
}

/** Count a pane view's cards by status, for the header and the muted-pane decision. */
export function viewSummary(view: {
  readonly cards: Readonly<Record<string, NewDataCardView>>;
}): ViewSummary {
  const summary: ViewSummary = { ready: 0, noRows: 0, skipped: 0, notInExport: 0, rows: 0 };
  for (const card of Object.values(view.cards)) {
    const { status, rows } = cardSummary(card);
    summary.rows += rows;
    if (status === 'ready') summary.ready += 1;
    else if (status === 'no-rows') summary.noRows += 1;
    else if (status === 'skipped') summary.skipped += 1;
    else summary.notInExport += 1;
  }
  return summary;
}

/**
 * Whether any of these cards has something the single global reveal governs
 * (plan 12-09, D-13): it is ready, holds at least one row and has a column of
 * kind `code` or `address`.
 *
 * It generalises the HEAT pane's address-only test to the code kind. A pane with
 * nothing to mask has no toggle (UI-SPEC Surface 4), because a button that
 * governs nothing is a control that lies. Only the status, the row count and the
 * column kinds are read, never a cell.
 */
export function hasMaskableRows(cards: readonly NewDataCardView[]): boolean {
  return cards.some(
    (card) =>
      card.status === 'ready' &&
      card.rows.length > 0 &&
      card.columns.some((column) => column.kind === 'code' || column.kind === 'address'),
  );
}
