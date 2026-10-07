import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// =============================================================================
// 07-01: the subpath base and the deployed-build gate (D-11, D-12, T-07-SC,
// T-07-04)
// =============================================================================
//
// The deploy path is where a mistake is most expensive and least visible: a
// wrong `base` 404s the worker on a live public URL, and a gate that silently
// rebuilt would test a build rather than the artifact that ships. Neither is
// something a browser test can catch on its own, because both are defects of
// the CONFIGURATION around the tests.
//
// So this file reads the configuration sources, the way
// `tests/unit/guards/geo-seam.test.ts` reads the files that select the geo
// fixture. Test files never import each other; they read the same text.
// =============================================================================

const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));

function readRepoFile(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), 'utf8');
}

/**
 * The geo fixture switch's name, assembled at runtime.
 *
 * The contract this file defends is that no file under `tests/deploy/` names
 * it. Writing the name here as a literal would make this file the one place
 * the string exists in the deploy-gate area, which is exactly what a grep for
 * it over that directory would find and complain about. Joining the halves
 * keeps the assertion exact and the text absent.
 */
const FIXTURE_SWITCH = ['GEO', 'FIXTURE'].join('_');

describe('07-01: the subpath base and the deployed-build gate', () => {
  describe('vite.config.ts carries the base, and nothing else changed', () => {
    const viteConfig = readRepoFile('vite.config.ts');

    it('reads the base from the environment with the root as the default', () => {
      const occurrences = viteConfig.split(`base: process.env.VITE_BASE ?? '/'`).length - 1;
      expect(occurrences, 'exactly one base line, so there is one place to change').toBe(1);
    });

    it('the default is the origin root, so every existing command is unchanged', () => {
      // The whole reason this is safe to land in a branch that is verified
      // locally: unset VITE_BASE must produce byte-identical URLs to the build
      // that has been shipping since phase 1.
      expect(viteConfig).toContain(`base: process.env.VITE_BASE ?? '/'`);
    });

    it('index.html was NOT edited to carry prefixed asset URLs', () => {
      // Vite rewrites the favicon, script and stylesheet references, and the
      // worker chunk URL, from `base` alone. A hand-edited index.html would be
      // a second, drifting source of the same truth — and it would break the
      // default build, where no prefix exists.
      const indexHtml = readRepoFile('index.html');
      expect(indexHtml).toContain('/favicon.svg');
      expect(indexHtml).toContain('/src/main.ts');
      expect(indexHtml).not.toContain('wot-gdpr-stats-visualizer');
    });

    it('the CSP policy array is untouched', () => {
      // D-15: this phase adds a subpath, not an origin. Baking one in would
      // make the policy wrong everywhere the app is not served from that host.
      for (const directive of [
        "default-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
      ]) {
        expect(viteConfig, directive).toContain(`"${directive}"`);
      }
      expect(viteConfig).not.toMatch(/wot-gdpr-stats-visualizer/);
    });

    it('the geo alias line the geo-seam guard reads is still there', () => {
      // `tests/unit/guards/geo-seam.test.ts` asserts this exact expression, so
      // a rewrite of it here would break a guard in a file that knows nothing
      // about this phase.
      expect(viteConfig).toContain('geoAliasEntries(process.env)');
    });
  });

  describe('the gate config serves the dist, and never builds one', () => {
    const gateConfig = readRepoFile('tests/deploy/playwright.gate.config.ts');

    it("the webServer runs the vite binary's preview subcommand", () => {
      expect(gateConfig).toContain('./node_modules/.bin/vite preview');
    });

    it('the webServer never runs a build', () => {
      // A gate that builds tests the build it made, not the artifact that gets
      // uploaded. The artifact is the one that leaves the machine, so it is the
      // one that has to be under test.
      expect(gateConfig).not.toMatch(/vite\s+build/);
      expect(gateConfig).not.toMatch(/pnpm\s+run\s+build/);
    });

    it("the webServer is rooted at the repository, not at the config's directory", () => {
      // This file lives two directories below the root. Without an explicit cwd,
      // vite preview would look for a dist inside tests/deploy and serve nothing.
      expect(gateConfig).toContain('cwd: REPO_ROOT');
    });

    it('the preview is told which base to mount at', () => {
      expect(gateConfig).toContain('env: { VITE_BASE: base }');
    });

    it('it never selects the geo fixture, and never names the switch', () => {
      // The browser tests build against the committed 377-byte documentation
      // country table. A DEPLOY build must carry the real table, or none — and
      // this config must not be able to decide that.
      expect(gateConfig).not.toContain(FIXTURE_SWITCH);
    });
  });

  describe('the default Playwright config can never list the deploy specs', () => {
    it('its testDir is still tests/e2e', () => {
      // The single strongest guarantee about the deploy specs is that the
      // pull-request e2e budget is untouched: they live outside testDir, so
      // `ci.yml` never counts them and no e2e run can pick one up by accident.
      expect(readRepoFile('playwright.config.ts')).toContain("testDir: 'tests/e2e'");
    });
  });

  describe('the gate runs both specs, and only the artifact one is browserless', () => {
    const gateConfig = readRepoFile('tests/deploy/playwright.gate.config.ts');

    it('the gate testMatch names the served spec and the artifact spec', () => {
      // A subpath proof is not a completeness proof: a file can be unserved and
      // still be uploaded. Both halves have to run before an upload.
      expect(gateConfig).toContain('deployed-build|dist-artifact');
      expect(gateConfig).toMatch(/testMatch:/);
    });

    it('the artifact spec uses no browser fixture', () => {
      // A deploy job would rather read a directory in milliseconds than launch
      // a browser to do it. This is what keeps that possible, so it is asserted
      // rather than left to review: a single `page` argument added to one test
      // in this file would make the whole spec need a browser.
      const artifactSpec = readRepoFile('tests/deploy/dist-artifact.spec.ts');
      expect(artifactSpec).not.toMatch(/async\s*\(\s*\{[^}]*\bpage\b/);
      expect(artifactSpec).not.toMatch(/async\s*\(\s*\{[^}]*\bbrowser\b/);
      expect(artifactSpec).not.toMatch(/\bpage\.(goto|click|evaluate)\b/);
    });
  });

  describe('the gate base is absolute and slash-terminated', () => {
    const gateConfig = readRepoFile('tests/deploy/playwright.gate.config.ts');

    it('the baseURL is the origin plus the base, with the trailing slash kept', () => {
      // The trailing slash is load-bearing, not cosmetic: the spec navigates
      // with `goto('./')`, and without the slash that resolves to the server
      // root — which the preview does serve, so a missing slash would produce a
      // confusing partial failure rather than an obvious one.
      expect(gateConfig).toContain('const baseURL = `http://localhost:4173${base}`;');
    });

    it('the base is validated to start and end with exactly one slash', () => {
      expect(gateConfig).toContain(
        "if (!base.startsWith('/') || !base.endsWith('/') || base.length < 2)",
      );
      expect(gateConfig).toContain('process.env.VITE_BASE || DEFAULT_BASE');
    });

    it('the default base is the Pages project subpath', () => {
      expect(gateConfig).toContain("const DEFAULT_BASE = '/wot-gdpr-stats-visualizer/';");
    });
  });
});
