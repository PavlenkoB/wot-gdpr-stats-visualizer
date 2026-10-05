import { describe, expect, it } from 'vitest';
import type { DataOutcome } from '../../../src/lib/core/query-client.ts';
import type { LoginsView } from '../../../src/lib/features/logins/login-shared.ts';
import {
  acceptLoginsOutcome,
  deriveLoginState,
  maskStateFor,
  type ShownLogins,
} from '../../../src/lib/features/logins/login-state.ts';

// =============================================================================
// The login block's state machine (06-08, Task 1)
//
// WHY UNIT TESTS AND NOT A COMPONENT TEST
// Vitest has no Svelte plugin and runs with `environment: 'node'`
// (vitest.config.ts), so a component cannot be rendered here at all. What IS
// testable without a DOM is exactly what this file covers, and what IS worth
// covering: which state a block renders for each combination of dataset and
// answer, which answers may be shown at all, and when the mask resets.
//
// The three groups below are the three failures 06-08's threat model names —
// T-06-30 (a stale answer under a new dataset), T-06-31 (a worker detail
// reaching the screen) and T-06-29 (a mask that outlives its dataset) — and
// each is reachable from a plain object literal, which is why the block is
// ordinary functions rather than branches in a template.
// =============================================================================

const DATASET = '2026-10-01T10:00:00.000Z';
const OTHER_DATASET = '2026-10-02T10:00:00.000Z';

const READY_VIEW: LoginsView = {
  status: 'ready',
  filesWithRows: 1,
  addresses: [],
  totalLogins: 0,
  unreadableRows: 0,
  unknown: { addresses: 0, logins: 0 },
  countries: [],
  other: { addresses: 0, logins: 0 },
  first: null,
  last: null,
  account: null,
};

const viewOutcome: DataOutcome<'logins'> = {
  kind: 'result',
  queryId: 1,
  importedAt: DATASET,
  result: { channel: 'logins', view: READY_VIEW },
};

function shownOf(importedAt: string, view: LoginsView = READY_VIEW): ShownLogins {
  return { kind: 'view', importedAt, view };
}

describe('deriveLoginState', () => {
  it('is loading with no dataset on screen, whatever it is holding', () => {
    expect(deriveLoginState({ importedAt: null, shown: null })).toBe('loading');
    expect(deriveLoginState({ importedAt: null, shown: shownOf(DATASET) })).toBe('loading');
  });

  it('is loading with a dataset and no answer yet', () => {
    expect(deriveLoginState({ importedAt: DATASET, shown: null })).toBe('loading');
  });

  it('is loading when the answer is for a DIFFERENT dataset (T-06-30)', () => {
    // The replace case: a new export is on screen and the old answer is still
    // in the cell. A reset hook that somebody forgot would show the old
    // addresses here; a stamp that cannot be separated from its value cannot.
    expect(deriveLoginState({ importedAt: DATASET, shown: shownOf(OTHER_DATASET) })).toBe(
      'loading',
    );
  });

  it('is loading when a failed answer is for a different dataset', () => {
    // A failure about a replaced dataset must never become an error about the
    // export now on screen.
    expect(
      deriveLoginState({
        importedAt: DATASET,
        shown: { kind: 'failed', importedAt: OTHER_DATASET },
      }),
    ).toBe('loading');
  });

  it('is error for a failed answer about this dataset', () => {
    expect(
      deriveLoginState({ importedAt: DATASET, shown: { kind: 'failed', importedAt: DATASET } }),
    ).toBe('error');
  });

  it("passes the view's own status through, and keeps the two empty states apart", () => {
    expect(deriveLoginState({ importedAt: DATASET, shown: shownOf(DATASET) })).toBe('ready');
    expect(
      deriveLoginState({
        importedAt: DATASET,
        shown: shownOf(DATASET, { status: 'no-source' }),
      }),
    ).toBe('no-source');
    expect(
      deriveLoginState({
        importedAt: DATASET,
        shown: shownOf(DATASET, { status: 'no-usable', unreadable: 3 }),
      }),
    ).toBe('no-usable');
  });
});

describe('acceptLoginsOutcome', () => {
  it('admits a result for the dataset on screen and stamps it with the ASK', () => {
    const accepted = acceptLoginsOutcome(viewOutcome, DATASET, DATASET);
    expect(accepted).toEqual({ kind: 'view', importedAt: DATASET, view: READY_VIEW });
  });

  it('stamps with the ask rather than with anything the reply said about itself', () => {
    // The reply claims a different dataset than the ask. The ask is the
    // question this block actually put, and the record is stamped with IT — so
    // a reply that disagrees with the ask is dropped rather than trusted.
    const otherStamp: DataOutcome<'logins'> = { ...viewOutcome, importedAt: OTHER_DATASET };
    expect(acceptLoginsOutcome(otherStamp, DATASET, DATASET)).toBeNull();
  });

  it('drops a superseded outcome', () => {
    const superseded: DataOutcome<'logins'> = { kind: 'superseded', queryId: 1 };
    expect(acceptLoginsOutcome(superseded, DATASET, DATASET)).toBeNull();
  });

  it('drops a result for a dataset that is no longer on screen (T-06-30)', () => {
    // The ask and the reply agree; the PAGE moved on while the worker read.
    expect(acceptLoginsOutcome(viewOutcome, OTHER_DATASET, DATASET)).toBeNull();
  });

  it('drops every answer once nothing is on screen', () => {
    expect(acceptLoginsOutcome(viewOutcome, DATASET, null)).toBeNull();
  });

  it('drops a result stamped with no dataset', () => {
    const unstampped: DataOutcome<'logins'> = { ...viewOutcome, importedAt: null };
    expect(acceptLoginsOutcome(unstampped, DATASET, DATASET)).toBeNull();
  });

  it('drops a result with no view at all', () => {
    const nullResult: DataOutcome<'logins'> = { ...viewOutcome, result: null };
    expect(acceptLoginsOutcome(nullResult, DATASET, DATASET)).toBeNull();
  });

  it("drops another channel's view", () => {
    // `QueryClient.handle` settles this as an error before it arrives, so this
    // is the second gate — the one that does not depend on that client keeping
    // its check.
    const wrongChannel: DataOutcome<'logins'> = {
      kind: 'result',
      queryId: 1,
      importedAt: DATASET,
      result: { channel: 'premium', view: { status: 'ready' } },
    } as unknown as DataOutcome<'logins'>;
    expect(acceptLoginsOutcome(wrongChannel, DATASET, DATASET)).toBeNull();
  });

  it('turns a failure into a failed record with NO detail carried (T-06-31)', () => {
    const failed = acceptLoginsOutcome(
      { kind: 'error', queryId: 1, detail: 'worker unavailable' },
      DATASET,
      DATASET,
    );
    expect(failed).toEqual({ kind: 'failed', importedAt: DATASET });
    // Structurally, not by convention: the record has nowhere to hold a
    // worker string, so the block cannot render one even by accident.
    expect(Object.keys(failed ?? {})).toEqual(['kind', 'importedAt']);
  });
});

describe('maskStateFor', () => {
  it('is masked on every load, because the first stamp is not this dataset', () => {
    expect(maskStateFor({ importedAt: null, revealed: false }, DATASET)).toBe(false);
  });

  it('is masked after a replace, whatever the user had chosen before (D-07)', () => {
    expect(maskStateFor({ importedAt: DATASET, revealed: true }, OTHER_DATASET)).toBe(false);
  });

  it('is masked after a Clear', () => {
    expect(maskStateFor({ importedAt: DATASET, revealed: true }, null)).toBe(false);
  });

  it('keeps the user own choice for the SAME dataset', () => {
    // A re-query, a re-render or a sort must not silently re-mask a block the
    // reader deliberately opened.
    expect(maskStateFor({ importedAt: DATASET, revealed: true }, DATASET)).toBe(true);
    expect(maskStateFor({ importedAt: DATASET, revealed: false }, DATASET)).toBe(false);
  });
});
