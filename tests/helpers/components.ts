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
 * The type scale, in px, EVERY pane is held to (Phase 14, plan 14-04, D-03
 * and D-06).
 *
 * One scale for the whole app (D-06): the Overview's 12 / 14 / 32 / 56px and the
 * shell's 14 / 18 / 26px are ONE set, and the per-folder exemption that kept
 * the Overview apart is gone (plan 14-21 deleted the Overview-only constant).
 *
 * The 30px size is GONE. The last two numerals that declared it took the
 * Display role (26px) in plans 14-10 and 14-11, so nothing in the app renders
 * at 30px any more and this set is exactly the six sizes of D-06.
 */
export const SCALE_PX: ReadonlySet<number> = new Set([12, 14, 18, 26, 32, 56]);
