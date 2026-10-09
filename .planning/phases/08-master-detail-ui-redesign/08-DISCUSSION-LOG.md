# Phase 8: Master-detail UI redesign - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-07
**Phase:** 08-master-detail-ui-redesign
**Areas discussed:** Section mounting, E2E migration and budget, Selection lifecycle, Keyboard scope

---

## Section mounting

| Option | Description | Selected |
|--------|-------------|----------|
| Mount only selected | Simplest DOM, fewer live charts; chart state resets on switch | ✓ |
| Keep all mounted, hide with CSS | Preserves state, but heavy DOM and hidden-focusable pitfalls | |

**User's choice:** Mount only selected

## E2E migration and budget

| Option | Description | Selected |
|--------|-------------|----------|
| Helper + replace scroll-nav spec | openSection helper, smaller nav spec, hold/lower count | ✓ |
| Helper + keep nav coverage broad | Rewrite 17 tests, raise all three limits | |

**User's choice:** Helper + replace scroll-nav spec

## Selection lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Overview always; reset on import | Plain component state, fallback to Overview | ✓ |
| Keep selection across replace-import | Stay unless section vanishes | |

**User's choice:** Overview always; reset on import

## Keyboard scope

| Option | Description | Selected |
|--------|-------------|----------|
| List focus only | No conflict with chart/input keys; Enter/Escape move focus | ✓ |
| Page-wide unless in chart/input | Faster but needs guards | |

**User's choice:** List focus only

## Claude's Discretion

Component split, Overview card derivation, phone focus placement.

## Deferred Ideas

location.hash, Chart|Table toggle, dark mode.
