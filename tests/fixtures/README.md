# Test fixtures

fixture=synthetic

All committed test zips used by the e2e suite are generated **in memory** by
`tests/fixtures/export-fixtures.ts` via `fflate.zipSync`. The synthetic zips
mirror the real Wargaming export's folder and column structure (verified against
the real 2021 sample described in `.planning/PROJECT.md`), but every value is
fabricated:

- Account ID: `123456789`
- Email / `LOGIN` field: `*.example.invalid` (RFC 6761 reserved TLD)
- IP addresses: `192.0.2.0/24` (TEST-NET-1, RFC 5737)

Real Wargaming exports must never be committed. If you need to test against a
real sample, place it under `tests/fixtures/private/` (gitignored) or anywhere
outside this repository.

## Policy

1. No real export binary may be committed.
2. The committed fixture set must always be regeneratable from
   `tests/fixtures/export-fixtures.ts` (it is the source of truth).
3. `tests/fixtures/private/` is reserved for local-only real samples and is
   gitignored at the repository root.
4. A root-level `*.zip` is also gitignored: a real export dropped at the repo
   root must never be staged.