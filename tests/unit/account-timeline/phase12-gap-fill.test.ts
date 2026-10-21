import { describe, expect, it } from 'vitest';
import { PANE_MAPPING } from '../../fixtures/new-data-headers.ts';
import { buildTimelineView } from '../../../src/lib/features/account-timeline/timeline-aggregate.ts';
import {
  TIMELINE_ENTRY_MAP,
  TIMELINE_FILE_IDS,
  type TimelineFileId,
} from '../../../src/lib/features/account-timeline/timeline-shared.ts';
import { buildNewDataCard } from '../../../src/lib/features/new-data/new-data-aggregate.ts';
import { NEW_DATA_SPEC_FILES } from '../../../src/lib/worker/new-data-specs.ts';
import { looksLikeEmail } from '../../../src/lib/worker/new-data-allowlist.ts';
import { formatTimelineShowing, formatMergeNote } from '../../../src/lib/ui-copy.ts';
import type { AccountRowGroup, CsvRow } from '../../../src/lib/worker/csv-columns.ts';

// =============================================================================
// Phase 12 Nyquist gap fill (G1-G5, G7). Tests marked `it.fails` describe a
// REQUIREMENT the implementation does not yet meet (12-REVIEW.md finding named
// in each title). They assert the CORRECT behaviour; `it.fails` keeps the suite
// green while the bug exists and turns RED the day it is fixed, at which point
// the marker must be removed.
// =============================================================================

const LABELS: Readonly<Record<TimelineFileId, string>> = {
  name: 'Name',
  service: 'Service',
  languageCountry: 'Language and country',
  bans: 'Ban',
  thirdParties: 'Third party',
};
const FILE_KEYS = Object.fromEntries(
  TIMELINE_FILE_IDS.map((file) => {
    const row = PANE_MAPPING.find((r) => r.pane === 'timeline' && r.cardOrKind === LABELS[file]);
    return [file, row !== undefined && row.status === 'mapped' ? row.fileKey : null];
  }),
) as Record<TimelineFileId, string | null>;

const A = '630000001';
const group = (rows: CsvRow[]): AccountRowGroup => ({ account: A, rows });
const D1 = '2024-03-05 20:00:00.000';

function timelineOf(file: TimelineFileId, rows: CsvRow[]) {
  const inputs = {} as Record<
    TimelineFileId,
    { groups: AccountRowGroup[]; seen: boolean; parsed: number | null }
  >;
  for (const f of TIMELINE_FILE_IDS) {
    inputs[f] =
      f === file
        ? { groups: [group(rows)], seen: true, parsed: rows.length }
        : { groups: [], seen: false, parsed: null };
  }
  return buildTimelineView(inputs, FILE_KEYS, [A]);
}

const couponSpec = NEW_DATA_SPEC_FILES.find((s) => s.key === 'personal_coupons.csv')!;
const couponCard = (rows: CsvRow[]) =>
  buildNewDataCard(couponSpec, { groups: [group(rows)], seen: true, parsed: rows.length });

describe('G1 (WR-01): the export null marker reads as "no value" everywhere', () => {
  it.fails('a coupon date cell of \\N is shown as no value, not the literal text', () => {
    const card = couponCard([{ INSERTED_AT: D1, EXPIRED_AT: '\\N', STATUS: 'ACTIVE' }]);
    expect(card.status).toBe('ready');
    if (card.status !== 'ready') return;
    const all = card.rows.flatMap((r) => r.cells);
    expect(all).not.toContain('\\N');
  });

  it('control: N/A is already treated as no value', () => {
    const card = couponCard([{ INSERTED_AT: D1, EXPIRED_AT: 'N/A', STATUS: 'ACTIVE' }]);
    if (card.status !== 'ready') throw new Error('expected ready');
    expect(card.rows[0]!.cells).not.toContain('N/A');
  });

  it.runIf(FILE_KEYS.name !== null && TIMELINE_ENTRY_MAP.name.secondaryColumns.length > 0).fails(
    'a name-change secondary part of \\N is not rendered as the literal text',
    () => {
      const m = TIMELINE_ENTRY_MAP.name;
      const row: CsvRow = {
        [m.dateColumn!]: D1,
        [m.primaryColumn!]: 'new',
        [m.secondaryColumns[0]!]: '\\N',
      };
      const view = timelineOf('name', [row]);
      const cells = view.entries.flatMap((e) => e.parts.map((p) => p.cell));
      // Currently fails: the marker leaks through. Kept as a plain assertion below.
      expect(cells).not.toContain('\\N');
    },
  );
});

describe('G2 (WR-01b): an open or dated ban end is surfaced', () => {
  it.runIf(FILE_KEYS.bans !== null).fails('a ban EXPIRED_AT value appears in the ban entry', () => {
    const m = TIMELINE_ENTRY_MAP.bans;
    const row: CsvRow = {
      [m.dateColumn!]: D1,
      [m.primaryColumn!]: 'ACTIVE',
      EXPIRED_AT: '2031-02-03 04:05:06.000',
    };
    const view = timelineOf('bans', [row]);
    const cells = view.entries.flatMap((e) => e.parts.map((p) => String(p.cell)));
    expect(cells.join('|')).toContain('2031-02-03');
  });
});

describe('G3 (WR-02): unplaceable language/country rows are never silently lost', () => {
  it.runIf(FILE_KEYS.languageCountry !== null).fails(
    'a ready file that produced zero entries is not reported as ready',
    () => {
      const m = TIMELINE_ENTRY_MAP.languageCountry;
      const row: CsvRow = {
        [m.dateColumn!]: D1,
        [m.primaryColumn!]: 'SET',
        [m.discriminatorColumn!]: 'locale',
        [m.languageColumn!]: 'en',
      };
      const view = timelineOf('languageCountry', [row]);
      expect(view.storedRows).toBe(1);
      // Either the row is shown, or the file must not claim to be ready/listed.
      expect(view.entries.length > 0 || view.files.languageCountry !== 'ready').toBe(true);
    },
  );
});

describe('G4 (IN-02): count wording', () => {
  it.fails('formatTimelineShowing(1, 1) is grammatical', () => {
    expect(formatTimelineShowing(1, 1)).not.toMatch(/\b1 entries\b/);
  });
  it('control: plural and partial wording', () => {
    expect(formatTimelineShowing(2, 2)).toBe('Showing all 2 entries');
    expect(formatTimelineShowing(1, 5)).toBe('Showing 1 of 5 entries');
    expect(formatMergeNote(1)).toContain('1 entry is identical');
  });
});

describe('G5 (IN-03): an all-dropped row is not a ready card', () => {
  it.fails('rows that stored no allowlisted cell do not yield a ready, column-less card', () => {
    const card = couponCard([{}, {}]);
    expect(card.status === 'ready' && card.columns.length === 0).toBe(false);
  });
});

describe('G7 (WR-04): the email guard', () => {
  it('control: ordinary addresses are caught', () => {
    expect(looksLikeEmail('someone@example.com')).toBe(true);
    expect(looksLikeEmail('plain text')).toBe(false);
  });
  it.fails('catches an intranet address with no dot', () => {
    expect(looksLikeEmail('user@localhost')).toBe(true);
  });
  it.fails('catches a full-width at-sign address', () => {
    expect(looksLikeEmail('user＠example.com')).toBe(true);
  });
  it.fails('catches a trailing-dot domain', () => {
    expect(looksLikeEmail('user@example.')).toBe(true);
  });
});
