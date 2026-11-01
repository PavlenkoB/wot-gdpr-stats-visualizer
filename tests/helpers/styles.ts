// =============================================================================
// The source reader: WHERE the stylesheets live, as a TEST-SIDE helper.
// =============================================================================
//
// Why this file exists:
//   The Phase 14 guards read the project's stylesheets off disk and ask
//   questions about them: which custom properties does the tree declare, is
//   this font size on the scale, does this component still carry its own copy
//   of a shared class name. Every one of those questions needs the same three
//   answers - which files exist, what is in them, and what is their repo-
//   relative name - and every reader that re-derives them is a second thing
//   that can disagree with the first.
//
// Why it is NOT in src/:
//   Nothing in the app reads its own stylesheets. The shipped bundle has no
//   business carrying a filesystem reader, and the build-time CSP forbids the
//   kind of dynamic access that would make one necessary. The module lives
//   with its only consumers.
//
// The shape of `readTokenSource`:
//   It returns the raw text of `src/styles/tokens.css`, and only that file.
//   Plan 14-02 moved every custom property of the app into the token
//   stylesheet, so the file a declaration lives in is no longer a question a
//   reader has to answer: there is one token file, and this is it. The
//   readers themselves stayed LOCATION-AGNOSTIC through the move (they ask
//   for a declaration, never for a file), which is what made the relocation a
//   pure move with no test edit.
// =============================================================================

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** The repository root, derived from this file's own location. */
export const REPO_ROOT: string = path.resolve(HERE, '..', '..');

/** The `src/` directory. */
export const SRC_DIR: string = path.join(REPO_ROOT, 'src');

/** The token file: the only file allowed to hold a literal value. */
export const TOKENS_CSS: string = path.join(SRC_DIR, 'styles', 'tokens.css');

/** The role file: the nine `.t-*` classes. */
export const TYPE_CSS: string = path.join(SRC_DIR, 'styles', 'type.css');

/** The utility file: the shared classes. */
export const UTILITIES_CSS: string = path.join(SRC_DIR, 'styles', 'utilities.css');

/** The element resets: page defaults, body, native controls, links and focus, h1/h2, p, ul. */
export const APP_CSS: string = path.join(SRC_DIR, 'app.css');

/** The shell stylesheet: the master-detail layout and the one phone block. */
export const SHELL_CSS: string = path.join(SRC_DIR, 'styles', 'shell.css');

/**
 * The repo-relative name of the file that holds the shell layout and the one
 * phone block.
 */
export function shellHomeName(): string {
  return 'src/styles/shell.css';
}

/** The raw text of the file that holds the shell layout and the phone block. */
export function readShellSource(): string {
  return readFileSync(SHELL_CSS, 'utf8');
}

/**
 * The raw text of the token source.
 *
 * One file, since plan 14-02 moved the legacy custom properties out of
 * `src/app.css`: every custom property of the app is declared in
 * `src/styles/tokens.css`.
 */
export function readTokenSource(): string {
  return readFileSync(TOKENS_CSS, 'utf8');
}

/**
 * Every file under `src/` whose extension is one of `extensions`.
 *
 * The name is repo-relative with forward slashes, whatever the platform
 * separator is, so a guard's expectation is written the same way on every
 * machine. The list is sorted by name, so a reader that walks it twice sees
 * the same order twice.
 */
export function readSrcFiles(
  extensions: readonly string[],
): readonly { name: string; source: string }[] {
  const wanted = new Set(extensions);
  const found: { name: string; source: string }[] = [];

  const walk = (dir: string): void => {
    const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (wanted.has(path.extname(entry.name))) {
        found.push({
          name: path.relative(REPO_ROOT, full).split(path.sep).join('/'),
          source: readFileSync(full, 'utf8'),
        });
      }
    }
  };

  walk(SRC_DIR);
  return found.sort((a, b) => a.name.localeCompare(b.name));
}
