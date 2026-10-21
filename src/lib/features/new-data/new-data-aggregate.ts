/**
 * The new-game pane builders (plan 11-07): pure functions that turn account-grouped
 * allowlisted rows into card views.
 *
 * ## Why this module exists
 *
 * This is the Device info seam (quick task 261012-bog) applied to the new
 * files: the reader is generic, the builders are pure, and the view carries
 * cells and account roots and nothing else. Nothing here touches a worker
 * global, Dexie, the DOM, a clock or the network, so the same functions run
 * under Node in a unit test and inside the ingest worker against a real export.
 *
 * ## The rules that shape every function here
 *
 * 1. **A cell is read through the spec's constant header and nowhere else**
 *    (PRIV-01, T-11-21). A stored row is already projected to canonical
 *    headers, so there is nothing to resolve and no key from the row is ever
 *    consulted: the builder asks the row for each header the SPEC names and
 *    never walks the row's own keys. A legacy row that still carries an
 *    unnarrowed canary column therefore cannot reach a view, because no
 *    constant names it.
 * 2. **The account of a row is the group's, never a cell's** (GAMES-04, D-03).
 * 3. **Four states, none implied** (D-09): absent, empty, skipped, ready.
 * 4. **Nothing is truncated and nothing is summarised away** (UI-SPEC Recorded
 *    Choice 4, D-11): every stored row of a card is a row of the view.
 * 5. **An address cell is the canonical address or null** (T-11-25): the page
 *    can show a revealed address, so the worker only ever hands it one.
 * 6. **Only Subscriptions merges across accounts** (D-10, D-11, D-12). Rows
 *    identical on EVERY column of the spec collapse into one row that names
 *    every contributing account; a difference in any column keeps rows apart,
 *    and a repeat inside one account is never folded into its first. Coupons,
 *    bonus codes and surveys never merge (UI-SPEC Recorded Choice 3), because
 *    merging could hide a real per-account fact. Storage stays per account and
 *    the merge is a read-time grouping, so no second stored aggregate exists to
 *    drift from an import-time one.
 *
 * ## What is deliberately absent
 *
 * No sorting, no filtering, no truncation, and no logging: a failing builder
 * throws and the caller's existing handler reports the error object's name
 * only, never a row (the T-06-01 rule).
 */

import { parseIp } from '../../geo/ip.ts';
import { mergeIdenticalAcrossAccounts } from './account-merge.ts';
import type { AccountRowGroup, CsvRow } from '../../worker/csv-columns.ts';
import { NEW_DATA_SPEC_FILES, type SpecFile } from '../../worker/new-data-specs.ts';
import {
  HEAT_CARD_FILES,
  HEAT_CARD_IDS,
  MAX_NEW_DATA_CELL_LENGTH,
  PERKS_CARD_FILES,
  PERKS_CARD_IDS,
  WOWS_CARD_FILES,
  WOWS_CARD_IDS,
  type HeatCardId,
  type HeatView,
  type NewDataCardView,
  type NewDataCell,
  type NewDataColumnView,
  type NewDataRowView,
  type PerksCardId,
  type PerksView,
  type WarshipsStorageView,
  type WowsCardId,
} from './new-data-shared.ts';

/**
 * What one card is fed: its rows grouped per account, whether its file was in
 * the archive, and how many rows the file PARSED to (null when unknown).
 */
export interface NewDataCardInput {
  readonly groups: readonly AccountRowGroup[];
  readonly seen: boolean;
  /** Summed parsed-row count of the card's presence facts, or null when unknown. */
  readonly parsed: number | null;
}

// ---------------------------------------------------------------------------
// Cells
// ---------------------------------------------------------------------------

/** The "not available" tokens the export writes, upper-cased. */
const NOT_REPORTED_TOKENS: ReadonlySet<string> = new Set(['N/A', 'N/D']);

/** An optionally signed digit string with an optional plain decimal part. */
const PLAIN_NUMBER = /^[+-]?\d+(?:\.\d+)?$/;

/** A number-kind cell longer than this stays text: no real count is this long. */
const MAX_NUMBER_TEXT = 40;

/** Trim, then cut to the bound. */
function clamp(text: string): string {
  return text.length > MAX_NEW_DATA_CELL_LENGTH ? text.slice(0, MAX_NEW_DATA_CELL_LENGTH) : text;
}

/**
 * One cell as shown, by the column's kind.
 *
 * `null` for a missing key, a blank string, or N/A / N/D in any case. A
 * number-kind cell becomes a JS number only when it is a plain decimal and, for
 * an integer, a safe one; anything else stays the trimmed string rather than
 * being guessed at. Dates are kept exactly as written (D-01).
 */
export function cellOf(raw: string | undefined, kind: NewDataColumnView['kind']): NewDataCell {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed === '' || NOT_REPORTED_TOKENS.has(trimmed.toUpperCase())) return null;

  if (kind === 'code') {
    // Never a number, however digit-shaped: `00012345678` keeps its leading
    // zeros, and the mask and the reveal both work from the stored text
    // (T-12-17). The formatter masks it; nothing here does.
    return clamp(trimmed);
  }

  if (kind === 'address') {
    // `displayIp` returns the stored string verbatim once revealed, so a cell
    // that is not an address must never reach the page at all (T-11-25).
    return parseIp(trimmed)?.canonical ?? null;
  }

  if (kind === 'number' && trimmed.length <= MAX_NUMBER_TEXT && PLAIN_NUMBER.test(trimmed)) {
    const value = Number(trimmed);
    const isInteger = !trimmed.includes('.');
    if (isInteger ? Number.isSafeInteger(value) : Number.isFinite(value)) return value;
  }
  return clamp(trimmed);
}

/** Read one spec column off a row by its constant header; absent is undefined. */
function readHeader(row: CsvRow, header: string): string | undefined {
  // A direct own-property read on a constant: a `__proto__` or `constructor`
  // header could not be named here, and nothing the row holds is consulted.
  return Object.hasOwn(row, header) ? row[header] : undefined;
}

// ---------------------------------------------------------------------------
// One card
// ---------------------------------------------------------------------------

/** The spec of one file key, or a thrown bug (the keys are this module's constants). */
function specOf(key: string): SpecFile {
  const spec = NEW_DATA_SPEC_FILES.find((candidate) => candidate.key === key);
  if (spec === undefined) throw new Error('unknown new-game spec');
  return spec;
}

/** A built card and how many STORED rows the cross-account merge removed from it. */
export interface BuiltNewDataCard {
  readonly card: NewDataCardView;
  /** Zero for a card that does not merge, and for one where nothing was identical. */
  readonly mergedAway: number;
}

/**
 * The one card builder: {@link buildNewDataCard} and the merging variant both
 * call it, so the four states and the cell rules cannot differ between them.
 */
function buildCard(spec: SpecFile, input: NewDataCardInput, merge: boolean): BuiltNewDataCard {
  let stored = 0;
  for (const group of input.groups) stored += group.rows.length;

  if (stored === 0) {
    if (!input.seen) return { card: { status: 'not-in-export' }, mergedAway: 0 };
    return {
      card:
        input.parsed !== null && input.parsed > 0 ? { status: 'skipped' } : { status: 'no-rows' },
      mergedAway: 0,
    };
  }

  // A spec column is listed only when at least one stored row carries it, in
  // SPEC order. The walk is over the spec's columns, never over a row's keys.
  const listed = spec.columns.filter((column) =>
    input.groups.some((group) => group.rows.some((row) => Object.hasOwn(row, column.header))),
  );
  const columns: NewDataColumnView[] = listed.map((column) => ({
    id: column.id,
    kind: column.kind,
  }));
  const cellsOf = (row: CsvRow): NewDataCell[] =>
    listed.map((column) => cellOf(readHeader(row, column.header), column.kind));

  const rows: NewDataRowView[] = [];
  let mergedAway = 0;
  if (merge) {
    // D-11: the key is the spec's WHOLE column list, never the listed subset or
    // one the caller found convenient, so a difference in any allowlisted
    // column keeps two rows apart. `accounts` is added only for a row that more
    // than one account contributed (D-10): a row with a single owner keeps the
    // plain shape every consumer already reads.
    const result = mergeIdenticalAcrossAccounts(
      input.groups,
      spec.columns.map((column) => column.id),
    );
    mergedAway = result.mergedAway;
    for (const merged of result.rows) {
      rows.push(
        merged.accounts.length > 1
          ? { account: merged.accounts[0]!, accounts: merged.accounts, cells: cellsOf(merged.row) }
          : { account: merged.accounts[0]!, cells: cellsOf(merged.row) },
      );
    }
  } else {
    for (const group of input.groups) {
      for (const row of group.rows) rows.push({ account: group.account, cells: cellsOf(row) });
    }
  }
  return { card: { status: 'ready', columns, rows, rowCount: rows.length }, mergedAway };
}

/**
 * Build one card from its spec and input.
 *
 * Zero stored rows is decided by presence and the parsed count: never seen is
 * `not-in-export`; seen with a parsed count above zero is `skipped` (the
 * allowlist stored none of it); seen with zero or unknown parsed is `no-rows`.
 * Unknown is `no-rows` on purpose: a legacy cache cannot support the stronger
 * claim, and "no rows" is the one sentence true of both cases.
 *
 * Every stored row is a row of the view and none is merged: this is the HEAT,
 * Warships and unmerged Perks path, and its row shape is unchanged.
 */
export function buildNewDataCard(spec: SpecFile, input: NewDataCardInput): NewDataCardView {
  return buildCard(spec, input, false).card;
}

/**
 * The same card with identical rows merged ACROSS accounts (D-10, D-11), and the
 * number of stored rows the merge removed.
 *
 * `rowCount` is the DISPLAYED row count, so a pane that also shows the stored
 * total reconciles the two with `mergedAway`.
 */
export function buildMergedNewDataCard(spec: SpecFile, input: NewDataCardInput): BuiltNewDataCard {
  return buildCard(spec, input, true);
}

// ---------------------------------------------------------------------------
// The two views
// ---------------------------------------------------------------------------

/** The HEAT pane: four cards in a fixed order, top-level status always ready. */
export function buildHeatView(inputs: Readonly<Record<HeatCardId, NewDataCardInput>>): HeatView {
  const cards = {} as Record<HeatCardId, NewDataCardView>;
  for (const id of HEAT_CARD_IDS) {
    cards[id] = buildNewDataCard(specOf(HEAT_CARD_FILES[id]), inputs[id]);
  }
  return { status: 'ready', cards };
}

/** The Warships crews-and-storage pane: two cards, top-level status always ready. */
export function buildWarshipsStorageView(
  inputs: Readonly<Record<WowsCardId, NewDataCardInput>>,
): WarshipsStorageView {
  const cards = {} as Record<WowsCardId, NewDataCardView>;
  for (const id of WOWS_CARD_IDS) {
    cards[id] = buildNewDataCard(specOf(WOWS_CARD_FILES[id]), inputs[id]);
  }
  return { status: 'ready', cards };
}

/**
 * The Perks pane: four cards in a FIXED order, top-level status always ready.
 *
 * A card whose file is `null` in the contract names no file at all, and it
 * answers `not-in-export` — the honest answer for an export that holds no such
 * file, and never an error (D-08). The other cards are built by the SAME card
 * builder the HEAT and Warships cards use, so the four states (`not-in-export`,
 * `no-rows`, `skipped`, `ready`) mean the same thing in every pane.
 *
 * Subscriptions is the one card that merges identical rows across accounts
 * (D-10, D-11); coupons, bonus codes and surveys never do (UI-SPEC Recorded
 * Choice 3). `mergedAway` is therefore the Subscriptions removal count and
 * nothing else, so the pane's merge note reconciles the stored-row headline with
 * the rows on screen.
 */
export function buildPerksView(inputs: Readonly<Record<PerksCardId, NewDataCardInput>>): PerksView {
  const cards = {} as Record<PerksCardId, NewDataCardView>;
  let mergedAway = 0;
  for (const id of PERKS_CARD_IDS) {
    const file = PERKS_CARD_FILES[id];
    if (file === null) {
      cards[id] = { status: 'not-in-export' };
      continue;
    }
    if (id === 'subscriptions') {
      const built = buildMergedNewDataCard(specOf(file), inputs[id]);
      cards[id] = built.card;
      mergedAway = built.mergedAway;
    } else {
      cards[id] = buildNewDataCard(specOf(file), inputs[id]);
    }
  }
  return { status: 'ready', cards, mergedAway };
}
