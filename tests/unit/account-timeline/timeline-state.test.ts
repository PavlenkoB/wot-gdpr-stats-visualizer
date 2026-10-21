import { describe, expect, it } from 'vitest';
import {
  filterEntries,
  fileStateLines,
  hasMaskableEntries,
  isWholePaneEmpty,
  kindsPresent,
  resolveKindFilter,
  showKindFilter,
  type KindChoice,
} from '../../../src/lib/features/account-timeline/timeline-state.ts';
import type {
  TimelineEntryView,
  TimelineFileId,
  TimelineFileState,
  TimelineKind,
  TimelinePart,
} from '../../../src/lib/features/account-timeline/timeline-shared.ts';

// =============================================================================
// Plan 12-12 Task 1 - the pure Account timeline pane decisions
// =============================================================================
//
// Entries are hand-built; every expected value is a typed literal. The decisions
// are the chip row, the dataset-keyed filter reset, the per-file lines, the
// whole-pane-empty test and the maskable-entry test.

function entry(kind: TimelineKind, parts: readonly TimelinePart[] = []): TimelineEntryView {
  return { kind, date: '2024-01-01 00:00:00.000', parts, accounts: ['ACCT'] };
}

function files(over: Partial<Record<TimelineFileId, TimelineFileState>>) {
  return {
    name: 'not-in-export',
    service: 'not-in-export',
    languageCountry: 'not-in-export',
    bans: 'not-in-export',
    thirdParties: 'not-in-export',
    ...over,
  } as Record<TimelineFileId, TimelineFileState>;
}

describe('kindsPresent and showKindFilter', () => {
  it('returns kinds in the fixed order whatever the entry order', () => {
    const entries = [
      entry('thirdParty'),
      entry('ban'),
      entry('name'),
      entry('ban'),
      entry('language'),
    ];
    expect(kindsPresent(entries)).toEqual(['name', 'language', 'ban', 'thirdParty']);
  });

  it('gives an empty list for no entries', () => {
    expect(kindsPresent([])).toEqual([]);
  });

  it('shows the chip row only for two or more kinds', () => {
    expect(showKindFilter([])).toBe(false);
    expect(showKindFilter(['name'])).toBe(false);
    expect(showKindFilter(['name', 'ban'])).toBe(true);
  });
});

describe('filterEntries', () => {
  const entries = [entry('ban'), entry('name'), entry('ban'), entry('service')];

  it('returns the same array for All entries', () => {
    expect(filterEntries(entries, null)).toBe(entries);
  });

  it('keeps only the chosen kind, in the original order', () => {
    const bans = filterEntries(entries, 'ban');
    expect(bans).toHaveLength(2);
    expect(bans[0]).toBe(entries[0]);
    expect(bans[1]).toBe(entries[2]);
  });
});

describe('resolveKindFilter', () => {
  const present: TimelineKind[] = ['name', 'ban'];

  it('keeps a choice made under this dataset for a kind still present', () => {
    const choice: KindChoice = { kind: 'ban', stamp: 'T1' };
    expect(resolveKindFilter(choice, 'T1', present)).toBe('ban');
  });

  it('resets to All entries when the stamp is another dataset', () => {
    expect(resolveKindFilter({ kind: 'ban', stamp: 'T1' }, 'T2', present)).toBeNull();
  });

  it('resets to All entries when nothing is on screen', () => {
    expect(resolveKindFilter({ kind: 'ban', stamp: null }, null, present)).toBeNull();
  });

  it('resets when the chosen kind is no longer present', () => {
    expect(resolveKindFilter({ kind: 'country', stamp: 'T1' }, 'T1', present)).toBeNull();
  });

  it('answers null for a null choice', () => {
    expect(resolveKindFilter({ kind: null, stamp: 'T1' }, 'T1', present)).toBeNull();
  });

  it('never throws for a hostile kind string', () => {
    for (const hostile of ['__proto__', '<b>ban</b>', 'constructor', '']) {
      const choice = { kind: hostile as unknown as TimelineKind, stamp: 'T1' };
      expect(resolveKindFilter(choice, 'T1', present)).toBeNull();
    }
  });
});

describe('fileStateLines', () => {
  it('lists skipped and header-only files in file order and nothing else', () => {
    const lines = fileStateLines(
      files({
        name: 'ready',
        service: 'skipped',
        languageCountry: 'not-in-export',
        bans: 'no-rows',
        thirdParties: 'ready',
      }),
    );
    expect(lines).toEqual([
      { file: 'service', status: 'skipped' },
      { file: 'bans', status: 'no-rows' },
    ]);
  });

  it('gives no line for ready and absent files', () => {
    expect(fileStateLines(files({ name: 'ready' }))).toEqual([]);
  });
});

describe('isWholePaneEmpty', () => {
  it('is true when files are present and none is ready', () => {
    expect(isWholePaneEmpty(files({ service: 'skipped', bans: 'no-rows' }))).toBe(true);
  });

  it('is false when any file is ready', () => {
    expect(isWholePaneEmpty(files({ service: 'skipped', bans: 'ready' }))).toBe(false);
  });

  it('is false when every file is absent', () => {
    expect(isWholePaneEmpty(files({}))).toBe(false);
  });
});

describe('hasMaskableEntries', () => {
  it('is true for an address part holding a value', () => {
    expect(
      hasMaskableEntries([
        entry('ban', [
          { cell: 'x', kind: 'text' },
          { cell: '203.0.113.7', kind: 'address' },
        ]),
      ]),
    ).toBe(true);
  });

  it('is false for a null or empty address part', () => {
    expect(hasMaskableEntries([entry('ban', [{ cell: null, kind: 'address' }])])).toBe(false);
    expect(hasMaskableEntries([entry('ban', [{ cell: '', kind: 'address' }])])).toBe(false);
  });

  it('is false for code and text parts and for no entries', () => {
    expect(
      hasMaskableEntries([
        entry('ban', [
          { cell: 'AB7K-QX42', kind: 'code' },
          { cell: 'abc', kind: 'text' },
        ]),
      ]),
    ).toBe(false);
    expect(hasMaskableEntries([])).toBe(false);
  });
});
