import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'

// The browser-truth runner (decomp s12) — a SEPARATE vitest config from the jsdom inner loop
// (`vitest.config.ts`). Real engines (Playwright-driven Chromium + WebKit) are where @scope, the
// dimensional ramp, real computed geometry and the AX tree are actually true; jsdom can't resolve them.
// Run with `npm run test:browser`. Split into FOUR vitest PROJECTS (the `test.projects` array — vitest 4's
// inline replacement for `vitest.workspace.ts`): `packages` (the framework's own *.browser.test.ts), `site`
// (the docs-site's own *.browser.test.ts, e.g. site/lib/component-preview.browser.test.ts), `focus-timing`
// (GH #56 — a small, named set of focus/keyboard/scroll-timing files pulled out of `packages`/`site` and
// run with zero file parallelism, since they flake under concurrent-page focus contention; see that
// project's own comment below), and `visual` (ADR-0110 — the pixel-diff harness, opt-in by filename). All
// four `extends: true` off this root config, inheriting the browser instances below (the jsdom config
// excludes the `*.browser.test.ts` glob entirely, so these suites never collide with it). No resolve
// aliases: the workspace packages are symlinked under
// node_modules and Vite resolves the bare `@agent-ui/*` specifiers (incl. the `./components` + CSS
// subpaths, and the barrels' inner `@import '@agent-ui/shared/...'`) through their package `exports` map.
// vitest 4.1 takes the provider as a factory from `@vitest/browser-playwright` (no longer a string).
//
// HEAP (resolved 2026-07-19, GH #41): the full suite in ONE vitest process holds the whole Vite module
// graph (framework + a2ui + site) PLUS every collected task tree/result for ~190 file×engine runs, and
// that footprint OUTGREW the raised 8 GB ceiling as the suite grew — two crash specimens on 2026-07-19
// carried the plain "Ineffective mark-compacts near heap limit" signature and ZERO "Unknown event" lines,
// retiring #22-era theory that an a2ui-live fetch-interception error cascade was the dominant driver (no
// raw `fetch =` assignment exists in site/ or a2ui today; command-palette's stub is per-test scoped). The
// durable fix is STRUCTURAL, not a bigger number: `npm run test:browser` now runs the three projects as
// SEQUENTIAL SHARDS (packages → site → focus-timing → visual), each its own process whose peak sits far under node's
// default ceiling — the crash class is gone regardless of future suite growth, and no NODE_OPTIONS
// override is needed. Do not re-monolith the script or re-add a ceiling bump; if a single SHARD ever
// approaches the default ceiling, split that project further instead. Known cost: full-shard concurrency
// surfaces a focus/timing flake class in ~6 interaction files (each passes solo — GH #56 tracks granting
// those files isolation or hardening them).
//
// SECOND SPLIT (2026-07-19, vision-rev.5 wave): the `packages` shard itself crossed the ceiling —
// measured exit 134 ("Ineffective mark-compacts near heap limit") on origin/main @ 38a46a5 BEFORE the
// rev.5 diff (the admin PR streak #64–#78 only ever ran filtered suites, so the growth went unmeasured).
// Per this file's own law the SCRIPT split again: `test:browser:packages` now runs
// `:components` (packages/agent-ui/components — 71 of the 85 browser files) then `:rest` (everything
// else via `--exclude 'packages/agent-ui/components/**'` — complementary BY CONSTRUCTION, a new package's
// browser tests land in `:rest` automatically, nothing silently drops). Same one-project config here;
// only package.json's invocation sharding changed. THIRD SPLIT (same day): `:rest` itself flipped 134
// under load once the M5 super-shell wave grew the app package — `:app` (packages/agent-ui/app) now runs
// alone and `:rest` excludes components+app (still complementary by construction via --exclude).
//
// FOURTH FIX (2026-07-20, GH #87): the THIRD SPLIT's `:rest` invocation
// (`vitest run --project packages --exclude 'packages/agent-ui/components/**' --exclude
// 'packages/agent-ui/app/**'`) never actually excluded anything — verified with `-t
// '____no_such_test____' --reporter=verbose`, which still listed every `components/` and `app/` file.
// Vitest 4.1's CLI `--exclude` sets ROOT-level `test.exclude`; each `projects[]` entry here declares its
// OWN `test.exclude` (even under `extends: true`), and the project's own array WINS outright rather than
// merging with the CLI-supplied one — so `:rest` was silently running the full ~85-file `packages`
// project (components + app + everything else) every time, the exact unsharded scale the SECOND SPLIT
// existed to avoid. That — not the a2ui-live e2e's screenshot-timeout cascade the crash log seemed to
// implicate (screenshot timeouts precede failures fleet-wide under heap pressure; they are a symptom of
// the OOM, not its cause) — is why `:rest` OOM'd. Positional directory arguments (as `:components` and
// `:app` already use) DO scope correctly — verified the same way — so the fix moves `:rest`'s exclusion
// into the config, the one place proven to actually filter, as its own `packages-rest` project below,
// and `:rest`'s package.json invocation now just selects that project (no more CLI `--exclude`, nothing
// to silently no-op).

// GH #56 — the named, closed set of files pulled out of `packages`/`site` into the `focus-timing` project
// below. Absolute repo-relative paths (not globs) so they match EXACTLY these files, never a same-named
// file added later elsewhere; append here (never edit the individual file's own test code first) when a
// new focus/keyboard/scroll-timing leg joins the flaky-under-concurrency class.
//
// GH #87 addendum (2026-07-20): `markdown.browser.test.ts`'s forced-colors token-degrade leg joined this
// class once `packages-rest` started running its OWN correctly-scoped ~6-file group — it timed out on
// `toMatchScreenshot` under that shard's concurrency twice in a row (measured), then passed 3/3 solo on
// both engines. Same signature as the rest of this list: a screenshot-capture race under concurrent-page
// load, not a component regression — this is very likely the "screenshot-timeout cascade" the GH #87
// crash log itself flagged, previously indistinguishable from the OOM it rode alongside.
const FOCUS_TIMING_FILES = [
  'packages/agent-ui/code/src/editor/editor.browser.test.ts',
  'packages/agent-ui/code/src/markdown/markdown.browser.test.ts',
  'packages/agent-ui/components/src/controls/swiper/swiper.browser.test.ts',
  'packages/agent-ui/components/src/controls/textarea/textarea.browser.test.ts',
  'packages/agent-ui/components/src/controls/toolbar/toolbar.browser.test.ts',
  'packages/agent-ui/components/src/controls/tooltip/tooltip.browser.test.ts',
  'site/pages/a2ui-chat.browser.test.ts',
]

export default defineConfig({
  test: {
    // Teardown force-kill window. The default 10s manifested as a ~10s "close timed out after 10000ms /
    // something prevents the main process from exiting" hang on every standalone `test:visual` run — a
    // generic dangling node handle AFTER the browsers close, NOT the WebKit shell (measured 2026-07-08:
    // the hang persisted chromium-only; 1s teardown was clean; full `test:browser` never hangs). 2s
    // leaves headroom over the measured-fine 1s.
    teardownTimeout: 2000,
    // "ResizeObserver loop completed with undelivered notifications." is the SPEC'S OWN benign signal —
    // an observed element resized again in the same frame the callback ran (ui-agent-admin's rev.5 shell:
    // the RO callback reparents content whose open Context accordions change the shell's own height), so
    // delivery defers to the NEXT frame and layout settles there. Real browsers surface it as a window
    // error but explicitly non-fatal (WHATWG resize-observer §3.1 "loop limit"); vitest's error-catcher
    // would otherwise fail whatever test happens to be running. Filter EXACTLY this message — every other
    // unhandled error stays fatal.
    onUnhandledError(error: unknown): boolean | void {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('ResizeObserver loop completed with undelivered notifications')) return false
    },
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
          // GH #56's known flaky-under-concurrency files are ALSO excluded here — routed instead to the
          // `focus-timing` project below, which runs them with zero file parallelism.
          //
          // This project stays the full (components + app + rest) superset — `:components` and `:app`
          // filter it down via a positional directory ARGUMENT at invocation (proven to scope correctly,
          // GH #87), not a project-level exclude. `:rest` used to filter the SAME way via CLI `--exclude`
          // flags, which silently do nothing against a project that declares its own `test.exclude` (GH
          // #87) — it now runs the dedicated `packages-rest` project below instead, which excludes
          // components/app at the config level where filtering actually works.
          exclude: ['**/*.visual.browser.test.ts', ...FOCUS_TIMING_FILES],
        },
      },
      {
        // GH #87 — `packages` minus components/app, realized as its OWN project (not a CLI `--exclude`
        // against the `packages` project above, which vitest 4.1 silently ignores: a project's own
        // declared `test.exclude` wins outright over anything the CLI supplies, verified with
        // `-t '____no_such_test____' --reporter=verbose` showing every components/app file still
        // collected). Complementary BY CONSTRUCTION exactly like the old CLI-flag intent claimed to be —
        // a new package's browser tests land here automatically — except now it's actually true.
        extends: true,
        test: {
          name: 'packages-rest',
          include: ['packages/agent-ui/*/src/**/*.browser.test.ts'],
          exclude: [
            '**/*.visual.browser.test.ts',
            ...FOCUS_TIMING_FILES,
            'packages/agent-ui/components/**',
            'packages/agent-ui/app/**',
          ],
        },
      },
      {
        extends: true,
        test: {
          name: 'site',
          include: ['site/**/*.browser.test.ts'],
          exclude: ['**/*.visual.browser.test.ts', ...FOCUS_TIMING_FILES],
        },
      },
      {
        // GH #56 — a stable CLASS of focus/keyboard/scroll-timing interaction legs (editor mode-toggle
        // keydown, swiper keyboard-scroll, textarea focus-vs-filled, toolbar roving Tab, tooltip focusin,
        // a2ui-chat tail-follow scroll) flake ONLY under full-project-shard concurrency — every one passes
        // 100% solo (verified 2026-07-19, both engines). Root cause: multiple Playwright pages/iframes
        // sharing OS-level document focus while running concurrently within the SAME `packages`/`site`
        // project — a real document can only be focused ONE page at a time, so a `:focus`/`:focus-visible`
        // assertion in one file can observe another concurrently-running file's page stealing focus.
        // FIX: pull exactly these files into their OWN project with `fileParallelism: false` (serial
        // within this project — each file still runs BOTH engines, but never beside a SIBLING file from
        // this list) while `packages`/`site` keep full concurrency for everything else. A future flaky
        // addition to this class is a one-line append to `FOCUS_TIMING_FILES` below, not a per-file fix.
        extends: true,
        test: {
          name: 'focus-timing',
          include: FOCUS_TIMING_FILES,
          fileParallelism: false,
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
