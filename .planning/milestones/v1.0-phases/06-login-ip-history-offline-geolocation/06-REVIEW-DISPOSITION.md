---
phase: 06-login-ip-history-offline-geolocation
review: 06-REVIEW.md
recorded: 2026-10-04
---

# Phase 06 review disposition

One row per finding in `06-REVIEW.md`. Every row starts `open`; a later fix or an explicit
decision updates it. Written by the orchestrator directly, not through the embedded
record-builder.

| ID | Severity | Disposition | Reason |
|----|----------|-------------|--------|
| CR-01 | critical | fixed | IPv6 dotted-tail group count wrong both ways (`src/lib/geo/ip.ts`) Fixed in plan 06-15 (77e9609, b046956). |
| CR-02 | critical | fixed | IPv4-mapped IPv6 gets no city lookup (`ingest.worker.ts`, `range-table.ts`) Fixed in plan 06-17 (7e1a5d1). |
| WR-01 | warning | fixed | Reader allocates from header counts before validating |
| WR-02 | warning | fixed | Inflate cap 200 MB vs decoder cap 96 MB, peak ~400 MB |
| WR-03 | warning | fixed | Worker-only import ban misses sibling relative imports |
| WR-04 | warning | fixed | Worker network denylist holes (`import()`, `eval`, nested `Worker`, ...) |
| WR-05 | warning | fixed | `LoginHistory.svelte` imports a type that does not exist; `tsc -b` skips `.svelte` Fixed in plan 06-16 (6846a54, 1f83ed9). |
| WR-06 | warning | fixed | `--fixture --download` overwrites the committed city fixture |
| WR-07 | warning | fixed | Plain-body path unreachable; hash/length are of the gzipped form |
| IN-01 | info | open | `<p>` inside `dl > div` is invalid HTML |
| IN-02 | info | open | City file country code not validated |
| IN-03 | info | open | `new Uint8Array(msg.buffer)` outside the try/catch |
| IN-04 | info | open | Nested overlap silently drops the earlier range's tail |
| IN-05 | info | open | Build tooling robustness (http redirect, temp-file leak, range floor, `$` in alias). Redirect sub-item fully fixed (T-06-17/T-06-36): every redirect hop is checked for https before it is requested, d7f20e1 (120f40d alone checked only the final URL and was bypassable by an https -> http -> https chain); still open: partial temp-file leak on a failed download, no floor on parsed range counts, `$` in the repo path breaking the alias replacement in `scripts/geo/lib/geo-alias.ts:83`. |
| IN-06 | info | open | CI PRs on a self-hosted runner (pre-existing) |
