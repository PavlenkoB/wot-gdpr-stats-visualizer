#!/usr/bin/env node
// Stale-reference scanner and comment-only diff checker (plan 15-04).
//
//   node stale-ref-scan.mjs
//     Scan `git ls-files src tests .claude/skills` (minus images and /sources/)
//     for every `app.css` and read the 400-character window around it (200 before,
//     200 after, across line breaks). A window that mentions the layout or the phone
//     block (phone|layout|.shell|pane-list|pane-detail|480px) and does NOT also
//     mention `shell.css` is a stale pointer. Prints `file:line` for each; exit 1 if
//     any, 0 if none.
//
//   node stale-ref-scan.mjs --comment-only <base-ref> <file...>
//     For each file, strip HTML comments, block comments and whole-line `//`
//     comments from the working-tree text and from `git show <base-ref>:<file>` with
//     the same function, collapse whitespace, and exit 1 naming any file whose two
//     results differ. The same function on both sides proves no code changed, not
//     that the comments were edited well.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const TOPIC = /phone|layout|\.shell|pane-list|pane-detail|480px/i;
const IMAGE = /\.(png|jpe?g|gif|webp|svg|ico|avif|woff2?|ttf|zip|gz)$/i;

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 28 });
}

function scan() {
  const files = git(['ls-files', 'src', 'tests', '.claude/skills'])
    .split('\n')
    .filter((f) => f && !IMAGE.test(f) && !f.includes('/sources/'));
  const hits = [];
  for (const file of files) {
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    let from = 0;
    for (;;) {
      const at = text.indexOf('app.css', from);
      if (at === -1) break;
      from = at + 1;
      const window = text.slice(Math.max(0, at - 200), at + 7 + 200);
      if (TOPIC.test(window) && !window.includes('shell.css')) {
        const line = text.slice(0, at).split('\n').length;
        hits.push(`${file}:${line}`);
      }
    }
  }
  for (const h of hits) console.log(h);
  return hits.length === 0 ? 0 : 1;
}

function stripComments(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function commentOnly(base, files) {
  let bad = 0;
  for (const file of files) {
    let before;
    try {
      before = git(['show', `${base}:${file}`]);
    } catch {
      console.log(`${file}: not present at ${base}`);
      bad++;
      continue;
    }
    const after = readFileSync(file, 'utf8');
    if (stripComments(before) !== stripComments(after)) {
      console.log(`${file}: code differs from ${base} (comment-stripped text is not identical)`);
      bad++;
    }
  }
  return bad === 0 ? 0 : 1;
}

const [, , flag, ...rest] = process.argv;
if (flag === '--comment-only') {
  const [base, ...files] = rest;
  if (!base || files.length === 0) {
    console.error('usage: --comment-only <base-ref> <file...>');
    process.exit(2);
  }
  process.exit(commentOnly(base, files));
}
process.exit(scan());
