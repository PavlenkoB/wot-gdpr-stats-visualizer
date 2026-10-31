# Phase 14: Design unification - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-25
**Phase:** 14-design-unification
**Areas discussed:** Token architecture, One type scale, Heat vs ramp, Pane title & shell, Verification, Migration order, Overview freeze

---

## Pre-discussion (SCSS question)

User asked whether SASS/SCSS would help over plain CSS. Recommendation: stay on CSS (native nesting, custom properties, Svelte scoping; guards regex raw CSS). User's real pain was hardcoded values (188 raw 14px, 200+ spacings, 72 hex, `.caption` x23), not the language.

**Boundary:** user chose "Allow small layout nudges" over "Visual-only, layouts frozen".

---

## Token architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Type + spacing + shared classes + hex | Biggest diff, fixes the stated pain | ✓ |
| Type + shared classes + hex only | Leave spacing raw | |
| Type tokens only | Minimum for guard replacement | |

**Shared CSS location** (asked three times; user asked for the clean-code view, then Svelte-official guidance):

| Option | Description | Selected |
|--------|-------------|----------|
| Split global CSS files | tokens/type/utilities, imported once | ✓ |
| Keep everything in app.css | One growing file | |
| Svelte components | Wrapper components, markup changes | |

**Enforcement:** Fonts, spacing, hex, shared names (✓) over fonts+hex+names, fonts only.
**Spacing scale:** 4/8/12/16/24, snap 6px (✓) over keeping 6px or "you decide".
**Nesting policy:** user chose "Required for all touched styles" over "Allowed, not required" (recommended) and "Not in this phase".
**Notes:** Svelte docs confirm scoped specificity (+0-1-0) and give no file-layout rule; plain CSS imported at the entry is the template convention.

---

## One type scale

| Option | Description | Selected |
|--------|-------------|----------|
| Unified 12/14/18/26/32/56 | Union of both scales | ✓ |
| Overview scale only | Drops 18 and 26 | |
| Old scale plus new steps | Would change Overview 32 to 30 | |

**Token names:** Role names (✓) over numeric steps.
**30px uses:** Snap to display 26 (✓) over 32 or per-site.
**Role scope:** Size + weight + line-height as roles (✓) over size only.

---

## Heat vs ramp

| Option | Description | Selected |
|--------|-------------|----------|
| Fully replace, one scale | Delete --ramp-* | ✓ |
| Replace except calendar | | |
| Coexist | | |

**Six steps:** user chose "Interpolate in CSS (color-mix)" over the recommended hand-picked six tokens.
**Notes:** contrast.test.ts must therefore recompute mixes.

---

## Pane title & shell

| Option | Description | Selected |
|--------|-------------|----------|
| Keep display 26 | Recommended | |
| Titles move to stat 32 | | ✓ |
| Heading 18 everywhere | | |

**Phone:** drop to display 26 (✓) over 18 or staying 32.

---

## Verification, Migration order, Overview freeze

- Verification: Screenshot diff + human UAT (✓) over committed baselines or guards only.
- Migration: Foundation first, then per pane group (✓) over one codemod.
- Overview: Pixel-identical, tokens only (✓) over leaving files untouched.

## Claude's Discretion

File/class/token names, per-site 4-vs-8 snaps, color-mix stops, off-scale Overview spacing handling.

## Deferred Ideas

Dark mode, committed pixel baselines, Svelte text-role components.
