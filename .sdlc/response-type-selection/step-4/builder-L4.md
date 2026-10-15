<!-- role=builder level=L4 model=opus effort=xhigh -->
## Status
blocked

## Changes
None. Two throwaway probes edited `packages/agent-ui/a2ui/src/agent/produce.ts` and were restored from a scratch copy; `git status --short -- packages` is empty. The only file written is `.sdlc/response-type-selection/step-4/red-checkpoint.jsonl` (redck record, pre-edit).

## Checks
- `python3 .../redck.py record .sdlc/response-type-selection/step-4/handoff.md`: exit 0, 7 pre-edit controls recorded red.
- Base guard, no edits: `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/ packages/agent-ui/a2ui/src/agent/ --maxWorkers=4`: 55 files passed, 952 tests passed, 1 skipped.
- Probe A (tool offer only: `tools: [...(opts.tools ?? []), renderSurfaceTool([])]` plus a stub executor in `produceTurn`), over all four guard dirs (`src/live-agent/ src/agent/ src/testkit devtools/src`): 4 failed, 1663 passed, 1 skipped. All 4 failures are the produce arm of `packages/agent-ui/a2ui/src/live-agent/mcp-enablement.test.ts`: "a ref ∪ an exact id expands ... produce arm" (`expected [ 'mcp_calc_add', …(3) ] to deeply equal [ 'mcp_calc_add', …(2) ]`), "the empty/master-off projection ... produce arm" (`expected [ 'render_surface' ] to deeply equal []`), "an unknown / roster-removed service ref ... produce arm" (same), "an unprovisioned serverKey through a ref ... produce arm" (`expected [ 'mcp_calc_add', …(2) ] to deeply equal [ 'mcp_calc_add', 'mcp_calc_multiply' ]`).
- Probe B (a round whose first non-empty line after the meta-line peel does not start with `{` ships as a note-only text reply), same four dirs: 1667 passed, 1 skipped; `eval-agent-behavior.ts selftest` exit 0; `kit.ts selftest` exit 0.

## Notes
plan defect: (guard) `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/ packages/agent-ui/a2ui/src/agent/` includes `src/live-agent/mcp-enablement.test.ts`, whose `turn()` helper (lines 136-148) asserts the exact `req.tools` names on the produce arm. The settled decision "offer `render_surface` on every turn where `a2uiEnabled !== false`" (RTS-R1) adds `render_surface` to that list, and that arm posts no `a2ui` field and no override phrase (`INTENT = 'compute something'`). Its 4 produce-arm `it.each(ARMS)` cases go red (Probe A), and the scope criterion forbids editing the file.

Any one of these repairs, each a one-file change to `mcp-enablement.test.ts` added to this step's scope list:
1. `turn()` filters `render_surface` out of the names it returns (`.filter((n) => n !== 'render_surface')`). This keeps the test about integration enablement.
2. The produce-arm body in `turn()` sends `a2ui: false`, so the request carries no `render_surface`.
3. Leave the test unedited and exclude it from this step's guard. Weakest option, because the produce arm would then run with no gate.

Evidence that nothing else blocks the step: Probe A shows the tool offer reds only this file across `src/live-agent`, `src/agent`, `src/testkit` and `devtools/src`. Probe B shows no existing produce, kit or eval test relies on a prose or fenced round halting with PARSE. Treating such a round as a text reply keeps all 1667 tests and both selftests green. `turn-deadline.test.ts:284-294` passes an `executeTool` and only calls through it, so a delegating capture wrapper leaves it green.

For the next builder (from the base read; not built): put the `textDelta` hold-and-yield in both stream branches (`interleaveProgress` and the plain `for await`), so it does not depend on `opts.progress`. Add `terminalTools`/`toolChoice` only inside the offer branch, by conditional spread. Use the tool-aware repair sentence only on a capture round; legacy rounds keep today's wording, because produce-loop matches `/INVALID/`, `/SINGLE line/` and `/NDJSON payload lines/`. Raise `SURFACE_DEGRADED` only when the failing payload came from the capture. Make the model a per-round variable so `onRepairRound` and `traceFor` agree. Reset the capture every round. The describe titles must contain the exact `-t` strings.
