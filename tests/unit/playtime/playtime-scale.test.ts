import { beforeAll, describe, expect, test } from 'vitest';

import { parseCsvFile } from '../../../src/lib/worker/csv-parse.ts';
import {
  buildPlaytime,
  viewFromAggregates,
} from '../../../src/lib/features/playtime/playtime-aggregate.ts';
import {
  buildCalendarModel,
  buildDurationRows,
  buildHourGridModel,
  type CalendarModel,
  type DurationRow,
  type HourGridModel,
} from '../../../src/lib/features/playtime/playtime-model.ts';
import {
  DURATION_BIN_COUNT,
  HOUR_CELL_COUNT,
  HOUR_GRID_BASIS,
} from '../../../src/lib/features/playtime/playtime-shared.ts';
import type {
  PlaytimeAggregates,
  PlaytimeView,
} from '../../../src/lib/core/types/worker-messages.ts';
import {
  SCALE_5K_SPEC,
  SCALE_60K_SPEC,
  buildSessionsExport,
  type SessionsExpected,
  type SessionsFixtureSpec,
} from '../../fixtures/sessions-fixtures.ts';

// =============================================================================
// Phase 04, plan 04-12 — the SCALE criterion, at the pure level
// =============================================================================
//
// WHY THIS FILE EXISTS
// ROADMAP.md phase 4 success criterion 5: "With a synthetic fixture of 50k+
// sessions spanning 10-15 years, every activity chart renders without freezing
// the tab. The rendered SVG node count scales with buckets (days, cells,
// bins), not with sessions." That is the one phase-4 claim that cannot be
// argued from a small fixture, because the whole risk being retired is a cost
// that only shows up at scale.
//
// The criterion is proven at TWO levels, and this file is one of them:
//   1. HERE, in Node, through the real parse -> aggregate -> view -> model
//      pipeline. No DOM, no worker, no Dexie, so it is fast enough to run on
//      every commit and it is where the aggregation TIME budgets live.
//   2. In `tests/unit/import/ingest-worker.test.ts`, the same 60,000-session export
//      through the REAL import worker and the stored aggregate, because the
//      pure path alone would not notice a worker that stopped calling
//      `buildPlaytime`, or a stored aggregate that grew with row count.
//   3. And at the DOM level in `tests/e2e/playtime/playtime-scale.spec.ts`, because
//      "renders without freezing the tab" is a claim about the page.
//
// WHY 5,000 AND 60,000
// The two presets share every shape parameter — the same twelve active years,
// the same four server names plus one blank, the same bad-row mix — and differ
// only in `seed` and `sessions`. So ANY quantity that is a function of days,
// split values or bins is IDENTICAL between the two, while anything that grew
// with row count would be visible as a difference. That is the whole proof:
// `expected.calendarCells` is 4,748 for both, the hour grid is 168 cells for
// both, the duration list is 12 rows for both, and the stored-size BOUND is one
// and the same number for both.
//
// WHY EVERY EXPECTATION IS THE FIXTURE'S ANSWER KEY
// `SCALE_60K_SPEC.expected` is computed in closed form from the fixture's own
// layout by `expectedFrom` in `tests/fixtures/sessions-fixtures.ts` — by
// arithmetic over a hand-designed arrangement of back-to-back sessions,
// contained duplicates and zero-length rows, never by calling the aggregator.
// A test that read its expectation from `buildPlaytime` would agree with it by
// construction and could only ever catch a crash. Nothing below reads
// `buildPlaytime`, `viewFromAggregates` or a model builder to produce a number
// it then asserts.
//
// The SESSION RATIO IS DELIBERATELY NOT A BOUND
// A tempting bound is "12x the sessions, so at most 12x the size". It is
// wrong, and measuring it is why: the All slice's `dayIndex` cannot grow past
// the days in the active years, and a per-VALUE slice fills its own day array
// FASTER than the All slice does as sessions grow (at 60,000 sessions each
// value covers 4,023-4,083 of the 4,748 possible days; at 5,000 it covers
// 890-982). The honest bound is therefore days x values, and the ratio is only
// ever asserted as the SCALE CLAIM itself — 12x the sessions, same model size.
//
// Decisions: D-02 (merge-aware seconds at scale), D-03 (split values and
// per-value slices at scale), D-05 (twelve bins), D-06 (totals).
// =============================================================================

/** One `analyse()` result: everything the six tests below read. */
interface Analysis {
  expected: SessionsExpected;
  aggregates: PlaytimeAggregates;
  view: PlaytimeView;
  calendar: CalendarModel;
  hourGrid: HourGridModel;
  durations: DurationRow[];
  /** `buildPlaytime` alone, in milliseconds. */
  aggregateMs: number;
  /** The three model builders together, in milliseconds. */
  modelMs: number;
}

/**
 * Run one preset through the EXACT parse the worker performs, then time the
 * aggregation and the model builds separately.
 *
 * The two timings are kept apart on purpose: the plan's budgets are two
 * different claims. `buildPlaytime` is the cost that could plausibly grow with
 * sessions; the three model builders are the cost the page pays on every
 * render, and they read buckets, so their cost is a function of days and
 * values by construction. Timing them together would let one mask the other.
 */
function analyse(spec: SessionsFixtureSpec): Analysis {
  const { expected, csv } = buildSessionsExport(spec);

  // The worker's own call: `parseCsvFile(text, entry.name, resolved.sourceFile)`
  // with the category folder and the path under it (ingest.worker.ts:311).
  const parsed = parseCsvFile(csv, 'Activity_history', 'Sessions.csv');
  const records = parsed.rows.map((row) => row.data);

  const aggregateStart = performance.now();
  const aggregates = buildPlaytime(records, true);
  const aggregateMs = performance.now() - aggregateStart;

  const view = viewFromAggregates(aggregates, null);
  if (view.status !== 'ready') {
    throw new Error(`analyse: the ${spec.sessions}-session preset did not reach 'ready'`);
  }

  const modelStart = performance.now();
  const calendar = buildCalendarModel(view.slice);
  // The basis is passed explicitly rather than left to the default so this
  // file's claim is basis-explicit at a glance, exactly as the worker-level
  // test in `ingest-worker.test.ts` is. The other grid is read by the
  // hour-invariants test below, never written.
  const hourGrid = buildHourGridModel(view.slice, HOUR_GRID_BASIS);
  const durations = buildDurationRows(view.slice.bins, view.slice.sessions);
  const modelMs = performance.now() - modelStart;

  return { expected, aggregates, view, calendar, hourGrid, durations, aggregateMs, modelMs };
}

// -----------------------------------------------------------------------------
// The stored-size bound
// -----------------------------------------------------------------------------

/**
 * Upper bound on the JSON length of a stored `playtime` aggregate, computed
 * from DAYS and VALUES and never from the session count.
 *
 * The same formula is written out a second time, in the worker-level test in
 * `tests/unit/import/ingest-worker.test.ts`, because a bound that lived in one shared
 * helper would let a change to the constant be invisible on the other side of
 * the worker boundary. Two copies, each with a pointer at the other, is the
 * cheapest thing that keeps the two claims separate.
 *
 * Per slice:
 *   - `calendarCells x 20` for the three per-day arrays. 20 characters per day
 *     is generous for the worst realistic day: a five-digit day index, a
 *     seven-digit seconds figure, a four-digit session count and their three
 *     commas is nineteen, so the bound cannot be crossed by a day that exists.
 *   - `(HOUR_CELL_COUNT x 2 + DURATION_BIN_COUNT) x 9` for the two 168-cell
 *     hour grids and the 12 bins, at nine characters per number.
 *   - 200 characters of keys and the `split` label.
 * Plus 2,000 for the aggregate record's own keys and the value list.
 */
function storedSizeBound(expected: SessionsExpected): number {
  const perSlice =
    expected.calendarCells * 20 + (HOUR_CELL_COUNT * 2 + DURATION_BIN_COUNT) * 9 + 200;
  const slices = 1 + expected.values.length;
  return slices * perSlice + 2_000;
}

// -----------------------------------------------------------------------------
// Budgets. Named so the failure message names the budget that was missed.
// -----------------------------------------------------------------------------

/** `buildPlaytime` over 60,000+ sessions, from parsed rows to aggregates. */
const AGGREGATE_BUDGET_MS = 5_000;

/** All three model builders together, on the 60,000-session slice. */
const MODEL_BUDGET_MS = 2_000;

// -----------------------------------------------------------------------------
// The oracle's 400-day guard, measured rather than assumed
// -----------------------------------------------------------------------------

/** The guard in `tests/helpers/session-oracle.ts`; kept as a literal on purpose. */
const ORACLE_BITMAP_GUARD_SECONDS = 400 * 86_400;

/** The Sessions.csv cell columns this test reads. */
const START_CELL = 0;
const END_CELL = 1;

/**
 * A CSV wall-clock cell as Unix seconds.
 *
 * Deliberately NOT `civil-date.ts` and NOT `Date.parse`: the probe exists to
 * measure the SHAPE of the session set (how wide, how dense), so it uses the
 * most direct conversion available rather than borrowing any of the project's
 * calendar arithmetic.
 */
function wallClockToSeconds(value: string): number {
  return (
    Date.UTC(
      Number(value.slice(0, 4)),
      Number(value.slice(5, 7)) - 1,
      Number(value.slice(8, 10)),
      Number(value.slice(11, 13)),
      Number(value.slice(14, 16)),
      Number(value.slice(17, 19)),
    ) / 1000
  );
}

/**
 * A row is usable when both instants parse, both are REAL dates and the end is
 * not before the start — the whole of D-02's exclusion rule, written out here
 * so the probe's session set is the same set the aggregator counted.
 *
 * The real-date check is not decoration. `Date.UTC(2020, 1, 30)` rolls
 * `2020-02-30` over into 1 March rather than refusing it, so without a
 * round-trip the probe would keep one row the aggregator correctly drops, and
 * the set being measured would not be the set under test. (04-11's local
 * converter has the same property; it costs nothing there because the nine-row
 * hand fixture carries no impossible date.)
 */
function isUsableRow(row: readonly (string | null)[]): boolean {
  const start = row[START_CELL] ?? '';
  const end = row[END_CELL] ?? '';
  if (start === '' || end === '') return false;
  const startSeconds = wallClockToSeconds(start);
  const endSeconds = wallClockToSeconds(end);
  if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds)) return false;
  const roundTrip = (seconds: number) =>
    new Date(seconds * 1000).toISOString().slice(0, 19).replace('T', ' ');
  if (roundTrip(startSeconds) !== start || roundTrip(endSeconds) !== end) return false;
  return endSeconds >= startSeconds;
}

/**
 * Widest span of a session set, as `[earliest start, latest end]`.
 *
 * A reduce rather than `Math.max(...sessions)`: the 60,000-session cluster
 * holds 71,843 sessions, which is past the engine's argument limit, and a
 * probe that crashed on its own input would report nothing.
 */
function spanOf(sessions: readonly Span[]): { from: number; to: number } {
  let from = Number.POSITIVE_INFINITY;
  let to = Number.NEGATIVE_INFINITY;
  for (const session of sessions) {
    if (session.start < from) from = session.start;
    if (session.end > to) to = session.end;
  }
  return { from, to };
}

interface Span {
  start: number;
  end: number;
}

describe('04-12 scale: model sizes follow buckets, not sessions', () => {
  let small: Analysis;
  let large: Analysis;

  // 90,000 ms: both presets are built, parsed, aggregated and modelled here,
  // and the default 5 s hook timeout would fail the whole describe even though
  // the work takes well under a second.
  beforeAll(() => {
    small = analyse(SCALE_5K_SPEC);
    large = analyse(SCALE_60K_SPEC);
  }, 90_000);

  test('the presets meet the roadmap criterion: 50k+ sessions over 10-15 years, with bad rows and blanks', () => {
    // Roadmap phase 4 success criterion 5 asks for 50k+ sessions over 10-15
    // years. The usable count is higher than `spec.sessions` because the
    // contained-duplicate rows are usable sessions too, and the year list is
    // longer than `spec.years` because the stray 1970 row pins the epoch floor.
    expect(large.expected.sessions).toBeGreaterThanOrEqual(50_000);
    expect(large.expected.years.length).toBeGreaterThanOrEqual(10);
    expect(large.expected.years.length).toBeLessThanOrEqual(15);
    // The fixture has to be DIRTY, or a scale proof says nothing about the
    // excluded-row path (D-02) and the blank split value (D-03).
    expect(large.expected.excluded).toBeGreaterThan(0);
    expect(large.expected.values).toContain(null);
    // The scale claim itself: the same shape, more than ten times the sessions.
    expect(large.expected.sessions).toBeGreaterThan(small.expected.sessions * 10);
  });

  test('both presets aggregate to exactly the analytic key (D-02, D-03, D-05, D-06)', () => {
    for (const analysis of [small, large]) {
      const { expected, aggregates, view } = analysis;
      if (view.status !== 'ready') throw new Error('expected a ready view');

      // D-06: the totals, at the scale that makes them large enough to be wrong.
      expect(view.slice.sessions).toBe(expected.sessions);
      expect(view.slice.excluded).toBe(expected.excluded);
      expect(view.slice.seconds).toBe(expected.seconds);
      // ACTIVITY-02's calendar input, day for day.
      expect(view.slice.dayIndex).toEqual(expected.dayIndex);
      expect(view.slice.daySeconds).toEqual(expected.daySeconds);
      expect(view.slice.daySessions).toEqual(expected.daySessions);
      // `dayIndex.length` IS the active-day count (D-06), by construction.
      expect(view.slice.dayIndex.length).toBe(expected.activeDays.length);
      // ACTIVITY-03's two stored bases, both read, one chosen by the UI.
      expect(view.slice.hourOverlap).toEqual(expected.hourOverlap);
      expect(view.slice.hourStart).toEqual(expected.hourStart);
      // ACTIVITY-04's twelve bins, in `DURATION_BIN_EDGES_SECONDS` order.
      expect(view.slice.bins).toEqual(expected.bins);

      // D-03: the split the column rule chose, the values in their stored
      // order, and the hours behind each one.
      expect(aggregates.splitColumn).toBe(expected.splitColumn);
      expect(view.split?.column).toBe(expected.splitColumn);
      expect(view.split?.allSeconds).toBe(expected.seconds);
      expect(view.split?.values.map((entry) => entry.seconds)).toEqual(expected.valueSeconds);
      // The STORED value list keeps `null` for the blank server, which is what
      // tells a genuinely blank cell apart from a server whose real name is
      // `(not recorded)`. The VIEW is a display projection and flattens that
      // `null` to `''` (`viewFromAggregates`), which `splitValue` in
      // playtime-state maps straight back — so both forms are asserted here
      // rather than one being assumed from the other.
      expect(aggregates.values).toEqual(expected.values);
      expect(view.split?.values.map((entry) => entry.value)).toEqual(
        expected.values.map((value) => value ?? ''),
      );

      // Every split value's OWN slice, which is where per-value exclusion
      // accounting lives (D-02 within D-03).
      expect(aggregates.byValue).toHaveLength(expected.values.length);
      expected.values.forEach((_value, index) => {
        const slice = aggregates.byValue[index]!;
        expect(slice.seconds, `value ${index} seconds`).toBe(expected.valueSeconds[index]);
        expect(slice.sessions, `value ${index} sessions`).toBe(expected.valueSessions[index]);
        expect(slice.excluded, `value ${index} excluded`).toBe(expected.valueExcluded[index]);
      });
    }
  });

  test('model sizes follow buckets: equal cells for 5k and 60k, 168 hours, twelve bins (ACTIVITY-02/03/04)', () => {
    for (const analysis of [small, large]) {
      const { expected, calendar, hourGrid, durations, view } = analysis;

      // The calendar draws one cell per DAY in the active years. The model's
      // own `cellCount` and the sum over its year blocks must agree, or the
      // "equal at both sizes" claim below would be comparing two different
      // things. A year block is seven weekday ROWS of cells, so the count is
      // the sum over rows as well as over blocks.
      expect(calendar.cellCount).toBe(expected.calendarCells);
      expect(calendar.years).toEqual(expected.years);
      const drawnCells = calendar.blocks
        .filter((block) => block.kind === 'year')
        .reduce(
          (total, block) =>
            total +
            (block.kind === 'year' ? block.rows.reduce((rows, row) => rows + row.length, 0) : 0),
          0,
        );
      expect(drawnCells).toBe(expected.calendarCells);

      expect(hourGrid.cells).toHaveLength(HOUR_CELL_COUNT);
      expect(durations).toHaveLength(DURATION_BIN_COUNT);
      // D-05: the bins account for every usable session exactly once.
      expect(durations.reduce((total, row) => total + row.count, 0)).toBe(expected.sessions);
      if (view.status === 'ready') {
        expect(durations.reduce((total, row) => total + row.count, 0)).toBe(view.slice.sessions);
      }
    }

    // THE scale claim at model level: 12x the sessions, the same chart.
    expect(large.expected.sessions).toBeGreaterThan(small.expected.sessions * 10);
    expect(large.calendar.cellCount).toBe(small.calendar.cellCount);
    expect(large.hourGrid.cells).toHaveLength(small.hourGrid.cells.length);
    expect(large.durations).toHaveLength(small.durations.length);
  });

  test('the stored aggregate stays inside the days-times-values bound, the SAME bound for both presets', () => {
    const bounds = [small, large].map((analysis) => storedSizeBound(analysis.expected));

    // The bound depends on days and values, so the two presets must produce
    // one and the same number. If this ever fails, one of the fixtures changed
    // its year span or its split width, and the "equal at both sizes" claim
    // above is comparing different charts.
    expect(large.expected.calendarCells).toBe(small.expected.calendarCells);
    expect(large.expected.values.length).toBe(small.expected.values.length);
    expect(bounds[1]).toBe(bounds[0]);

    for (const [index, analysis] of [small, large].entries()) {
      const { expected, aggregates } = analysis;
      const bound = bounds[index]!;
      const measured = JSON.stringify(aggregates).length;
      expect(measured, `stored aggregate JSON length (bound ${bound})`).toBeLessThanOrEqual(bound);

      // Every slice's day list is bounded by the days in the active years.
      expect(aggregates.all.dayIndex.length).toBeLessThanOrEqual(expected.calendarCells);
      for (const slice of aggregates.byValue) {
        expect(slice.dayIndex.length).toBeLessThanOrEqual(expected.calendarCells);
      }
    }
  });

  test('both hour grids sum to the merged total at scale (D-02 under D-01)', () => {
    for (const analysis of [small, large]) {
      const { expected, view } = analysis;
      if (view.status !== 'ready') throw new Error('expected a ready view');
      const sum = (grid: readonly number[]) => grid.reduce((total, value) => total + value, 0);
      // The overlap grid and the start grid are two ATTRIBUTIONS of the same
      // merged seconds, so both must reconcile with the total or one of them
      // has double-counted a midnight crossing. At 60,000 sessions there are
      // thousands of crossings, which is exactly what makes this load-bearing.
      expect(sum(view.slice.hourOverlap)).toBe(expected.seconds);
      expect(sum(view.slice.hourStart)).toBe(expected.seconds);
    }
  });

  test('time budgets: the 60,000-session aggregation and the model builders stay inside them', () => {
    const aggregateMessage =
      `buildPlaytime over ${large.expected.sessions} sessions took ` +
      `${large.aggregateMs.toFixed(1)} ms (budget ${AGGREGATE_BUDGET_MS} ms)`;
    expect(large.aggregateMs, aggregateMessage).toBeLessThan(AGGREGATE_BUDGET_MS);

    const modelMessage =
      `the three model builders took ${large.modelMs.toFixed(1)} ms ` +
      `(budget ${MODEL_BUDGET_MS} ms)`;
    expect(large.modelMs, modelMessage).toBeLessThan(MODEL_BUDGET_MS);
  });

  // ===========================================================================
  // Why there is NO oracle cross-check at 60,000 sessions — measured, not assumed
  // ===========================================================================

  test("the oracle cannot cross-check the 60,000-session preset: 04-11's cluster rule cannot split a dense twelve-year set", () => {
    // 04-11 proved its nine-row hand fixture against the INDEPENDENT oracle
    // from plan 04-03, and had to solve the oracle's 400-day per-second bitmap
    // guard with a cluster-at-the-gap split whose two safety properties are
    // asserted inside the helper. The obvious question for a twelve-year
    // fixture is whether the same split works at 60,000 sessions.
    //
    // It does not, and the reason is worth stating rather than discovering at
    // some later phase: the guard is a MEMORY bound, but a cluster is only
    // split off at a GAP WIDER than the guard, so the split is available
    // exactly when the data is SPARSE. 60,000 sessions over twelve years is
    // about thirteen a day and the layout fills each year exactly, so the only
    // gap anywhere near 400 days is the one before the stray 1970 row. The
    // whole twelve-year set is a single cluster that is itself wider than the
    // guard, and no amount of clustering reaches a sub-guard piece.
    //
    // So the instrument for this preset is the fixture's CLOSED-FORM answer
    // key, which is independent of the aggregator in a stronger way than the
    // oracle is: it never calls the code it checks at all. What this test does
    // is convert "the approach should still work" into a measurement, and prove
    // 04-11's two properties still hold for whatever clustering the rule does
    // produce — so a future reader sees the boundary rather than an omission.
    const rows = buildSessionsExport(SCALE_60K_SPEC)
      .csv.split('\r')
      .slice(1)
      .filter((line) => line !== '')
      .map((line) => line.split(';') as (string | null)[]);
    const usable = rows.filter(isUsableRow).map<Span>((row) => ({
      start: wallClockToSeconds(row[START_CELL]!),
      end: wallClockToSeconds(row[END_CELL]!),
    }));
    expect(usable.length).toBe(large.expected.sessions);

    // 04-11's rule, verbatim in shape: order by start, and open a new cluster
    // only at a gap of at least the guard measured from the RUNNING MAXIMUM end
    // of the open cluster.
    const clusters: Span[][] = [];
    let openEnd = Number.NEGATIVE_INFINITY;
    for (const session of [...usable].sort((a, b) => a.start - b.start)) {
      if (clusters.length === 0 || session.start - openEnd >= ORACLE_BITMAP_GUARD_SECONDS) {
        clusters.push([session]);
        openEnd = session.end;
        continue;
      }
      clusters.at(-1)!.push(session);
      openEnd = Math.max(openEnd, session.end);
    }

    // Property 2 first, because it is the one that would make a summed result
    // inexact: consecutive clusters are at least a whole day apart, so no
    // second and no day number is shared.
    for (let i = 1; i < clusters.length; i += 1) {
      const previous = spanOf(clusters[i - 1]!);
      const current = spanOf(clusters[i]!);
      expect(
        current.from - previous.to,
        `cluster ${i} is not a whole day clear of cluster ${i - 1}`,
      ).toBeGreaterThanOrEqual(86_400);
    }

    // Exactly one cluster is the twelve-year body, and it is over the guard —
    // the measured reason the oracle is not an instrument at this scale. The
    // other is the stray 1970 row the spec pins on purpose.
    const spans = clusters.map((cluster) => ({
      sessions: cluster.length,
      span: spanOf(cluster).to - spanOf(cluster).from,
    }));
    const overGuard = spans.filter((entry) => entry.span > ORACLE_BITMAP_GUARD_SECONDS);
    expect(overGuard).toHaveLength(1);
    expect(overGuard[0]!.sessions).toBe(usable.length - 1);
    // The 1970 stray: one row, a few minutes long, alone in its cluster.
    expect(spans).toHaveLength(2);
    expect(spans.find((entry) => entry.span <= ORACLE_BITMAP_GUARD_SECONDS)?.sessions).toBe(1);
  });
});
