import { describe, expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// =============================================================================
// Real-data leak guard.
// =============================================================================
//
// The repository is meant to be public, and the author's real Wargaming export
// (account ids, nickname, e-mail local part) must never be committed. The
// forbidden tokens are stored as SHA-256 hashes so this file does not itself
// contain them. Every word and every long number in every tracked text file
// is hashed and compared; a hit names the file, never the token.
//
// To forbid another token: `printf %s 'token' | shasum -a 256`, lower-case
// the token first when it is a word, and add the hash below.
//
// Absolute home-directory paths are rejected for the same reason: only
// `/Users/you` (the documented placeholder), `/Users/x` and `/Users/someone`
// are allowed.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const FORBIDDEN_SHA256 = new Set([
  '0c11bdf7c78dcad122a353fe77d4decf269970c2e8cb2a4b71e9245c6326f5ad', // account id
  'd6c04e4d389c7b253812faa73689813e9eff07b5f7c083be42edb85098c282d7', // account id
  'f58cae9ea649c9504c1cbbaa5e911de6e7342a4e021ad08621f03dd1df45df02', // account id
  '5feaf16c6cfecabb04b9504f7358e9f31cdb3d765b3798b01a1e0a0e115a36cc', // nickname
  '10d4c91820dfa48684c127a933ae028825d1acd98dd2f51dc035808e5b107730', // e-mail local part
]);

const SKIP = /^(pnpm-lock\.yaml|graphify-out\/|\.planning\/graphs\/)/;
const HOME_PATH = /\/Users\/(?!you\b|x\b|someone\b)[A-Za-z][\w.-]*/;
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

function trackedTextFiles(): Array<[string, string]> {
  const names = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, maxBuffer: 1 << 28 })
    .toString()
    .split('\0')
    .filter((n) => n && !SKIP.test(n));
  const out: Array<[string, string]> = [];
  for (const name of names) {
    let buf: Buffer;
    try {
      buf = readFileSync(path.join(ROOT, name));
    } catch {
      continue; // deleted in the working tree but still listed
    }
    if (buf.includes(0)) continue; // binary
    out.push([name, buf.toString('utf8')]);
  }
  return out;
}

describe('no real export data in tracked files', () => {
  const files = trackedTextFiles();

  test('no forbidden token (hashed) appears in any tracked text file', () => {
    const hits: string[] = [];
    for (const [name, text] of files) {
      for (const m of text.matchAll(/[A-Za-z0-9_]{4,}/g)) {
        const w = m[0];
        if (FORBIDDEN_SHA256.has(sha256(w.toLowerCase()))) {
          hits.push(name);
          break;
        }
      }
    }
    expect(hits).toEqual([]);
  });

  test('no absolute home-directory path other than /Users/you', () => {
    const hits = files.filter(([, text]) => HOME_PATH.test(text)).map(([name]) => name);
    expect(hits).toEqual([]);
  });
});
