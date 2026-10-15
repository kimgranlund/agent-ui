<!-- role=builder level=L4 model=opus effort=xhigh -->
## Status
done

## Changes
- `packages/agent-ui/a2ui/tools/harness/validate-payload.ts`: `FAILURE_DESCRIPTIONS` gains `CONTROL_LOAD: 'a catalog control loader failed at render time (never emitted by the static validator)'`. This is the only change in this attempt; it fixes the builder-L4 plan defect under the widened scope.
- Carried from builder-L4, unchanged and now part of this deliverable:
  - `packages/agent-ui/components/src/controls/loader.ts` (new)
  - `packages/agent-ui/components/src/controls/loader.test.ts` (new)
  - `packages/agent-ui/components/src/controls/loader.browser.test.ts` (new)
  - `packages/agent-ui/components/package.json`: `"./loader"` export
  - `packages/agent-ui/a2ui/src/protocol.ts`
  - `packages/agent-ui/a2ui/src/protocol.test.ts`
  - `packages/agent-ui/a2ui/src/corpus/record.ts`
  - `packages/agent-ui/a2ui/src/corpus/admit.ts`
  - `packages/agent-ui/a2ui/src/catalog/types.ts`
  - `packages/agent-ui/a2ui/src/catalog/registry.ts`
  - `packages/agent-ui/a2ui/src/catalog/compose.ts`
  - `packages/agent-ui/a2ui/src/renderer/renderer.ts`
  - `packages/agent-ui/a2ui/src/renderer/widget.ts`
  - `packages/agent-ui/a2ui/src/renderer/control-loading.test.ts` (new)
  - `packages/agent-ui/a2ui/src/catalog/persona-controls.test.ts` (new)
  - `.claude/docs/spec/a2ui-runtime.spec.md`
  - `.claude/docs/lld/a2ui-renderer.lld.md`
  - `.claude/docs/spec/persona-catalog-composition.spec.md`
  - `.claude/skills/a2ui-multi-catalog/SKILL.md`

## Checks
All run in this attempt; logs are in `.sdlc/work/no-barrels/step-5/logs/*-2.log` and `jsdom-guard-3.log`.
- Pre-check sweep for other exhaustive `ErrorCode` / `Failure['code']` tables in `packages`, `site` and `scripts`: only `validate-payload.ts:76` and `corpus/record.ts:93`, and record.ts already had the entry.
- (guard) `npm run check`: rc 0.
- AC1 `npx vitest run packages/agent-ui/components/src/controls/loader.test.ts`: rc 0, 6 passed.
- AC2 `npx vitest run --config vitest.browser.config.ts --project packages .../loader.browser.test.ts`: rc 0, 2 files (chromium and webkit), 4 passed.
- AC3 (exports key, grep in compose.ts, bare-Node import of `loader.ts` and `compose.ts`): rc 0.
- AC4 (`'CONTROL_LOAD'` and `controls?: ControlLoader` greps): rc 0.
- AC5 (both test files exist; `control-loading.test.ts` and `persona-controls.test.ts` run): rc 0, 12 passed.
- AC6 (`ui-table` grep, `x-ctl-probe-` present, no quoted `ui-` literal): rc 0.
- Docs criterion (three greps): rc 0.
- (guard) jsdom `npx vitest run packages/agent-ui/a2ui/src packages/agent-ui/app/src packages/agent-ui/devtools/src site/lib/docs-grammar.test.ts`:
  - First try: exit 144, killed at startup with an empty log (load average 26).
  - Retry: rc 0, 187 files passed and 1 skipped; 4264 tests passed and 1 skipped.
- (guard) `npm run test:browser:packages:rest`: rc 0, 78 passed. `npm run test:browser:packages:app`: rc 0, 842 passed.
- (guard) size: rc 0. The probe line reads clean, and the only `size:` line is the inherited `@agent-ui/app exceeds its marginal budget`.
- (guard) scope allow-list, with `validate-payload\.ts` in the regex: rc 0.
- Extra: `npx vitest run packages/agent-ui/a2ui/tools/harness/validate-payload.test.ts`: rc 0, 9 passed.

## Notes
- Only change since builder-L4: one `FAILURE_DESCRIPTIONS` entry. It follows the `FUNCTION` precedent, a render-time code described as never emitted by the static validator. `npm run check`, red in builder-L4, is now green.
- `CONTROL_LOAD` fires once per failed `ensure`. It also fires when an `ensure` resolves but leaves a requested tag undefined. A later message that still needs the tag retries and can emit again.
- Placeholders for failed loads stay inert: no props, actions or checks. That applies only when the catalog entry has `controls`; the no-loader path is unchanged.
- `deleteSurface`, and a re-`createSurface` of the same id, drop the queue through `#teardownSurfaceDom` (`renderer.ts:363`, `:455`). `dispose()` clears every queue, and a late settle is a no-op.
- A queued `finalize` waits behind pending messages. Finalizing early would emit a false `root-missing` IDGRAPH.
- Sheet links are deduped by resolved href in one map shared by all loader instances.
- `ensure` checks for unknown tags only among missing ones, so a defined tag with no record resolves.
- `composeControlLoaders` with persona records but no base loader routes other tags to an empty `'host'` loader, so a missing non-persona tag rejects as unknown.
- Stale before this step and left alone (out of scope): the `protocol.ts:49` comment still says "9-code", and the runtime SPEC §5.2 `ErrorCode` listing lacks `CONTAINMENT`.
- Bite checks from builder-L4 (`logs/bite*.log`) were not re-run. No commits, no throwaway worktree.
