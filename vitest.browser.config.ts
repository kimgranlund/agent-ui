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
  // GH #170 (2026-07-20) — the shell-responsive suite's AC16 legs assert document.activeElement after an
  // overlay open/close (focus moves to the pane, returns to the toggle); the same concurrent-page focus-
  // contention class — passes solo, races when a sibling shard steals focus.
  'packages/agent-ui/app/src/controls/super-shell/super-shell-responsive.browser.test.ts',
  'packages/agent-ui/code/src/editor/editor.browser.test.ts',
  'packages/agent-ui/code/src/markdown/markdown.browser.test.ts',
  'packages/agent-ui/components/src/controls/swiper/swiper.browser.test.ts',
  'packages/agent-ui/components/src/controls/textarea/textarea.browser.test.ts',
  // code-entry-control.lld.md (GH #490 S2-a) — the focus-order probe asserts document.activeElement after
  // real Tab/refocus (one tab stop, active-cell parking) — the SAME concurrent-page focus-contention class
  // as every other file in this list; added at build time per the LLD's own §11 instruction, not found flaky.
  'packages/agent-ui/components/src/controls/otp-field/otp-field.browser.test.ts',
  // 2026-07-20 append (the GH #56 one-line-append law): the real-timer pause-on-hover leg timed out
  // repeatedly across the day's PR gate runs whenever a SIBLING worktree's suite ran concurrently on the
  // same machine (measured at least 3 independent runs), then passed solo every time (20/20 both engines)
  // — the class signature exactly (real-duration wall-clock timing under concurrent-page contention, not
  // a component regression).
  'packages/agent-ui/components/src/controls/toast/toast.browser.test.ts',
  'packages/agent-ui/components/src/controls/toolbar/toolbar.browser.test.ts',
  'packages/agent-ui/components/src/controls/tooltip/tooltip.browser.test.ts',
  'site/pages/a2ui-chat.browser.test.ts',
  // 2026-07-20 append: both timed out under shard contention in PR #175's independent-reviewer gate run
  // (the PR's own body flagged them as GH #56-class candidates) and in multiple other same-day gate runs;
  // both pass solo every time. command-palette drives real mod+K focus + typed narrowing; adr-index
  // drives a real click-to-focus + real keystrokes into the dogfooded ui-text-field — real-input
  // focus/timing races under concurrent-page load, the class this project exists for.
  'site/lib/command-palette.browser.test.ts',
  'site/pages/adr-index.browser.test.ts',
  // 2026-07-25 append (GH #262): the SPEC-R6 live-theme-bridge leg flips the site's OWN real header
  // scheme control (Auto->Light->Dark) and waits on a real postMessage round trip back through a
  // page-mounted, opaque-origin `ui-sandbox-frame` — that render/handshake settle races past its
  // `waitFor` budget ONLY under full `test:browser:site` shard concurrency (two independent review
  // passes measured the timeout; passes 100% solo every time). The class signature exactly — a real
  // page working correctly, flaking under concurrent-page focus/render contention, not a defect. The
  // theme-flip leg reads the surface card the file's earlier containment leg mounts (shared module
  // state), so the whole file — not one describe block — takes the isolation.
  'site/pages/gen-ui-live.browser.test.ts',
  // 2026-08-05 append (GH #461, MA-3) — the SAME click-to-focus-a-top-layer-panel shape as
  // command-palette.browser.test.ts/adr-index.browser.test.ts just above: `clickStatusFacet` opens a
  // `ui-form-popover` trigger (Popover API, a JS positioning controller settle) before clicking a facet
  // checkbox inside its panel. Passes 20/20 solo both engines; reproduced failing ONLY under full
  // `test:browser:site` shard concurrency — a Chromium trigger-click timeout in
  // `workbench — SPEC-R7`'s `clickStatusFacet` call, cascading into a WebKit whole-test timeout and a
  // stale-state SPEC-R9 assertion (the SAME test's own cleanup never running past its timeout). The class
  // signature exactly — a real page working correctly, flaking under concurrent-page focus/render
  // contention, not a defect.
  'site/pages/workbench.browser.test.ts',
  // 2026-08-06 append (GH #499, M-F) — the SAME class as the workbench.browser.test.ts append just above,
  // reproduced the identical way: passes 12/12 solo both engines every time (verified via `git stash` +
  // a solo run to rule out this being caused by the new page's own content), fails ONLY under full
  // `test:browser:site` shard concurrency — a real `userEvent.click` on the `ui-segmented-control`
  // priority filter (`Urgent narrows...` test) either times out or resolves late enough that its effect
  // bleeds into the NEXT test's read (a stale-filter `tbody` row count in the sortable-header test right
  // after it, the SAME "cleanup never running past its timeout" shape workbench's own append names).
  // Raising the per-test timeout (GH #347's REAL-TIMING HEADROOM class) was tried first and did NOT fix
  // it — confirming this is the concurrent-page focus/render contention class, not raw slowness, so it
  // takes THIS remedy (isolation) rather than that one.
  'site/pages/dashboard.browser.test.ts',
]

// ─── REAL-TIMING HEADROOM (GH #347) ────────────────────────────────────────────────────────────────
// NO CODE LIVES HERE ON PURPOSE. This is the canonical rationale for a per-FILE timeout raise that each
// member declares in its own source (`vi.setConfig({ testTimeout: 30_000 })` at module scope, tagged
// `GH #347`). `grep -rn 'GH #347' site packages` lists the class's exact current membership; adding a
// member is that one line in the new file, with NO edit to this config.
// SCOPE NOTE: this covers the per-TEST bound only. HOOKS are untouched, deliberately — browser mode
// already resolves `hookTimeout` to 30000ms by default (vitest's own `resolved.hookTimeout ??=
// resolved.browser.enabled ? 3e4 : 1e4`, and this repo sets no override), so declaring it here would be
// a no-op dressed as a remedy. A hook that needs MORE than 30s must say so itself, above that number.
//
// THE DEFECT. GH #347: `test:browser:site` fails a DIFFERENT, non-overlapping set of files on each
// full-sweep run, and every failing file passes solo. Its investigation comment (2026-07-28) ran three
// independent trials with zero file overlap between any pair, reproduced it only under genuinely
// concurrent shard execution (three plain sequential replays came back clean), and captured one real
// failure: `Test timed out in 15000ms` in `site/pages/agent-admin-app-scroll.browser.test.ts`. It also
// observed an unrelated worktree's vitest workers running on the same machine at that moment — load this
// repo's own shard sequencing can neither see nor control.
//
// WHY NOT GH #56's REMEDY. That list above is a CLOSED set with one identified mechanism (OS-level
// document focus, which only one page can hold). #347's set is OPEN: the failing identity keeps moving,
// so naming today's observed files would just surface an unnamed one next time. The cause is a resource
// budget, not an interaction between specific files.
//
// THE CLASS, BY MECHANISM (not by observed failure). A file belongs if any of its tests AWAIT something
// whose completion time is set by the browser's own scheduling rather than by a synchronous read: an
// awaited rAF/frame settle · a real-duration `setTimeout` wait · a retry poll (`waitFor`/`expect.poll`) ·
// observer delivery · animation/transition completion · a real-input or viewport driver round trip to the
// Playwright server · a mid-test dynamic `import()` of a page module. Each of those stretches with host
// load; a test built out of them can therefore cross a fixed bound while asserting nothing different.
// DELIBERATELY EXCLUDED: synchronous layout reads (`getBoundingClientRect`, `getComputedStyle`, a
// `scrollTop` write). They force a reflow but do not wait on the scheduler, so they do not stretch — and
// including them would have swept ~90 of the 112 browser files in, i.e. a global raise wearing a costume.
// Six `site` files carry no such await and deliberately KEEP the 15s bound (theme-pack-apply,
// theme-provider-build, _page-scheme, a2ui-live — it awaits only `updateComplete`, a microtask —
// text-field-permutations, tokens); they are the standing proof that this raise stayed scoped.
// OUT OF SCOPE BY PROJECT, not by mechanism: four `site` files qualify but live in `focus-timing`
// (a2ui-chat, adr-index, command-palette, gen-ui-live) and two in `visual` (`*.visual.browser.test.ts`).
// Both projects already carry their own remedy — zero file parallelism above, and the visual block's own
// raised `toMatchScreenshot` timeout below — so they were left alone rather than given a second one.
//
// WHY NOT A GLOBAL RAISE (Kim's ruling, 2026-07-29). A blanket raise makes every genuine hang take twice
// as long to surface in suites with no timing dependency at all. Kim accepted that cost for this class
// only. Kim also explicitly REJECTED the investigation's other candidate — capping `site`'s
// `fileParallelism` — because it slows a standing gate everyone runs.
//
// WHAT WAS MEASURED HERE, not assumed (2026-07-29, both engines):
//   · vitest browser mode's default per-test bound is 15000ms — a 20s stall with no headroom failed with
//     exactly `Test timed out in 15000ms`, the captured #347 signature.
//   · `vi.setConfig` at module scope does raise it: the same 20s stall passed at 30_000ms.
//   · The raise is genuinely per-file: both ran in the SAME `site` project in the SAME run, and the file
//     without the call still failed at 15000ms.
// WHY 30_000 (2× the default), derived rather than picked: `agent-admin-app-scroll`'s single test was
// measured at 485-712ms solo, 1728-1751ms inside a full `site` shard here, and 2458ms in-shard on a
// reviewer's machine — that 5× spread across idle runs IS the load sensitivity this raise exists for.
// #347 saw it cross 15000ms, which against the SLOWEST of those baselines still implies a ~6× slowdown;
// 30_000 tolerates ~12×. (A timeout only proves the test exceeded the bound, never by how much — the
// multiplier comes from the baseline, not from the failure.)
// A genuine hang in a member file still surfaces in 30s. Before "cleaning up" a 30s timeout here: it is
// load-tolerance for a reproduced, open-set contention defect, not a slow test.
// ───────────────────────────────────────────────────────────────────────────────────────────────────

// GH #204 — update-mode's own gap: `toMatchScreenshot`'s stability loop (inside `@vitest/browser`) seeds
// its "is the page done rendering" comparison with the STALE reference as the first baseline, using this
// SAME `comparatorOptions`. When a fresh capture already falls within `allowedMismatchedPixelRatio` of
// that stale reference on its very first attempt, the loop calls it "stable" at `retries === 0` and
// short-circuits straight to a pass — the real reference-vs-screenshot comparator (the one that would
// gate `--update`'s rewrite) never runs at all, so `updateSnapshot === "all"` never gets a chance to fire.
// A real, sub-tolerance rendered change (e.g. a footer text edit under ~1% of pixels) therefore survives
// `test:visual:update` untouched — reproduced concretely (GH #204) and confirmed against this exact
// mechanism by reading `determineOutcome`/`getStableScreenshot` in `@vitest/browser/dist/index.js`.
// The 1% tolerance is correct for the CHECK direction (anti-flake across machines/font-rendering runs);
// the gap is only that UPDATE mode inherits the same number. Fix: in update mode the ratio drops to 0, so
// ANY pixel delta (down to sub-tolerance) forces the stability loop past its first attempt and into the
// real comparator, which then always finds a mismatch and rewrites. Two back-to-back captures of the
// SAME already-rendered, non-animating page are pixel-identical in headless Chromium, so a real "nothing
// changed" run still settles immediately and writes nothing new — only a genuine change (of any size)
// causes a rewrite. Detected from the CLI flag itself (`test:visual:update`'s own `--update`), not an env
// var, so the two npm scripts stay the only two switches.
const isUpdatingVisualBaselines = process.argv.includes('--update') || process.argv.includes('-u')

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
          // GH #1247 side-finding (Kim-ruled 2026-08-18): a bare `**` glob leaks into live agent
          // worktrees under .claude/worktrees/, double-reporting every visual red from a lane's copy —
          // exclude them (node_modules is already implicit in vitest's default exclude).
          exclude: ['**/.claude/worktrees/**', '**/node_modules/**'],
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
                  // GH #204 — 0 under `--update` (rewrite on ANY delta), 0.01 otherwise (the CHECK
                  // direction's anti-flake tolerance, unchanged). See the `isUpdatingVisualBaselines`
                  // comment above for the mechanism this closes.
                  allowedMismatchedPixelRatio: isUpdatingVisualBaselines ? 0 : 0.01,
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
