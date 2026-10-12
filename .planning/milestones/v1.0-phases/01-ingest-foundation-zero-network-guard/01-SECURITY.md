---
phase: "01"
slug: ingest-foundation-zero-network-guard
status: secured
# threats_open = count of OPEN threats at or above workflow.security_block_on (high)
threats_open: 0
asvs_level: 1
block_on: high
register_authored_at_plan_time: true
created: "2026-10-09"
---

# Phase 01 — Security

> Threat register verified by gsd-security-auditor on 2026-10-09 against the current tree (plans 01-01..01-15, review 21 findings, 6 signed overrides). 63 rows: 46 closed, 15 accepted (14 plan-documented + T-01-07), 2 open non-blocking, **0 open blocking** (T-01-07 accepted, see Accepted Risks Log).

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| User file -> page | zip dropped or picked in the browser | export bytes (PII: email, birth date, IPs) |
| Page -> Worker | one long-lived module worker | file bytes in, typed results out |
| Page/Worker -> network | forbidden after load (single sanctioned same-origin city file, plan 06-11) | none intended |
| Repo/CI -> host | `pull_request` jobs on `runs-on: self-hosted` | PR-controlled code |

## Blocking (severity >= high): resolved by recorded acceptance

| Threat ID | Category | Severity | Status | Detail |
|-----------|----------|----------|--------|--------|
| T-01-07 (WR-09) | Elevation of privilege | high | **accepted (scoped, see log)** | `ci.yml:13` runs every `pull_request`, `ci.yml:27` is `runs-on: self-hosted` (persistent host). Plan 01-02 specified `ubuntu-latest`; the deviation came in squash `9689001`. Declared greps pass (no `pull_request_target`, `contents: read`, SHA-pinned actions, `persist-credentials: false`) but do not close the vector. Not among the signed overrides; no named acceptor. Repo was PRIVATE on 2026-10-10. |

Closes when either (a) the PR job moves to `ubuntu-latest`/an ephemeral runner or outside-contributor approval is enforced, plus a README publish-precondition entry; or (b) a named human records acceptance scoped to the private period with a revisit trigger on visibility change.

## Open, non-blocking

| Threat ID | Severity | Residual |
|-----------|----------|----------|
| T-01-20 | medium | worker death after `ready` leaves next submit parked in `processing` (WR-04/WR-05); named in signed override O-1 |
| T-01-38 | medium | `#workerBroken` is set pre-ready only (reversed by 04-07); accepted via O-1 |

## Non-blocking residuals under closed rows

| Ref | Weakens | Detail |
|-----|---------|--------|
| R-1 (WR-01, WR-02) | T-01-08 | lint globs cover `.ts`/`.svelte` only; Worker/caches bans scoped to `src/lib/worker/**`. Latent: no `.js/.mjs/.cjs` under `src/`; request-counting Playwright is the backstop |
| R-2 (IN-05) | T-01-01, T-01-27, T-01-55 | `.gitignore` covers `tests/fixtures/private/` and root `/*.zip` only. No zip tracked or ever added |

## Threat Register (summary; per-threat evidence in the auditor verdict)

| Threat ID(s) | Severity | Disposition | Status |
|--------------|----------|-------------|--------|
| T-01-01, 02, 03, 04, 05, 06, 08, 09, 10, 11, 12, 13, 14, 15 | mixed | mitigate | closed |
| T-01-18, 19, 21, 23, 24, 25, 26, 27 | mixed | mitigate | closed |
| T-01-29, 30, 31, 32, 35, 40, 41 | low | mitigate | closed |
| T-01-42, 43, 46, 47, 48, 51, 52, 53, 55, 56 | mixed | mitigate | closed (T-01-56 caveat: acceptor identity not code-verifiable) |
| T-01-SC (plans 01, 11, 12, 13, 14, 15), T-01-SC2 | high | mitigate | closed |
| T-01-07 | high | mitigate | accepted (scoped to private repo) |
| T-01-20, T-01-38 | medium | mitigate | open, non-blocking |
| T-01-16, 17, 22, 28, 33, 34, 36, 37, 39, 44, 45, 49, 50, 54 | low/medium | accept | accepted (rationale in each plan's threat_model) |

*Premises superseded and judged against the current mitigation: T-01-02 (CSP `'self'`, O-2), T-01-23 (O-3), T-01-26 (O-4), T-01-09 (O-5), T-01-41 (O-6), T-01-38 (O-1).*

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-T07 | T-01-07 | Persistent self-hosted runner executes `pull_request` jobs. Accepted ONLY while the repository is private; MUST be revisited (move to ubuntu-latest/ephemeral runner or enforce outside-contributor approval, and add a README publish precondition) before the repository becomes public or any outside contributor can open PRs. Revisit trigger: repo visibility change. | b | 2026-10-10T10:03:27Z |
| (14 rows) | T-01-16, 17, 22, 28, 33, 34, 36, 37, 39, 44, 45, 49, 50, 54 | stated in each plan `<threat_model>` | plan-time disposition, no named acceptor recorded | n/a |

## Audit Trail

| Date | Event | Result |
|------|-------|--------|
| 2026-10-09 | gsd-security-auditor, ASVS 1, block_on high | OPEN_THREATS: threats_open 1 (T-01-07) |
| 2026-10-10T10:03:27Z | user acceptance of T-01-07 (scoped to private period), accepted_by "b" | threats_open 0 |
