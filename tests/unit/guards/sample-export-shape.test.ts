import { describe, expect, test } from 'vitest';
import { unzipSync } from 'fflate';
import { SAMPLE_ACCOUNT_ROOT, buildSampleExport } from '../../fixtures/export-fixtures.ts';
import {
  PLAYER_STATS_SAMPLE_FILES,
  STATS_NAME_CANARY,
} from '../../fixtures/player-stats-fixtures.ts';
import { ORDERS_HEADER_12 } from '../../fixtures/finance-fixtures.ts';

// =============================================================================
// 05-06 — the shared sample's PHYSICAL shape
// =============================================================================
//
// Why this file exists (05-06-PLAN Task 3, behaviour block):
//   05-06 rewrote the sample's three Phase 5 folders to be written by the
//   fixture modules of 05-01 and 05-02 rather than transcribed here. That
//   change is invisible to every other test in the repo, and it is exactly
//   the kind of change that can be silently UNDONE: wrap the CSV text in a
//   CRLF, or let a future `sampleEntries()` edit re-add a leading newline,
//   and every count assertion in the suite still passes — because PapaParse
//   accepts CRLF, LF and bare CR alike. The sample would quietly stop being
//   the real format it was rewritten to be, with nothing failing.
//
//   So this file pins the BYTES, not the meaning:
//
//     - the file SET in the three Phase 5 folders, against the fixture
//       module that owns each name (a renamed file fails here);
//     - the physical shape — unquoted header, quote-all data cells, bare-CR
//       terminator, and NO line feed anywhere in those files;
//     - the NAME canary, confined to the five account files, so the leak
//       tests 05-07 will add have a value that is actually there to find;
//     - and, as the control that makes the above meaningful, the OTHER
//       sample files keeping their CRLF style — so the sample still covers
//       both terminators and the assertion above is not vacuous.
//
// Nothing here imports the worker or a parser on purpose: these are BYTE
// claims, and a parser would happily normalise away the very thing being
// asserted.
// =============================================================================

const CR = '\r';
const LF = '\n';

/** The three Phase 5 folders this test owns, by their real folder name. */
const PHASE5_FOLDERS = ['Player_statistics', 'Financial_data', 'Payment_history'] as const;

/** Entries of one folder in the sample archive, as full archive paths. */
function entriesIn(folder: string): { path: string; baseName: string; text: string }[] {
  const inflated = unzipSync(buildSampleExport());
  return Object.keys(inflated)
    .filter((path) => path.startsWith(`${SAMPLE_ACCOUNT_ROOT}/${folder}/`))
    .sort()
    .map((path) => ({
      path,
      baseName: path.slice(`${SAMPLE_ACCOUNT_ROOT}/${folder}/`.length),
      text: new TextDecoder('utf-8').decode(inflated[path]!),
    }));
}

/** The lines of a rendered fixture file, split on its bare CR terminator. */
function linesOf(text: string): string[] {
  return text.split(CR);
}

describe('05-06 shared sample physical shape', () => {
  describe('the file set in the three Phase 5 folders', () => {
    test('Player_statistics holds exactly the nineteen real-named files, and no invented one', () => {
      const entries = entriesIn('Player_statistics');
      expect(entries).toHaveLength(19);
      // Base names equal the keys of the fixture module that owns them, so a
      // rename on either side fails here instead of quietly shipping.
      expect(entries.map((e) => e.baseName).sort()).toEqual(
        Object.keys(PLAYER_STATS_SAMPLE_FILES).sort(),
      );
      // Spot-check the two shapes that are easiest to lose: the main file of
      // a title and the account file whose NAME column carries the canary.
      expect(entries.map((e) => e.baseName)).toContain('WOT_Vehicle_Statistics.csv');
      expect(entries.map((e) => e.baseName)).toContain('WOWP_20_Plane_Statistics.csv');
    });

    test('Financial_data holds the two real operations files, Payment_history the one Orders file', () => {
      expect(entriesIn('Financial_data').map((e) => e.baseName)).toEqual([
        'Operations_with_Premium_Days.csv',
        'Virtual_Currencies_Operations.csv',
      ]);
      expect(entriesIn('Payment_history').map((e) => e.baseName)).toEqual(['Orders.csv']);
    });

    test('no file anywhere in the sample carries an invented statistics name', () => {
      // The pattern is checked by CONCEPT, not by the four literal names the
      // rewrite removed: a file is invented if it ends `_stats.csv`, and the
      // real files are all `*_Statistics.csv` / `*_Statistics_by_Type.csv`.
      const inflated = unzipSync(buildSampleExport());
      const invented = Object.keys(inflated).filter((path) => path.endsWith('_stats.csv'));
      expect(invented).toEqual([]);
    });
  });

  describe('the physical format of those files', () => {
    test('every file in the three folders is header-unquoted, quote-all, bare CR, with no line feed', () => {
      for (const folder of PHASE5_FOLDERS) {
        const entries = entriesIn(folder);
        expect(entries.length, `${folder} is not empty`).toBeGreaterThan(0);
        for (const { path, text } of entries) {
          // The load-bearing one: a single LF anywhere in these files means
          // the file is no longer in the export's payments-era format, and
          // every count in the suite would still pass.
          expect(text, `${path} contains a line feed`).not.toContain(LF);

          const [header = '', ...rows] = linesOf(text);
          // A trailing CR leaves one empty final element; every real line
          // before it must be populated.
          expect(rows.at(-1), `${path} does not end on a terminator`).toBe('');
          const dataRows = rows.slice(0, -1);
          expect(dataRows.length, `${path} has data rows`).toBeGreaterThan(0);

          // The header line is BARE — quoting it would be a different file.
          expect(header, `${path} header is quoted`).not.toContain('"');
          for (const row of dataRows) {
            // Every data cell is quote-wrapped, and the row is `;`-joined.
            const cells = row.split(';');
            expect(cells.length, `${path} row cell count`).toBe(header.split(';').length);
            for (const cell of cells) {
              expect(cell, `${path} data cell is not quote-all`).toMatch(/^".*"$/);
            }
          }
        }
      }
    });

    test('the OTHER sample files keep their CRLF style, so the mixed-ending coverage survives', () => {
      // The control for the assertion above. If these ever became bare-CR
      // too, the sample would no longer exercise both terminators, and the
      // "no line feed" rule would be a property of the whole archive rather
      // than a property of the Phase 5 files.
      const inflated = unzipSync(buildSampleExport());
      const crlfFolders = [
        'Activity_history/Logins.csv',
        'User_Info/Account_Info.csv',
        'Chat_history/Messages.csv',
        'Clans/Clan_membership.csv',
        'Bans/Bans.csv',
        'Device_info/Devices.csv',
      ];
      for (const relative of crlfFolders) {
        const text = new TextDecoder('utf-8').decode(
          inflated[`${SAMPLE_ACCOUNT_ROOT}/${relative}`]!,
        );
        expect(text, `${relative} lost its CRLF terminator`).toContain(`${CR}${LF}`);
      }
      // Activity_history/Sessions.csv is bare-CR by design (it is the
      // original Phase 1 bare-CR case, deliberately kept), so the archive
      // carries BOTH shapes.
      const sessions = new TextDecoder('utf-8').decode(
        inflated[`${SAMPLE_ACCOUNT_ROOT}/Activity_history/Sessions.csv`]!,
      );
      expect(sessions).not.toContain(LF);
    });
  });

  describe('the privacy canary and the Orders header', () => {
    test('the NAME canary is in exactly the five account files and nowhere else in the sample', () => {
      const inflated = unzipSync(buildSampleExport());
      const carriers = Object.keys(inflated)
        .filter((path) =>
          new TextDecoder('utf-8').decode(inflated[path]!).includes(STATS_NAME_CANARY),
        )
        .map((path) => path.slice(`${SAMPLE_ACCOUNT_ROOT}/Player_statistics/`.length))
        .sort();

      // Code-unit order, which is also the order the worker sorts folder and
      // code names in — `WOTB` before `WOT_` because `B` (0x42) precedes `_`
      // (0x5F), and every `WOT`/`WOTB` name before every `WOW` one because
      // `T` precedes `W`. The list is spelled out rather than filtered off
      // the fixture module, because "the canary leaked into a NON-account
      // file" is the failure this test exists to catch and a derived list
      // would follow the leak.
      expect(carriers).toEqual([
        'WOTB_Account_Statistics.csv',
        'WOT_Account_Statistics.csv',
        'WOWP_19_Account_Statistics.csv',
        'WOWP_20_Account_Statistics.csv',
        'WOWS_Account_Statistics.csv',
      ]);
    });

    test('Orders.csv carries the twelve real columns, ending in AA_PACKAGE_LIST', () => {
      const [orders] = entriesIn('Payment_history');
      const [header = ''] = linesOf(orders!.text);
      const columns = header.split(';');
      expect(columns).toHaveLength(12);
      expect(columns).toEqual([...ORDERS_HEADER_12]);
      expect(columns.at(-1)).toBe('AA_PACKAGE_LIST');
    });

    test('no GAME_CODE cell in Orders.csv is lower case, and exactly one is blank', () => {
      // The real export writes `WOT` / `COMMON` / `WOWP`; the repo's old
      // fixture wrote lower-case `wot`, which a case-sensitive grouping
      // would have split into two cards. The assertion is on the PARSED
      // cells (unquoted), not on the raw line.
      //
      // ONE row is deliberately blank: 05-01's hand fixture pairs a blank
      // currency with a blank GAME_CODE so D-24's "Unknown currency" group
      // has a row to land in. So the claim is "no lower-case code", not
      // "every cell is populated" — and the blank count is asserted so the
      // deliberate blank cannot quietly become a second one.
      const [orders] = entriesIn('Payment_history');
      const [header = '', ...rows] = linesOf(orders!.text);
      const columns = header.split(';');
      const gameCodeIndex = columns.indexOf('GAME_CODE');
      expect(gameCodeIndex).toBeGreaterThan(-1);

      const dataRows = rows.slice(0, -1);
      expect(dataRows.length).toBeGreaterThan(0);
      const values = dataRows.map((row) => row.split(';')[gameCodeIndex]!.slice(1, -1));
      for (const value of values) {
        expect(value, 'GAME_CODE is lower case').toBe(value.toUpperCase());
      }
      expect(values.filter((v) => v === '')).toHaveLength(1);
      // The codes the real export actually writes are all present.
      expect(new Set(values)).toEqual(new Set(['WOT', 'COMMON', 'WOWP', '']));
    });
  });
});

// =============================================================================
// The archives are BYTE-REPRODUCIBLE across wall-clock time
// =============================================================================
//
// Why this file exists:
//
//   The dedup gate (IMPORT-06 / D-12) answers `duplicate` only when the bytes
//   of a re-dropped archive hash the SAME as the bytes of the previous import.
//   `fflate.zipSync` stamps every local file header with `Date.now()` when no
//   `mtime` is given, so a fixture built twice returned different bytes — and a
//   different SHA-256 — as soon as the two calls straddled a two-second tick.
//   `replay-reclassify.test.ts` builds the same export twice to assert the
//   duplicate path, and it failed roughly one run in forty: the gate answered
//   `done`, correctly, because the archive genuinely was not hash-identical.
//   It is more frequent on a loaded machine, where the two builds sit further
//   apart in wall-clock time — which made it read as a flaky test rather than
//   as the content-hash contract quietly not holding.
//
//   So this pins the property the gate depends on: the same builder, called
//   twice with a zip-timestamp tick crossed in between, yields identical bytes.
//
//   The wait is the whole point, and it has to clear TWO seconds rather than
//   one: the DOS timestamp in a zip local file header stores the seconds field
//   divided by two, so fflate's default mtime only changes once every two
//   seconds. A 1.1 s wait would cross a wall-clock second and still land in
//   the same DOS tick, which would let the buggy fixture pass — a guard that
//   only catches the defect half the time is worse than no guard, because it
//   reports a contract the suite is not actually holding.
// =============================================================================

describe('the fixture archives are byte-reproducible', () => {
  test('the same builder yields identical bytes across a zip-timestamp tick', async () => {
    const first = buildSampleExport();

    // Clear one full DOS mtime tick (2 s), plus margin. See the note above.
    await new Promise((resolve) => setTimeout(resolve, 2_500));

    const second = buildSampleExport();

    expect(second).toEqual(first);
  });

  test('and therefore the same SHA-256, which is what the dedup gate compares', async () => {
    const sha = async (bytes: Uint8Array) =>
      [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource))]
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

    const before = await sha(buildSampleExport());
    // Clear one full DOS mtime tick (2 s), plus margin. See the note above.
    await new Promise((resolve) => setTimeout(resolve, 2_500));
    const after = await sha(buildSampleExport());

    expect(after).toBe(before);
  });
});

describe('every fixture archive goes through the pinned zip', () => {
  // The two assertions above only cover the builders they call. A NEW fixture
  // file that reaches past `pinned-zip.ts` for `fflate.zipSync` would keep
  // building non-reproducible archives, and no behavioural test would notice —
  // a test that builds one archive and asserts on its contents cannot see the
  // difference. So the pin is also asserted structurally, over the source.
  test('no fixture imports zipSync straight from fflate', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const dir = new URL('../../fixtures/', import.meta.url).pathname;

    const offenders = readdirSync(dir)
      .filter((name) => name.endsWith('.ts') && name !== 'pinned-zip.ts')
      .filter((name) =>
        /import\s*\{[^}]*\bzipSync\b[^}]*\}\s*from\s*'fflate'/.test(
          readFileSync(join(dir, name), 'utf8'),
        ),
      )
      .map((name) => `tests/fixtures/${name}`);

    expect(
      offenders,
      'these fixtures build archives with fflate.zipSync directly, so their bytes change every ' +
        'two seconds. Import zipSync from tests/fixtures/pinned-zip.ts instead.',
    ).toEqual([]);
  });

  test('the pin cannot be defeated by a caller passing its own mtime', async () => {
    const { zipSync } = await import('../../fixtures/pinned-zip.ts');
    // A call site that opts back out of the pin would reopen the exact flake
    // this module exists to close, so `opts` is spread BEFORE the mtime.
    const entry = new TextEncoder().encode('a,b\r\n1,2\r\n');
    const pinned = zipSync({ 'f.csv': entry }, { mtime: new Date('2031-06-06T06:06:06Z') });
    const reference = zipSync({ 'f.csv': entry });
    expect(pinned).toEqual(reference);
  });
});
