---
phase: 12-account-timeline-perks
verified: 2026-10-21T18:10:02Z
status: passed
score: 5/5 must-haves verified
covered_files: [".planning/phases/12-account-timeline-perks/12-01-PLAN.md", ".planning/phases/12-account-timeline-perks/12-01-SUMMARY.md", ".planning/phases/12-account-timeline-perks/12-02-PLAN.md", ".planning/phases/12-account-timeline-perks/12-02-SUMMARY.md", ".planning/phases/12-account-timeline-perks/12-03-PLAN.md", ".planning/phases/12-account-timeline-perks/12-03-SUMMARY.md", ".planning/phases/12-account-timeline-perks/12-04-PLAN.md", ".planning/phases/12-account-timeline-perks/12-04-SUMMARY.md", ".planning/phases/12-account-timeline-perks/12-05-PLAN.md", ".planning/phases/12-account-timeline-perks/12-05-SUMMARY.md", ".planning/phases/12-account-timeline-perks/12-06-PLAN.md", ".planning/phases/12-account-timeline-perks/12-06-SUMMARY.md", ".planning/phases/12-account-timeline-perks/12-07-PLAN.md", ".planning/phases/12-account-timeline-perks/12-07-SUMMARY.md", ".planning/phases/12-account-timeline-perks/12-08-PLAN.md", ".planning/phases/12-account-timeline-perks/12-08-SUMMARY.md", ".planning/phases/12-account-timeline-perks/12-09-PLAN.md", ".planning/phases/12-account-timeline-perks/12-09-SUMMARY.md", ".planning/phases/12-account-timeline-perks/12-10-PLAN.md", ".planning/phases/12-account-timeline-perks/12-10-SUMMARY.md", ".planning/phases/12-account-timeline-perks/12-11-PLAN.md", ".planning/phases/12-account-timeline-perks/12-11-SUMMARY.md", ".planning/phases/12-account-timeline-perks/12-12-PLAN.md", ".planning/phases/12-account-timeline-perks/12-12-SUMMARY.md", ".planning/phases/12-account-timeline-perks/12-13-PLAN.md", ".planning/phases/12-account-timeline-perks/12-13-SUMMARY.md", "src/lib/core/types/worker-messages.ts", "src/lib/features/account-timeline/AccountTimelinePane.svelte", "src/lib/features/account-timeline/TimelineKindFilter.svelte", "src/lib/features/account-timeline/TimelineTable.svelte", "src/lib/features/account-timeline/timeline-aggregate.ts", "src/lib/features/account-timeline/timeline-instant.ts", "src/lib/features/account-timeline/timeline-shared.ts", "src/lib/features/account-timeline/timeline-state.ts", "src/lib/features/new-data/NewDataCard.svelte", "src/lib/features/new-data/NewDataTable.svelte", "src/lib/features/new-data/PerksPane.svelte", "src/lib/features/new-data/account-merge.ts", "src/lib/features/new-data/code-mask.ts", "src/lib/features/new-data/new-data-aggregate.ts", "src/lib/features/new-data/new-data-cell.ts", "src/lib/features/new-data/new-data-shared.ts", "src/lib/features/new-data/new-data-state.ts", "src/lib/shell/Dashboard.svelte", "src/lib/shell/selection-state.ts", "src/lib/ui-copy.ts", "src/lib/worker/categories.ts", "src/lib/worker/data-queries.ts", "src/lib/worker/db.ts", "src/lib/worker/ingest.worker.ts", "src/lib/worker/new-data-allowlist.ts", "src/lib/worker/new-data-specs.ts", "tests/e2e/guards/zero-network.spec.ts", "tests/e2e/shell/account-timeline-perks.spec.ts", "tests/fixtures/account-timeline-perks-export.ts", "tests/fixtures/new-data-fixtures.ts", "tests/fixtures/timeline-fixtures.ts", "tests/unit/account-timeline/phase12-gap-fill.test.ts"]
covered_digest: "v3:sha256:7fc97e35ee6e290f61373e2302d3ffc620591bd47af45cd0e21112fec7b7ed3e"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 5/5
  reason: "Test-only changes in commit 8ad167d (tests/e2e/guards/zero-network.spec.ts, tests/unit/account-timeline/phase12-gap-fill.test.ts) made the prior covered_digest stale. No product code changed."
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 12: Account Timeline & Perks Verification Report

**Phase Goal:** The user can read the account's history and entitlements: what it was called, where it was linked, where it was registered, what was enforced against it, and what it received.
**Verified:** 2026-10-21T18:10:02Z
**Status:** passed
**Re-verification:** Yes — re-checked against the current tree (branch gsd/phase-12-account-timeline-perks, HEAD 11a332e) after test-only changes in 8ad167d. Prior verdict (2026-10-20, passed, 5/5) carried over; no product code changed.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Account timeline shows name, external-services and language/country history in date order, each entry tagged with its account; emails never in clear text with no reveal path; IPs masked until the global reveal | VERIFIED | `timeline-aggregate.buildTimelineView` merges five files and sorts with `compareTimelineKeys`; the account comes from the group (`merged.accounts`). Email columns are absent from every spec (`new-data-specs.ts`), plus `emailGuard: true` projection in `new-data-allowlist.ts`. No spec carries an address column for these files, so no IP reaches the timeline at all (stricter than "masked"). e2e `account-timeline-perks.spec.ts` asserts planted emails, free text, addresses and codes are absent from text, markup and attributes. Language/country placement rests on an unconfirmed substring match, see Human Verification item 2 (resolved by UAT) |
| 2 | Bans and Authorized_Third_Parties shown, IPs masked until the global reveal | VERIFIED | `bans.csv` (STARTED_AT, EXPIRED_AT, STATUS) and `authorized_third_parties.csv` (THIRD_PARTY_SITE, CREATED_AT) specs exist and map to `ban` and `thirdParty` kinds in `TIMELINE_ENTRY_MAP`. 12-HEADERS.md shows neither real file has an IP column, so IP masking is vacuous; the reveal toggle is deliberately absent (e2e asserts `timeline-mask-toggle` count 0) |
| 3 | Subscriptions and surveys shown | VERIFIED | `subscriptions.csv` (SUBSCRIBED) and `heat_surveys.csv` specs; `PerksPane.svelte` renders four cards in fixed order via the `perks` channel (`data-queries.ts`); e2e Perks test passes on this tree |
| 4 | Personal coupons and bonus-code usage shown; codes and user IP masked by default | VERIFIED | `personal_coupons.csv` CODE and `bonus_code_usage.csv` CODE_KEY are kind `code`, USER_IP kind `address`; `code-mask.maskCode` gives at most 2 leading chars plus `xxx`, length-blind; e2e asserts clear codes absent while masked, shown only after the single global reveal, and re-masked together with Login history |
| 5 | Cross-cutting rules: planted emails never in clear, codes/IPs only masked until single reveal, zero-network covers each pane, large tables windowed/aggregated | VERIFIED | Re-confirmed on this tree. `zero-network.spec.ts` line 504 pins `[...STAGE_12_PANES, ...STAGE_13_PANES]` equal to `OPTIONAL_PANE_IDS` (the four `NEW_DATA_PANE_IDS`: heat, warships-storage, perks, account-timeline). Stage 13 (lines ~537-552) opens Perks and Account timeline on the multi-account import, toggles `perks-mask-toggle` to unmasked, and applies a timeline kind filter; the test then asserts zero post-baseline network requests and exactly one worker. The zero-network test containing these stages passes. e2e large-timeline step asserts `aria-rowcount`, bounded DOM, windowed scroll and zero `<svg>` per row; `TimelineTable` windows via `windowRange`; 9 per-file canary tests in `new-data-allowlist.test.ts` pass |

**Score:** 5/5 truths verified, 0 behavior-unverified

### Known-defect expected-fail tests (re-confirmed)

`tests/unit/account-timeline/phase12-gap-fill.test.ts` on this tree: 3 passed, 9 expected fail. The 8ad167d change only switched `it.fails.runIf(cond)(...)` to `it.runIf(cond).fails(...)` and reformatted; the same 9 defects remain expected-fail, so each still asserts a real defect (G1 `\N` leak, G2 ban end not surfaced, G3 unplaceable language/country rows lost, and the related gap tests). These are documented known defects, not passing behavior, and are tracked under WR-01, WR-01b and WR-02 below.

### Required Artifacts / Key Links

| Artifact | Status | Details |
|----------|--------|---------|
| `src/lib/worker/new-data-specs.ts` nine Phase 12 specs | VERIFIED | Fail-closed, excluded by omission: names/emails/UID/IP/free text (DESCRIPTION, REASON, PREREQUISITE, SUBSCRIPTION, PROFILE_ID, BATTLE_ID) |
| `src/lib/worker/new-data-allowlist.ts`, `db.ts`, `ingest.worker.ts` | VERIFIED | Projection at the storage choke point; `narrowStoredNewDataRows` re-narrows old caches; family files excluded from identity and Account-record pools |
| `src/lib/features/account-timeline/*` | VERIFIED | Pane, table, kind filter, builder, instant parsing; wired in `Dashboard.svelte` |
| `src/lib/features/new-data/PerksPane.svelte`, `account-merge.ts`, `code-mask.ts` | VERIFIED | Wired in `Dashboard.svelte`; reveal shares `revealed`/`setRevealed` with Login history |
| `selection-state.ts`, `worker-messages.ts`, `data-queries.ts` | VERIFIED | Both panes in the pane list; `perks` and `account-timeline` channels each built from real stored rows (Level 4: Dexie rows to builder to view to DOM), no static returns |

### Behavioral Spot-Checks (run on current tree, HEAD 11a332e)

| Check | Result | Status |
|-------|--------|--------|
| `pnpm run check` (tsc -b + svelte-check) | svelte-check: 338 files, 0 errors, 0 warnings | PASS |
| `pnpm run lint` | exit 0 | PASS |
| `pnpm exec vitest run tests/unit/account-timeline/phase12-gap-fill.test.ts` | 3 passed, 9 expected fail | PASS |
| `pnpm exec vitest run` (full, one run) | 135 files passed; 4149 passed, 9 expected fail, 0 failed | PASS |
| `pnpm exec playwright test tests/e2e/guards/zero-network.spec.ts` | 5 passed | PASS |
| `pnpm exec playwright test tests/e2e/shell/account-timeline-perks.spec.ts` | 2 passed (Account timeline pane; Perks pane) | PASS |
| Port 4173 | free before run; Playwright webServer started and stopped its own preview | N/A |

Combined Playwright run (`zero-network.spec.ts` + `account-timeline-perks.spec.ts`): 7 passed in 17.1s on chromium.

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| TIMELINE-01 | Name, service, language/country timeline; emails and IPs masked | SATISFIED (see human item 2, resolved by UAT) | Emails and IPs excluded from storage rather than masked, per CONTEXT D-01 (strictest form). Language/country discriminator confirmed on the user's real export via 12-UAT.md test 2 |
| TIMELINE-02 | Bans and Authorized_Third_Parties shown; IPs masked | SATISFIED | Truth 2 |
| PERKS-01 | Subscriptions shown | SATISFIED | Truth 3 |
| PERKS-02 | Coupons and bonus codes shown; codes and user IP masked by default | SATISFIED | Truth 4 |
| PERKS-03 | Surveys shown | SATISFIED | Truth 3 |

All five IDs appear in the ROADMAP Phase 12 block and REQUIREMENTS.md (marked complete, traceability table lines 75-79). No orphaned requirements.

### Code-review findings weighed against must-haves

| ID | Breaks a must-have? | Assessment |
|----|--------------------|------------|
| WR-01 `\N` handling | No | `cellOf` does not treat `\N` as not-reported, so a `\N` in `personal_coupons` EXPIRED_AT/UPDATED_AT would print literally. `bans.EXPIRED_AT` is stored but no view reads it. The known-defect expected-fail tests G1/G2 pin this. No plan or roadmap truth requires showing a ban end. Warning, cosmetic and a stored-unused column |
| WR-02 unplaceable language/country rows | Not proven; resolved for the user's export | Rows whose NAME contains neither/both of `lang`, `countr` are dropped while counted in `storedRows`; if all are dropped the pane shows "Showing all 0 entries". Pinned by expected-fail G3. The user's real export shows entries (UAT test 2) |
| WR-03 PLAYER_ANSWER unvalidated | No | Mitigated by the email guard and a 200-char clamp; hardening, not a must-have |
| WR-04 privacy copy overclaim | No (copy, not mechanism) | `TIMELINE_ABOUT` says emails are "never read, stored or shown"; the guard is a heuristic regex. Recommend softening the wording since the product's value is a verifiable privacy claim |
| WR-05 Entry column clipped | Possibly legibility | Resolved for legibility by UAT test 1 (accepted, long OLD · NEW pair clips by design) |
| IN-01 dead reveal wiring in timeline | No | Copy mentions IP masking for data the pane never holds |

### Anti-Patterns Found

No TBD/FIXME/XXX markers introduced in the Phase 12 source set were found as blockers by the lint/test gates. `deferred-items.md` records a colour-literal guard failure from plan 12-09; the current unit suite passes in full, so it was resolved.

### Housekeeping

`12-VALIDATION.md` frontmatter now reads `status: validated` (previously `draft`). `nyquist_compliant` is still `false`; that is not a must-have for this phase.

### Human Verification (resolved by 12-UAT.md)

1. **Legibility at 375px and 480px** (both panes, long nickname pairs). Resolved: 12-UAT.md test 1, result pass (long OLD · NEW pair in the Entry column accepted per WR-05).
2. **Language/country discriminator against a real export.** Resolved: 12-UAT.md test 2, result pass (Language and Country chips list entries on the user's own export).

12-UAT.md: status complete, 2/2 passed, 0 issues, 0 pending. No human items remain outstanding.

### Gaps Summary

No blocking gaps. Every roadmap success criterion is backed by code that exists, is wired and carries real data, and by passing automated gates re-run on the current tree (HEAD 11a332e). The re-verification was triggered only by test-file changes in 8ad167d; the zero-network stage 12/13 pane coverage and the phase12-gap-fill expected-fail set were re-run and still hold. Status is `passed`.

---

_Verified: 2026-10-21T18:10:02Z_
_Verifier: Claude (gsd-verifier)_
