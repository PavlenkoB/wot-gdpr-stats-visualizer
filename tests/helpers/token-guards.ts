// =============================================================================
// The design-token guards, as PURE offender functions (Phase 14, plan 14-03).
// =============================================================================
//
// WHY THIS FILE EXISTS
//   The Phase 14 guards have to read NESTED, TOKEN-BASED source and refuse
//   everything else. Three regular expressions cannot do that: a `[^}]*` body
//   stops at the first nested brace, `var(--fs-*)` reads as an offender, and a
//   sweep over an empty match list passes vacuously. The offender logic
//   therefore lives HERE, as pure functions over a source string, so the test
//   file can feed them SYNTHETIC input and a one-off scratch script can ask
//   the same questions without running a test.
//
// WHY IT IS NOT IN src/
//   Nothing in the app reads its own stylesheets. The shipped bundle has no
//   business carrying a CSS parser, and the build-time CSP forbids the kind of
//   dynamic access that would make one necessary. The module lives with its
//   only consumers.
//
// WHAT IT DEPENDS ON
//   Node built-ins only, and the brace-aware scanner of plan 14-01
//   (`tests/helpers/css.ts`). No library: a guard whose behaviour depends on a
//   dependency version is not a guard.
//
// THE SHAPE OF AN OFFENDER
//   `<name>: <rule> - <detail>`, so a failure names the file, the rule and
//   the declaration that broke it. A guard that says "something is wrong" is
//   a guard nobody acts on.
//
// THE EXEMPTIONS, AND WHY EACH ONE EXISTS
//   - `src/styles/tokens.css` is exempt from G1, G3 and G4: a literal VALUE
//     is the point of a token declaration.
//   - `src/styles/type.css` and `src/styles/utilities.css` (SHARED_STYLE_HOMES)
//     are exempt from G5: the shared names are DEFINED there, once each.
//     `tokens.css` and the shell stylesheet are held to the rule.
//   - `margin: -1px` is allowed in a rule that also declares `clip`: that is
//     the visually-hidden idiom, and the rule says so itself.
// =============================================================================

import { roleClassesIn, scanRules, splitValueTokens, stripCssComments, styleText } from './css.ts';

/** One source file, as the guards read it. */
export interface SourceEntry {
  /** The repo-relative name, with forward slashes. */
  name: string;
  /** The raw source. */
  source: string;
}

/** The token file: the one file allowed to hold a literal value. */
export const TOKENS_CSS_NAME = 'src/styles/tokens.css';

/** The ten type roles of `src/styles/type.css`. */
export const ROLE_NAMES: readonly string[] = [
  '.t-hero',
  '.t-stat',
  '.t-title',
  '.t-display',
  '.t-heading',
  '.t-body',
  '.t-note',
  '.t-note-strong',
  '.t-caption',
  '.t-label',
];

/**
 * The tokens that are declared TWICE on purpose.
 *
 * `--fs-title` is the default and the 900px switch; `--heat-2` and `--heat-4`
 * are the plain fallback and the `color-mix()` override. The NAME appears
 * twice by design, so a "declared once" guard has to count the fallback and
 * the override, not the name.
 */
export const ALLOWED_DUPLICATE_TOKENS: ReadonlySet<string> = new Set([
  '--fs-title',
  '--heat-2',
  '--heat-4',
]);

/** The keywords a declaration may carry whatever it is. */
const KEYWORDS: ReadonlySet<string> = new Set(['inherit', 'initial', 'unset']);

/** The shared class names, which are defined once, in `SHARED_STYLE_HOMES`. */
const SHARED_CLASS_NAMES: ReadonlySet<string> = new Set([
  'visually-hidden',
  'scroller',
  'error',
  'muted-note',
  'body',
]);

/** A size off the shared scale. */
const FS_TOKEN = /^var\(\s*--fs-(?:caption|body|heading|display|stat|hero|title)\s*\)$/;

/** A weight of the shared scale. */
const FW_TOKEN = /^var\(\s*--fw-(?:regular|semibold)\s*\)$/;

/** A line height of the shared scale. */
const LH_TOKEN = /^var\(\s*--lh-(?:hero|stat|heading|tight|body)\s*\)$/;

/** A member of the spacing scale. */
const SPACE_TOKEN = /^var\(\s*--space-(?:4|8|12|16|24)\s*\)$/;

/** A layout value: a measured gutter or a page padding, not a scale member. */
const LAYOUT_TOKEN = /^var\(\s*--layout-[\w-]+\s*\)$/;

/** A px length. */
const PX_LENGTH = /^-?\d+(?:\.\d+)?px$/;

/** A calc() of anything: the spacing guard allows the expression, not its parts. */
const CALC = /^calc\(.+\)$/;

/** The six sizes of the type scale, in px. */
const FS_SCALE: readonly number[] = [12, 14, 18, 26, 32, 56];

/** The five members of the spacing scale, in px. */
const SPACE_SCALE: readonly number[] = [4, 8, 12, 16, 24];

/** The two weights of the project. */
const FW_SCALE: readonly number[] = [400, 600];

/** The properties a role may set, and nothing else. */
const ROLE_PROPERTIES: ReadonlySet<string> = new Set([
  'font-size',
  'font-weight',
  'line-height',
  'overflow-wrap',
  'text-transform',
  'letter-spacing',
]);

/**
 * A hex literal.
 *
 * A run preceded by an ampersand or a word character is not a colour: it is a
 * character reference (`&#x2014;`) or part of a longer name.
 */
const COLOUR_HEX = /(?<![&\w])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g;

/** The opening of a colour function. `color-mix()` is not one of them. */
const COLOUR_FN = /\b(?:rgba?|hsla?)\(/gi;

/**
 * Removes the comments while KEEPING the line structure.
 *
 * The comment removal has to keep the newlines: a comment that spans two
 * lines must not join the line before it to the line after it, or a rule
 * would look like two declarations on one line.
 */
function stripCommentsKeepLines(source: string): string {
  return source
    .replace(/<!--[\s\S]*?-->/g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '));
}

/** The CSS of a file: the style blocks of a Svelte file, the whole of a CSS file. */
export function cssOf(entry: SourceEntry): string {
  if (entry.name.endsWith('.svelte')) return styleText(entry.source);
  if (entry.name.endsWith('.css')) return stripCssComments(entry.source);
  return '';
}

/**
 * The CSS of a file, as LINES, with the comments removed but the lines kept.
 *
 * This does not reuse `styleText`: that one strips the comments, and a comment
 * that spans two lines would then join the line before it to the line after
 * it, and a rule would look like two declarations on one line.
 */
function cssLinesOf(entry: SourceEntry): string[] {
  if (entry.name.endsWith('.svelte')) {
    const parts: string[] = [];
    for (const match of entry.source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
      parts.push(stripCommentsKeepLines(match[1] ?? ''));
    }
    return parts.join('\n').split('\n');
  }
  if (entry.name.endsWith('.css')) return stripCommentsKeepLines(entry.source).split('\n');
  return [];
}

/** The property of a `prop: value` declaration. */
function propertyOf(declaration: string): string {
  const colon = declaration.indexOf(':');
  if (colon < 0) return '';
  return declaration.slice(0, colon).trim().toLowerCase();
}

/** The value of a `prop: value` declaration, without a trailing `!important`. */
function valueOf(declaration: string): string {
  const colon = declaration.indexOf(':');
  if (colon < 0) return '';
  return declaration
    .slice(colon + 1)
    .trim()
    .replace(/\s*!important$/i, '');
}

/** G1: a raw or off-scale size, weight or line height. */
export function fontOffenders(entry: SourceEntry): string[] {
  if (entry.name === TOKENS_CSS_NAME) return [];
  const offenders: string[] = [];
  for (const rule of scanRules(cssOf(entry))) {
    for (const declaration of rule.declarations) {
      const property = propertyOf(declaration);
      const value = valueOf(declaration);
      let allowed: boolean;
      if (property === 'font-size') {
        allowed = value === '0' || KEYWORDS.has(value) || FS_TOKEN.test(value);
      } else if (property === 'font-weight') {
        allowed = value === 'normal' || KEYWORDS.has(value) || FW_TOKEN.test(value);
      } else if (property === 'line-height') {
        allowed =
          value === 'normal' ||
          KEYWORDS.has(value) ||
          value === '1' ||
          LH_TOKEN.test(value) ||
          PX_LENGTH.test(value);
      } else if (property === 'font') {
        allowed = KEYWORDS.has(value);
      } else {
        continue;
      }
      if (!allowed) {
        offenders.push(`${entry.name}: G1 type - ${property}: ${value}`);
      }
    }
  }
  return offenders;
}

/** Whether a property is one of the spacing properties. */
export function isSpacingProperty(property: string): boolean {
  return (
    property === 'gap' ||
    property === 'row-gap' ||
    property === 'column-gap' ||
    property.startsWith('padding') ||
    property.startsWith('margin')
  );
}

/** Whether one whitespace-separated token of a spacing value may stand. */
function spacingTokenAllowed(token: string): boolean {
  return (
    token === '0' ||
    token === 'auto' ||
    KEYWORDS.has(token) ||
    CALC.test(token) ||
    SPACE_TOKEN.test(token) ||
    LAYOUT_TOKEN.test(token)
  );
}

/** G3: a raw spacing value, or a 6px radius. */
export function spacingOffenders(entry: SourceEntry): string[] {
  if (entry.name === TOKENS_CSS_NAME) return [];
  const offenders: string[] = [];
  for (const rule of scanRules(cssOf(entry))) {
    const declaresClip = rule.declarations.some(
      (declaration) => propertyOf(declaration) === 'clip',
    );
    for (const declaration of rule.declarations) {
      const property = propertyOf(declaration);
      const value = valueOf(declaration);
      if (property === 'border-radius') {
        if (splitValueTokens(value).includes('6px')) {
          offenders.push(
            `${entry.name}: G3 spacing - border-radius: ${value} (use var(--radius-sm))`,
          );
        }
        continue;
      }
      if (!isSpacingProperty(property)) continue;
      for (const token of splitValueTokens(value)) {
        if (spacingTokenAllowed(token)) continue;
        // The visually-hidden idiom: a rule that clips may offset itself by -1px.
        if (token === '-1px' && declaresClip) continue;
        offenders.push(`${entry.name}: G3 spacing - ${property}: ${value}`);
        break;
      }
    }
  }
  return offenders;
}

/** G4: a hex, `rgb()`, `rgba()`, `hsl()` or `hsla()` literal. */
export function colourOffenders(entry: SourceEntry): string[] {
  if (entry.name === TOKENS_CSS_NAME) return [];
  const source = stripCssComments(entry.source);
  const offenders: string[] = [];
  for (const match of source.matchAll(COLOUR_HEX)) {
    offenders.push(`${entry.name}: G4 colour - ${match[0]}`);
  }
  for (const match of source.matchAll(COLOUR_FN)) {
    offenders.push(`${entry.name}: G4 colour - ${match[0]}`);
  }
  return offenders;
}

/**
 * G5: a local definition of one of the shared names.
 *
 * Only the two files that DEFINE the shared names (`SHARED_STYLE_HOMES`) are
 * exempt; every other file, including the rest of `src/styles/`, is held to
 * the rule.
 */
export function sharedNameOffenders(entry: SourceEntry): string[] {
  if (SHARED_STYLE_HOMES.includes(entry.name)) return [];
  const offenders: string[] = [];
  for (const rule of scanRules(cssOf(entry))) {
    for (const part of rule.selector.split(',')) {
      const selector = part.trim();
      if (selector === '') continue;
      const seen = new Set<string>();
      for (const match of selector.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) {
        const className = match[1]!;
        if (seen.has(className)) continue;
        seen.add(className);
        if (!SHARED_CLASS_NAMES.has(className) && !className.startsWith('t-')) continue;
        offenders.push(`${entry.name}: G5 shared names - ${selector} defines .${className}`);
      }
    }
  }
  return offenders;
}

/**
 * The two files that define the shared styles: the role file and the
 * utilities file. Guard G5 (shared names defined once) and guard G7 (the note
 * pair is a role) both exempt exactly these two.
 */
export const SHARED_STYLE_HOMES: readonly string[] = [
  'src/styles/type.css',
  'src/styles/utilities.css',
];

/**
 * G7: the 14px / 1.4 pair is a role (14-D-07).
 *
 * A rule that declares the 14px size and the 1.4 line height together is a
 * hand-written copy of `.t-note` / `.t-note-strong`. The WEIGHT is ignored on
 * purpose: the pair is the subject, because a role sets its weight
 * explicitly. The pair is legitimate only in `SHARED_STYLE_HOMES`: the role
 * file defines it, and the shared muted-note utility states the same triple
 * there. `tokens.css` and the shell stylesheet are NOT exempt.
 */
export function noteRoleOffenders(entry: SourceEntry): string[] {
  if (SHARED_STYLE_HOMES.includes(entry.name)) return [];
  const offenders: string[] = [];
  for (const rule of scanRules(cssOf(entry))) {
    const size = rule.declarations.find((declaration) => propertyOf(declaration) === 'font-size');
    const height = rule.declarations.find(
      (declaration) => propertyOf(declaration) === 'line-height',
    );
    if (size === undefined || height === undefined) continue;
    if (valueOf(size) !== 'var(--fs-body)' || valueOf(height) !== 'var(--lh-tight)') continue;
    offenders.push(
      `${entry.name}: G7 note role - ${rule.selector.trim()} declares the 14px/1.4 pair; take .t-note or .t-note-strong`,
    );
  }
  return offenders;
}

/**
 * The consumer guard: every role must be used as a class by at least one
 * `.svelte` file.
 *
 * This is what stops a role being shipped unused. The Phase 14 audit found two
 * orphans (roles defined in the role file that no component took); with this
 * guard a new role, or an old one, cannot become the next orphan. Use is read
 * with `roleClassesIn`, so a role named only in a comment or only as a
 * selector in a style block does not count. Names are compared without the
 * leading dot.
 */
export function roleConsumerOffenders(
  roleNames: readonly string[],
  entries: readonly SourceEntry[],
): string[] {
  const used = new Set<string>();
  for (const entry of entries) {
    if (!entry.name.endsWith('.svelte')) continue;
    for (const role of roleClassesIn(entry.source)) used.add(role);
  }
  return roleNames
    .map((name) => name.replace(/^\./, ''))
    .filter((name) => !used.has(name))
    .map((name) => `role ${name} - no .svelte file uses it as a class`);
}

/** G6a: two declarations on one line, or an opening brace and a declaration. */
export function declarationLineOffenders(entry: SourceEntry): string[] {
  const offenders: string[] = [];
  const lines = cssLinesOf(entry);
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed === '') return;
    const semicolons = (trimmed.match(/;/g) ?? []).length;
    if (trimmed.includes('{') && semicolons >= 1) {
      offenders.push(
        `${entry.name}: G6a declaration lines - line ${index + 1}: an opening brace and a declaration on one line`,
      );
      return;
    }
    if (semicolons >= 2) {
      offenders.push(
        `${entry.name}: G6a declaration lines - line ${index + 1}: two declarations on one line`,
      );
    }
  });
  return offenders;
}

/** The characters that make one selector the EXTENSION of another. */
const EXTENSION_CHARS: readonly string[] = [' ', '>', '+', '~', '.', ':', '[', '#'];

/** Whether `child` is `parent` extended by one more compound. */
function extendsSelector(parent: string, child: string): boolean {
  if (!child.startsWith(parent) || child.length === parent.length) return false;
  return EXTENSION_CHARS.includes(child.charAt(parent.length));
}

/** G6b: a rule that extends a sibling and is not nested under it. */
export function nestingOffenders(entry: SourceEntry): string[] {
  const rules = scanRules(cssOf(entry));
  const offenders: string[] = [];
  const scopes = new Map<number, number[]>();
  for (let index = 0; index < rules.length; index += 1) {
    const rule = rules[index]!;
    const scope = rule.parent ?? -1;
    const indexes = scopes.get(scope) ?? [];
    indexes.push(index);
    scopes.set(scope, indexes);
  }
  for (const indexes of scopes.values()) {
    // A rule with a comma is a LIST, not a single selector: it can neither
    // extend a sibling nor be extended by one.
    const singles = indexes
      .map((index) => rules[index]!)
      .filter((rule) => !rule.atRule && !rule.selector.includes(','))
      .map((rule) => rule.selector.trim())
      .filter((selector) => selector !== '');
    for (let first = 0; first < singles.length; first += 1) {
      for (let second = first + 1; second < singles.length; second += 1) {
        const one = singles[first]!;
        const other = singles[second]!;
        if (extendsSelector(one, other)) {
          offenders.push(
            `${entry.name}: G6b nesting - "${other}" extends "${one}": nest it under it`,
          );
        } else if (extendsSelector(other, one)) {
          offenders.push(
            `${entry.name}: G6b nesting - "${one}" extends "${other}": nest it under it`,
          );
        }
      }
    }
  }
  return offenders;
}

/** The network rules: a `url()` or an `@import` in a stylesheet. */
export function networkOffenders(entry: SourceEntry): string[] {
  const offenders: string[] = [];
  const css = cssOf(entry);
  if (css === '') return offenders;
  for (const match of css.matchAll(/url\([^)]*\)/gi)) {
    offenders.push(`${entry.name}: CSS network - ${match[0]} in a stylesheet`);
  }
  for (const match of css.matchAll(/@import[^;]*/gi)) {
    offenders.push(`${entry.name}: CSS network - ${match[0].trim()} in a stylesheet`);
  }
  return offenders;
}

/** The inline `style=` attribute in a markup file. */
export function styleAttributeOffenders(entry: SourceEntry): string[] {
  if (!entry.name.endsWith('.svelte')) return [];
  const source = stripCssComments(entry.source);
  const offenders: string[] = [];
  for (const match of source.matchAll(/\sstyle\s*=\s*["'][^"']*["']/g)) {
    offenders.push(
      `${entry.name}: inline style - ${match[0].trim()} is blocked by the shipped CSP`,
    );
  }
  return offenders;
}

/** The number of times each custom property is declared in a stylesheet. */
export function customPropertyCounts(css: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const match of stripCssComments(css).matchAll(/(--[\w-]+)\s*:/g)) {
    const name = match[1]!;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return counts;
}

/** Every custom property is declared in the token file and only there. */
export function declaredOnceOffenders(entries: readonly SourceEntry[]): string[] {
  const offenders: string[] = [];
  for (const entry of entries) {
    const counts = customPropertyCounts(cssOf(entry));
    if (entry.name === TOKENS_CSS_NAME) {
      for (const [name, count] of counts) {
        if (count > 1 && !ALLOWED_DUPLICATE_TOKENS.has(name)) {
          offenders.push(`${entry.name}: declared once - ${name} is declared ${count} times`);
        }
      }
      continue;
    }
    for (const [name] of counts) {
      offenders.push(
        `${entry.name}: declared once - ${name} is declared outside ${TOKENS_CSS_NAME}`,
      );
    }
  }
  return offenders;
}

/** The ten roles, and the properties a role may set. */
export function roleOffenders(css: string): string[] {
  const offenders: string[] = [];
  // The scanner walks the text as it is: a comment in front of a selector
  // would become part of the selector, and a comment in front of an at-rule
  // would hide the `@` that marks it. The comments go first.
  const rules = scanRules(stripCssComments(css));
  for (const name of ROLE_NAMES) {
    if (!rules.some((rule) => rule.selector.trim() === name)) {
      offenders.push(`role file - ${name} is missing`);
    }
  }
  for (const rule of rules) {
    const selector = rule.selector.trim();
    if (!ROLE_NAMES.includes(selector)) {
      offenders.push(`role file - ${selector} is not one of the ten roles`);
      continue;
    }
    for (const declaration of rule.declarations) {
      const property = propertyOf(declaration);
      if (!ROLE_PROPERTIES.has(property)) {
        offenders.push(`role file - ${selector} declares ${property}, which a role may not set`);
      }
    }
  }
  return offenders;
}

/** The px value of a token declaration, or undefined when it is not one. */
function pxValue(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const match = /^(-?\d+(?:\.\d+)?)px$/.exec(value.trim());
  if (match === null) return undefined;
  return Number(match[1]);
}

/** The numeric value of a token declaration, or undefined when it is not one. */
function numberValue(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const match = /^(-?\d+(?:\.\d+)?)$/.exec(value.trim());
  if (match === null) return undefined;
  return Number(match[1]);
}

/** The declaration of a name inside a named media query. */
function mediaTokenValue(css: string, query: string, name: string): string | undefined {
  const rules = scanRules(stripCssComments(css));
  for (const rule of rules) {
    if (rule.parent === null) continue;
    const parent = rules[rule.parent];
    if (parent === undefined || !parent.atRule) continue;
    if (!parent.selector.includes(query)) continue;
    for (const declaration of rule.declarations) {
      if (propertyOf(declaration) === name) return valueOf(declaration);
    }
  }
  return undefined;
}

/** The type scale, the spacing scale and the two weights. */
export function tokenScaleOffenders(css: string): string[] {
  const offenders: string[] = [];
  const tokens = new Map<string, string>();
  for (const match of stripCssComments(css).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    const name = match[1]!;
    if (tokens.has(name)) continue;
    tokens.set(name, match[2]!.replace(/\s+/g, ' ').trim());
  }

  const fsNames = [
    '--fs-caption',
    '--fs-body',
    '--fs-heading',
    '--fs-display',
    '--fs-stat',
    '--fs-hero',
  ];
  for (const name of fsNames) {
    const value = pxValue(tokens.get(name));
    if (value === undefined) {
      offenders.push(`token scale - ${name} is not a px length (${tokens.get(name) ?? 'missing'})`);
      continue;
    }
    if (value < 12) {
      offenders.push(`token scale - ${name} is ${value}px, below the 12px floor`);
    }
    if (!FS_SCALE.includes(value)) {
      offenders.push(
        `token scale - ${name} is ${value}px, which is not one of ${FS_SCALE.join(', ')}`,
      );
    }
  }

  const title = tokens.get('--fs-title');
  if (title !== 'var(--fs-display)') {
    offenders.push(`token scale - --fs-title is ${title ?? 'missing'}, not var(--fs-display)`);
  }
  const titleAt900 = mediaTokenValue(css, 'min-width: 900px', '--fs-title');
  if (titleAt900 !== 'var(--fs-stat)') {
    offenders.push(
      `token scale - --fs-title is ${titleAt900 ?? 'missing'} at 900px, not var(--fs-stat)`,
    );
  }

  const spaceNames = ['--space-4', '--space-8', '--space-12', '--space-16', '--space-24'];
  for (const name of spaceNames) {
    const value = pxValue(tokens.get(name));
    if (value === undefined || !SPACE_SCALE.includes(value)) {
      offenders.push(`token scale - ${name} is ${tokens.get(name) ?? 'missing'}`);
    }
  }

  const fwNames = ['--fw-regular', '--fw-semibold'];
  for (const name of fwNames) {
    const value = numberValue(tokens.get(name));
    if (value === undefined || !FW_SCALE.includes(value)) {
      offenders.push(`token scale - ${name} is ${tokens.get(name) ?? 'missing'}`);
    }
  }

  return offenders;
}
