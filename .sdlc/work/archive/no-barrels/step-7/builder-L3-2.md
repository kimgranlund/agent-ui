<!-- role=builder level=L3 model=opus effort=high -->
## Status
done

## Changes
Attempt 1 (`builder-L3.md`) made these changes. They are still in the tree, uncommitted. This rerun made no source edits; it only reran every check.
- 164 `.ts` importer files under `packages/*/src` and `site/` (list in `.sdlc/work/no-barrels/step-7/files.txt`): fleet side-effect imports, static or `await import(...)`, now use `@agent-ui/components/all`. `component-styles.css` imports now use `@agent-ui/components/all.css`. Named type and value imports now use `@agent-ui/components/controls/{name}`. Comments in these files that named a barrel were rewritten.
- `packages/agent-ui/a2ui/src/renderer/renderer.test.ts`: per-control value imports, plus a side-effect `import '@agent-ui/components/all'`.
- `site/pages/getting-started.ts`, `site/pages/testing-guide.ts`: show the per-control recipe (foundation, shared-styles, `controls/button.css`, `controls/button`) and call `all`/`all.css` demo-only.
- `scripts/build-dogfood-assets.mjs`: `ENTRY_SOURCE` is now foundation-styles.css, all.css, all, phosphor, and the header template names that order.
- `packages/agent-ui/components/src/controls/sandbox-frame/dogfood/dogfood-assets.ts`: regenerated with `npm run regen:dogfood-assets`. `DOGFOOD_TAGS` is unchanged (88 tags).
- `scripts/verify-consumer-install.mjs`: the scaffolded `main.js` and the esm.sh probe use shared-styles.css, `controls/button.css` and `controls/button`. The `--ui-button-` and `--md-sys-color-` asserts are kept.
- `packages/agent-ui/components/README.md`: host contract, demo-only `all`/`all.css`, per-control CDN recipe.
- `.claude/skills/app-composition/SKILL.md`: the four-line host contract, plus line 60.
- `.claude/skills/component-testing/SKILL.md`, `.claude/skills/component-testing/references/test-craft.md`: the test import rule.
- `.claude/skills/package-release/references/release-facts.md`: CDN-safety line.
- `.claude/docs/lld/genui-dogfood.lld.md`: LLD-C1 entry list and the LLD-C5 and set-equality mentions.

## Checks
All runs below are from this attempt, judged by exit code and run under `bash` where the shell matters.
- `! git grep -qE "(from |import |import\()'@agent-ui/components/components'" -- packages site scripts ':!site/.fixture-scratch'`: pass.
- `! git grep -qE '@agent-ui(-kit)?/components/component-styles\.css' -- packages site scripts ':!site/.fixture-scratch'`: pass.
- `grep -qF "import '@agent-ui/components/all'" scripts/build-dogfood-assets.mjs`: pass.
- `grep -qF 'controls/button.css' scripts/verify-consumer-install.mjs && node --check scripts/verify-consumer-install.mjs`: pass.
- (guard) `npm run check`: exit 0.
- Changed-tests criterion (`files=$(git diff ...); test -n "$files" && npx vitest run $files`): exit 0, 25 files, 1496 passed.
- (guard) `npx vitest run --project site` (73 files, 1277 passed, 5 skipped), then the dogfood freshness and tag-set-equality tests (2 files, 14 passed): exit 0.
- (guard) `__baselines__` diff and untracked check: empty, exit 0, checked after the shards.
- (guard) `npm run test:browser:packages:app && npm run test:browser:packages:rest && npm run test:browser:focus-timing`: exit 0 (842 passed; 80 passed; 441 passed, 1 skipped).
- (guard) `npm run test:browser:packages:components -- -t '^(?!.*context-labels and the wide name)'`: exit 0 (2420 passed, 4 skipped).
- (guard) `npm run test:browser:site -- -t '^(?!.*resolves by KEY on the tour)'`: exit 0 (946 passed, 2 skipped).
- (guard) `npm run test:visual -- -t '^(?!.*nav OVERLAY-OPEN)'`: exit 0 (61 passed, 1 skipped). Vitest also printed "something prevents the main process from exiting".
- Records criterion: pass.
- (guard) Scope allow-list, the literal regex from the step handoff: prints two lines, `.claude/docs/lld/a2ui-catalog.lld.md` and `.claude/docs/spec/a2ui-catalog.spec.md`, and nothing else.
  - Both files are covered by the conductor widening at `.sdlc/work/no-barrels/handoff.md:72` ("scope widened: steps 7-8: a2ui-catalog.spec.md and a2ui-catalog.lld.md").
  - Step 6 changed both. This step did not: their mtime is 16:07:15, before attempt 1 started at 16:14:47.
  - With the widening applied, the guard passes.
- Tree sanity: no file outside `.sdlc` changed between attempt 1 ending and this rerun (`find -newer builder-L3.md`: empty).

## Notes
- **Scope guard:** the widening for these two files is recorded only in the plan handoff (`.sdlc/work/no-barrels/handoff.md:72`). The `## Scope widened` sections in the step 7 and step 8 handoffs still list only `validate-payload.ts`, so a verifier running the literal regex will see those two lines. Recommend the conductor copy the widening into both step handoffs. Do not revert either file; that would undo step 6.
- **Shell:** the changed-tests criterion needs a shell that splits `$files` into words. In zsh it prints "No test files found" and exits 1, so run it under bash. In this environment zsh `grep` is a wrapper around ugrep.
- **Shard comparison:** the three-shard guard was not run before the migration. After it, all six shards are green with only the three named skips, so there is nothing to compare.
- **Scratch files:** `codemod.mjs`, `comments.mjs`, the logs (`*2.log`, `site3.log` from this attempt) and the tag snapshots are under `.sdlc/work/no-barrels/step-7/`, which the scope guard excludes.
- **Left for step 8:** barrel mentions this step's rules did not cover. Step 8 needs this list before deleting anything:
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
