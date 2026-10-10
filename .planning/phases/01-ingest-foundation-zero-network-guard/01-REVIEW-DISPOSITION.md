---
phase: 01-ingest-foundation-zero-network-guard
review: 01-REVIEW.md
generated: 2026-10-10
open: 0
fixed: 2
deferred: 19
total: 21
---

# Review disposition

Triaged by plan 01-15 (gap-closure close-out): 2 fixed by plans 01-11, 01-13 and 01-14, the other 19 deferred with a one-line rationale each. Nothing is open. Source: 01-REVIEW.md (commit 54eab56).

| ID | Severity | Status | Note |
|----|----------|--------|------|
| CR-01 | critical | fixed | Fixed by plan 01-11 (classification fails closed, reason ambiguous-root) and plan 01-13 (strip keyed on the header name). Was: rootless-first precedence misfiles real account folder, bypasses User_Info strip (classify.ts:275-279) |
| WR-01 | warning | deferred | Static-layer hardening; no such file exists under src/ and request counting in the browser specs is the live backstop. Own lint-guard plan. |
| WR-02 | warning | deferred | Same lint-guard plan as WR-01; the counted-request specs are the backstop. |
| WR-03 | warning | fixed | Fixed by plan 01-14 (declared-size caps in inflate-bounds.ts). Was: no size cap when inflating CSVs |
| WR-04 | warning | deferred | Reverses a deliberate Phase 4 choice (plan 04-07) and is the same decision as override O-1; needs a liveness design, not a patch. |
| WR-05 | warning | deferred | Same state machine and same decision as WR-04. |
| WR-06 | warning | deferred | Needs a cause tag on the worker contract (D-09 frozen) and a copy decision that touches the locked single-banner rule (D-07); a separate decision. |
| WR-07 | warning | deferred | Needs a new field on the classify result, and the privacy exposure it touches is closed by plan 01-13. |
| WR-08 | warning | deferred | Fails closed and is over-strict rather than unsafe; own hardening with the review's four fixtures. |
| WR-09 | warning | deferred | Repository was PRIVATE when checked with gh repo view on 2026-10-10; must be fixed BEFORE the repository goes public. Recorded as a publishing precondition, not a Phase 1 code gap. |
| WR-10 | warning | deferred | Timing and unhandled-rejection polish with no leak or correctness impact; small separate fix. |
| IN-01 | info | deferred | Informational (stage text flips Unzipping/Checking/Unzipping); batch into a docs-and-comments sweep. |
| IN-02 | info | deferred | Comment drift (contradictory #workerBroken comments, dead branch); batch into a docs-and-comments sweep. |
| IN-03 | info | deferred | Comment drift (stale Playwright cannot see worker traffic comments); batch into a docs-and-comments sweep. |
| IN-04 | info | deferred | Documentation drift (README test counts and Node version); batch into a docs-and-comments sweep. |
| IN-05 | info | deferred | .gitignore only protects a root-level zip; the one info item with a privacy flavour, recommended first in the docs-and-comments sweep. |
| IN-06 | info | deferred | Stale driver names and a fixed temp path in driver.mjs; batch into a docs-and-comments sweep. |
| IN-07 | info | deferred | First zero-network spec lacks a CSP-violation observer; batch into a docs-and-comments sweep. |
| IN-08 | info | deferred | Dead test-only surface (reset and classifyExport have no callers under src/); batch into a docs-and-comments sweep. |
| IN-09 | info | deferred | Nested interactive controls (focusable input in a label with role button); batch into a docs-and-comments sweep. |
| IN-10 | info | deferred | Stale limit arithmetic in ci.yml comments; batch into a docs-and-comments sweep. |
