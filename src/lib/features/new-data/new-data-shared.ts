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

// =============================================================================
// The Perks card contract (plan 12-02)
// =============================================================================
//
// The Perks pane is four cards in a FIXED order (D-08): Subscriptions, Personal
// coupons, Bonus codes, Surveys. Their file names come from the Wave 0 header
// capture (plan 12-01, `12-HEADERS.md` Pane mapping) and were written into the
// contract by plan 12-08.
//
// A `null` names NO FILE, and a card with no file answers `not-in-export`.
// That is not a placeholder: it is the honest answer for an export that holds
// no such file, and it is the same answer a reader of the real export would
// get. No card is `null` today because the capture held a file for each, but
// the type keeps the case so a removed card needs no new shape. The order of
// the four ids is fixed and never re-derived.
//
// This block sits ABOVE the pane tables on purpose: the pane's own file list
// is computed from the card files, so the two cannot drift apart and one
// table (the card map) is the only place a later plan has to edit.
export const PERKS_CARD_IDS = ['subscriptions', 'coupons', 'bonusCodes', 'surveys'] as const;

/** One Perks card's id. */
export type PerksCardId = (typeof PERKS_CARD_IDS)[number];

/**
 * Which lower-cased file feeds each Perks card, or `null` when the card names
 * no file yet.
 *
 * A `null` is a card with no file, and the card answers `not-in-export`. It is
 * NOT a "not implemented" marker: the export really may hold no such file.
 */
export const PERKS_CARD_FILES: Readonly<Record<PerksCardId, string | null>> = {
  subscriptions: 'subscriptions.csv',
  coupons: 'personal_coupons.csv',
  bonusCodes: 'bonus_code_usage.csv',
  surveys: 'heat_surveys.csv',
};

// =============================================================================
// The Account timeline file contract (plan 12-11)
// =============================================================================
//
// The Account timeline pane reads five history files (D-06, D-07). Their file
// names come from the Wave 0 header capture (plan 12-01, `12-HEADERS.md` Pane
// mapping). The keys are spelled out as inline literals, in the file order of
// `TIMELINE_FILE_IDS` (`account-timeline/timeline-shared.ts`), because this
// module may not import it: the two are kept aligned by a unit test instead.
//
// A `null` names NO FILE (the kind was removed at the completeness gate), and
// the timeline builder answers it `not-in-export`. None is null today because
// the capture held a file for each.
export const TIMELINE_FILE_KEYS: Readonly<
  Record<'name' | 'service' | 'languageCountry' | 'bans' | 'thirdParties', string | null>
> = {
  name: 'account_name_history.csv',
  service: 'external_services_history.csv',
  languageCountry: 'language_and_country_history.csv',
  bans: 'bans.csv',
  thirdParties: 'authorized_third_parties.csv',
};

/**
 * The pane ids, in the order the list shows them.
 *
 * A tuple rather than a set of string literals so `NewDataPaneId` cannot drift
 * away from the ids the file table names, and so a caller can iterate the panes
 * in presentation order without carrying its own list.
 *
 * The third id is the Perks pane (12-02). It is the THIRD optional pane and
 * the first one whose list position is NOT next to the other two: the Perks
 * row sits with the money rows (12-UI-SPEC Recorded Choice 1), which is a
 * `PANE_ORDER` edit rather than an edit here.
 *
 * The fourth id is the Account timeline pane (12-11), the fifth optional pane
 * of the milestone's plan but the FOURTH id here (HEAT, Warships and Perks come
 * first). It sits directly above Account, again a `PANE_ORDER` edit.
 */
export const NEW_DATA_PANE_IDS = ['heat', 'warships-storage', 'perks', 'account-timeline'] as const;

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
 *
 * The Perks pane's list is COMPUTED from the card contract above rather than
 * written out again, so the pane's files and the cards' files cannot drift
 * apart: one table (the card map) is the only place a later plan has to edit.
 * The Account timeline pane's list is computed the same way, from
 * {@link TIMELINE_FILE_KEYS}.
 */
export const NEW_DATA_PANE_FILES: Readonly<Record<NewDataPaneId, readonly string[]>> = {
  heat: [
    'heat_account_statistics.csv',
    'heat_battle_types_statistics.csv',
    'heat_account_storage.csv',
    'heat_session_geolocation.csv',
  ],
  'warships-storage': ['wows_crews.csv', 'wows_account_storage.csv'],
  perks: PERKS_CARD_IDS.map((id) => PERKS_CARD_FILES[id]).filter(
    (file): file is string => file !== null,
  ),
  // 12-11. Computed from the timeline file table, in file order, so the pane's
  // files and the reader's files cannot drift apart.
  'account-timeline': Object.values(TIMELINE_FILE_KEYS).filter(
    (file): file is string => file !== null,
  ),
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
// The pane views (plan 11-07, extended by plan 12-02)
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
export type NewDataColumnKind = 'text' | 'number' | 'date' | 'address' | 'code';

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
  /**
   * Every contributing account root of a MERGED row (at least two), with
   * `account` always the first of them. Absent on every row the Phase 11
   * builders produce, so the optional field keeps every Phase 11 consumer
   * unchanged (D-10).
   */
  readonly accounts?: readonly string[];
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

/**
 * The Perks pane's detail view (plan 12-02).
 *
 * The top level is ALWAYS `ready`, exactly like the HEAT and Warships views, so
 * the shared finance state functions apply unchanged and each card carries its
 * own state (D-08: a card whose file is absent shows an empty state, never an
 * error).
 *
 * `mergedAway` is how many STORED rows the cross-account merge removed — zero
 * until plan 12-10 adds the merge, and a number rather than a flag so the pane
 * can word the merge note without a second shape (D-10).
 */
export interface PerksView {
  status: 'ready';
  cards: Record<PerksCardId, NewDataCardView>;
  /** Stored rows the cross-account merge collapsed. Zero until plan 12-10. */
  mergedAway: number;
}
