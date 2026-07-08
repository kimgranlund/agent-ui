# ADR-0110 — Visual-regression (pixel-diff) harness: vitest-native `toMatchScreenshot`, Chromium-only committed baselines, opt-in `*.visual` suites

> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-07-08 |
> | **Proposed by** | system-planner (design intake — Kim authorized the parked tooling intake) |
> | **Ratified by** | — |
> | **Repairs** | Re-realizes the acceptance evidence of [ADR-0105](0105-calendar-fluid-tracks-two-layer-cells.md) (calendar) and [ADR-0106](0106-text-truncate-css-only.md) (truncate) — the two pixel-worded acceptance legs the fleet could only prove by computed-style substitution (v1 pilot, Decision 7). **Supersedes ADR-0105's `__screenshots__` re-baseline instruction**: that path is gitignored debris (Context trap 1); baselines live at the tracked `__baselines__/` path from this record on. On accept: reciprocal forward-links on the 0105/0106 records (the back-links-land-at-accept convention). The plan is decomp [`visual-regression-harness.decomp.json`](../decompositions/visual-regression-harness.decomp.json), coverage-clean, plan-mode |
> | **Supersedes / Superseded by** | — (supersedes one *instruction* inside ADR-0105's Repairs, not the record) |

## Context

Geometry-sensitive ADRs keep writing acceptance the harness cannot check. ADR-0105's Acceptance leg (a)
demanded cell geometry "pixel-identical to the pre-change screenshots" — the builder had to substitute
computed-style proofs; the ADR-0106 review hit the same substitution; multiple reviewers this session ruled
"computed-style is the sanctioned proof — a real harness is a parked intake." The whole-shape doctrine
(bounding-box + computed-style assertions, e.g. `calendar.browser.test.ts`, `gallery.browser.test.ts`)
proves geometry *numerically* but cannot prove the rendered *gestalt* — paint, layering, wash continuity,
ellipsis pixels. Every geometry ADR pays a translation cost: acceptance written in pixels, evidence
delivered in numbers, a reviewer arbitrating the gap.

The constraint dissolved without our noticing: the **installed** runner already ships the harness.
`@vitest/browser` 4.1.9 (installed; verified in `node_modules`, not from changelog memory) exports
`expect.element(...).toMatchScreenshot()` (`jest-dom.d.ts:717`) with a **bundled** pixelmatch comparator
(`context.d.ts` `StandardScreenshotComparators`) — zero new dependency, not even dev-scope. Two traps make
adoption a design decision rather than a config flip: (1) vitest's default reference path is
`__screenshots__/<test-file>/<name>-<browser>-<platform>.png` (`dist/index.js:2073`) and `.gitignore:32`
blankets `**/__screenshots__/` (today those folders hold only on-failure debug captures; zero are
git-tracked) — the default baseline location is un-committable as-is; (2) the repo runs gates locally with
no CI, on macOS only, across two engines (Chromium + WebKit) that render differently — unscoped adoption
would double baselines and import font/AA flake fleet-wide.

## Decision

We will adopt vitest-browser's native `toMatchScreenshot` as the fleet's pixel-diff harness, deliberately
scoped:

1. **Opt-in by filename.** A third `visual` project in `vitest.browser.config.ts` with include
   `**/*.visual.browser.test.ts`. Only suites that deliberately opt in pay the pixel cost — never a
   blanket sweep. The existing `packages`/`site` project globs are untouched.
2. **Chromium-only pixel truth.** The visual project runs on the Chromium instance only (project-level
   instance pin; fallback mechanism `test.skipIf(server.browser !== 'chromium')` — `server.browser` is in
   the installed context API). WebKit keeps the existing computed-style/whole-shape legs as its sanctioned
   proof. Per-engine baselines double maintenance and AA-variance for no doctrine gain.
3. **Committed baselines in a dedicated tracked path.** A custom `resolveScreenshotPath` pins references
   to co-located `__baselines__/<test-file>/<name>-chromium-darwin.png`. `.gitignore` tracks
   `__baselines__/` and continues to ignore `**/__screenshots__/` (on-failure debris) and the diff
   attachments dir — committed truth and run debris never share a folder.
4. **Platform named honestly.** Keep vitest's default `-<platform>` filename suffix: baselines are
   macOS-`darwin`-only, and the filename says so. A non-darwin machine fails *missing-baseline* (loud),
   never a cross-platform garbage diff.
5. **Tolerance at the config level.** `browser.expect.toMatchScreenshot` defaults: `includeAA: false`
   (AA pixels detected and ignored — the comparator's default), YIQ `threshold: 0.1` (default), plus
   `allowedMismatchedPixelRatio: 0.01` to absorb minor macOS font-smoothing drift. Element-scoped captures
   with vitest's defaults (animations disabled, caret hidden) sidestep most scrollbar/animation flake.
6. **Deliberate re-baseline, never auto-update.** `npm run test:visual` (the `--project visual` filter)
   and `npm run test:visual:update` (adds `--update`, riding vitest's standard
   `snapshotOptions.updateSnapshot` seam — `dist/index.js:2247`) — the **only** path that rewrites an
   existing baseline. A missing baseline is created and the test **fails for review**; a normal run never
   overwrites.
7. **v1 scope = the two forcing ADRs.** Re-realize ADR-0105's calendar legs and ADR-0106's truncate legs
   as `*.visual.browser.test.ts` pixel legs — the pilot that proves the harness on the exact debt that
   forced this intake. A gallery-wide sweep is explicitly **out of scope** for v1.
8. **Gate placement.** The visual project runs inside the standing `npm run test:browser` gate and
   standalone via `test:visual`.

## Consequences

- **Binary PNGs enter the repo.** V1 is ~a dozen images at tens of KB each; every re-baseline grows
  history, and PNG diffs are unreviewable in text — reviewing a visual change means running the harness,
  not reading the diff. **Named trigger:** if `__baselines__/` exceeds ~5 MB or re-baselines start landing
  more than once per wave, move the store to Git LFS (or prune to the pilot set) — decided then, not
  ridden out silently.
- **macOS-darwin-only, honestly.** Baselines are verifiable and updatable only on macOS. A future
  Linux/CI machine cannot run the visual gate without generating a parallel `-linux` baseline set — a
  named follow-up, not v1. Cross-macOS-*version* font-smoothing drift is a real residual risk; the 1%
  mismatch budget absorbs small drift and `test:visual:update` is the escape valve. **Named trigger:** if
  cross-machine flake recurs despite the tolerance, the visual project demotes out of `test:browser` to a
  manual gate per the `npm run size` precedent (ADR-0040 §3).
- **Geometry work gains a commit-time step.** Any intentional visual change now requires a deliberate
  re-baseline in the same change — forgetting it turns the gate red, which is the point.
- **Single-engine blind spot accepted.** A WebKit-only paint regression that moves no computed style stays
  uncaught; WebKit's coverage remains the whole-shape doctrine.
- **Acceptance language re-routes (kills the translation cost).** From ratification: a geometry ADR whose
  acceptance claim is pixel-visual ("matches baseline", "gestalt", band/wash/ellipsis continuity) writes it
  as a `*.visual.browser.test.ts` leg; computed-style stays the sanctioned proof for numeric geometry and
  for **all** WebKit legs. Reviewers stop arbitrating pixel-claims-proven-by-numbers.
- **First-run discipline.** A new visual leg is born red (baseline created + fail-for-review) — a leg can
  never pass on the run that invented its own truth.

## Alternatives considered

1. **Playwright `toHaveScreenshot` (`@playwright/test` runner).** Mature and battle-tested, but a second
   test runner beside vitest: its own config, reporters, and conventions, splitting the browser-test corpus
   that today lives entirely in vitest-browser. Rejected for the runner split — Playwright stays what it
   is here, the provider.
2. **Thin custom helper (`locator.screenshot()` + a `pixelmatch` devDependency).** Admissible under the
   fleet's zero-dep rule (it governs runtime deps; `playwright`/`vitest`/`jsdom` are the dev-scope
   precedent) — but strictly dominated: the installed matcher already bundles pixelmatch behind
   retry-until-stable capture, the update seam, and diff artifacts. Rejected as reinvention.
3. **Status quo (computed-style only).** No new infra, but the translation cost recurs on every
   geometry-sensitive ADR, and gestalt-class regressions (the ui-slider "DOT" failure mode — every part
   asserted, whole broken) stay catchable only by hand-written whole-shape assertions. Rejected — the
   forcing evidence at the top.
4. **Per-engine baselines (Chromium + WebKit).** Full engine coverage, but doubles the baseline count and
   maintenance and imports WebKit's higher AA variance into every leg. Rejected for v1; the decision
   leaves the extension path open (a later ADR adds `-webkit-` baselines to specific legs if a WebKit
   paint regression ever ships).
5. **Start as a manual gate, per the `npm run size` precedent (ADR-0040 §3).** The closest analog: size
   stayed out of `check && test` because it is environment-sensitive, and pixel diffs are arguably more
   so (font smoothing). Rejected as the *starting* state for a mechanism reason the two gates don't
   share: `size` guards a slow-drifting budget where a missed run costs bytes recoverable at the next
   manual run — a missed *visual* run un-gates the exact regression class this harness exists to catch,
   on the wave that introduces it, and the debt returns to reviewer arbitration (the forcing evidence).
   The tolerance design (includeAA off, 1% ratio, element-scoped capture) is the flake defense; the
   manual gate survives as the **demotion target** (Consequences) if that defense proves insufficient in
   practice — measured, not presumed.

## Acceptance

Realized when the decomp's leaf accepts hold
([`visual-regression-harness.decomp.json`](../decompositions/visual-regression-harness.decomp.json)):

- `npm run test:browser` runs the `visual` project; pilot legs (0105 calendar, 0106 truncate) execute on
  Chromium exactly once, zero times on WebKit; `npm run check` stays green.
- References land under `**/__baselines__/…-chromium-darwin.png`; `git check-ignore` rejects
  `__baselines__/` paths and still matches `__screenshots__/` + attachments paths.
- The overwrite experiment: after a deliberate pixel change, plain `test:visual` fails without touching
  the committed baseline; `test:visual:update` rewrites it; the re-run is green.
- Negative control: a mis-named `*.browser.test.ts` file using `toMatchScreenshot` does not silently join
  the visual project.
