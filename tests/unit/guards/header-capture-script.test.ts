import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync } from '../../fixtures/pinned-zip.ts';

// =============================================================================
// Phase 11 header-capture script guard (plan 11-02 Task 1, T-11-05).
// =============================================================================
//
// WHAT THIS FILE IS
// One guard over `.planning/milestones/v1.1-phases/11-new-game-data/header_capture.py` — the
// script THE USER runs, by hand, on their own Wargaming export zip. It is the
// only thing in Phase 11 that touches real personal data (CONTEXT D-10, D-12),
// so its safety is not an assumption: this file runs it over a synthetic
// archive that plants canaries and asserts the canaries never reach stdout.
//
// WHY A TEST INSTEAD OF A REVIEW
// The script's whole contract is "print column NAMES, never cell VALUES", and a
// reviewer reading the source can only see that the regex looks right. What a
// reviewer cannot see is whether a headerless file — one whose first line is a
// data row — leaks it. That case is exactly what the research-session draft
// script got wrong (its token pattern admitted digits-only tokens, so a numeric
// first line printed verbatim), so it is the case this guard is built around:
// `WOWS_Crews.csv` here has NO header line and its first line is
// `<digits>;<email>`.
//
// The other four behaviours are the ones the user's real export depends on:
// BOM and quote stripping (the export's payments-era files are quote-all),
// bare-CR terminators (Phase 5 evidence), mixed-terminator counting, and the
// account-folder relabel that keeps real account numbers out of a committed
// file.
//
// THE FIXTURE IS SYNTHETIC, like everything else in tests/fixtures. Every canary
// is an `.example.invalid` address (RFC 6761) or a made-up digit string; no
// real value, address or account number appears here.
//
// WHY THE ARCHIVE IS WRITTEN TO DISK
// `zipfile` needs a real path, so the in-memory `zipSync` buffer is written into
// a fresh `mkdtemp` directory and removed afterwards. Nothing is written inside
// the repository, and the temp directory is per-test-run, not per-machine.

const SCRIPT_PATH = fileURLToPath(
  new URL(
    '../../../.planning/milestones/v1.1-phases/11-new-game-data/header_capture.py',
    import.meta.url,
  ),
);

// Every value the script must refuse to print. `WOT_Game_Sessions.csv` is the
// non-family control: the family filter must skip it entirely.
const EMAIL_CANARY = 'capture-canary@example.invalid';
const DIGIT_CANARY = '98765432100';

// Three numeric account roots, as the real export has. The script relabels them
// ACCT-A/B/C in sorted order and must never echo the digits.
const ROOT_A = '1000000001';
const ROOT_B = '1000000002';
const ROOT_C = '1000000003';

const encode = (text: string): Uint8Array => new TextEncoder().encode(text);

/**
 * The synthetic archive. Terminators are deliberate and mixed:
 * HEAT is CRLF with a trailing empty line, WOWS_Crews is LF, and
 * WOWP_20_Plane_Statistics is bare CR (the export's own payments-era shape).
 */
function captureArchive(): Uint8Array {
  return zipSync({
    // BOM + quote-all header, CRLF, a data row carrying both canaries, and a
    // trailing empty line that must not be counted.
    [`${ROOT_A}/Player_Statistics/HEAT_Account_Statistics.csv`]: encode(
      `\uFEFF"BATTLES_COUNT";"WINS";NAME\r\n12;5;${EMAIL_CANARY}\r\n${DIGIT_CANARY}\r\n\r\n`,
    ),
    // Headerless: the FIRST line is a data row, which is the leak case.
    [`${ROOT_B}/Player_Statistics/WOWS_Crews.csv`]: encode(
      `${DIGIT_CANARY};${EMAIL_CANARY}\n1;2\n`,
    ),
    // Bare CR terminator, no LF anywhere in the file.
    [`${ROOT_C}/Player_Statistics/WOWP_20_Plane_Statistics.csv`]: encode(
      `VEHICLE_NAME;BATTLES;WINS\rSynthPlane;3;2\rSynthPlaneTwo;1;0\r`,
    ),
    // Non-family control: the family filter must produce no group at all.
    [`${ROOT_A}/Activity_History/WOT_Game_Sessions.csv`]: encode(`STARTED_AT;FINISHED_AT\n`),
  });
}

/** `python3` availability, decided once, without a shell. */
function pythonAvailable(): boolean {
  try {
    execFileSync('python3', ['-c', 'import sys'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function runCapture(): string {
  const dir = mkdtempSync(join(tmpdir(), 'wgdpr-header-capture-'));
  try {
    const zipPath = join(dir, 'synthetic-export.zip');
    writeFileSync(zipPath, captureArchive());
    try {
      return execFileSync('python3', ['-I', SCRIPT_PATH, zipPath], { encoding: 'utf8' });
    } catch (err) {
      // python's own stderr is multi-line; folding it onto one line keeps the
      // TAP diagnostics a single scalar instead of a broken YAML block.
      const stderr = (err as { stderr?: string }).stderr ?? '';
      throw new Error(
        `header_capture.py exited non-zero: ${`${stderr} ${String(err)}`.trim()}`.replace(
          /\s+/g,
          ' ',
        ),
        { cause: err },
      );
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** The `HDR` line belonging to the group whose `FILE` line mentions `fileName`. */
function hdrLineFor(output: string, fileName: string): string | undefined {
  const lines = output.split('\n');
  const start = lines.findIndex((l) => l.startsWith('FILE ') && l.includes(fileName));
  expect(start, `no FILE line for ${fileName} in:\n${output}`).toBeGreaterThanOrEqual(0);
  // FILE, then DELIM, then HDR.
  return lines[start + 2];
}

describe('header_capture.py', () => {
  it('exists at the path the user is told to run', () => {
    expect(existsSync(SCRIPT_PATH)).toBe(true);
  });

  it.runIf(pythonAvailable())(
    'prints a FILE, DELIM and HDR group per family file and none for a non-family file',
    () => {
      const out = runCapture();
      const lines = out.split('\n').filter((l) => l !== '');

      expect(lines.filter((l) => l.startsWith('FILE '))).toHaveLength(3);
      expect(lines.filter((l) => l.startsWith('DELIM '))).toHaveLength(3);
      expect(lines.filter((l) => l.startsWith('HDR '))).toHaveLength(3);

      expect(out).not.toContain('WOT_Game_Sessions.csv');
      for (const name of [
        'HEAT_Account_Statistics.csv',
        'WOWS_Crews.csv',
        'WOWP_20_Plane_Statistics.csv',
      ]) {
        expect(out).toContain(name);
      }
    },
  );

  it.runIf(pythonAvailable())(
    'relabels numeric account folders and never echoes the account number',
    () => {
      const out = runCapture();

      expect(out).toContain('FILE ACCT-A/Player_Statistics/HEAT_Account_Statistics.csv');
      expect(out).toContain('FILE ACCT-B/Player_Statistics/WOWS_Crews.csv');
      expect(out).toContain('FILE ACCT-C/Player_Statistics/WOWP_20_Plane_Statistics.csv');

      for (const root of [ROOT_A, ROOT_B, ROOT_C]) {
        expect(out).not.toContain(root);
      }
    },
  );

  it.runIf(pythonAvailable())(
    'strips the BOM and quotes and prints header tokens pipe-joined in file order',
    () => {
      const out = runCapture();

      expect(hdrLineFor(out, 'HEAT_Account_Statistics.csv')).toBe('HDR BATTLES_COUNT|WINS|NAME');
      expect(hdrLineFor(out, 'WOWP_20_Plane_Statistics.csv')).toBe('HDR VEHICLE_NAME|BATTLES|WINS');
    },
  );

  it.runIf(pythonAvailable())('prints the delimiter on its own line', () => {
    const out = runCapture();

    expect(out).toContain('DELIM ;');
    expect(out).not.toContain('DELIM ,');
  });

  it.runIf(pythonAvailable())('suppresses a headerless first line and prints none of it', () => {
    const out = runCapture();

    expect(hdrLineFor(out, 'WOWS_Crews.csv')).toBe('HDR [suppressed]');
    expect(out).not.toContain(EMAIL_CANARY);
    expect(out).not.toContain(DIGIT_CANARY);
  });

  it.runIf(pythonAvailable())(
    'counts non-empty lines across CRLF, LF and bare CR and skips a trailing blank',
    () => {
      const out = runCapture();
      const line = (fileName: string): number => {
        const start = out
          .split('\n')
          .findIndex((l) => l.startsWith('FILE ') && l.includes(fileName));
        return Number(/nonempty_lines (\d+)/.exec(out.split('\n')[start]!)?.[1]);
      };

      // header + 2 data rows; the trailing empty line is not a record.
      expect(line('HEAT_Account_Statistics.csv')).toBe(3);
      // 2 data rows, no header line at all.
      expect(line('WOWS_Crews.csv')).toBe(2);
      // header + 2 data rows, separated by bare CR only.
      expect(line('WOWP_20_Plane_Statistics.csv')).toBe(3);
    },
  );

  it.runIf(pythonAvailable())('bounds every HDR line to 80 tokens of 64 characters', () => {
    const out = runCapture();

    for (const line of out.split('\n').filter((l) => l.startsWith('HDR '))) {
      // `[suppressed]` is the marker, not a token: a suppressed line carries none.
      if (line === 'HDR [suppressed]') continue;
      const tokens = line.slice('HDR '.length).split('|');
      expect(tokens.length).toBeLessThanOrEqual(80);
      for (const token of tokens) {
        expect(token.length).toBeLessThanOrEqual(64);
        expect(token).toMatch(/^[A-Za-z][A-Za-z0-9_]*$/);
      }
    }
  });
});
