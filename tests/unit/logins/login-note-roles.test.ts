import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { componentPath } from '../../helpers/components.ts';
import { ruleDeclarations, styleText } from '../../helpers/css.ts';

// =============================================================================
// The Login history pane on the note roles (Phase 15, 14-D-07)
//
// The pane's 14px / 1.4 sites no longer hand-write the pair: the element carries
// `.t-note` or `.t-note-strong` and the scoped rule keeps only what is the
// component's own (colour, box, alignment). The rules below read component
// source as text, so each one asserts the file and the rule EXIST before it
// asserts what they leave out: an empty string declares nothing.
// =============================================================================

const CITY_LIST = 'CityList.svelte';
const COUNTRY_LIST = 'CountryList.svelte';
const CITY_OPT_IN = 'CityOptIn.svelte';
const HISTORY = 'LoginHistory.svelte';
const MAP_SECTION = 'LoginMapSection.svelte';
const SUMMARY = 'LoginSummary.svelte';
const TABLE = 'LoginTable.svelte';

/** The file's source, or `''` when it does not exist. */
function source(file: string): string {
  const full = componentPath(file);
  return existsSync(full) ? readFileSync(full, 'utf8') : '';
}

/** The markup and script, with every comment removed. */
function code(file: string): string {
  return source(file)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

/** The declarations of one scoped rule, or `''` when there is none. */
function rule(file: string, selector: string): string {
  return ruleDeclarations(styleText(source(file)), selector);
}

const NO_TYPE = /font-size|font-weight|line-height/;

describe('15-09 Task 1 - the city list, country list and city opt-in', () => {
  test('both lists take the note roles on the summary, table and headers', () => {
    for (const file of [CITY_LIST, COUNTRY_LIST]) {
      const body = code(file);
      expect(body, `${file} exists`).not.toBe('');
      expect(body).toMatch(/<summary class="t-note-strong">/);
      expect(body).toMatch(/<table class="t-note">/);
      const headers = body.match(/<th\b/g) ?? [];
      expect(headers.length, `${file} has headers`).toBeGreaterThan(0);
      // Every header carries the strong role (a `th` is bold by default and
      // never inherits the table's role).
      expect(body.match(/<th scope="col" class="(name )?t-note-strong">/g) ?? []).toHaveLength(
        headers.length,
      );
    }
  });

  test('the list rules declare no type of their own', () => {
    for (const file of [CITY_LIST, COUNTRY_LIST]) {
      for (const selector of ['summary', 'table', 'th', 'td']) {
        const declared = rule(file, selector);
        expect(declared, `${file} ${selector} rule exists`).not.toBe('');
        expect(declared, `${file} ${selector} declares no type`).not.toMatch(NO_TYPE);
      }
    }
  });

  test('the opt-in heading and every button take the strong role and declare no type', () => {
    const body = code(CITY_OPT_IN);
    expect(body).toMatch(/<h4 class="t-note-strong">/);
    // Both buttons: the shared Load snippet and the Cancel button.
    expect(body.match(/<button\b/g) ?? []).toHaveLength(2);
    expect(body.match(/<button\s+type="button"\s+class="t-note-strong"/g) ?? []).toHaveLength(2);
    for (const selector of ['h4', 'button']) {
      const declared = rule(CITY_OPT_IN, selector);
      expect(declared, `${selector} rule exists`).not.toBe('');
      expect(declared, `${selector} declares no type`).not.toMatch(NO_TYPE);
    }
    // The 44px-class chrome stays: the button keeps its padding and border.
    expect(rule(CITY_OPT_IN, 'button')).toContain('border: 1px solid var(--faint)');
  });
});

describe('15-09 Task 2 - the history block, map heading, summary and login table', () => {
  test('the block heading, table heading and the one global reveal take the strong role', () => {
    const body = code(HISTORY);
    expect(body).toMatch(/<h3 class="t-note-strong">/);
    expect(body.match(/<h4\b/g) ?? []).toHaveLength(1);
    expect(body).toMatch(/<h4 class="t-note-strong">/);
    expect(body.match(/<button\b/g) ?? []).toHaveLength(1);
    expect(body).toMatch(
      /<button\s+type="button"\s+class="t-note-strong"\s+data-testid="login-mask-toggle"/,
    );
    for (const selector of ['h3', 'h4', 'button']) {
      const declared = rule(HISTORY, selector);
      expect(declared, `${selector} rule exists`).not.toBe('');
      expect(declared, `${selector} declares no type`).not.toMatch(NO_TYPE);
    }
    // The reveal keeps its chrome.
    expect(rule(HISTORY, 'button')).toContain('border: 1px solid var(--faint)');
  });

  test('the map heading and every summary label take the strong role', () => {
    expect(code(MAP_SECTION)).toMatch(/<h4 class="t-note-strong">/);
    const summary = code(SUMMARY);
    expect(summary.match(/<dt\b/g) ?? []).toHaveLength(6);
    expect(summary.match(/<dt class="t-note-strong">/g) ?? []).toHaveLength(6);
    for (const [file, selector] of [
      [MAP_SECTION, 'h4'],
      [SUMMARY, 'dt'],
    ] as const) {
      const declared = rule(file, selector);
      expect(declared, `${file} ${selector} rule exists`).not.toBe('');
      expect(declared, `${file} ${selector} declares no type`).not.toMatch(NO_TYPE);
    }
  });

  test('the login table carries the regular role, the headers and sort buttons the strong one', () => {
    const body = code(TABLE);
    expect(body).toMatch(/<table\s+class="t-note"\s+data-testid="login-table"/);
    expect(body.match(/<th\b/g) ?? []).toHaveLength(1);
    expect(body).toMatch(/class="\{column\.widthClass\} t-note-strong"/);
    expect(body.match(/<button\b/g) ?? []).toHaveLength(1);
    expect(body).toMatch(/<button\s+type="button"\s+class="t-note-strong"/);
    // The cells and the overflow count inherit the table's role.
    for (const selector of ['table', 'th', 'button', 'td', '.more']) {
      const declared = rule(TABLE, selector);
      expect(declared, `${selector} rule exists`).not.toBe('');
      expect(declared, `${selector} declares no type`).not.toMatch(NO_TYPE);
    }
    // The fixed 40px geometry the window divides by is untouched.
    expect(rule(TABLE, 'td')).toContain('height: 40px');
    expect(rule(TABLE, 'button')).toContain('height: 40px');
  });
});
