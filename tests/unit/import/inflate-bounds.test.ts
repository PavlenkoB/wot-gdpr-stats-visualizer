import { describe, expect, test } from 'vitest';
import {
  MAX_ENTRY_BYTES,
  MAX_TOTAL_BYTES,
  createInflateFilter,
} from '../../../src/lib/worker/inflate-bounds.ts';

// =============================================================================
// inflate-bounds.ts -- the declared-size caps for inflated entries (WR-03)
// =============================================================================
//
// The helper is pure and takes its limits as an argument ON PURPOSE: the cap
// logic is exercised here with limits of 100 and 250 bytes, so no test ever
// allocates anything large. That is the whole point of the injectable shape.
//
// The worker wiring (that handleIngest really passes this filter to unzipSync
// and that a rejected archive lands in the single error path with nothing
// persisted) is covered by the `01-14` describe in ingest-worker.test.ts, which
// drives one archive whose central-directory size field is patched.
// =============================================================================

const LIMITS = { maxEntryBytes: 100, maxTotalBytes: 250 } as const;

/** The 60,000-session Sessions.csv measured at planning time (scale fixture). */
const SCALE_SESSIONS_CSV_BYTES = 4_712_563;

const acceptAll = (): boolean => true;
const entry = (name: string, originalSize: number) => ({ name, originalSize });

function thrownMessage(run: () => unknown): string {
  try {
    run();
  } catch (err) {
    expect(err).toBeInstanceOf(Error);
    return (err as Error).message;
  }
  throw new Error('expected the filter to throw');
}

describe('createInflateFilter -- the per-entry cap', () => {
  test('an accepted entry exactly at the limit is admitted', () => {
    const filter = createInflateFilter(acceptAll, LIMITS);
    expect(filter(entry('a.csv', 100))).toBe(true);
  });

  test('an accepted entry one byte over the limit throws exactly "entry too large"', () => {
    const filter = createInflateFilter(acceptAll, LIMITS);
    expect(thrownMessage(() => filter(entry('a.csv', 101)))).toBe('entry too large');
  });

  test.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['a negative size', -1],
  ])('%s as the declared size of an accepted entry throws "entry too large"', (_label, size) => {
    const filter = createInflateFilter(acceptAll, LIMITS);
    expect(thrownMessage(() => filter(entry('a.csv', size)))).toBe('entry too large');
  });
});

describe('createInflateFilter -- the total cap', () => {
  test('three accepted 100-byte entries: true, true, then "archive too large" on the third', () => {
    const filter = createInflateFilter(acceptAll, LIMITS);
    expect(filter(entry('a.csv', 100))).toBe(true);
    expect(filter(entry('b.csv', 100))).toBe(true);
    expect(thrownMessage(() => filter(entry('c.csv', 100)))).toBe('archive too large');
  });

  test('two filters made from the same options keep independent totals', () => {
    const first = createInflateFilter(acceptAll, LIMITS);
    const second = createInflateFilter(acceptAll, LIMITS);
    expect(first(entry('a.csv', 100))).toBe(true);
    expect(first(entry('b.csv', 100))).toBe(true);
    // The first is 50 bytes from its cap; the second has spent nothing.
    expect(second(entry('a.csv', 100))).toBe(true);
    expect(second(entry('b.csv', 100))).toBe(true);
    expect(thrownMessage(() => first(entry('c.csv', 100)))).toBe('archive too large');
  });
});

describe('createInflateFilter -- names the accepts callback rejects', () => {
  test('a rejected name returns false even when its size is far above both limits', () => {
    const filter = createInflateFilter((name) => name !== 'skip.bin', LIMITS);
    expect(filter(entry('skip.bin', 10 ** 12))).toBe(false);
  });

  test('a rejected name adds nothing to the total', () => {
    const filter = createInflateFilter((name) => name !== 'skip.bin', LIMITS);
    // Were the 90-byte rejected entries counted, the total would be 270 and the
    // accepted 100-byte entry below would trip the 250-byte total limit.
    for (let i = 0; i < 3; i++) expect(filter(entry('skip.bin', 90))).toBe(false);
    expect(filter(entry('a.csv', 100))).toBe(true);
    expect(filter(entry('b.csv', 100))).toBe(true);
  });

  test('the callback receives the entry name and is consulted before any size check', () => {
    const seen: string[] = [];
    const filter = createInflateFilter((name) => {
      seen.push(name);
      return false;
    }, LIMITS);
    expect(filter(entry('Some/Folder/x.csv', Number.NaN))).toBe(false);
    expect(seen).toEqual(['Some/Folder/x.csv']);
  });
});

describe('createInflateFilter -- fixed messages', () => {
  test('the thrown messages are exactly the two fixed strings: no name, no size digit', () => {
    const name = 'Secret_Folder_Name/Player_7351982.csv';

    const perEntry = thrownMessage(() =>
      createInflateFilter(acceptAll, LIMITS)(entry(name, 987_654_321)),
    );
    const filter = createInflateFilter(acceptAll, LIMITS);
    filter(entry(name, 100));
    filter(entry(name, 100));
    const total = thrownMessage(() => filter(entry(name, 100)));

    expect(perEntry).toBe('entry too large');
    expect(total).toBe('archive too large');
    for (const message of [perEntry, total]) {
      expect(message).not.toContain('Secret_Folder_Name');
      expect(message).not.toContain('Player_7351982');
      expect(message).not.toMatch(/\d/);
    }
  });
});

describe('the exported defaults', () => {
  test('the total cap is not below the per-entry cap', () => {
    expect(MAX_TOTAL_BYTES).toBeGreaterThanOrEqual(MAX_ENTRY_BYTES);
  });

  test('the per-entry cap is at least 20 times the 60,000-session CSV of the scale fixture', () => {
    // A future edit that tightens the cap toward the fixtures fails here, not
    // in front of a user whose real export is larger than the synthetic one.
    expect(MAX_ENTRY_BYTES).toBeGreaterThanOrEqual(20 * SCALE_SESSIONS_CSV_BYTES);
  });

  test('the defaults are the values the plan states: 128 MiB and 512 MiB', () => {
    expect(MAX_ENTRY_BYTES).toBe(128 * 1024 * 1024);
    expect(MAX_TOTAL_BYTES).toBe(512 * 1024 * 1024);
  });

  test('a filter built with no limits argument enforces those defaults', () => {
    const filter = createInflateFilter(acceptAll);
    expect(filter(entry('a.csv', MAX_ENTRY_BYTES))).toBe(true);
    expect(thrownMessage(() => filter(entry('b.csv', MAX_ENTRY_BYTES + 1)))).toBe(
      'entry too large',
    );
  });
});
