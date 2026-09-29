# Phase 3: Dashboard Shell & Account Identity - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-29
**Phase:** 3-Dashboard Shell & Account Identity
**Areas discussed:** Page structure & navigation, Placeholder vs empty states, Identity header contents, Unsupported banners & import chrome, Document title & privacy surfaces, Nav behavior details, Section component contract, State copy & reduced-motion polish

---

## Page structure & navigation

| Question | Options | Selected |
|----------|---------|----------|
| Layout / navigation | Single scroll + sticky anchor nav; plain stacked scroll; tabs (bits-ui) | Single scroll + sticky anchor nav |
| Sections | Activity/Stats/Finance/Logins; merge Stats+Finance; one per source category | One per source category |
| Activity_history feeds Phases 4 and 6 | One section with sub-headings; two nav entries | One section with sub-headings |
| Nav link to unsupported block | Supported only with status; include unsupported link; plain links | Include unsupported block link |
| Nav shows empty status | Muted style for empty; identical links | Muted style for empty |
| Sticky behaviour | All widths; desktop only | All widths |
| Section order | Activity, Stats, Payments, User info, Unsupported; alphabetical | Activity, Stats, Payments, User info, Unsupported |

**Notes:** The first attempt at the layout question was dismissed and the command re-run; the four areas were kept and the discussion restarted at this question.

---

## Placeholder vs empty states

| Question | Options | Selected |
|----------|---------|----------|
| Present category, dashboard not built | Data summary + coming soon; bare placeholder; raw preview table | Data summary + coming soon |
| Supported category absent | Greyed + "not in this export"; greyed + hint why | Greyed + "not in this export" |
| Present but zero rows | Same as missing, different wording; treat as present | Same as missing, different wording |
| Per-title absence in Player_statistics | Defer to Phase 5; four title rows now | Defer to Phase 5 |
| Collapsible sections | No; collapsible | No, always expanded |
| A11y for greyed sections | Visible text status; aria-disabled only | Visible text status |

---

## Identity header contents

| Question | Options | Selected |
|----------|---------|----------|
| Header layout (first ask) | Title + region line; key-value grid; chip row | Free text: username can change, research it and repeat |
| Account ID | Drop; keep as small secondary line | Keep as small secondary line |
| Region display (first ask) | Raw; friendly mapping | Free text: accounts can migrate regions, research and repeat |
| Header layout (repeat) | Title labelled "as of export"; title no qualifier; grid with caption | Title labelled "as of export" |
| Region (repeat) | Raw labelled "Region (per export)"; friendly mapping; hide if blank | Raw labelled "Region (per export)" |
| Missing User_Info fields | Placeholders; hide missing | Placeholders ("Unknown") |
| Created date | Date only; date and time | Date only, as written |
| Multiple Account_Info rows | First row; row matching account root | Row matching account root |
| Keep LOGIN out of the page | Worker sends 3-field object; also drop at write time; main thread filters | Also drop at write time |
| Columns to strip | LOGIN+BIRTH_DATE(+SRC); LOGIN only; more | LOGIN, BIRTH_DATE, BIRTH_DATE_SRC |
| Existing caches | Bump schema and discard; migrate; leave alone | Bump schema and discard |
| Identity source on return visit | Meta record; query rows | Meta record |

**Notes:** Web research findings (Wargaming support pages): nickname changes cost 2,500 gold/doubloons, once every 14 days, old name locked 30 days; no individual region transfers except mass events; account linking since Oct 2024. These led to the "as of export" caption and raw region display.

---

## Unsupported banners & import chrome

| Question | Options | Selected |
|----------|---------|----------|
| Banner form | One per category, identical; one combined banner | One per category, identical |
| Badge list and summary line | Retire; keep as compact summary | Retire |
| Location of controls | Top Import bar; footer; keep Phase 2 layout | Top Import bar |
| Two destructive buttons | Keep both; merge | Keep both |
| Dashboard during processing/notices | Stays visible, status in Import bar; hidden | Stays visible |
| First visit | Dropzone only; full skeleton, greyed | Full dashboard skeleton, greyed |
| Skeleton wording | "No export loaded yet" wording; reuse "not in this export" | Distinct "Drop an export…" wording |
| Skeleton dropzone | Full-size at top; slim bar | Full-size at top |

---

## Document title & privacy surfaces

| Question | Options | Selected |
|----------|---------|----------|
| Tab title | Static app name; include nickname | Static app name |
| Where nickname may appear | Header only; plus mask toggle | Header only |
| Leak test | Playwright with synthetic email; unit-level only | Playwright check |

---

## Nav behavior details

| Question | Options | Selected |
|----------|---------|----------|
| Scroll-spy | IntersectionObserver; none | IntersectionObserver |
| Scrolling | Native anchors, motion-guarded smooth; JS-driven | Native anchors |
| URL hash | Hash only, nothing restored; avoid changing URL | Hash only |

---

## Section component contract

| Question | Options | Selected |
|----------|---------|----------|
| Wrapper | DashboardSection with status prop + snippet; each phase builds its own | DashboardSection |
| Status logic | One pure function from ClassifyResult; each section inspects | One pure function |
| Pending after later phase ships | Replaced by snippet, counts stay as caption; whole body replaced | Counts stay as caption |

---

## State copy & reduced-motion polish

| Question | Options | Selected |
|----------|---------|----------|
| During cache check | Spinner only; skeleton immediately | Spinner only |
| Notice location | One slot in Import bar; keep Phase 2 locations | One slot in Import bar |
| Motion | No new animations; add section fade-in | No new animations |

---

## Claude's Discretion

- Visual styling of nav, muted states, captions, Import bar within the existing palette.
- Exact wording of state copy, keeping the distinctions locked.
- Component/file naming and the worker-messages shape for the identity object.

## Deferred Ideas

- Hide-nickname / screenshot mask toggle.
- Per-title empty states in Player_statistics (Phase 5).
- Collapsible sections and phone-width nav (Phase 7 if needed).
