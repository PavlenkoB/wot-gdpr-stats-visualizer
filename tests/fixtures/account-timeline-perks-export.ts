// =============================================================================
// account-timeline-perks-export.ts - the composed Phase 12 archive and its
// hand-derived oracle (plan 12-13)
// =============================================================================
//
// WHAT THIS IS. ONE three-account archive that holds every Phase 12 file with
// synthetic content: the real-shape three-account export (sessions, logins,
// identities - unchanged) overlaid with the timeline fixture (plan 12-11) and the
// Perks fixture (plan 12-10), each re-rooted onto the real-shape roots by
// position (overlay root one becomes the FIRST root of the D-16 order, and so
// on), so the account tag letters A, B and C of the two source oracles are the
// tag letters the browser draws.
//
// WHAT IS ADDED ON TOP
//   - a `Game_Forums` file carrying an email and an address (an unsupported
//     category: its values must reach no storage and no page);
//   - an unlisted file in the Bans folder (a supported category, a file name no
//     pattern knows) whose header and cell carry an email;
//   - the email-shaped value in an allowlisted cell of a second row of every
//     Phase 12 file, which the two source fixtures already plant (the timeline's
//     names, services, language, bans and third parties; the Perks subscriptions,
//     coupons, bonus codes and surveys).
//
// WHAT IS DROPPED. The timeline overlay's own `Account_Info.csv`, so the base
// nicknames and the identity-header order stay authoritative.
//
// THE ORACLE. `ATP_EXPECTED` re-states the two source oracles (hand-derived
// literals there, with the derivation beside each block) in this archive's roots
// and tag letters. Nothing in it is computed by the code under test, and nothing
// hard-codes six kinds, five timeline files or four cards: both source oracles
// are limited to what PANE_MAPPING marks mapped, so a kind or card the user
// removed at the plan 12-01 completeness gate shrinks every list below by
// construction.
//
// ONE DELIBERATE DEPARTURE FROM THE PLAN TEXT. The plan plants "TEST-NET
// addresses of bans and third parties" and expects the Account timeline to mask
// them. The capture admits NO address column in the name, service, language, ban
// or third-party files (plan 12-11, rule d), so those addresses live in EXCLUDED
// columns: they are stored nowhere and drawn nowhere, masked or not. The one
// address that IS drawn is the Bonus codes `USER_IP`, in the Perks pane. The
// exports below therefore separate `shown` (allowlisted, masked until the
// reveal) from `never` (excluded, absent always).
// =============================================================================

import { unzipSync } from 'fflate';
import { CAPTURED_FILES } from './new-data-headers.ts';
import {
  MA_CANARIES,
  MA_CHAT_CANARY,
  MA_FORUM_EMAIL_CANARY,
  MA_FORUM_IP_CANARY,
  MA_ROOTS_D16_ORDER,
  buildRealShapeThreeAccountExport,
} from './multi-account-fixtures.ts';
import { buildLargeTableCsv } from './new-data-fixtures.ts';
import {
  PK_ADDRESS_CANARY,
  PK_BATTLE_CANARY,
  PK_CODE_CANARY,
  PK_EMAIL_ANSWER,
  PK_EMAIL_STATUS,
  PK_EMAIL_SUBSCRIBED,
  PK_EMAIL_USER_IP,
  PK_EXPECTED,
  PK_NICKNAME_CANARY,
  PK_PROFILE_CANARY,
  PK_ROOT_A,
  PK_ROOT_B,
  PK_ROOT_C,
  buildPerksThreeAccountExport,
  csvFor,
  pkFileKey,
  type PkCardId,
} from './perks-fixtures.ts';
import { zipSync } from './pinned-zip.ts';
import {
  TL_ADDRESS_CANARY,
  TL_DESCRIPTION_CANARY,
  TL_EMAIL_OLD_NAME,
  TL_EMAIL_OPERATION,
  TL_EMAIL_SITE,
  TL_EMAIL_STATUS,
  TL_EMAIL_UID,
  TL_EMAIL_VALUE,
  TL_EXPECTED,
  TL_REASON_CANARY,
  TL_ROOT_A,
  TL_ROOT_B,
  TL_ROOT_C,
  buildTimelineThreeAccountExport,
  tlFileKey,
} from './timeline-fixtures.ts';

// -----------------------------------------------------------------------------
// The roots and the tag letters
// -----------------------------------------------------------------------------

/** The three account roots of the archive, in D-16 order: tag letters A, B, C. */
export const ATP_ROOTS: readonly string[] = MA_ROOTS_D16_ORDER;

/** The overlay roots, in the order that decides the letters A, B, C. */
const TL_ROOTS: readonly string[] = [TL_ROOT_A, TL_ROOT_B, TL_ROOT_C];
const PK_ROOTS: readonly string[] = [PK_ROOT_A, PK_ROOT_B, PK_ROOT_C];

/** The tag letter of an overlay root: A for the first, B for the second, C for the third. */
function letterOfOverlayRoot(roots: readonly string[], root: string): string {
  const index = roots.indexOf(root);
  if (index < 0) throw new Error(`${root} is not an overlay root`);
  return String.fromCharCode(65 + index);
}

/** The tag letters of a list of overlay roots, in ascending order. */
function lettersOf(roots: readonly string[], accounts: readonly string[]): string[] {
  return accounts.map((root) => letterOfOverlayRoot(roots, root)).sort();
}

// -----------------------------------------------------------------------------
// The planted values
// -----------------------------------------------------------------------------

/** The email planted in the Game_Forums file; the same value the real-shape EU root plants. */
export const ATP_FORUM_EMAIL = MA_FORUM_EMAIL_CANARY;

/** The address planted in the Game_Forums file. TEST-NET-2 (RFC 5737). */
export const ATP_FORUM_ADDRESS = MA_FORUM_IP_CANARY;

/** The header and the cell of the unlisted Bans file: the email is in the cell. */
export const ATP_UNLISTED_HEADER = 'ATP_UNLISTED_HEADER_CANARY';
export const ATP_UNLISTED_EMAIL = 'atp-unlisted-canary@atp.example.invalid';

/** An address that is a second TEST-NET-2 value, planted in an excluded column of the services file. */
const ATP_SERVICE_ADDRESS_B = '198.51.100.78';
const ATP_SERVICE_ADDRESS_C = '198.51.100.79';

/**
 * Every planted email-shaped value across both source fixtures and this module.
 * None may reach storage, a posted view, a text node, an attribute or the title.
 */
export const ATP_CANARY_EMAILS: readonly string[] = [
  TL_EMAIL_OLD_NAME,
  TL_EMAIL_OPERATION,
  TL_EMAIL_VALUE,
  TL_EMAIL_STATUS,
  TL_EMAIL_SITE,
  TL_EMAIL_UID,
  PK_EMAIL_SUBSCRIBED,
  PK_EMAIL_STATUS,
  PK_EMAIL_USER_IP,
  PK_EMAIL_ANSWER,
  ATP_FORUM_EMAIL,
  ATP_UNLISTED_EMAIL,
  ...Object.values(MA_CANARIES).map((canary) => canary.login),
];

/**
 * The nickname-free text canaries planted in EXCLUDED columns: free text, ids and
 * the excluded subscription name. None may appear anywhere in a rendered page.
 */
export const ATP_NEVER_TEXT: readonly string[] = [
  TL_DESCRIPTION_CANARY,
  TL_REASON_CANARY,
  PK_PROFILE_CANARY,
  PK_BATTLE_CANARY,
  PK_NICKNAME_CANARY,
  PK_CODE_CANARY,
  MA_CHAT_CANARY,
];

/**
 * The addresses planted in EXCLUDED columns (the timeline files' `IP` columns, the
 * coupon `PREREQUISITE` free text, the forum file). Stored nowhere, so they are
 * absent from every rendered surface whatever the reveal says.
 */
export const ATP_NEVER_ADDRESSES: readonly string[] = [
  ...new Set([
    TL_ADDRESS_CANARY,
    PK_ADDRESS_CANARY,
    ATP_SERVICE_ADDRESS_B,
    ATP_SERVICE_ADDRESS_C,
    ATP_FORUM_ADDRESS,
  ]),
];

/**
 * The coupon codes planted in the allowlisted `CODE` column, longest-masked first.
 * Each is 8 or more characters, so each is shown as its first two characters and
 * `xxx` until the reveal. Leading zeros are the point of the first two.
 */
export const ATP_CODES: readonly string[] = ['00012345678', '00098765432'];

/** The first coupon code: the one the masked and revealed assertions name. */
export const ATP_CODE: string = ATP_CODES[0]!;

/** A bonus code planted in the allowlisted `CODE_KEY` column. */
export const ATP_BONUS_CODE = 'BONUS-0001-AAAA';

/**
 * The addresses in ALLOWLISTED address columns: the Bonus codes `USER_IP`. Masked
 * (`192.0.2.xxx`) until the single global reveal. TEST-NET-1 (RFC 5737).
 */
export const ATP_ADDRESSES: readonly string[] = ['192.0.2.50'];

// -----------------------------------------------------------------------------
// The composition
// -----------------------------------------------------------------------------

const encode = (text: string): Uint8Array => new TextEncoder().encode(text);

/** The folder and file name the capture printed for one file key. */
function locationOf(key: string): { readonly folder: string; readonly fileName: string } {
  const file = CAPTURED_FILES.find((entry) => entry.key === key);
  if (file === undefined) throw new Error(`no capture for ${key}`);
  return { folder: file.folder, fileName: file.fileName };
}

/** One overlay archive's entries, re-rooted onto the real-shape roots. */
function reroot(archive: Uint8Array, overlayRoots: readonly string[]): Record<string, Uint8Array> {
  const out: Record<string, Uint8Array> = {};
  for (const [path, bytes] of Object.entries(unzipSync(archive))) {
    const slash = path.indexOf('/');
    const root = path.slice(0, slash);
    const index = overlayRoots.indexOf(root);
    if (index < 0) throw new Error(`unexpected overlay root in ${path}`);
    const target = ATP_ROOTS[index];
    if (target === undefined) throw new Error(`no real-shape root for overlay root ${root}`);
    out[`${target}${path.slice(slash)}`] = bytes;
  }
  return out;
}

/** Every entry of the composed archive, by path. */
function composeEntries(): Record<string, Uint8Array> {
  const entries: Record<string, Uint8Array> = { ...unzipSync(buildRealShapeThreeAccountExport()) };

  const overlays = [
    reroot(buildTimelineThreeAccountExport(), TL_ROOTS),
    reroot(buildPerksThreeAccountExport(), PK_ROOTS),
  ];
  for (const overlay of overlays) {
    for (const [path, bytes] of Object.entries(overlay)) {
      // The overlay's own identity file is dropped: the base nicknames and the
      // identity-header order stay authoritative.
      if (path.endsWith('/User_Info/Account_Info.csv')) continue;
      if (path in entries) throw new Error(`overlay entry ${path} would replace a base entry`);
      entries[path] = bytes;
    }
  }

  const first = ATP_ROOTS[0]!;
  // An unsupported category: counted, never stored, never shown.
  entries[`${first}/Game_Forums/WOT_Forum_User_Info.csv`] = encode(
    `NAME;EMAIL;IP_ADDRESS\r\nforum-name;${ATP_FORUM_EMAIL};${ATP_FORUM_ADDRESS}\r\n`,
  );
  // A supported folder, a file name no pattern knows: stores nothing.
  entries[`${first}/Bans/Unlisted_Extra.csv`] = encode(
    `${ATP_UNLISTED_HEADER},EXTRA_NOTE\r\n${ATP_UNLISTED_EMAIL},unlisted\r\n`,
  );
  return entries;
}

/** The composed three-account archive. */
export function buildAccountTimelinePerksExport(): Uint8Array {
  return zipSync(composeEntries());
}

/** What a variant archive changes. */
export interface AtpVariantOptions {
  /** Folder names (for example `Personal_Coupons`) whose files are left out of every root. */
  readonly omitFolders?: readonly string[];
  /** Replace each Surveys file with one whose headers match no allowlisted column. */
  readonly driftSurveys?: boolean;
}

/** The composed archive without the named folders, or with a drifted Surveys file. */
export function buildAccountTimelinePerksVariantExport(
  options: AtpVariantOptions = {},
): Uint8Array {
  const omit = new Set(options.omitFolders ?? []);
  const surveys = options.driftSurveys === true ? locationOf(pkFileKey('surveys')) : null;
  const entries: Record<string, Uint8Array> = {};
  for (const [path, bytes] of Object.entries(composeEntries())) {
    const parts = path.split('/');
    const folder = parts[1] ?? '';
    if (omit.has(folder)) continue;
    if (surveys !== null && folder === surveys.folder && parts[2] === surveys.fileName) {
      entries[path] = encode('DRIFTED_ALPHA,DRIFTED_BETA\r\nx,y\r\nz,w\r\n');
    } else {
      entries[path] = bytes;
    }
  }
  return zipSync(entries);
}

// -----------------------------------------------------------------------------
// The large single-root archive
// -----------------------------------------------------------------------------

/** The root of the large archive. */
export const ATP_LARGE_ROOT = '650000001';

/** A stamp in the shape the capture records for the timeline dates, `minutes` after 2023-01-01. */
function stampAt(minutes: number): string {
  const d = new Date(Date.UTC(2023, 0, 1, 0, 0, 0) + minutes * 60_000);
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:00.000`;
}

/**
 * A single-root archive with an Account_Info file, a services history file of
 * `count` distinct dated rows and a Personal_Coupons file of `count` distinct
 * rows: for a `count` of 3000 the timeline holds more than 500 entries and the
 * coupon table more than 500 rows. One account, so there is no tag and no merge.
 */
export function buildLargeAccountTimelineExport(count: number): Uint8Array {
  const serviceKey = tlFileKey('service');
  const service = locationOf(serviceKey);
  const couponKey = pkFileKey('coupons');
  const coupons = locationOf(couponKey);

  const serviceRows = Array.from({ length: count }, (_, row) => ({
    CREATED_AT: stampAt(row),
    OPERATION: row % 2 === 0 ? 'LINK' : 'UNLINK',
    NAME: `service-${row + 1}`,
  }));

  return zipSync({
    [`${ATP_LARGE_ROOT}/User_Info/Account_Info.csv`]: encode(
      `ID;NAME;CREATED_AT;REGION\r\n${ATP_LARGE_ROOT};Large Synthetic Captain;2020-01-01 00:00:00;EU\r\n`,
    ),
    [`${ATP_LARGE_ROOT}/${service.folder}/${service.fileName}`]: encode(
      csvFor(serviceKey, serviceRows),
    ),
    [`${ATP_LARGE_ROOT}/${coupons.folder}/${coupons.fileName}`]: encode(
      buildLargeTableCsv(couponKey, count),
    ),
  });
}

// -----------------------------------------------------------------------------
// The oracle
// -----------------------------------------------------------------------------

/** One expected timeline entry, in this archive's tag letters. */
export interface AtpTimelineEntry {
  readonly kind: 'name' | 'service' | 'language' | 'country' | 'ban' | 'thirdParty';
  /** The export's own date text, or null for an undated entry. */
  readonly date: string | null;
  /** The part cells in order: the primary, then the secondary values shown. */
  readonly parts: readonly (string | null)[];
  /** The tag letters the entry carries, ascending. */
  readonly letters: readonly string[];
}

/** One expected card of the Perks pane, in this archive's tag letters. */
export interface AtpPerksCard {
  readonly files: number;
  readonly storedRows: number;
  readonly displayedRows: number;
  /** The tag letters of every displayed row, each ascending. */
  readonly rowLetters: readonly (readonly string[])[];
}

/** The card the omitting variant removes, and the folder it lives in. */
function omittedCardOf(cards: readonly PkCardId[]): { card: PkCardId; folder: string } {
  const pick: PkCardId | undefined =
    cards.find((card) => card === 'coupons') ?? cards.find((card) => card !== 'surveys');
  if (pick === undefined) throw new Error('no mapped Perks card other than Surveys');
  return { card: pick, folder: locationOf(pkFileKey(pick)).folder };
}

const KIND_ORDER = ['name', 'service', 'language', 'country', 'ban', 'thirdParty'] as const;

const TIMELINE_ENTRIES: readonly AtpTimelineEntry[] = TL_EXPECTED.entries.map((entry) => ({
  kind: entry.kind,
  date: entry.date,
  parts: entry.parts,
  letters: lettersOf(TL_ROOTS, entry.accounts),
}));

const KINDS_PRESENT = KIND_ORDER.filter((kind) =>
  TIMELINE_ENTRIES.some((entry) => entry.kind === kind),
);

/** The kind the chip assertions choose: Ban, or the first kind after All entries when Ban was removed. */
const FILTER_KIND = KINDS_PRESENT.includes('ban') ? 'ban' : KINDS_PRESENT[0];

const PERKS_CARDS: Readonly<Partial<Record<PkCardId, AtpPerksCard>>> = Object.fromEntries(
  PK_EXPECTED.cardsPresent.map((card) => {
    const expected = PK_EXPECTED.cards[card]!;
    return [
      card,
      {
        files: expected.files,
        storedRows: expected.storedRows,
        displayedRows: expected.displayedRows,
        rowLetters: expected.rows.map((row) => lettersOf(PK_ROOTS, row.accounts)),
      },
    ];
  }),
);

/** The large-fixture count: more than the 500-row window threshold. */
const LARGE_COUNT = 3000;

/**
 * The expected figures of the composed archive. Every list is limited to what
 * PANE_MAPPING marks mapped (see the header).
 */
export const ATP_EXPECTED = {
  /** The roots in D-16 order: tag letters A, B, C. */
  roots: ATP_ROOTS,
  timeline: {
    /** The pane fact: presence facts and STORED rows over the present files. */
    fileCount: TL_EXPECTED.pane.fileCount,
    rowCount: TL_EXPECTED.pane.rowCount,
    /** Rows removed by the merge (the merge note's k). */
    mergedAway: TL_EXPECTED.mergedAway,
    /** The ordered chronology. */
    entries: TIMELINE_ENTRIES,
    /** The kinds with at least one entry, in chip order. */
    kindsPresent: KINDS_PRESENT as readonly string[],
    /** The chip count: the kinds present plus All entries, or zero when no chip row renders. */
    chipCount: KINDS_PRESENT.length >= 2 ? KINDS_PRESENT.length + 1 : 0,
    /** The kind the filter step chooses, or undefined when none is present. */
    filterKind: FILTER_KIND as string | undefined,
    /** The past nicknames of the Name entries: page text only, never an attribute. */
    pastNames: TIMELINE_ENTRIES.filter((entry) => entry.kind === 'name').flatMap((entry) =>
      entry.parts.filter((part): part is string => part !== null),
    ),
  },
  perks: {
    fileCount: PK_EXPECTED.pane.fileCount,
    rowCount: PK_EXPECTED.pane.rowCount,
    /** The Subscriptions merge note's k (zero when that card is not mapped). */
    mergedAway: PK_EXPECTED.mergedAway,
    /** The mapped cards, in fixed card order. */
    cardsPresent: PK_EXPECTED.cardsPresent,
    cards: PERKS_CARDS,
    /** The card the omitting variant removes. */
    omittedCard: omittedCardOf(PK_EXPECTED.cardsPresent),
  },
  large: {
    count: LARGE_COUNT,
    /** One services row per timeline entry: the large archive holds a single account. */
    timelineEntries: LARGE_COUNT,
    couponRows: LARGE_COUNT,
  },
};
