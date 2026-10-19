// =============================================================================
// new-data-parity.test.ts — the allowlist does not change the Warplanes table
// =============================================================================
//
// WHAT THIS PROVES
//
// Plan 11-03 made every Warplanes file fail closed through a per-file column
// allowlist. The Warplanes table was already reading a set of headers from those
// same files, so the failure mode this guards is specific and silent: an
// allowlist NARROWER than its reader blanks a column the table shows today, and
// every cell of it reads "not in export" (11-RESEARCH Pitfall 2, T-11-10).
//
// So the property is a PARITY, not a fixture assertion. For each of two archive
// shapes the test asks the REAL worker for `vehicles` title `wowp`, and builds
// the expected view by parsing the very same CSV text with `parseCsvFile` and
// calling `buildVehicleView` DIRECTLY — the unprojected path the allowlist
// replaced. Deep equality of `rows`, `columns` and `header` then says the
// projection changed nothing a reader can see.
//
// ## The two shapes, and why there are two
//
//   - The CAPTURED headers, from the user's own export via the 11-03 fixtures.
//   - The 2021 shape `tests/fixtures/player-stats-fixtures.ts` still ships, which
//     is a NARROWER header (13 columns on the 19 plane file, and `NAME` on both
//     account files). A spec that only admitted what this capture holds would
//     still fill today's table and would empty it on the next revision — so the
//     older shape is the case that actually needs the superset guard.
//
// `overview`, `titleState` and `summary` are deliberately NOT compared: they
// answer whether a title is present in the ZIP, which is a property of the
// archive's other files rather than of the projection under test.
// =============================================================================

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  VEHICLE_FILE_NAMES,
  buildVehicleView,
  type VehicleFileFacts,
} from '../../../src/lib/features/vehicles/vehicle-aggregate.ts';
import type { VehicleView } from '../../../src/lib/features/vehicles/vehicle-shared.ts';
import { parseCsvFile } from '../../../src/lib/worker/csv-parse.ts';
import {
  deleteActiveDatabase,
  ingestExport,
  installWorkerScope,
  loadWorker,
  postRequest,
  waitForMessage,
  type WorkerPostSpy,
} from '../../helpers/worker-harness.ts';
import { oneAccount } from '../../helpers/row-groups.ts';
import { CAPTURED_FILES } from '../../fixtures/new-data-headers.ts';
import {
  NEW_DATA_FIXTURE_FILES,
  buildNewDataFilesExport,
} from '../../fixtures/new-data-fixtures.ts';
import { PLAYER_STATS_SAMPLE_FILES } from '../../fixtures/player-stats-fixtures.ts';
import { SAMPLE_ACCOUNT_ROOT, buildSampleExport } from '../../fixtures/export-fixtures.ts';
import type { DataQuery, IngestResponse } from '../../../src/lib/core/types/worker-messages.ts';

/** The four files the Warplanes title reads, by the builder's own lower-cased names. */
const WOWP_FILES = [
  'wowp_19_plane_statistics.csv',
  'wowp_19_account_statistics.csv',
  'wowp_20_account_statistics.csv',
  'wowp_20_plane_statistics.csv',
] as const;

/**
 * The account each archive's single root carries.
 *
 * The worker stamps the OWNING ROOT on every stored row (D-07), and the builder
 * copies it onto every row it builds, so the expected view has to be built over
 * the SAME account id or the two differ in a field the projection never touched.
 * The new-game fixture root and the sample export's root are different numbers,
 * which is why this is a parameter rather than a constant.
 */
const NG_ROOT = '610000001';

/** The name the CAPTURE spells a lower-cased file name with. */
function displayName(key: string): string {
  return CAPTURED_FILES.find((file) => file.key === key)?.fileName ?? key.toUpperCase();
}

/**
 * The `VehicleFiles` map the pure builder takes, built from CSV TEXT.
 *
 * This is deliberately the path the allowlist replaced: `parseCsvFile` over the
 * file as written, no projection, every column the header carried. A file the
 * map does not know is explicitly UNSEEN rather than absent, because
 * `factsOf` reads the two the same way and stating all sixteen keeps the map's
 * shape independent of what this particular archive held.
 */
function vehicleFilesFrom(
  csvs: Readonly<Record<string, string>>,
  account = NG_ROOT,
): Map<string, VehicleFileFacts> {
  const files = new Map<string, VehicleFileFacts>();
  for (const name of VEHICLE_FILE_NAMES) {
    const csv = csvs[name];
    files.set(
      name,
      csv === undefined
        ? { groups: [], seen: false }
        : {
            groups: oneAccount(
              parseCsvFile(csv, 'Player_Statistics', displayName(name)).rows.map((row) => row.data),
              account,
            ),
            seen: true,
          },
    );
  }
  return files;
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

/** Ingest an archive, asking for the Warplanes view through the real worker. */
async function warplanesView(bytes: Uint8Array, name: string): Promise<VehicleView> {
  const terminal = await ingestExport(post, bytes, name);
  expect(terminal.type, name).toBe('done');
  post.mockClear();
  const query: DataQuery = { channel: 'vehicles', title: 'wowp', battleType: null };
  postRequest({ type: 'data-query', queryId: 91, query });
  const reply = await waitForMessage(post, 'data-result', 5_000);
  if (reply.type !== 'data-result' || reply.result === null) {
    throw new Error(`no data-result for ${name}`);
  }
  const result = reply.result;
  if (result.channel !== 'vehicles') throw new Error(`wrong channel: ${result.channel}`);
  return result.view as VehicleView;
}

/** Assert the two views agree on everything a reader of the table can see. */
function expectSameTable(answered: VehicleView, expected: VehicleView, label: string): void {
  expect(answered.titleState, `${label} title state`).toBe(expected.titleState);
  expect(answered.rows, `${label} rows`).toEqual(expected.rows);
  expect(answered.columns, `${label} columns`).toEqual(expected.columns);
  expect(answered.header, `${label} header`).toEqual(expected.header);
  // A table of no rows would make every comparison above vacuous.
  expect(answered.rows.length, `${label} row count`).toBeGreaterThan(0);
}

describe('11-03 parity: the Warplanes view survives the allowlist unchanged', () => {
  it('matches the unprojected parse over the CAPTURED headers', async () => {
    const answered = await warplanesView(buildNewDataFilesExport(), 'captured.zip');
    const expected = buildVehicleView(
      vehicleFilesFrom(
        Object.fromEntries(WOWP_FILES.map((key) => [key, NEW_DATA_FIXTURE_FILES[key]!.csv])),
      ),
      { title: 'wowp', battleType: null },
    );
    expectSameTable(answered, expected, 'captured');
  });

  it('matches the unprojected parse over the 2021 SHAPE the sample fixtures ship', async () => {
    const answers2021 = Object.fromEntries(
      WOWP_FILES.map((key) => [key, PLAYER_STATS_SAMPLE_FILES[displayName(key)]!]),
    );
    const answered = await warplanesView(buildNewDataFilesExport(answers2021), 'legacy-shape.zip');
    const expected = buildVehicleView(vehicleFilesFrom(answers2021), {
      title: 'wowp',
      battleType: null,
    });
    expectSameTable(answered, expected, '2021');
  });

  it('matches the unprojected parse over the whole shipped sample export', async () => {
    const answered = await warplanesView(buildSampleExport(), 'sample.zip');
    const sampleCsvs: Record<string, string> = {};
    for (const name of VEHICLE_FILE_NAMES) {
      const csv = PLAYER_STATS_SAMPLE_FILES[displayName(name)];
      if (csv !== undefined) sampleCsvs[name] = csv;
    }
    const expected = buildVehicleView(vehicleFilesFrom(sampleCsvs, SAMPLE_ACCOUNT_ROOT), {
      title: 'wowp',
      battleType: null,
    });
    expectSameTable(answered, expected, 'sample');
  });

  it('keeps the account header and the note the three cases depend on', async () => {
    // A parity test over an empty table would pass for a spec that dropped every
    // column, so the two facts the header and the note are built from are named
    // explicitly rather than left to the deep equality above.
    const answered = await warplanesView(buildNewDataFilesExport(), 'captured.zip');
    expect(answered.header, 'the account header reads its own files').not.toBeNull();
    expect(answered.wowp20, 'the 20 plane file is a note, not a table').not.toBeNull();
    expect((answered.wowp20 as { battles?: unknown }).battles).toBeDefined();
    // The Vehicle cell is the FIRST core column, and it is the only identifier
    // in any captured Warplanes file, so an empty id is what a spec that dropped
    // `VEHICLE_NAME` would produce.
    const first = answered.rows[0]!;
    expect(first.id, 'the 19 plane file still names its vehicles').not.toBe('');
    expect(first.cells[0]?.v, 'the Vehicle cell is a name, not a special').not.toBe('missing');
  });
});

/** The reply union the ask above narrows, kept so an import is not unused. */
export type DataResultReply = Extract<IngestResponse, { type: 'data-result' }>;
