/**
 * What one cell of a new-game card says (plan 11-08).
 *
 * ## Why this is its own module
 *
 * The shared table and the per-account `dl` blocks draw the same cells, and the
 * rules for them (the muted "not reported" word, grouped numbers, a battle-type
 * code shown as `Battle type {code}`, an address shown only through the mask
 * formatter) are privacy-relevant. One pure function answers all of them, so the
 * two components cannot disagree and a Node test can pin the rules without a DOM.
 *
 * The function returns TEXT. Both components interpolate it as a text node, so a
 * hostile cell value can never be parsed as markup (T-11-27).
 */

import { displayIp } from '../logins/login-model.ts';
import { maskCode } from './code-mask.ts';
import { DEVICE_NOT_REPORTED, formatBattleTypeLabel, formatNumber } from '../../ui-copy.ts';
import type { NewDataCell, NewDataColumnView } from './new-data-shared.ts';

/** One cell as drawn: its text, and whether it is muted chrome ("not reported"). */
export interface FormattedNewDataCell {
  readonly text: string;
  /** True only for the "not reported" words, so the meaning never rests on colour. */
  readonly muted: boolean;
}

/** What a cell's rendering depends on besides the cell and its column. */
export interface NewDataCellOptions {
  /** The single global reveal. Only an address-kind or code-kind cell reads it. */
  readonly revealed: boolean;
  /** The id of the column shown as `Battle type {code}`, or null for none. */
  readonly battleTypeColumnId: string | null;
}

/**
 * The text of one cell.
 *
 *   - `null`, `undefined` and an empty string are "not reported": a blank or a
 *     dash would read as a value, and the words do not depend on colour.
 *   - an address-kind cell goes through `displayIp` and nowhere else. The view
 *     carries a canonical address string or null for these cells (11-07), so the
 *     reveal can only ever show an address; it is masked by default.
 *   - a code-kind cell is masked like an address: `maskCode` until the single
 *     global reveal, the stored text after it (D-13).
 *   - the battle-type column reads `Battle type {code}` and is never named.
 *   - a number is grouped by `formatNumber`; text and dates are shown exactly as
 *     the export wrote them (no timezone claim).
 */
export function formatNewDataCell(
  cell: NewDataCell | undefined,
  column: Pick<NewDataColumnView, 'id' | 'kind'>,
  options: NewDataCellOptions,
): FormattedNewDataCell {
  if (cell === null || cell === undefined || cell === '') {
    return { text: DEVICE_NOT_REPORTED, muted: true };
  }
  if (column.kind === 'address') {
    return { text: displayIp({ ip: String(cell) }, options.revealed), muted: false };
  }
  if (column.kind === 'code') {
    // A coupon or bonus code: stored in clear, shown only through the mask until
    // the single global reveal. The reveal shows the stored text, never a number.
    return { text: options.revealed ? String(cell) : maskCode(cell), muted: false };
  }
  if (options.battleTypeColumnId !== null && column.id === options.battleTypeColumnId) {
    return { text: formatBattleTypeLabel(String(cell)), muted: false };
  }
  if (typeof cell === 'number') return { text: formatNumber(cell), muted: false };
  return { text: cell, muted: false };
}
