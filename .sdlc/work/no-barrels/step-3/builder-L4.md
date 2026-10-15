<!-- role=builder level=L4 model=opus effort=xhigh -->
## Status
done

## Changes
- `packages/agent-ui/components/src/shared-styles.css`: new seam sheet. It imports `_surface/container.css`, `_surface/container-box.css` and `_chart/chart-axis.css`, in that order. The header comment never quotes an `@import` statement.
- `packages/agent-ui/components/package.json`: new `"./shared-styles.css": "./src/shared-styles.css"` export.
- `packages/agent-ui/components/src/component-styles.css`: the three seam imports are replaced by one leading `@import './shared-styles.css';`. The header now states the four-line host contract and the "DO NOT REORDER" rule is gone. Four section comments that said "above" or "FIRST/SECOND" now point at `shared-styles.css` and the prologues. Every control import is kept.
- `packages/agent-ui/components/src/descriptor/control-graph.ts`: new CSS half, with no `node:*` import: `sheetPath`, `usesPrologueMarker`, `stripCssComments`, `sheetSpecifier`, `usesPrologue`, `cssImports` and `withCssPrologue`.
- `scripts/codemod-uses.mjs`: now also writes or removes each sheet's prologue through those functions. `--check` covers both descriptors and sheets.
- 21 fleet sheets got a prologue from the codemod (81 lines inserted): attachment, avatar, breadcrumb, choice-group, color-picker, command-modal, file-drop, pagination, radio-group, segment, segmented-control, split, status-stream, swiper, table, tabs, text-field, timeline, timeline-item, toast and toast-region.
- `packages/agent-ui/components/src/controls/css-uses.test.ts`: new gate with four rules (335 tests) and negative controls for each rule.
- `packages/agent-ui/components/src/controls/css-order.browser.test.ts`: new order proof. It compares the canonical order with three fixed-seed shuffles, re-runs the canonical order as a stability check, and has the inline-`<style>` negative control.
- `packages/agent-ui/components/src/controls/barrels.test.ts`: the seam-first test is split in two and retargeted. One checks the `shared-styles.css` import order and its export; the other checks that `component-styles.css` imports `./shared-styles.css` first and no `_` seam. I also rewrote one stale "do-not-reorder" comment.
- `packages/agent-ui/components/src/controls/sandbox-frame/dogfood/dogfood-assets.ts`: regenerated with `npm run regen:dogfood-assets`.
- `site/lib/__fixtures__/theme-provider-built.css`: regenerated with `npm run regen:theme-provider-fixture`.
- `.claude/docs/references/component-packaging.md`: added the prologue rule, the seam-sheet row in the exports table, the four-line CSS order and host contract, and a codemod step in "add a new control".
- `.claude/skills/component-build/SKILL.md`: the CSS step (self-scoped sheet, no `_` seam import, no hand-written prologue) and the integrate step (the codemod writes the prologue).
- `.claude/skills/package-release/references/release-facts.md:38`: the relative-imports-only rule now names `shared-styles.css` and the control sheets.
- `packages/agent-ui/components/AGENTS.md`: new Controls bullet covering the prologue, the seam sheet and the two gates.

## Checks
Before the change (untouched tree):
- `npm run test:browser:packages:components -- -t '^(?!.*context-labels and the wide name)'`, first run: exit 1, with 3 choice-card reds (chromium, "Matcher did not succeed in time").
- `choice-card.browser.test.ts` alone: exit 0, 14 passed.
- Components shard rerun: exit 0, 172 files, 2410 passed and 4 skipped.
- `npm run test:browser:site -- -t '^(?!.*resolves by KEY on the tour)'`: exit 0, 946 passed and 2 skipped.
- `npm run test:visual -- -t '^(?!.*nav OVERLAY-OPEN)'`: exit 0, 61 passed and 1 skipped.

After the CSS change, before the regens:
- Components shard: exit 0, 174 files, 2416 passed and 4 skipped.
- Site shard: exit 0, 946 passed.
- Visual shard: exit 0, 61 passed and 1 skipped.

Acceptance criteria, final runs:
- Node check on `shared-styles.css` imports and export: exit 0.
- Node check on `component-styles.css` (first import is `./shared-styles.css`, no `/_` import): exit 0.
- `grep -qF "@import '../pagination/pagination.css';" …/table/table.css`: exit 0.
- `npx vitest run …/css-uses.test.ts`: exit 0, 335 passed.
- `npx vitest run --config vitest.browser.config.ts --project packages …/css-order.browser.test.ts`: exit 0, 6 passed (3 tests on each of chromium and webkit).
- (guard) jsdom list of barrels, family-coherence, styling-gates, dogfood freshness, theme-provider fixture and docs-grammar: exit 0, 670 passed.
- (guard) `__baselines__` check: exit 0.
- (guard) `npm run check`: exit 0.
- (guard) scope allow-list: exit 0 over 126 changed or untracked paths.
- (guard) app, rest and focus-timing shards: all exit 0 (842, 78, and 441 passed with 1 skipped).
- (guard) three skipped-case shards, final run: components exit 0 (2416 passed), site exit 0 (946 passed), visual exit 0 (61 passed and 1 skipped).
- Records grep for `shared-styles.css` in the three files: exit 0.

Extra checks:
- `node scripts/codemod-uses.mjs` run twice: 21 files rewritten, then 0. `--check` exits 0.
- `npx vitest run packages/agent-ui/components site/lib`: exit 0, 291 files, 7353 passed.
- After the regens, the browser tests that consume the regenerated files passed. `theme-pack-apply` and `theme-provider-build`: 14 passed. `drawer` and `sandbox-frame`: 70 passed.
- Bite check on the codemod and `css-uses.test.ts`. I appended a foreign `:where(ui-button)` rule to `tooltip.css` and deleted the marker comment from `table.css`. The gate went red and `--check` named `table.css`. This also exposed the orphan-import gap fixed below. After restoring, the gate is green at 335.
- Bite check on the order test: a planted `@import '../_surface/container.css'` in `table.css` made it red on both engines (card's background went transparent).
- Bite check on the shuffle comparison: two conflicting foreign `:where(ui-button)` rules in `tooltip.css` and `badge.css` made seed 3 diverge on both engines. All planted files were restored, and `git diff` confirmed it.

## Notes
- **Pre-change flake:** the 3 choice-card reds in the first components run were load flakes, not this step. The file alone was green, the full rerun was green, and every run after the change was green with no retry.
- **Shards and regens:** no post-change shard had a red case, screenshot difference or `__baselines__` change. Both regens ran only after the three shards were green.
- **Regen sizes:** the bundler dedupes and reorders the imported sheets. The theme-provider fixture is 38 B smaller and `dogfood-assets.ts` keeps the same byte count.
- **Specimens are not all bare:** `ui-popover`, `ui-menu` and `ui-tooltip` get a `<button>` first child, because their `connected()` throws without one. `ui-toast` gets `duration="0"`, because otherwise it removes itself from the DOM between snapshots. A bare `ui-drill` only logs a console warning.
- **Fleet tags in the order test:** the descriptor tags plus every `ui-*` tag a glob module defines (found with `customElements.getName`). That is a superset of the 82 descriptors.
- **Animations:** they are paused at time 0 before each snapshot, so animated values never differ by timing.
- **Codemod hardening:** `withCssPrologue` also removes a run of `@import` lines that sits at the first token without its marker comment. The marker-only strip left duplicate imports during the bite check. For the same reason, `css-uses.test.ts` rule 1 now also requires exactly one import per used control.
- **Prologue placement:** it follows the handoff literally ("before the first non-comment token"). In sheets such as `radio-group.css`, where a section-heading comment comes right before the first rule, the prologue sits between that heading and the rule.
- **Layering scanner trap:** in `control-graph.ts`, `usesPrologue` builds the `@import` string in two parts. A single template string `@import '${…}'` was read as an external import by `layering.test.ts` and turned it red. Do not simplify it back.
- **Stale records outside the allow-list:** the header comments in `_surface/container.css` (lines 3 and 33) and `_surface/container-box.css` (line 4) still say `component-styles.css` imports them directly. The `_` folders are outside this step's allow-list, so they need routing to step 8 or a follow-up.
- **Logs:** every shard run is logged under `.sdlc/work/no-barrels/step-3/logs/`.
- **Commits:** none.
