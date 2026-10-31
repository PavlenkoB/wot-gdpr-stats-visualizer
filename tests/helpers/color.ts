// =============================================================================
// The sRGB mixer and the colour-mix parser, as TEST-SIDE helpers.
// =============================================================================
//
// Why this file exists:
//   The heat scale has five data steps and two of them are DERIVED with
//   `color-mix(in srgb, ...)`. The contract test has to recompute the same
//   colours the browser produces, so it needs the arithmetic Chromium uses:
//   the plain channel average in GAMMA-ENCODED sRGB. Headless Chromium 153
//   resolves the green-to-olive mix to `color(srgb 0.34902 0.590196
//   0.266667)`, which is (89, 150.5, 68) on the 0-255 scale, and the
//   olive-to-gold mix to (123.5, 119, 10).
//
//   The COLOUR SPACE is part of the contract: `oklab` gives a different
//   colour for the same two stops, so the parser refuses anything that is
//   not `srgb` rather than quietly computing a colour the browser never
//   produces.
//
// Why it is NOT in src/:
//   Nothing in the app computes contrast or mixes colours - the values are
//   hand-authored in the stylesheets by design, and the build-time CSP
//   forbids the kind of dynamic access that would make a runtime colour
//   library necessary. The module lives with its only consumers.
//
// THE RELATIONSHIP TO tests/helpers/contrast.ts
//   That file reads hex colours only, and it stays exactly as it is. This
//   file adds the float-channel forms the mix needs, and the two agree:
//   `contrastRatioRgb` reproduces `contrastRatio` to within 1e-9, which the
//   unit test pins.
// =============================================================================

/** A colour as its three 0-255 sRGB channels. */
export type Rgb = [number, number, number];

/** One input of a `color-mix()` expression. */
export interface ColorMixPart {
  /** The custom property the colour comes from. */
  ref: string;
  /** The percentage as written, or null when the expression states none. */
  pct: number | null;
}

/** A parsed `color-mix()` expression. */
export interface ParsedColorMix {
  /** The colour space, `srgb` for every expression this project writes. */
  space: string;
  /** The first input. */
  first: ColorMixPart;
  /** The second input. */
  second: ColorMixPart;
}

/** Matches `#rgb` and `#rrggbb`, case-insensitively. */
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Parses a hex colour into its 0-255 sRGB channels.
 *
 * The two CSS hex forms only: no `rgb()`, no named colours, no 4- or
 * 8-digit alpha forms. Every colour in this project's stylesheets is 3- or
 * 6-digit hex, so anything else is a typo that must fail loudly rather than
 * parse as black and pass silently.
 */
export function hexToRgb(hex: string): Rgb {
  if (!HEX.test(hex)) {
    throw new Error(`not a #rgb or #rrggbb colour: ${JSON.stringify(hex)}`);
  }
  const body = hex.slice(1);
  const full =
    body.length === 3
      ? body
          .split('')
          .map((character) => character + character)
          .join('')
      : body;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/**
 * Mixes two colours the way `color-mix(in srgb, ...)` does.
 *
 * The arithmetic is the plain channel average in GAMMA-ENCODED sRGB, which
 * is what Chromium does for the `srgb` colour space. `weightOfA` is the
 * share of the FIRST colour, from 0 to 1.
 */
export function mixSrgb(a: Rgb, b: Rgb, weightOfA: number): Rgb {
  if (!(weightOfA >= 0 && weightOfA <= 1)) {
    throw new Error(`the mix weight must be between 0 and 1, got ${weightOfA}`);
  }
  return [
    a[0] * weightOfA + b[0] * (1 - weightOfA),
    a[1] * weightOfA + b[1] * (1 - weightOfA),
    a[2] * weightOfA + b[2] * (1 - weightOfA),
  ];
}

/** The WCAG 2.x channel linearisation: c/255, linearised below 0.04045. */
function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** The WCAG 2.x relative luminance of a colour, 0 (black) to 1 (white). */
export function luminanceRgb(rgb: Rgb): number {
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

/**
 * The WCAG 2.x contrast ratio between two colours: `(L1 + 0.05) / (L2 +
 * 0.05)` with the lighter one in the numerator, so the result is always
 * >= 1 and independent of argument order.
 */
export function contrastRatioRgb(a: Rgb, b: Rgb): number {
  const la = luminanceRgb(a);
  const lb = luminanceRgb(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Splits a comma list at parenthesis depth zero. */
function splitTopLevel(body: string): string[] {
  const parts: string[] = [];
  let buffer = '';
  let parens = 0;
  for (const ch of body) {
    if (ch === '(') parens += 1;
    if (ch === ')') parens -= 1;
    if (ch === ',' && parens === 0) {
      parts.push(buffer.trim());
      buffer = '';
      continue;
    }
    buffer += ch;
  }
  parts.push(buffer.trim());
  return parts.filter((part) => part !== '');
}

/** One input of a `color-mix()` expression: a `var()` and an optional share. */
function parsePart(text: string): ColorMixPart {
  const match = /var\(\s*(--[\w-]+)\s*\)\s*(?:(\d+(?:\.\d+)?)%?)?/.exec(text);
  if (match === null) {
    throw new Error(`not a var() input: ${JSON.stringify(text)}`);
  }
  return {
    ref: match[1]!,
    pct: match[2] === undefined ? null : Number(match[2]),
  };
}

/**
 * Reads a `color-mix()` expression.
 *
 * Only the shape this project writes is accepted: `color-mix(in <space>,
 * <var()> [<percentage>], <var()> [<percentage>])`.
 */
export function parseColorMix(expr: string): ParsedColorMix {
  const match = /^color-mix\(\s*in\s+([a-zA-Z-]+)\s*,(.*)\)$/.exec(expr.trim());
  if (match === null) {
    throw new Error(`not a color-mix() expression: ${JSON.stringify(expr)}`);
  }
  const space = match[1]!;
  const parts = splitTopLevel(match[2]!);
  if (parts.length !== 2) {
    throw new Error(`a color-mix() expression needs exactly two inputs: ${JSON.stringify(expr)}`);
  }
  return { space, first: parsePart(parts[0]!), second: parsePart(parts[1]!) };
}

/**
 * Resolves a `color-mix()` expression through a custom-property lookup.
 *
 * The colour space must be `srgb`: the contrast test mirrors channel
 * averaging in gamma-encoded sRGB, and a mix in another space would be a
 * colour the browser produces and the test does not.
 */
export function resolveMix(expr: string, lookup: (varName: string) => Rgb): Rgb {
  const parsed = parseColorMix(expr);
  if (parsed.space !== 'srgb') {
    throw new Error(
      `the contrast test mirrors gamma-encoded sRGB, so a "${parsed.space}" mix is not comparable: ${JSON.stringify(expr)}`,
    );
  }
  const weightOfA =
    parsed.first.pct !== null
      ? parsed.first.pct / 100
      : parsed.second.pct !== null
        ? 1 - parsed.second.pct / 100
        : 0.5;
  return mixSrgb(lookup(parsed.first.ref), lookup(parsed.second.ref), weightOfA);
}
