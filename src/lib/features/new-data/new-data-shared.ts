/**
 * The new-game view contract, shared by the ingest worker and the page.
 *
 * ## Why this module exists
 *
 * The worker derives the new-game panes' presence and counts at import time and
 * publishes them on `ClassifyResult`; the page then renders a list, an Overview
 * card and per-pane detail headers off that published object with no worker
 * query of its own. Everything both sides must agree on — which pane a file
 * feeds, and what a pane's two integers are — therefore lives here, in ONE
 * module either can import.
 *
 * This module has **no imports at all**, and that is load-bearing, exactly as it
 * is for `finance-shared.ts` and `device-info-shared.ts`: it is what makes it
 * legal for a worker-side module and a page-side module to agree on a name
 * without either depending on the other. `grep -c '^import'
 * src/lib/features/new-data/new-data-shared.ts` printing 0 is the check that
 * keeps it true.
 *
 * ## What is deliberately NOT here
 *
 * No column name and no cell. The pane keys are FILE NAMES — the names the
 * export itself prints, lower-cased once, in one table — while the COLUMN
 * vocabulary of each of those files lives in `worker/new-data-specs.ts`, which
 * the worker side owns and the page never imports. That split is what keeps the
 * integers this contract carries free of anything that could identify a person
 * (T-11-14): the page learns that four HEAT files were in the export and that
 * they hold twelve rows, and never learns what those rows say.
 */

/**
 * The pane ids, in the order the list shows them.
 *
 * A tuple rather than a set of string literals so `NewDataPaneId` cannot drift
 * away from the ids the file table names, and so a caller can iterate the panes
 * in presentation order without carrying its own list.
 */
export const NEW_DATA_PANE_IDS = ['heat', 'warships-storage'] as const;

/** One new-game pane's id. */
export type NewDataPaneId = (typeof NEW_DATA_PANE_IDS)[number];

/**
 * The lower-cased file names each pane is built from, verified against the zip
 * listing in 11-RESEARCH.
 *
 * A file's membership is by NAME and never by FOLDER, the same argument the
 * allowlist itself makes (`new-data-allowlist.ts`): the folder a CSV sits under
 * inside a zip is attacker-controlled, so a pane keyed on the folder could be
 * fed a copy filed anywhere. The CATEGORY is still checked when the facts are
 * derived — a pane file name carrying a spec for a different category counts for
 * nothing — so a misfiled copy cannot conjure a pane either (T-11-14).
 *
 * Not pane files, and the omissions are decisions rather than gaps:
 * `heat_game_sessions.csv` belongs to Playtime and `heat_device_info.csv` has
 * no card to sit on (11-01, D-15).
 */
export const NEW_DATA_PANE_FILES: Readonly<Record<NewDataPaneId, readonly string[]>> = {
  heat: [
    'heat_account_statistics.csv',
    'heat_battle_types_statistics.csv',
    'heat_account_storage.csv',
    'heat_session_geolocation.csv',
  ],
  'warships-storage': ['wows_crews.csv', 'wows_account_storage.csv'],
};

/**
 * What a pane publishes: two integers and nothing else.
 *
 * `fileCount` is the number of presence FACTS that matched, which is one per
 * account per file — the way the existing provenance counts files, so a
 * two-account export holding one file reports two. `rowCount` is the sum of
 * their STORED row counts.
 *
 * Both are counts, so neither can carry a file name, a cell or an account id
 * across the worker boundary (T-11-14). A pane that is absent from a published
 * object means "no file of this pane was in the export"; a pane present with
 * `rowCount: 0` means its files WERE there and the allowlist or the export's own
 * emptiness left no row — the two states D-09 exists to tell apart.
 */
export interface NewDataPaneFacts {
  /** Presence facts that matched this pane, summed over every account. */
  fileCount: number;
  /** Rows those facts STORED, summed. Never the parsed count. */
  rowCount: number;
}

// =============================================================================
// The pane views (plan 11-07)
// =============================================================================
//
// A pane's DETAIL view is asked for by a worker query (`heat`,
// `warships-storage`) and crosses `postMessage` as the shapes below. They carry
// CELLS, account roots and counts, and deliberately nothing else: no file name
// (a caption comes from a constant table keyed by record type, so an untrusted
// zip entry name cannot reach a card, T-11-23) and no key that is not a column
// id the worker's spec table names (T-11-21).

/**
 * The bound on a text or date cell, in characters.
 *
 * The same figure as `MAX_DEVICE_TEXT` in the Device info contract. A longer
 * cell is cut, never dropped, so a hostile 5 MB cell costs one slice and cannot
 * inflate the posted message.
 */
export const MAX_NEW_DATA_CELL_LENGTH = 200;

/** One cell as shown: text, a number, or `null` for "not reported". */
export type NewDataCell = string | number | null;

/** What a column's cells are, mirrored from the worker's spec kinds. */
export type NewDataColumnKind = 'text' | 'number' | 'date' | 'address';

/** One column of a ready card: the spec's stored id and its kind. */
export interface NewDataColumnView {
  readonly id: string;
  readonly kind: NewDataColumnKind;
}

/**
 * One stored row: the account root that owns it and its cells in column order.
 *
 * The root is the group's `account` as the reader built it, never a cell, so a
 * row is traceable to its account without the view carrying a nickname or an
 * account id (GAMES-04, D-03).
 */
export interface NewDataRowView {
  readonly account: string;
  readonly cells: readonly NewDataCell[];
}

/**
 * One card's state. Exactly one of four, and never implied (D-09):
 *
 *   - `not-in-export` — the file is not in the archive;
 *   - `no-rows`       — it is in the archive and parsed to no rows;
 *   - `skipped`       — it is in the archive, rows were parsed, and nothing was
 *                       stored because no column of it is allowlisted;
 *   - `ready`         — stored rows, every one of them (nothing is truncated).
 */
export type NewDataCardView =
  | { status: 'not-in-export' }
  | { status: 'no-rows' }
  | { status: 'skipped' }
  | {
      status: 'ready';
      /** Spec columns that at least one stored row carries, in spec order. */
      columns: readonly NewDataColumnView[];
      rows: readonly NewDataRowView[];
      /** Equal to `rows.length`; there is no "more rows" count (D-11). */
      rowCount: number;
    };

/** The HEAT card ids, in the order the pane shows them. */
export const HEAT_CARD_IDS = ['accountStats', 'battleTypes', 'storage', 'geolocation'] as const;

/** One HEAT card's id. */
export type HeatCardId = (typeof HEAT_CARD_IDS)[number];

/** The Warships crews-and-storage card ids, in pane order. */
export const WOWS_CARD_IDS = ['crews', 'storage'] as const;

/** One Warships card's id. */
export type WowsCardId = (typeof WOWS_CARD_IDS)[number];

/** Which lower-cased file feeds each HEAT card. */
export const HEAT_CARD_FILES: Readonly<Record<HeatCardId, string>> = {
  accountStats: 'heat_account_statistics.csv',
  battleTypes: 'heat_battle_types_statistics.csv',
  storage: 'heat_account_storage.csv',
  geolocation: 'heat_session_geolocation.csv',
};

/** Which lower-cased file feeds each Warships card. */
export const WOWS_CARD_FILES: Readonly<Record<WowsCardId, string>> = {
  crews: 'wows_crews.csv',
  storage: 'wows_account_storage.csv',
};

/**
 * The HEAT pane's detail view. The top level is ALWAYS `ready`, so the shared
 * finance state functions apply unchanged; each card carries its own state.
 */
export interface HeatView {
  status: 'ready';
  cards: Record<HeatCardId, NewDataCardView>;
}

/** The Warships crews-and-storage pane's detail view. */
export interface WarshipsStorageView {
  status: 'ready';
  cards: Record<WowsCardId, NewDataCardView>;
}
