<!-- role=builder level=L4 model=opus effort=xhigh -->
## Status
done

## Changes
- `packages/agent-ui/components/src/controls/control-record.ts`: new hand-written `ControlRecord` interface (`tag`, `load()`, `css?`, `uses?`).
- `packages/agent-ui/components/src/descriptor/generate-controls.ts`: new pure generator with no `node:*` import. It holds `generateControls` (the settled signature) plus helpers that the CLI and the gate both use: `GENERATED_FILES`, `isGeneratorOwnedKey`, `mergeExports`, `withGeneratedExports`, `controlsGenEntries` (reads `uses` with the descriptor parser) and `staleControlsArtifacts`. Text that looks like an import is quoted separately from its keyword, so `layering.test.ts` does not flag it (the trap step 3 hit).
- `scripts/generate-controls.mjs`: new CLI with a `--check` mode. Run once: it wrote the three files and rewrote `package.json`. A second run rewrote 0.
- `packages/agent-ui/components/src/controls/registry.gen.ts`, `src/all.gen.ts`, `src/all.gen.css`: generated, 82 records or imports each. `all.gen.css` imports `shared-styles.css` first.
- `packages/agent-ui/components/package.json`: `sideEffects` set to the ruled array (by hand, after `type`). The exports map, via the generator, gained 82 `./controls/{name}.css` keys plus `./registry`, `./all` and `./all.css`. Every other key and field is unchanged, and the keys are in plain sorted order.
- `packages/agent-ui/components/src/component-styles.css`: now a header plus `@import './all.gen.css';`.
- `packages/agent-ui/components/src/descriptor/generate-controls.test.ts`: new unit tests on fixtures (17 tests).
- `packages/agent-ui/components/src/controls/controls-gen-driftwire.test.ts`: new drift gate. It does the byte-for-byte compare of the three files and the generator-owned keys, and imports `CONTROLS` through `@agent-ui/components/registry` (one record per descriptor; `load()` defines `ui-badge`). Each of its three negative controls plants one defect on an in-memory in-sync tree.
- `packages/agent-ui/components/src/controls/all-purity.test.ts`: new gate with two legs. The crawl leg covers static, bare and dynamic imports from `src/index.ts`, the registry and every `./controls/*` JS target. The import-scan leg covers `.ts` and `.css` under every `packages/*/src`, with comments stripped. Both legs have negative controls on in-memory sources.
- `packages/agent-ui/components/src/controls/barrels.test.ts`: `parseControlsExportsMap` now skips `.css` keys, so T4 stays three-way over JS keys. The content tests now check that `component-styles.css` is exactly `['./all.gen.css']`, that `all.gen.css` is in sorted order, and that `all.gen.css` imports `shared-styles.css` first.
- `packages/agent-ui/components/src/controls/family-coherence.test.ts`: C2 `CSS_BARREL` now reads `all.gen.css`, and the labels say so.
- `scripts/measure-size.mjs`: `CONTROL_ENTRIES` skips `.css` keys and exits 1 if it finds fewer than 60 JS entries.
- `vitest.config.ts`: the hand-listed `@agent-ui/components/*` aliases are replaced by entries built when the config loads, one per exports key except `.`. They sit after the kept `?url` pair and before the broad alias.
- `scripts/publish/publish-packages.mjs`: `transformPackageJson` is now exported and carries `sideEffects` through (`./src/` becomes `./dist/`, `.ts` becomes `.js`, `false` is kept).
- `scripts/publish/publish-packages.test.mjs`: three new `sideEffects` cases.
- `scripts/side-effects.test.mjs`: new, legs (a), (b) and (c), with the temp-dir fixture package.
- `packages/agent-ui/components/src/controls/sandbox-frame/dogfood/dogfood-assets.ts`: regenerated with `npm run regen:dogfood-assets`.
- `site/lib/__fixtures__/theme-provider-built.css`: regenerated with `npm run regen:theme-provider-fixture`.
- Records:
  - `AGENTS.md`: the "Never hand-edit" list now names the generated files and keys.
  - `packages/agent-ui/components/AGENTS.md`: Controls section has a generator bullet and a `sideEffects` bullet.
  - `.claude/docs/references/component-packaging.md`: new exports rows, a "Generator-owned exports" section (including that `all` is demo-only), a `sideEffects` section, and updated "add a control" and CSS-order text.
  - `.claude/skills/component-build/SKILL.md`: step 8 (Integrate) runs `node scripts/generate-controls.mjs`; the barrel line stays until step 8.
  - `.claude/skills/component-packaging/SKILL.md:35`: the aliases are now built from the exports map.
  - `.claude/skills/package-release/references/release-facts.md`: the publish transform carries `sideEffects`.

## Checks
- Before the change (tree as step 3 left it):
  - Components shard with the named skip: exit 0, 2416 passed, 4 skipped.
  - Site shard: exit 0, 946 passed, 2 skipped.
  - Visual shard: exit 0, 61 passed, 1 skipped.
- After switching to sorted order, before the regens:
  - Components shard: exit 0, 2416 passed.
  - Site shard: exit 0, 946 passed.
  - Visual shard: exit 0, 61 passed, 1 skipped.
  - No visual diff.
- Jsdom guard before the regens: exit 1. The only two reds were the expected freshness gates (`dogfood-assets-freshness`, `theme-provider-build-fixture`).
- `npm run regen:dogfood-assets`: exit 0 (95 B smaller). `npm run regen:theme-provider-fixture`: exit 0 (rewritten, same byte count).
- Acceptance criteria, final runs:
  - AC1 (`generate-controls.mjs --check` and the `component-styles.css` single-import check): exit 0.
  - AC2 (three new test files): exit 0, 35 passed.
  - AC3 (exports, `.css` pairs, fixed keys, `sideEffects`): exit 0.
  - AC4 (`grep sideEffects`, then `side-effects.test.mjs` and `publish-packages.test.mjs`): exit 0, 21 passed.
  - Records grep for `generate-controls.mjs` in the four files: exit 0.
- Guards, final runs:
  - Jsdom guard (`npx vitest run packages/agent-ui/components/src/controls packages/agent-ui/app/src site/lib`): exit 0, 7777 passed, 5 skipped.
  - `__baselines__` guard: exit 0.
  - Size guard: exit 0. The tree-shake probe is clean, and the only `size:` line is the inherited `@agent-ui/app exceeds its marginal budget` (marginal 106854 B gz). The family row is 71967 B gz, within its 72192 budget.
  - App, rest and focus-timing shards: exit 0 each (842 passed; 78 passed; 441 passed, 1 skipped).
  - Three named-skip shards after the regens: components exit 0 (2416 passed), site exit 0 (946 passed), visual exit 0 (61 passed, 1 skipped).
  - `npm run check`: exit 0.
  - Scope allow-list: exit 0 over 143 paths.
- Extra checks:
  - `npx vitest run packages/agent-ui/components/src/layering.test.ts packages/agent-ui/components/src/descriptor`: exit 0, 526 passed.
- Bite checks (each file restored afterwards, and `--check` back to exit 0):
  - Dropping `./src/controls/**` from `sideEffects`: legs (a), (b) and (c) of `side-effects.test.mjs` all went red.
  - Appending a line to `registry.gen.ts`: the two real drift tests went red, the isolated negative controls stayed green, and `--check` exited 1 naming the file.
  - Rolldown probe of `import '@agent-ui/components/controls/button'`: 13656 B with `.define(`, and 0 B with `moduleSideEffects: false`.

## Notes
- **Rolldown honours the field here.** Leg (c) also went red when `./src/controls/**` was removed from `sideEffects`, not only the honesty test. That is direct evidence for the architect's `sideEffects` risk.
- **The glob matcher is an assumption, not a measurement.** The honesty scan uses a hand-rolled matcher with webpack's `**` semantics, where `**/` may match zero folders. That is what makes `./src/**/*.css` cover the root-level sheets. Leg (c) only exercises `./src/controls/**`, so no bundler run here confirms the zero-folder case for CSS.
- **`site/pages/getting-started.ts` is now stale (for step 7).** It builds its subpath list from every `./controls/*` key, so it now also shows the 82 `.css` keys with a "registers ui-{name}.css" comment. The file is outside this step's allow-list; step 7's handoff names it.
- **Negative controls are isolated.** In `controls-gen-driftwire.test.ts`, each negative control plants one defect on an in-memory in-sync tree, so it reports only its own defect even when the real tree is stale.
- **Logs:** every shard, guard and regen run is logged under `.sdlc/work/no-barrels/step-4/logs/`. No throwaway worktree was created. No commits.
