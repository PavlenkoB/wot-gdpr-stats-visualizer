# Phase 15: Tech-debt cleanup - Playbook

**Role:** the shared rulebook for the 13 plans of this phase. A plan names its files and its plan-specific traps; this file holds the rules that are the same for every plan, so they cannot drift between plans.

**Authority (highest first):** the orchestrator brief for this phase > `14-CONTEXT.md` (14-D-02, 14-D-07; locked) > `14-UI-SPEC.md` (OI-11) > `14-UAT.md` deferred follow-ups 3, 4, 5 > `.planning/v1.1-MILESTONE-AUDIT.md` tech-debt list > this playbook. Decision ids from earlier phases are always written with their phase (`14-D-07`, `13-D-14`): Phase 13 and Phase 14 both have a D-14 and they mean different things.

**Goal:** close the v1.1 audit tech debt with NO visible change, except the one sentence added to the Start over / Clear confirmation (plan 15-02). There are no new requirement ids; every plan carries `requirements: []`.

## 1. Hard rules (every plan)

- No new dependency, no SCSS, no new network request, no inline `style=`, no `url()` or `@import` in any stylesheet. `package.json` and `pnpm-lock.yaml` stay byte-equal to commit `2cb5359`.
- No DOM restructuring: a class name may be added, renamed or swapped; an element may not be added, removed or moved. No copy change outside plan 15-02.
- No new Playwright test: the listed count stays 273 (`tests/unit/guards/ci-budget.test.ts`).
- Guards pass with no exemption list and no allowlist. A guard that cannot go live yet is written as a pure function with synthetic tests and wired into the whole-tree sweep only in plan 15-13, when its subject is gone.
- Commits carry no Co-Authored-By trailer (project rule). Commit per task with a `refactor(15-NN): ...` / `docs(15-NN): ...` message.
- Every path in a committed file is repo-relative. No absolute home-directory path (the real-data guard `tests/unit/guards/no-real-data.test.ts` rejects them), and never read `~/Downloads/export`: that is a real export (PII). The harness takes its exports only from `tests/fixtures/`.
- After code files change, `graphify update .` runs once, in plan 15-13.

## 2. The two tools (created by plan 15-01, committed under `.planning/phases/15-tech-debt-cleanup/tools/`)

`.planning/` is ignored by Prettier and ESLint, never shipped, and not a Playwright spec, so these cost nothing in CI. They are committed (Phase 14 kept its harness out of the repository and lost it to a machine restart, see `14-21-SUMMARY.md` Deviation 1). Outputs (builds, JSON dumps, PNGs) live in `${TMPDIR:-/tmp}/wg-phase15/` and are never committed.

| Tool | Use | Exit |
|---|---|---|
| `tools/style-equality.mjs check` | Builds the baseline commit `2cb5359` (once, cached in the scratch directory, from a detached git worktree with `node_modules` symlinked) and the working tree, drives every list pane of the synthetic archives at 1280 and 375 px (and, for the one richest archive, also at 900, 899, 481 and 480, the two sides of both breakpoints), in the rest, open and (from plan 15-07) tooltip states, and compares per element: computed style and bounding rect, plus a full-page screenshot hash in the rest state. A full run is budgeted under about eight minutes (a foreground tool call is capped at ten); run it in the background if it ever exceeds that. Optional `--panes a,b` and `--widths 375,900` narrow a run. | 0 equal, 1 any difference (the first 40 are printed with pane, width, element path, property, before, after) |
| `tools/style-equality.mjs selftest` | Proves the instrument: two baseline captures are identical, and a deliberately perturbed copy is detected. | 0 / 1 |
| `tools/style-equality.mjs show --label before --class <name>` (or `--testid <id>`, optional `--pane`, `--width`) | Prints the recorded rows of the matching elements. In the `before` build the old class names exist, so this is how an inherited weight is read (playbook section 3, rule 2). | 0 |
| `tools/style-equality.mjs clean` | Removes the baseline worktree and the scratch directory. Run once, in plan 15-13. | 0 |
| `tools/note-sites.mjs [--count] [paths]` | Lists every rule outside `src/styles/type.css` and `src/styles/utilities.css` that declares the 14px size and the 1.4 line height together (the G7 pair of `tests/helpers/token-guards.ts`). With `--count` it prints per-file counts and a total and exits 0; without it, it exits 1 when any remains. Default path `src`. | see left |

**Every plan's expected harness result is "equal, no allowance".** No plan in this phase is allowed a visible difference. A difference is a regression to be fixed, never recorded as expected.

## 3. Role adoption (plans 15-01, 15-06 to 15-12)

The roles `.t-note` (14 / 400 / 1.4) and `.t-note-strong` (14 / 600 / 1.4) bundle size, weight and line height (14-D-07). A site is migrated by putting the role class on the element and deleting the size, weight and line height from every local rule that styles that element.

1. **Measure first.** Run `node .planning/phases/15-tech-debt-cleanup/tools/note-sites.mjs --count <your files>` and compare with the plan's inventory. The count is re-measured, never copied: the inventory in a plan is what the planner measured, the tool is what is true now.
2. **Pick the role from the computed weight in the BEFORE build.** A rule that declares a weight picks the matching role (regular -> `.t-note`, semibold -> `.t-note-strong`). A rule that declares NO weight inherits one: read it from the harness dump of the baseline (`font-weight` of those elements), do not assume 400. If the same element inherits different weights in different contexts, STOP and report it in the SUMMARY: do not exempt it, do not leave a pair behind.
3. **Never two roles on one element.** Two roles tie at specificity (0,1,0) and the later one in `type.css` wins. Where a compound selector demotes an element (`IdentityHeader`: `.account-id` and `.multi-name.id-only`), swap the role in markup with a conditional class and delete the type declarations from the compound; do not stack the roles.
4. **Ties with the utilities.** `.body` and the muted-note utility have specificity (0,1,0) and load AFTER `type.css`, so on a shared element the utility wins the tie. If an element that needs a role also carries a utility, check which declarations each states; never rely on source order.
5. **One class per element the rule matched.** A rule on an element selector (`td`, `th`, `button`, `h3`, `summary`, `dt`, `dd`, `label`, `select`) applies to every such element in the component: put the class on each of them, including those inside `{#each}` and `{#if}` branches. An SVG `<text>` takes the class like any element. A dynamic class (`class={...}`, `class:name`, a variant table) gets the role in the expression, not beside it.
   **Table exception.** Font properties inherit. When a `table` rule and its `td` (or `.more`) rule state the same pair, the TABLE takes the role and the cell rule's pair is deleted outright instead of adding a class to every cell; the harness confirms the cells still compute the same. A `th` and a `caption` do NOT qualify: the user agent makes them bold, so each takes its own explicit role.
6. **A comma list is one rule.** `.label, .count` needs the class on both kinds of element.
7. **No competing local rule.** After the move no rule in the component may still declare the 14px size together with the 1.4 line height (that pair is guard G7). A rule that still needs the WEIGHT alone (a variant over a utility) keeps only the weight.
8. **Comments.** A comment that quoted the old triple is rewritten to name the role. A comment never names a class this phase deleted.
9. **Check each file** with the `note-sites` tool (0 for the file), the component's readers (section 4) and `pnpm run check`; check each plan with the harness (section 2).

## 4. Tests that read the CSS text (the readers)

About twenty unit tests read component sources as text. They go red when a declaration leaves a rule. Rules (the same as Phase 14, section 7):

- Update them in the SAME plan as the component. Keep the intent, change the form: a "declares at least one font-size" sweep must count the role classes in the markup as well (the helper `effectiveFontSizes` that plan 15-07 adds to `tests/helpers/css.ts`); a `font-weight: 600` assertion on a rule becomes "the element carries the strong role".
- Never delete an assertion, never weaken one to presence-only, never drop a `length > 0` check. Every sweep stays non-vacuous.
- Find readers with `grep -rn "<ComponentName>" tests/unit tests/helpers tests/e2e`; each plan lists the ones the planner found.

## 5. Checks that run after every plan

| Check | Command |
|---|---|
| Guards | `pnpm exec vitest run tests/unit/guards` |
| Unit suite | `pnpm run test:unit` |
| Types and Svelte | `pnpm run check` |
| Lint and format | `pnpm run lint` (run `pnpm exec prettier --write <changed files>` first) |
| Build | `pnpm run build` |
| Visual equality | `node .planning/phases/15-tech-debt-cleanup/tools/style-equality.mjs check` |

The harness builds with `--outDir` into the scratch directory, so it never touches `dist/` or port 4173. Plans 15-05 to 15-12 still run strictly one after another: they share the scratch directory, the baseline worktree and the working tree, and a second executor building at the same time would read half-edited files. (The Playwright specs some plans run build `dist/` and bind port 4173 through `playwright.config.ts`; stop anything already listening there first.)

## 6. Why the plans are ordered as they are

| Wave | Plan | Item |
|---|---|---|
| 1 | 15-01 | Tracer: the two note roles, the orphan removal, the G7 offender function, one migrated component, the harness and its baseline |
| 1 | 15-02 | Privacy copy for the pins (no shared file with 15-01) |
| 2 | 15-03 | Shell layout and the one phone block move to `src/styles/shell.css`; guards repointed |
| 3 | 15-04 | Stale `app.css` references in comments and the sketch skill |
| 4 | 15-05 | The muted-note utility is renamed (the naming collision) across `src/` and `tests/` |
| 5-11 | 15-06 to 15-12 | The 101 remaining sites, one pane group per plan |
| 12 | 15-13 | G7 goes live on the whole tree, docs, skill, graph, the full gate and the final harness run |

Plans 15-03 to 15-12 touch overlapping component files, so they are a strict chain; that is also what keeps `src/app.css`, `src/styles/type.css` and `src/styles/utilities.css` from being edited by two plans at once (15-01 owns the first edit of the last two, 15-03 owns `app.css` and `shell.css`, 15-05 owns the second edit of `utilities.css`, 15-13 owns the last edit of the guard files).

## Appendix: source coverage audit

Sources: GOAL (ROADMAP Phase 15), REQ (none: `requirements: []`), RESEARCH (none: the brief says skip research, known-code refactor), CONTEXT (no 15-CONTEXT.md; the orchestrator brief and the Phase 14 deferred decisions stand in).

| Source | Item | Plan(s) | Status |
|---|---|---|---|
| GOAL | `.t-note` / `.t-note-strong` roles added and the 14px/1.4 sites moved onto them (14-D-07) | 15-01, 15-06 to 15-13 | COVERED |
| GOAL | Shell layout and the phone block out of `src/app.css` (14-D-02, 14-UI-SPEC OI-11), phase-8 guard repointed, single phone block kept | 15-03, 15-04 | COVERED |
| GOAL | `.caption` / `.t-caption` naming collision renamed across `src/` and `tests/` | 15-05 | COVERED |
| GOAL | Orphans: the unused strong-body role and the unused shared button block are removed (default REMOVE; no mass migration of the 12 button components) | 15-01 | COVERED |
| GOAL | Privacy copy covers the pins that survive Clear / Start over (13-D-14); pin behaviour unchanged | 15-02 | COVERED |
| Brief | Guard extended so the roles are enforced; no exemption or allowlist | 15-01 (function), 15-13 (sweep) | COVERED |
| Brief | Pixel / computed-style equality evidence for items 1 to 3, committed as counts and hashes | 15-01 (instrument + baseline), 15-03, 15-05, 15-06 to 15-13 | COVERED |
| Brief | Waves keep `app.css`, `type.css`, `utilities.css` single-writer | all | COVERED |
| Audit | "ROADMAP.md still says v1.1 = Phases 9-12" | none | EXCLUDED: milestone-completion housekeeping, owned by `/gsd-complete-milestone`, not tech debt in code |
| Phase 14 deferred | Dark mode, committed pixel baselines in CI, `<Caption>` wrappers | none | EXCLUDED (deferred) |
