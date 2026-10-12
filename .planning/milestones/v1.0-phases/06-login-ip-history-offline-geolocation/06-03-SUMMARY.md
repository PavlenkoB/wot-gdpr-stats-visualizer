---
phase: 06-login-ip-history-offline-geolocation
plan: 03
subsystem: aggregation
tags: [ipv6, ip-parsing, aggregation, canonicalisation, masking, oracle, seeded-fixture, offline-geolocation]

requires:
  - phase: 06
    plan: 01
    provides: "strict IPv4 parseIp/maskIp with the 06-01 insertion point, buildLogins with an injected lookup, LoginAggregates/LoginAddress, the CountryLookup null seam"
  - phase: 04
    provides: "parseSessionTimestamp's two shapes and its range checks, the oracle header contract in tests/helpers/session-oracle.ts"
  - phase: 03
    provides: "D-21 (no dataset text on screen), D-10 (an empty state names its reason)"

provides:
  - "src/lib/geo/ip.ts — full IPv4 AND IPv6 parse with the canonical form as the grouping key, compareIp (IPv4 before IPv6, then bytes), mappedIpv4, and a mask over both families"
  - "MAX_LOGIN_IPS = 20,000 with the recorded checkpoint outcome (option-a) written on the constant"
  - "AccountRecord and MAX_ACCOUNT_TEXT_LENGTH in login-shared.ts; LoginsViewData.account is no longer `null`"
  - "buildLogins(sources, lookup, account?) — cap applied to the RANKED list, the lookup run once over EVERY distinct address, and the numeric tie order"
  - "tests/fixtures/logins-fixtures.ts — a seeded 12,000-row export over four files and 900 documentation addresses, plus a 20,500-distinct-address over-cap generator"
  - "tests/helpers/login-oracle.ts — an independent recomputation that imports nothing from src/"
affects: [06-04, 06-05, 06-06, 06-08, 06-09, 06-10, 06-12, 06-14]

actuals:
  tokens: 31491
  tasks: 2
  commits: 2
commits: 2
plan_head_before: b06f04cc3b36486ab5c9c809ae755572470b77d7
plan_head_after: add64c95d9809f7b7e6569723cbad2364b244e81

tech-stack:
  added: []
  patterns:
    - "A grouping key is a CANONICAL form the module defines and nothing else produces — eight lower-case unpadded IPv6 groups, so two legal spellings of one address are one row and one table entry"
    - "The IPv6 grammar is a single left-to-right scan over ONE `::` (a second occurrence is refused, which is also how `:::` and `::::` are caught), because every regex that accepts a run needs the alternation that backtracks"
    - "A cap bounds the STORED record, not the truth: the addresses past it are resolved exactly once like every other address, so `sum(countries[].logins) + unknown.logins === totalLogins` holds at any size"
    - "An oracle is only useful while it can DISAGREE, so its group key is READ from the fixture's recorded intended spelling instead of re-derived — the one decision that matters most is supplied, not reproduced"

key-files:
  created:
    - "tests/helpers/login-oracle.ts"
    - "tests/unit/logins/login-fixtures.test.ts"
  modified:
    - "src/lib/geo/ip.ts"
    - "src/lib/features/logins/login-shared.ts"
    - "src/lib/features/logins/login-aggregate.ts"
    - "tests/fixtures/logins-fixtures.ts"
    - "tests/unit/geo/ip.test.ts"
    - "tests/unit/logins/login-aggregate.test.ts"

key-decisions:
  - "CHECKPOINT ANSWER — option-a: the logins of addresses beyond MAX_LOGIN_IPS DO reach the country figures, the tiles and the map. The UI-SPEC's unresolved row asks whether the capped logins reach the country figures; option-b would have made the drawn countries, the not-drawn countries and the unknown row sum to LESS than the tile total, which is the invariant the spec requires. Recorded on MAX_LOGIN_IPS, restated in the login-aggregate header, and pinned by the arithmetic assertions in login-aggregate.test.ts."
  - "The tie order is NUMERIC (every IPv4 before every IPv6, then byte-wise), not a comparison of the canonical strings — `9.0.0.0` sorts before `10.0.0.0` by value and after it as text, and `::1` sorts after every IPv4 address rather than wherever the digits fall."
  - "An IPv4-mapped address keeps its 16-byte identity at parse time. Grouping is a question about what the export wrote; `::ffff:192.0.2.1` is not the row `192.0.2.1`, so the unwrapping is a separate exported function (`mappedIpv4`) that the country LOOKUP asks at a different time."
  - "`maskIp` re-parses its input and refuses anything that is not already CANONICAL, so a non-canonical IPv6 spelling masks to the fixed text `xxx` rather than to a mask guessed from a compressed string. The caller is handed the stored canonical and nothing else ever reaches it."
  - "The oracle imports NOTHING, not even `MAX_LOGIN_IPS` — the cap and the country assignment are PARAMETERS, so a wrong constant in src/ cannot hide in both halves of the comparison at once."

requirements-completed: []
requirements-progress: "The plan's frontmatter names ACTIVITY-05 and ACTIVITY-06; NEITHER is complete. 06-03 finishes the PURE DATA half both of them read: the full IP module and the complete aggregation semantics, now bounded, ordered and cross-checked against an independent oracle at 12,000 and 20,501 rows. ACTIVITY-05 still needs the masked table with its reveal toggle (06-08/06-09/06-10) and ACTIVITY-06 still needs a real country table and a world map (06-06/06-07). Marking either here would be a claim the plan's own scope excludes."

coverage:
  - id: D1
    description: "IPv4, IPv6 and IPv4-mapped text group into ONE canonical address, mask per D-06, and are ordered IPv4-before-IPv6 then by bytes."
    requirement: ACTIVITY-05
    verification:
      - kind: unit
        ref: "tests/unit/geo/ip.test.ts#06-03: parseIp accepts RFC 4291 IPv6 text (D-05)"
        status: pass
      - kind: unit
        ref: "tests/unit/geo/ip.test.ts#06-03: compareIp orders IPv4 before IPv6, then by bytes (D-05)"
        status: pass
      - kind: unit
        ref: "tests/unit/geo/ip.test.ts#06-03: maskIp hides the low 80 bits of an IPv6 address (D-06)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A hostile cell is refused without throwing, in time, and never echoed: a 100 KB run of colons answers null inside 200 ms and a seeded 10,000-case fuzz never throws."
    requirement: ACTIVITY-05
    verification:
      - kind: unit
        ref: "tests/unit/geo/ip.test.ts#06-03: parseIp NEVER throws and answers a hostile cell in time (T-06-12)"
        status: pass
      - kind: unit
        ref: "tests/unit/logins/login-aggregate.test.ts#06-03: never throws on any cell, whatever the file holds (T-06-12)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The aggregation is complete, bounded and ordered: the cap is the production constant exercised by a 20,500-address archive, the tie order is numeric and identical on every rebuild, and the three relationships the UI depends on hold."
    requirement: ACTIVITY-05
    verification:
      - kind: unit
        ref: "tests/unit/logins/login-aggregate.test.ts#06-03: the cap is the PRODUCTION constant, exercised by a real archive"
        status: pass
      - kind: unit
        ref: "tests/unit/logins/login-aggregate.test.ts#06-03: the seeded 12,000-row export agrees with the independent oracle (D-17)"
        status: pass
    human_judgment: false
  - id: D4
    description: "An oracle that shares no code with the aggregator agrees with it field for field on both fixtures, and imports nothing from src/."
    requirement: ACTIVITY-05
    verification:
      - kind: unit
        ref: "tests/unit/logins/login-aggregate.test.ts#06-03: agrees with the independent oracle on the over-cap fixture"
        status: pass
    human_judgment: false
  - id: D5
    description: "The fixture is itself proven: 10,000-plus rows, every address inside the four documentation ranges, every non-canonical spelling parsing back to the address it claims, and the zip carrying the four generated files and no other session file."
    requirement: ACTIVITY-05
    verification:
      - kind: unit
        ref: "tests/unit/logins/login-fixtures.test.ts"
        status: pass
    human_judgment: false
  - id: D6
    description: "The account record is stored unchanged and never counted, and a blank cell and an unreadable one stay two different facts."
    requirement: ACTIVITY-05
    verification:
      - kind: unit
        ref: "tests/unit/logins/login-aggregate.test.ts#06-03: the account record is stored and NEVER counted (D-02)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Mixed date formats in one export read alike, a row with an unreadable stamp still counts as a login and is excluded from first and last, and every address resolves exactly once."
    requirement: ACTIVITY-06
    verification:
      - kind: unit
        ref: "tests/unit/logins/login-aggregate.test.ts#06-03: mixed and unreadable timestamps across one export (D-03)"
        status: pass
      - kind: unit
        ref: "tests/unit/logins/login-aggregate.test.ts#resolves each distinct address EXACTLY once, listed or not (D-12)"
        status: pass
    human_judgment: false

# Metrics
duration: 14min
completed: 2026-10-03
status: complete
---

# Phase 6 Plan 03: The pure half — the full IP module, the cap, the tallies, and an oracle

**One IPv6 address now travels from a raw CSV cell to a masked table row through the production parser, and the whole aggregation is bounded, numerically ordered and cross-checked field for field against an oracle that shares none of its code — on a seeded 12,000-row export and on a 20,500-address archive that exercises the real 20,000 cap.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-10-03T14:44:56Z
- **Completed:** 2026-10-03T14:58:51Z
- **Tasks:** 2 (Task 1 was a checkpoint; see the decision below)
- **Files modified:** 8

## Accomplishments

- **`ip.ts` reads IPv6, and the grouping key is a canonical form.** `2001:DB8::1`, `2001:db8:0:0:0:0:0:1` and `2001:0db8:0000:…:0001` are one row and one table entry. The canonical form is eight lower-case unpadded groups, and a dotted tail is expanded into its two hex groups (`::ffff:192.0.2.1` → `0:0:0:0:0:ffff:c000:201`).
- **The IPv6 grammar is a single left-to-right scan, not a regex.** `::` is a run, not a token, so every pattern that accepts it needs an alternation over "at least one group" and "no group" — the exact shape that backtracks. The parser locates the one `::`, refuses a second (which is also how `:::`, `::::` and `1::2::3` are caught before either side is read), settles the group count, and reads each group with a fixed-width anchored pattern. A 100 KB run of colons answers `null` in well under 200 ms.
- **The tie order is numeric.** `compareIp` puts every IPv4 before every IPv6 and then compares octets, replacing the code-unit comparison of the canonical string. `9.0.0.0` now sorts before `10.0.0.0` (it sorted after it as text), and `::1` sorts after every IPv4 address rather than wherever its digits fall.
- **The cap bounds the stored record, not the truth.** `MAX_LOGIN_IPS = 20,000`, applied to the RANKED list so the cut is the same cut the table shows. The addresses past it are resolved exactly once like every other address, so the country figures, the unknown bucket and `totalLogins` all carry them.
- **The oracle cannot be satisfied by a matching mistake.** It has its own character-at-a-time CSV splitter (PapaParse would not survive the quoted files), its own timestamp validation by `Date` round-trip (the aggregator uses explicit integer range checks), and its own address comparator (splitting the canonical text, not walking octets) — and its group key is READ from the fixture's recorded intended spelling, so canonicalisation is supplied rather than reproduced.

## The cap checkpoint, in full (option-a)

The UI-SPEC's one unresolved row asked whether the logins of addresses beyond the listed cap reach the country figures and the map. **They do.**

The reason is arithmetic rather than taste. The UI-SPEC requires the drawn countries, the not-drawn countries and the unknown-country row to **sum to the tile total**. That sum only holds when the capped logins are tallied. Option-b would make the map and the "Top country" tile quietly undercount for a large export, and the total on the tile and the sum on the map would disagree with nothing to explain why.

The consequence under option-a is that the listed rows sum to LESS than the stated total for an export over the cap — which is precisely what the cap line the UI-SPEC already requires says in words: *"{m} more IP addresses ({k} logins) are counted in the totals but not listed in the table."*

Three relationships therefore hold at every size, and all three are asserted:

```
totalLogins                          = counted login ROWS, unreadable excluded
sum(countries[].logins) + unknown.logins  = totalLogins
sum(addresses[].logins) + other.logins    = totalLogins
```

The cap bounds **memory**, not the truth. A country tally has at most ~250 entries, so keeping the capped logins in the country figures costs nothing.

Recorded on the `MAX_LOGIN_IPS` doc comment, restated in the `login-aggregate.ts` header, and pinned by the arithmetic assertions in `login-aggregate.test.ts`.

## Task Commits

Each task was committed atomically:

1. **Task 2: Tracer — one IPv6 address through parse, canonical grouping, aggregation and mask** — `814a431` (feat)
2. **Task 3: Aggregation semantics, the seeded 10k fixture and the independent oracle** — `add64c9` (feat)

## Files Created/Modified

- `src/lib/geo/ip.ts` — IPv4 and IPv6 parse, canonicalise, order, mask and unwrap; no imports, never throws, never echoes
- `src/lib/features/logins/login-shared.ts` — `MAX_LOGIN_IPS` with the checkpoint outcome on it, `AccountRecord`, `MAX_ACCOUNT_TEXT_LENGTH`
- `src/lib/features/logins/login-aggregate.ts` — the cap, the ranked numeric order, the account parameter, the lookup over every distinct address
- `tests/fixtures/logins-fixtures.ts` — the seeded 12,000-row spec, the over-cap generator, the zip builder, the naive canonical comparator
- `tests/helpers/login-oracle.ts` — the independent recomputation
- `tests/unit/geo/ip.test.ts`, `tests/unit/logins/login-aggregate.test.ts` — the IPv6, ordering, hostile-cell and oracle comparisons
- `tests/unit/logins/login-fixtures.test.ts` — the fixture proven to be what it claims

## Decisions Made

- **The cap checkpoint: option-a** (above).
- **An IPv4-mapped address stays its own row.** D-05 is one row per CANONICAL address, and the canonical form of a mapped address is a 16-byte IPv6 one. Unwrapping at parse time would merge rows the export never claimed were one; `mappedIpv4` exists for the country LOOKUP, which is a different question asked at a different time by a different caller. Pinned by a test that asserts the two rows stay separate.
- **`maskIp` re-parses rather than pattern-matches.** It answers the fixed text `xxx` for anything that is not already canonical, so a compressed spelling cannot be masked into a plausible-looking prefix. This is the same property the IPv4 half asserted in 06-01, now covering both families.
- **The oracle takes `maxListed` and `countryOf` as parameters.** Reading `MAX_LOGIN_IPS` from `src/` would have made a wrong constant invisible: a fixture and an oracle that both believed the same number could not catch it.
- **The generated IPv6 addresses share their first three groups and differ after.** That is what makes the over-cap fixture twenty thousand rows which ALL mask to the same string — D-05's "two rows can look identical once masked" at the size where it stops being an edge case.
- **The generated addresses end in two zero groups.** A hand-written compressor that collapses a run of zeroes which are not there produces a *different* address wearing a compressed spelling's clothes, and the fixture would then disagree with the aggregator for a reason that has nothing to do with either. The shape is chosen so a legal compression always exists, and `login-fixtures.test.ts` asserts every non-canonical spelling parses back to the address it claims.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The seeded IPv6 "compression" spelling produced a different address**
- **Found during:** Task 3, first oracle run
- **Issue:** the generator's non-canonical spelling collapsed groups 3 and 4 with `::` on the assumption they were zero, and they usually were not. Every row using that spelling was a *different* address than the one the fixture recorded, so the oracle found 111 fewer distinct addresses than the aggregator and both were internally consistent. A fixture that "looked right" would have shipped this.
- **Fix:** `documentationIpv6` now writes `2001:db8:0:IIII:…:0:0` — a fixed three-group prefix (so all twenty thousand mask alike) and a guaranteed two-group zero run at the end (so the compression is always legal). A new test asserts that every non-null intended spelling actually parses back to the address it claims, which is the assertion that would have caught this from the start.
- **Files modified:** `tests/fixtures/logins-fixtures.ts`, `tests/unit/logins/login-fixtures.test.ts`
- **Committed in:** `add64c9`

**2. [Rule 1 - Bug] The over-cap `other.logins` expectation was off by the leader's extra row**
- **Found during:** Task 3
- **Issue:** the over-cap generator gives address 0 two rows so the ranked order has a leader, and the leader is therefore always LISTED. The folded logins are 500 (one per folded address), not 501.
- **Fix:** the assertion and its comment now say why the leader is excluded from the fold, and assert `addresses[0].logins === 2` so the premise is visible rather than assumed.
- **Files modified:** `tests/unit/logins/login-aggregate.test.ts`
- **Committed in:** `add64c9`

**3. [Rule 3 - Blocking] Eleven Task 2 tests failed on premises that were wrong, not on behaviour**
- **Found during:** Task 2
- **Issue:** the RED run was valid (35 failing on behaviour), but eleven assertions carried the wrong expectation: three IPv6 spellings in the property test had seven groups rather than eight, `compareIp`'s 9-vs-10 sign was inverted relative to the numeric order it was asserting, `Math.sign` was compared through `Object.is` (so `0` and `-0` failed), a "reveals no group past the third" address collided with its own kept prefix, and the fixture's hostile list carried a `;` — this export's own delimiter.
- **Fix:** each corrected to state the property it meant to state. The `;` entry is gone with a comment explaining that a cell carrying the delimiter is not one cell, so a test using it measures the CSV parser rather than the address parser.
- **Files modified:** `tests/unit/geo/ip.test.ts`, `tests/unit/logins/login-aggregate.test.ts`
- **Committed in:** `814a431`

**4. [Rule 2 - Missing critical] The archive-shape assertion read a DEFLATED zip as text**
- **Found during:** Task 3
- **Issue:** `pinned-zip` compresses its entries, so asserting the generated headers appeared in the raw bytes found zero of them — the assertion would have passed or failed for a reason unrelated to the fixture.
- **Fix:** the test unzips with `unzipSync` and compares each generated file's bytes to its own text, which also proves the override and the spec describe the same export. The sample's own `Sessions.csv` is asserted absent by entry NAME, and the sample's `Logins.csv` is asserted to be *replaced* rather than added to.
- **Files modified:** `tests/unit/logins/login-fixtures.test.ts`
- **Committed in:** `add64c9`

## Issues Encountered

- **A cap line is a promise about arithmetic, and it is now three arithmetic identities.** The `other` bucket used to be a declared-but-always-zero field, so the relationship between the listed rows and the stated totals had never been written down. It is now written on the constant and asserted in the tests, which is what makes the UI-SPEC's cap sentence implementable rather than aspirational.
- **`buildLogins` gained a third parameter, and every existing caller is unaffected.** The default is `null`, so the worker and the two worker suites are untouched — the account row is a fact the WORKER asserts, and plan 06-05 fills it.
- **`LoginsViewData.account` changed from `null` to `AccountRecord | null`.** Nothing consumes it yet, so `pnpm run check` is the gate rather than a search.

## Known Stubs

None that affect this plan's goal. Three fields are declared at their final shape with a value that cannot yet be non-trivial, and each is documented in place and owned by a later plan:

- `LoginAggregates.account` is `null` everywhere except the tests that pass one — 06-05 is where the sanitised `User_Info` row is read.
- `countryCode` and `city` on `AccountRecord` are never populated by anything in this plan; 06-05 fills them and 06-06/06-07 resolve them.
- The country lookup still answers `null` for every address, so every address is counted as unknown country. That is D-12's seam by design (the table body is 06-06), and 06-06 replacing it is a rebuild rather than a migration because the `geo` field is already on the stored type.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: untrusted-cell-read | `src/lib/geo/ip.ts` | The IP column can hold ANY text. The 64-character bound runs before any scan, the IPv6 parse is a single left-to-right scan with no alternation over a run, leading zeros are rejected rather than normalised in BOTH families (including the dotted tail), and a 100 KB hostile cell plus a 10,000-case seeded fuzz are test cases. |
| threat_flag: archive-bloat | `src/lib/features/logins/login-aggregate.ts` | `MAX_LOGIN_IPS` bounds the stored address list, and the stored record is what `checkCache()` reads whole on every query (RESEARCH Pitfall 9). The view carries per-ADDRESS rows and never per-login data; a 20,501-row archive serialises to under 4 MB, and that bound is asserted rather than assumed. |
| threat_flag: untrusted-text-echo | `src/lib/geo/ip.ts` | `maskIp` re-parses and answers the FIXED text `xxx` for anything that is not already canonical, so a cell holding an email, a name or markup cannot reach the screen by being masked, in either state of the reveal toggle. |

## User Setup Required

None — no external service configuration required, and no package is installed in this plan.

## Next Phase Readiness

- **06-04/06-05** can start: `parseIp` is complete, so the `Logins.csv` merge is a matter of widening `readSessionRowData`'s file screen and adding a second source kind to the rebuild branch.
- **06-05** fills `AccountRecord` from the sanitised `User_Info` row. The type, the `ipState` distinction and the third `buildLogins` parameter are all in place; `MAX_ACCOUNT_TEXT_LENGTH = 64` is exported for the trim-and-cut.
- **06-06** replaces `lookupCountry`'s body and `geoTableId`'s constant. Nothing here changes: the cap is already applied, the lookup already runs once per distinct address over every address, and a different `geo` id is a rebuild rather than a migration.
- **06-14**'s browser specs can use `buildLoginsScaleExport` for the 10k fixture and `buildLoginsOverCapSpec` for the cap, which is why both are exported from the fixture rather than living inside a test.
- **Blocking for every UI plan:** still no rendered block, and still no country resolves. ACTIVITY-05's user-facing half is 06-08/06-09/06-10 and ACTIVITY-06's is 06-06/06-07.

---
*Phase: 06-login-ip-history-offline-geolocation*
*Completed: 2026-10-03*

## Self-Check: PASSED

Every file this plan created is on disk (`tests/helpers/login-oracle.ts`, `tests/unit/logins/login-fixtures.test.ts`) and every file it modified carries the change. Both commits exist in the branch history. The full unit suite is green: **53 files / 1740 tests pass**, `pnpm run check` (tsc -b) is clean, and `pnpm run lint` (prettier --check + eslint) is clean.

The four structural acceptance criteria are verified against the artifacts rather than by eye: `grep -c "from '.*src/" tests/helpers/login-oracle.ts` prints `0`; `git diff --stat main...HEAD -- src/lib/features/playtime/playtime-aggregate.ts` prints nothing; the over-cap fixture's `addresses.length` is 20,000 with `other.addresses` at 500 and `sum(countries[].logins) + unknown.logins === totalLogins` asserted; and `login-fixtures.test.ts` asserts every emitted address lies inside 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 or 2001:db8::/32.
