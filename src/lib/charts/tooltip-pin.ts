/**
 * The touch tooltip's two decisions, as pure functions (07-03, D-05).
 *
 * ## Why this module exists at all
 *
 * `vitest.config.ts` has no Svelte plugin and `environment: 'node'`, so no
 * component in this repository can be rendered in a unit test — 04-08 recorded
 * the same constraint for the Playtime block, and the Phase 4 chart wiring
 * suite exists because of it. The touch tooltip makes exactly two decisions:
 * what a tap does to an open tooltip, and what a state change pins and says.
 * Both are therefore functions over plain values, and everything else in the
 * feature is wiring around them.
 *
 * Nothing here touches the DOM, Svelte, or a rune. The DOM questions the
 * decisions need answered — is the tooltip open, is it pinned, is the tap
 * inside this chart's own surface, is the tap on the anchor — are the CALLER's
 * to answer, and answering them here would have made this file untestable in
 * exactly the way the components already are.
 *
 * ## Why the copy is here and not in `ui-copy.ts`
 *
 * `src/lib/ui-copy.ts` is FROZEN for Phase 7 (D-06): every visible and spoken
 * string in the product is decided there, and this phase may not add to it.
 * The two announcements are module constants beside the only function that
 * emits them, so the whole spoken surface of the touch tooltip is one file.
 *
 * ## Why the strings carry no data
 *
 * The tooltip is `aria-hidden` — every cell already carries the same two lines
 * as its accessible name — so this is the only thing a screen reader hears
 * about a pin. Only these two constants and the empty string ever reach the
 * live region: no cell label, no address, no figure. A cell's own accessible
 * name is therefore the only place chart data can be spoken, and it is already
 * there (T-07-13).
 */

/** Spoken when a touch tap pins the tooltip for the first time. */
export const TOOLTIP_PINNED_ANNOUNCEMENT = 'Tooltip pinned.';

/**
 * Spoken when a pin is dismissed loudly — a second tap on the anchor, a tap
 * outside the chart, or Escape.
 *
 * A scroll or a resize is deliberately NOT this string: see `pinOutcome`.
 */
export const TOOLTIP_DISMISSED_ANNOUNCEMENT = 'Tooltip dismissed.';

/**
 * The context key under which the page publishes its announcement sink.
 *
 * A `Symbol` and not a string, so no component can reach the page's live
 * region by guessing a name, and so two independently-mounted subtrees cannot
 * collide on one.
 */
export const CHART_ANNOUNCE_KEY = Symbol('chart-announce');

/** What the page hands down: given text, put it in the one live region. */
export type ChartAnnounce = (text: string) => void;

/** What a touch tap does to the tooltip. */
export type TapAction = 'ignore' | 'dismiss' | 'toggle-off';

export interface TapInput {
  /** Whether a tooltip is showing at all. */
  open: boolean;
  /** Whether it is pinned rather than held open by a hover or a focus. */
  pinned: boolean;
  /**
   * Whether the tap landed inside the surface the tooltip is anchored to — the
   * nearest ancestor of the anchor carrying `data-tooltip-surface`. This is the
   * difference between "this chart is being touched" and "somewhere else on
   * the page was touched".
   */
  insideOwnSurface: boolean;
  /** Whether the tap landed on the anchor element itself. */
  onAnchor: boolean;
}

/**
 * What one touch tap should do, and nothing else.
 *
 * The rows that return `'ignore'` are not all the same silence, and that is
 * the point. A tap on another cell is the CHART's business — the chart's own
 * press handler moves the tooltip, and this function must not also move it or
 * the two would race. A tap on the anchor of an UNpinned tooltip is the tap
 * that is opening it right now, so dismissing here would close a tooltip that
 * was not open when the tap began. And a closed tooltip ignores everything,
 * because there is nothing to dismiss and the pin bookkeeping must not start
 * from a tap that dismissed nothing.
 */
export function touchTapAction(input: TapInput): TapAction {
  if (!input.open) return 'ignore';
  if (!input.insideOwnSurface) return 'dismiss';
  if (input.pinned && input.onAnchor) return 'toggle-off';
  return 'ignore';
}

export interface PinOutcomeInput {
  /** Whether the tooltip was already pinned before this state change. */
  wasPinned: boolean;
  /** Whether a tooltip is showing after the state change. */
  open: boolean;
  /** Whether the pointer input behind this state change was a touch tap. */
  touchOrigin: boolean;
  /** Whether this close is a scroll or a resize, which is a silent dismissal. */
  silent: boolean;
}

export interface PinOutcome {
  /** Whether the tooltip is pinned after this state change. */
  pinned: boolean;
  /**
   * The text to announce, or null for nothing, or the EMPTY STRING for a
   * silent close.
   *
   * The empty string is a third case and it is load-bearing: a live region
   * that still says "Tooltip pinned." after the tooltip is gone will not
   * announce the SAME text again, so a silent dismissal has to clear the
   * region or the next pin would be silent. Announcing `null` and announcing
   * `''` are different instructions to a screen reader and only one of them
   * makes the next pin audible.
   */
  announce: string | null;
}

/**
 * What a state change does to the pin and to the announcement.
 *
 * The `touchOrigin` gate is what keeps the mouse and the keyboard exactly as
 * they were (D-05): a hover or an arrow-key move is never a pin and never says
 * anything, so the entire touch feature is inert for the two input types that
 * already worked. A move — a touch open while already pinned — is silent,
 * because "Tooltip pinned." said twice for one continuous reading of the
 * tooltip is noise, and it is emphatically not a dismissal.
 */
export function pinOutcome(input: PinOutcomeInput): PinOutcome {
  if (input.open) {
    if (!input.touchOrigin) return { pinned: false, announce: null };
    if (input.wasPinned) return { pinned: true, announce: null };
    return { pinned: true, announce: TOOLTIP_PINNED_ANNOUNCEMENT };
  }
  if (!input.wasPinned) return { pinned: false, announce: null };
  return {
    pinned: false,
    announce: input.silent ? '' : TOOLTIP_DISMISSED_ANNOUNCEMENT,
  };
}
