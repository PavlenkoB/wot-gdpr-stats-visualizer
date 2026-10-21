import { describe, expect, it } from 'vitest';
import { PANE_MAPPING } from '../../fixtures/new-data-headers.ts';
import {
  buildTimelineView,
  type TimelineFileInput,
} from '../../../src/lib/features/account-timeline/timeline-aggregate.ts';
import {
  TIMELINE_ENTRY_MAP,
  TIMELINE_FILE_IDS,
  type TimelineEntryMapping,
  type TimelineFileId,
  type TimelineView,
} from '../../../src/lib/features/account-timeline/timeline-shared.ts';
import type { AccountRowGroup, CsvRow } from '../../../src/lib/worker/csv-columns.ts';

// =============================================================================
// Plan 12-11 Task 1 - the pure timeline builder
// =============================================================================
//
// Rows are keyed by the spec column ids the entry map names (the map is proved
// against the specs in timeline-mapping.test.ts), so a captured rename needs one
// edit in one place. Every expected value is a hand-typed literal.

const LABELS: Readonly<Record<TimelineFileId, string>> = {
  name: 'Name',
  service: 'Service',
  languageCountry: 'Language and country',
  bans: 'Ban',
  thirdParties: 'Third party',
};

/** The file key of each timeline file, from PANE_MAPPING (null: removed at the gate). */
const FILE_KEYS = Object.fromEntries(
  TIMELINE_FILE_IDS.map((file) => {
    const row = PANE_MAPPING.find((r) => r.pane === 'timeline' && r.cardOrKind === LABELS[file]);
    return [file, row !== undefined && row.status === 'mapped' ? row.fileKey : null];
  }),
) as Record<TimelineFileId, string | null>;

const has = (file: TimelineFileId): boolean => FILE_KEYS[file] !== null;

const A = '630000001';
const B = '630000002';
const C = '630000003';

const EMPTY: TimelineFileInput = { groups: [], seen: false, parsed: null };

function inputs(
  partial: Partial<Record<TimelineFileId, readonly AccountRowGroup[]>>,
): Record<TimelineFileId, TimelineFileInput> {
  const result = {} as Record<TimelineFileId, TimelineFileInput>;
  for (const file of TIMELINE_FILE_IDS) {
    const groups = partial[file];
    result[file] = groups === undefined ? EMPTY : { groups, seen: true, parsed: groups.length };
  }
  return result;
}

const build = (
  partial: Partial<Record<TimelineFileId, readonly AccountRowGroup[]>>,
  order: readonly string[] = [A, B, C],
  map?: Readonly<Record<TimelineFileId, TimelineEntryMapping>>,
): TimelineView => buildTimelineView(inputs(partial), FILE_KEYS, order, map);

/** One row of a single-kind file, keyed by the map's own column ids. */
function rowOf(
  file: Exclude<TimelineFileId, 'languageCountry'>,
  values: { date?: string; primary?: string; secondary?: readonly string[] },
): CsvRow {
  const map = TIMELINE_ENTRY_MAP[file];
  const row: Record<string, string | undefined> = {};
  if (values.date !== undefined) row[map.dateColumn!] = values.date;
  if (values.primary !== undefined) row[map.primaryColumn!] = values.primary;
  (values.secondary ?? []).forEach((value, index) => {
    row[map.secondaryColumns[index]!] = value;
  });
  return row;
}

/** One row of the language and country file: the discriminator text and the value. */
function langRow(values: {
  date?: string;
  operation?: string;
  name?: string;
  value?: string;
}): CsvRow {
  const map = TIMELINE_ENTRY_MAP.languageCountry;
  const row: Record<string, string | undefined> = {};
  if (values.date !== undefined) row[map.dateColumn!] = values.date;
  if (values.operation !== undefined) row[map.primaryColumn!] = values.operation;
  if (values.name !== undefined) row[map.discriminatorColumn!] = values.name;
  if (values.value !== undefined) row[map.languageColumn!] = values.value;
  return row;
}

const group = (account: string, ...rows: CsvRow[]): AccountRowGroup => ({ account, rows });

/** The text of each entry's first part, for terse order assertions. */
const primaries = (view: TimelineView): (string | number | null)[] =>
  view.entries.map((entry) => entry.parts[0]!.cell);

const D1 = '2024-03-05 20:00:00.000';
const D2 = '2024-01-01 00:00:00.000';
const D3 = '2024-06-01 10:00:00.000';

describe('kinds follow the mapping', () => {
  it.runIf(has('name') && has('service') && has('bans') && has('thirdParties'))(
    'each single-kind file yields its own kind, date text and accounts',
    () => {
      const view = build({
        name: [group(A, rowOf('name', { date: D1, primary: 'old-a' }))],
        service: [group(A, rowOf('service', { date: D1, primary: 'LINK' }))],
        bans: [group(A, rowOf('bans', { date: D1, primary: 'ACTIVE' }))],
        thirdParties: [group(A, rowOf('thirdParties', { date: D1, primary: 'site-x' }))],
      });
      expect(view.entries.map((e) => [e.kind, e.date, [...e.accounts]])).toEqual([
        ['name', D1, [A]],
        ['service', D1, [A]],
        ['ban', D1, [A]],
        ['thirdParty', D1, [A]],
      ]);
      expect(view.storedRows).toBe(4);
      expect(view.mergedAway).toBe(0);
    },
  );

  it.runIf(has('languageCountry'))(
    'a language row and a country row each yield one entry with the row date',
    () => {
      const view = build({
        languageCountry: [
          group(
            A,
            langRow({ date: D1, operation: 'SET', name: 'language', value: 'en' }),
            langRow({ date: D2, operation: 'SET', name: 'COUNTRY', value: 'UA' }),
          ),
        ],
      });
      expect(view.entries.map((e) => [e.kind, e.date, e.parts.map((p) => p.cell)])).toEqual([
        ['language', D1, ['en', 'SET']],
        ['country', D2, ['UA', 'SET']],
      ]);
    },
  );

  it.runIf(has('languageCountry'))(
    'a row the discriminator cannot place, or with no value, yields no entry but is stored',
    () => {
      const view = build({
        languageCountry: [
          group(
            A,
            langRow({ date: D1, operation: 'SET', name: 'timezone', value: 'UTC' }),
            langRow({ date: D1, operation: 'SET', name: 'language' }),
            langRow({ date: D1, operation: 'SET', value: 'en' }),
          ),
        ],
      });
      expect(view.entries).toEqual([]);
      expect(view.storedRows).toBe(3);
      expect(view.files.languageCountry).toBe('ready');
    },
  );

  it.runIf(has('languageCountry'))(
    'with two separate columns a row yields one entry per value present, sharing its date',
    () => {
      // A shape the capture does not have: NAME holds a language, VALUE a country.
      const base = TIMELINE_ENTRY_MAP.languageCountry;
      const map = {
        ...TIMELINE_ENTRY_MAP,
        languageCountry: {
          ...base,
          languageColumn: 'NAME',
          countryColumn: 'VALUE',
          discriminatorColumn: null,
        },
      };
      const both = { CREATED_AT: D1, OPERATION: 'SET', NAME: 'de', VALUE: 'DE' };
      const onlyLanguage = { CREATED_AT: D2, OPERATION: 'SET', NAME: 'fr' };
      const neither = { CREATED_AT: D3, OPERATION: 'SET' };
      const view = build({ languageCountry: [group(A, both, onlyLanguage, neither)] }, [A], map);
      expect(view.entries.map((e) => [e.kind, e.date, e.parts.map((p) => p.cell)])).toEqual([
        ['language', D1, ['de', 'SET']],
        ['country', D1, ['DE', 'SET']],
        ['language', D2, ['fr', 'SET']],
      ]);
      expect(view.storedRows).toBe(3);
    },
  );
});

describe('dates and parts', () => {
  it.runIf(has('name'))(
    'keeps the export text trimmed and null when blank or the null marker',
    () => {
      const view = build({
        name: [
          group(
            A,
            rowOf('name', { date: `  ${D1}  `, primary: 'a' }),
            rowOf('name', { date: '   ', primary: 'b' }),
            rowOf('name', { primary: 'c' }),
            rowOf('name', { date: '\\N', primary: 'd' }),
          ),
        ],
      });
      const byName = new Map(view.entries.map((e) => [e.parts[0]!.cell, e.date]));
      expect(byName.get('a')).toBe(D1);
      expect(byName.get('b')).toBeNull();
      expect(byName.get('c')).toBeNull();
      expect(byName.get('d')).toBeNull();
    },
  );

  it.runIf(has('name'))('shows the primary then the secondary, a null primary stays a part', () => {
    const view = build({
      name: [
        group(
          A,
          rowOf('name', { date: D1, primary: 'old', secondary: ['new'] }),
          rowOf('name', { date: D2, secondary: ['only-new'] }),
          rowOf('name', { date: D3, primary: 'p', secondary: ['  '] }),
        ),
      ],
    });
    expect(view.entries.map((e) => e.parts.map((p) => [p.cell, p.kind]))).toEqual([
      [['p', 'text']],
      [
        ['old', 'text'],
        ['new', 'text'],
      ],
      [
        [null, 'text'],
        ['only-new', 'text'],
      ],
    ]);
  });

  it.runIf(has('service'))('never shows more than two secondary parts', () => {
    // A mapping with four secondary columns: only the first two non-null show.
    const base = TIMELINE_ENTRY_MAP.service;
    const map = {
      ...TIMELINE_ENTRY_MAP,
      service: { ...base, secondaryColumns: ['NAME', 'CREATED_AT', 'OPERATION', 'NAME'] },
    };
    const row = { CREATED_AT: D1, OPERATION: 'LINK', NAME: 'svc' };
    const view = build({ service: [group(A, row)] }, [A], map);
    expect(view.entries[0]!.parts.map((p) => p.cell)).toEqual(['LINK', 'svc', D1]);
  });

  it.runIf(has('name'))(
    'ignores a stored key no spec names and a __proto__ account merges and sorts',
    () => {
      const view = build(
        {
          name: [
            group('__proto__', { ...rowOf('name', { date: D1, primary: 'x' }), SECRET: 'leak' }),
            group(A, rowOf('name', { date: D2, primary: 'y' })),
          ],
        },
        ['__proto__', A],
      );
      expect(JSON.stringify(view)).not.toContain('leak');
      expect(view.entries.map((e) => [e.parts[0]!.cell, [...e.accounts]])).toEqual([
        ['x', ['__proto__']],
        ['y', [A]],
      ]);
    },
  );
});

describe('cross-account merge', () => {
  it.runIf(has('service'))(
    'identical service rows merge into one entry naming both accounts',
    () => {
      const row = rowOf('service', { date: D1, primary: 'LINK', secondary: ['steam'] });
      const view = build({
        service: [group(A, row, rowOf('service', { date: D2, primary: 'UNLINK' })), group(B, row)],
      });
      expect(view.entries.map((e) => [e.parts[0]!.cell, [...e.accounts]])).toEqual([
        ['LINK', [A, B]],
        ['UNLINK', [A]],
      ]);
      expect(view.storedRows).toBe(3);
      expect(view.mergedAway).toBe(1);
    },
  );

  it.runIf(has('service'))('a difference in any stored column keeps the rows apart', () => {
    const view = build({
      service: [
        group(A, rowOf('service', { date: D1, primary: 'LINK', secondary: ['steam'] })),
        group(B, rowOf('service', { date: D1, primary: 'LINK', secondary: ['xbox'] })),
      ],
    });
    expect(view.entries).toHaveLength(2);
    expect(view.mergedAway).toBe(0);
  });

  it.runIf(has('languageCountry'))(
    'identical language and country rows merge and count one removed row',
    () => {
      const row = langRow({ date: D1, operation: 'SET', name: 'language', value: 'en' });
      const view = build({ languageCountry: [group(A, row), group(B, row)] });
      expect(view.entries.map((e) => [e.kind, [...e.accounts]])).toEqual([['language', [A, B]]]);
      expect(view.storedRows).toBe(2);
      expect(view.mergedAway).toBe(1);
    },
  );

  it.runIf(has('name') && has('bans') && has('thirdParties'))(
    'name, ban and third-party rows never merge, even when identical',
    () => {
      const name = rowOf('name', { date: D1, primary: 'same', secondary: ['same2'] });
      const ban = rowOf('bans', { date: D1, primary: 'ACTIVE' });
      const party = rowOf('thirdParties', { date: D1, primary: 'site' });
      const view = build({
        name: [group(A, name), group(B, name)],
        bans: [group(A, ban), group(B, ban)],
        thirdParties: [group(A, party), group(B, party)],
      });
      expect(view.entries).toHaveLength(6);
      expect(view.mergedAway).toBe(0);
      expect(view.storedRows).toBe(6);
    },
  );

  it.runIf(has('service'))('a repeat inside one account is not folded into its first', () => {
    const row = rowOf('service', { date: D1, primary: 'LINK' });
    const view = build({ service: [group(A, row, row), group(B, row)] });
    // A's two identical rows pair with B's one only at occurrence 0.
    expect(view.entries.map((e) => [...e.accounts])).toEqual([[A, B], [A]]);
    expect(view.mergedAway).toBe(1);
  });
});

describe('order', () => {
  it.runIf(
    has('name') && has('service') && has('bans') && has('thirdParties') && has('languageCountry'),
  )('newest first, undated last, ties by kind then file', () => {
    const view = build({
      name: [
        group(
          A,
          rowOf('name', { date: D2, primary: 'n-jan' }),
          rowOf('name', { primary: 'n-undated' }),
          rowOf('name', { date: D1, primary: 'n-mar' }),
        ),
      ],
      service: [group(A, rowOf('service', { date: D1, primary: 's-mar' }))],
      languageCountry: [
        group(
          A,
          langRow({ date: D1, name: 'country', value: 'UA' }),
          langRow({ date: D1, name: 'language', value: 'en' }),
        ),
      ],
      // A different spelling of the same wall-clock instant ties with D1.
      bans: [group(A, rowOf('bans', { date: '05.03.2024 20:00', primary: 'b-mar' }))],
      thirdParties: [
        group(
          A,
          rowOf('thirdParties', { date: D3, primary: 't-jun' }),
          rowOf('thirdParties', { date: 'not a date', primary: 't-bad' }),
        ),
      ],
    });
    // June first; then the five March entries by kind (name, service,
    // language, country, ban); January; then the undated, in kind then input
    // order (name, thirdParty).
    expect(primaries(view)).toEqual([
      't-jun',
      'n-mar',
      's-mar',
      'en',
      'UA',
      'b-mar',
      'n-jan',
      'n-undated',
      't-bad',
    ]);
    expect(view.entries[view.entries.length - 1]!.date).toBe('not a date');
  });

  it.runIf(has('name'))(
    'ties between accounts follow the account order, an unknown account last',
    () => {
      const row = (primary: string) => rowOf('name', { date: D1, primary });
      const groups = [
        group(C, row('c')),
        group(B, row('b')),
        group('999', row('z')),
        group(A, row('a')),
      ];
      expect(primaries(build({ name: groups }, [A, B, C]))).toEqual(['a', 'b', 'c', 'z']);
      // A different order gives a different, still total, answer.
      expect(primaries(build({ name: groups }, [C, A, B]))).toEqual(['c', 'a', 'b', 'z']);
    },
  );

  it.runIf(has('name'))(
    'equal keys fall back to the input position, and builds are identical',
    () => {
      const row = rowOf('name', { date: D1, primary: 'same' });
      const groups = [group(A, row, { ...row }, { ...row })];
      const first = build({ name: groups });
      expect(first.entries).toHaveLength(3);
      expect(JSON.stringify(build({ name: groups }))).toBe(JSON.stringify(first));
    },
  );
});

describe('per-file states', () => {
  it('reports the four states and counts stored rows over ready files only', () => {
    const files: Partial<Record<TimelineFileId, TimelineFileInput>> = {};
    const all = inputs({});
    if (has('name'))
      files.name = {
        groups: [group(A, rowOf('name', { date: D1, primary: 'a' }))],
        seen: true,
        parsed: 1,
      };
    if (has('service')) files.service = { groups: [], seen: true, parsed: 3 }; // skipped
    if (has('bans')) files.bans = { groups: [], seen: true, parsed: 0 }; // header only
    if (has('thirdParties')) files.thirdParties = { groups: [], seen: true, parsed: null }; // unknown
    // languageCountry stays absent
    const view = buildTimelineView({ ...all, ...files }, FILE_KEYS, [A]);
    if (has('name')) expect(view.files.name).toBe('ready');
    if (has('service')) expect(view.files.service).toBe('skipped');
    if (has('bans')) expect(view.files.bans).toBe('no-rows');
    if (has('thirdParties')) expect(view.files.thirdParties).toBe('no-rows');
    if (has('languageCountry')) expect(view.files.languageCountry).toBe('not-in-export');
    expect(view.storedRows).toBe(has('name') ? 1 : 0);
  });

  it('a removed kind (null file key) is not-in-export and contributes nothing', () => {
    const keys = { ...FILE_KEYS, name: null };
    const view = buildTimelineView(
      inputs({ name: [group(A, rowOf('name', { date: D1, primary: 'a' }))] }),
      keys,
      [A],
    );
    expect(view.files.name).toBe('not-in-export');
    expect(view.entries).toEqual([]);
    expect(view.storedRows).toBe(0);
  });

  it('an unknown file key is a bug and throws', () => {
    expect(() =>
      buildTimelineView(inputs({}), { ...FILE_KEYS, name: 'no_such_file.csv' }, [A]),
    ).toThrow();
  });
});

describe('scale', () => {
  it.runIf(has('name') && has('service'))(
    '5,000 stored rows build and sort in well under a second',
    () => {
      const names: CsvRow[] = [];
      const services: CsvRow[] = [];
      for (let i = 0; i < 2500; i += 1) {
        const day = String((i % 28) + 1).padStart(2, '0');
        const hour = String(i % 24).padStart(2, '0');
        names.push(rowOf('name', { date: `2023-05-${day} ${hour}:00:00.000`, primary: `n${i}` }));
        services.push(
          rowOf('service', { date: `2022-05-${day} ${hour}:30:00.000`, primary: `s${i}` }),
        );
      }
      const started = performance.now();
      const view = build({
        name: [group(A, ...names)],
        service: [group(A, ...services), group(B, ...services)],
      });
      const elapsed = performance.now() - started;
      expect(view.storedRows).toBe(7500);
      expect(view.entries).toHaveLength(5000);
      expect(view.mergedAway).toBe(2500);
      expect(elapsed).toBeLessThan(1000);
    },
  );
});
