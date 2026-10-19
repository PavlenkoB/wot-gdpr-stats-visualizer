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
