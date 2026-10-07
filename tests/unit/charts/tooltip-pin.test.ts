// =============================================================================
// 07-03: touch pin decisions and announcements
// =============================================================================
//
// WHY THE DECISIONS ARE PURE FUNCTIONS
//
// `vitest.config.ts` has no Svelte plugin and `environment: 'node'`, so no
// component in this repository can be rendered in a unit test at all (04-08
// recorded the same constraint for the Playtime block). The two decisions the
// touch tooltip makes — what a tap does, and what a state change announces —
// therefore cannot be reached any other way than as functions over plain
// values, and they are the only two decisions in this feature. Everything else
// is wiring, and wiring is asserted as a source contract below and in a
// browser by `tests/e2e/shell/touch-tooltips.spec.ts`.
//
// WHY THE COPY LIVES HERE AND NOT IN `ui-copy.ts`
//
// `src/lib/ui-copy.ts` is FROZEN for Phase 7 (D-06). The two announcement
// strings are the only words this feature adds, and they are module constants
// beside the functions that emit them, so a reader can see the whole voice of
// the touch tooltip in one file.
//
// WHAT IS PROVEN HERE
//
// Both functions, every row of the UI-SPEC's touch table and every row of the
// state-change list, each as its own named case; the two strings exactly; and
// the wiring contracts that a pure test cannot see — that the tooltip reads
// the shared context key, registers its document listeners in the CAPTURE
// phase, keeps `aria-hidden` and `pointer-events: none`, and schedules no
// timer; and that the page-level live region is rendered only with a dataset.
// =============================================================================

import { describe, expect, test } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { componentPath } from '../../helpers/components.ts';
import {
  CHART_ANNOUNCE_KEY,
  TOOLTIP_DISMISSED_ANNOUNCEMENT,
  TOOLTIP_PINNED_ANNOUNCEMENT,
  pinOutcome,
  touchTapAction,
  type PinOutcomeInput,
  type TapInput,
} from '../../../src/lib/charts/tooltip-pin.ts';

const TOOLTIP = 'ChartTooltip.svelte';
const DASHBOARD = 'Dashboard.svelte';

/** A component's source, or `''` when it does not exist. */
function source(file: string): string {
  const full = componentPath(file);
  return existsSync(full) ? readFileSync(full, 'utf8') : '';
}

/** One row of a decision table, as its own named case. */
function row<T>(name: string, input: T, expected: unknown, decide: (value: T) => unknown): void {
  test(name, () => {
    expect(decide(input)).toEqual(expected);
  });
}

describe('07-03: touchTapAction — what a tap does to an open tooltip', () => {
  const tap = (input: Partial<TapInput> = {}): TapInput => ({
    open: true,
    pinned: false,
    insideOwnSurface: true,
    onAnchor: true,
    ...input,
  });

  row(
    'a closed tooltip ignores every tap',
    tap({ open: false, pinned: false, insideOwnSurface: false, onAnchor: false }),
    'ignore',
    touchTapAction,
  );

  row(
    'a closed tooltip ignores a tap on its own anchor too',
    tap({ open: false, pinned: true, insideOwnSurface: true, onAnchor: true }),
    'ignore',
    touchTapAction,
  );

  row(
    'an open tooltip is dismissed by a tap outside its own surface, pinned or not',
    tap({ pinned: false, insideOwnSurface: false, onAnchor: false }),
    'dismiss',
    touchTapAction,
  );

  row(
    'an open PINNED tooltip is still dismissed by a tap outside its own surface',
    tap({ pinned: true, insideOwnSurface: false, onAnchor: false }),
    'dismiss',
    touchTapAction,
  );

  row(
    'a tap on the anchor of a pinned tooltip toggles it off',
    tap({ pinned: true, insideOwnSurface: true, onAnchor: true }),
    'toggle-off',
    touchTapAction,
  );

  row(
    'a tap on the anchor of an UNpinned tooltip is ignored, because it is the tap that opens it',
    tap({ pinned: false, insideOwnSurface: true, onAnchor: true }),
    'ignore',
    touchTapAction,
  );

  row(
    'a tap on another cell of the same chart is ignored, because that chart moves the tooltip itself',
    tap({ pinned: true, insideOwnSurface: true, onAnchor: false }),
    'ignore',
    touchTapAction,
  );

  row(
    'a tap on the chart padding of an unpinned tooltip is ignored for the same reason',
    tap({ pinned: false, insideOwnSurface: true, onAnchor: false }),
    'ignore',
    touchTapAction,
  );
});

describe('07-03: pinOutcome — what a state change pins and announces', () => {
  const change = (input: Partial<PinOutcomeInput> = {}): PinOutcomeInput => ({
    wasPinned: false,
    open: true,
    touchOrigin: true,
    silent: false,
    ...input,
  });

  row(
    'the first touch open pins and announces the pinned string',
    change(),
    { pinned: true, announce: TOOLTIP_PINNED_ANNOUNCEMENT },
    pinOutcome,
  );

  row(
    'a move — a second touch open while already pinned — pins again and announces nothing',
    change({ wasPinned: true }),
    { pinned: true, announce: null },
    pinOutcome,
  );

  row(
    'a MOUSE open pins nothing and announces nothing',
    change({ touchOrigin: false }),
    { pinned: false, announce: null },
    pinOutcome,
  );

  row(
    'a KEYBOARD open pins nothing and announces nothing either',
    change({ touchOrigin: false, wasPinned: false }),
    { pinned: false, announce: null },
    pinOutcome,
  );

  row(
    'a silent close from a scroll or resize clears the region with the empty string',
    change({ wasPinned: true, open: false, silent: true }),
    { pinned: false, announce: '' },
    pinOutcome,
  );

  row(
    'a loud close from a tap-again, a tap-outside or Escape announces the dismissed string',
    change({ wasPinned: true, open: false, silent: false }),
    { pinned: false, announce: TOOLTIP_DISMISSED_ANNOUNCEMENT },
    pinOutcome,
  );

  row(
    'a close of something that was never pinned announces nothing',
    change({ wasPinned: false, open: false, silent: false }),
    { pinned: false, announce: null },
    pinOutcome,
  );
});

describe('07-03: the two announcement strings are exactly these two', () => {
  test('the pinned announcement', () => {
    expect(TOOLTIP_PINNED_ANNOUNCEMENT).toBe('Tooltip pinned.');
  });

  test('the dismissed announcement', () => {
    expect(TOOLTIP_DISMISSED_ANNOUNCEMENT).toBe('Tooltip dismissed.');
  });

  test('the two are different, so a reader can tell a move from a dismissal', () => {
    expect(TOOLTIP_PINNED_ANNOUNCEMENT).not.toBe(TOOLTIP_DISMISSED_ANNOUNCEMENT);
  });

  test('the context key is a symbol, so nothing can collide with a string key', () => {
    expect(typeof CHART_ANNOUNCE_KEY).toBe('symbol');
  });
});

describe('07-03: the tooltip is wired to the pure module, and stays what it was', () => {
  test('ChartTooltip.svelte exists', () => {
    expect(existsSync(componentPath(TOOLTIP)), `${TOOLTIP} does not exist yet`).toBe(true);
  });

  test('it imports the decisions and the context key from the shared module', () => {
    const body = source(TOOLTIP);
    expect(body).toMatch(/from\s+'[^']*tooltip-pin\.ts'/);
    expect(body).toContain('touchTapAction');
    expect(body).toContain('pinOutcome');
    expect(body).toContain('CHART_ANNOUNCE_KEY');
    expect(body).toContain('getContext');
  });

  test('it registers its document listeners in the CAPTURE phase, so a stop can reach the chart', () => {
    // Capture is what makes `toggle-off` possible: in the bubble phase the
    // chart's own delegated handler has already run, and the tooltip this tap
    // just closed would be reopened underneath it.
    const body = source(TOOLTIP);
    expect(body).toContain('<svelte:document');
    expect(body).toMatch(/onpointerdowncapture=/);
    expect(body).toContain('stopPropagation');
  });

  test('it is still aria-hidden and still pointer-transparent, and schedules nothing', () => {
    const body = source(TOOLTIP);
    expect(body).toContain('aria-hidden="true"');
    expect(body).toContain('pointer-events: none');
    // D-05: no timers and no auto-dismiss anywhere in the touch path. A
    // scheduled callback is the only way a tooltip could close on its own.
    expect(body).not.toMatch(/setTimeout|setInterval|requestAnimationFrame/);
  });

  test('it still holds the contracts Phase 4 wrote into its raw source', () => {
    // These source-contract assertions already exist in
    // tests/unit/playtime/playtime-charts.test.ts and run against the RAW
    // file, comments included. They are restated nowhere; this test exists to
    // say that adding document listeners must not quietly remove one of them,
    // and to name them where the touch work happened.
    const body = source(TOOLTIP);
    for (const token of [
      '<svelte:window',
      'onresize',
      "testId = 'chart-tooltip'",
      'data-testid={testId}',
      'hidden={request === null}',
      'clampTooltip(',
      '--nav-offset',
      '.style.left =',
      '.style.top =',
    ]) {
      expect(body, token).toContain(token);
    }
    expect(body).toMatch(/onscroll[^}\n]*capture/);
  });
});

describe('07-03: the one page-level live region', () => {
  test('Dashboard.svelte exists', () => {
    expect(existsSync(componentPath(DASHBOARD)), `${DASHBOARD} does not exist yet`).toBe(true);
  });

  test('it publishes the announcement function under the shared key', () => {
    const body = source(DASHBOARD);
    expect(body).toMatch(/setContext\(\s*CHART_ANNOUNCE_KEY/);
    expect(body).toMatch(/from\s+'[^']*tooltip-pin\.ts'/);
  });

  test('the region is polite, atomic, testable, and there is exactly one', () => {
    const body = source(DASHBOARD);
    expect(body).toContain('data-testid="chart-status"');
    expect(body).toContain('role="status"');
    expect(body).toContain('aria-live="polite"');
    expect(body).toContain('aria-atomic="true"');
    expect((body.match(/data-testid="chart-status"/g) ?? []).length).toBe(1);
  });

  test('it is rendered only while a dataset is on screen', () => {
    // Absent on a first visit is what keeps the empty page's live-region
    // count at one, and a region created together with its first message is
    // not announced.
    const body = source(DASHBOARD);
    expect(body).toMatch(/\{#if result[^}]*\}[\s\S]*data-testid="chart-status"/);
  });

  test('it is hidden with the clip pattern, never display:none, and declares no font size', () => {
    // display:none removes the region from the accessibility tree, which is
    // the opposite of what a live region has to be; a font-size declaration
    // under 14px is what tests/unit/guards/phase5-layout-guards.test.ts
    // scans every stylesheet for.
    const body = source(DASHBOARD);
    expect(body).toMatch(/\.chart-status\s*\{[^}]*position:\s*absolute/);
    expect(body).toMatch(/\.chart-status\s*\{[^}]*clip:/);
    expect(body).not.toMatch(/\.chart-status\s*\{[^}]*display:\s*none/);
    expect(body).not.toMatch(/\.chart-status\s*\{[^}]*font-size/);
  });
});
