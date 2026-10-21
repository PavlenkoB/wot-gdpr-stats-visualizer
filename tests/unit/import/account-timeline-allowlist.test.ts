// =============================================================================
// account-timeline-allowlist.test.ts — an email in ANY allowlisted cell is
// stored nowhere (12-08, D-01, T-12-24, PRIV-01)
// =============================================================================
//
// WHAT THIS PROVES
//
// A header allowlist cannot see inside an allowlisted column: a service
// identifier, a ban status, a third-party site or a survey answer can carry an
// email as its VALUE. `emailGuard` is the value-level answer, and it is set on
// all nine Phase 12 specs. This file plants the proof for every one of them:
//
//   - the file's captured header, three rows;
//   - row ONE and row THREE are the clean rows the Phase 11 fixture helper
//     builds, so the allowlisted values are really there to be stored;
//   - row TWO carries a distinct email-shaped string, on an `.example.invalid`
//     host, as the VALUE of EVERY allowlisted column of the file.
//
// All nine files go through one archive and the real ingest path. The assertions
// are: the entry still exists (three rows), the planted strings appear in no
// stored row and no meta record, and rows one and three keep every allowlisted
// value. The positive control comes first, so a pass cannot come from storing
// nothing at all.
// =============================================================================

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NEW_DATA_SPEC_FILES } from '../../../src/lib/worker/new-data-specs.ts';
import { CAPTURED_FILES, headersOf } from '../../fixtures/new-data-headers.ts';
import {
  NEW_DATA_FIXTURE_FILES,
  buildLargeTableCsv,
  buildNewDataFilesExport,
} from '../../fixtures/new-data-fixtures.ts';
import {
  deleteActiveDatabase,
  importWorkerDb,
  ingestExport,
  installWorkerScope,
  loadWorker,
  type WorkerPostSpy,
} from '../../helpers/worker-harness.ts';

/** The nine Phase 12 files, spelled out. The first test pins them to the spec flags. */
const PHASE12_KEYS: readonly string[] = [
  'account_name_history.csv',
  'authorized_third_parties.csv',
  'bans.csv',
  'bonus_code_usage.csv',
  'external_services_history.csv',
  'heat_surveys.csv',
  'language_and_country_history.csv',
  'personal_coupons.csv',
  'subscriptions.csv',
];

/** The email planted as the value of one allowlisted column of one file. */
function plantedEmail(key: string, header: string): string {
  const slug = `${key.replace(/[^a-z0-9]+/gi, '-')}-${header}`.toLowerCase();
  return `planted-${slug}@account-timeline.example.invalid`;
}

/** The spec columns of one file that the captured header also carries, in file order. */
function allowlistedHeaders(key: string): string[] {
  const spec = NEW_DATA_SPEC_FILES.find((candidate) => candidate.key === key);
  const captured = headersOf(key)?.headers ?? [];
  const allowed = new Set((spec?.columns ?? []).map((column) => column.header));
  return captured.filter((header) => allowed.has(header));
}

/** Three clean rows of one file, as header and body cells. */
function cleanRows(key: string): { header: string[]; rows: string[][] } {
  const lines = buildLargeTableCsv(key, 3)
    .split('\n')
    .filter((line) => line.length > 0);
  return { header: lines[0]!.split(','), rows: lines.slice(1).map((line) => line.split(',')) };
}

/** The CSV with row TWO's allowlisted cells replaced by planted emails. */
function csvWithPlantedRowTwo(key: string): string {
  const { header, rows } = cleanRows(key);
  const allowlisted = new Set(allowlistedHeaders(key));
  const planted = rows.map((cells, index) =>
    index !== 1
      ? cells
      : cells.map((cell, column) =>
          allowlisted.has(header[column]!) ? plantedEmail(key, header[column]!) : cell,
        ),
  );
  return [header.join(','), ...planted.map((cells) => cells.join(','))].join('\n') + '\n';
}

let post: WorkerPostSpy;

beforeEach(async () => {
  post = installWorkerScope();
  await deleteActiveDatabase();
  await loadWorker();
});

afterEach(async () => {
  await deleteActiveDatabase();
});

/** Import all nine files with their planted second rows, in one archive. */
async function importPlanted(): Promise<void> {
  const overrides = Object.fromEntries(PHASE12_KEYS.map((key) => [key, csvWithPlantedRowTwo(key)]));
  const terminal = await ingestExport(
    post,
    buildNewDataFilesExport(overrides),
    'account-timeline-planted.zip',
  );
  expect(terminal.type).toBe('done');
}

/** The stored rows of one file name, in file order. */
async function storedRows(sourceFile: string) {
  const { db } = await importWorkerDb();
  const all = await db.rows.toArray();
  return all
    .filter((row) => row.sourceFile === sourceFile)
    .sort((a, b) => a.rowIndex - b.rowIndex)
    .map((row) => row.data as Record<string, unknown>);
}

describe('12-08: the nine Phase 12 specs and their fixtures', () => {
  it('names exactly the specs that set emailGuard, and each has a fixture file', () => {
    const guarded = NEW_DATA_SPEC_FILES.filter((spec) => spec.emailGuard === true).map(
      (spec) => spec.key,
    );
    expect([...guarded].sort()).toEqual([...PHASE12_KEYS].sort());
    for (const key of PHASE12_KEYS) {
      expect(NEW_DATA_FIXTURE_FILES[key], key).toBeDefined();
      expect(
        CAPTURED_FILES.some((file) => file.key === key),
        key,
      ).toBe(true);
      expect(allowlistedHeaders(key).length, `${key} has allowlisted columns`).toBeGreaterThan(0);
    }
  });
});

describe('12-08: an email in every allowlisted cell of a second row (T-12-24)', () => {
  it('the planted file really does carry an email in every allowlisted cell of row two', () => {
    // Without this, the absence assertions below would pass against any build.
    for (const key of PHASE12_KEYS) {
      const { header, rows } = cleanRows(key);
      const csv = csvWithPlantedRowTwo(key);
      for (const column of allowlistedHeaders(key)) {
        const email = plantedEmail(key, column);
        expect(csv, `${key} / ${column}`).toContain(email);
        expect(header, key).toContain(column);
      }
      expect(rows, key).toHaveLength(3);
    }
  });

  it.each(PHASE12_KEYS)(
    '%s: the entry exists, the neighbouring rows keep their values and no email is stored',
    async (key) => {
      await importPlanted();

      const fileName = NEW_DATA_FIXTURE_FILES[key]!.fileName;
      const stored = await storedRows(fileName);
      const { header, rows } = cleanRows(key);
      const allowlisted = allowlistedHeaders(key);

      // The POSITIVE control: the entry exists, and rows one and three hold
      // every allowlisted value exactly as the clean file wrote it.
      expect(stored, `${key} stored rows`).toHaveLength(3);
      for (const index of [0, 2]) {
        for (const column of allowlisted) {
          const expected = rows[index]![header.indexOf(column)]!;
          expect(stored[index]![column], `${key} row ${index + 1} ${column}`).toBe(expected);
        }
      }
      // Row two still exists, with NO allowlisted value: every cell was an email.
      for (const column of allowlisted) {
        expect(column in stored[1]!, `${key} row 2 stored ${column}`).toBe(false);
      }

      // And no planted email, nor the host, is anywhere at rest.
      const { db } = await importWorkerDb();
      const rowsJson = JSON.stringify(await db.rows.toArray());
      const metaJson = JSON.stringify((await db.meta.get('active')) ?? null);
      for (const column of allowlisted) {
        const email = plantedEmail(key, column);
        expect(rowsJson, `${key} / ${column} in db.rows`).not.toContain(email);
        expect(metaJson, `${key} / ${column} in meta`).not.toContain(email);
      }
      expect(rowsJson).not.toContain('account-timeline.example.invalid');
      expect(metaJson).not.toContain('account-timeline.example.invalid');
    },
  );

  it('stores no planted email for any of the nine files, taken together', async () => {
    await importPlanted();

    const { db } = await importWorkerDb();
    const haystack = JSON.stringify([
      await db.rows.toArray(),
      (await db.meta.get('active')) ?? null,
    ]);
    for (const key of PHASE12_KEYS) {
      for (const column of allowlistedHeaders(key)) {
        expect(haystack, `${key} / ${column}`).not.toContain(plantedEmail(key, column));
      }
    }
  });
});
