<!-- role=builder level=L3 model=opus effort=high -->
## Status
done

## Changes
- packages/agent-ui/a2ui/src/agent/agent-transport.ts: `AgentProvider.stream` request gains `terminalTools?: readonly string[]` and `toolChoice?: { name: string }`, documented as additive and ignorable (the `effort?` precedent).
- packages/agent-ui/a2ui/src/agent/providers/anthropic.ts: `buildRequestBody` takes `toolChoice?` and adds `tool_choice: { type: 'tool', name }` only when the body carries `tools` and no `thinking` field (arms moved unchanged into a private `buildArmBody`); `stream()` gains the terminal-only path (one round, text yielded live, the first terminal call executed once, no continuation) and, in the mixed GH #49 loop, a terminal call ends the loop (execute, flush the buffered round text, return); the per-call parse, coerce and execute body is factored into a local `execute` shared by both paths.
- packages/agent-ui/a2ui/src/live-agent/anthropic-terminal-tool.test.ts: new, `describe('tool_choice')` (AC1, 4 tests), `describe('terminal round')` (AC2, 2 tests), `describe('mixed round')` (AC3, 2 tests); scripted SSE through a per-test `fetch` stub, no network, no key.
- Commit 0affd8ad on feat/response-type-selection ("T-0060: step 3 ..."), not pushed.

## Checks
- `python3 .../redck.py record .sdlc/0060-response-type-selection/step-3/handoff.md` before the first edit: exit 0, 4 pre-edit controls recorded red.
- (red) `npx vitest run --project packages --maxWorkers=4 packages/agent-ui/a2ui/src/live-agent/anthropic-terminal-tool.test.ts`: exit 0, 8 passed.
- (red) `out=$(npx vitest run ... anthropic-terminal-tool.test.ts -t "terminal round" 2>&1) && printf ... | grep -qE "Tests +[1-9][0-9]* passed"`: exit 0.
- (red) `node --experimental-strip-types --input-type=module -e "import { buildRequestBody as b } ..."`: exit 0.
- (red) `grep -qE 'terminalTools\?: readonly string\[\]' ... && grep -qE 'toolChoice\?: \{ name: string \}' ...`: exit 0.
- (guard) `npx vitest run --project packages --maxWorkers=4 packages/agent-ui/a2ui/src/live-agent/anthropic-`: exit 0, 8 files, 75 tests passed.
- (guard) `node --experimental-strip-types .../eval-agent-behavior.ts selftest && node --experimental-strip-types .../kit.ts selftest`: exit 0.
- (guard) scope loop over `git diff --name-only $SDLC_BASE_SHA` plus untracked (excluding .sdlc, .worktrees): exit 0, only the three named files.
- Extra: `npx tsc --noEmit -p .`: exit 0.
- Extra negative control: temporarily buffered the terminal-only round's text; `-t "terminal round"` went red (`expected [ 'chunk2', 'chunk3', ... ] to deeply equal [ 'frag:Here is ', ... ]`); source restored from a scratch copy before the commit.
- Extra: `git diff -U0 f7ff6c64 -- packages | grep -n $'^+.*\xe2\x80\x94'` over the committed diff: exit 1 (no added line carries an em dash; the only hit without the `^+` anchor is a removed line).

## Notes
- Terminal-call choices step 5's capture wrapper builds on: a terminal call runs only when the round's `stop_reason` is `tool_use`, so the input is read from `collector.calls[n].inputJson` after the round's stream has fully ended (LLD section 5); only the FIRST call naming a terminal tool runs, once; integration calls in the same round as a terminal call are not executed (no continuation would carry their results); a terminal call runs even on the last round under `MAX_TOOL_ROUNDS`; an `executeTool` rejection on a terminal call is swallowed (nowhere to send `is_error`), so produce sees no captured input.
- Ordering: terminal-only rounds yield text live, before the executor (AC2, proven with a chunked SSE body whose later chunks arrive on a timer); mixed rounds execute the terminal call first, then flush the buffered round text, matching the SPEC RTS-R2 wording.
- "Every declared tool is terminal" is `terminalTools` non-empty and `tools.every(t => terminalTools.includes(t.name))`; with `tools` but no `executeTool` the adapter keeps the pre-#49 no-tools path, as before.
- `tool_choice` also requires a non-empty `tools` array in the body (not in the handoff text), so a caller passing `toolChoice` without tools never sends a forced choice that would 400.
- With `tools` and `toolChoice` but no `executeTool`, the unchanged no-tools path calls `buildRequestBody(req)`, so it now sends `tool_choice` beside the `tools` it already sent; allowed by the SPEC (forbidden only alongside `thinking`), not a defect.
- Vitest criteria were run with `--maxWorkers=4` as the brief asks, except criterion 2, run exactly as written.
