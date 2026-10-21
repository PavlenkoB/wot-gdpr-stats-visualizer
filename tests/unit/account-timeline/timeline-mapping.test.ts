import { describe, expect, it } from 'vitest';
import { DATE_SHAPES, PANE_MAPPING, type PaneMappingRow } from '../../fixtures/new-data-headers.ts';
import { NEW_DATA_SPEC_FILES } from '../../../src/lib/worker/new-data-specs.ts';
import { parseTimelineInstant } from '../../../src/lib/features/account-timeline/timeline-instant.ts';
import {
  MAX_TIMELINE_SECONDARY_PARTS,
  TIMELINE_ENTRY_MAP,
  TIMELINE_FILE_IDS,
  type TimelineFileId,
} from '../../../src/lib/features/account-timeline/timeline-shared.ts';

// =============================================================================
// Plan 12-11 Task 1 - the entry map against the specs and the capture
// =============================================================================
//
// Every loop below walks PANE_MAPPING's timeline rows, never a hard-coded five:
// a kind the user removed at the plan 12-01 completeness gate has a `removed`
// row, a null file key and an all-null map entry, and drops out of every
// assertion by construction.

/** The PANE_MAPPING `cardOrKind` label of each timeline file. */
const LABELS: Readonly<Record<TimelineFileId, string>> = {
  name: 'Name',
  service: 'Service',
  languageCountry: 'Language and country',
  bans: 'Ban',
  thirdParties: 'Third party',
};

function rowOf(file: TimelineFileId): PaneMappingRow {
  const row = PANE_MAPPING.find((r) => r.pane === 'timeline' && r.cardOrKind === LABELS[file]);
  if (row === undefined) throw new Error(`no PANE_MAPPING row for ${file}`);
  return row;
}

const MAPPED = TIMELINE_FILE_IDS.filter((file) => {
  const row = rowOf(file);
  return row.status === 'mapped' && row.fileKey !== null;
});
const REMOVED = TIMELINE_FILE_IDS.filter((file) => !MAPPED.includes(file));

function columnsOf(fileKey: string): Map<string, string> {
  const spec = NEW_DATA_SPEC_FILES.find((candidate) => candidate.key === fileKey);
  if (spec === undefined) throw new Error(`no spec for ${fileKey}`);
  return new Map(spec.columns.map((column) => [column.id, column.kind]));
}

/**
 * Made-up examples of every date shape the parser reads or the capture records,
 * keyed by the shape's pattern text. A recorded shape missing from this table
 * fails its column by file, column and shape.
 */
const SHAPE_EXAMPLES: Readonly<Record<string, string>> = {
  'YYYY-MM-DD HH:MM:SS.mmm': '2024-03-05 20:00:00.123',
  'YYYY-MM-DD HH:MM:SS': '2024-03-05 20:00:00',
  'DD.MM.YYYY HH:MM': '05.03.2024 20:00',
  'YYYY-MM-DD': '2024-03-05',
  'DD.MM.YYYY': '05.03.2024',
};

describe('TIMELINE_ENTRY_MAP against the specs', () => {
  it('has an entry for exactly the five timeline files', () => {
    expect(Object.keys(TIMELINE_ENTRY_MAP).sort()).toEqual([...TIMELINE_FILE_IDS].sort());
  });

  it.each(MAPPED)('%s: every named column exists in its spec with the right kind', (file) => {
    const columns = columnsOf(rowOf(file).fileKey!);
    const map = TIMELINE_ENTRY_MAP[file];
    const named = [
      map.dateColumn,
      map.primaryColumn,
      ...map.secondaryColumns,
      map.languageColumn,
      map.countryColumn,
      map.discriminatorColumn,
    ].filter((id): id is string => id !== null && id !== undefined);
    for (const id of named) expect(columns.has(id), `${file}: ${id}`).toBe(true);
    if (map.dateColumn !== null) expect(columns.get(map.dateColumn)).toBe('date');
  });

  it.each(MAPPED)('%s: a primary column, at most the bound of secondaries, no repeat', (file) => {
    const map = TIMELINE_ENTRY_MAP[file];
    expect(map.primaryColumn).not.toBeNull();
    if (file !== 'languageCountry') {
      expect(map.secondaryColumns.length).toBeLessThanOrEqual(MAX_TIMELINE_SECONDARY_PARTS);
    }
    expect(map.secondaryColumns).not.toContain(map.primaryColumn);
    expect(map.secondaryColumns).not.toContain(map.dateColumn);
    expect(new Set(map.secondaryColumns).size).toBe(map.secondaryColumns.length);
  });

  it('agrees with the capture on date, primary, secondary, language and country', () => {
    for (const file of MAPPED) {
      const row = rowOf(file);
      const map = TIMELINE_ENTRY_MAP[file];
      expect(map.dateColumn, file).toBe(row.date);
      expect(map.primaryColumn, file).toBe(row.primary);
      expect([...map.secondaryColumns], file).toEqual([...row.secondary]);
      expect(map.languageColumn ?? null, file).toBe(row.language);
      expect(map.countryColumn ?? null, file).toBe(row.country);
      expect(map.discriminatorColumn ?? null, file).toBe(row.discriminator);
    }
  });

  it('names a language and a country column for the language and country file', () => {
    if (!MAPPED.includes('languageCountry')) return;
    const map = TIMELINE_ENTRY_MAP.languageCountry;
    expect(map.languageColumn).toBeTruthy();
    expect(map.countryColumn).toBeTruthy();
  });

  it.each(REMOVED)('%s: a removed kind has a null file key and an all-null entry', (file) => {
    const row = rowOf(file);
    expect(row.fileKey).toBeNull();
    const map = TIMELINE_ENTRY_MAP[file];
    expect(map.dateColumn).toBeNull();
    expect(map.primaryColumn).toBeNull();
    expect(map.secondaryColumns).toEqual([]);
    expect(map.languageColumn ?? null).toBeNull();
    expect(map.countryColumn ?? null).toBeNull();
  });

  it('records no more timeline files than the capture marks mapped', () => {
    // A guard on the loops above: they must not be empty by accident.
    expect(MAPPED.length + REMOVED.length).toBe(TIMELINE_FILE_IDS.length);
    expect(MAPPED.length).toBeGreaterThan(0);
  });
});

describe('every mapped date column parses', () => {
  it.each(MAPPED)('%s: the recorded date shape reads a made-up example', (file) => {
    const row = rowOf(file);
    const map = TIMELINE_ENTRY_MAP[file];
    if (map.dateColumn === null) return;
    const recorded = DATE_SHAPES.find(
      (shape) => shape.fileKey === row.fileKey && shape.column === map.dateColumn,
    );
    expect(recorded, `${row.fileKey} ${map.dateColumn}: no DATE_SHAPES row`).toBeDefined();
    // The map carries the shape it was transcribed from.
    expect(map.dateShape, `${row.fileKey} ${map.dateColumn}`).toBe(recorded!.shape);
    const example = SHAPE_EXAMPLES[recorded!.shape];
    expect(
      example,
      `${row.fileKey} ${map.dateColumn}: shape "${recorded!.shape}" has no SHAPE_EXAMPLES row`,
    ).toBeDefined();
    expect(parseTimelineInstant(example!), `${row.fileKey} ${map.dateColumn}`).not.toBeNull();
  });

  it('reads every example of SHAPE_EXAMPLES as the one hand-derived instant', () => {
    // 2024-03-05 20:00:00 is 1709596800 + 20 * 3600 = 1709668800; the date-only
    // shapes are midnight, 1709596800.
    expect(parseTimelineInstant(SHAPE_EXAMPLES['YYYY-MM-DD HH:MM:SS.mmm'])).toBe(1709668800);
    expect(parseTimelineInstant(SHAPE_EXAMPLES['YYYY-MM-DD HH:MM:SS'])).toBe(1709668800);
    expect(parseTimelineInstant(SHAPE_EXAMPLES['DD.MM.YYYY HH:MM'])).toBe(1709668800);
    expect(parseTimelineInstant(SHAPE_EXAMPLES['YYYY-MM-DD'])).toBe(1709596800);
    expect(parseTimelineInstant(SHAPE_EXAMPLES['DD.MM.YYYY'])).toBe(1709596800);
  });

  it('keeps an impossible date of the recorded shape undated, never swapped', () => {
    expect(parseTimelineInstant('2024-13-05 20:00:00.123')).toBeNull();
    expect(parseTimelineInstant('2024-02-30 20:00:00.123')).toBeNull();
  });

  it('needs no widening: every recorded shape of a mapped column is one the parser reads', () => {
    for (const file of MAPPED) {
      const map = TIMELINE_ENTRY_MAP[file];
      expect(map.dateShape && SHAPE_EXAMPLES[map.dateShape], file).toBeTruthy();
    }
  });
});
