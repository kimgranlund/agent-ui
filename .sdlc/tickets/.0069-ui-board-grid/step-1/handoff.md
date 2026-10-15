## Task goal
C1: ui-board-grid control (child C1 of the preset-widgets campaign; design `.sdlc/tickets/.0065-preset-widgets-design/design.md`).

## Step 1: verify the committed board-grid build
level: L2
### Read first
- `packages/agent-ui/components/AGENTS.md`
- `packages/agent-ui/a2ui/AGENTS.md`
### Do
Depends on: none. This one-step plan is the gates green step.

base: 298fe4eeca4dae427a11bfaef77d7d05db0234ef

The `base:` line above makes the parent of the WIP commit the step base. The build is already committed, so without a named base the step base would be HEAD (6daa9b62). The em dash diff leg and the scope guard would then compare the build with itself and pass without checking anything. Every criterion still reads `$SDLC_BASE_SHA`.

Do not rebuild the control. It is complete in WIP commit 6daa9b62:
- the control folder `packages/agent-ui/components/src/controls/board-grid/` and its tests
- the generated artifacts
- the site doc and demo pages
- the nav entries

The settled interface is in items 2 to 6 of `.sdlc/0069-ui-board-grid/step-1.superseded-1/handoff.md`: props, 0-based data with 1-based names, intents, the `action` detail, anatomy, keyboard, updates and CSS. What was built, and why, is in `.sdlc/0069-ui-board-grid/step-1.superseded-1/builder-L3.md`. Read both before running anything.

1. Run every criterion below, in order, on the current tree.
2. If a criterion is red, fix it within the scope guard's allow-list and the settled interface. Never hand-edit a generated file: rerun its generator in the order given by item 3 of the superseded handoff. After any change to `packages/agent-ui/a2ui/src/catalog/default/exclusions.ts`, run `npm run generate:registry`. This is the ordering trap in the Notes of builder-L3.md, and 6daa9b62 already resolves it.
3. The corrected sitemap criterion: `scripts/generate-sitemap.mjs` writes one L1 entry per tag and uses `./{slug}-demo.html` whenever that page exists (lines 17-18, 185 and 203, GH #1619). So `site/public/sitemap.json` and `site/sitemap.json` list `./board-grid-demo.html` and never `board-grid-doc.html`, as they list `./service-card-demo.html`. The doc page is indexed in `site/public/llms.txt` instead.
4. The browser criterion runs only `board-grid.browser.test.ts`, in the `packages` browser project (Chromium and WebKit). This is the Done-when's "browser test in its own shard run alone".
5. The `npm test` flake: the full run on 2026-10-12 failed one timing assertion in `packages/agent-ui/app/src/controls/conversation/conversation.test.ts`, in the test "reasoning never enters the single \"Raw output\" row, and does not change the receipt step count" (expected 'Done in 0.1s' to be 'Done'). That file is outside this ticket. Apply the flaky-gates rule: if `npm test` is red only there, run `npx vitest run --project packages packages/agent-ui/app/src/controls/conversation/conversation.test.ts` alone, then rerun `npm test` once. Report both outputs. Do not edit the app package.
6. The em dash criterion exempts generated files that embed unchanged text, as the Done-when allows; say so in the result. The exempt files are:
   - `board-grid.props.gen.ts` (the generator's header)
   - `dogfood-assets.ts`
   - `site/public/llms-full.txt`
   - both `capability-registry.json` copies
   - both `sitemap.json` copies
   - `theme-provider-built.css`
7. Builders never commit. Any fix stays uncommitted on top of 6daa9b62 for the conductor.

Validation scope: the criteria below. The superseded plan settled the contract dependents (`.sdlc/0069-ui-board-grid/planner-L3.md`, Do item 7), and the two focused guards cover them. This replan changes no contract.

### Acceptance criteria
- `test -f packages/agent-ui/components/src/controls/board-grid/board-grid.test.ts && test -f packages/agent-ui/components/src/controls/board-grid/board-grid-descriptor.test.ts && test -f packages/agent-ui/components/src/controls/board-grid/board-grid-css.test.ts && npx vitest run --project packages packages/agent-ui/components/src/controls/board-grid`
- `test -f packages/agent-ui/components/src/controls/board-grid/board-grid.browser.test.ts && npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/components/src/controls/board-grid/board-grid.browser.test.ts`
- `grep -qF "'ui-board-grid': { tag: 'ui-board-grid'" packages/agent-ui/components/src/controls/registry.gen.ts && grep -qF '"./controls/board-grid"' packages/agent-ui/components/package.json && node scripts/generate-controls.mjs --check`
- `test -f packages/agent-ui/components/src/controls/board-grid/board-grid.props.gen.ts && npx vitest run --project packages packages/agent-ui/components/src/descriptor/props-gen-driftwire.test.ts`
- `grep -qF "['BoardGrid'," packages/agent-ui/a2ui/src/catalog/default/exclusions.ts && grep -qF '"tag":"ui-board-grid"' packages/agent-ui/a2ui/src/agent/dogfood-fleet.gen.ts && grep -qF '"ui-board-grid"' packages/agent-ui/components/src/controls/sandbox-frame/dogfood/dogfood-assets.ts && grep -qF ui-board-grid site/capability-registry.json && grep -qF ui-board-grid site/public/capability-registry.json && grep -qF ui-board-grid site/lib/__fixtures__/theme-provider-built.css`
- `test -f site/board-grid-doc.html && test -f site/board-grid-demo.html && test -f site/pages/board-grid-doc.ts && test -f site/pages/board-grid-demo.ts && grep -qF "label: 'ui-board-grid'" site/pages/_page.ts && grep -qF "label: 'ui-board-grid'" site/main.ts && grep -qF "'ui-board-grid'" scripts/generate-sitemap.mjs && grep -qF "'ui-board-grid'" site/lib/component-preview.ts && grep -qF board-grid-doc.html site/public/llms.txt && grep -qF board-grid-demo.html site/public/sitemap.json && grep -qF board-grid-demo.html site/sitemap.json && grep -qF "'board-grid'" packages/agent-ui/components/src/descriptor/site-coverage.test.ts`
- (guard) `npx vitest run --project packages packages/agent-ui/components/src/controls/sizing-gates.test.ts packages/agent-ui/components/src/layering.test.ts packages/agent-ui/components/src/descriptor/props-gen-driftwire.test.ts packages/agent-ui/components/src/controls/controls-gen-driftwire.test.ts packages/agent-ui/components/src/controls/naming-gates.test.ts packages/agent-ui/components/src/controls/styling-gates.test.ts packages/agent-ui/components/src/controls/uses-driftwire.test.ts packages/agent-ui/components/src/controls/css-uses.test.ts`
- (guard) `npx vitest run packages/agent-ui/a2ui/src/catalog/default/index.test.ts packages/agent-ui/a2ui/src/live-agent/dogfood-inventory.test.ts packages/agent-ui/a2ui/src/live-agent/dogfood-tag-set-equality.test.ts packages/agent-ui/a2ui/src/agent/agent-assets-freshness.test.ts packages/agent-ui/a2ui/tools/registry/generate.test.ts packages/agent-ui/components/src/descriptor/site-coverage.test.ts packages/agent-ui/components/src/descriptor/site-toc.test.ts site/lib/controls-coverage.test.ts site/lib/component-preview-slot-text.test.ts site/lib/sitemap.test.ts site/lib/llms.test.ts site/gallery.test.ts site/lib/capability-registry.test.ts`
- `d=$(printf '\342\200\224') && test -f packages/agent-ui/components/src/controls/board-grid/board-grid.md && test -f site/board-grid-doc.html && ! grep -rlF "$d" --exclude='*.gen.ts' packages/agent-ui/components/src/controls/board-grid site/board-grid-doc.html site/board-grid-demo.html site/pages/board-grid-doc.ts site/pages/board-grid-demo.ts && ! git diff "$SDLC_BASE_SHA" -- site/pages/_page.ts site/main.ts site/lib/component-preview.ts site/lib/frontmatter.ts scripts/generate-sitemap.mjs site/public/llms.txt packages/agent-ui/a2ui/src/catalog/default/exclusions.ts packages/agent-ui/components/src/descriptor/site-coverage.test.ts | grep -E '^[+][^+]' | grep -qF "$d"`
- (guard) `npm run check`
- (guard) `npm test`
- (guard) `test -z "$( { git diff --name-only "$SDLC_BASE_SHA" -- . ':(exclude).sdlc'; git ls-files --others --exclude-standard -- . ':(exclude).sdlc'; } | grep -vE '^(packages/agent-ui/components/src/controls/board-grid/|packages/agent-ui/components/src/controls/registry\.gen\.ts$|packages/agent-ui/components/src/all\.gen\.(ts|css)$|packages/agent-ui/components/package\.json$|packages/agent-ui/components/src/controls/sandbox-frame/dogfood/dogfood-assets\.ts$|packages/agent-ui/a2ui/src/agent/(dogfood-fleet|assets)\.gen\.ts$|packages/agent-ui/a2ui/src/catalog/default/exclusions\.ts$|packages/agent-ui/a2ui/src/registry/selection-projection\.gen\.ts$|packages/agent-ui/components/src/descriptor/site-coverage\.test\.ts$|site/board-grid-(doc|demo)\.html$|site/pages/board-grid-(doc|demo)(\.browser\.test)?\.ts$|site/pages/_page\.ts$|site/main\.ts$|site/lib/(frontmatter|component-preview)\.ts$|site/lib/__fixtures__/theme-provider-built\.css$|site/(public/)?(sitemap|capability-registry)\.json$|site/public/llms(-full)?\.txt$|scripts/generate-sitemap\.mjs$)' )"`
