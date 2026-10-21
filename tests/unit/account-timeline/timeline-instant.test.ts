import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  compareTimelineKeys,
  parseTimelineInstant,
  type TimelineSortKey,
} from '../../../src/lib/features/account-timeline/timeline-instant.ts';
import {
  TIMELINE_FILE_IDS,
  TIMELINE_KINDS,
  kindRank,
  type TimelineFileId,
  type TimelineKind,
} from '../../../src/lib/features/account-timeline/timeline-shared.ts';

// =============================================================================
// Plan 12-05 Task 1 - the tolerant instant parse and the stable comparator
// =============================================================================
//
// The two anchors are hand-derived (from 04-12's hand-derived anchors for the
// same two instants), never produced by the code under test: `05.03.2024 00:00`
// and `2024-03-05 00:00` are both 1709596800, and 20:00 on that day is
// 1709596800 + 20 * 3600 = 1709668800.

const MIDNIGHT = 1709596800;
const EVENING = 1709668800;

describe('parseTimelineInstant', () => {
  it('reads the two date-time shapes as the same wall-clock instant', () => {
    expect(parseTimelineInstant('2024-03-05 20:00:00')).toBe(EVENING);
    expect(parseTimelineInstant('05.03.2024 20:00')).toBe(EVENING);
  });

  it('reads a T separator and a trailing Z as the same instant', () => {
    expect(parseTimelineInstant('2024-03-05T20:00:00Z')).toBe(EVENING);
    // A fraction is accepted and truncated to the second: the shared reader
    // resolves the instant, not the sub-second, and a fraction under a second
    // moves neither the day nor the hour it is bucketed by.
    expect(parseTimelineInstant('2024-03-05 20:00:00.250')).toBe(EVENING);
  });

  it('reads the two date-only shapes at midnight', () => {
    expect(parseTimelineInstant('2024-03-05')).toBe(MIDNIGHT);
    expect(parseTimelineInstant('05.03.2024')).toBe(MIDNIGHT);
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseTimelineInstant('  2024-03-05 20:00:00  ')).toBe(EVENING);
    expect(parseTimelineInstant('\t05.03.2024\t')).toBe(MIDNIGHT);
  });

  it('does NOT read a shape outside this plan four, so it is documented as undated', () => {
    // Both are shapes plan 12-11 widens the parser for when the header capture
    // records them for a file (12-RESEARCH Pitfall 8).
    expect(parseTimelineInstant('2024-03-05T20:00')).toBeNull();
    expect(parseTimelineInstant('2024-03-05T20:00:00+02:00')).toBeNull();
  });

  it('rejects an impossible calendar date rather than rolling it over', () => {
    expect(parseTimelineInstant('31.02.2020')).toBeNull();
    expect(parseTimelineInstant('2020-02-30')).toBeNull();
    expect(parseTimelineInstant('2020-13-01')).toBeNull();
    expect(parseTimelineInstant('05.13.2024')).toBeNull();
    expect(parseTimelineInstant('24:00')).toBeNull();
    expect(parseTimelineInstant('23:60')).toBeNull();
  });

  it('reads day first and never swaps the day and the month', () => {
    // Day 03, month 05 -> 5 March. A swapped reading would be 3 May.
    expect(parseTimelineInstant('03.05.2024')).toBe(parseTimelineInstant('2024-05-03'));
    expect(parseTimelineInstant('03.05.2024')).not.toBe(parseTimelineInstant('2024-03-05'));
  });

  it('returns null for blank, absent and hostile input without throwing', () => {
    expect(parseTimelineInstant('')).toBeNull();
    expect(parseTimelineInstant('   ')).toBeNull();
    expect(parseTimelineInstant(null)).toBeNull();
    expect(parseTimelineInstant(undefined)).toBeNull();
    expect(parseTimelineInstant('not a date at all')).toBeNull();
    expect(parseTimelineInstant('2024-03-05 20:00:00 ' + 'x'.repeat(100_000))).toBeNull();
    expect(() => parseTimelineInstant('2024-03-05 ' + '9'.repeat(100_000))).not.toThrow();
  });
});

describe('kindRank', () => {
  it('follows the fixed kind order', () => {
    expect(TIMELINE_KINDS).toEqual(['name', 'service', 'language', 'country', 'ban', 'thirdParty']);
    expect(TIMELINE_KINDS.map((kind) => kindRank(kind))).toEqual([0, 1, 2, 3, 4, 5]);
    expect(kindRank('name')).toBeLessThan(kindRank('thirdParty'));
  });

  it('ranks every declared kind and nothing else', () => {
    for (const kind of TIMELINE_KINDS) {
      expect(kindRank(kind)).toBe(TIMELINE_KINDS.indexOf(kind as TimelineKind));
    }
    expect(TIMELINE_KINDS).toHaveLength(6);
    expect(TIMELINE_FILE_IDS).toEqual([
      'name',
      'service',
      'languageCountry',
      'bans',
      'thirdParties',
    ]);
  });
});

describe('compareTimelineKeys', () => {
  function key(overrides: Partial<TimelineSortKey> = {}): TimelineSortKey {
    return {
      instant: MIDNIGHT,
      kindRank: 0,
      fileRank: 0,
      accountRank: 0,
      sequence: 0,
      ...overrides,
    };
  }

  it('sorts newest first', () => {
    const older = key({ instant: MIDNIGHT, sequence: 1 });
    const newer = key({ instant: EVENING, sequence: 0 });
    expect(compareTimelineKeys(older, newer)).toBeGreaterThan(0);
    expect(compareTimelineKeys(newer, older)).toBeLessThan(0);
  });

  it('puts an undated entry after EVERY dated one', () => {
    const undated = key({ instant: null });
    const dated = key({ instant: 0, sequence: 9 });
    expect(compareTimelineKeys(undated, dated)).toBeGreaterThan(0);
    expect(compareTimelineKeys(dated, undated)).toBeLessThan(0);
    // Two undated entries tie-break through the rest of the chain rather than
    // sitting in whatever order they arrived in.
    expect(compareTimelineKeys(undated, key({ instant: null, sequence: 1 }))).toBeLessThan(0);
    expect(compareTimelineKeys(key({ instant: null }), undated)).toBe(0);
  });

  it('breaks equal instants by kind, then file, then account, then input position', () => {
    expect(compareTimelineKeys(key({ kindRank: 0 }), key({ kindRank: 3 }))).toBeLessThan(0);
    expect(compareTimelineKeys(key({ fileRank: 0 }), key({ fileRank: 2 }))).toBeLessThan(0);
    expect(compareTimelineKeys(key({ accountRank: 0 }), key({ accountRank: 2 }))).toBeLessThan(0);
    expect(compareTimelineKeys(key({ sequence: 0 }), key({ sequence: 5 }))).toBeLessThan(0);
  });

  it('returns 0 only for the same key', () => {
    expect(compareTimelineKeys(key(), key())).toBe(0);
    expect(compareTimelineKeys(key({ kindRank: 1 }), key({ kindRank: 1 }))).toBe(0);
  });

  it('gives one order for a shuffled list, twice, whatever the input order', () => {
    const keys: TimelineSortKey[] = [
      key({ instant: EVENING, kindRank: 2, sequence: 3 }),
      key({ instant: null, kindRank: 1, sequence: 1 }),
      key({ instant: MIDNIGHT, kindRank: 0, fileRank: 4, sequence: 0 }),
      key({ instant: MIDNIGHT, kindRank: 4, sequence: 2 }),
      key({ instant: EVENING, kindRank: 0, sequence: 4 }),
    ];
    const once = [...keys].sort(compareTimelineKeys);
    const twice = [...keys].reverse().sort(compareTimelineKeys);

    expect(twice).toEqual(once);
    expect(once.map((entry) => entry.sequence)).toEqual([4, 3, 0, 2, 1]);
  });

  it('orders a mixed-format, mixed-dated list the way the pane shows it', () => {
    // Newest first, undated last, and every dated entry in the order its own
    // shape parsed to.
    const entries: readonly [string, TimelineKind, TimelineFileId, string | null][] = [
      ['05.03.2024', 'name', 'name', '05.03.2024'],
      ['2024-03-05', 'service', 'service', '2024-03-05'],
      ['2024-03-05 20:00:00', 'country', 'languageCountry', '2024-03-05 20:00:00'],
      ['05.03.2024 08:00', 'ban', 'bans', '05.03.2024 08:00'],
      ['2024-03-05T20:00', 'language', 'languageCountry', '2024-03-05T20:00'],
    ];
    const keys = entries.map(([text, kind, file], sequence) => ({
      instant: parseTimelineInstant(text),
      kindRank: kindRank(kind),
      fileRank: TIMELINE_FILE_IDS.indexOf(file),
      accountRank: 0,
      sequence,
    }));

    const ordered = [...keys].sort(compareTimelineKeys).map((entry) => entry.sequence);
    // 2 is 20:00 on the day, 3 is 08:00 on it, and 0 and 1 are both its
    // midnight (the dotted and the ISO date-only shape reading alike), with 0
    // first on kind rank. The entry whose shape this plan does not read is last.
    expect(ordered).toEqual([2, 3, 0, 1, 4]);
  });
});

describe('the module boundary', () => {
  const DIR = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../../src/lib/features/account-timeline',
  );

  it('the view contract imports no runtime module at all', () => {
    const source = readFileSync(path.join(DIR, 'timeline-shared.ts'), 'utf8');
    const runtimeImports = source
      .split('\n')
      .filter((line) => line.startsWith('import') && !line.startsWith('import type'));

    expect(runtimeImports).toEqual([]);
  });

  it('the instant module never constructs a Date, so no viewer zone can move an entry', () => {
    const source = readFileSync(path.join(DIR, 'timeline-instant.ts'), 'utf8');
    expect(source).not.toMatch(/new\s+Date\b/);
  });
});
