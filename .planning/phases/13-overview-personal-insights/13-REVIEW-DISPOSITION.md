---
phase: 13-overview-personal-insights
review: 13-REVIEW.md
recorded: 2026-10-23
counts: { critical: 0, warning: 6, info: 7 }
---

# Phase 13 review disposition

One row per finding. `open` means seen and not yet acted on; nothing here is a
claim that a finding was fixed or judged harmless. Apply with
`/gsd-code-review 13 --fix` (Critical and Warning by default, `--all` adds Info).

| Finding | Severity | Status | Note |
|---------|----------|--------|------|
| WR-01 | warning | fixed (7a3afc0) | Rapid pins lost while a view transition is pending (OverviewBento.svelte) |
| WR-02 | warning | skipped - needs a design decision | Unpinning every tile is not persisted; defaults return on reload (overview-pins.ts, tests assert it) |
| WR-03 | warning | fixed (3de2e2b) | Win rate and In-battle mix account subsets (overview-totals.ts, overview-aggregate.ts) |
| WR-04 | warning | fixed (2933b05) | "best of N accounts" counts folders, not contributing accounts |
| WR-05 | warning | fixed (f072001) | Credits pick uses a substring test for "wot" |
| WR-06 | warning | fixed (969b6f3) | Generator does not cap API `page_total` (unbounded authenticated request loop) |
| IN-01 | info | fixed (3dfba5e) | Dead duplicate formatters used only by an e2e spec |
| IN-02 | info | fixed (edc01f6) | English strings hard-coded in overview-format.ts |
| IN-03 | info | fixed (61950a9) | Stale PROPOSED-text comment; dangling JSDoc |
| IN-04 | info | fixed (a6ed318) | Error screen leaves skeleton grids aria-busy |
| IN-05 | info | skipped - needs a privacy-review decision | Record tank reads "vehicle not recorded" when the table lacks the tank |
| IN-06 | info | fixed (e745b8d) | readApplicationId looser than dotenv |
| IN-07 | info | fixed (d06deca) | Name validator lets bidi / zero-width / C1 characters through |

WR-02 was skipped on purpose: the reviewer's fix reverses the approved 13-UI-SPEC rule
"if nothing valid remains, the defaults apply" (recorded as deliberate in the 13-06
SUMMARY, with tests asserting it). Reverse it only by amending the spec first, or
disallow unpinning the last pin in the UI. IN-05 was skipped on purpose: telling a recorded-but-unknown
tank apart from an empty cell needs a new field on the dmg/xp/kills tiles, which changes the
closed vocabulary of the overview reply (a privacy-review decision), and "vehicle not recorded"
is approved D-09 copy. The other six Info findings were fixed in iteration 2.
