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
