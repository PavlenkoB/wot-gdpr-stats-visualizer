/**
 * The Account timeline builder (plan 12-11): a pure function that turns
 * account-grouped allowlisted rows of five history files into ONE merged,
 * newest-first chronology.
 *
 * ## Why this module exists
 *
 * TIMELINE-01 and TIMELINE-02 are one list across five files (D-06, D-07). The
 * builder is the only place that knows which column of which file is a date, a
 * primary value and a secondary part (`TIMELINE_ENTRY_MAP`); the pane only draws
 * what the view says and never learns a column name.
 *
 * ## The rules that shape every function here
 *
 * 1. **A cell is read through the spec's constant column ids and nowhere else**
 *    (PRIV-01, T-12-35). The builder asks each row for each id the SPEC names
 *    and never walks a row's own keys, so a legacy row that still carries an
 *    unnarrowed column cannot reach a view. A part's display kind is the spec
 *    column's, so an address-kind part is the canonical address or null and the
 *    page masks it (D-14).
 * 2. **The account of an entry is the group's, never a cell's** (D-03).
 * 3. **Four states per file, none implied** (D-09): not-in-export, no-rows,
 *    skipped, ready. A skipped, header-only or absent file is a state, never an
 *    error.
 * 4. **The merge lives here, not in storage** (D-10, D-12): there is no stored
 *    aggregate to drift from, so the lazy `v`-keyed rule holds by absence. Only
 *    `TIMELINE_MERGED_FILES` merge; name history, bans and third parties never
 *    do.
 * 5. **The sort lives on the worker, once** (UI-SPEC Recorded Choice 2). The
 *    order is a pure function of plain numbers, so a plain table and a windowed
 *    table show the same row in the same place, and tens of thousands of entries
 *    never sort on the main thread.
 *
 * Nothing here touches a worker global, Dexie, the DOM, a clock (no `Date` is
 * constructed) or the network, and nothing logs a row: a failing builder throws
 * and the caller's existing handler reports the error object's name only (the
 * T-06-01 rule).
 */

import { mergeIdenticalAcrossAccounts, flattenGroups } from '../new-data/account-merge.ts';
import { cellOf } from '../new-data/new-data-aggregate.ts';
import type { NewDataCell } from '../new-data/new-data-shared.ts';
import type { AccountRowGroup, CsvRow } from '../../worker/csv-columns.ts';
import {
  NEW_DATA_SPEC_FILES,
  type SpecColumn,
  type SpecFile,
} from '../../worker/new-data-specs.ts';
import {
  compareTimelineKeys,
  parseTimelineInstant,
  type TimelineSortKey,
} from './timeline-instant.ts';
import {
  MAX_TIMELINE_SECONDARY_PARTS,
  TIMELINE_ENTRY_MAP,
  TIMELINE_FILE_IDS,
  TIMELINE_MERGED_FILES,
  kindRank,
  type TimelineEntryMapping,
  type TimelineEntryView,
  type TimelineFileId,
  type TimelineFileState,
  type TimelineKind,
  type TimelinePart,
  type TimelineView,
} from './timeline-shared.ts';

/** What one file is fed: its rows per account, its presence, its parsed count. */
export interface TimelineFileInput {
  readonly groups: readonly AccountRowGroup[];
  readonly seen: boolean;
  /** Summed parsed-row count of the file's presence facts, or null when unknown. */
  readonly parsed: number | null;
}

/** The entry kind of a file that yields exactly one kind. */
const SINGLE_KIND: Readonly<Record<Exclude<TimelineFileId, 'languageCountry'>, TimelineKind>> = {
  name: 'name',
  service: 'service',
  bans: 'ban',
  thirdParties: 'thirdParty',
};

/** The null marker the export writes for an unset date (an open ban's end). */
const NULL_MARKER = '\\N';

/** The spec of one file key, or a thrown bug (the keys are the shared constants). */
function specOf(key: string): SpecFile {
  const spec = NEW_DATA_SPEC_FILES.find((candidate) => candidate.key === key);
  if (spec === undefined) throw new Error('unknown timeline spec');
  return spec;
}

/**
 * One row's value of one spec column, by the column's constant id and kind.
 * An own-property read, so an id such as `constructor` could never reach the
 * prototype chain; an unknown id is a bug in the mapping and throws.
 */
function reader(
  spec: SpecFile,
): (row: CsvRow, id: string | null | undefined) => TimelinePart | null {
  const byId = new Map<string, SpecColumn>(spec.columns.map((column) => [column.id, column]));
  return (row, id) => {
    if (id === null || id === undefined) return null;
    const column = byId.get(id);
    if (column === undefined) throw new Error('unknown timeline column');
    const raw = Object.hasOwn(row, column.id) ? row[column.id] : undefined;
    return { cell: cellOf(raw, column.kind), kind: column.kind };
  };
}

/** The file's own date text, or null when blank, N/A or the export's null marker. */
function dateTextOf(part: TimelinePart | null): string | null {
  if (part === null || typeof part.cell !== 'string') return null;
  return part.cell === NULL_MARKER ? null : part.cell;
}

/**
 * Which of the two a discriminator cell says its value holds.
 *
 * The capture records THAT the NAME column discriminates, not what it contains,
 * so the match is tolerant by design: the words `lang` and `countr` anywhere in
 * the lower-cased text, and a cell naming both (or neither) is neither. A value
 * the match cannot place yields no entry rather than a guess.
 */
function languageOrCountry(cell: NewDataCell): 'language' | 'country' | null {
  if (typeof cell !== 'string') return null;
  const text = cell.toLowerCase();
  const language = text.includes('lang');
  const country = text.includes('countr');
  if (language === country) return null;
  return language ? 'language' : 'country';
}

/** The ids a mapping lists after its primary, minus the ones an entry already shows. */
function secondaryIds(map: TimelineEntryMapping, without: readonly (string | null | undefined)[]) {
  const skip = new Set(without);
  const ids: string[] = [];
  for (const id of [map.primaryColumn, ...map.secondaryColumns]) {
    if (id === null || skip.has(id) || ids.includes(id)) continue;
    ids.push(id);
  }
  return ids;
}

/** One entry's parts: the primary, then up to the bound's worth of non-null secondaries. */
function partsOf(
  read: (row: CsvRow, id: string | null | undefined) => TimelinePart | null,
  row: CsvRow,
  primary: string | null | undefined,
  secondary: readonly string[],
): TimelinePart[] {
  const parts: TimelinePart[] = [];
  // A null primary stays a part with a null cell: the pane prints "not reported".
  const first = read(row, primary);
  parts.push(first ?? { cell: null, kind: 'text' });
  for (const id of secondary) {
    if (parts.length > MAX_TIMELINE_SECONDARY_PARTS) break;
    const part = read(row, id);
    if (part === null || part.cell === null) continue;
    parts.push(part);
  }
  return parts;
}

/** One file's state when it stored no row: the four-state rule of a card. */
function emptyStateOf(input: TimelineFileInput): TimelineFileState {
  if (!input.seen) return 'not-in-export';
  return input.parsed !== null && input.parsed > 0 ? 'skipped' : 'no-rows';
}

/**
 * Build the timeline view from the five files' inputs.
 *
 * `fileKeys` names the lower-cased file of each timeline file (null: the
 * capture has none, so the file answers `not-in-export`). `accountOrder` is the
 * stored account order (the identity header's), used only to break a tie
 * between two accounts' entries at the same instant; an account missing from it
 * ranks last. `entryMap` is the mapping to read through, a seam for tests that
 * need a shape the capture does not have.
 */
export function buildTimelineView(
  inputs: Readonly<Record<TimelineFileId, TimelineFileInput>>,
  fileKeys: Readonly<Record<TimelineFileId, string | null>>,
  accountOrder: readonly string[],
  entryMap: Readonly<Record<TimelineFileId, TimelineEntryMapping>> = TIMELINE_ENTRY_MAP,
): TimelineView {
  // A Map, never an object: an account root may be `__proto__` (T-09-27).
  const rankOfAccount = new Map<string, number>();
  accountOrder.forEach((root, index) => {
    if (!rankOfAccount.has(root)) rankOfAccount.set(root, index);
  });
  const unknownRank = accountOrder.length;

  const files = {} as Record<TimelineFileId, TimelineFileState>;
  const keyed: { entry: TimelineEntryView; key: TimelineSortKey }[] = [];
  let mergedAway = 0;
  let storedRows = 0;
  let sequence = 0;

  const push = (
    entry: TimelineEntryView,
    kind: TimelineKind,
    fileRank: number,
    accounts: readonly string[],
  ): void => {
    let accountRank = unknownRank;
    for (const account of accounts) {
      const rank = rankOfAccount.get(account);
      if (rank !== undefined && rank < accountRank) accountRank = rank;
    }
    keyed.push({
      entry,
      key: {
        instant: parseTimelineInstant(entry.date),
        kindRank: kindRank(kind),
        fileRank,
        accountRank,
        sequence: sequence++,
      },
    });
  };

  TIMELINE_FILE_IDS.forEach((file, fileRank) => {
    const fileKey = fileKeys[file];
    if (fileKey === null) {
      files[file] = 'not-in-export';
      return;
    }
    const spec = specOf(fileKey);
    const input = inputs[file];
    let stored = 0;
    for (const group of input.groups) stored += group.rows.length;
    if (stored === 0) {
      files[file] = emptyStateOf(input);
      return;
    }
    files[file] = 'ready';
    storedRows += stored;

    // D-11: the merge key is the spec's WHOLE column list, so a difference in
    // any allowlisted column keeps two rows apart.
    const result = TIMELINE_MERGED_FILES.has(file)
      ? mergeIdenticalAcrossAccounts(
          input.groups,
          spec.columns.map((column) => column.id),
        )
      : flattenGroups(input.groups);
    mergedAway += result.mergedAway;

    const map = entryMap[file];
    const read = reader(spec);
    for (const merged of result.rows) {
      const date = dateTextOf(read(merged.row, map.dateColumn));
      const make = (kind: TimelineKind, parts: TimelinePart[]): void =>
        push({ kind, date, parts, accounts: merged.accounts }, kind, fileRank, merged.accounts);

      if (file !== 'languageCountry') {
        make(SINGLE_KIND[file], partsOf(read, merged.row, map.primaryColumn, map.secondaryColumns));
        continue;
      }

      const { languageColumn, countryColumn, discriminatorColumn } = map;
      const value = (id: string | null | undefined): string[] =>
        secondaryIds(map, [languageColumn, countryColumn, discriminatorColumn, id]);
      if (discriminatorColumn !== null && discriminatorColumn !== undefined) {
        // One column holds either; the discriminator says which.
        const which = languageOrCountry(read(merged.row, discriminatorColumn)?.cell ?? null);
        if (which === null) continue;
        const column = which === 'language' ? languageColumn : countryColumn;
        const part = read(merged.row, column);
        if (part === null || part.cell === null) continue;
        make(which, partsOf(read, merged.row, column, value(column)));
      } else if (languageColumn !== countryColumn) {
        // Two columns: one entry per value present, sharing the row's date.
        for (const [kind, column] of [
          ['language', languageColumn],
          ['country', countryColumn],
        ] as const) {
          const part = read(merged.row, column);
          if (part === null || part.cell === null) continue;
          make(kind, partsOf(read, merged.row, column, value(column)));
        }
      }
    }
  });

  keyed.sort((a, b) => compareTimelineKeys(a.key, b.key));
  return {
    status: 'ready',
    entries: keyed.map((item) => item.entry),
    mergedAway,
    storedRows,
    files,
  };
}
