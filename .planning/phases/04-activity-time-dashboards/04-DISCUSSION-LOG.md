# Phase 4: Activity Time Dashboards - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-29
**Phase:** 4-Activity Time Dashboards
**Areas discussed:** Timezone basis, Hours-played semantics, Calendar heatmap, Session-duration distribution

---

## Timezone basis

| Option | Description | Selected |
|--------|-------------|----------|
| As recorded | Show timestamps as written, labeled as recorded in the export; no toggle in v1 | ✓ |
| Browser local | Convert to viewer's timezone assuming UTC | |
| Toggle | Offer both with a switch; needs re-aggregation and more copy | |

**User's choice:** As recorded
**Notes:** Recommended option taken.

---

## Hours-played semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Merge overlaps | Merge overlapping sessions; start-day attribution; skip and count bad rows | |
| Plain sum | Sum every duration as written | |
| Split by title | Break totals down by game or platform | ✓ |

**User's choice:** Split by title
**Notes:** Sessions.csv has no game column, so a follow-up card asked how the split behaves. Merge-overlap, start-day attribution and bad-row skipping were kept as the baseline rules (D-02); Claude took these defaults because the chosen option adds the split rather than replacing them. The user can overrule this in CONTEXT.md before planning.

### Follow-up: how the split behaves

| Option | Description | Selected |
|--------|-------------|----------|
| Filter all charts | Selector above the charts; every chart and total recomputes | |
| Totals only | Breakdown beside totals; charts stay combined | |
| Filter, All default | Selector plus summary lists each value's hours | ✓ |

**User's choice:** Filter, All default

---

## Calendar heatmap

| Option | Description | Selected |
|--------|-------------|----------|
| Hours, stacked | Cell shows hours; all years stacked | ✓ |
| Sessions, stacked | Cell shows session count | |
| Hours, year picker | One year at a time | |

**User's choice:** Hours, stacked
**Notes:** Recommended option taken.

---

## Session-duration distribution

| Option | Description | Selected |
|--------|-------------|----------|
| Named buckets | Fixed buckets with a 4h+ bucket and median text | |
| Log-scaled bins | Logarithmic bins adapting to data | ✓ |
| Named + percentiles | Named buckets plus median, p90 and longest | |

**User's choice:** Log-scaled bins
**Notes:** Overrode the recommended option.

---

## Claude's Discretion

- Precomputed-per-slice vs on-demand aggregation
- Whether to add median or percentile text
- Palette, cell size, tooltip styling, bin edges and labels
- Data-table or text fallback for charts

## Deferred Ideas

- Local-timezone toggle
- Median and percentile statistics
- Touch tooltips and phone layout (Phase 7)
- Per-title Player_statistics (Phase 5)
