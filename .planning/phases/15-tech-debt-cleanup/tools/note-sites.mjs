#!/usr/bin/env node
// =============================================================================
// note-sites.mjs - lists the rules that still hand-write the 14px / 1.4 pair.
//
// It asks the G7 function of tests/helpers/token-guards.ts (`noteRoleOffenders`)
// the same question the guard asks, over the given paths (default `src`):
//
//   node note-sites.mjs [--count] [paths...]
//
// Without --count: prints every offender, then per-file counts and a total, and
// exits 1 when any offender exists. With --count: prints the same and always
// exits 0.
//
// Paths are repo-relative in the output (forward slashes); nothing absolute is
// printed.
// =============================================================================

import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..', '..');

const { noteRoleOffenders } = await import(
  pathToFileURL(path.join(REPO, 'tests', 'helpers', 'token-guards.ts')).href
);

const argv = process.argv.slice(2);
const countOnly = argv.includes('--count');
const targets = argv.filter((arg) => !arg.startsWith('--'));
if (targets.length === 0) targets.push('src');

/** Every .svelte and .css file under a path (or the path itself). */
function walk(target) {
  const absolute = path.resolve(REPO, target);
  const stat = fs.statSync(absolute);
  if (stat.isFile()) return /\.(svelte|css)$/.test(absolute) ? [absolute] : [];
  const files = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const child = path.join(absolute, entry.name);
    if (entry.isDirectory()) files.push(...walk(path.relative(REPO, child)));
    else if (/\.(svelte|css)$/.test(entry.name)) files.push(child);
  }
  return files;
}

const files = [...new Set(targets.flatMap(walk))].sort();
const counts = new Map();
let total = 0;
for (const file of files) {
  const name = path.relative(REPO, file).split(path.sep).join('/');
  const offenders = noteRoleOffenders({ name, source: fs.readFileSync(file, 'utf8') });
  if (offenders.length === 0) continue;
  counts.set(name, offenders.length);
  total += offenders.length;
  for (const offender of offenders) console.log(offender);
}

console.log('');
for (const [name, count] of counts) console.log(`${String(count).padStart(4)}  ${name}`);
console.log(`total: ${total} in ${counts.size} file(s) (${files.length} scanned)`);

process.exit(countOnly || total === 0 ? 0 : 1);
