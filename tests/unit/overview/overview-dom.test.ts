// =============================================================================
// overview-dom.test.ts — the CSSOM route into the DOM (13-09, Task 1)
// =============================================================================
//
// The page's CSP forbids a `style` attribute, so a span reaches the DOM only
// through `style.setProperty`. Vitest runs with no DOM, so the element is a
// fake whose `style` records every call; what matters is WHICH calls the action
// makes and when, and that the module has no other way in.
// =============================================================================

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  peakAt,
  setViewTransitionName,
  spans,
} from '../../../src/lib/features/overview/overview-dom.ts';

const SOURCE = readFileSync(
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    '..',
    'src/lib/features/overview/overview-dom.ts',
  ),
  'utf8',
);

/** A fake element whose style keeps the custom properties written to it. */
function fakeNode(): { node: HTMLElement; props: Map<string, string>; calls: string[] } {
  const props = new Map<string, string>();
  const calls: string[] = [];
  const style = {
    setProperty(name: string, value: string): void {
      calls.push(`set ${name}=${value}`);
      props.set(name, value);
    },
    removeProperty(name: string): string {
      calls.push(`remove ${name}`);
      const old = props.get(name) ?? '';
      props.delete(name);
      return old;
    },
  };
  return { node: { style } as unknown as HTMLElement, props, calls };
}

describe('the spans action', () => {
  it('writes the three properties as integer strings on mount', () => {
    const { node, props } = fakeNode();
    spans(node, { c4: 1, r4: 0, c2: 2 });
    expect(Object.fromEntries(props)).toEqual({
      '--span4': '1',
      '--rows4': '0',
      '--span2': '2',
    });
  });

  it('rewrites them on update', () => {
    const { node, props } = fakeNode();
    const action = spans(node, { c4: 1, r4: 0, c2: 0 });
    action.update({ c4: 2, r4: 1, c2: 1 });
    expect(Object.fromEntries(props)).toEqual({
      '--span4': '2',
      '--rows4': '1',
      '--span2': '1',
    });
  });

  it('removes all three on destroy', () => {
    const { node, props, calls } = fakeNode();
    const action = spans(node, { c4: 1, r4: 0, c2: 1 });
    action.destroy();
    expect(props.size).toBe(0);
    expect(calls.filter((call) => call.startsWith('remove')).sort()).toEqual([
      'remove --rows4',
      'remove --span2',
      'remove --span4',
    ]);
  });

  it('writes whole numbers even when handed a fraction', () => {
    const { node, props } = fakeNode();
    spans(node, { c4: 1.9, r4: 0, c2: 0 });
    expect(props.get('--span4')).toBe('1');
  });
});

describe('the peakAt action', () => {
  it('writes the peak position as a plain number on mount', () => {
    const { node, props } = fakeNode();
    peakAt(node, 37.5);
    expect(Object.fromEntries(props)).toEqual({ '--peak-at': '37.5' });
  });

  it('rounds to two decimals and rewrites on update', () => {
    const { node, props } = fakeNode();
    const action = peakAt(node, 10);
    action.update(33.33333);
    expect(props.get('--peak-at')).toBe('33.33');
  });

  it('clamps to 0..100 and writes 0 for anything that is not a finite number', () => {
    for (const [given, written] of [
      [-5, '0'],
      [250, '100'],
      [Number.NaN, '0'],
      [Number.POSITIVE_INFINITY, '0'],
    ] as const) {
      const { node, props } = fakeNode();
      peakAt(node, given);
      expect(props.get('--peak-at'), `given ${given}`).toBe(written);
    }
  });

  it('removes the property on destroy', () => {
    const { node, props, calls } = fakeNode();
    peakAt(node, 50).destroy();
    expect(props.size).toBe(0);
    expect(calls).toContain('remove --peak-at');
  });
});

describe('setViewTransitionName', () => {
  it('sets the name and clears it with null', () => {
    const { node, props } = fakeNode();
    setViewTransitionName(node, 'ov-tile-logged');
    expect(props.get('view-transition-name')).toBe('ov-tile-logged');
    setViewTransitionName(node, null);
    expect(props.has('view-transition-name')).toBe(false);
  });
});

describe('the module has no other route into a style', () => {
  const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*/gm, '');

  it('assigns no whole style string and sets no style attribute', () => {
    expect(code).not.toMatch(/\.style\s*=[^=]/);
    expect(code).not.toMatch(/cssText/);
    expect(code).not.toMatch(/setAttribute\(\s*['"]style/);
  });

  it('writes no markup', () => {
    expect(code).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML/);
  });

  it('writes through the CSSOM', () => {
    expect(code).toContain('style.setProperty');
  });
});
