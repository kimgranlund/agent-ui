<!-- role=filer level=L1 model=sonnet effort=medium -->
## Warnings
None

## PR title
Retire the component barrels: per-control entries, generated registry, on-demand control loading (ADR-0233)

## PR body
### Summary
Replaces the two component barrels (`src/controls/index.ts` and `component-styles.css`) with per-control entries. Registration, CSS and dependencies are generated from the descriptors. Consumers load only the controls they use, and adding a control no longer means hand-editing shared lists. Kim ratified ADR-0233 on 2026-10-05, and this PR writes it as `accepted`. Please review the ADR text here. Nothing is committed yet.

Measured effect, from the step reports:
- App marginal size: 69,981 B gz (budget re-based to 72,027). It was 106,987 against a 106,559 budget, which is why `npm run size` was red on main.
- Demo-only `all` entry: 72,993 B gz. Its budget is re-based upward to 73,728 B gz, per Kim's ruling.
- New registry plus loader row: 3,155 B gz (budget 3,840).

### Changes
Eight ordered slices, each verified separately.
1. **ADR-0233.** Written `accepted`. ADR-0003's barrel clause is superseded in part. ADR-0040 and ADR-0080 get append-only amendment notes. The ADR index and sitemap are regenerated.
2. **`uses` in descriptors.** The 82 fleet descriptors gain a `uses:` field (39 edges across 21 controls). `scripts/codemod-uses.mjs` writes it. A drift gate checks it against the real imports, and `BAD_USES` is a new descriptor validation code.
3. **Self-contained control sheets.**
   - 21 sheets get a generated `@import` prologue.
   - A new `shared-styles.css` (exported) holds the shared seams.
   - `css-uses.test.ts` and `css-order.browser.test.ts` replace the "DO NOT REORDER" rule.
4. **Generated artifacts.**
   - `scripts/generate-controls.mjs` writes `registry.gen.ts`, `all.gen.ts` and `all.gen.css`, plus the generator-owned `exports` keys (82 `./controls/*.css`, `./registry`, `./all`, `./all.css`).
   - `sideEffects` is set on the components package, and `publish-packages.mjs` carries it through.
   - New gates: drift, `all` purity, and `side-effects.test.mjs` (which includes a bundler probe).
5. **Loader and renderer.**
   - New `@agent-ui/components/loader`.
   - `CatalogEntry.controls` and a `controls` field on persona packages.
   - The renderer queues messages while controls load (`updateDataModel` and `finalize` wait behind them).
   - New `CONTROL_LOAD` error code. A failed load renders an inert placeholder.
6. **Catalog factories stop importing the fleet.**
   - Built-ins register `builtinControls`.
   - `WidgetFactory.uses` covers factories that mint other tags (user-approved).
   - The app package imports per-control entries, guarded by `control-reach.test.ts`.
   - The a2ui catalog SPEC and LLD are updated.
7. **Consumer migration.**
   - 164 importers moved to `@agent-ui/components/all`, `all.css` or per-control subpaths.
   - The docs-site recipe pages, `build-dogfood-assets.mjs`, `verify-consumer-install.mjs`, the components README and the skills are updated.
8. **Barrels deleted.**
   - `controls/index.ts`, `component-styles.css` and their exports keys are gone.
   - `sideEffects` is declared on all packages.
   - `measure-size.mjs` gains the `all` row (re-based) and a registry row, and the app budget goes down to 72,027.
   - Records and comments are scrubbed, and the dogfood assets and theme-provider fixture are regenerated.

### How each was verified
Every step has a verifier verdict of `pass`. Each verifier ran the criteria by exit code and bite-checked them with planted defects.
- **Step 1 (L1):** ADR checks, the three older ADRs changed only in their Supersedes row plus an appended amendment, and the site ADR and sitemap tests (199 passed).
- **Step 2 (L2):** drift gates (172 and 14 tests) and `codemod-uses.mjs --check`. A deleted edge, a phantom edge and a planted import each turned the gate red.
- **Step 3 (L3):**
  - Gates: `css-uses` (335 tests) and the order test on chromium and webkit (6 passed).
  - Order proof: a planted duplicate seam import and a conflicting foreign rule each turned it red.
  - Shards: all green with the named base-red skips.
- **Step 4 (L3):**
  - Generated artifacts: `generate-controls.mjs --check`, the three new gate files (35 tests), and `side-effects` plus publish tests (21 passed).
  - Bundler honours `sideEffects`: dropping `./src/controls/**` made the bundler probe go red.
  - Wider runs: `npm test` passed, as did the size probe and the browser shards.
- **Step 5 (L3):** loader unit tests (6) and browser tests (4, both engines), renderer and persona loader tests (12), `npm run check`, size probe and docs greps. About 15 planted mutations each turned a test red. The one that stayed green is the href-dedupe defensive branch, noted by the verifier.
- **Step 6 (L2):**
  - Import grep, size (app 69,769 B gz within budget) and 9 + 9 new tests.
  - jsdom and browser shards, `npm run check`, and a scope guard that bites.
- **Step 7 (L2):** the repo-wide import greps, 25 changed test files (1,496 tests), all six browser shards, the baselines guard and `npm run check`. An earlier fail on step 7 was a missing scope-allow-list entry (a plan defect, widened); the rerun passed with no source change.
- **Step 8 (L2):**
  - `npm test` (639 files, 13,295 tests), `npm run check`, `npm run size` (exit 0), the barrel-name grep (227 hits at base, none now) and the baselines guard.
  - The browser shards (components, site, visual, app, rest, focus-timing) and eval-catalog (0 red cards), all with `--retry 2` as the plan specifies.

The browser shards skip three cases by name that were already red at the base commit: `site-nav.browser.test.ts` context-labels, `swiper-item-demo.browser.test.ts` KEY/INDEX, and `_page.visual.browser.test.ts` narrow OVERLAY-OPEN.

## Changelog entry
Removed: the `@agent-ui/components/components` and `@agent-ui/components/component-styles.css` barrels. Import controls per entry (`@agent-ui/components/controls/button` plus `controls/button.css`). `foundation-styles.css` and `shared-styles.css` are the shared sheets. `@agent-ui/components/all` and `all.css` remain as demo-only entries.
Added: `uses` in control descriptors, a generated `./registry`, `./loader` and an optional catalog `controls` loader in the A2UI renderer (new `CONTROL_LOAD` error code), and `sideEffects` on every package. Adding a control now runs `scripts/generate-controls.mjs` instead of editing barrels.
Changed: the app package no longer eagerly bundles the fleet (marginal size 106,987 to 69,981 B gz). ADR-0233 supersedes the barrel clause of ADR-0003.

## Follow-ups
- fix-now: About 80 comments still say "component-styles barrel" in control-sheet banners and `*.browser.test.ts` headers (for example `super-shell.browser.test.ts:10`); rewrite them to the ADR-0233 wording.
- decide: `SUB_TAGS` in `a2ui/src/catalog/controls.ts` hand-lists six sub-element tags (`ui-card-header`, `ui-card-content`, `ui-card-footer`, `ui-drill-panel`, `ui-tab`, `ui-tab-panel`); have `generate-controls` emit these aliases into `registry.gen.ts` so the list stops being hand-kept.
- note: The three browser cases skipped by name were already red at the base commit (`site-nav` context-labels, `swiper-item-demo` KEY/INDEX, visual narrow OVERLAY-OPEN) and are still unfixed.
- note: The `all` size row was re-based upward to 73,728 B gz by Kim's ruling. The cause is gzip reacting to the path-sorted `all.gen.ts` import order (about 1.9 KB spread), not added code.
- note: `protocol.ts:49` still says "9-code" and the runtime SPEC §5.2 `ErrorCode` listing lacks `CONTAINMENT`. Both were stale before this change and were left alone.
