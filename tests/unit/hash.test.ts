import { describe, expect, test } from 'vitest';
import { digestFile } from '../../src/lib/worker/hash.ts';

// =============================================================================
// digestFile — SHA-256 of raw zip bytes (RESEARCH.md Pattern 1)
// =============================================================================
//
// Why this file exists (02-01-PLAN Task 3, Test 1, RED then GREEN):
//   The hash dedup gate (IMPORT-06 / SC3) depends on a deterministic
//   SHA-256 over the raw zip bytes. `digestFile` runs before
//   listEntryPaths — a regression that returns a non-digest
//   (truncated, uppercase-hex, etc.) would silently break the
//   duplicate-detection branch in ingest.worker.ts.
//
// The two testable invariants per the plan's Behavior block:
//   1. digestFile(bytes) returns a 64-char lowercase hex SHA-256 —
//      identical bytes produce identical output, a one-byte change
//      produces different output.
//   2. The empty-input case is still a valid digest (sha256("") is a
//      well-known constant), proving the implementation doesn't special-
//      case the zero-length path.
//
// Crypto.subtle is available in both Node 20+ and the Web Worker
// global scope, so this test exercises the real WebCrypto path the
// worker will use — no stubbing.
// =============================================================================

describe('digestFile — SHA-256 lowercase hex', () => {
  test('returns the canonical SHA-256 of the ASCII string "abc" as 64 lowercase hex chars', async () => {
    const bytes = new TextEncoder().encode('abc');
    const hex = await digestFile(bytes);
    // sha256("abc") — well-known constant per FIPS 180-4.
    expect(hex).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  test('returns a 64-character string of [0-9a-f] for arbitrary bytes', async () => {
    const bytes = new Uint8Array([0, 1, 2, 3, 254, 255, 0xaa, 0xbb]);
    const hex = await digestFile(bytes);
    expect(hex).toHaveLength(64);
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
  });

  test('identical input bytes produce identical output (deterministic)', async () => {
    const a = new TextEncoder().encode('wargaming-data-export');
    const b = new TextEncoder().encode('wargaming-data-export');
    const [ha, hb] = await Promise.all([digestFile(a), digestFile(b)]);
    expect(ha).toBe(hb);
  });

  test('a one-byte difference produces a different digest', async () => {
    const a = new TextEncoder().encode('wargaming-data-export');
    const b = new TextEncoder().encode('wargaming-data-exporT'); // trailing 'T' instead of 't'
    const [ha, hb] = await Promise.all([digestFile(a), digestFile(b)]);
    expect(ha).not.toBe(hb);
  });

  test('empty input still produces a valid 64-char lowercase hex digest (sha256 of empty)', async () => {
    const hex = await digestFile(new Uint8Array(0));
    expect(hex).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});
