import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { db, readRowsByFile, writeDataset, type DatasetRow } from '../../../src/lib/worker/db.ts';
import type { CategoryEntry } from '../../../src/lib/core/types/worker-messages.ts';

// =============================================================================
// readRowsByFile — the ONE snapshot the four channels read from (05-07 Task 3)
// =============================================================================
//
// Why this file exists:
//
//   `readRowsByFile` is what makes T-05-19 true. Every answer the worker posts
//   carries an `importedAt`, and the only thing making that string trustworthy
//   is that it was read inside the SAME read transaction as the rows behind it.
//   That is not observable from a worker's posted message — a test can only see
//   that both came from one snapshot, never that they did not — so it is
//   asserted here, against the reader directly.
//
//   Three other properties are only visible at this level, and each one has
//   already cost somebody a wrong number once:
//     - the case-insensitive FILE match, because a real export spells a file
//       `WOT_Vehicle_Statistics.csv` and the table is lower-cased;
//     - the case-insensitive CATEGORY match, because a folder spelled
//       `player_statistics` classifies as the same supported category and a
//       case-sensitive compare would report a title as absent;
//     - the cost, because the reader walks the index and pays ONE single-key
//       read per requested file. The form that takes a list of keys cost
//       2,243 ms on 3,000 rows in Phase 4 against 9 ms for this walk, so the
//       ceiling below is a guard on a decision, not on the hardware.
//
// Environment: Node with the fake-indexeddb polyfill from tests/unit/setup.ts,
// and the SAME `db` singleton the worker writes through.
// =============================================================================

const CATEGORIES: CategoryEntry[] = [
  { name: 'Player_statistics', status: 'supported', fileCount: 1, rowCount: 1, skippedRowCount: 0 },
];

async function reset(): Promise<void> {
  await db.delete();
  await db.open();
}

/** One row per index, alternating nothing: a helper, not a fixture. */
function row(category: string, sourceFile: string, index: number): DatasetRow {
  return { category, sourceFile, rowIndex: index, data: { IDX: String(index) } };
}

/** The same row, stamped with the account root that owns it (09-07). */
function accountRow(
  category: string,
  sourceFile: string,
  index: number,
  account: string,
): DatasetRow {
  return { ...row(category, sourceFile, index), account };
}

beforeEach(reset);
afterEach(async () => {
  await db.delete();
  await db.open();
});

describe('readRowsByFile returns only what was asked for', () => {
  test('matches file names and categories case-insensitively', async () => {
    await writeDataset(
      'hash-1',
      'root',
      CATEGORIES,
      [
        // The spelling a REAL export uses for both the category and the file.
        row('Player_statistics', 'WOT_Vehicle_Statistics.csv', 0),
        row('Player_statistics', 'WOT_Vehicle_Statistics.csv', 1),
        // A folder spelled in lower case classifies as the same supported
        // category, so its files must not be dropped.
        row('player_statistics', 'WOTB_Vehicle_Statistics.csv', 0),
        // A file nobody asked for.
        row('Payment_history', 'Orders.csv', 0),
      ],
      null,
      null,
    );

    const snapshot = await readRowsByFile(
      new Set(['wot_vehicle_statistics.csv', 'wotb_vehicle_statistics.csv']),
      ['player_statistics'],
    );

    expect(snapshot).not.toBeNull();
    if (snapshot === null) return;
    // Both spellings matched, the unrequested file did not, and the rows are
    // keyed by the LOWER-CASED name the builders resolve through.
    expect([...snapshot.rows.keys()].sort()).toEqual([
      'wot_vehicle_statistics.csv',
      'wotb_vehicle_statistics.csv',
    ]);
    // One group per ACCOUNT, each holding that account's rows — so a single
    // account's file is one group of its own length (09-07).
    expect(snapshot.rows.get('wot_vehicle_statistics.csv')).toHaveLength(1);
    expect(snapshot.rows.get('wot_vehicle_statistics.csv')![0]!.rows).toHaveLength(2);
    expect(snapshot.rows.get('wotb_vehicle_statistics.csv')).toHaveLength(1);
  });

  test('a row of a category the channel did not ask for is excluded', async () => {
    await writeDataset(
      'hash-2',
      'root',
      CATEGORIES,
      [
        // A same-named file in ANOTHER category. A spend query must not pick
        // these up, or a currency figure would come from the wrong folder.
        row('Financial_data', 'operations_with_premium_days.csv', 0),
        row('Financial_data', 'operations_with_premium_days.csv', 1),
      ],
      null,
      null,
    );

    const snapshot = await readRowsByFile(new Set(['operations_with_premium_days.csv']), [
      'financial_data',
    ]);
    expect(snapshot?.rows.get('operations_with_premium_days.csv')).toHaveLength(1);
    expect(snapshot?.rows.get('operations_with_premium_days.csv')?.[0]?.rows).toHaveLength(2);

    const wrongChannel = await readRowsByFile(new Set(['operations_with_premium_days.csv']), [
      'payment_history',
    ]);
    expect(wrongChannel?.rows.size ?? 0).toBe(0);
  });

  test('preserves the stored order of the rows it returns', async () => {
    await writeDataset(
      'hash-3',
      'root',
      CATEGORIES,
      [0, 1, 2, 3].map((i) => row('Player_statistics', 'WOT_Vehicle_Statistics.csv', i)),
      null,
      null,
    );
    const snapshot = await readRowsByFile(new Set(['wot_vehicle_statistics.csv']), [
      'player_statistics',
    ]);
    // A builder that renders "the first row" or numbers rows positionally must
    // see them in the order the import produced: one group, and its rows in
    // stored order (09-07).
    const groups = snapshot?.rows.get('wot_vehicle_statistics.csv');
    expect(groups).toHaveLength(1);
    expect(groups![0]!.rows.map((r) => r.IDX)).toEqual(['0', '1', '2', '3']);
  });

  test('groups per account in first-seen order, rows in stored order inside each', async () => {
    // Two accounts contributing the SAME file name, written out of code-unit
    // order so the grouping cannot be right by accident: the reader must report
    // the accounts in the order it FIRST SAW their rows, not sorted (09-07).
    await writeDataset(
      'hash-3b',
      'root',
      CATEGORIES,
      [
        accountRow('Player_statistics', 'WOT_Vehicle_Statistics.csv', 0, 'zzz'),
        accountRow('Player_statistics', 'WOT_Vehicle_Statistics.csv', 1, 'aaa'),
        accountRow('Player_statistics', 'WOT_Vehicle_Statistics.csv', 2, 'zzz'),
      ],
      null,
      null,
    );
    const snapshot = await readRowsByFile(new Set(['wot_vehicle_statistics.csv']), [
      'player_statistics',
    ]);
    const groups = snapshot?.rows.get('wot_vehicle_statistics.csv');
    expect(groups, 'two accounts, one file name, two groups').toHaveLength(2);
    expect(groups!.map((group) => group.account)).toEqual(['zzz', 'aaa']);
    // Rows inside a group keep the order the import produced, so a builder that
    // renders "the first row" or numbers rows positionally still sees it.
    expect(groups![0]!.rows.map((r) => r.IDX)).toEqual(['0', '2']);
    expect(groups![1]!.rows.map((r) => r.IDX)).toEqual(['1']);
  });

  test('a legacy row with no account falls back to the dataset account root', async () => {
    // The account-or-legacy rule, stated once in `accountOf` and asserted here:
    // a v1.0 cache holds no `account`, so every row belongs to the one root.
    await writeDataset(
      'hash-3c',
      'legacy-root',
      CATEGORIES,
      [
        row('Player_statistics', 'WOT_Vehicle_Statistics.csv', 0),
        accountRow('Player_statistics', 'WOT_Vehicle_Statistics.csv', 1, 'other-root'),
      ],
      null,
      null,
    );
    const snapshot = await readRowsByFile(new Set(['wot_vehicle_statistics.csv']), [
      'player_statistics',
    ]);
    const groups = snapshot?.rows.get('wot_vehicle_statistics.csv');
    expect(groups!.map((group) => group.account)).toEqual(['legacy-root', 'other-root']);
    expect(groups![0]!.rows).toHaveLength(1);
  });

  test('returns the snapshot importedAt and its files list, and null with no dataset', async () => {
    expect(await readRowsByFile(new Set(['orders.csv']), ['payment_history'])).toBeNull();

    const written = await writeDataset(
      'hash-4',
      'root',
      CATEGORIES,
      [row('Payment_history', 'Orders.csv', 0)],
      null,
      null,
      [{ category: 'Payment_history', sourceFile: 'Orders.csv', rowCount: 0 }],
    );

    const snapshot = await readRowsByFile(new Set(['orders.csv']), ['payment_history']);
    // The date comes from the same record, inside the same transaction.
    expect(snapshot?.importedAt).toBe(written.importedAt);
    // The presence list rides along, INCLUDING the header-only file, which is
    // the whole reason it is stored at all.
    expect(snapshot?.files).toEqual([
      { category: 'Payment_history', sourceFile: 'Orders.csv', rowCount: 0 },
    ]);
  });

  test('a legacy cache with no files list answers null for files, not an empty array', async () => {
    await writeDataset('hash-5', 'root', CATEGORIES, [row('Player_statistics', 'WOT.csv', 0)]);
    const snapshot = await readRowsByFile(new Set(['wot.csv']), ['player_statistics']);
    // null and [] are DIFFERENT claims: null means "this cache predates
    // presence facts", and the caller must fall back to the sentence true of
    // both cases rather than reading it as "no file was present".
    expect(snapshot?.files).toBeNull();
  });
});

describe('readRowsByFile stays inside its cost ceiling', () => {
  test('3,000 rows over twelve files reads well under 1,000 ms', async () => {
    // Twelve files, so the reader has to walk a twelve-key index and pay one
    // single-key read per REQUESTED file. The ceiling is generous on purpose:
    // it is there to catch a regression to a per-key-set scan, not to measure
    // the machine.
    const files = Array.from({ length: 12 }, (_, i) => `file_${i}.csv`);
    const rows: DatasetRow[] = [];
    for (const file of files) {
      for (let i = 0; i < 250; i++) {
        rows.push(row('Player_statistics', file, i));
      }
    }
    await writeDataset('hash-6', 'root', CATEGORIES, rows);

    // Four requested, eight walked past without being read.
    const names = new Set(files.slice(0, 4).map((f) => f.toLowerCase()));
    const start = Date.now();
    const snapshot = await readRowsByFile(names, ['player_statistics']);
    const elapsed = Date.now() - start;

    expect(snapshot?.rows.size).toBe(4);
    for (const name of names) {
      expect(snapshot?.rows.get(name)?.[0]?.rows).toHaveLength(250);
    }
    expect(elapsed).toBeLessThan(1_000);
  });
});
