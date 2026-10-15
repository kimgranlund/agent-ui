<!-- role=filer level=L1 model=sonnet effort=medium -->
## Warnings
None

## PR title
Bound the Anthropic provider's network wait with a first-byte deadline and a stall guard (GH #1797 gap c)

## PR body
### Summary
A silent connection no longer hangs an Anthropic turn. A first-byte deadline and a per-read stall guard make it fail with a named error. Tracks GH #1797, gap (c). Gaps (a) and (b) are separate branches. This change does not touch `dev-proxy-plugin.ts` or `tool-dispatch.ts`.

### Changes
- `packages/agent-ui/a2ui/src/agent/providers/anthropic.ts`
  - Two new exports: `ANTHROPIC_FIRST_BYTE_TIMEOUT_MS = 60_000` and `ANTHROPIC_STALL_TIMEOUT_MS = 60_000`.
  - First-byte deadline: a local `AbortController` plus a `setTimeout`, merged with the caller's `signal` through `AbortSignal.any` for the `fetch` only. The timer is cleared in a `finally`. If the deadline fires and the caller has not aborted, the turn throws `anthropicProvider: no response within 60000 ms`. A caller abort rethrows the original error, so it is not relabelled.
  - Stall guard: `readOrStall` races each `reader.read()` against a fresh timer, cleared on every settle. Silence beyond the limit throws `anthropicProvider: stream stalled for 60000 ms`. The throw lands inside the existing `try`, so the existing `finally` cancels the reader.
  - Each read's frames are still parsed and yielded in the same loop pass, so ADR-0146 live progress is unchanged.
  - The `anthropicProvider(opts)` signature, request body, headers, the TKT-0075 upstream-error path, SSE error frames and the GH #49 tool loop are unchanged.
- `packages/agent-ui/a2ui/src/live-agent/anthropic-timeouts.test.ts` (new): 6 tests, a defaults check plus five behaviour cases.
- No existing test was edited.

Departure from the handoff wording: the deadline is a cleared timer plus `AbortController`, not `AbortSignal.timeout`. The fetch signal also governs the response body, so a whole-request timeout signal would abort a healthy long stream at 60 s.

### Verification
- The new test file exits 0 with 6 passed:
  - the defaults check;
  - case 1: a fetch that never resolves rejects at 60000 ms with the named message;
  - case 2: a body that goes silent after one frame rejects with the stall message and the source `cancel` is called once;
  - case 3: a healthy stream with 30 s gaps yields every fragment (negative control);
  - case 4: a caller abort is not relabelled as a timeout;
  - case 5: no timers remain after a healthy completion.
- Red-then-green: in a throwaway worktree at the base SHA, the new file gave 3 failed and 3 passed. The defaults check and cases 1 and 2 were red; cases 3 to 5 are controls and pass at base by design.
- Mutant: the builder replaced the stall race with a bare `reader.read()`, and case 2 failed (5 s timeout) while the other 5 passed. The code was restored afterwards. The verifier did not re-run this.
- `npm run check`: exit 0.
- `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent`: exit 0 (41 files passed and 1 skipped; 706 tests passed and 1 skipped).
- `npx vitest run --project tools packages/agent-ui/a2ui/tools`: exit 0 (24 files, 364 tests).
- Guards, all exit 0: the four existing anthropic and provider test files are unchanged, no em dash on added `anthropic.ts` lines, and only the two allowed files changed outside `.sdlc/`.
- Verifier verdict: pass.

Needs Kim: confirm 60000 / 60000.

## Changelog entry
Anthropic provider: a turn now fails with `anthropicProvider: no response within 60000 ms` when the first response does not arrive, or with `anthropicProvider: stream stalled for 60000 ms` when the stream goes silent mid-turn, instead of hanging. The limits are exported as `ANTHROPIC_FIRST_BYTE_TIMEOUT_MS` and `ANTHROPIC_STALL_TIMEOUT_MS`.

## Follow-ups
- decide: Confirm the two defaults, 60000 ms first-byte and 60000 ms stall, are right for slow high-effort reasoning turns (builder flagged `Needs Kim: confirm 60000 / 60000`).
- note: This change adds no overall wall-clock cap, as the handoff scoped; the limits are the first-byte wait and the gap between reads only.
