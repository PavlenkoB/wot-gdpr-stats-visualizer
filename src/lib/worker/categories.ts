import type { CategoryStatus } from '../core/types/worker-messages.ts';

/**
 * Top-level zip folder names whose data we render in v1.
 *
 * These are the literal folder names verified in PROJECT.md's Context
 * section, with one addition since Phase 5: `Financial_data` is a REAL
 * top-level folder in Wargaming's export — its own readme describes it as
 * the deposit and withdrawal operations on virtual currencies and the
 * premium balance deltas — and Phase 5 D-01 promoted it from a
 * dashboard-section name to a supported category so those rows get parsed,
 * stored and rendered instead of parked as an unknown folder.
 *
 * `Device_info` joined the same way (quick task 261012-bog): it is a REAL
 * top-level folder holding the PC, Blitz and Assistant device lists, and it was
 * filed under "Not yet supported" until the Device info pane could read its
 * three files. Promoting it here changes the status everywhere at once: the
 * import, the cache replay (`resultFromMeta` re-derives every status from the
 * stored name, so a stale cache that stored it as unknown is repaired at read
 * time with no Dexie version bump) and the Not yet supported list.
 *
 * `Surveys` joins them for the same reason (phase 12, D-03): it is a REAL
 * top-level folder holding the survey answers, and it was filed under "Not yet
 * supported" until the Perks pane could read its file. The promotion is
 * therefore a STATUS change and nothing else — the status changes everywhere at
 * once (the import, the cache replay, which re-derives every status from the
 * stored name so a stale cache is repaired at read time, and the Not yet
 * supported list), and NO Dexie version is bumped, because a status is derived
 * from a folder NAME rather than stored in a row's shape.
 *
 * What the promotion does NOT do is store the folder's rows: a `Surveys` file
 * reaches storage ONLY through the category-scoped family rule in
 * `new-data-allowlist.ts` (`isFamilyCategory`), so a file in this folder whose
 * name the name patterns do not know, and a file with no spec, store NOTHING.
 * Promotion changes what the folder's rows may be stored AS, never whether
 * they are stored at all.
 *
 * The other five Phase 12 folders join them for that same reason (D-03,
 * 12-04): `Authorized_Third_Parties`, `Bans`, `Bonus_Codes`, `Personal_Coupons`
 * and `Subscriptions` are real top-level folders, each is in `FAMILY_CATEGORIES`
 * so every file in them fails closed until a spec names it, and none of them can
 * store anything today — their specs arrive with the panes, in plan 12-08.
 *
 * `Game_Forums` is DELIBERATELY ABSENT from this list (D-02, D-09). It is a real
 * folder and its `WOT_Forum_User_Info.csv` header carries `EMAIL`, `IP_ADDRESS`
 * and `BDAY_*`, so promoting it for an empty allowlist would store nothing AND
 * drop the folder from the "Not yet supported" footer, which is the one place
 * the user is told it is there and not shown. It stays counted-only.
 *
 * No Dexie version is bumped by any of this: a category's status is re-derived
 * from the stored folder NAME on every replay (`resultFromMeta` →
 * `classifyFolder`), so a cache written by an older build is repaired at read
 * time rather than at upgrade time.
 */
export const SUPPORTED: readonly string[] = [
  'Activity_history',
  'Player_statistics',
  'User_Info',
  'Payment_history',
  'Financial_data',
  'Device_info',
  'Surveys',
  'Authorized_Third_Parties',
  'Bans',
  'Bonus_Codes',
  'Personal_Coupons',
  'Subscriptions',
];

/**
 * Top-level zip folder names that are real Wargaming categories but
 * whose dashboards are deferred past v1.
 */
export const KNOWN_DEFERRED: readonly string[] = ['Chat_history', 'Clans'];

/**
 * Display order for status groups (supported first, then known-deferred,
 * then unknown).
 */
export const CATEGORY_STATUS_ORDER = [
  'supported',
  'known-deferred',
  'unknown',
] as const satisfies readonly CategoryStatus[];

/**
 * Classify a single top-level folder name as supported / known-deferred /
 * unknown. Comparison is case-insensitive; anything not in either list
 * returns 'unknown' (no blocklist maintained — RESEARCH Pattern 2).
 */
export function classifyFolder(name: string): CategoryStatus {
  const lower = name.toLowerCase();
  if ((SUPPORTED as readonly string[]).some((n) => n.toLowerCase() === lower)) {
    return 'supported';
  }
  if ((KNOWN_DEFERRED as readonly string[]).some((n) => n.toLowerCase() === lower)) {
    return 'known-deferred';
  }
  return 'unknown';
}
