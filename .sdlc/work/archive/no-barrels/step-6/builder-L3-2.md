<!-- role=builder level=L3 model=opus effort=high -->
## Status
done

## Changes
This attempt changed two files. The step-6 code from attempt 1 is still in the tree and was not touched:
- `.claude/docs/spec/a2ui-catalog.spec.md`: §5.1 now has the optional `WidgetFactory.uses`, the optional fourth `register` argument `controls?: ControlLoader` with a comment explaining it (factory modules import no control; built-ins register `builtinControls`), and `controls?` in the `get` return. The status line moves to v0.5 with a note citing ADR-0233.
- `.claude/docs/lld/a2ui-catalog.lld.md`: rewrote the stale "factories import `ui-*` controls from `@agent-ui/components`" lines. The Dependencies line (22) and the §9 Integration line now say factories import no control and the renderer registers `builtinControls`. `controls.ts` is added to the §9 file list.

Attempt-1 changes still in the tree, unchanged (listed in full in `builder-L3.md`):
- a2ui:
  - `catalog/controls.ts` (new)
  - factory files: `default`, `a2ui-basic`, `concierge`, `croupier`
  - `croupier/index.ts`, `types.ts`
  - `renderer.ts`, `widget.ts`
  - `builtin-controls.test.ts` (new), `control-loading.browser.test.ts` (new)
  - test files that import `@agent-ui/components/all`
  - `README.md`, `AGENTS.md`
- app:
  - `control-reach.test.ts` (new)
  - `conversation-composer.ts`, `conversation.ts`, `agent-admin.ts`, `entry-form.ts`, `entry-list.ts`
  - two browser tests
- site tests, and `scripts/measure-size.mjs`

## Checks
Logs from this attempt are in `.sdlc/work/no-barrels/step-6/logs/`.
- AC1 `! git grep -qE "(from |import |import\()'@agent-ui/components/components'" -- packages/agent-ui/a2ui/src packages/agent-ui/app/src ':!*.test.ts'`: rc 0.
- AC2 `npm run size` (`size-3.log`): rc 0, and no line starts with `size:`. The app `.` row is 69769 B gz marginal against a budget of 106559, so it is within budget.
- AC3 `npx vitest run packages/agent-ui/a2ui/src/renderer/builtin-controls.test.ts` (`ac3-2.log`): rc 0, 9 passed.
- AC4 `npx vitest run packages/agent-ui/app/src/control-reach.test.ts` (`ac4-2.log`): rc 0, 9 passed.
- AC5 `grep -qF '@agent-ui/components/controls/switch' .../conversation-composer.ts`: rc 0.
- (guard) `npx vitest run packages/agent-ui/a2ui/src packages/agent-ui/app/src packages/agent-ui/devtools/src && npx vitest run --project site` (`jsdom-2.log`, `site-2.log`):
  - jsdom: rc 0, 188 files passed (1 skipped), 4140 tests passed (1 skipped).
  - site: rc 0, 73 files, 1277 tests passed (5 skipped).
- (guard) `npm run test:browser:packages:app && npm run test:browser:packages:rest` (`browser-app-2.log`, `browser-rest-2.log`): app rc 0 with 842 passed; rest rc 0 with 80 passed.
- AC8 `! grep -qF 'component-styles.css' packages/agent-ui/a2ui/README.md`: rc 0.
- AC9 grep plus `npx vitest run --config vitest.browser.config.ts --project packages-rest .../control-loading.browser.test.ts` (`ac9-2.log`): rc 0, 2 passed (chromium and webkit).
- (guard) `npm run check` (`check-3.log`): rc 0. It ran after the doc edits.
- (guard) scope allow-list (`scope-2.sh`, the handoff line taken out verbatim; 1958 bytes; it includes the widened `validate-payload`, `a2ui-catalog.spec` and `a2ui-catalog.lld` paths), with `SDLC_BASE_SHA=afa231ae`: rc 0.
  - Bite check: an untracked `zz-probe.txt` at the repo root gives rc 1. After removing it, rc is 0 again.

## Notes
- The scope guard that blocked attempt 1 passes now that the conductor widened it.
- `WidgetFactory.uses` is a design addition from attempt 1. Three factories create tags beyond their own: Button creates `ui-icon`, and two concierge factories create text, select, checkbox and calendar. The planner should ratify it. It is now recorded in SPEC §5.1 (v0.5).
- The `SUB_TAGS` alias map in `a2ui/src/catalog/controls.ts` is kept by hand. It covers six tags: `ui-card-header`, `ui-card-content`, `ui-card-footer`, `ui-drill-panel`, `ui-tab` and `ui-tab-panel`. `builtin-controls.test.ts` guards it. The lasting fix is for `generate-controls` to emit these aliases into `registry.gen.ts`; that is for the planner to schedule.
- SPEC §5.1 is pseudo-TS. It names `ControlLoader` (from `@agent-ui/components/loader`) without declaring it in the block, which matches how the block already treats `JSONSchema`.
- I left the LLD status line at v0.1 on purpose. Only two prose lines and the file list changed there, and no contract moved; the contract change is versioned in the SPEC.
- Not run this attempt, and none of these is a criterion:
  - `test:browser:site`. Attempt 1 found `site/pages/swiper-item-demo.browser.test.ts` red, and red the same way at base (inherited). I did not rerun it.
  - The focus-timing, visual and `test:eval-catalog` shards.
- Nothing was committed.
