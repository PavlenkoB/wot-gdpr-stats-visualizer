---
phase: 08
review: 08-REVIEW.md
titles: json
findings:
  - id: CR-01
    severity: critical
    disposition: fixed
    title: "List keyboard nav steps from the selected row instead of the focused row (fixed in ListPane.svelte, pinned in the (empty-state) e2e test)"
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "Import bar is rebuilt when the import region moves between the detail pane and the list pane, so the 'Cached data cleared' notice lands in a fresh live region (fixed by the persistent notice announcer in App.svelte, pinned in the dashboard.spec (cleared) and (single-live-region) tests)"
  - id: WR-02
    severity: warning
    disposition: open
    title: "Chart key handlers ignore modifier keys (Alt/Cmd + arrow swallowed while a chart cell has focus)"
  - id: WR-03
    severity: warning
    disposition: open
    title: "List keyboard routing is keyed on data-testid"
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "Import notices can sit below the visible part of the scrolling list pane at 900px and wider (already satisfied by the A-2 sticky import footer (quick 261008-x40), pinned at 1280x600 in master-detail-nav.spec)"
  - id: WR-05
    severity: warning
    disposition: fixed
    title: "ConfirmPanel has aria-modal but no Escape handling, focus trap or inert background; focus drops to body after a confirmed replace (fixed in ConfirmPanel.svelte (Escape, Tab wrap) and App.svelte (focus after a confirmed replace), pinned in dashboard.spec (start-over) and master-detail-nav.spec)"
  - id: IN-01
    severity: info
    disposition: open
    title: "Dead smooth-scroll suspension, stale nav comments and a 72px ChartTooltip fallback against --nav-offset 16px"
  - id: IN-02
    severity: info
    disposition: fixed
    title: "Feature components still hard-code legacy hex; the guard scans only src/lib/shell (all neutrals read tokens; guarded over all of src with an explicit allow-list (quick 261009-qbo))"
  - id: IN-03
    severity: info
    disposition: open
    title: "Guard tests are narrower than their names; gap between the 899px and 900px queries"
  - id: IN-04
    severity: info
    disposition: open
    title: "Dead exports (NAV_STATUS_SUFFIX, most SECTION_TITLES entries); the Not yet supported title lives in two tables"
  - id: IN-05
    severity: info
    disposition: open
    title: "Orphaned JSDoc in the e2e helpers"
  - id: IN-06
    severity: info
    disposition: open
    title: "Decorative glyphs sit inside the accessible names of the back button and the Overview card links"
  - id: IN-07
    severity: info
    disposition: open
    title: "formatImportedOn is fed an empty string when importedAt is missing, giving Invalid Date"
  - id: IN-08
    severity: info
    disposition: open
    title: "Detail screen structure: duplicate region names, no h1 on the phone detail screen, a p inside a dl group, hint paragraph inside a collapsed details that is an aria-describedby target"
---

# Phase 8 review disposition

CR-01 was verified against the code and fixed on this branch. WR-01, WR-04, WR-05 and IN-02 were closed by quick 261009-qbo (WR-04 was already satisfied by the A-2 sticky footer and is now pinned). Every finding still marked `open` is advisory; none was triaged by a person yet.
