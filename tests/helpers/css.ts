// =============================================================================
// The brace-aware CSS reader, as a TEST-SIDE helper.
// =============================================================================
//
// Why this file exists:
//   About twenty unit tests read component sources as text and assert what a
//   declaration says. They used to do it with a regular expression that read
//   the text between the first `{` and the first `}` - a rule body that stops
//   at the first closing brace, whether that brace belongs to the rule or to
//   something NESTED inside it. The failing case is a nested rule:
//
//     .controls { ... }               the old reader finds this
//     .card { & .controls { ... } }   the old reader finds NOTHING
//
//   The old reader anchored the selector on a `}` or a `;`, so a nested
//   selector - which follows an opening brace - was invisible to it. A guard
//   written against an invisible rule is a guard that passes vacuously, so
//   the reader has to see nesting.
//
// Why it is NOT in src/:
//   Nothing in the app reads its own stylesheets. The shipped bundle has no
//   business carrying a CSS parser, and the build-time CSP forbids the kind
//   of dynamic access that would make one necessary. The module lives with
//   its only consumers.
//
// WHAT IT DOES NOT DEPEND ON
//   Node built-ins only, and no library. A test helper that pulled a parser
//   in would make the guards' behaviour depend on a dependency version.
// =============================================================================

/** One rule, as the scanner sees it. */
export interface CssRule {
  /** The rule's own selector text, as written. */
  selector: string;
  /** The declarations this rule declares, normalised to `prop: value`. */
  declarations: string[];
  /** How deep the rule sits: 0 at the top level. */
  depth: number;
  /** The index of the enclosing rule, or null at the top level. */
  parent: number | null;
  /** Whether the rule is an at-rule header (`@media`, `@supports`, ...). */
  atRule: boolean;
}

/**
 * Removes HTML, block and whole-line `//` comments.
 *
 * The comment removal matters more than it looks: a contract comment may
 * QUOTE a declaration (`--space-16: 16px;`), and a reader that took the
 * quote for the declaration would read a value the stylesheet never sets.
 */
export function stripCssComments(source: string): string {
  return source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*/gm, '');
}

/**
 * The concatenated, comment-stripped body of every `<style>` element.
 *
 * The empty string when the source holds no style element, so a reader that
 * asks about a file with no styles gets an answer rather than a crash.
 */
export function styleText(svelteSource: string): string {
  const parts: string[] = [];
  for (const match of svelteSource.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
    parts.push(stripCssComments(match[1] ?? ''));
  }
  return parts.join('\n');
}

/** A declaration as `prop: value`: whitespace collapsed, no trailing semicolon. */
function normaliseDeclaration(text: string): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return collapsed.endsWith(';') ? collapsed.slice(0, -1).trim() : collapsed;
}

/**
 * Every rule in the text, parents before their children.
 *
 * The walk is a character scan with a stack of open rules. It is aware of
 * QUOTED STRINGS and of PARENTHESES, so a `;` or a brace inside either does
 * not split a rule, and a declaration written without a trailing semicolon
 * before the closing brace is still a declaration.
 */
export function scanRules(css: string): CssRule[] {
  const rules: CssRule[] = [];
  const open: number[] = [];
  let buffer = '';
  let quote: string | null = null;
  let parens = 0;

  const flush = (): void => {
    const text = buffer.trim();
    buffer = '';
    if (text === '') return;
    const top = open[open.length - 1];
    // A declaration outside any rule belongs to no rule.
    if (top === undefined) return;
    rules[top]!.declarations.push(normaliseDeclaration(text));
  };

  for (const ch of css) {
    if (quote !== null) {
      buffer += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (parens > 0) {
      buffer += ch;
      if (ch === '(') parens += 1;
      else if (ch === ')') parens -= 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      buffer += ch;
      continue;
    }
    if (ch === '(') {
      parens += 1;
      buffer += ch;
      continue;
    }
    if (ch === '{') {
      const selector = buffer.trim();
      buffer = '';
      const rule: CssRule = {
        selector,
        declarations: [],
        depth: open.length,
        parent: open.length > 0 ? open[open.length - 1]! : null,
        atRule: selector.startsWith('@'),
      };
      rules.push(rule);
      open.push(rules.length - 1);
      continue;
    }
    if (ch === '}') {
      // The declaration written without a trailing semicolon.
      flush();
      open.pop();
      continue;
    }
    if (ch === ';') {
      flush();
      continue;
    }
    buffer += ch;
  }

  return rules;
}

/** The chain of rules from the outermost to the given one. */
export function ancestry(rules: readonly CssRule[], index: number): CssRule[] {
  const chain: CssRule[] = [];
  let current: CssRule | undefined = rules[index];
  while (current !== undefined) {
    chain.unshift(current);
    current = current.parent === null ? undefined : rules[current.parent];
  }
  return chain;
}

/** A selector list, split on its commas. */
function splitSelectors(selector: string): string[] {
  return selector
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');
}

/**
 * The selector(s) of a rule with every `&` replaced by its parent's flat
 * selector(s).
 *
 * A comma list yields several strings. An AT-RULE parent contributes its own
 * parent's selector unchanged: `@media` is not a selector, so a rule inside
 * one is still a child of whatever the at-rule is inside.
 */
export function flatSelectors(rules: readonly CssRule[], index: number): string[] {
  const rule = rules[index];
  if (rule === undefined) return [];
  const own = splitSelectors(rule.selector);
  if (rule.parent === null) return own;

  const parent = rules[rule.parent];
  if (parent === undefined) return own;

  const effective = parent.atRule ? parent.parent : rule.parent;
  if (effective === null || effective === undefined) return own;

  const parents = flatSelectors(rules, effective);
  const flat: string[] = [];
  for (const parentSelector of parents) {
    for (const selector of own) {
      flat.push(
        selector.includes('&')
          ? selector.replace(/&/g, parentSelector)
          : `${parentSelector} ${selector}`,
      );
    }
  }
  return flat;
}

/**
 * The declarations of the FIRST rule that matches `selector`.
 *
 * A rule matches when the query equals its own selector, its own selector
 * with a leading `& ` removed, or one of its flat selectors. The last of
 * those is what finds a NESTED rule: `& .controls` inside `.card` has the
 * flat selector `.card .controls`, and `&.footer` inside `.row` has
 * `.row.footer`.
 *
 * The declarations come back each followed by a semicolon and joined by one
 * space, so an assertion of the form `/(?:^|;)\s*flex-direction:\s*row\s*;/`
 * keeps working against the result.
 *
 * The COMMENTS ARE STRIPPED first, exactly as `tokenMap` does. The scanner
 * itself is not comment-aware, and a stylesheet whose header comment holds
 * an apostrophe ("`caption`'s") opens a quote the scanner never closes: the
 * rest of the file is then read as one quoted string, NO rule is found, and
 * this function answers with the empty string - which is what a guard reads
 * as "this component declares no such rule". A guard that cannot tell a
 * missing rule from a mis-parsed file is a guard that passes vacuously.
 *
 * The empty string when nothing matches: a guard that asks about a rule
 * that is not there gets an answer it can fail on.
 */
export function ruleDeclarations(css: string, selector: string): string {
  const rules = scanRules(stripCssComments(css));
  for (let index = 0; index < rules.length; index += 1) {
    const rule = rules[index]!;
    const own = rule.selector.trim();
    const withoutAmp = own.startsWith('& ') ? own.slice(2).trim() : own;
    if (own === selector || withoutAmp === selector) {
      return rule.declarations.map((declaration) => `${declaration};`).join(' ');
    }
    if (flatSelectors(rules, index).includes(selector)) {
      return rule.declarations.map((declaration) => `${declaration};`).join(' ');
    }
  }
  return '';
}

/**
 * Splits a value on whitespace at parenthesis depth zero.
 *
 * `var(--space-8) calc(1px + 2px) 0` is three tokens, not five: the space
 * inside `calc(...)` belongs to the function.
 */
export function splitValueTokens(value: string): string[] {
  const tokens: string[] = [];
  let buffer = '';
  let parens = 0;
  for (const ch of value) {
    if (ch === '(') {
      parens += 1;
      buffer += ch;
      continue;
    }
    if (ch === ')') {
      parens -= 1;
      buffer += ch;
      continue;
    }
    if (parens === 0 && /\s/.test(ch)) {
      if (buffer !== '') {
        tokens.push(buffer);
        buffer = '';
      }
      continue;
    }
    buffer += ch;
  }
  if (buffer !== '') tokens.push(buffer);
  return tokens;
}

/**
 * The `--name: value;` pairs of the text, keeping the FIRST of each name.
 *
 * The first is the default, and the default is the one a reader wants: the
 * override that follows it is a media-query or a `@supports` variant of the
 * same token, not a second token.
 */
export function tokenMap(css: string): Map<string, string> {
  const source = stripCssComments(css);
  const map = new Map<string, string>();
  for (const match of source.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    const name = match[1]!;
    if (map.has(name)) continue;
    map.set(name, match[2]!.replace(/\s+/g, ' ').trim());
  }
  return map;
}

/**
 * The token families that resolve to a plain number or a px length.
 *
 * A colour token (`--muted: #5c5c5c`) and a composite token
 * (`--space-calc: calc(1px + 2px)`) are NOT in this list: resolving them to
 * text would change what the declaration means.
 */
const RESOLVABLE_TOKEN = /^--(?:fs|space|layout|radius|fw|lh)-/;

/** A bare number, or a bare number with a px unit. */
const PLAIN_VALUE = /^-?\d+(?:\.\d+)?(?:px)?$/;

/**
 * Replaces the resolvable `var()` references of the text with their values.
 *
 * A `var()` whose token is unknown, or whose token is not a plain number or
 * a px length, is left exactly as it was: the reader does not guess.
 */
export function resolveTokens(text: string, map: Map<string, string>): string {
  return text.replace(/var\(\s*(--[\w-]+)\s*\)/g, (whole: string, name: string) => {
    if (!RESOLVABLE_TOKEN.test(name)) return whole;
    const value = map.get(name);
    if (value === undefined) return whole;
    if (!PLAIN_VALUE.test(value)) return whole;
    return value;
  });
}
