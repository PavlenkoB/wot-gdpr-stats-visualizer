import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const COMPONENTS = path.resolve(__dirname, '../../src/lib/components');
const CHART_FILE = 'MonthlyBarChart.svelte';
const TABLE_FILE = 'MonthlyDataTable.svelte';

function code(filename: string): string {
  return readFileSync(path.join(COMPONENTS, filename), 'utf8');
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
    expect(existsSync(path.join(COMPONENTS, CHART_FILE))).toBe(true);
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
    expect(clean).not.toMatch(/var\(--ramp-/);

    // CSS variables usage
    expect(raw).toContain('var(--flow-in)');
    expect(raw).toContain('var(--flow-out)');
  });

  it('MonthlyDataTable.svelte exists and implements structural and accessibility contracts', () => {
    expect(existsSync(path.join(COMPONENTS, TABLE_FILE))).toBe(true);
    const raw = code(TABLE_FILE);
    const clean = stripComments(raw);

    expect(clean).toContain('<table');
    expect(clean).toContain('scope="col"');
    expect(clean).not.toContain('{@html');
    expect(clean).not.toMatch(/\bstyle="/);
    expect(clean).not.toMatch(/\bstyle:[a-zA-Z-]+=/);
  });
});
