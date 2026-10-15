<!-- role=builder level=L3 model=opus effort=high -->
## Status
blocked

## Changes
- 164 `.ts` importer files under `packages/*/src` and `site/` (list in `.sdlc/no-barrels/step-7/files.txt`). A fleet side-effect import, static or `await import(...)`, now uses `@agent-ui/components/all`. Every `component-styles.css` import now uses `@agent-ui/components/all.css`. Named type and value imports moved to their `@agent-ui/components/controls/{name}` subpath. Comments in these files that named a barrel were rewritten.
- `packages/agent-ui/a2ui/src/renderer/renderer.test.ts`: per-control value imports, plus a side-effect `import '@agent-ui/components/all'`. The old barrel value import was also what registered the fleet; without it, 32 cases failed.
- `site/pages/getting-started.ts`: the recipe now shows the per-control import order (foundation, shared-styles, `controls/button.css`, `controls/button`) and calls `all`/`all.css` demo-only. The prose in the "Per-control imports" section no longer names the barrel.
- `site/pages/testing-guide.ts`: the example test imports `controls/button` and says `all` is demo-only.
- `scripts/build-dogfood-assets.mjs`: `ENTRY_SOURCE` is now foundation-styles.css, all.css, all, phosphor. The header template names `foundation-styles.css -> all.css -> all -> @agent-ui/icons/phosphor`.
- `packages/agent-ui/components/src/controls/sandbox-frame/dogfood/dogfood-assets.ts`: regenerated (`npm run regen:dogfood-assets`). `DOGFOOD_TAGS` is unchanged (88 tags, same list byte for byte).
- `scripts/verify-consumer-install.mjs`: the scaffolded `main.js` imports foundation-styles.css, shared-styles.css, `controls/button.css` and `controls/button` (kit scope). The esm.sh probe fetches tokens.css, `/shared-styles.css`, `/controls/button.css` and `/controls/button`. The `--ui-button-`/`--md-sys-color-` asserts stay; one error message was updated.
- `packages/agent-ui/components/README.md`: the four-line host contract replaces the barrel recipe, `all`/`all.css` are named demo-only, and the CDN recipe uses the per-control sheets and module.
- `.claude/skills/app-composition/SKILL.md`: step 2 is now the four-line host contract with `all` for demos only; line 60 says the kernel is exported from the package root.
- `.claude/skills/component-testing/SKILL.md`: added the rule that tests import the per-control pair or the demo-only `all`/`all.css`.
- `.claude/skills/component-testing/references/test-craft.md`: line 88 says "package entry" instead of "barrel".
- `.claude/skills/package-release/references/release-facts.md`: the CDN-safety line names shared-styles.css, the control sheets and all.css instead of component-styles.css.
- `.claude/docs/lld/genui-dogfood.lld.md`: LLD-C1 entry list and the LLD-C5 / set-equality mentions now name `all.css`/`all`.

## Checks
- `! git grep -qE "(from |import |import\()'@agent-ui/components/components'" -- packages site scripts ':!site/.fixture-scratch'`: pass.
- `! git grep -qE '@agent-ui(-kit)?/components/component-styles\.css' -- packages site scripts ':!site/.fixture-scratch'`: pass.
- `grep -qF "import '@agent-ui/components/all'" scripts/build-dogfood-assets.mjs`: pass.
- `grep -qF 'controls/button.css' scripts/verify-consumer-install.mjs && node --check scripts/verify-consumer-install.mjs`: pass.
- (guard) `npm run check`: exit 0, run three times, the last after the final edit.
- Changed-tests criterion, run under `bash -c`: 25 files, 1496 tests, exit 0. The first run (before the renderer.test.ts fix) had 32 failures in renderer.test.ts.
- (guard) `npx vitest run --project site` (73 files, 1277 passed, 5 skipped) followed by the dogfood freshness and tag-set-equality tests (2 files, 14 passed): exit 0. The site project was rerun after the last getting-started edit and stayed green.
- (guard) `__baselines__` diff and untracked check: empty, exit 0, checked before and after the shards.
- (guard) `npm run test:browser:packages:app && ...:rest && ...:focus-timing`: exit 0 (842, 80, and 441 passed + 1 skipped).
- (guard) `npm run test:browser:packages:components -- -t '^(?!.*context-labels and the wide name)'`: exit 0 (2420 passed, 4 skipped).
- (guard) `npm run test:browser:site -- -t '^(?!.*resolves by KEY on the tour)'`: exit 0 (946 passed, 2 skipped).
- (guard) `npm run test:visual -- -t '^(?!.*nav OVERLAY-OPEN)'`: exit 0 (61 passed, 1 skipped).
- Records criterion (shared-styles.css present in both files; no `component-styles.css` or `components/components` in the five records): pass.
- (guard) scope allow-list: **red**. Two lines come through: `.claude/docs/lld/a2ui-catalog.lld.md` and `.claude/docs/spec/a2ui-catalog.spec.md`.
- I did not run the three-shard guard before the migration. After it, all six shards were green with only the three named skips, so there was nothing to compare against a pre-migration run.

## Notes
plan defect: the scope guard (last `(guard)` criterion) does not allow the two files step 6 widened by conductor decision, `.claude/docs/spec/a2ui-catalog.spec.md` and `.claude/docs/lld/a2ui-catalog.lld.md`. Step 7's "Scope widened" carried forward only `validate-payload.ts`. This step changed neither file: both were last modified at 16:07:15 local, before this run started at 16:14:47. Reverting them would undo step 6. Fix: `steps.py widen` step 7 with both files; the guard then passes with no rebuild. The work is left in the tree uncommitted, and every other criterion passes.

- **Shell:** the changed-tests criterion needs a shell that word-splits `$files`. In zsh it prints "No test files found" and exits 1, so run it under bash.
- **Throwaway scripts:** `codemod.mjs` (TS-AST rewrite), `comments.mjs`, the logs and the tag snapshots are scratch files under `.sdlc/no-barrels/step-7/`, which the scope guard excludes.
- **Left for step 8:** barrel mentions this step's rules did not cover, either comments in files it didn't touch or the barrels themselves. Step 8 needs this list before deleting:
  - `vitest.config.ts:151`: the `component-styles.css?url` alias.
  - `vite.config.ts:27`: a comment.
  - `scripts/measure-size.mjs:225`: measures `src/controls/index.ts` directly, so deleting the barrel breaks it. Lines 679 and 698 are comments.
  - `packages/agent-ui/components/src/controls/menu/menu.css:21`: a comment.
  - `packages/agent-ui/a2ui/src/examples/{index,types}.ts`: comments.
  - `packages/agent-ui/components/src/controls/disclosure/disclosure.browser.test.ts:9`: a comment.
  - `packages/agent-ui/components/src/descriptor/site-coverage.test.ts:458`: a comment.
  - `packages/agent-ui/components/src/controls/tabs/tabs.md`: a mention.
  - The `./components` and `./component-styles.css` exports keys.
  - The components `AGENTS.md` mention of `src/component-styles.css`.
  - `site/.fixture-scratch/`: untouched on purpose.
