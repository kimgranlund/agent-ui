import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'

// The browser-truth runner (decomp s12) — a SEPARATE vitest config from the jsdom inner loop
// (`vitest.config.ts`). Real engines (Playwright-driven Chromium + WebKit) are where @scope, the
// dimensional ramp, real computed geometry and the AX tree are actually true; jsdom can't resolve them.
// Run with `npm run test:browser`. Split into THREE vitest PROJECTS (the `test.projects` array — vitest 4's
// inline replacement for `vitest.workspace.ts`): `packages` (the framework's own *.browser.test.ts), `site`
// (the docs-site's own *.browser.test.ts, e.g. site/lib/component-preview.browser.test.ts), and `visual`
// (ADR-0110 — the pixel-diff harness, opt-in by filename). All three `extends: true` off this root config,
// inheriting the browser instances below (the jsdom config excludes the `*.browser.test.ts` glob entirely,
// so these suites never collide with it). No resolve aliases: the workspace packages are symlinked under
// node_modules and Vite resolves the bare `@agent-ui/*` specifiers (incl. the `./components` + CSS
// subpaths, and the barrels' inner `@import '@agent-ui/shared/...'`) through their package `exports` map.
// vitest 4.1 takes the provider as a factory from `@vitest/browser-playwright` (no longer a string).
//
// HEAP: the full-suite `npm run test:browser` runs the MAIN vitest process as the single node-side
// orchestrator for all three projects × both engines (~190 file×engine runs). Browser test bodies run in
// the Playwright-driven engines (separate OS processes), but this one node process holds the whole Vite
// module graph (framework + a2ui + site, transformed and cached) PLUS every collected task tree / result /
// error for the run, accumulating and only freeing at the end. Node's default old-space ceiling is ~4 GB;
// under a normal run this footprint alone (~4.3 GB) is enough to cross it. But the DOMINANT, contention-
// sensitive driver isn't suite size — it's an UNBOUNDED error-accumulation cascade from the known a2ui-live
// orchestrator-protocol poisoning (fetch interception bleeding into vitest-browser's own fetch-based
// protocol, site/lib/command-palette.browser.test.ts:51-54's documented pathology): under contention this
// throws tens of thousands of "Unknown event" errors, string-concatenated into gigabytes, review-verified
// during issue #22. That's why the crash was intermittent/scheduling-dependent rather than a hard suite-
// size ceiling. The `test:browser` npm script prefixes `NODE_OPTIONS=--max-old-space-size=8192` (8 GB) as
// the immediate fix (raising the ceiling, not sharding — this is single-process accumulation, not per-
// worker concurrency), but this ceiling can still be exceeded under heavy contention if that cascade fires
// long enough (as it has before — see llms-full.txt's 2026-07-09 note). The durable fix is bounding/root-
// causing the a2ui-live cascade itself (a follow-up issue, filed alongside #22's close) — bump this number
// only as a stopgap, and do not paper over either problem with test timeouts.

export default defineConfig({
  test: {
    // Teardown force-kill window. The default 10s manifested as a ~10s "close timed out after 10000ms /
    // something prevents the main process from exiting" hang on every standalone `test:visual` run — a
    // generic dangling node handle AFTER the browsers close, NOT the WebKit shell (measured 2026-07-08:
    // the hang persisted chromium-only; 1s teardown was clean; full `test:browser` never hangs). 2s
    // leaves headroom over the measured-fine 1s.
    teardownTimeout: 2000,
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      // The fleet default viewport, now EXPLICIT (it was vitest's own 414×896 default, silently). Made a
      // documented contract by ADR-0150: 414px sits BELOW the 52.5rem/840px compact-window body line, so at
      // this default every document-typography assertion sees the COMPACT body register (13/15/11px), not
      // the M3-verbatim base (14/16/12px). Any browser test pinning an absolute body-role px MUST pin its
      // viewport to the intended side of the line first (text.browser.test.ts is the worked example — its
      // file-level beforeAll pins 1024×768 for the M3-base legs, one describe drops to 800×600 for the
      // compact legs). Interaction suites that assert no body-role px run here unchanged.
      viewport: { width: 414, height: 896 },
      instances: [{ browser: 'chromium' }, { browser: 'webkit' }],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'packages',
          include: ['packages/agent-ui/*/src/**/*.browser.test.ts'],
          // *.visual.browser.test.ts ends with .browser.test.ts too (glob `*` crosses `.`) — exclude it
          // explicitly so a visual file is routed to the `visual` project ONLY, never double-run here.
          exclude: ['**/*.visual.browser.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'site',
          include: ['site/**/*.browser.test.ts'],
          exclude: ['**/*.visual.browser.test.ts'],
        },
      },
      {
        // `extends: false` — the ONE project that does NOT inherit the root browser block. Under
        // `extends: true` the parent's `instances` array CONCATENATES (re-pinning chromium collides:
        // "Cannot define a nested project for a chromium browser … already defined", verified against
        // the installed vitest 4.1.9 merge), so the first realization carried BOTH engines and skipIf'd
        // WebKit — 4 phantom skips per run. Standalone duplication of the browser block with a
        // chromium-only instance eliminates the WebKit shell and the skips outright (measured
        // 2026-07-08); `it.skipIf(server.browser !== 'chromium')` in the visual legs stays as a cheap
        // belt-and-braces guard. COST: edits to the ROOT browser block do not propagate here — keep the
        // enabled/provider/headless trio in sync by hand.
        extends: false,
        test: {
          name: 'visual',
          include: ['**/*.visual.browser.test.ts'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: 'chromium' }],
            // The fleet's default viewport (414×896, a mobile-sized default meant for the interaction
            // suites) clips a wide/stretched fixture's screenshot before the layout does — a real capture
            // constraint, not a CSS bug (verified: the SAME 600px `mountStretched` helper's
            // `getBoundingClientRect()` assertions pass fine at the default viewport in
            // calendar.browser.test.ts; only the PIXEL CAPTURE was truncated to ~483px). Visual legs get
            // a wider viewport so a wide-panel gestalt captures whole.
            viewport: { width: 900, height: 900 },
            // Chromium-only pixel truth (Decision 2) — realized as the `extends: false` chromium-only
            // instance above (see the project-level comment for the instances-concat history). WebKit
            // keeps the computed-style/whole-shape legs as its sanctioned proof.
            expect: {
              toMatchScreenshot: {
                comparatorName: 'pixelmatch',
                comparatorOptions: {
                  includeAA: false,
                  threshold: 0.1,
                  allowedMismatchedPixelRatio: 0.01,
                },
                // The full `npm run test:browser` gate (Decision 8) runs ALL THREE projects × both
                // engines concurrently — real CPU contention that the standalone `test:visual` run never
                // sees. The bundled comparator's retry-until-stable capture needs more than its 5s
                // default under that load (observed: "Could not capture a stable screenshot within
                // 5000ms" on an otherwise-passing leg, reproduced twice under `test:browser`, never under
                // isolated `test:visual`) — raised, not the pixel tolerance.
                timeout: 20_000,
                // ADR-0110 — pins committed pixel baselines to a co-located, TRACKED `__baselines__/`
                // folder (vs. the default `__screenshots__/`, which `.gitignore` blankets as on-failure
                // debris). Only the REFERENCE image path moves; `resolveDiffPath` stays the vitest
                // default (`.vitest-attachments/`, already gitignored) — committed truth and run debris
                // never share a folder (Decision 3).
                resolveScreenshotPath: ({ root, testFileDirectory, testFileName, arg, browserName, platform, ext }) =>
                  resolve(root, testFileDirectory, '__baselines__', testFileName, `${arg}-${browserName}-${platform}${ext}`),
              },
            },
          },
        },
      },
    ],
  },
})
