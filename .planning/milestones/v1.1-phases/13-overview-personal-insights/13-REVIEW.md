---
phase: 13-overview-personal-insights
reviewed: 2026-10-23T15:35:00Z
depth: standard
files_reviewed: 49
files_reviewed_list:
  - eslint.config.js
  - package.json
  - scripts/vehicles/build-vehicle-table.ts
  - scripts/vehicles/lib/vehicle-table-build.ts
  - src/app.css
  - src/lib/core/types/worker-messages.ts
  - src/lib/features/overview/OverviewBars.svelte
  - src/lib/features/overview/OverviewBento.svelte
  - src/lib/features/overview/OverviewGroup.svelte
  - src/lib/features/overview/OverviewRows.svelte
  - src/lib/features/overview/OverviewTile.svelte
  - src/lib/features/overview/overview-account-stats.ts
  - src/lib/features/overview/overview-aggregate.ts
  - src/lib/features/overview/overview-columns.ts
  - src/lib/features/overview/overview-definitions.ts
  - src/lib/features/overview/overview-dom.ts
  - src/lib/features/overview/overview-format.ts
  - src/lib/features/overview/overview-grid.ts
  - src/lib/features/overview/overview-heat.ts
  - src/lib/features/overview/overview-layout.ts
  - src/lib/features/overview/overview-lookup.ts
  - src/lib/features/overview/overview-motion.ts
  - src/lib/features/overview/overview-nav.ts
  - src/lib/features/overview/overview-pins.ts
  - src/lib/features/overview/overview-records.ts
  - src/lib/features/overview/overview-shared.ts
  - src/lib/features/overview/overview-state.ts
  - src/lib/features/overview/overview-tanks.ts
  - src/lib/features/overview/overview-time.ts
  - src/lib/features/overview/overview-totals.ts
  - src/lib/features/overview/vehicle-table.ts
  - src/lib/features/playtime/playtime-aggregate.ts
  - src/lib/features/playtime/playtime-shared.ts
  - src/lib/shell/Dashboard.svelte
  - src/lib/shell/Overview.svelte
  - src/lib/shell/game-filter-state.ts
  - src/lib/ui-copy.ts
  - src/lib/worker/data-queries.ts
  - src/lib/worker/db.ts
  - src/lib/worker/ingest.worker.ts
  - tests/e2e/shell/overview-insights.spec.ts
  - tests/fixtures/overview-fixtures.ts
  - tests/helpers/overview-inputs.ts
  - tests/helpers/overview-oracle.ts
  - tests/unit/import/overview-worker.test.ts
  - tests/unit/import/data-query-worker.test.ts
  - tests/unit/overview/vehicle-table.test.ts
  - tests/unit/guards/vehicle-table-guard.test.ts
findings:
  critical: 0
  warning: 6
  info: 7
  total: 13
status: issues_found
---

# Phase 13: Code Review Report

**Reviewed:** 2026-10-23T15:35:00Z
**Depth:** standard
**Files Reviewed:** 49
**Status:** issues_found

## Summary

The phase is generally well built on the axes you flagged. I traced each of them and found them sound:

- **Privacy contract (D-18).** The `OverviewView` type has nowhere to carry a nickname, e-mail, clan, chat text or order amount. `NAME` is never named in `overview-account-stats.ts`, and the orders reducer reads only `rows.length`. Untrusted export text reaches the DOM only as Svelte text interpolation. That covers the tank name, the tag-derived fallback and the nation prefix, all clamped to 100 or 60 characters. None reaches an attribute, a style value, a storage key or an error message.
- **Prototype-pollution.** Every id-keyed structure is a `Map` or `Set`, and `tiles` is an array.
- **Per-account column resolution.** Each group resolves its own first row (CR-01) in tanks, account stats and sum-of-battle-seconds.
- **Micro-unit credits.** They cross the wire as a string and are formatted entirely in `bigint`.
- **Stale-aggregate rebuild.** A mismatched `importedAt` answers null and writes nothing.
- **Generator key handling.** The key stays in the request URL and nowhere else. The API's `error.value` is never read, and the message is redacted. The `.env.*` pattern is gitignored, and the guard test scans `src/` for the three key literals.

No blocker was found. The defects are one lost-update race in the pin handler, one persistence hole in the pin store, two figures that make a claim the data does not support (win rate and "best of N accounts"), one loose currency match, and one unbounded loop in the generator. The info items are quality debt.

## Warnings

### WR-01: Pin toggle reads stale `pins` while a view transition is pending, so rapid pins are lost

**File:** `src/lib/features/overview/OverviewBento.svelte:233-249`

**Issue:** `togglePinFor` computes `next = togglePin(pins, id)` synchronously. It assigns `pins = next` only inside the `runTransition` update callback. Whenever `document.startViewTransition` exists and reduced motion is off, that callback runs asynchronously, after the browser captures the old state. It can also be delayed by up to the 600 ms fallback.

A second pin or unpin in that window, such as a held or auto-repeating `P` or a quick click on a second star, recomputes from the old `pins`. Example: with the defaults `['logged','tank']`, pin A and then pin B before the first callback runs. The second call yields `[logged, tank, B]`, and `writePins` overwrites storage with it. A is never pinned, even though `announce` already said "Pinned A". Pressing `P` twice on the same tile yields the same `next` twice, so the unpin never happens.

**Fix:** Derive the next value from the latest state inside the update closure, and persist and announce from that value.
```ts
function togglePinFor(id: OverviewTileId, origin: 'face' | 'star'): void {
  const label = OVERVIEW_TILE_COPY[id].label;
  runTransition(
    env,
    () => {
      pins = togglePin(pins, id); // reads the latest pins at execution time
      writePins(pins);
      announce?.(
        pins.includes(id)
          ? formatPinnedAnnouncement(label, pins.length)
          : formatUnpinnedAnnouncement(label, pins.length),
      );
    },
    () => void restoreFocus(id, origin),
  );
}
```

### WR-02: Unpinning every tile is not persisted; the default pins come back on reload

**File:** `src/lib/features/overview/overview-pins.ts:107-112, 159-160` (written from `OverviewBento.svelte:243`)

**Issue:** The user can unpin the last pin. `togglePin` returns `[]` and `writePins([])` stores `"[]"`. On the next load, `parsePins([])` returns `null` (line 110), so `readPins` falls back to `DEFAULT_PINS`. The reader's explicit choice of "no pins" silently reverts to Logged in and Most-played tank. The module header says pins survive and are written only on an explicit action, but an explicit empty set can never be read back. The unit tests assert this fallback (`overview-pins.test.ts:126-130, 187`), so the behaviour is deliberate. It still makes the store lossy for a state the UI lets the user reach.

**Fix:** Separate "nothing stored or corrupt" from "stored and empty". `parsePins` should return `[]` for a valid empty array and `null` only for a non-array or all-invalid input. For example, return `normalised` when the raw input is an array of length 0, and update the two test expectations. Alternatively, disallow unpinning the last pin in the UI.

### WR-03: Win rate and "In battle" are computed over mismatched account subsets

**File:** `src/lib/features/overview/overview-totals.ts:219-244` (the same pattern is in `overview-aggregate.ts:159-171`)

**Issue:** `battles` sums every account row whose battle count is readable. `wins` separately sums only the rows whose wins cell is readable. The rate is `wins / battles`. Take two accounts: A has 600 battles and 300 wins, B has 400 battles and wins `\N` or a differently spelled header. The tile reports 300 / 1000 = 30% when the readable-data answer is 50%. The numerator and denominator come from different sets of accounts.

This is the per-account header drift the phase is built around, so it is a realistic input. `battleSecondsOf` has the same shape: it sums only the accounts that resolved the column, but the tile labels the result the lifetime "In battle" figure.

**Fix:** Compute the rate only over rows where both values are non-null.
```ts
let rateBattles = 0, rateWins = 0, haveBoth = false;
for (const row of stats.rows) {
  if (row.battles === null || row.wins === null) continue;
  rateBattles += row.battles; rateWins += row.wins; haveBoth = true;
}
const winRate = haveBoth && rateBattles >= MIN_BATTLES_PLAIN_RATE ? rateWins / rateBattles : null;
```
Apply the 30-battle guard to `rateBattles`, not to the all-account total.

### WR-04: "best of N accounts" counts every account folder, not the accounts that hold the record

**File:** `src/lib/worker/data-queries.ts:539` and `src/lib/features/overview/overview-format.ts:432` (rule text in `ui-copy.ts` `formatRecordRule`)

**Issue:** `accountCount` is `snapshot.accounts.length`, which is every account root in the dataset. That includes a Blitz-only or Warships-only folder that has no `wot_account_statistics.csv`. The record tiles then print "…, best of 2 accounts." when only one account's row was compared. The "best of N" clause claims a comparison that did not happen. The provenance line is a correct use of this number, so the fix is local to the records.

**Fix:** Carry the contributing count on the record tiles. In `recordTile` use `stats.rows.filter((r) => r[spec.valueField] !== null).length`, add `accounts: number` to the `dmg`, `xp` and `kills` ready-tile members, and pass `tile.accounts` to `formatRecordRule` in place of `ctx.accountCount`.

### WR-05: Credits pick uses a substring test for "wot", so other games' credits can win

**File:** `src/lib/features/overview/overview-totals.ts:161`

**Issue:** `(candidate.code ?? '').toLowerCase().includes('wot')` is a substring match. A code such as `ru.wotb.credits` or `ru.wotblitz.credits` also contains `wot`. The comment says "the World of Tanks one wins", but a Blitz or other `wot*` currency joins the pool and can win on operation count. The tile would then report another game's credits under "Credits earned". Separately, when a player has two WoT codes (for example two realms), only the one with the most operations is shown, not the sum, which the Finance pane shows per code.

**Fix:** Match on a dot-delimited segment instead of a substring.
```ts
const isWot = (code: string | null) => (code ?? '').toLowerCase().split('.').includes('wot');
const wot = matches.filter((c) => isWot(c.code));
```
Decide explicitly, and document, whether several WoT credit codes are summed or the dominant one wins.

### WR-06: The generator trusts the API's `page_total`, so a bad answer makes an unbounded request loop

**File:** `scripts/vehicles/build-vehicle-table.ts:182-217`

**Issue:** `pageTotal` is taken from the response's `meta.page_total` and is only clamped from below (`Math.max(1, …)`). A malformed or hostile answer, or an API bug, with a huge `page_total` makes the loop issue that many authenticated requests at 150 ms intervals. Validation, including the `MAX_ROWS` cap, runs only after the loop ends, so the fail-closed check cannot stop it. Every one of those requests carries the application key.

**Fix:** Cap the loop at what the table can hold.
```ts
const MAX_PAGES = Math.ceil(MAX_ROWS / PAGE_LIMIT) + 1; // import MAX_ROWS from the lib
pageTotal = Math.min(Math.max(1, Math.trunc(total)), MAX_PAGES);
// and throw if page_total itself exceeds MAX_PAGES
```
Also add `if (!response.ok)` handling before `response.json()` so an HTTP error page is reported by status, not by a parse error.

## Info

### IN-01: Production-dead duplicates `formatLoggedDays` and `formatLoggedHours` exist only for an e2e spec

**File:** `src/lib/ui-copy.ts:3740, 3757`

**Issue:** Both functions reimplement `formatDays` and `formatHours` from `overview-format.ts`. The only references are in `tests/e2e/shell/overview-insights.spec.ts:17-18, 101, 107`. They ship in the main bundle through `ui-copy.ts`, and two formatters for the same figure can drift.

**Fix:** Have the e2e spec import `formatDays` and `formatHours` from `overview-format.ts` with the pinned locale, and delete the two `ui-copy` functions.

### IN-02: User-facing English is hard-coded in `overview-format.ts`, outside `ui-copy.ts`

**File:** `src/lib/features/overview/overview-format.ts:208, 220, 333, 335-339, 354, 387, 393, 412`

**Issue:** `' million'`, `' billion'`, `' h · '`, the `'1 year'` / `'N years'` plural, and the "Chart: …" and "Top N tanks…" summaries are written in the formatter. Every other Overview string lives in `ui-copy.ts`, which is the project's copy home. These are untestable by the copy tests and will be missed by any copy change.

**Fix:** Move them to `ui-copy.ts` as formatter functions, as `formatLoggedRule` and the others already are.

### IN-03: Stale or misplaced comments

**File:** `src/lib/ui-copy.ts:4013`, `src/lib/features/overview/overview-lookup.ts:155-167`

**Issue:** The attribution constant is still described as "PROPOSED text: plan 13-15's blocking checkpoint confirms or replaces it". Plan 13-15 is complete, and the generated-module renderer already says the wording was approved. In `overview-lookup.ts` the JSDoc "Build a lookup over a table…" is followed by a second JSDoc for `MAX_TIER`, so the first is dangling and `createVehicleLookup` has no doc.

**Fix:** Update the attribution comment to say the text is approved. Move the "Build a lookup" block to sit directly above `createVehicleLookup`, after `MAX_TIER`.

### IN-04: The error screen marks every skeleton grid `aria-busy="true"` permanently

**File:** `src/lib/features/overview/OverviewBento.svelte:411`

**Issue:** The `{:else}` branch serves both `loading` and `error`, and passes `busy={true}` unconditionally. In the error state, nothing is loading but the grids still announce busy to assistive technology. The root `.bento` correctly computes `aria-busy` from `screen`.

**Fix:** `busy={screen === 'loading'}`.

### IN-05: A record's tank is reported as "vehicle not recorded" when the export did record it

**File:** `src/lib/features/overview/overview-records.ts:149`, `src/lib/ui-copy.ts:3826`

**Issue:** `tankName` is null both when the cell is `0` or `\N` (truly not recorded) and when the id is valid but absent from the built-in table, such as a retired tank. The second case yields "vehicle not recorded", which contradicts the user's own file. The comments acknowledge the conflation.

**Fix:** Carry a distinct state, for example a tank id with an unresolved name, and word it "tank not in the built-in table". The tile type has room for a boolean without carrying any cell text.

### IN-06: `readApplicationId` handling of `.env.local` is looser than dotenv

**File:** `scripts/vehicles/lib/vehicle-table-build.ts:417-426`

**Issue:** An unquoted value with an inline comment (`WG_APPLICATION_ID=abc # note`) is returned as `abc # note` and sent as the key. The first assignment wins, where dotenv takes the last. The failure mode is a rejected request rather than a leak, since the redaction uses the same string, but it is a confusing error.

**Fix:** Strip an unquoted trailing ` #…`, and take the last match.

### IN-07: `forbiddenNameCharacter` leaves Unicode format and bidi controls through into committed source

**File:** `scripts/vehicles/lib/vehicle-table-build.ts:122-128`

**Issue:** The check rejects only code units below 0x20, 0x7F, `<` and `>`. C1 controls (0x80-0x9F), bidi overrides (U+202A-202E, U+2066-2069), zero-width characters and U+2028/2029 are accepted. The names are rendered as text, so this is not injection. It is a spoofing and invisible-text gap in a validator that claims to fail closed on API-supplied text.

**Fix:** Also reject the C1 controls (U+0080 to U+009F), the zero-width and directional marks (U+200B to U+200F), the line and paragraph separators and bidi embeddings and overrides (U+2028 to U+202E), the bidi isolates (U+2066 to U+2069) and U+FEFF, in both `rowFromEntry` and `validateRows`.

---

_Reviewed: 2026-10-23T15:35:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
