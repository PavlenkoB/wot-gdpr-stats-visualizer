import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The Svelte components live in grouped folders under src/lib (shell, charts and
// one folder per feature). Tests that read a component by file name, or sweep
// every component, go through this helper so none of them hard-codes the
// grouping. Every component file name is unique across the groups.

const LIB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'lib');

/** Every folder under src/lib that holds `.svelte` components. */
export const COMPONENT_DIRS: readonly string[] = [
  'shell',
  'charts',
  'features/playtime',
  'features/vehicles',
  'features/finance',
  'features/logins',
  'features/device-info',
  'features/new-data',
  'features/account-timeline',
  'features/overview',
].map((dir) => path.join(LIB, dir));

/**
 * Absolute path of the component with this file name. A name that exists in no
 * group resolves under the first one, so `existsSync` on it is false.
 */
export function componentPath(filename: string): string {
  for (const dir of COMPONENT_DIRS) {
    const full = path.join(dir, filename);
    if (existsSync(full)) return full;
  }
  return path.join(COMPONENT_DIRS[0], filename);
}

/** Every `.svelte` component file name across the groups, sorted. */
export function listComponentFiles(): string[] {
  return COMPONENT_DIRS.flatMap((dir) => readdirSync(dir))
    .filter((name) => name.endsWith('.svelte'))
    .sort();
}

/**
 * The type scale, in px, every pane outside the Overview is held to.
 */
export const SCALE_PX: ReadonlySet<number> = new Set([14, 18, 26, 30]);

/**
 * The Overview pane's own type scale (13-UI-SPEC): a 12px caption, a 14px
 * label, a 32px numeral and a 56px display size. It replaces the shared scale
 * for the Overview and only the Overview.
 */
export const OVERVIEW_SCALE_PX: ReadonlySet<number> = new Set([12, 14, 32, 56]);
