// =============================================================================
// perks-fixtures.ts — the multi-account Perks archive and its hand-derived oracle
// (plan 12-10)
// =============================================================================
//
// A LEAF data module (tests/fixtures/README.md): its only imports are the pinned
// zip helper and the captured headers, never a shared archive builder, so
// `export-fixtures.ts` could import it without closing a cycle.
//
// Every row VALUE below is hand-typed and fabricated: emails use the reserved
// `.example.invalid` host, addresses sit in TEST-NET (RFC 5737), and every code is
// an invented string. Column NAMES come from the captured headers
// (`headersOf`), so the archive stays correct if a later capture renames one.
//
// Which cards exist is decided by the plan 12-01 Pane mapping: a Perks card the
// user removed at the completeness gate has a `removed` PANE_MAPPING row, writes
// NO file here, and drops out of `PK_EXPECTED` by construction. Nothing below
// assumes all four cards are mapped.
//
// The oracle holds LITERALS derived by hand from the rows, never a value computed
// by the builder under test. The derivation sits beside each block.
// =============================================================================

import { CAPTURED_FILES, PANE_MAPPING, headersOf } from './new-data-headers.ts';
import { zipSync } from './pinned-zip.ts';

/** The three account roots: numeric folder names of four or more digits. */
export const PK_ROOT_A = '630000001';
export const PK_ROOT_B = '630000002';
export const PK_ROOT_C = '630000003';

/** An email planted as the VALUE of an allowlisted cell; one per Perks file. */
export const PK_EMAIL_SUBSCRIBED = 'perks-subscribed-canary@perks.example.invalid';
export const PK_EMAIL_STATUS = 'perks-status-canary@perks.example.invalid';
export const PK_EMAIL_USER_IP = 'perks-userip-canary@perks.example.invalid';
export const PK_EMAIL_ANSWER = 'perks-answer-canary@perks.example.invalid';

/** A code-shaped string and a TEST-NET-2 address, both planted in EXCLUDED columns. */
export const PK_CODE_CANARY = 'CANARY-CODE-PQ-4411';
export const PK_ADDRESS_CANARY = '198.51.100.77';

/** A nickname-shaped string planted in an EXCLUDED column of Subscriptions. */
export const PK_NICKNAME_CANARY = 'CANARY-NICKNAME-PERKS';

/** The values of the excluded `PROFILE_ID` and `BATTLE_ID` columns. */
export const PK_PROFILE_CANARY = 'CANARY-PROFILE-PERKS-77';
export const PK_BATTLE_CANARY = 'CANARY-BATTLE-PERKS-88';

/** Every string that must appear nowhere at rest and nowhere in a posted view. */
export const PK_CANARIES: readonly string[] = [
  PK_EMAIL_SUBSCRIBED,
  PK_EMAIL_STATUS,
  PK_EMAIL_USER_IP,
  PK_EMAIL_ANSWER,
  PK_CODE_CANARY,
  PK_ADDRESS_CANARY,
  PK_NICKNAME_CANARY,
  PK_PROFILE_CANARY,
  PK_BATTLE_CANARY,
];

// -----------------------------------------------------------------------------
// The cards and their files
// -----------------------------------------------------------------------------

/** The four Perks card ids, in pane order. */
export type PkCardId = 'subscriptions' | 'coupons' | 'bonusCodes' | 'surveys';

/** The PANE_MAPPING `cardOrKind` label of each card. */
const CARD_LABELS: Readonly<Record<PkCardId, string>> = {
  subscriptions: 'Subscriptions',
  coupons: 'Personal coupons',
  bonusCodes: 'Bonus codes',
  surveys: 'Surveys',
};

const CARD_ORDER: readonly PkCardId[] = ['subscriptions', 'coupons', 'bonusCodes', 'surveys'];

/** The file key of one card, or null when the card was removed at the gate. */
function fileKeyOf(card: PkCardId): string | null {
  const row = PANE_MAPPING.find(
    (entry) => entry.pane === 'perks' && entry.cardOrKind === CARD_LABELS[card],
  );
  if (row === undefined || row.status !== 'mapped') return null;
  return row.fileKey;
}

/** The ordered ids of the cards PANE_MAPPING marks mapped. Plan 12-13 reads this. */
const CARDS_PRESENT: readonly PkCardId[] = CARD_ORDER.filter((card) => fileKeyOf(card) !== null);

/** The file key of a card that is present; a removed card has none and never gets here. */
export function pkFileKey(card: PkCardId): string {
  const key = fileKeyOf(card);
  if (key === null) throw new Error(`card ${card} is not mapped`);
  return key;
}

/** The folder and file name the capture printed for one file key. */
function locationOf(key: string): { readonly folder: string; readonly fileName: string } {
  const file = CAPTURED_FILES.find((entry) => entry.key === key);
  if (file === undefined) throw new Error(`no capture for ${key}`);
  return { folder: file.folder, fileName: file.fileName };
}

// -----------------------------------------------------------------------------
// The CSV helper
// -----------------------------------------------------------------------------

/**
 * Mix the three terminators across a file's lines, as the Phase 11 fixtures do:
 * the header ends CRLF and the body rows cycle CRLF, bare CR, LF.
 */
function withMixedTerminators(header: string, rows: readonly string[]): string {
  const terminators = ['\r\n', '\r', '\n'];
  return header + '\r\n' + rows.map((row, index) => row + terminators[index % 3]!).join('');
}

/**
 * A comma-delimited CSV in the CAPTURED header order from rows keyed by header.
 * A key a row does not give becomes an empty cell. No cell may hold a comma, a
 * quote or a line break (every value in this module is plain text).
 */
export function csvFor(key: string, rows: readonly Readonly<Record<string, string>>[]): string {
  const headers = headersOf(key)?.headers;
  if (headers === undefined) throw new Error(`no captured header for ${key}`);
  const body = rows.map((row) => headers.map((header) => row[header] ?? '').join(','));
  return withMixedTerminators(headers.join(','), body);
}

// -----------------------------------------------------------------------------
// The rows, by account
// -----------------------------------------------------------------------------

type PkRow = Readonly<Record<string, string>>;

/**
 * Subscriptions. `SUBSCRIPTION` is excluded from the spec (free text), so its
 * values here carry the nickname canary and play no part in a merge; the one
 * allowlisted column is `SUBSCRIBED`.
 *
 *   A: TRUE, FALSE          B: TRUE          C: PAUSED, <email>
 *
 * A and B hold an identical TRUE row. A also holds a FALSE row B does not. C's
 * PAUSED row differs from every other row in the one allowlisted column. C's
 * second row has an email as the value of `SUBSCRIBED`, which the email guard
 * drops, leaving a stored row with no keys.
 */
const SUBSCRIPTIONS_ROWS: Readonly<Record<string, readonly PkRow[]>> = {
  [PK_ROOT_A]: [
    { SUBSCRIPTION: `${PK_NICKNAME_CANARY}-A1`, SUBSCRIBED: 'TRUE' },
    { SUBSCRIPTION: `${PK_NICKNAME_CANARY}-A2`, SUBSCRIBED: 'FALSE' },
  ],
  [PK_ROOT_B]: [{ SUBSCRIPTION: `${PK_NICKNAME_CANARY}-B1`, SUBSCRIBED: 'TRUE' }],
  [PK_ROOT_C]: [
    { SUBSCRIPTION: `${PK_NICKNAME_CANARY}-C1`, SUBSCRIBED: 'PAUSED' },
    { SUBSCRIPTION: `${PK_NICKNAME_CANARY}-C2`, SUBSCRIBED: PK_EMAIL_SUBSCRIBED },
  ],
};

/** `PREREQUISITE` is excluded free text: it carries a code and an address canary. */
const PREREQUISITE_TEXT = `Needs ${PK_CODE_CANARY} from ${PK_ADDRESS_CANARY}`;

/**
 * Personal coupons. A and B hold an identical first row (a coupon code with
 * leading zeros). A's second row has an email as its `STATUS`, dropped by the
 * guard. These never merge: three displayed rows.
 */
const COUPON_FIRST: PkRow = {
  INSERTED_AT: '2024-03-05 20:00:00.000',
  UPDATED_AT: '2024-03-06 08:15:30.250',
  EXPIRED_AT: '2024-09-01 00:00:00.000',
  STATUS: 'ACTIVE',
  CODE: '00012345678',
  PREREQUISITE: PREREQUISITE_TEXT,
};
const COUPON_SECOND: PkRow = {
  INSERTED_AT: '2024-03-07 09:00:00.000',
  UPDATED_AT: '2024-03-07 09:00:00.000',
  EXPIRED_AT: '2024-09-02 00:00:00.000',
  STATUS: PK_EMAIL_STATUS,
  CODE: '00098765432',
  PREREQUISITE: PREREQUISITE_TEXT,
};
const COUPONS_ROWS: Readonly<Record<string, readonly PkRow[]>> = {
  [PK_ROOT_A]: [COUPON_FIRST, COUPON_SECOND],
  [PK_ROOT_B]: [COUPON_FIRST],
};

/**
 * Bonus codes. A and B hold an identical first row (a code and a TEST-NET-1
 * address). A's second row has an email as its `USER_IP`, dropped by the guard.
 * These never merge: three displayed rows.
 */
const BONUS_FIRST: PkRow = {
  CREATED_AT: '2024-04-01 12:00:00.000',
  CODE_KEY: 'BONUS-0001-AAAA',
  USER_IP: '192.0.2.50',
};
const BONUS_SECOND: PkRow = {
  CREATED_AT: '2024-04-02 13:30:00.000',
  CODE_KEY: 'BONUS-0002-BBBB',
  USER_IP: PK_EMAIL_USER_IP,
};
const BONUS_ROWS: Readonly<Record<string, readonly PkRow[]>> = {
  [PK_ROOT_A]: [BONUS_FIRST, BONUS_SECOND],
  [PK_ROOT_B]: [BONUS_FIRST],
};

/**
 * Surveys. A and B each hold a question-1001 row; B also holds a question-1002
 * row whose `PLAYER_ANSWER` is an email, dropped by the guard. `PROFILE_ID` and
 * `BATTLE_ID` are excluded and carry canaries. Never merged: three displayed rows.
 */
const SURVEYS_ROWS: Readonly<Record<string, readonly PkRow[]>> = {
  [PK_ROOT_A]: [
    {
      PROFILE_ID: PK_PROFILE_CANARY,
      BATTLE_ID: PK_BATTLE_CANARY,
      QUESTION_ID: '1001',
      PLAYER_ANSWER: '4',
      SKIPPED_BY_PLAYER: 'false',
      MESSAGE_TS: '2024-03-05 20:00:00.000',
    },
  ],
  [PK_ROOT_B]: [
    {
      PROFILE_ID: PK_PROFILE_CANARY,
      BATTLE_ID: PK_BATTLE_CANARY,
      QUESTION_ID: '1001',
      PLAYER_ANSWER: '4',
      SKIPPED_BY_PLAYER: 'false',
      MESSAGE_TS: '2024-03-05 20:00:00.000',
    },
    {
      PROFILE_ID: PK_PROFILE_CANARY,
      BATTLE_ID: PK_BATTLE_CANARY,
      QUESTION_ID: '1002',
      PLAYER_ANSWER: PK_EMAIL_ANSWER,
      SKIPPED_BY_PLAYER: 'true',
      MESSAGE_TS: '2024-03-06 21:30:00.000',
    },
  ],
};

const ROWS_BY_CARD: Readonly<Record<PkCardId, Readonly<Record<string, readonly PkRow[]>>>> = {
  subscriptions: SUBSCRIPTIONS_ROWS,
  coupons: COUPONS_ROWS,
  bonusCodes: BONUS_ROWS,
  surveys: SURVEYS_ROWS,
};

// -----------------------------------------------------------------------------
// The archive
// -----------------------------------------------------------------------------

/**
 * The three-account Perks archive: per root, the file of every card that
 * PANE_MAPPING marks mapped and that the root holds rows for. A removed card
 * writes no file for any root.
 */
export function buildPerksThreeAccountExport(): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  const encode = (text: string): Uint8Array => new TextEncoder().encode(text);
  for (const card of CARDS_PRESENT) {
    const key = pkFileKey(card);
    const { folder, fileName } = locationOf(key);
    for (const [root, rows] of Object.entries(ROWS_BY_CARD[card])) {
      entries[`${root}/${folder}/${fileName}`] = encode(csvFor(key, rows));
    }
  }
  return zipSync(entries);
}

// -----------------------------------------------------------------------------
// The oracle
// -----------------------------------------------------------------------------

/**
 * One displayed row: the accounts it carries and the allowlisted cells it shows, by header.
 *
 * `QUESTION_ID` is a text-kind cell in the spec (plan 12-08 kept it text although
 * the decision table says number: an object id must not take number formatting),
 * so it is the string '1001', not the number.
 */
export interface PkExpectedRow {
  /** Every account root the row names, sorted. A single owner has one entry. */
  readonly accounts: readonly string[];
  readonly cells: Readonly<Record<string, string | number | null>>;
}

/** What one present card must answer. */
export interface PkExpectedCard {
  /** Account files that hold the card's file: one presence fact each. */
  readonly files: number;
  /** Rows the allowlist stored, summed over accounts (an email-dropped row still counts). */
  readonly storedRows: number;
  /** Rows on screen after the merge. */
  readonly displayedRows: number;
  /** Stored rows the merge removed; only Subscriptions merges. */
  readonly mergedAway: number;
  /** The columns the card lists, in spec order. */
  readonly columns: readonly string[];
  readonly rows: readonly PkExpectedRow[];
}

/**
 * Hand-derived literals for all four cards (only the mapped ones reach
 * PK_EXPECTED).
 *
 * Subscriptions: stored A 2 + B 1 + C 2 = 5. The TRUE row of A and B is the same
 * row; the rest are distinct (FALSE, PAUSED, and the keyless row of C), so four
 * rows are displayed and one stored row was merged away.
 * Coupons: stored 2 + 1 = 3, none merged. Bonus codes: 2 + 1 = 3. Surveys: 1 + 2 = 3.
 */
const ALL_CARDS: Readonly<Record<PkCardId, PkExpectedCard>> = {
  subscriptions: {
    files: 3,
    storedRows: 5,
    displayedRows: 4,
    mergedAway: 1,
    columns: ['SUBSCRIBED'],
    rows: [
      { accounts: [PK_ROOT_A, PK_ROOT_B], cells: { SUBSCRIBED: 'TRUE' } },
      { accounts: [PK_ROOT_A], cells: { SUBSCRIBED: 'FALSE' } },
      { accounts: [PK_ROOT_C], cells: { SUBSCRIBED: 'PAUSED' } },
      { accounts: [PK_ROOT_C], cells: { SUBSCRIBED: null } },
    ],
  },
  coupons: {
    files: 2,
    storedRows: 3,
    displayedRows: 3,
    mergedAway: 0,
    columns: ['INSERTED_AT', 'UPDATED_AT', 'EXPIRED_AT', 'STATUS', 'CODE'],
    rows: [
      {
        accounts: [PK_ROOT_A],
        cells: {
          INSERTED_AT: '2024-03-05 20:00:00.000',
          STATUS: 'ACTIVE',
          CODE: '00012345678',
        },
      },
      {
        accounts: [PK_ROOT_A],
        cells: {
          INSERTED_AT: '2024-03-07 09:00:00.000',
          STATUS: null,
          CODE: '00098765432',
        },
      },
      {
        accounts: [PK_ROOT_B],
        cells: {
          INSERTED_AT: '2024-03-05 20:00:00.000',
          STATUS: 'ACTIVE',
          CODE: '00012345678',
        },
      },
    ],
  },
  bonusCodes: {
    files: 2,
    storedRows: 3,
    displayedRows: 3,
    mergedAway: 0,
    columns: ['CREATED_AT', 'CODE_KEY', 'USER_IP'],
    rows: [
      {
        accounts: [PK_ROOT_A],
        cells: {
          CREATED_AT: '2024-04-01 12:00:00.000',
          CODE_KEY: 'BONUS-0001-AAAA',
          USER_IP: '192.0.2.50',
        },
      },
      {
        accounts: [PK_ROOT_A],
        cells: {
          CREATED_AT: '2024-04-02 13:30:00.000',
          CODE_KEY: 'BONUS-0002-BBBB',
          USER_IP: null,
        },
      },
      {
        accounts: [PK_ROOT_B],
        cells: {
          CREATED_AT: '2024-04-01 12:00:00.000',
          CODE_KEY: 'BONUS-0001-AAAA',
          USER_IP: '192.0.2.50',
        },
      },
    ],
  },
  surveys: {
    files: 2,
    storedRows: 3,
    displayedRows: 3,
    mergedAway: 0,
    columns: ['QUESTION_ID', 'PLAYER_ANSWER', 'SKIPPED_BY_PLAYER', 'MESSAGE_TS'],
    rows: [
      {
        accounts: [PK_ROOT_A],
        cells: { QUESTION_ID: '1001', PLAYER_ANSWER: '4', SKIPPED_BY_PLAYER: 'false' },
      },
      {
        accounts: [PK_ROOT_B],
        cells: { QUESTION_ID: '1001', PLAYER_ANSWER: '4', SKIPPED_BY_PLAYER: 'false' },
      },
      {
        accounts: [PK_ROOT_B],
        cells: { QUESTION_ID: '1002', PLAYER_ANSWER: null, SKIPPED_BY_PLAYER: 'true' },
      },
    ],
  },
};

/** The oracle for the archive, for the cards PANE_MAPPING marks mapped only. */
export const PK_EXPECTED: {
  /** Ordered mapped card ids (plan 12-13 reads this). */
  readonly cardsPresent: readonly PkCardId[];
  readonly cards: Readonly<Partial<Record<PkCardId, PkExpectedCard>>>;
  /** The view's `mergedAway`: the Subscriptions removal count, or 0 without that card. */
  readonly mergedAway: number;
  /** The Perks pane fact: presence facts and stored rows summed over the present cards. */
  readonly pane: { readonly fileCount: number; readonly rowCount: number };
} = {
  cardsPresent: CARDS_PRESENT,
  cards: Object.fromEntries(CARDS_PRESENT.map((card) => [card, ALL_CARDS[card]])),
  mergedAway: CARDS_PRESENT.includes('subscriptions') ? ALL_CARDS.subscriptions.mergedAway : 0,
  pane: {
    fileCount: CARDS_PRESENT.reduce((sum, card) => sum + ALL_CARDS[card].files, 0),
    rowCount: CARDS_PRESENT.reduce((sum, card) => sum + ALL_CARDS[card].storedRows, 0),
  },
};
