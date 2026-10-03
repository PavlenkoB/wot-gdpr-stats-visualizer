/**
 * The shared sample's account-root folder name.
 *
 * A LEAF: this module imports nothing, and that is the whole reason it
 * exists.
 *
 * `export-fixtures.ts` imports the Phase 5 data modules (`finance-fixtures.ts`
 * and `player-stats-fixtures.ts`) so the sample carries real headers and real
 * file names instead of a transcribed copy. Both of those import `mulberry32`
 * from `sessions-fixtures.ts`, which used to reach back into
 * `export-fixtures.ts` for this one constant — closing the cycle
 *
 *   export-fixtures → finance-fixtures → sessions-fixtures → export-fixtures
 *
 * A cycle is not merely untidy here: the module BODY of `export-fixtures.ts`
 * reads the data modules' exports (the count constants below), and when a test
 * file imports `finance-fixtures.ts` FIRST, `export-fixtures.ts` evaluates
 * while `finance-fixtures.ts` is still mid-evaluation, so those bindings are
 * undefined and every test in the file dies with
 * `TypeError: Cannot read properties of undefined (reading 'length')`.
 * `05-03` hit exactly this and worked around it by transcribing the two
 * finance headers by hand; this module removes the need for the workaround.
 *
 * The rule this encodes is the leaf-module rule the fixture README states:
 * a DATA module may import this, never the other way round.
 */

/** The synthetic account-ID folder every sample export is keyed under. */
export const SAMPLE_ACCOUNT_ROOT = '123456789';
