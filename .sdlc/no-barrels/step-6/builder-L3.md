<!-- role=builder level=L3 model=opus effort=high -->
## Status
blocked

## Changes
- `packages/agent-ui/a2ui/src/catalog/controls.ts` (new): `BUILTIN_CONTROL_RECORDS` (`CONTROLS` plus 6 sub-element alias records) and `builtinControls = createControlLoader(..., { css: 'host' })`.
- `packages/agent-ui/a2ui/src/catalog/default/factories.ts`: fleet import removed; header comment updated; `buttonFactory.uses = ['ui-icon']`.
- `packages/agent-ui/a2ui/src/catalog/a2ui-basic/factories.ts`: fleet import removed.
- `packages/agent-ui/a2ui/src/catalog/personas/concierge/factories.ts`: fleet import removed; `uses` added on `bookingFormFactory` and `bookingConfirmationFactory`.
- `packages/agent-ui/a2ui/src/catalog/personas/croupier/factories.ts`: fleet import removed.
- `packages/agent-ui/a2ui/src/catalog/personas/croupier/index.ts`: `controls: [CONTROLS['ui-playing-card']!]`.
- `packages/agent-ui/a2ui/src/catalog/types.ts`: `WidgetFactory.uses?: readonly string[]`.
- `packages/agent-ui/a2ui/src/renderer/renderer.ts`: `builtinControls` passed as the 4th `register` argument for default and both a2ui-basic ids; `#controlTagsOf` collects `tag` plus `uses` and keeps only custom-element names.
- `packages/agent-ui/a2ui/src/renderer/widget.ts`: new `isControlTag`; the failed-load placeholder check skips non-custom tags.
- `packages/agent-ui/a2ui/src/renderer/control-loading.test.ts`: header comment only (its "the renderer defines the fleet" claim is now false).
- `packages/agent-ui/a2ui/src/renderer/builtin-controls.test.ts` (new): 9 tests.
- `packages/agent-ui/a2ui/src/renderer/control-loading.browser.test.ts` (new).
- `packages/agent-ui/app/src/control-reach.test.ts` (new): one crawl per export target, plus negative and positive fixtures.
- `packages/agent-ui/app/src/controls/conversation/conversation-composer.ts`: per-control imports for button, icon, menu and switch; type imports moved to subpaths.
- `packages/agent-ui/app/src/controls/conversation/conversation.ts`: per-control imports for icon and status-stream; types moved to the status-stream and sandbox-frame subpaths.
- `packages/agent-ui/app/src/controls/agent-admin/agent-admin.ts`: type import moved to the sandbox-frame subpath.
- `packages/agent-ui/app/src/controls/entry-list/entry-form.ts` and `entry-list.ts`: per-control side-effect imports.
- Tests that now import `@agent-ui/components/all`:
  - a2ui: `upstream-fixtures`, `default/factories`, `default/index`, `concierge/factories`, `backable-wizard`, `examples`, `bound-text`, `checkbox-group-layout`, `renderer-persona-catalogs`, `widget`.
  - site: `site/lib/a2ui-gallery.test.ts`, `site/lib/canvas-surface.browser.test.ts`.
  - app browser: `conversation.browser.test.ts`, `surface-host.browser.test.ts`.
- `packages/agent-ui/a2ui/README.md`: host recipe (`foundation-styles.css`, `shared-styles.css`, `all.css` or per-control sheets); the renderer defines the controls.
- `packages/agent-ui/a2ui/AGENTS.md`: Catalogs bullet (factory modules import no controls; `builtinControls`; `uses`; sub-tag aliases; the gate).
- `scripts/measure-size.mjs`: app row comment (structural fix, ADR-0233, measured 69769 B gz).

## Checks
Logs are in `.sdlc/no-barrels/step-6/logs/`.
- AC1 `! git grep -qE ...'@agent-ui/components/components'...`: rc 0.
- AC2 `npm run size`: rc 0, no `size:` lines. App marginal is 69769 B gz against the 106559 budget (was 106987, red); family is 71967/72192.
- AC3 `npx vitest run .../builtin-controls.test.ts`: rc 0, 9 passed.
- AC4 `npx vitest run .../control-reach.test.ts`: rc 0, 9 passed.
- AC5 grep for `controls/switch` in `conversation-composer.ts`: rc 0.
- (guard) `npx vitest run packages/agent-ui/a2ui/src packages/agent-ui/app/src packages/agent-ui/devtools/src && npx vitest run --project site`: rc 0. 188 files and 4140 tests passed (1 skipped); site 73 files, 1277 tests.
- (guard) `npm run test:browser:packages:app && npm run test:browser:packages:rest`: rc 0. App 842 passed; rest 80 passed.
- AC8 `! grep -qF 'component-styles.css' packages/agent-ui/a2ui/README.md`: rc 0.
- AC9 grep plus `npx vitest run --config vitest.browser.config.ts --project packages-rest .../control-loading.browser.test.ts`: rc 0, 2 passed (chromium and webkit).
- (guard) `npm run check`: rc 0. Run twice; the second run came after the last edit.
- (guard) scope allow-list: **rc 1**. The only offending file is `packages/agent-ui/a2ui/tools/harness/validate-payload.ts`. The same list with that one path added: rc 0.
- Bite checks, with files restored afterwards:
  - Removing `uses: ['ui-icon']` from `buttonFactory` turns the Button/icon test red.
  - Removing `builtinControls` from the default registration turns 3 tests red.
- Extra, not a criterion: `npm run test:browser:site` rc 1, with one failure in `site/pages/swiper-item-demo.browser.test.ts` (chromium, `expected 'welcome' to be 'rules'`). The same test fails the same way at `$SDLC_BASE_SHA` in a throwaway worktree, so it was already red before this run. That worktree is removed.

## Notes
plan defect: the (guard) scope allow-list leaves out `packages/agent-ui/a2ui/tools/harness/validate-payload\.ts`. Step 5 widened that path and the file is still modified in the tree (step 5's `CONTROL_LOAD` entry). This step never touched it. The guard diffs against the base commit, so it carries every earlier step's files; step 2's Do requires each step's list to repeat them. Steps 7 and 8 also lack that path (the grep count is 0 in both handoffs), so one widen should cover steps 6 to 8. All work is left in the tree, uncommitted.

Findings beyond the handoff:
- **Assumption about factory tags was wrong.** Step 5's planner said each factory creates only its own tag. Three factories mint other tags:
  - `default/factories.ts` Button `applyProp` creates `ui-icon` (line ~230).
  - `concierge/factories.ts:111-153,195,277-312` create `ui-text`, `ui-select`, `ui-checkbox` and `ui-calendar` under `ui-form-provider` and `ui-card`.
  - Without a fix those tags would never be defined on the loader path. I added the optional `WidgetFactory.uses` and set it on those three factories. The planner decides whether this stays.
- **Non-custom factory tags.** `div`, `img` and `div[role=…]` would have reached the loader as unknown tags, emitted `CONTROL_LOAD` and rendered placeholders. `isControlTag` now filters them out in both `widget.ts` and `#controlTagsOf`.
- **Sub-element tags have no registry record.** These six are covered by the hand-kept `SUB_TAGS` alias map in `controls.ts`, guarded by `builtin-controls.test.ts`:
  - `ui-card-header`, `ui-card-content`, `ui-card-footer`
  - `ui-drill-panel`
  - `ui-tab`, `ui-tab-panel`
  - The lasting fix would be an alias list emitted by `generate-controls` into `registry.gen.ts`; left for the planner.
- **Hidden dependencies beyond the planner's table.** The new gate found them in `entry-list.ts` and `entry-form.ts`, as well as the expected ones in `conversation.ts` and `conversation-composer.ts`.
- **Stale records outside this step's scope:**
  - `.claude/docs/spec/a2ui-catalog.spec.md` §5.1 lists the `WidgetFactory` fields and does not include `uses`.
  - `.claude/docs/lld/a2ui-catalog.lld.md:214` still says `default/factories.ts` imports controls from `@agent-ui/components`.
- **Shards not run:** focus-timing, visual and `test:eval-catalog`. The site browser shard was run, with the result above.
