// Test-side locale pin for Playwright (05-08, D-25).
//
// The app groups numbers by the viewer's locale. `playwright.config.ts` pins
// the *browser* to `en-US` so the rendered DOM is stable, but a spec that calls
// a formatter in Node compares that DOM against a number grouped by Node's own
// default — which comes from `LANG`/`LC_ALL` on whatever machine ran the suite.
// Those two defaults are independent, and when they disagree the assertion
// fails on the machine's configuration rather than on the app.
//
// Pinning here is the same move as `tests/unit/setup.ts`, for the same reason:
// determinism belongs to the tests, the app keeps the viewer's locale. Import
// this for its side effect from any spec that formats numbers in Node:
//
//   import './pin-locale';
//
// The 05-08 tracer asserts that every spec importing `ui-copy` also imports
// this module, so a new spec cannot quietly reintroduce the split default.
import { setDefaultNumberLocale } from '../../src/lib/ui-copy';

setDefaultNumberLocale('en-US');
