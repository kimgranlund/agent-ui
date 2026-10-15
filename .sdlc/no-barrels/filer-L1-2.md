<!-- role=filer level=L1 model=sonnet effort=medium -->
## Warnings
None

## PR title
Retire the component barrels: per-control entries, generated registry, on-demand control loading (ADR-0233)

## PR body
### Summary
This PR replaces the two component barrels, `src/controls/index.ts` and `component-styles.css`, with per-control entries. Registration, CSS and dependencies are generated from the descriptors. Consumers load only the controls they use, and adding a control no longer means hand-editing shared lists.

Kim ratified ADR-0233 on 2026-10-05. This PR writes it as `accepted`, so please review the ADR text here. All work is in the tree and nothing is committed.

Measured effect, from the step reports:
- **App marginal size:** 69,981 B gz, within a budget re-based down to 72,027. It was 106,987 against 106,559, which is why `npm run size` was red on main.
- **Demo-only `all` entry:** 72,993 B gz. Per Kim's ruling, its budget is re-based upward to 73,728 B gz.
- **New registry and loader row:** 3,155 B gz, budget 3,840.

### Changes
Nine ordered slices, each verified separately.
1. **ADR-0233.**
   - Written `accepted`.
   - ADR-0003's barrel clause is superseded in part. ADR-0040 and ADR-0080 get append-only amendment notes.
   - The ADR index and sitemap are regenerated.
2. **`uses` in descriptors.**
   - The 82 fleet descriptors gain a `uses:` field (39 edges across 21 controls), written by `scripts/codemod-uses.mjs`.
   - A drift gate checks it against the real imports.
   - `BAD_USES` is a new descriptor validation code.
3. **Self-contained control sheets.**
   - 21 sheets get a generated `@import` prologue.
   - A new exported `shared-styles.css` holds the shared seams.
   - `css-uses.test.ts` and `css-order.browser.test.ts` replace the "DO NOT REORDER" rule.
4. **Generated artifacts.**
   - `scripts/generate-controls.mjs` writes `registry.gen.ts`, `all.gen.ts` and `all.gen.css`.
   - It also owns the matching `exports` keys: 82 `./controls/*.css`, `./registry`, `./all` and `./all.css`.
   - `sideEffects` is set on the components package, and `publish-packages.mjs` carries it through.
   - New gates: drift, `all` purity, and `side-effects.test.mjs` with a bundler probe.
5. **Loader and renderer.**
   - New `@agent-ui/components/loader`.
   - `CatalogEntry.controls`, plus a `controls` field on persona packages.
   - The renderer queues messages while controls load. `updateDataModel` and `finalize` wait behind them.
   - New `CONTROL_LOAD` error code. A failed load renders an inert placeholder.
6. **Catalog factories stop importing the fleet.**
   - Built-ins register `builtinControls`.
   - `WidgetFactory.uses` covers factories that mint other tags (user-approved).
   - The app package imports per-control entries, guarded by `control-reach.test.ts`.
   - The a2ui catalog SPEC and LLD are updated.
7. **Consumer migration.**
   - 164 importers move to `@agent-ui/components/all`, `all.css` or per-control subpaths.
   - Updated alongside: the docs-site recipe pages, `build-dogfood-assets.mjs`, `verify-consumer-install.mjs`, the components README and the skills.
8. **Barrels deleted.**
   - `controls/index.ts`, `component-styles.css` and their exports keys are gone.
   - `sideEffects` is declared on all packages.
   - `measure-size.mjs` gains the re-based `all` row and a registry row. The app budget goes down to 72,027.
   - Records and comments are scrubbed, and the dogfood assets and theme-provider fixture are regenerated.
9. **Loose ends.** About 70 leftover "component-styles barrel" comments (control-sheet banners and browser-test headers) are reworded to the ADR-0233 wording. Only comment lines changed.

### How each was verified
Every step ends with a verifier verdict of `pass`. Verifiers ran the criteria by exit code and bite-checked the new gates with planted defects.
- **Step 1 (L1):**
  - ADR checks passed.
  - The three older ADRs changed only in their Supersedes row plus an appended amendment.
  - Site ADR, sitemap and docs-grammar tests: 199 passed.
- **Step 2 (L2):**
  - Drift gates passed (172 and 14 tests), as did `codemod-uses.mjs --check`.
  - A deleted edge, a phantom edge and a planted import each turned the gate red.
- **Step 3 (L3):**
  - `css-uses` (335 tests) and the order test on chromium and webkit (6 passed) are green.
  - A planted duplicate seam import and a conflicting foreign rule each turned it red.
  - All shards are green, with the named base-red skips.
- **Step 4 (L3):**
  - `generate-controls.mjs --check` is green.
  - The three new gate files (35 tests) and the `side-effects` plus publish tests (21 passed) are green.
  - Dropping `./src/controls/**` from `sideEffects` made the bundler probe go red.
  - `npm test`, the size probe and the browser shards passed.
- **Step 5 (L3):**
  - Loader unit tests (6) and browser tests (4, both engines).
  - Renderer and persona loader tests (12).
  - `npm run check`, the size probe and the docs greps.
  - About 15 planted mutations each turned a test red. The one that stayed green is the href-dedupe defensive branch, noted by the verifier.
- **Step 6 (L2):**
  - Import grep, size (app 69,769 B gz, within budget) and 9 + 9 new tests.
  - jsdom and browser shards and `npm run check`.
  - A scope guard that bites.
- **Step 7 (L2):**
  - Repo-wide import greps, 25 changed test files (1,496 tests), all six browser shards, the baselines guard and `npm run check`.
  - The first verifier run failed only on the scope allow-list, which was a plan defect. It was widened, and the rerun passed with no source change.
- **Step 8 (L2):**
  - `npm test` (639 files, 13,295 tests), `npm run check` and `npm run size` (exit 0).
  - The barrel-name grep found 227 hits at base and none now. The baselines guard is clean.
  - The browser shards (components, site, visual, app, rest, focus-timing) and eval-catalog (0 red cards), all with `--retry 2` as the plan specifies.
  - The verifier measured the app marginal at 69,981 B gz. The ledger keeps the 69,979 given in the handoff, and the row is within budget.
- **Step 9 (L1):**
  - `! git grep -nE "component-styles barrel" -- packages site` is empty. The same grep at `HEAD` matches 71 files.
  - The em-dash count guard and `npm run check` passed.

The browser shards skip three cases by name that were already red at the base commit: `site-nav.browser.test.ts` context-labels, `swiper-item-demo.browser.test.ts` KEY/INDEX, and `_page.visual.browser.test.ts` narrow OVERLAY-OPEN.

## Changelog entry
Removed: the `@agent-ui/components/components` and `@agent-ui/components/component-styles.css` barrels. Import controls per entry (`@agent-ui/components/controls/button` plus `controls/button.css`). `foundation-styles.css` and `shared-styles.css` are the shared sheets. `@agent-ui/components/all` and `all.css` remain as demo-only entries.
Added: `uses` in control descriptors, a generated `./registry`, `./loader` and an optional catalog `controls` loader in the A2UI renderer (new `CONTROL_LOAD` error code), and `sideEffects` on every package. Adding a control now runs `scripts/generate-controls.mjs` instead of editing barrels.
Changed: the app package no longer eagerly bundles the fleet (marginal size 106,987 to 69,981 B gz). ADR-0233 supersedes the barrel clause of ADR-0003.

## Follow-ups
- decide: `SUB_TAGS` in `a2ui/src/catalog/controls.ts` hand-lists six sub-element tags (`ui-card-header`, `ui-card-content`, `ui-card-footer`, `ui-drill-panel`, `ui-tab`, `ui-tab-panel`); should `generate-controls` emit these aliases into `registry.gen.ts` so the list is no longer hand-kept?
- note: three browser cases were already red at the base commit and are skipped by name, still unfixed: `site-nav` context-labels, `swiper-item-demo` KEY/INDEX, visual narrow OVERLAY-OPEN.
- note: the `all` size row was re-based upward to 73,728 B gz by Kim's ruling; the cause is gzip reacting to the path-sorted `all.gen.ts` import order, not added code.
- note: `protocol.ts:49` still says "9-code" and the runtime SPEC §5.2 `ErrorCode` listing lacks `CONTAINMENT`; both were stale before this change and left alone.
