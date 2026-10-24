// =============================================================================
// overview-inputs.ts — the archive-to-inputs bridge (13-08, Task 1)
//
// WHAT THIS IS FOR
// The Overview's builders are pure functions over an `OverviewInputs`, and the
// answer key (`tests/helpers/overview-oracle.ts`) describes an ARCHIVE. This
// module is the seam between the two: it unzips a fixture archive, parses its
// files with the PRODUCTION parser, and hands the builders the same shape the
// worker hands them.
//
// WHY THE PRODUCTION PARSER
// The rows a builder reads are the rows the importer would have stored. A
// helper that parsed the archive with its own little CSV reader would prove
// the builders against a DIFFERENT dataset than the one the worker builds, and
// a header that the real parser withholds (a glued sensitive column, an
// unterminated quote) would silently become a row here. So this module calls
// `parseCsvFile` — the same function the ingest worker calls — and
// `buildPlaytimeFromSources` — the same function the aggregator calls.
//
// THE IMPORT RULE
// This is the ONE fixture-adjacent file allowed to import `src/`. The fixture
// module itself (`tests/fixtures/overview-fixtures.ts`) imports nothing from
// `src/`, and the answer key imports nothing at all, so a wrong aggregator and
// a wrong fixture cannot agree by accident. This helper is the bridge, and it
// is deliberately boring: it reads files and shapes groups.
//
// IT NEVER READS A REAL EXPORT
// It takes BYTES, and the only archives the suite passes to it are built by
// the synthetic fixture. Every figure in them is invented (leak guard).
// =============================================================================

import { strFromU8, unzipSync } from 'fflate';
import type { AccountRowGroup, CsvRow } from '../../src/lib/worker/csv-columns.ts';
import { parseCsvFile } from '../../src/lib/worker/csv-parse.ts';
import {
  buildPlaytimeFromSources,
  isSessionsRow,
  sessionFileNameGame,
  type SessionSource,
} from '../../src/lib/features/playtime/playtime-aggregate.ts';
import type { OverviewFileInput } from '../../src/lib/features/overview/overview-aggregate.ts';

// -----------------------------------------------------------------------------
// The file names this helper looks for
// -----------------------------------------------------------------------------

/** The World of Tanks account-statistics file. */
const ACCOUNT_STATS_FILE = 'wot_account_statistics.csv';
/** The World of Tanks vehicle-statistics file. */
const VEHICLE_STATS_FILE = 'wot_vehicle_statistics.csv';
/** The virtual-currency operations log. */
const CURRENCY_FILE = 'virtual_currencies_operations.csv';
/** The payment orders file. */
const ORDERS_FILE = 'orders.csv';

/** The categories the four files live in, lower-cased. */
const PLAYER_STATS_CATEGORY = 'player_statistics';
const FINANCIAL_CATEGORY = 'financial_data';
const PAYMENT_CATEGORY = 'payment_history';

// -----------------------------------------------------------------------------
// The shapes
// -----------------------------------------------------------------------------

/** One file's rows, per account root. */
type RowsByRoot = Map<string, CsvRow[]>;

/** Every file the Overview reads, keyed by the file's key. */
type RowsByFile = Map<string, RowsByRoot>;

/**
 * Everything the Overview's builders read out of one archive.
 *
 * The four file inputs mirror the worker's own: the rows grouped per account
 * root, and a `seen` flag saying the file was in the export at all.
 */
export interface OverviewArchiveInputs {
  /** One entry per session file in the archive, in the order they appear. */
  sessionSources: SessionSource[];
  /** The World of Tanks account statistics. */
  accountStats: OverviewFileInput;
  /** The World of Tanks vehicle statistics. */
  vehicleStats: OverviewFileInput;
  /** The virtual currencies operations log. */
  currency: OverviewFileInput;
  /** The payment orders. */
  orders: OverviewFileInput;
  /** How many account roots the archive holds. */
  accountCount: number;
}

/**
 * One archive entry, once it is split into its three parts.
 *
 * The archive's own shape is `root/folder/name.csv`, so the root is the
 * account folder, the folder segment is the CATEGORY and the last segment is
 * the file name the importer stores.
 */
interface ArchiveEntry {
  /** The account root that owns the file. */
  root: string;
  /** The folder segment, which is the category. */
  category: string;
  /** The file's own name. */
  sourceFile: string;
  /** The file's text. */
  text: string;
}

// -----------------------------------------------------------------------------
// The reader
// -----------------------------------------------------------------------------

/**
 * Read an archive into the inputs the Overview's builders take.
 *
 * Only the files the Overview READS are parsed: the session files and the
 * four statistics files. The rest of the archive — the identity file, the
 * known-deferred folders — is left alone, so a canary planted in a file the
 * Overview never reads is never even parsed here.
 */
export function overviewInputsFromArchive(bytes: Uint8Array): OverviewArchiveInputs {
  const entries = entriesOf(bytes);

  const sessionSources: SessionSource[] = [];
  const groups: RowsByFile = new Map<string, RowsByRoot>();
  const seen = new Set<string>();

  for (const entry of entries) {
    if (isSessionsRow(entry.category, entry.sourceFile)) {
      const rows = parseCsvFile(entry.text, entry.category, entry.sourceFile).rows.map(
        (row) => row.data,
      );
      sessionSources.push({ game: sessionFileNameGame(entry.sourceFile), rows });
      continue;
    }

    const key = keyOf(entry);
    if (key === null) continue;
    const rows = parseCsvFile(entry.text, entry.category, entry.sourceFile).rows.map(
      (row) => row.data,
    );
    seen.add(key);
    const perRoot: RowsByRoot = groups.get(key) ?? new Map<string, CsvRow[]>();
    perRoot.set(entry.root, rows);
    groups.set(key, perRoot);
  }

  // The roots, in the order the archive names them the first time.
  const roots: string[] = [];
  for (const entry of entries) {
    if (!roots.includes(entry.root)) roots.push(entry.root);
  }

  return {
    sessionSources,
    accountStats: fileInputOf(groups, seen, ACCOUNT_STATS_FILE, roots),
    vehicleStats: fileInputOf(groups, seen, VEHICLE_STATS_FILE, roots),
    currency: fileInputOf(groups, seen, CURRENCY_FILE, roots),
    orders: fileInputOf(groups, seen, ORDERS_FILE, roots),
    accountCount: roots.length,
  };
}

/**
 * The playtime aggregate of an archive, built by the production builder.
 *
 * `sessionsFileSeen` is true when the archive held ANY session file, which is
 * what separates "no session file at all" from "a session file with no usable
 * row" (D-04 of the playtime pane).
 */
export function overviewPlaytimeFromArchive(bytes: Uint8Array) {
  const inputs = overviewInputsFromArchive(bytes);
  return buildPlaytimeFromSources(inputs.sessionSources, inputs.sessionSources.length > 0);
}

// -----------------------------------------------------------------------------
// The pieces
// -----------------------------------------------------------------------------

/**
 * Every entry of the archive, split into root, category and file name.
 *
 * The archive's own shape decides the split: the FIRST segment is the account
 * root, the LAST is the file name, and the segment between them is the
 * category. An entry with fewer than three segments is not a file this
 * importer would have stored, so it is skipped.
 */
function entriesOf(bytes: Uint8Array): ArchiveEntry[] {
  const files = unzipSync(bytes);
  const entries: ArchiveEntry[] = [];
  for (const name of Object.keys(files).sort()) {
    const segments = name.split('/').filter((segment) => segment !== '');
    if (segments.length < 3) continue;
    entries.push({
      root: segments[0]!,
      category: segments[segments.length - 2]!,
      sourceFile: segments[segments.length - 1]!,
      text: strFromU8(files[name]!),
    });
  }
  return entries;
}

/**
 * The key of one file, or null when the entry is not one of the four the
 * Overview reads.
 *
 * The CATEGORY is part of the key: a same-named file of another folder is not
 * this file, which is the rule the worker's own channel table applies.
 */
function keyOf(entry: ArchiveEntry): string | null {
  const file = entry.sourceFile.toLowerCase();
  const category = entry.category.toLowerCase();
  if (category === PLAYER_STATS_CATEGORY) {
    if (file === ACCOUNT_STATS_FILE) return ACCOUNT_STATS_FILE;
    if (file === VEHICLE_STATS_FILE) return VEHICLE_STATS_FILE;
    return null;
  }
  if (category === FINANCIAL_CATEGORY && file === CURRENCY_FILE) return CURRENCY_FILE;
  if (category === PAYMENT_CATEGORY && file === ORDERS_FILE) return ORDERS_FILE;
  return null;
}

/**
 * One file's groups — one per account root, in root order — and its presence.
 *
 * A root the file is missing from contributes NO group, exactly as the
 * worker's own reader does: "this account has no such file" and "this file
 * has no rows" are different answers.
 */
function fileInputOf(
  groups: RowsByFile,
  seen: Set<string>,
  key: string,
  roots: readonly string[],
): OverviewFileInput {
  const perRoot = groups.get(key);
  const list: AccountRowGroup[] = [];
  for (const root of roots) {
    const rows = perRoot?.get(root);
    if (rows === undefined) continue;
    list.push({ account: root, rows });
  }
  return { groups: list, seen: seen.has(key) };
}
