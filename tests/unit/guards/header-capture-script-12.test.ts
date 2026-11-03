import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync } from '../../fixtures/pinned-zip.ts';

// =============================================================================
// Phase 12 header-capture script guard (plan 12-01 Task 1, T-12-01).
// =============================================================================
//
// WHAT THIS FILE IS
// One guard over `.planning/milestones/v1.1-phases/12-account-timeline-perks/header_capture_12.py`
// — the script THE USER runs, by hand, on their own Wargaming export zip. It is
// the only thing in Phase 12 that touches real personal data (CONTEXT D-04), so
// its safety is not an assumption: this file runs it over a synthetic archive
// that plants canaries and asserts the canaries never reach stdout.
//
// WHY IT IS NOT THE PHASE 11 GUARD AGAIN
// Phase 11 scoped by FILE NAME and one rule (identifier-only tokens) was enough,
// because a headerless Phase 11 file began with digits — which the rule already
// rejected. Phase 12 contains two headerless one-column files whose only cell is
// exactly what must never be printed: a coupon code (`AB7KQX42`) and a bonus
// code. Both are identifier-like, so the Phase 11 rule alone would print them
// verbatim. That is the whole reason for the code-shape guard (T-12-01).
//
// The second Phase 12 difference is SCOPE: scope by FOLDER, because the file
// names inside Bans / Authorized_Third_Parties / Personal_Coupons /
// Bonus_Codes are unknown. That scope must also be proven to EXCLUDE, so this
// archive plants an Account_Info.csv (header carries LOGIN) and a Game_Forums
// file (D-02: nothing from that folder is ever stored; its header carries
// EMAIL and IP_ADDRESS) and asserts neither name appears in the output.
//
// THE FIXTURE IS SYNTHETIC, like everything else in tests/fixtures. Every canary
// is an `.example.invalid` address (RFC 6761), a made-up digit string or a made-
// up mixed code; no real value, address, code or account number appears here.
//
// WHY THE ARCHIVE IS WRITTEN TO DISK
// `zipfile` needs a real path, so the in-memory `zipSync` buffer is written into
// a fresh `mkdtemp` directory and removed afterwards. Nothing is written inside
// the repository, and the temp directory is per-test-run, not per-machine.

const SCRIPT_PATH = fileURLToPath(
  new URL(
    '../../../.planning/milestones/v1.1-phases/12-account-timeline-perks/header_capture_12.py',
    import.meta.url,
  ),
);

// Every value the script must refuse to print.
const EMAIL_CANARY = 'capture-canary@example.invalid';
const DIGIT_CANARY = '98765432100';
// Identifier-like (letter-led, no dot, no at-sign, no space) — the Phase 11 rule
// ALONE would print this, which is precisely why the code-shape guard exists.
const CODE_CANARY = 'AB7KQX42';

// Three numeric account roots, as the real export has. The script relabels them
// ACCT-A/B/C in sorted order and must never echo the digits.
const ROOT_A = '1000000001';
const ROOT_B = '1000000002';
const ROOT_C = '1000000003';

const encode = (text: string): Uint8Array => new TextEncoder().encode(text);

// The byte-order mark the export writes at the head of some files. Written as a
// code point rather than as a literal U+FEFF so ESLint's no-irregular-whitespace
// rule does not flag an invisible character inside a template literal.
const BOM = String.fromCharCode(0xfeff);

/**
 * The synthetic archive. Terminators are deliberate and mixed: Subscriptions is
 * CRLF with a trailing empty line, Authorized_Third_Parties is BOM + quote-all
 * + LF, HEAT_Surveys is bare CR (the export's own payments-era shape).
 *
 * Scope is exercised in both directions. IN scope: every `.csv` of the six
 * promoted folders plus the three named history files and one history-named
 * extra in `user_info`. OUT of scope: `Account_Info.csv`, a `Game_Forums` file,
 * and a `Payment_History` FOLDER (whose name contains the word "history" but
 * is a second path segment, not a file inside `user_info`).
 */
function captureArchive(): Uint8Array {
  return zipSync({
    // Promoted folder, real header, CRLF, two data rows carrying both the email
    // and the digit canary, and a trailing empty line that must not be counted.
    [`${ROOT_A}/Subscriptions/Subscriptions.csv`]: encode(
      `SUBSCRIPTION_NAME;START_DATE;END_DATE\r\nSynthSub;01.01.2024 10:00;01.02.2024 10:00\r\n${DIGIT_CANARY};${EMAIL_CANARY};x\r\n\r\n`,
    ),
    // Promoted folder whose header names an address column (column NAME is fine;
    // its VALUES are the concern, and no value may ever be printed).
    [`${ROOT_A}/Bans/Bans.csv`]: encode(
      `REASON;START_DATE;END_DATE;IP_ADDRESS\nSynthReason;01.01.2024;05.01.2024;192.0.2.10\n`,
    ),
    // BOM + quote-all header, LF.
    [`${ROOT_A}/Authorized_Third_Parties/Third_Parties.csv`]: encode(
      `${BOM}"SERVICE_NAME";"LINKED_AT";"STATUS"\nSynthService;01.01.2024 10:00;active\n`,
    ),
    // The three named history files.
    [`${ROOT_A}/User_Info/Account_Name_History.csv`]: encode(
      `CHANGE_DATE;OLD_NAME;NEW_NAME\n01.01.2024 10:00;SynthOld;SynthNew\n`,
    ),
    [`${ROOT_A}/User_Info/External_Services_History.csv`]: encode(
      `CHANGE_DATE;SERVICE_NAME;ACTION\n01.01.2024 10:00;SynthService;signed-in\n`,
    ),
    [`${ROOT_A}/User_Info/Language_And_Country_History.csv`]: encode(
      `CHANGE_DATE;LANGUAGE;COUNTRY\n01.01.2024 10:00;en;pl\n`,
    ),
    // In scope ONLY because its name contains the word "history" — the same rule
    // that would have admitted it also has to be proven folder-scoped, which is
    // why `Payment_History/` below stays out.
    [`${ROOT_B}/User_Info/Purchase_History.csv`]: encode(
      `PURCHASE_DATE;ITEM_NAME\n01.01.2024 10:00;SynthItem\n`,
    ),
    // NEVER IN SCOPE (D-02 / the LOGIN and BIRTH_DATE columns): not even the
    // FILE line may be printed.
    [`${ROOT_A}/User_Info/Account_Info.csv`]: encode(
      `LOGIN;BIRTH_DATE\n${EMAIL_CANARY};01.01.1990\n`,
    ),
    [`${ROOT_A}/Game_Forums/Forums.csv`]: encode(
      `EMAIL;IP_ADDRESS;MESSAGE_TEXT\n${EMAIL_CANARY};192.0.2.11;${EMAIL_CANARY}\n`,
    ),
    // A FOLDER named Payment_History: the word "history" is in a path segment
    // the folder scope never consults, so nothing is printed for it.
    [`${ROOT_A}/Payment_History/Payments.csv`]: encode(
      `PAYMENT_DATE;AMOUNT\n01.01.2024 10:00;500\n`,
    ),
    // Headerless ONE-COLUMN file whose only cell is code-shaped. Identifier-like,
    // so only the code-shape / single-token guard can save this one.
    [`${ROOT_B}/Personal_Coupons/Personal_Coupons.csv`]: encode(`${CODE_CANARY}\n`),
    // Headerless file whose first line is digits, a comma and an email: caught by
    // the identifier-only rule alone, kept because the export mixes shapes.
    [`${ROOT_C}/Bonus_Codes/Bonus_Codes.csv`]: encode(`${DIGIT_CANARY},${EMAIL_CANARY}\n1,2\n`),
    // Bare CR terminator, no LF anywhere in the file.
    [`${ROOT_C}/Surveys/HEAT_Surveys.csv`]: encode(
      `SURVEY_ID;QUESTION_ID;ANSWER_ID\rSynth1;Synth2;Synth3\rSynth4;Synth5;Synth6\r`,
    ),
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
  const dir = mkdtempSync(join(tmpdir(), 'wgdpr-header-capture-12-'));
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
        `header_capture_12.py exited non-zero: ${`${stderr} ${String(err)}`.trim()}`.replace(
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

/** The `FILE` line's `nonempty_lines` count for the group mentioning `fileName`. */
function nonEmptyLinesFor(output: string, fileName: string): number {
  const line = output.split('\n').find((l) => l.startsWith('FILE ') && l.includes(fileName));
  return Number(/nonempty_lines (\d+)/.exec(line ?? '')?.[1]);
}

describe('header_capture_12.py', () => {
  it('exists at the path the user is told to run', () => {
    expect(existsSync(SCRIPT_PATH)).toBe(true);
  });

  it.runIf(pythonAvailable())(
    'scopes by folder: every .csv of the six promoted folders, nothing else',
    () => {
      const out = runCapture();
      const lines = out.split('\n').filter((l) => l !== '');

      // 6 promoted-folder files + 3 named history files + 1 extra history-named
      // user_info file = 10 in scope, and nothing outside them.
      expect(lines.filter((l) => l.startsWith('FILE '))).toHaveLength(10);
      expect(lines.filter((l) => l.startsWith('DELIM '))).toHaveLength(10);
      expect(lines.filter((l) => l.startsWith('HDR '))).toHaveLength(10);

      for (const name of [
        'Subscriptions.csv',
        'Bans.csv',
        'Third_Parties.csv',
        'Personal_Coupons.csv',
        'Bonus_Codes.csv',
        'HEAT_Surveys.csv',
      ]) {
        expect(out).toContain(name);
      }
    },
  );

  it.runIf(pythonAvailable())(
    'prints the three history files and a history-named extra, but never Account_Info or Game_Forums',
    () => {
      const out = runCapture();

      expect(out).toContain('ACCT-A/User_Info/Account_Name_History.csv');
      expect(out).toContain('ACCT-A/User_Info/External_Services_History.csv');
      expect(out).toContain('ACCT-A/User_Info/Language_And_Country_History.csv');
      // In scope only because its name contains "history".
      expect(out).toContain('ACCT-B/User_Info/Purchase_History.csv');

      expect(out).not.toContain('Account_Info');
      expect(out).not.toContain('LOGIN');
      expect(out).not.toContain('Game_Forums');
      // A FOLDER named Payment_History is not the same thing as a file inside
      // user_info whose name contains "history".
      expect(out).not.toContain('Payment_History');
      expect(out).not.toContain('Payments.csv');
    },
  );

  it.runIf(pythonAvailable())(
    'never prints a cell: no code, no email, no digit run, no account number',
    () => {
      const out = runCapture();

      for (const canary of [EMAIL_CANARY, DIGIT_CANARY, CODE_CANARY, ROOT_A, ROOT_B, ROOT_C]) {
        expect(out).not.toContain(canary);
      }

      // The two markers that prove the suppression path ran at all.
      expect(out).toContain('[suppressed]');
      expect(out).toContain('ACCT-A');
    },
  );

  it.runIf(pythonAvailable())(
    'suppresses a headerless one-column file whose only cell is a coupon code',
    () => {
      const out = runCapture();

      // Identifier-like: the Phase 11 rule alone would have printed it.
      expect(hdrLineFor(out, 'Personal_Coupons.csv')).toBe('HDR [suppressed]');
      expect(out).not.toContain(CODE_CANARY);
      expect(out).toContain('DELIM [none]');
    },
  );

  it.runIf(pythonAvailable())(
    'suppresses a headerless bonus file whose first line is digits, comma and an email',
    () => {
      const out = runCapture();

      expect(hdrLineFor(out, 'Bonus_Codes.csv')).toBe('HDR [suppressed]');
      expect(out).not.toContain(EMAIL_CANARY);
      expect(out).not.toContain(DIGIT_CANARY);
    },
  );

  it.runIf(pythonAvailable())(
    'strips the BOM and quotes and prints header tokens pipe-joined in file order',
    () => {
      const out = runCapture();

      expect(hdrLineFor(out, 'Third_Parties.csv')).toBe('HDR SERVICE_NAME|LINKED_AT|STATUS');
      expect(hdrLineFor(out, 'Subscriptions.csv')).toBe(
        'HDR SUBSCRIPTION_NAME|START_DATE|END_DATE',
      );
      expect(hdrLineFor(out, 'Bans.csv')).toBe('HDR REASON|START_DATE|END_DATE|IP_ADDRESS');
      expect(hdrLineFor(out, 'Account_Name_History.csv')).toBe('HDR CHANGE_DATE|OLD_NAME|NEW_NAME');
      expect(hdrLineFor(out, 'HEAT_Surveys.csv')).toBe('HDR SURVEY_ID|QUESTION_ID|ANSWER_ID');
    },
  );

  it.runIf(pythonAvailable())('prints the delimiter on its own line', () => {
    const out = runCapture();

    expect(out).toContain('DELIM ;');
    expect(out).toContain('DELIM ,');
  });

  it.runIf(pythonAvailable())(
    'relabels numeric account folders and never echoes the account number',
    () => {
      const out = runCapture();

      expect(out).toContain('FILE ACCT-A/Subscriptions/Subscriptions.csv');
      expect(out).toContain('FILE ACCT-B/Personal_Coupons/Personal_Coupons.csv');
      expect(out).toContain('FILE ACCT-C/Surveys/HEAT_Surveys.csv');
    },
  );

  it.runIf(pythonAvailable())(
    'counts non-empty lines across CRLF, LF and bare CR and skips a trailing blank',
    () => {
      const out = runCapture();

      // header + 2 data rows; the trailing empty line is not a record.
      expect(nonEmptyLinesFor(out, 'Subscriptions.csv')).toBe(3);
      // 2 data rows, no header line at all.
      expect(nonEmptyLinesFor(out, 'Bonus_Codes.csv')).toBe(2);
      // header + 2 data rows, separated by bare CR only.
      expect(nonEmptyLinesFor(out, 'HEAT_Surveys.csv')).toBe(3);
      // one cell, one line, no header.
      expect(nonEmptyLinesFor(out, 'Personal_Coupons.csv')).toBe(1);
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
