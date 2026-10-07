# Phase 7: Mobile Layout & Public Deploy - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-05
**Phase:** 07-mobile-layout-public-deploy
**Areas discussed:** Wide content at 375px, Touch: tooltips & popovers, Deploy workflow shape, City dataset + live verification

---

## Wide content at 375px

| Question | Options | Selected |
|----------|---------|----------|
| Tables at 375px | Keep scroll box / Reflow to stacked cards / Hybrid column hiding | Keep scroll box ✓ |
| World map | Scale only, rely on table / Min-width + scroll / Pinch-zoom | Scale only ✓ |
| Page chrome | Shrink padding <480px / Padding + denser nav / Leave as is | Shrink padding ✓ |
| Mobile QA | Sweep spec + touch project / Sweep only / Add WebKit+Firefox | Sweep spec + touch project ✓ |

**User's choice:** All recommended options.
**Notes:** Next-area check answered "Next area".

---

## Touch: tooltips & popovers

| Question | Options | Selected |
|----------|---------|----------|
| Tooltip tap behaviour | Tap pins, outside-tap dismisses / Pin + auto-dismiss timer / Leave to tables | Tap pins ✓ |
| SC2 tabs/popovers | Nav strip = tabs, no popovers (amend SC2) / Add bits-ui | Nav strip = tabs ✓ |
| Native title= attrs | Leave hover-only / Route via ChartTooltip / You decide | Leave hover-only ✓ |
| Touch target size | 44px, charts exempt / 24px WCAG / No rule | 44px ✓ |

**User's choice:** All recommended options.
**Notes:** Next-area check answered "Next area".

---

## Deploy workflow shape

| Question | Options | Selected |
|----------|---------|----------|
| Runner (first ask) | GitHub-hosted for deploy / Same self-hosted / You decide | Free text: "deploy on github but manualy triggered, but tests and other on self hosted, repeat question." |
| Workflow shape (re-asked) | Separate deploy.yml workflow_dispatch gated on green CI / ci.yml deploy job with manual input + needs: verify / Manual with no gate | Separate deploy.yml, workflow_dispatch, gated on green CI ✓ |
| Base path | Absolute base from env in deploy build only / Hardcode / Custom domain root | Env-based absolute base ✓ |
| Pages prerequisites (More questions) | Public + manual Pages setting / Private or not sure / Make public in phase | "Repo is private / not sure yet" ✓ |

**User's choice:** Wanted deploy on a GitHub-hosted runner, manually triggered, with tests on self-hosted; this overrode the earlier "deploy job in ci.yml needs: verify" choice and amended SC3.
**Notes:** User chose "More questions" at the check, which produced the Pages prerequisites question.

---

## City dataset + live verification

| Question | Options | Selected |
|----------|---------|----------|
| City build failure | Fail the deploy / Deploy without city file / Commit via LFS | Fail the deploy ✓ |
| Live verification | Pre-deploy gate + post-deploy smoke / Pre only / Post only | Pre-deploy gate + post-deploy smoke ✓ |
| CSP narrowing | Keep 'self' / Narrow in deploy build only | Keep 'self' ✓ |
| Phone memory | Warn in copy + manual device check / Hide opt-in on small screens / deviceMemory guard | Warn + manual check ✓ |

**User's choice:** All recommended options.
**Notes:** Final "Done" check answered "I'm ready for context".

---

## Claude's Discretion

- Exact padding values (12-16px), nav density, table scroll-hint.
- Mechanism for the green-CI-for-SHA check and DB-IP download caching.
- Form of the touch-target assertion.
- Names/locations of new specs and Playwright project config.

## Deferred Ideas

- Card reflow for tables; map pinch-zoom; CSP narrowing; device-memory guard; WebKit/Firefox projects; making the repo public.
