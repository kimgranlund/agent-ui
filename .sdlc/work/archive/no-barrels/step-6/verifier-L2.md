<!-- role=verifier level=L2 model=sonnet effort=high -->
## Verdict
pass

## Criteria
- `! git grep -qE "(from |import |import\()'@agent-ui/components/components'" -- a2ui/src app/src ':!*.test.ts'`: pass. rc 0 on the built tree. The same grep at `$SDLC_BASE_SHA` hits 7 files (the four factories, `agent-admin.ts`, `conversation-composer.ts`, `conversation.ts`), so the check bites.
- `npm run size`: pass. rc 0 and no `size:` lines in the output. The app `.` row reads "marginal 69769 B gz, within budget (106559 B gz)".
- `npx vitest run .../renderer/builtin-controls.test.ts`: pass. rc 0, 9 passed.
- `npx vitest run .../app/src/control-reach.test.ts`: pass. rc 0, 9 passed. It holds the negative-control fixture (line 233): `<ui-switch>` rendered without an import is flagged.
- `grep -qF '@agent-ui/components/controls/switch' .../conversation-composer.ts`: pass. rc 0.
- (guard) jsdom `a2ui/src app/src devtools/src` plus `--project site`: pass. rc 0. jsdom: 188 files passed (1 skipped), 4140 tests passed. Site: 73 files, 1277 tests passed.
- (guard) `npm run test:browser:packages:app && npm run test:browser:packages:rest`: pass. rc 0. App: 842 passed. Rest: 80 passed.
- `! grep -qF 'component-styles.css' packages/agent-ui/a2ui/README.md`: pass. rc 0.
- `customElements.get('ui-table')` grep plus the `packages-rest` browser run of `control-loading.browser.test.ts`: pass. Grep rc 0; run rc 0, 2 passed (chromium and webkit). I read the test. It asserts that `ui-table` is undefined first, then that it is defined, that there is exactly one `link[data-ui-control="ui-table"]`, and that `--ui-table-min-inline-size` computes to `16em`.
- (guard) `npm run check`: pass. rc 0.
- (guard) scope allow-list, run verbatim: pass. rc 0 with 194 changed files. Adding a stray `zz-probe.txt` at the repo root gives rc 1, so the guard bites. I removed the probe afterwards. The allow-list now includes `validate-payload.ts` and the a2ui-catalog spec and LLD.

## Out of scope changes
None. The scope guard passes. The tree is uncommitted at the base SHA, so earlier steps' files appear in the diff and are all covered by the allow-list.

## For the next attempt
None.
