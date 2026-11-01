import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { componentPath } from '../../helpers/components.ts';
import { ruleDeclarations, styleText } from '../../helpers/css.ts';

const CHART_FILE = 'MonthlyBarChart.svelte';
const TABLE_FILE = 'MonthlyDataTable.svelte';

function code(filename: string): string {
  return readFileSync(componentPath(filename), 'utf8');
}

/** Strip single-line and multi-line comments from Svelte file source. */
function stripComments(source: string): string {
  return source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*/gm, '');
}

describe('05-11 MonthlyBarChart & MonthlyDataTable component contracts', () => {
  it('MonthlyBarChart.svelte exists and implements structural and accessibility contracts', () => {
    expect(existsSync(componentPath(CHART_FILE))).toBe(true);
    const raw = code(CHART_FILE);
    const clean = stripComments(raw);

    expect(clean).toContain('role="grid"');
    expect(clean).toContain('role="gridcell"');
    expect(clean).toContain('onpointerover=');

    // Prohibitions
    expect(clean).not.toContain('viewBox');
    expect(clean).not.toContain('{@html');
    expect(clean).not.toMatch(/\bstyle="/);
    expect(clean).not.toMatch(/\bstyle:[a-zA-Z-]+=/);
    expect(clean).not.toMatch(/from\s+['"].*ui-copy['"]/);
    // A monthly bar chart is two directions, not an ordered scale: the value
    // scale is not this chart's vocabulary at all.
    expect(clean).not.toMatch(/var\(--heat-/);

    // CSS variables usage
    expect(raw).toContain('var(--flow-in)');
    expect(raw).toContain('var(--flow-out)');
  });

  it('MonthlyBarChart.svelte measures its scroller and re-lays out from the data model (G-08-3)', () => {
    const clean = stripComments(code(CHART_FILE));

    expect(clean).toContain('bind:contentRect');
    expect(clean).toMatch(/buildBarChartModel\(\s*model\.input/);
    // The roving-focus reset stays keyed to the data, never to the laid-out model.
    expect(clean).toContain('initialBarFocus(model)');
    expect(clean).not.toContain('initialBarFocus(laid)');
    expect(clean).not.toMatch(/ui-copy/);
    expect(clean).not.toContain('viewBox');
    expect(clean).not.toMatch(/\bstyle="/);
  });

  it('MonthlyDataTable.svelte exists and implements structural and accessibility contracts', () => {
    expect(existsSync(componentPath(TABLE_FILE))).toBe(true);
    const raw = code(TABLE_FILE);
    const clean = stripComments(raw);

    expect(clean).toContain('<table');
    expect(clean).toContain('scope="col"');
    expect(clean).not.toContain('{@html');
    expect(clean).not.toMatch(/\bstyle="/);
    expect(clean).not.toMatch(/\bstyle:[a-zA-Z-]+=/);
  });

  it('every axis label takes the note role and the axis rule keeps only the paint (14-D-07)', () => {
    const raw = code(CHART_FILE);
    const labels = stripComments(raw).match(/<text\s+class="axis [^"]*"/g) ?? [];
    expect(labels.length, 'the chart draws axis labels').toBeGreaterThan(0);
    for (const label of labels) expect(label).toContain('t-note');

    const rule = ruleDeclarations(styleText(raw), '.axis');
    expect(rule, 'the axis rule exists').not.toBe('');
    expect(rule).toContain('fill: var(--muted)');
    expect(rule).not.toMatch(/font-size|font-weight|line-height/);
  });

  it('the table takes the strong note role and its rule declares no size or line height (14-D-07)', () => {
    const raw = code(TABLE_FILE);
    expect(stripComments(raw)).toMatch(/<table class="t-note-strong"/);

    const rule = ruleDeclarations(styleText(raw), 'table');
    expect(rule, 'the table rule exists').not.toBe('');
    expect(rule).not.toMatch(/font-size|line-height/);
  });
});
