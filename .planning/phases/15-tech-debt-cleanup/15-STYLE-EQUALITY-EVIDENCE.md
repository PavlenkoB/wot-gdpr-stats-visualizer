# Phase 15 style-equality evidence

Written by `tools/style-equality.mjs evidence`. This file holds widths, counts, hashes and commit ids only: no screenshot, no fixture byte, no export content, no absolute path. The comparison is per element (computed style and bounding rect) plus a sha-256 of a full-page screenshot in the rest state; class names are never part of the key.

## Baseline

- Baseline commit: `2cb5359194eabdb2fee4c71c546f4a9bf7bf1d2a` (2cb5359, the commit before Phase 15).
- Captured (UTC): 2026-11-01T08:03:44.781Z.
- Harness version: 1.
- Archives driven (synthetic builders under tests/fixtures/): account-timeline-perks, new-games-three-account, perks-three-account, real-shape-three-account, sample.
- Panes rendered (13 of 13): account, account-timeline, device-info, finance, heat, login-history, not-yet-supported, overview, payments, perks, playtime, vehicles, warships-storage.
- Widths: 375, 480, 481, 899, 900, 1280 (the edge widths 900, 899, 481, 480 for one archive).
- States: rest (computed style, rect and a screenshot hash) and open (every details element opened; computed style and rect only).
- The baseline was captured twice with identical results (dump and screenshot hashes): yes.

| width | elements | sha-256 of the canonical JSON |
|---|---|---|
| 375 | 38643 | 721c475ff6724758c10e036e3aa6119b67b0ffdb10a7e8ede50ff3111312e528 |
| 480 | 10709 | 6b7a9b74386ff62f216ff184160f8a951cddc483b393dea7f1152985a1c8466c |
| 481 | 10709 | 45885b4377a886cd26618481aaeea76f56c20ec4db26da9504c0024aa3fd951f |
| 899 | 10713 | fb28951bbc7577fabbcaa618316c7ad34edb4e24163e7b83b71ee038993767bd |
| 900 | 10709 | a3a817a6763199cfb83ef6eb77c750256325710b9acb5a5f061e90771db88ca4 |
| 1280 | 38659 | 75e410eb8cecc4a6fcc7e7aebb132e50b8837331e350637ecef7aa9b10a42916 |

## Tracer result

- Date (UTC): 2026-11-01T08:06:50.131Z.
- Commit: `045d729`.
- Working tree (src/): clean.
- Wall time of the full check (baseline cached): 80s.

| width | elements | screenshots | differing elements | differing screenshots | verdict |
|---|---|---|---|---|---|
| 375 | 38643 | 56 | 0 | 0 | EQUAL |
| 480 | 10709 | 10 | 0 | 0 | EQUAL |
| 481 | 10709 | 10 | 0 | 0 | EQUAL |
| 899 | 10713 | 10 | 0 | 0 | EQUAL |
| 900 | 10709 | 10 | 0 | 0 | EQUAL |
| 1280 | 38659 | 56 | 0 | 0 | EQUAL |

## Gate

Run on the final source tree (HEAD `2c91676` plus the evidence tooling and this file). Counts and results only.

| command | result | counts |
|---|---|---|
| `pnpm run test:unit` | pass | 165 files, 4951 passed, 9 expected fail (4960); includes `ci-budget` and `no-real-data` |
| `pnpm run lint` | pass | prettier clean, eslint clean |
| `pnpm run check` | pass | 363 files, 0 errors, 0 warnings |
| `pnpm run build` | pass | built |
| `git diff --exit-code 2cb5359 -- package.json pnpm-lock.yaml` | pass | empty diff |
| `pnpm exec playwright test` | pass | 273 passed, 0 failed (limit 273 listed); includes the zero-network spec |

Notes: the first unit run under host load (load average above 11) timed out `no-real-data` and one `overview-grid` case, both known load-sensitive and passing alone; the recorded unit result is a clean full run with `--maxWorkers=4`. The only non-comment change to `src/lib/ui-copy.ts` since `2cb5359` is the confirmation constant `CONFIRM_CLEAR_MESSAGE`.

## Final result

- Date (UTC): 2026-11-01T11:00:41.165Z.
- Commit: `7df547b`.
- Working tree (src/): clean.
- Wall time of the full check: 155s.

| width | elements | screenshots | differing elements | differing screenshots | verdict |
|---|---|---|---|---|---|
| 375 | 38727 | 64 | 0 | 0 | EQUAL |
| 480 | 10730 | 12 | 0 | 0 | EQUAL |
| 481 | 10730 | 12 | 0 | 0 | EQUAL |
| 899 | 10734 | 12 | 0 | 0 | EQUAL |
| 900 | 10730 | 12 | 0 | 0 | EQUAL |
| 1280 | 38743 | 64 | 0 | 0 | EQUAL |

Every width above covers the rest, open and tooltip states.

- note-sites total: 0 (102 at the start of the phase).
