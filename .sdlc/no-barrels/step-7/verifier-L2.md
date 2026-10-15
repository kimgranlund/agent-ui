<!-- role=verifier level=L2 model=sonnet effort=high -->
## Verdict
fail

## Criteria
- `! git grep -qE "(from |import |import\()'@agent-ui/components/components'" -- packages site scripts ':!site/.fixture-scratch'`: pass. Evidence: exit 0 on the built tree. Bites: at HEAD, `git grep -lE` of the same pattern lists 132 files.
- `! git grep -qE '@agent-ui(-kit)?/components/component-styles\.css' -- ...`: pass. Evidence: exit 0 on the built tree. At HEAD, 99 files match.
- `grep -qF "import '@agent-ui/components/all'" scripts/build-dogfood-assets.mjs`: pass. Evidence: exit 0.
- `grep -qF 'controls/button.css' scripts/verify-consumer-install.mjs && node --check ...`: pass. Evidence: exit 0. At HEAD the file has no `controls/button.css` match (git grep exit 1).
- (guard) `npm run check`: pass. Evidence: exit 0 (ran it myself); the output ends with "selftest: all green".
- Changed-tests criterion (`files=$(git diff --name-only ...); npx vitest run $files`, run under bash): pass. Evidence: exit 0, 25 files and 1496 tests passed.
- (guard) `npx vitest run --project site` plus the dogfood freshness and tag-set-equality tests: pass. Evidence: site 73 files, 1277 passed, 5 skipped; dogfood 2 files, 14 passed; exit 0.
- (guard) no `__baselines__` diff or untracked baseline files: pass. Evidence: both listings are empty, checked after the shards.
- (guard) `test:browser:packages:app`, `:rest` and `:focus-timing`: pass. Evidence: 842 passed; 80 passed; 441 passed with 1 skipped; exit 0.
- (guard) The three skip-by-name shards: pass. Evidence:
  - components: exit 0, 2420 passed, 4 skipped.
  - site: exit 0, 946 passed, 2 skipped.
  - visual: exit 0. Vitest also printed "something prevents the main process from exiting".
- Records criterion (`shared-styles.css` present in the app-composition SKILL and the components README, and no `component-styles.css` or `components/components` in the five record files): pass. Evidence: exit 0 on every part, each file existing.
- (guard) Scope allow-list: fail. Evidence: the literal command exits 1 and lists `.claude/docs/lld/a2ui-catalog.lld.md` and `.claude/docs/spec/a2ui-catalog.spec.md`.
  - `git diff --stat` against the base shows 14 and 6 line changes in them. The diffs are step 6's ADR-0233 text (`builtinControls`, no control imports in factories).
  - Both files were last modified at 16:07:15, before step 7's builder started.
  - `.sdlc/no-barrels/handoff.md:72` records the conductor widening "steps 7-8: a2ui-catalog.spec.md and a2ui-catalog.lld.md". Step 7's own `## Scope widened` section lists only `validate-payload.ts`, and the criterion regex omits the two files.
  - Steelman: the builder's rebuttal is that step 7 did not touch these files and the plan widened them. That holds for the build, so the fault is the criterion, not the work.

## Out of scope changes
None attributable to step 7. The two a2ui-catalog doc files are step 6 changes, and a conductor widening covers them (`.sdlc/no-barrels/handoff.md:72`).

## For the next attempt
plan defect: the last `(guard)` criterion (scope allow-list) omits `.claude/docs/lld/a2ui-catalog.lld.md` and `.claude/docs/spec/a2ui-catalog.spec.md`, which the user-approved step 6 widening covers. The diff is against `$SDLC_BASE_SHA`, so those files show. No build change is needed; every other criterion passed on my runs.
swap old: `{ git diff --name-only "$SDLC_BASE_SHA" -- . ':(exclude).sdlc'; git ls-files --others --exclude-standard -- . ':(exclude).sdlc'; } | grep -vxE '\.claude/docs/adr/(0233-[a-z0-9-]+|0003-single-file-component-css-barrels-host-page|0040-foundation-barrel-budget-7kb|0080-per-control-exports-marginal-size-gate)\.md|site/public/(adr-index|sitemap)\.json|site/sitemap\.json|packages/agent-ui/[a-z0-9-]+/src/.+\.ts|packages/agent-ui/components/src/controls/[a-z0-9][a-z0-9-]*/[a-z0-9-]+\.(md|css)|packages/agent-ui/components/src/(shared-styles|component-styles|all\.gen)\.css|packages/agent-ui/components/package\.json|packages/agent-ui/(components|a2ui)/(README|AGENTS)\.md|site/.+\.ts|site/lib/__fixtures__/theme-provider-built\.css|scripts/(codemod-uses|generate-controls|measure-size|side-effects\.test|build-dogfood-assets|verify-consumer-install|publish/publish-packages|publish/publish-packages\.test)\.mjs|vitest\.config\.ts|AGENTS\.md|\.claude/docs/(references/component-packaging|spec/(a2ui-runtime|persona-catalog-composition)\.spec|lld/(a2ui-renderer|genui-dogfood)\.lld)\.md|\.claude/skills/(component-build/SKILL|component-packaging/SKILL|a2ui-multi-catalog/SKILL|app-composition/SKILL|component-testing/SKILL|component-testing/references/test-craft|component-standards/references/descriptor-generation|package-release/references/release-facts)\.md|packages/agent-ui/a2ui/tools/harness/validate-payload\.ts' | { ! grep -q .; }`
swap new: `(guard) { git diff --name-only "$SDLC_BASE_SHA" -- . ':(exclude).sdlc'; git ls-files --others --exclude-standard -- . ':(exclude).sdlc'; } | grep -vxE '\.claude/docs/adr/(0233-[a-z0-9-]+|0003-single-file-component-css-barrels-host-page|0040-foundation-barrel-budget-7kb|0080-per-control-exports-marginal-size-gate)\.md|site/public/(adr-index|sitemap)\.json|site/sitemap\.json|packages/agent-ui/[a-z0-9-]+/src/.+\.ts|packages/agent-ui/components/src/controls/[a-z0-9][a-z0-9-]*/[a-z0-9-]+\.(md|css)|packages/agent-ui/components/src/(shared-styles|component-styles|all\.gen)\.css|packages/agent-ui/components/package\.json|packages/agent-ui/(components|a2ui)/(README|AGENTS)\.md|site/.+\.ts|site/lib/__fixtures__/theme-provider-built\.css|scripts/(codemod-uses|generate-controls|measure-size|side-effects\.test|build-dogfood-assets|verify-consumer-install|publish/publish-packages|publish/publish-packages\.test)\.mjs|vitest\.config\.ts|AGENTS\.md|\.claude/docs/(references/component-packaging|spec/(a2ui-catalog|a2ui-runtime|persona-catalog-composition)\.spec|lld/(a2ui-catalog|a2ui-renderer|genui-dogfood)\.lld)\.md|\.claude/skills/(component-build/SKILL|component-packaging/SKILL|a2ui-multi-catalog/SKILL|app-composition/SKILL|component-testing/SKILL|component-testing/references/test-craft|component-standards/references/descriptor-generation|package-release/references/release-facts)\.md|packages/agent-ui/a2ui/tools/harness/validate-payload\.ts' | { ! grep -q .; }`
Note: I ran the new form under bash on the built tree and it exits 0. The old form exits 1 on the same tree, so the swap goes from red to green and only adds the two named files to the allow-list.
