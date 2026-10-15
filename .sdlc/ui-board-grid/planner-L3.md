<!-- role=planner level=L3 model=opus effort=xhigh -->
## Goal
Ship `ui-board-grid` as an ADR-0233 per-control entry (control, descriptor, generated props and registry, tests, site doc and demo pages with nav) to the ADR-0243 BoardGrid fork sheet, with no default catalog row (that is R1, T-0072).
guard timeout: 400

## Step 1: Build ui-board-grid with its site pages, gates green
level: L3
### Read first
- `packages/agent-ui/components/AGENTS.md`
- `packages/agent-ui/a2ui/AGENTS.md`
### Do
Depends on: none. This one-step plan is the gates green step.

Sources:
- The ADR-0243 BoardGrid fork sheet in `.claude/docs/adr/0243-preset-widgets-admission-placement-derived-inheritance.md`. Lines 97-106 hold the rows shared by all three controls and lines 121-132 hold the BoardGrid rows.
- Design section 4 at `/Users/kimgranlund/Projects/nonoun/agent-ui/.sdlc/preset-widgets-design/design.md:85-90`. It lives in the main checkout's untracked `.sdlc/`, not in this worktree.
- The approved mockup: `/private/tmp/claude-501/widgets-artifact/own.css:38-43` and `/private/tmp/claude-501/widgets-artifact/body.html:15-25,57-61`.
- The handoff's Styling review.
- Follow the skills component-build, component-standards and component-testing.

Reference code:
- `controls/button/`: the realized reference.
- `controls/source-list/`: an array data-prop declared through a `*-model.ts` module, which the generated `source-list.props.gen.ts:4` imports.
- `controls/suggestions/`: the `cleanSuggestions` hardening idiom.
- `controls/service-card/service-card.ts:88`: `this.emit('action')`.
- `controls/playing-card/`: the shape of the descriptor, the CSS and the browser test.

1. Control folder `packages/agent-ui/components/src/controls/board-grid/` holds these files. No visual-baseline test.
   - `board-grid.ts`: `UIBoardGridElement extends UIElement`, self-defines `ui-board-grid`.
   - `board-grid-model.ts`: `cellsProp` plus the cell hardening.
   - `board-grid.css`.
   - `board-grid.md`: tier `pattern`, base `UIElement`, events `[action]`, slots `[]`.
   - `board-grid.props.gen.ts`: written only by `node scripts/generate-props.mjs board-grid`.
   - `board-grid.test.ts`, `board-grid-descriptor.test.ts`, `board-grid-css.test.ts`, `board-grid.browser.test.ts`.

2. Settled interface. Each item is decided here. If the build cannot honor a row, report `blocked`; it is not a free choice.
   - Props are exactly the fork sheet's:
     - `rows` and `cols`: numbers, not bindable.
     - `cells`: a bindable array of `{row, col, mark, intent, disabled}`.
     - `label`.
     - `actionName`: a string; empty or absent means a read-only board.
     - The reflected `inline` boolean (ADR-0223, the shared rows at ADR-0243:99-106).
     - There is no `size` prop. The cell side reads the cascaded `[size]` control-height row.
   - `row` and `col` are 0-based in `cells` and in the emitted `context`, and 1-based in the accessible name. Evidence: the approved mockup keys cells `'0,1'` and labels them `'Row '+(r+1)` (`body.html:58-60`).
   - `intent` is one of `neutral`, `info`, `success`, `warning`, `danger`. This is the fleet set in `controls/badge/badge.props.gen.ts:5`, the same set ADR-0243 gives ProductCard's `badgeIntent`. Absent means no intent. Hardening rules:
     - An out-of-set intent is dropped, so the cell renders with no intent.
     - A cell whose `row`/`col` falls outside `rows` x `cols` is dropped.
     - When two entries share one position, the later entry wins.
   - Event: `action` only, with detail `{action: actionName, context: {row, col}}`.
     - Exactly one event per activation: click, Enter or Space on an enabled cell.
     - Never on render, never on a disabled cell, never on a read-only board.
   - Anatomy:
     - The host has `role=grid` and `ariaLabel` from `label`, both set through `this.internals`, never as host attributes.
     - Each board row is one `[data-part="row"]` element with `role=row` and `display: contents`. It holds that row's `[data-part="cell"]` parts, each with `role=gridcell`. The row part exists because ARIA 1.2 requires a gridcell to be owned by a row.
     - All cells render in one pass, with no per-cell custom element, on one CSS grid of `cols` columns.
     - With `actionName` set, each cell is a `<button data-part="cell">` (the sanctioned internal class), and a `disabled` cell is a disabled button. Without it, each cell is a `<div data-part="cell">`.
   - Cell content:
     - `[data-part="mark"]` holds the `mark` text, centered.
     - When `intent` is set, `[data-part="intent"]` (aria-hidden) shows a corner glyph at bottom-right (`own.css:43`): success `+`, warning `?`, neutral `-` (the mockup legend, `body.html:22`), danger `!`, info `i`. No intent means no corner glyph.
     - Each cell's accessible name is an `aria-label` on the cell part. It joins the non-empty parts of: mark, intent word, `row {row+1}`, `column {col+1}`, separated by `, `, in that order (ADR-0243:131).
   - Keyboard:
     - Both modes have one tab stop: exactly one cell has `tabindex=0` and the rest have `-1`.
     - ArrowLeft and ArrowRight move one cell. ArrowUp and ArrowDown move one row.
     - A move skips disabled cells in its direction and stays put at the edge (no wrap).
     - Enter and Space activate only on an interactive board.
     - A read-only board keeps the roving tab stop but never activates. The ADR-0243:131 A11y row is unconditional, and a host with `role=grid` needs focusable cells.
     - Implement the two-axis roving inside `board-grid.ts`. `traits/roving-focus.ts` moves on one axis only (`orientation`, `roving-focus.ts:47,195-196`), and `traits/` is outside this ticket's scope.
     - The roving position survives a `cells` update.
   - Updates:
     - A `cells` write patches the existing cell parts in place. The same element objects remain and the board is never re-mounted.
     - A `rows` or `cols` change rebuilds the board.
     - Empty `cells` renders the blank `rows` x `cols` board.
   - CSS:
     - A `:where(ui-board-grid)` token block and an `@scope (ui-board-grid)` styles block that consumes only `--ui-board-grid-*` (component-build step 5, gated by `controls/styling-gates.test.ts`).
     - Each cell is square (`aspect-ratio: 1`) and at least 34px. Its side tracks the control-height row at the active `[size]`.
     - Gap and frame come off `--md-sys-space` x density.
     - Per-intent tokens: cell background `--md-sys-color-{intent}-container`; mark and corner ink `--md-sys-color-{intent}-high`. This follows Kim's note to use danger-high and success-high for hit and sunk contents. All five `-high` roles exist in `packages/agent-ui/shared/src/tokens/tokens.css`.
     - Cells with no intent use the neutral surface and on-surface roles with an outline-variant border.
     - Hover tint only on enabled interactive cells.
     - Transitions only under `prefers-reduced-motion: no-preference`.
     - The focus ring is the fleet constant.
     - The host fills its container by default and `[inline]` hugs (`controls/sizing-gates.test.ts`, enforcing).
   - Descriptor prose: the dogfood inventory uses the descriptor's opening prose as the row summary.
     - At plan time the inventory measured 28,002 of `DOGFOOD_INVENTORY_CHAR_BUDGET` 28,200 (`packages/agent-ui/a2ui/src/agent/dogfood-inventory.ts`).
     - The new row's fixed part (tag prefix plus the six attrs) is about 120 chars, so keep the opening sentence at or under 70 chars.
     - Do not edit the budget constant in this ticket.
     - Measure after the descriptor lands:

     ```
     node --experimental-strip-types --no-warnings -e "import('./packages/agent-ui/a2ui/src/agent/dogfood-inventory.ts').then(m=>{const s=m.dogfoodInventory();console.log(s.length,m.DOGFOOD_INVENTORY_CHAR_BUDGET);console.log(s.split('\n').find(r=>r.includes('ui-board-grid')))})"
     ```

3. Run the generators in this order. Never hand-edit their outputs.
   1. `node scripts/generate-props.mjs board-grid`.
   2. `node scripts/codemod-uses.mjs`.
   3. `node scripts/generate-controls.mjs`: writes `controls/registry.gen.ts`, `src/all.gen.ts`, `src/all.gen.css` and the components `package.json` exports.
   4. `node scripts/generate-agent-assets.mjs`: writes `a2ui/src/agent/dogfood-fleet.gen.ts`. `assets.gen.ts` should come out unchanged.
   5. `npm run regen:dogfood-assets`: writes `controls/sandbox-frame/dogfood/dogfood-assets.ts`. Gated by `dogfood-assets-freshness.test.ts` and the a2ui `live-agent/dogfood-tag-set-equality.test.ts`.
   6. `npm run generate:registry`: writes `site/capability-registry.json` and `site/public/capability-registry.json`, which list every control. `selection-projection.gen.ts` should come out unchanged.
   7. `npm run regen:theme-provider-fixture`: writes `site/lib/__fixtures__/theme-provider-built.css`, which embeds all control CSS. Gated by `site/lib/theme-provider-build-fixture.test.ts`.
   8. After the site edits in item 5: `node scripts/generate-sitemap.mjs` (both `sitemap.json` copies), then `node scripts/generate-llms-full.mjs` (`site/public/llms-full.txt`).

4. Catalog coverage seed: add `['BoardGrid', '<reason>']` to `EXCLUSION_ALLOWLIST` in `packages/agent-ui/a2ui/src/catalog/default/exclusions.ts`.
   - The reason says the control shipped ahead of its catalog row and cites ADR-0243 and T-0072. R1 lands the row and drains the seed.
   - The precedent is recorded at `exclusions.ts:6-40`.
   - This edit is forced by `packages/agent-ui/a2ui/src/catalog/default/index.test.ts:171,175` (`typesMissingCatalog`).

5. Site. The pattern tier requires `{doc, demo}` (`packages/agent-ui/components/src/descriptor/site-coverage.test.ts:88-96`).
   - `site/board-grid-doc.html` and `site/pages/board-grid-doc.ts`: the API page, derived from the descriptor through a new `loadBoardGridDoc` in `site/lib/frontmatter.ts` (the `loadPlayingCardDoc` precedent, `frontmatter.ts:50,207`).
   - `site/board-grid-demo.html` and `site/pages/board-grid-demo.ts`. Copy the page shell from `playing-card-demo`/`playing-card-doc`. The demo shows three boards:
     - A targetable 6x6 board with marks `●` `○` `▣` and danger, neutral and success intents. The page's `action` listener writes the hit into `cells` and shows the last event detail.
     - A read-only 6x5 word board: letters with success, warning and neutral corner glyphs.
     - A 72-cell 8x9 board.
   - Nav:
     - In `site/pages/_page.ts`, add a NAV group `{label: 'ui-board-grid', links: [Demo, API]}` (precedent `_page.ts:305-311`).
     - In the same file, add `'ui-board-grid'` after `'ui-playing-card'` in the NAV_TAXONOMY group `Containers & chrome` (`_page.ts:961-962`).
     - Mirror the taxonomy byte-identically in `scripts/generate-sitemap.mjs` L1_TAXONOMY (`generate-sitemap.mjs:69-71`).
     - Update the L1 tag count in the comments at `generate-sitemap.mjs:49` and `_page.ts:1029` to the generator's new count.
     - Group choice: next to ui-playing-card, the other game surface (ADR-0225). The group grows to 9 tags, under the 10-tag ceiling stated in the comment at `generate-sitemap.mjs:48-49`.
     - In `site/main.ts`, add a CARD_GROUPS entry with Demo and API cards (precedent `main.ts:629-645`).
   - `site/lib/component-preview.ts`:
     - Add `'ui-board-grid'` to `NO_SLOT_TEXT`, following the playing-card "no light-DOM content model" precedent (`component-preview.ts:1579-1582`).
     - Add a representative specimen: `COMPONENT_INITIAL` sets `rows` and `cols`, and `COMPONENT_SAMPLE_INIT` sets `cells`.
     - Do not add it to `A2UI_INITIAL` or `SAMPLE_TREES`: `site/lib/component-preview-catalog.test.ts` requires those keys to be catalog types.
   - `site/public/llms.txt`: add the doc and demo page lines. This file is hand-kept, and `site/lib/llms.test.ts:69` fails on an unindexed page.
   - `packages/agent-ui/components/src/descriptor/site-coverage.test.ts`: add `'board-grid'` to the pattern-tier list (`:293-297`) with a one-line comment.

6. Tests, by title:
   - `board-grid.test.ts` (jsdom):
     - "renders rows x cols cell parts in one pass with no per-cell custom element" (an 8x9 board, 72 cells)
     - "empty cells renders the blank board"
     - "host role grid and aria-label come from internals, never host attributes"
     - "cells are owned by role=row parts and carry role=gridcell"
     - "with actionName each enabled cell is a button part; without it there are no button parts"
     - "activating an enabled cell emits one action event with {action, context: {row, col}}" (click, Enter, Space)
     - "disabled cells and read-only boards never emit action"
     - "exactly one tabindex=0; arrows move by cell and row, skip disabled cells, do not wrap"
     - "a cells update patches marks in place and keeps the same cell elements"
     - "cell accessible name is mark, intent, row n, column m (1-based)"
     - "the corner glyph renders only when intent is set; an out-of-set intent is dropped"
     - "cells outside rows x cols are dropped"
   - `board-grid-descriptor.test.ts`: the descriptor-to-source trip-wire, in the `playing-card-descriptor.test.ts` shape.
   - `board-grid-css.test.ts`, in the `playing-card-css.test.ts` shape:
     - tokens are declared in `:where()`;
     - `@scope` consumes only `--ui-board-grid-*`;
     - the per-intent `-container` and `-high` roles are used.
   - `board-grid.browser.test.ts` (packages shard, real engine):
     - the whole-shape bounding box in a realistic container;
     - each cell is square with a side of at least 34px at the default size;
     - fill by default versus `inline` hug;
     - keyboard roving with real focus.

7. Validation scope:
   - Run the criteria below, then `npm run check` and `npm test` as the whole gates.
   - The contract dependents in criterion 8 came from `git grep -l playing-card` and `git grep -l breadcrumb` over `packages`, `scripts` and `site` (the two most recent control mints), plus the gates those hits name.
   - Some generated files embed unchanged em dashes and are exempt from the em dash check: `board-grid.props.gen.ts` (the generator's own header), `dogfood-assets.ts`, `site/public/llms-full.txt`, both `capability-registry.json`, both `sitemap.json` and `theme-provider-built.css`.
   - Builders never commit.

### Acceptance criteria
- `test -f packages/agent-ui/components/src/controls/board-grid/board-grid.test.ts && test -f packages/agent-ui/components/src/controls/board-grid/board-grid-descriptor.test.ts && test -f packages/agent-ui/components/src/controls/board-grid/board-grid-css.test.ts && npx vitest run --project packages packages/agent-ui/components/src/controls/board-grid`
- `test -f packages/agent-ui/components/src/controls/board-grid/board-grid.browser.test.ts && npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/components/src/controls/board-grid/board-grid.browser.test.ts`
- `grep -qF "'ui-board-grid': { tag: 'ui-board-grid'" packages/agent-ui/components/src/controls/registry.gen.ts && grep -qF '"./controls/board-grid"' packages/agent-ui/components/package.json && node scripts/generate-controls.mjs --check`
- `test -f packages/agent-ui/components/src/controls/board-grid/board-grid.props.gen.ts && npx vitest run --project packages packages/agent-ui/components/src/descriptor/props-gen-driftwire.test.ts`
- `grep -qF "['BoardGrid'," packages/agent-ui/a2ui/src/catalog/default/exclusions.ts && grep -qF '"tag":"ui-board-grid"' packages/agent-ui/a2ui/src/agent/dogfood-fleet.gen.ts && grep -qF '"ui-board-grid"' packages/agent-ui/components/src/controls/sandbox-frame/dogfood/dogfood-assets.ts && grep -qF ui-board-grid site/capability-registry.json && grep -qF ui-board-grid site/public/capability-registry.json && grep -qF ui-board-grid site/lib/__fixtures__/theme-provider-built.css`
- `test -f site/board-grid-doc.html && test -f site/board-grid-demo.html && test -f site/pages/board-grid-doc.ts && test -f site/pages/board-grid-demo.ts && grep -qF "label: 'ui-board-grid'" site/pages/_page.ts && grep -qF "label: 'ui-board-grid'" site/main.ts && grep -qF "'ui-board-grid'" scripts/generate-sitemap.mjs && grep -qF "'ui-board-grid'" site/lib/component-preview.ts && grep -qF board-grid-doc.html site/public/llms.txt && grep -qF board-grid-doc.html site/public/sitemap.json && grep -qF "'board-grid'" packages/agent-ui/components/src/descriptor/site-coverage.test.ts`
- (guard) `npx vitest run --project packages packages/agent-ui/components/src/controls/sizing-gates.test.ts packages/agent-ui/components/src/layering.test.ts packages/agent-ui/components/src/descriptor/props-gen-driftwire.test.ts packages/agent-ui/components/src/controls/controls-gen-driftwire.test.ts packages/agent-ui/components/src/controls/naming-gates.test.ts packages/agent-ui/components/src/controls/styling-gates.test.ts packages/agent-ui/components/src/controls/uses-driftwire.test.ts packages/agent-ui/components/src/controls/css-uses.test.ts`
- (guard) `npx vitest run packages/agent-ui/a2ui/src/catalog/default/index.test.ts packages/agent-ui/a2ui/src/live-agent/dogfood-inventory.test.ts packages/agent-ui/a2ui/src/live-agent/dogfood-tag-set-equality.test.ts packages/agent-ui/a2ui/src/agent/agent-assets-freshness.test.ts packages/agent-ui/a2ui/tools/registry/generate.test.ts packages/agent-ui/components/src/descriptor/site-coverage.test.ts packages/agent-ui/components/src/descriptor/site-toc.test.ts site/lib/controls-coverage.test.ts site/lib/component-preview-slot-text.test.ts site/lib/sitemap.test.ts site/lib/llms.test.ts site/gallery.test.ts site/lib/capability-registry.test.ts`
- `d=$(printf '\342\200\224') && test -f packages/agent-ui/components/src/controls/board-grid/board-grid.md && test -f site/board-grid-doc.html && ! grep -rlF "$d" --exclude='*.gen.ts' packages/agent-ui/components/src/controls/board-grid site/board-grid-doc.html site/board-grid-demo.html site/pages/board-grid-doc.ts site/pages/board-grid-demo.ts && ! git diff "$SDLC_BASE_SHA" -- site/pages/_page.ts site/main.ts site/lib/component-preview.ts site/lib/frontmatter.ts scripts/generate-sitemap.mjs site/public/llms.txt packages/agent-ui/a2ui/src/catalog/default/exclusions.ts packages/agent-ui/components/src/descriptor/site-coverage.test.ts | grep -E '^[+][^+]' | grep -qF "$d"`
- (guard) `npm run check`
- (guard) `npm test`
- (guard) `test -z "$( { git diff --name-only "$SDLC_BASE_SHA" -- . ':(exclude).sdlc'; git ls-files --others --exclude-standard -- . ':(exclude).sdlc'; } | grep -vE '^(packages/agent-ui/components/src/controls/board-grid/|packages/agent-ui/components/src/controls/registry\.gen\.ts$|packages/agent-ui/components/src/all\.gen\.(ts|css)$|packages/agent-ui/components/package\.json$|packages/agent-ui/components/src/controls/sandbox-frame/dogfood/dogfood-assets\.ts$|packages/agent-ui/a2ui/src/agent/(dogfood-fleet|assets)\.gen\.ts$|packages/agent-ui/a2ui/src/catalog/default/exclusions\.ts$|packages/agent-ui/a2ui/src/registry/selection-projection\.gen\.ts$|packages/agent-ui/components/src/descriptor/site-coverage\.test\.ts$|site/board-grid-(doc|demo)\.html$|site/pages/board-grid-(doc|demo)(\.browser\.test)?\.ts$|site/pages/_page\.ts$|site/main\.ts$|site/lib/(frontmatter|component-preview)\.ts$|site/lib/__fixtures__/theme-provider-built\.css$|site/(public/)?(sitemap|capability-registry)\.json$|site/public/llms(-full)?\.txt$|scripts/generate-sitemap\.mjs$)' )"`

## Assumptions
- scope widening, `packages/agent-ui/a2ui/src/catalog/default/exclusions.ts`: forced by `packages/agent-ui/a2ui/src/catalog/default/index.test.ts:171,175`, which requires every fleet type to have a catalog row or an allowlist entry. The "shipped ahead of its catalog row" seed is the recorded precedent (`exclusions.ts:6-40`), and R1 drains it.
- scope widening, `packages/agent-ui/a2ui/src/agent/dogfood-fleet.gen.ts` (generated): it has one row per descriptor and is drift-gated by `packages/agent-ui/a2ui/src/agent/agent-assets-freshness.test.ts` and the `--check` in `check:scripts`. Verified by reading its header (`// Discovery: one row per tagged *.md descriptor`).
- scope widening, `packages/agent-ui/components/src/controls/sandbox-frame/dogfood/dogfood-assets.ts` (generated): it bundles `all.gen.*` and goes red locally on drift (`dogfood-assets-freshness.test.ts`, the non-PR branch). Its `DOGFOOD_TAGS` list is compared by `packages/agent-ui/a2ui/src/live-agent/dogfood-tag-set-equality.test.ts`.
- scope widening, `site/capability-registry.json` and `site/public/capability-registry.json` (generated): both list every control, including the uncatalogued `ui-otp-field` (`grep -c ui-otp-field site/capability-registry.json` printed 2). Drift-gated by `packages/agent-ui/a2ui/tools/registry/generate.test.ts`.
- scope widening, `site/lib/__fixtures__/theme-provider-built.css` (generated): it embeds all control CSS (`grep -o ui-playing-card` counted 44) and goes red locally on drift (`site/lib/theme-provider-build-fixture.test.ts:66-74`).
- scope widening, `site/board-grid-demo.html` and `site/pages/board-grid-demo.ts`: the handoff names only the doc page, but tier `pattern` requires `{doc, demo}` (`site-coverage.test.ts:95`).
- scope widening, `packages/agent-ui/components/src/descriptor/site-coverage.test.ts`: it pins the exact pattern-tier list (`:293-297`).
- scope widening, `site/lib/component-preview.ts`: `site/lib/component-preview-slot-text.test.ts:100` requires every fleet tag to sit in exactly one of three hand-kept sets.
- scope widening, `site/lib/frontmatter.ts`: it holds the per-control doc loader (`loadPlayingCardDoc`, `frontmatter.ts:207`). `ALL_DESCRIPTORS` itself is a glob (`:315`) and needs no edit.
- scope widening, `scripts/generate-sitemap.mjs`, both `sitemap.json` copies, `site/public/llms.txt` and `site/public/llms-full.txt`:
  - `site/lib/sitemap.test.ts:65,92` requires every L1 tag in the taxonomy and the committed file to equal the generator output.
  - `site/lib/llms.test.ts:35,69` gates both llms files. `generate-llms-full.mjs` writes only `llms-full.txt` (its single `writeFileSync` is at `:91`), so `llms.txt` is hand-kept.
- The descriptor stays under the dogfood inventory budget without editing the budget: verified by running `dogfoodInventory()` at base (28,002 of 28,200) and counting the new row's fixed part (about 120 chars).
- Corner glyphs: success `+`, warning `?` and neutral `-` come from the approved mockup legend (`body.html:22`). No record backs danger `!` and info `i`; they follow the "intent never carried by color alone" law (ADR-0243:105-106 and the States row at :130).
- Read-only boards keep the roving tab stop. This is settled by the unconditional A11y row (ADR-0243:131) over the Anatomy row's "non-interactive cell" (ADR-0243:126), which this plan reads as "not activatable".
- `[data-part="row"]` with `role=row` goes beyond the fork sheet's cell part. ARIA 1.2 requires a gridcell to be owned by a row, and `display: contents` keeps the single CSS grid the sheet specifies.
- 0-based `row`/`col` in data and `context`: verified by the mockup data model (`body.html:58-60`). R1's seeds depend on this.
- Array props generate through a model module: verified by `controls/source-list/source-list.props.gen.ts:4` and `controls/table/table.props.gen.ts:8`.
- `npm run check` and `npm test` were not run at plan time, under rule 1's broad-suite carve-out. The base is merged main `298fe4ee`. `guard timeout: 400` comes from a recorded completed `npm test` run of 117 s (`.sdlc/*/step-*/verifier-*.md`). The recorded runs past 600 s were timeouts, not baselines.
- Rule 11 red for the two focused guards: each gate file carries its own in-file negative control, for example `controls/sizing-gates.test.ts:204` "negative control: the scan bites on a synthetic offender". All three focused guards were dry-run green at base: the first ran 8 files and 651 tests, the second ran 13 files with 595 passed and 5 skipped, and the scope guard passed. The scope guard went red against `HEAD~4`.
- Every new-behavior criterion was red at base because the file or entry it checks is missing. `node scripts/generate-controls.mjs --check` alone exits 0 at base ("in sync for 82 fleet controls").
- The em dash criterion's diff leg goes red on the playing-card mint `befc6f16`, whose added `site/main.ts` lines carry em dashes. Its file leg is red at base because the files do not exist yet.

## Risks
- C2 (`ui-product-card`) and C3 (`ui-game-hud`) run in parallel and edit the same shared files: the pattern-tier list in `site-coverage.test.ts`, `exclusions.ts`, both taxonomies, the `_page.ts` NAV, `main.ts`, `component-preview.ts`, `llms.txt`, and every regenerated artifact. Each one merges by hand at integration, and the generators re-run on the merged tree.
- The C1, C2 and C3 rows together exceed `DOGFOOD_INVENTORY_CHAR_BUDGET` 28,200 at integration. Whoever lands last re-measures and applies the recorded formula (measured, rounded up to the next 100, plus 300). That change also updates the SPEC-R13(b) line in `.claude/docs/spec/genui-surface.spec.md`, following the 2026-10-05 precedent at `dogfood-inventory.ts:84-86`.
- No approved record backs the danger `!` and info `i` corner glyphs, and Kim may want different ones. Changing them is cosmetic: `board-grid.ts` and the descriptor.
- `npm run test:browser:site`, including `site/lib/component-preview-fleet.browser.test.ts`, is outside this ticket's Done-when. A red in that shard would show up in CI or the next browser run.
- With three lanes running at once (four workers each in worktrees), `npm test` can run past the 400 s guard timeout from load alone. Apply the flaky-gates rule (rerun alone) before treating that red as a regression.
