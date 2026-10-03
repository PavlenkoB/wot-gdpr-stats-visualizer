/**
 * 05-09 tracer: premium months to geometry.
 *
 * The monthly bar chart's every decision is a pure function, so a reader in any
 * timezone and any locale gets the same chart — and, more to the point here, so
 * the geometry is assertable at all. Vitest runs with no DOM, which means a
 * decision that lived inside a Svelte component could not be tested at all.
 *
 * The numbers below are the hand-derived ones the plan states, written as
 * literals so a change in the model shows up as a failing number rather than as
 * a model that agrees with itself. Where a height is not obvious, the arithmetic
 * is in the comment beside it.
 */
import { describe, expect, it } from 'vitest';
import * as chart from '../../../src/lib/charts/bar-chart-model';

/**
 * The premium hand fixture (PREMIUM_HAND_EXPECTED): 2019-03 to 2019-07 is five
 * month indexes, with April absent from `months` and therefore drawn empty.
 * Values are the month's granted premium in days, because the caller has
 * already converted the micro-unit seconds to plain numbers (the model never
 * sees BigInt).
 */
const HAND_FIRST = 24_230;
const HAND_LAST = 24_234;

const HAND_MONTHS: readonly chart.BarChartInput['months'][number][] = [
  { month: 24_230, up: 5, down: 0 },
  { month: 24_232, up: 31.5, down: 0 },
  { month: 24_233, up: 2.5, down: 0 },
  { month: 24_234, up: 14, down: 0 },
];

function handModel(): chart.BarChartModel {
  return chart.buildBarChartModel({
    kind: 'premium',
    firstMonth: HAND_FIRST,
    lastMonth: HAND_LAST,
    months: HAND_MONTHS,
  });
}

/** A month of flow in both directions, for the node-budget bound. */
function bothWays(monthCount: number): readonly chart.BarChartInput['months'][number][] {
  return Array.from({ length: monthCount }, (_unused, index) => ({
    month: 1_000 + index,
    up: 1 + (index % 7),
    down: 1 + (index % 3),
  }));
}

describe('05-09 tracer: premium months to geometry', () => {
  describe('pitchFor — the largest whole pixel from 4 to 16 that fits 576px', () => {
    it('takes the 16px cap up to the 36 months that exactly fill 576px', () => {
      // 36 x 16 = 576, so 16 is a cap the column reaches rather than a step
      // above the one under it. A bar is a mark and not a panel, so short
      // charts — the five-month premium chart, a one-month currency — keep the
      // 16px pitch and stay narrow.
      expect(chart.pitchFor(1)).toBe(16);
      expect(chart.pitchFor(36)).toBe(16);
    });

    it('gives back one pixel at a time, from 15 at 37 months down to 4 at 144', () => {
      // Every figure below is a hand-derived pair: a month count and the whole
      // number of pixels per month that fits it, with the plot it buys written
      // beside it and the next pitch up that would NOT fit. The old ladder of
      // 16, 12, 8 and 4 answered 12 for 37 months, 8 for 49, 8 for 73, 4 for
      // 100 and 4 for 116, so every line here is a literal that fails against
      // it — which is the point: the fill is now a property of the rule rather
      // than of which step the month count happened to land on.
      expect(chart.pitchFor(37)).toBe(15); // 37 x 15 = 555; 37 x 16 = 592
      expect(chart.pitchFor(38)).toBe(15); // 38 x 15 = 570; 38 x 16 = 608
      expect(chart.pitchFor(39)).toBe(14); // 39 x 14 = 546; 39 x 15 = 585
      expect(chart.pitchFor(41)).toBe(14); // 41 x 14 = 574; 41 x 15 = 615
      expect(chart.pitchFor(42)).toBe(13); // 42 x 13 = 546; 42 x 14 = 588
      expect(chart.pitchFor(44)).toBe(13); // 44 x 13 = 572; 44 x 14 = 616
      expect(chart.pitchFor(45)).toBe(12); // 45 x 12 = 540; 45 x 13 = 585
      expect(chart.pitchFor(48)).toBe(12); // 48 x 12 = 576, exactly full
      expect(chart.pitchFor(49)).toBe(11); // 49 x 11 = 539; 49 x 12 = 588
      expect(chart.pitchFor(52)).toBe(11); // 52 x 11 = 572; 52 x 12 = 624
      expect(chart.pitchFor(53)).toBe(10); // 53 x 10 = 530; 53 x 11 = 583
      expect(chart.pitchFor(57)).toBe(10); // 57 x 10 = 570; 57 x 11 = 627
      expect(chart.pitchFor(58)).toBe(9); // 58 x 9 = 522;  58 x 10 = 580
      expect(chart.pitchFor(64)).toBe(9); // 64 x 9 = 576, exactly full
      expect(chart.pitchFor(65)).toBe(8); // 65 x 8 = 520;  65 x 9 = 585
      expect(chart.pitchFor(72)).toBe(8); // 72 x 8 = 576, exactly full
      expect(chart.pitchFor(73)).toBe(7); // 73 x 7 = 511;  73 x 8 = 584
      expect(chart.pitchFor(82)).toBe(7); // 82 x 7 = 574;  82 x 8 = 656
      expect(chart.pitchFor(83)).toBe(6); // 83 x 6 = 498;  83 x 7 = 581
      expect(chart.pitchFor(96)).toBe(6); // 96 x 6 = 576, exactly full
      expect(chart.pitchFor(97)).toBe(5); // 97 x 5 = 485;  97 x 6 = 582
      expect(chart.pitchFor(115)).toBe(5); // 115 x 5 = 575; 115 x 6 = 690
      expect(chart.pitchFor(116)).toBe(4); // 116 x 4 = 464, where the floor binds
      expect(chart.pitchFor(144)).toBe(4); // 144 x 4 = 576, exactly full
    });

    it('keeps the minimum pitch past 144 months, where the chart scrolls', () => {
      // 116 x 5 = 580, so 5 no longer fits; nothing below the 4px floor does
      // either, and 1,572 is the date window's own bound on the month span.
      expect(chart.pitchFor(145)).toBe(4);
      expect(chart.pitchFor(240)).toBe(4);
      expect(chart.pitchFor(1_572)).toBe(4);
    });

    it('answers a degenerate month count with a whole pixel and never NaN', () => {
      // The month count comes from untrusted dates (T-05-63). A count under 1
      // is the widest pitch, and a count that is not finite has no ratio to
      // take, so it gets the narrowest — never a NaN, which would put the
      // geometry somewhere unrecoverable.
      expect(chart.pitchFor(0)).toBe(16);
      expect(chart.pitchFor(-5)).toBe(16);
      expect(chart.pitchFor(Number.NaN)).toBe(4);
      expect(chart.pitchFor(Number.POSITIVE_INFINITY)).toBe(4);

      for (const count of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
        const pitch = chart.pitchFor(count);
        expect(Number.isInteger(pitch), `${count}`).toBe(true);
        expect(pitch, `${count}`).toBeGreaterThanOrEqual(4);
        expect(pitch, `${count}`).toBeLessThanOrEqual(16);
      }
    });

    it('scrolls above 144 months and not below, because 144 x 4 is exactly 576', () => {
      expect(chart.buildBarChartModel(currency(144)).scrolls).toBe(false);
      expect(chart.buildBarChartModel(currency(145)).scrolls).toBe(true);
      expect(chart.buildBarChartModel(currency(240)).scrolls).toBe(true);
    });
  });

  describe('the SVG width — 56 + months x pitch + 4, at the pitch that fits', () => {
    it.each([
      [37, 15, 615],
      [56, 10, 620],
      [73, 7, 571],
      [100, 5, 560],
      [115, 5, 635],
      [116, 4, 524],
      [144, 4, 636],
    ])('%i months at pitch %i is %ipx wide', (monthCount, pitch, width) => {
      const model = chart.buildBarChartModel(currency(monthCount));

      expect(model.pitch).toBe(pitch);
      expect(model.width).toBe(width);
      // Bar width stays pitch - 1, so there is always a 1px gap between marks,
      // and the pointer target is the whole pitch so a hairline is still
      // clickable.
      expect(model.barWidth).toBe(pitch - 1);
      expect(model.cells).toHaveLength(monthCount);
      for (const cell of model.cells) {
        expect(cell.hitWidth).toBe(pitch);
      }
    });

    it('fills at least 80% of the plot from 37 to 144 months', () => {
      // The invariant that replaces the ladder. On the old steps a 73-month
      // chart drew 73 x 4 = 292 of 576px — 50.7% — while the worst case now is
      // 116 months at 464px, 80.6%, because 4px is the floor from 116 months
      // on. Every count that divides 576 is exactly full.
      for (let monthCount = 37; monthCount <= 144; monthCount += 1) {
        const model = chart.buildBarChartModel(currency(monthCount));
        const plotWidth = model.monthCount * model.pitch;
        const where = `${monthCount} months`;

        expect(plotWidth, where).toBeLessThanOrEqual(chart.BAR_LAYOUT.maxPlotWidthPx);
        expect(plotWidth, where).toBeGreaterThanOrEqual(0.8 * chart.BAR_LAYOUT.maxPlotWidthPx);
      }

      // 464 is the minimum, stated as a literal rather than left to the loop.
      expect(116 * chart.pitchFor(116)).toBe(464);
      expect(73 * chart.pitchFor(73)).toBe(511);
    });
  });

  describe('the premium hand fixture, month by month', () => {
    it('draws five cells from the first month to the last, April included but empty', () => {
      const model = handModel();

      expect(model.monthCount).toBe(5);
      expect(model.cells.map((cell) => cell.month)).toEqual([
        24_230, 24_231, 24_232, 24_233, 24_234,
      ]);
      expect(model.cells.map((cell) => cell.x)).toEqual([56, 72, 88, 104, 120]);
      expect(model.pitch).toBe(16);
      expect(model.barWidth).toBe(15);
    });

    it('is 140 wide by 128 tall, with its baseline at y 104', () => {
      const model = handModel();

      // 56 gutter + 5 x 16 plot + 4 right padding.
      expect(model.width).toBe(140);
      expect(model.height).toBe(128);
      expect(model.plotTop).toBe(8);
      expect(model.plotHeight).toBe(96);
      expect(model.zeroY).toBe(104);
      expect(model.domainMax).toBe(31.5);
    });

    it('scales every bar linearly from zero, the 2px floor included', () => {
      const model = handModel();

      // 5 over 31.5 times 96 is 15.24, so 15.
      expect(model.cells[0].up?.height).toBe(15);
      // April is absent from the fixture, so it is drawn empty rather than zero.
      expect(model.cells[1].hasData).toBe(false);
      expect(model.cells[1].up).toBeNull();
      // May is the domain maximum, so it is the full plot height.
      expect(model.cells[2].up?.height).toBe(96);
      // 2.5 over 31.5 times 96 is 7.62, so 8.
      expect(model.cells[3].up?.height).toBe(8);
      // 14 over 31.5 times 96 is 42.67, so 43.
      expect(model.cells[4].up?.height).toBe(43);
    });

    it('puts every premium bar on the baseline, so y is the baseline minus its height', () => {
      const model = handModel();

      expect(model.cells[0].up?.y).toBe(89); // 104 - 15
      expect(model.cells[2].up?.y).toBe(8); // 104 - 96, the plot top
      expect(model.cells[3].up?.y).toBe(96); // 104 - 8
      expect(model.cells[4].up?.y).toBe(61); // 104 - 43
      expect(model.cells[2].up?.y).toBe(model.plotTop);
    });

    it('gives every drawn bar the full hit width and a body one pixel narrower', () => {
      const model = handModel();

      for (const cell of model.cells) {
        // The pointer target is the whole pitch, so a 2px bar is still clickable.
        expect(cell.hitWidth).toBe(16);
        if (cell.up !== null) {
          expect(cell.up.x).toBe(cell.x);
          expect(cell.up.width).toBe(15);
        }
      }
    });
  });

  describe('barHeight — linear, with a floor that keeps a real month visible', () => {
    it('is zero for no value and for no domain, rather than dividing by nothing', () => {
      expect(chart.barHeight(0, 10, 80)).toBe(0);
      expect(chart.barHeight(5, 0, 80)).toBe(0);
      expect(chart.barHeight(0, 0, 80)).toBe(0);
    });

    it('is at least 2 for any positive value, however small against the maximum', () => {
      // 0.01 over 1,000,000 is 0.0000008 of the plot: invisible, and that is a
      // month the reader is entitled to see.
      expect(chart.barHeight(0.01, 1_000_000, 80)).toBe(2);
      expect(chart.barHeight(0.01, 1_000_000, 96)).toBe(2);
    });
  });

  describe('currency — one shared scale, with the plot split by each side’s extent', () => {
    // D-15 and D-17, restated as arithmetic. ONE scale serves both sides: the
    // pixels per unit is 160 ÷ (up extent + down extent) above the zero line and
    // the same below it, which is what makes a deposit bar and a withdrawal bar
    // of equal amount equal height. What is NOT fixed is where the zero line
    // sits: the 160px plot is divided in proportion to the two extents, so an
    // almost-all-deposit currency spends the plot instead of wasting half of
    // it. The floor is a quarter of the other side’s own maximum, which is 32px
    // — so the 14px zero label and the bottom label cannot collide.

    it('is 160px tall with an 80px minimum either side, from an exported divisor of 4', () => {
      expect(chart.BAR_LAYOUT.currencyPlotPx).toBe(160);
      expect(chart.CURRENCY_MIN_SIDE_DIVISOR).toBe(4);
      // 160 ÷ 4 is the floor, and 160 ÷ 5 rooms is 32px: the smallest side a
      // currency can ever be given.
      expect(chart.BAR_LAYOUT.currencyPlotPx / chart.CURRENCY_MIN_SIDE_DIVISOR).toBe(40);
    });

    it('splits by extent, not evenly: up 10 with down 4 gives 114 and 46', () => {
      // A quarter of 10 is 2.5, below the withdrawal's own 4, so both extents
      // are their own maxima and the span is 14.
      const model = chart.buildBarChartModel({
        kind: 'currency',
        firstMonth: 1_000,
        lastMonth: 1_001,
        months: [
          { month: 1_000, up: 10, down: 0 },
          { month: 1_001, up: 0, down: 4 },
        ],
      });

      expect(model.height).toBe(192); // 8 top + 160 plot + 24 axis band
      expect(model.plotHeight).toBe(160);
      expect(model.domainUp).toBe(10);
      expect(model.domainDown).toBe(4);
      expect(model.domainMax).toBe(10);
      // 160 x 10 / 14 is 114.29, so the up room is 114 and the down room is
      // the remaining 46 — rounded together, so they always sum to the plot.
      expect(model.zeroY).toBe(122); // 8 + 114
      expect(model.cells[0].up?.height).toBe(114);
      expect(model.cells[0].up?.y).toBe(8); // 122 - 114, the plot top
      expect(model.cells[1].down?.height).toBe(46); // 4 / 14 x 160 is 45.71
      expect(model.cells[1].down?.y).toBe(122); // grows down from the line
      expect(model.cells[1].up).toBeNull();
    });

    it('lifts the zero line when the withdrawal side is the larger one', () => {
      // The withdrawal-led case is the other half of the rule: up 7 with a
      // withdrawal of 50 puts 12.5 above the line (a quarter of 50) and 50
      // below it, so the line sits near the TOP — 32px down — and the scale is
      // 160 / 62.5 = 2.56px per unit.
      const model = chart.buildBarChartModel({
        kind: 'currency',
        firstMonth: 1_000,
        lastMonth: 1_001,
        months: [
          { month: 1_000, up: 3, down: 50 },
          { month: 1_001, up: 7, down: 1 },
        ],
      });

      expect(model.domainUp).toBe(12.5); // max(7, 50 / 4)
      expect(model.domainDown).toBe(50); // max(50, 7 / 4)
      expect(model.domainMax).toBe(50); // still the larger of the two maxima
      expect(model.zeroY).toBe(40); // 8 + 32
      expect(model.cells[0].up?.height).toBe(8); // 3 x 2.56 is 7.68
      expect(model.cells[0].up?.y).toBe(32); // 40 - 8
      expect(model.cells[0].down?.height).toBe(128); // 50 x 2.56, the whole room
      expect(model.cells[0].down?.y).toBe(40);
      expect(model.cells[1].up?.height).toBe(18); // 7 x 2.56 is 17.92
      expect(model.cells[1].up?.y).toBe(22);
      expect(model.cells[1].down?.height).toBe(3); // 1 x 2.56 is 2.56
      expect(model.cells[1].down?.y).toBe(40);
    });

    it('gives a deposits-only currency a quarter of the plot below its line', () => {
      // The waste this rule exists to remove: with a flat zero withdrawal the
      // down extent is a quarter of the deposit maximum rather than zero, so
      // the line drops to 128 below the plot top and the bottom label has room.
      const model = chart.buildBarChartModel({
        kind: 'currency',
        firstMonth: 1_000,
        lastMonth: 1_000,
        months: [{ month: 1_000, up: 1_000, down: 0 }],
      });

      expect(model.domainUp).toBe(1_000);
      expect(model.domainDown).toBe(250); // a quarter of 1,000
      expect(model.zeroY).toBe(136); // 8 + 128
      expect(model.cells[0].up?.height).toBe(128); // 160 x 1,000 / 1,250
      expect(model.cells[0].up?.y).toBe(8);
      expect(model.cells[0].down).toBeNull(); // nothing was withdrawn
    });

    it('mirrors it for a withdrawals-only currency', () => {
      const model = chart.buildBarChartModel({
        kind: 'currency',
        firstMonth: 1_000,
        lastMonth: 1_000,
        months: [{ month: 1_000, up: 0, down: 1_000 }],
      });

      expect(model.domainUp).toBe(250);
      expect(model.domainDown).toBe(1_000);
      expect(model.zeroY).toBe(40); // 8 + 32
      expect(model.cells[0].down?.height).toBe(128);
      expect(model.cells[0].down?.y).toBe(40);
      expect(model.cells[0].up).toBeNull();
    });

    it('is the previous even split when the two sides are equal', () => {
      // Continuity, and the reason this is an amendment rather than a redesign:
      // a currency with matching maxima still gets 80 above and 80 below.
      const model = chart.buildBarChartModel({
        kind: 'currency',
        firstMonth: 1_000,
        lastMonth: 1_001,
        months: [
          { month: 1_000, up: 400, down: 0 },
          { month: 1_001, up: 0, down: 400 },
        ],
      });

      expect(model.domainUp).toBe(400);
      expect(model.domainDown).toBe(400);
      expect(model.zeroY).toBe(88); // 8 + 80
      expect(model.cells[0].up?.height).toBe(80);
      expect(model.cells[0].up?.y).toBe(8);
      expect(model.cells[1].down?.height).toBe(80);
      expect(model.cells[1].down?.y).toBe(88);
    });

    it('clamps a bar that rounds a half pixel over its own side’s room', () => {
      // 231 and 89 give a span of 320, so 231 x 0.5 = 115.5px and 89 x 0.5 =
      // 44.5px. The rooms round to 116 and 44 — which is why they are rounded
      // TOGETHER and sum to 160 — but the withdrawal bar on its own rounds to
      // 45. Unclamped it would cross the bottom hairline by one pixel.
      const model = chart.buildBarChartModel({
        kind: 'currency',
        firstMonth: 1_000,
        lastMonth: 1_001,
        months: [
          { month: 1_000, up: 231, down: 0 },
          { month: 1_001, up: 0, down: 89 },
        ],
      });

      expect(model.domainUp).toBe(231); // a quarter of 89 is 22.25
      expect(model.domainDown).toBe(89); // a quarter of 231 is 57.75
      expect(model.zeroY).toBe(124); // 8 + 116
      expect(model.cells[0].up?.height).toBe(116);
      expect(model.cells[1].down?.height).toBe(44); // 45 clamped to its room
      expect(model.cells[1].down?.y).toBe(124);
      // The clamp is exactly "the bar ends at the plot bound and no further".
      expect(model.cells[1].down!.y + model.cells[1].down!.height).toBe(
        model.plotTop + model.plotHeight,
      );
    });

    it('draws equal amounts at equal height on the two sides — one scale', () => {
      // The honesty argument for the whole rule, in one assertion: the same
      // scale above and below the line, so 400 in and 400 out are the same
      // 400/1,400 x 160 = 45.71 → 46px whichever side they are on.
      const model = chart.buildBarChartModel({
        kind: 'currency',
        firstMonth: 1_000,
        lastMonth: 1_002,
        months: [
          { month: 1_000, up: 400, down: 0 },
          { month: 1_001, up: 0, down: 400 },
          { month: 1_002, up: 1_000, down: 0 },
        ],
      });

      expect(model.domainUp).toBe(1_000);
      expect(model.domainDown).toBe(400);
      expect(model.cells[0].up?.height).toBe(46);
      expect(model.cells[1].down?.height).toBe(46);
      expect(model.cells[0].up?.height).toBe(model.cells[1].down?.height);
      expect(model.cells[2].up?.height).toBe(114); // 1,000 / 1,400 x 160
    });

    it('splits evenly and draws nothing when there is no data or no value', () => {
      for (const months of [[], [{ month: 1_000, up: 0, down: 0 }]] as const) {
        const model = chart.buildBarChartModel({
          kind: 'currency',
          firstMonth: 1_000,
          lastMonth: 1_000,
          months,
        });

        expect(model.domainUp).toBe(0);
        expect(model.domainDown).toBe(0);
        expect(model.plotHeight).toBe(160);
        expect(model.zeroY).toBe(88); // the even split, unchanged
        expect(model.cells[0].up).toBeNull();
        expect(model.cells[0].down).toBeNull();
      }
    });

    it('reads a non-finite or negative amount as zero, and stays finite (T-05-60)', () => {
      // Amounts arrive from an untrusted CSV, so an Infinity, a NaN or a
      // negative must never reach a coordinate: the guard is applied to the
      // VALUES before any extent is computed, not to the finished rectangles.
      const model = chart.buildBarChartModel({
        kind: 'currency',
        firstMonth: 1_000,
        lastMonth: 1_002,
        months: [
          { month: 1_000, up: Number.POSITIVE_INFINITY, down: Number.NaN },
          { month: 1_001, up: -500, down: -1 },
          { month: 1_002, up: 0, down: 0 },
        ],
      });

      expect(model.plotHeight).toBe(160);
      // Every value read as zero, so the span is zero and the split is even.
      expect(model.domainMax).toBe(0);
      expect(model.zeroY).toBe(88);
      for (const cell of model.cells) {
        expect(cell.up).toBeNull();
        expect(cell.down).toBeNull();
      }
      for (const value of [
        model.zeroY,
        model.height,
        model.width,
        model.domainUp,
        model.domainDown,
      ]) {
        expect(Number.isFinite(value)).toBe(true);
      }
    });

    it('keeps a hostile value beside a real one without letting it scale the chart', () => {
      // Zeroing the bad value is not the same as dropping the month: the real
      // 10 still charts, and Infinity still contributes nothing to the domain.
      const model = chart.buildBarChartModel({
        kind: 'currency',
        firstMonth: 1_000,
        lastMonth: 1_001,
        months: [
          { month: 1_000, up: 10, down: 0 },
          { month: 1_001, up: Number.POSITIVE_INFINITY, down: 0 },
        ],
      });

      expect(model.domainMax).toBe(10);
      expect(model.zeroY).toBe(136); // a deposits-only chart, as above
      expect(model.cells[0].up?.height).toBe(128);
      expect(model.cells[1].up).toBeNull();
    });

    it('never gives either side less than 32px or more than 128px, for any shape', () => {
      // The sweep behind the floor: a side is at least a quarter of the other
      // side's maximum, so no matter how lopsided the data is the zero line
      // lands in [8 + 32, 8 + 128] and the two 14px labels cannot touch. Both
      // bounds come from the same divisor, so they hold by construction rather
      // than by luck.
      const shapes: readonly (readonly [number, number])[] = [
        [1, 1],
        [1, 1_000],
        [1_000, 1],
        [3, 89],
        [89, 3],
        [7, 1_000_000],
        [1_000_000, 7],
        [0.5, 0.5],
        [1, 4],
        [1_000_000, 1_000_000],
      ];

      for (const [up, down] of shapes) {
        const model = chart.buildBarChartModel({
          kind: 'currency',
          firstMonth: 1_000,
          lastMonth: 1_000,
          months: [{ month: 1_000, up, down }],
        });

        const upRoom = model.zeroY - model.plotTop;
        const downRoom = model.plotTop + model.plotHeight - model.zeroY;

        expect(model.plotHeight, `up ${up} down ${down}`).toBe(160);
        expect(upRoom, `up ${up} down ${down}`).toBeGreaterThanOrEqual(32);
        expect(upRoom, `up ${up} down ${down}`).toBeLessThanOrEqual(128);
        expect(downRoom, `up ${up} down ${down}`).toBeGreaterThanOrEqual(32);
        expect(downRoom, `up ${up} down ${down}`).toBeLessThanOrEqual(128);
        // No bar crosses a plot bound in either direction.
        for (const cell of model.cells) {
          if (cell.up !== null)
            expect(cell.up.y, `up ${up} down ${down}`).toBeGreaterThanOrEqual(model.plotTop);
          if (cell.down !== null) {
            expect(cell.down.y + cell.down.height, `up ${up} down ${down}`).toBeLessThanOrEqual(
              model.plotTop + model.plotHeight,
            );
          }
        }
      }
    });
  });

  describe('axis labels — the first month, then every twelfth', () => {
    it('labels a single month once, and the zero-one case stays one cell', () => {
      const model = chart.buildBarChartModel({
        kind: 'premium',
        firstMonth: 500,
        lastMonth: 500,
        months: [{ month: 500, up: 1, down: 0 }],
      });

      expect(model.pitch).toBe(16);
      expect(model.cells).toHaveLength(1);
      expect(model.labels.map((label) => label.index)).toEqual([0]);
      expect(model.labels[0].x).toBe(56);
    });

    it('labels indexes 0 and 12 over 24 months at pitch 16', () => {
      const model = chart.buildBarChartModel({
        kind: 'premium',
        firstMonth: 1_000,
        lastMonth: 1_023,
        months: [],
      });

      expect(model.pitch).toBe(16);
      expect(model.labels.map((label) => label.index)).toEqual([0, 12]);
      expect(model.labels[1].x).toBe(56 + 12 * 16);
    });

    it('keeps the first label even when the chart is too narrow to hold it', () => {
      // 13 x 16 is 208, so the chart is 268 wide. The label at index 12 would
      // need x 248 + 56 and is dropped, but index 0 is the axis's origin: drop
      // it too and a one-month chart would carry no label at all.
      const model = chart.buildBarChartModel({
        kind: 'premium',
        firstMonth: 1_000,
        lastMonth: 1_012,
        months: [],
      });

      expect(model.pitch).toBe(16);
      expect(model.width).toBe(268);
      expect(model.labels.map((label) => label.index)).toEqual([0]);
    });

    it('labels every 24th month at pitch 4, over the 240-month span', () => {
      const model = chart.buildBarChartModel({
        kind: 'premium',
        firstMonth: 1_000,
        lastMonth: 1_239,
        months: [],
      });

      expect(model.pitch).toBe(4);
      expect(model.labels.map((label) => label.index)).toEqual([
        0, 24, 48, 72, 96, 120, 144, 168, 192, 216,
      ]);
    });
  });

  describe('the label stride follows the pitch, 24 months below pitch 8', () => {
    // A label every 12 months is 12 x pitch pixels wide, and the UI-SPEC's
    // floor is 96px. At pitch 8 that is exactly 96 — not under it — so the
    // stride is still 12; below 8 it doubles to 24, and 24 x 4 is exactly 96,
    // so the floor holds at every pitch the model can produce.

    it('labels every 12th month at pitch 10, over 56 months', () => {
      // 12 x 10 = 120, above the gap. The label at index 48 sits at x 536 and
      // 536 + 56 = 592 is inside the 620px width; index 60 is past the last
      // month, so the chart is labelled 2015-01 to 2018-12 and no further.
      const model = chart.buildBarChartModel(currency(56));

      expect(model.pitch).toBe(10);
      expect(model.width).toBe(620);
      expect(model.labels.map((label) => label.index)).toEqual([0, 12, 24, 36, 48]);
    });

    it('keeps the stride at 12 at pitch 8, where 12 x 8 is exactly the 96px gap', () => {
      const model = chart.buildBarChartModel(currency(72));

      expect(model.pitch).toBe(8);
      expect(model.width).toBe(636);
      // Six labels, each exactly 96px from the one before it, the last at
      // x 536 with 536 + 56 = 592 inside the width.
      expect(model.labels.map((label) => label.index)).toEqual([0, 12, 24, 36, 48, 60]);
    });

    it('doubles the stride to 24 at pitch 7, over 73 months', () => {
      // 12 x 7 = 84, under the gap, so labels step 24 months: index 0, 24 and
      // 48 only. The next one, index 72, sits at x 560 and 560 + 56 = 616 is
      // past the 571px width, so it is dropped rather than cut in half. On the
      // old ladder this chart drew at pitch 4 and was 352px wide instead.
      const model = chart.buildBarChartModel(currency(73));

      expect(model.pitch).toBe(7);
      expect(model.width).toBe(571);
      expect(model.labels.map((label) => label.index)).toEqual([0, 24, 48]);
    });

    it('doubles the stride to 24 at pitch 5, over 100 months', () => {
      // 12 x 5 = 60, far under the gap. Index 96 would sit at x 536 and
      // 536 + 56 = 592 is past the 560px width, so four labels are drawn.
      const model = chart.buildBarChartModel(currency(100));

      expect(model.pitch).toBe(5);
      expect(model.width).toBe(560);
      expect(model.labels.map((label) => label.index)).toEqual([0, 24, 48, 72]);
    });

    it('keeps the first label, a 96px gap and the right edge at every month count', () => {
      // The property, over the whole range that does not scroll: from 1 to 144
      // months the first label is the axis's origin, no two labels are closer
      // than the UI-SPEC's 96px, and no label after the first runs past the
      // SVG's right edge. Three separate claims, because each fails on its own
      // — a rule that only ever tested the pitch could not see a bad stride.
      for (let monthCount = 1; monthCount <= 144; monthCount += 1) {
        const model = chart.buildBarChartModel(currency(monthCount));
        const where = `${monthCount} months`;

        expect(model.labels[0]?.index, where).toBe(0);
        for (const [index, label] of model.labels.entries()) {
          if (index > 0) {
            const previous = model.labels[index - 1]!;
            expect(label.x - previous.x, where).toBeGreaterThanOrEqual(
              chart.BAR_LAYOUT.labelMinGapPx,
            );
          }
          if (label.index > 0) {
            expect(label.x + chart.BAR_LAYOUT.labelWidthPx, where).toBeLessThanOrEqual(model.width);
          }
        }
      }
    });
  });

  describe('the node budget — T-05-26, a chart that cannot make the DOM enormous', () => {
    it.each([1, 56, 144, 240])(
      'stays inside 3 x %i + 40 nodes with flow in both directions in every month',
      (monthCount) => {
        const model = chart.buildBarChartModel(currency(monthCount));

        expect(model.nodeBudget).toBe(3 * monthCount + 40);
        expect(model.nodeCount).toBeLessThanOrEqual(model.nodeBudget);
      },
    );
  });

  describe('the keyboard reducer', () => {
    it('clamps at the first and the last month rather than wrapping', () => {
      const count = 5;

      expect(chart.barChartNavigate(0, 'ArrowLeft', count)).toBe(0);
      expect(chart.barChartNavigate(2, 'ArrowLeft', count)).toBe(1);
      expect(chart.barChartNavigate(4, 'ArrowRight', count)).toBe(4);
      expect(chart.barChartNavigate(2, 'ArrowRight', count)).toBe(3);
    });

    it('jumps to the ends with Home and End, from anywhere', () => {
      const count = 5;

      expect(chart.barChartNavigate(3, 'Home', count)).toBe(0);
      expect(chart.barChartNavigate(3, 'End', count)).toBe(4);
    });

    it('enters on the last month, because that is the most recent one', () => {
      expect(chart.initialBarFocus(handModel())).toBe(4);
    });

    it('has nothing to focus when the chart drew no cells at all', () => {
      const empty: chart.BarChartModel = { ...handModel(), cells: [] };

      expect(chart.initialBarFocus(empty)).toBeNull();
    });
  });

  describe('the module boundary', () => {
    it('imports no Svelte, no copy inventory, and never builds a Date', async () => {
      const { readFileSync } = await import('node:fs');
      const source = readFileSync(
        new URL('../../../src/lib/charts/bar-chart-model.ts', import.meta.url),
        'utf8',
      );
      // Comments are stripped first: the WHY-header names these constraints in
      // prose, and the constraint is about the code.
      const code = source
        .split('\n')
        .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
        .join('\n');

      // A component framework (runes are unavailable to a node-environment
      // test), the copy module (this model holds numbers, never words) and the
      // Date constructor (a reader in another timezone must get the same
      // geometry).
      expect(code).not.toMatch(/from 'svelte/);
      expect(code).not.toMatch(/ui-copy/);
      expect(code).not.toMatch(/\$state|\$derived|\$effect/);
      expect(code).not.toMatch(/\bnew Date\b|toLocale/);
    });
  });
});

function currency(monthCount: number): chart.BarChartInput {
  return {
    kind: 'currency',
    firstMonth: 1_000,
    lastMonth: 1_000 + monthCount - 1,
    months: bothWays(monthCount),
  };
}
