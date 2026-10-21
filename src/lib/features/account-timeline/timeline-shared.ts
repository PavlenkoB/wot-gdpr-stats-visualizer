/**
 * The Account timeline view contract.
 *
 * ## Why this module exists
 *
 * Two plans build this pane from opposite ends. Plan 12-11 is the WORKER-side
 * builder: it reads the five history files, maps their columns, parses the
 * dates, merges the cross-account duplicates and posts a view. Plan 12-12 is the
 * PAGE-side pane: it renders entries, chips, badges and the showing line off
 * that posted view. They must agree on the shape of an entry without either
 * importing the other, exactly as `new-data-shared.ts` lets the HEAT pane's
 * worker query and Svelte component agree.
 *
 * So the contract lives here, in ONE import-light module either side may read.
 * The only imports are TYPE-ONLY: `grep -v '^import type' timeline-shared.ts |
 * grep -c '^import'` printing 0 is the check that keeps it true, because a
 * runtime import here would put this module in both bundles and let the two
 * ends drift into a cycle.
 *
 * ## What is deliberately NOT here
 *
 * No column name and no date parsing. The five files' own columns come from the
 * Wave 0 header capture (plan 12-01) and are written into the worker's spec
 * table by plan 12-11; the instant parse lives in `timeline-instant.ts`. What
 * lives here is only what both ends must agree on: which kinds exist and in
 * what order, which files feed the pane, what one entry carries and what one
 * file's state is.
 *
 * ## Why the kinds are a fixed tuple and not a set
 *
 * The chronology's tie-break and the kind chips' order are both the fixed order
 * below (UI-SPEC Recorded Choice 2 and Surface 2). A caller that carried its own
 * list would be a second answer to the same question.
 */

import type { NewDataCell, NewDataColumnKind } from '../new-data/new-data-shared.ts';

// =============================================================================
// Kinds
// =============================================================================

/**
 * The six entry kinds, in the pane's fixed order.
 *
 * The order is load-bearing twice over: it is the chip row's order and it is
 * the tie-break for two entries carrying the same instant. Both are "Name,
 * Service, Language, Country, Ban, Third party" (UI-SPEC Recorded Choice 2).
 */
export const TIMELINE_KINDS = [
  'name',
  'service',
  'language',
  'country',
  'ban',
  'thirdParty',
] as const;

/** One timeline entry's kind. */
export type TimelineKind = (typeof TIMELINE_KINDS)[number];

/** The kind's position in {@link TIMELINE_KINDS}: the chronology's first tie-break. */
export function kindRank(kind: TimelineKind): number {
  return TIMELINE_KINDS.indexOf(kind);
}

// =============================================================================
// Files
// =============================================================================

/**
 * The five files the pane reads, in file order.
 *
 * The order is the chronology's SECOND tie-break after the kind, so a file's
 * position here is a display decision, not an alphabetical accident.
 */
export const TIMELINE_FILE_IDS = [
  'name',
  'service',
  'languageCountry',
  'bans',
  'thirdParties',
] as const;

/** One timeline file's id. */
export type TimelineFileId = (typeof TIMELINE_FILE_IDS)[number];

/**
 * The files whose identical rows merge across accounts, and only those.
 *
 * D-10's rule is worded generally but is evidenced for three files only — the
 * real sample shows Subscriptions, External_Services_History and
 * Language_And_Country_History repeating per account — so this is the two of
 * those three the timeline reads (UI-SPEC Recorded Choice 3). Name history,
 * bans and third parties never merge: a second account holding the same nickname
 * or the same ban is a fact about that account, not a duplicate to collapse.
 * Extending this is a one-line set change.
 */
export const TIMELINE_MERGED_FILES: ReadonlySet<TimelineFileId> = new Set<TimelineFileId>([
  'service',
  'languageCountry',
]);

/**
 * One file's state. Exactly one of four, and never implied (D-09) — the same
 * four the Perks cards carry, so one vocabulary covers both panes and a reader
 * never has to learn that "absent" and "present but empty" share a word.
 */
export type TimelineFileState = 'ready' | 'not-in-export' | 'no-rows' | 'skipped';

// =============================================================================
// Entries
// =============================================================================

/** How many secondary values one entry shows after its primary value. */
export const MAX_TIMELINE_SECONDARY_PARTS = 2;

/**
 * One value of one entry, with the kind of column it came from.
 *
 * The column kind is what the view layer reads to decide whether the value goes
 * through the IP mask before it can reach the DOM (Surface 4): a maskable
 * column is DECLARED, so a new column cannot reach the page unmasked by
 * omission.
 */
export interface TimelinePart {
  readonly cell: NewDataCell;
  readonly kind: NewDataColumnKind;
}

/**
 * One row of the one timeline table.
 *
 * `date` is the export's OWN text, or `null` when the cell is empty — never a
 * reformat, because the export's spelling is the only claim about the date that
 * is true of the user's data and not of the reader's clock (UI-SPEC Surface 2,
 * "Date"). An entry whose date the parser cannot read is STILL undated and
 * still shown; it simply sorts last.
 */
export interface TimelineEntryView {
  readonly kind: TimelineKind;
  /** The date as the export wrote it, or `null` for an undated entry. */
  readonly date: string | null;
  /** The primary value first, then at most {@link MAX_TIMELINE_SECONDARY_PARTS}. */
  readonly parts: readonly TimelinePart[];
  /** At least one root; more than one when the row merged across accounts. */
  readonly accounts: readonly string[];
}

/**
 * The timeline pane's detail view.
 *
 * The top level is ALWAYS `ready`, exactly like the HEAT, Warships and Perks
 * views, so the shared finance state functions apply unchanged and each FILE
 * carries its own state.
 *
 * `storedRows` and `mergedAway` are both here, and separately, because the list
 * headline and the provenance count STORED rows (UI-SPEC Recorded Choice 7) and
 * the merge note reconciles the two numbers in words. A pane may not publish a
 * merged count on `ClassifyResult` (RESEARCH Pitfall 12).
 */
export interface TimelineView {
  status: 'ready';
  /** Newest first, undated last, ties by kind, file, account then input order. */
  entries: readonly TimelineEntryView[];
  /** Stored rows the cross-account merge collapsed. Zero when nothing merged. */
  mergedAway: number;
  /** Rows as stored, before merging. The headline and provenance figure. */
  storedRows: number;
  files: Record<TimelineFileId, TimelineFileState>;
}

// =============================================================================
// The entry mapping (plan 12-11)
// =============================================================================

/**
 * Which stored column becomes what in one timeline file's entries.
 *
 * Every name is a SPEC COLUMN ID (`worker/new-data-specs.ts`), never a header
 * label and never a name read from a file: the worker reads each cell through
 * the spec's constant ids, so a column this table names that the spec does not
 * is a bug a unit test catches (it cannot silently blank a kind).
 *
 * `dateShape` is the pattern text the user recorded for `dateColumn` in the
 * plan 12-01 capture (`DATE_SHAPES`), kept here so the shape each file is read
 * under is written beside the column and the mapping test can assert that the
 * instant parse reads it.
 *
 * `discriminatorColumn` is set when ONE column holds either a language or a
 * country and a second column says which (the Language_And_Country_History
 * file: `VALUE` is both and `NAME` discriminates). Without it, `languageColumn`
 * and `countryColumn` are two separate columns and a row yields one entry per
 * value present.
 */
export interface TimelineEntryMapping {
  readonly dateColumn: string | null;
  readonly dateShape: string | null;
  readonly primaryColumn: string | null;
  /** At most {@link MAX_TIMELINE_SECONDARY_PARTS}; the language/country file lists more and the builder trims. */
  readonly secondaryColumns: readonly string[];
  readonly languageColumn?: string | null;
  readonly countryColumn?: string | null;
  readonly discriminatorColumn?: string | null;
}

/**
 * The per-file mapping, transcribed from the Pane mapping of `12-HEADERS.md`.
 *
 * The capture is the ONLY source of these names. A null column means the
 * capture has none; an all-null entry is a kind the user removed at the plan
 * 12-01 completeness gate (none was), and the builder answers it
 * `not-in-export`.
 *
 * Language and country: `VALUE` is both the language and the country column and
 * `NAME` discriminates. The entry's primary part is the VALUE (the language or
 * the country itself); its secondary parts are this entry's `primaryColumn` and
 * `secondaryColumns` MINUS the value column and the discriminator (the kind
 * badge already says language or country), which leaves the OPERATION.
 */
export const TIMELINE_ENTRY_MAP: Readonly<Record<TimelineFileId, TimelineEntryMapping>> = {
  name: {
    dateColumn: 'CREATED_AT',
    dateShape: 'YYYY-MM-DD HH:MM:SS.mmm',
    primaryColumn: 'OLD_NAME',
    secondaryColumns: ['NEW_NAME'],
  },
  service: {
    dateColumn: 'CREATED_AT',
    dateShape: 'YYYY-MM-DD HH:MM:SS.mmm',
    primaryColumn: 'OPERATION',
    secondaryColumns: ['NAME'],
  },
  languageCountry: {
    dateColumn: 'CREATED_AT',
    dateShape: 'YYYY-MM-DD HH:MM:SS.mmm',
    primaryColumn: 'OPERATION',
    secondaryColumns: ['NAME', 'VALUE'],
    languageColumn: 'VALUE',
    countryColumn: 'VALUE',
    discriminatorColumn: 'NAME',
  },
  bans: {
    dateColumn: 'STARTED_AT',
    dateShape: 'YYYY-MM-DD HH:MM:SS.mmm',
    primaryColumn: 'STATUS',
    secondaryColumns: [],
  },
  thirdParties: {
    dateColumn: 'CREATED_AT',
    dateShape: 'YYYY-MM-DD HH:MM:SS.mmm',
    primaryColumn: 'THIRD_PARTY_SITE',
    secondaryColumns: [],
  },
};
