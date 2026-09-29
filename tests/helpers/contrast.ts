// =============================================================================
// WCAG 2.x contrast ratio, as a TEST-SIDE helper.
// =============================================================================
//
// Why this file exists (W-03):
//   The nav's hover surface was specified as `#ffffff` on a `#f7f7fa` nav
//   with the rationale that the Phase 2 `#f1f3f4` "would be near-invisible
//   on that surface". It is: `#f1f3f4` measures 1.041:1 and `#ffffff`
//   measures 1.069:1, so the rationale rejected a value and then shipped an
//   equivalent one — the hover affordance was imperceptible either way.
//   A wrong number in a design contract is invisible to every other check in
//   the repo, so the contract's numbers are now computed here and asserted,
//   and `contrast.test.ts` fails if the code and the spec ever disagree.
//
// Why it is NOT in src/:
//   Nothing in the app computes contrast — the values are hand-authored hex
//   in component stylesheets by design (the build-time CSP forbids inline
//   styles, and ui-copy.ts is the home of COPY, not of colour maths). A
//   module imported only by tests would be dead weight in the shipped
//   bundle, so it lives with its only consumers.
// =============================================================================

/** Matches `#rgb` and `#rrggbb`, case-insensitively. */
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Parse a hex colour into its 0-255 sRGB channels.
 *
 * Accepts the two CSS hex forms only — no rgb()/hsl() strings, no named
 * colours, no 4- or 8-digit alpha forms. Every colour in this project's
 * stylesheets and in 03-UI-SPEC.md is 3- or 6-digit hex, so anything else is
 * a typo that must fail loudly rather than parse as black and pass silently.
 */
function parseHex(hex: string): [number, number, number] {
  if (!HEX.test(hex)) {
    throw new Error(`not a #rgb or #rrggbb colour: ${JSON.stringify(hex)}`);
  }
  const body = hex.slice(1);
  const full =
    body.length === 3
      ? body
          .split('')
          .map((c) => c + c)
          .join('')
      : body;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** The WCAG 2.x channel linearisation: c/255, linearised below 0.04045. */
function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** The WCAG 2.x relative luminance of a hex colour, 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * The WCAG 2.x contrast ratio between two hex colours: `(L1 + 0.05) /
 * (L2 + 0.05)` with the lighter one in the numerator, so the result is
 * always >= 1 and independent of argument order.
 */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
