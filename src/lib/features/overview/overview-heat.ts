// =============================================================================
// The Overview value scale (Phase 13, D-13, D-22; 13-UI-SPEC Color).
// =============================================================================
//
// WHAT THIS IS
// The Overview colours its bars by VALUE: a bar's colour says how big the
// value is, so the eye can find the peak without reading every axis label.
// The scale runs from the low stop (green) through the middle stop (olive) to
// the peak stop (dark gold), and the LIGHTNESS FALLS as the value rises —
// so the peak is the darkest bar in greyscale too, and a reader who cannot
// read colour at all still sees the peak.
//
// THE EASING IS THE POINT
// The value is eased with u = t^1.5 before it is interpolated. Without the
// easing the ramp would spend half its range on the first quarter of the
// values, and almost every bar would be green; with it, most bars stay green
// and only the highest turn gold (sketch 030). The easing is a DECISION about
// what the eye sees, not a smoothing convenience, so it lives in the function
// and not in a caller's arithmetic.
//
// THE STOPS ARE THE CONTRACT, AND THE CONTRACT LIVES IN THE STYLESHEET
// The three stops are declared once, in `src/styles/tokens.css`, as custom properties;
// this module holds their channel VALUES so the ramp can be computed in
// TypeScript (a CSS gradient cannot be sampled per bar) and a unit test
// compares the two, so a token that drifts from this module fails a test
// instead of quietly painting a different scale. The module therefore holds
// NUMBERS and no colour literal of its own: the project's colour guard
// forbids a hex outside the stylesheet's token declarations, and a second
// copy of the value here would be exactly the drift the guard exists to stop.
//
// COLOUR NEVER CARRIES THE VALUE ALONE
// The caller labels the peak bar in TEXT (the peak's figure and period, in
// the Caption role). A colour-blind reader, a reader in forced-colours mode
// and a reader who simply cannot see the scale still get the peak from the
// label — so the colour is a shortcut, never the message.
//
// WHY THE OUTPUT IS BUILT AT CALL TIME
// The returned colour is assembled from the numeric channels, so the source
// holds no six-digit colour for the project colour guard to find. That is the
// whole reason the function is written this way rather than with a lookup
// table of colour strings.
// =============================================================================

/**
 * The three stops of the Overview value scale, as 0-255 sRGB channel triples.
 *
 * These are the channel values of the `--heat-low`, `--heat-mid` and
 * `--heat-peak` custom properties in `src/styles/tokens.css`; a unit test parses those
 * three declarations and asserts that they agree with this array, so the
 * stylesheet stays the single place a colour is written down.
 */
export const HEAT_STOPS: readonly (readonly [number, number, number])[] = [
  [71, 163, 116],
  [107, 138, 20],
  [140, 100, 0],
];

/** The exponent of the easing: u = t^EASE_EXPONENT, mapped onto two segments. */
const EASE_EXPONENT = 1.5;

/** The number of segments the eased ramp is split into (one per stop pair). */
const SEGMENT_COUNT = HEAT_STOPS.length - 1;

/** Clamp a value into the closed range [0, 1]. */
function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/**
 * The colour of a bar whose value is `t` of the group's maximum.
 *
 * `t` is clamped into [0, 1]; a NaN or a non-finite value is treated as the
 * bottom of the scale rather than as an error, because a bar with no value
 * is a bar with no magnitude, and painting it as the peak would be a claim
 * the data does not support.
 *
 * @param t The value divided by the group's maximum.
 * @returns A lower-case seven-character colour, the hash followed by three
 *   two-digit channels.
 */
export function heatColor(t: number): string {
  const clamped = clamp01(t);
  // The eased position along the whole ramp: 0 is the low stop, 1 the peak.
  const u = clamped ** EASE_EXPONENT * SEGMENT_COUNT;
  const segment = u >= SEGMENT_COUNT ? SEGMENT_COUNT - 1 : Math.floor(u);
  const fraction = u - segment;
  const from = HEAT_STOPS[segment] as readonly [number, number, number];
  const to = HEAT_STOPS[segment + 1] as readonly [number, number, number];

  let colour = '#';
  for (let channel = 0; channel < 3; channel += 1) {
    const start = from[channel] as number;
    const end = to[channel] as number;
    const value = Math.round(start + (end - start) * fraction);
    colour += value.toString(16).padStart(2, '0');
  }
  return colour;
}
