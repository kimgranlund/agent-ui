<!-- role=builder level=L4 model=opus effort=xhigh -->
## Status
blocked

## Changes
- `packages/agent-ui/components/src/controls/loader.ts` (new): `ControlLoader`, `ControlLoaderOptions`, `ControlLoadError`, `createControlLoader`, `ensureControls`. Nothing at module top level touches the DOM.
- `packages/agent-ui/components/src/controls/loader.test.ts` (new): jsdom tests over `x-ctl-probe-*` records, 6 tests.
- `packages/agent-ui/components/src/controls/loader.browser.test.ts` (new): real-engine tests. The first assertion is `customElements.get('ui-table')` undefined; then table.css links once, and a 404 sheet warns and resolves.
- `packages/agent-ui/components/package.json`: hand-owned `"./loader": "./src/controls/loader.ts"`, in sorted position.
- `packages/agent-ui/a2ui/src/protocol.ts`: `ErrorCode` gains `'CONTROL_LOAD'`; header and `toWireError` comments updated.
- `packages/agent-ui/a2ui/src/protocol.test.ts`: new `CONTROL_LOAD` case; the "10 codes" count becomes 11 at the header, `:33` and `:141`.
- `packages/agent-ui/a2ui/src/corpus/record.ts`: `ERROR_CODE_MEMBERS` gains `CONTROL_LOAD` (tsc requires it).
- `packages/agent-ui/a2ui/src/corpus/admit.ts`: comment noting that `CONTROL_LOAD` keeps the `default` arm.
- `packages/agent-ui/a2ui/src/catalog/types.ts`: `CatalogEntry.controls?: ControlLoader` (type-only import); `CatalogRegistry.register` gains the 4th parameter.
- `packages/agent-ui/a2ui/src/catalog/registry.ts`: `register(..., controls?)` stores it only when provided.
- `packages/agent-ui/a2ui/src/catalog/compose.ts`: `PersonaCatalogPackage.controls?`, `composeControlLoaders`, and the derived registration passes the composed loader.
- `packages/agent-ui/a2ui/src/renderer/renderer.ts`: `register` 4th parameter on `RendererHost` and `Renderer`, plus deferred apply: per-surface queue, drain, `#ensureControls`, `#finalizeOrQueue`, queue dropped in `#teardownSurfaceDom` and `dispose`.
- `packages/agent-ui/a2ui/src/renderer/widget.ts`: `create` returns a placeholder for a still-missing control in a loader catalog; `wireProps` skips that placeholder; new exported `isPlaceholder`.
- `packages/agent-ui/a2ui/src/renderer/control-loading.test.ts` (new): 9 tests, fixture catalog with gated fake loaders.
- `packages/agent-ui/a2ui/src/catalog/persona-controls.test.ts` (new): 3 tests.
- `.claude/docs/spec/a2ui-runtime.spec.md`: v0.2, SPEC-R9 AC3, `CONTROL_LOAD` in the §5.2 `ErrorCode` listing.
- `.claude/docs/lld/a2ui-renderer.lld.md`: v0.2, §6 `ControlLoader` seam, §9 `CONTROL_LOAD` row.
- `.claude/docs/spec/persona-catalog-composition.spec.md`: v0.3, SPEC-R1 `controls` / `ControlRecord`, SPEC-R2 AC7.
- `.claude/skills/a2ui-multi-catalog/SKILL.md`: registering a catalog with a loader (pattern 1); persona `controls` records (pattern 5).

## Checks
- `npx vitest run packages/agent-ui/components/src/controls/loader.test.ts`: rc 0, 6 passed.
- `npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/components/src/controls/loader.browser.test.ts`: rc 0, 2 files (chromium, webkit), 4 passed. Run twice, the second after the last `loader.ts` edit.
- AC3 (exports key, compose.ts grep, bare-Node import of `loader.ts` and `compose.ts`): rc 0.
- AC4 (`'CONTROL_LOAD'` in protocol.ts, `controls?: ControlLoader` in types.ts): rc 0.
- AC5 (`control-loading.test.ts` and `persona-controls.test.ts` exist and pass): rc 0, 12 passed.
- AC6 (`ui-table` grep, `x-ctl-probe-` present, no quoted `ui-` literal): rc 0.
- Docs criterion (three greps): rc 0.
- (guard) jsdom `npx vitest run packages/agent-ui/a2ui/src packages/agent-ui/app/src packages/agent-ui/devtools/src site/lib/docs-grammar.test.ts`: rc 0, 187 files passed and 1 skipped; 4264 tests passed and 1 skipped.
- (guard) `npm run test:browser:packages:rest`: rc 0, 78 passed. `npm run test:browser:packages:app`: rc 0, 842 passed.
- (guard) size: rc 0. The probe line reads clean, and the only `size:` line is the inherited app one. Family row 71967 B gz, within its 72192 budget.
- (guard) `npm run check`: **rc 2**. `tsc` passed and `check:site` passed; `check:tools` failed with exactly one error: `packages/agent-ui/a2ui/tools/harness/validate-payload.ts(76,7): error TS2741: Property 'CONTROL_LOAD' is missing in type ... but required in type 'Record<ErrorCode, string>'`. `npm run check:scripts`, run on its own: rc 0.
- (guard) scope allow-list: rc 0.
- Extra: `node scripts/generate-controls.mjs --check` rc 0 after the `package.json` edit; `npx tsc -p tsconfig.json --noEmit` rc 0.
- Bite checks (`.sdlc/work/no-barrels/step-5/logs/bite.sh`, files restored, md5 unchanged afterwards): each mutation turned `control-loading.test.ts` red (rc 1, one failing test each):
  - `updateDataModel` never queued.
  - `finalize` never queued.
  - No failed-load placeholder in `create`.
  - Queue not dropped on teardown. This one only bit after the delete test was changed to re-create the surface while the old load was still pending.

## Notes
plan defect: (guard) `npm run check` contradicts the scope allow-list, given the Do's "`ErrorCode` gains `'CONTROL_LOAD'`". `packages/agent-ui/a2ui/tools/harness/validate-payload.ts:76` is an exhaustive `Record<Failure['code'], string>` (`FAILURE_DESCRIPTIONS`), and that path is outside the allow-list regex. No in-scope edit satisfies all three.

All work done so far is left in the tree, uncommitted, and every other criterion and guard is green. The red is caused by this step's own new code, so no base-worktree comparison applies. I did not narrow `Failure.code` to `Exclude<ErrorCode, 'CONTROL_LOAD'>`, because that would change an exported protocol type the handoff never named. It would also break the `FUNCTION` precedent: that table lists render-time codes with a "never emitted by the static validator" description.

Mechanical fix for the replan:
- Add `packages/agent-ui/a2ui/tools/harness/validate-payload\.ts` to the allow-list.
- Add a Do bullet for one entry: `CONTROL_LOAD: 'a catalog control loader failed at render time (never emitted by the static validator)',`.

For the verifier and the next attempt:
- **Unknown tags.** `ensure` checks for unknown tags only among the missing ones, so a tag that is already defined but has no record resolves. `ensure` also rejects with `ControlLoadError` when `load()` rejects (the cause is attached and its message included) or when the module does not define its tag.
- **Sheet dedupe.** Links are deduped by resolved href in one module-level map shared by every loader instance.
- **Browser test is not vacuous.** It asserts `link.sheet.cssRules.length > 0` and no warning. That proves Vite dev serves the dynamically linked package sheet as CSS (architect assumption C36), on both engines.
- **When `CONTROL_LOAD` fires.** Once per failed `ensure`, and also when an `ensure` resolves but leaves a requested tag undefined (that guards against a drain loop). A later message that still needs the tag retries and can emit again.
- **Queued `finalize` matters.** Finalizing early would emit a false `root-missing` IDGRAPH.
- **Placeholders.** They stay inert: `wireProps` and the host's action and check wiring skip them, but only when the entry has `controls`, so the no-loader path is unchanged.
- **Persona records with no base loader.** `composeControlLoaders` routes the other tags to an empty `'host'` loader, so a missing non-persona tag rejects as unknown.
- **Staleness I left alone (out of scope):** the `protocol.ts:49` comment still says "9-code"; the runtime SPEC §5.2 `ErrorCode` listing lacks `CONTAINMENT`.
- **Unrelated Node failure.** Importing `a2ui/tools/agent/chat-validation.ts` in bare Node fails with `ERR_IMPORT_ATTRIBUTE_MISSING` on a persona `catalog.json`. It is not a DOM problem and not caused by this step.
- Logs and the patch and bite scripts are under `.sdlc/work/no-barrels/step-5/logs/`. No throwaway worktree was created. No commits.
