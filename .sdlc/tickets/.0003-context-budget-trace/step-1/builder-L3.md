<!-- role=builder level=L3 model=opus effort=high -->
## Status
done

## Changes
- `packages/agent-ui/a2ui/src/live-agent/a2ui-surface-toggle.test.ts`: adds the local `withoutTracePrompt` helper. The `a2uiEnabled` stream-equality assertion now compares `withoutTracePrompt(await runWith(true))` to `withoutTracePrompt(await runWith(false))`.
- `packages/agent-ui/a2ui/src/live-agent/genui-exclusive.test.ts`: adds the same helper. The `exclusive` stream-equality assertion now compares `withoutTracePrompt(await runWith(false))` to `withoutTracePrompt(await runWith(true))`.
- `packages/agent-ui/a2ui/src/live-agent/produce-loop.test.ts`: adds the same helper. The GATE-BLIND test now compares `withoutTracePrompt(off)` and `withoutTracePrompt(absent)` each to `withoutTracePrompt(on)`, and its title is renamed to "...yields a stream identical to the gate-ON run apart from trace.prompt (SPEC-R30 AC3)". The `personaPatch` assertion stays.
- Kept from the superseded attempt and checked against items 1 to 6, 8 and 9 (not rewritten):
  - `src/agent/meta-line.ts`
  - `src/agent/agent-transport.ts`
  - `src/agent/system-prompt.ts`
  - `src/agent/prompt-budget.ts` (new)
  - `src/agent/index.ts`
  - `src/agent/produce.ts`
  - `src/live-agent/meta-line.test.ts`
  - `src/live-agent/prompt-budget.test.ts` (new)
  - `src/live-agent/produce-budget-usage.test.ts` (new)
  - the `:903` pin in `produce-loop.test.ts`

## Checks
- Criterion 1, meta-line type greps: exit 0.
- Criterion 2 (guard), zero `^import` in `meta-line.ts`: exit 0.
- Criterion 3, the agent-transport `usage` greps: exit 0.
- Criterion 4, the barrel line in `index.ts`: exit 0.
- Criterion 5, `prompt-budget.ts` has only `import type`: exit 0.
- Criterion 6, `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/prompt-budget.test.ts`: exit 0, 39 passed.
- Criterion 7, `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/produce-budget-usage.test.ts`: exit 0, 8 passed.
- Criterion 8, the `function withoutTracePrompt(` and error-text greps over the three files: exit 0.
- Criterion 9, `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent packages/agent-ui/a2ui/src/agent`: exit 0. 44 files passed and 1 skipped; 807 tests passed and 1 skipped.
- Criterion 10 (guard), baseline.json unchanged vs `$SDLC_BASE_SHA`: exit 0.
- Criterion 11 (guard), `prompt-budget.ts` not named in `gates.test.ts`: exit 0.
- Criterion 12 (guard), changed-file allowlist: exit 0.
- `npx tsc --noEmit -p .`: exit 0.
- Em dash count per edited test file is unchanged from before this attempt's edits: a2ui-surface-toggle 20, genui-exclusive 18, produce-loop 152. The two new test files have 0.

## Notes
- The helper throws when no line carries `trace.prompt`. All three comparisons pass, so each compared stream had at least one stripped trace and none of them passes vacuously.
- Ceilings are as the superseded attempt measured them: BASE and DERIVED are both 140,000 (worst cases 126,563 and 127,103 chars, 2026-10-05).
- I did not run the full `npm test` or `npm run check`; the handoff assigns that gate to step 4.
