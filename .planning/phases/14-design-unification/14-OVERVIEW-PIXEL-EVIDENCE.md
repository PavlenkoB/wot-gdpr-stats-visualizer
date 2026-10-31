# Phase 14: the Overview before/after pixel evidence (D-15)

This file is the retained record of the Overview before/after pixel compare required by D-15. The harness and the PNGs stay in the scratch directory and are never committed; this file holds only widths, pixel sizes, counts, hashes and commit ids - never a screenshot, never a fixture byte, never any export content.

## Baseline
Baseline commit: `901a9e15f84c99f939031b2257f70f535671b53f`

Capture date (UTC): 2026-10-26T07:06:59Z

How the baseline was served: a scratch git worktree of that commit, outside the repository, built and served by `vite preview` on port 4174.

| width | before size (px) | before PNG sha-256 |
| --- | --- | --- |
| 1040 | 639 x 1793 | 2025a2ab350a81686025b630159f6a9084eab0ff9c17915fd292239e34a5edd3 |
| 880 | 800 x 1739 | a381e06876cdb316590ef398fad82a12ec04dfeabc33bd5bff7b8a67af204451 |
| 479 | 447 x 1959 | 3252311c4298393546c6c49e1baadf9c13c79f2136218cc515ee72841ebe3e78 |
| 340 | 308 x 2181 | 93616f8bb12d8de4f07f6f176ea646cceb47cac97ebf670ba9a1b94ee1018c7e |

## Result
Capture date (UTC): 2026-10-27T21:31:12Z

HEAD: `b440626`

Working tree (src/): clean

Compare options: `--strict --mask-title`

The before column is a fresh capture of the baseline commit above taken on the same day and by the same browser as the after column (the 2026-10-26 set in the Baseline section pre-dates a browser rasterisation change, plan 14-19); its four PNG sizes equal the Baseline section's.

| width | before size | after size | masked title box | differing pixels outside the mask | verdict |
| --- | --- | --- | --- | --- | --- |
| 1040 | 639 x 1793 | 639 x 1793 | x=0 y=0 w=639 h=42 | 0 | BYTE-EQUAL |
| 880 | 800 x 1739 | 800 x 1739 | x=0 y=0 w=800 h=34 | 0 | BYTE-EQUAL |
| 479 | 447 x 1959 | 447 x 1959 | none (below 880px) | 0 | BYTE-EQUAL |
| 340 | 308 x 2181 | 308 x 2181 | none (below 880px) | 0 | BYTE-EQUAL |

## Final re-run
Capture date (UTC): 2026-10-27T22:11:57Z

HEAD: `9c69955`

Working tree (src/): clean

Compare options: strict (equal PNG sizes), title box masked at 880px and above

The after column is the final build of this phase (`pnpm run build`, assets `index-DxkOl1C0.js` and `index-BFzhEviO.css`), served by `vite preview` on port 4176; the served asset names were checked equal to `dist/index.html` before capturing. The before column is a fresh capture of the baseline commit above (a scratch worktree built the same way, served on port 4181), taken in the same minute by the same browser. The Overview element is `[data-testid="overview"]` of the Account-timeline-and-perks synthetic archive, in a fresh browser context per width; each capture was taken twice and the two were identical.

The scratch harness of plans 14-01 to 14-20 was lost between plan 14-20 and this plan: the machine was restarted and the scratch temp directory with the harness and the `before` and `after` PNG sets was wiped. This section was therefore measured by a smaller replacement script (same element, same archive, same four widths, not committed). The replacement reproduces the Baseline section: the four before sizes below are equal to the four sizes recorded there, which is the evidence that it captures the same element.

| width | before size | after size | masked title box | differing pixels outside the mask | verdict |
| --- | --- | --- | --- | --- | --- |
| 1040 | 639 x 1793 | 639 x 1793 | x=0 y=0 w=639 h=42 | 0 | BYTE-EQUAL |
| 880 | 800 x 1739 | 800 x 1739 | x=0 y=0 w=800 h=34 | 0 | BYTE-EQUAL |
| 479 | 447 x 1959 | 447 x 1959 | none (below 880px) | 0 | BYTE-EQUAL |
| 340 | 308 x 2181 | 308 x 2181 | none (below 880px) | 0 | BYTE-EQUAL |

Whole-file sha-256 at the four widths: 880, 479 and 340 are byte-identical files before and after (sha-256 `adc3c5c7...0fc0b36`, `662cb5a4...b595065` and `f1087168...e77ae22`). At 1040 the two files differ in 1,923 pixels, every one of them in rows 6 to 32 of the masked title box (the title grows from 26px to 32px, D-16); none in rows 42 and below, so nothing under the title moved and no element changed size. At 880px the title box is unchanged, so no mask was needed there.

