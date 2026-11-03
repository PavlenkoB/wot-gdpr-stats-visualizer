# Retrospective

## Milestone: v1.0 — MVP

**Shipped:** 2026-10-12
**Phases:** 8 | **Plans:** 115 | **Tasks:** 251

### What Was Built
Browser-only WG GDPR export viewer: worker ingest pipeline, defensive parsing + IndexedDB dataset, master-detail dashboard with playtime, vehicle, financial and login-IP/geo panes, mobile layout, Pages deploy workflow. See milestones/v1.0-ROADMAP.md.

### What Worked
- Zero-network guard (ESLint ban + Playwright + CSP) from phase 1.
- Fail-closed PII stripping and bounded inflate hardening.

### What Was Inefficient
- Phase 8 redesign retired many earlier-phase must-haves, forcing supersession/override bookkeeping across phases 1-7 verifications.
- Human verification items piled up and were closed in one late pass; several rested on pre-redesign UAT.

### Key Lessons
- Run real-export UAT after the layout-changing phase, not before.
- Keep REQUIREMENTS.md checkboxes in sync at phase close (drifted for PLATFORM-01/02/03).
- Resolve WR-04 (self-hosted runner + pull_request) before making the repo public; live deploy still unobserved.

## Milestone: v1.1 — Multi-account & new data

**Shipped:** 2026-11-03
**Phases:** 7 | **Plans:** 90 | **Tasks:** 116

### What Was Built
Multi-account import and one merged dashboard, six newly supported data categories behind the fail-closed PII strip, the Account timeline and Perks panes, the Overview personal-insights page, an app-wide design system, and a Phase 15 cleanup of the audit's tech debt.

### What Worked
- A committed style-equality harness (computed style, rects, pixels against a baseline commit) let a 13-plan CSS refactor claim "no visible change" with evidence.
- Hand-derived oracles run through the real worker caught aggregator and fixture errors together.
- Running the milestone audit before cleanup turned vague polish into a bounded Phase 15 with a measurable exit (zero unmigrated sites).

### What Was Inefficient
- Phases 9-14 now read `stale` because later phases edited files their verification covers; closing needed an override. Verification digests do not tolerate legitimate cross-phase edits.
- Phase 14 deferred three items (note roles, shell CSS move, caption naming) that cost a whole extra phase.
- The self-hosted CI runner broke twice (npm module missing, a cancelled run), unrelated to the code.

### Patterns Established
- Roles (`.t-*`) for typography, utilities for layout, guards over whole `src/` with no allowlist.
- Playwright test-count ceiling reconciled with the three CI time limits in one change.

### Key Lessons
- Do not defer a phase's own cleanup to "later"; if it is cheap enough to list, do it before verification.
- Re-verify (or refresh digests) at milestone close instead of overriding.
- Fix the self-hosted runner, or move CI to hosted runners, before the repository goes public.
