## Task goal
Add the missing provider tests and repair the docs that PRs #1805 (first-byte deadline and stall guard) and #1806 (bounded transport retry), both now merged on main, left stale. Ticket brief: `.sdlc/retry-tests-and-docs/handoff.md` (read it fully). Tracks GH #1815 items 1 and 2.

## Step 1: Add four tests with negative controls and repair the provider docs
level: L3
guard timeout: 180

### Read first
- `packages/agent-ui/a2ui/AGENTS.md`

### Do
1. In `packages/agent-ui/a2ui/src/live-agent/anthropic-retry.test.ts` (merged by #1806; keep its existing eight cases untouched) add four cases, using the file's existing stubs and fake timers. `FirstByteTimeoutError` is not exported: observe it through the provider with a `fetch` that never answers. Titles, byte for byte:
   - `first-byte timeout is not retried`: exactly one `fetch` call, the message `anthropicProvider: no response within 60000 ms`, no backoff sleep.
   - `caller abort is rethrown unwrapped`: the abort error object is the same one the caller's signal carries, no wait.
   - `doFetch AbortError is rethrown as the same object`: when the per-attempt fetch itself throws an AbortError, the identical object comes out, one call.
   - `Retry-After above the cap sleeps the capped delay`: a 503 with `Retry-After: 3600` sleeps exactly 10000 ms (`ANTHROPIC_RETRY_AFTER_CAP_MS`), then succeeds.
2. Negative controls: for each new test, find the one-line mutation of `anthropic.ts` that makes it fail, run it in a throwaway worktree created with the literal form `git worktree add --detach "$SDLC_TMP_WORKTREES/base" HEAD` (then provision `node_modules` with `node scripts/bootstrap-scratch-clone.mjs "$SDLC_TMP_WORKTREES/base"`), and record in your Notes, per test, the exact mutation and the failing result. Never leave the mutation in the tree.
3. Docs, in the same change (read each before editing; ADR edits are append-only and `proposed`, never rewriting accepted text):
   - `.claude/docs/lld/a2ui-live-agent.lld.md`: the row at about line 166 (`providers/anthropic.ts` fetch arm, "no standing test, MANUAL live acceptance") now has standing tests (`anthropic-timeouts.test.ts`, `anthropic-retry.test.ts`): repair it; the impure `stream` sketch at about lines 397 to 403 gets one line each for the first-byte deadline, the stall guard and `fetchWithRetry` (retry only before the body is consumed, never after streaming starts, never for a first-byte timeout or a caller abort). Keep the live-key leg described as manual.
   - `.claude/docs/spec/a2ui-live-agent.spec.md`: it has no provider retry or deadline wording; add a short non-functional note only if one of its existing NFR sections is the natural home, otherwise report in Notes that none fits.
   - `.claude/docs/adr/0073-a2ui-live-model-provider-seam.md`: append a short note pointing at the bounded retry and deadlines (names: `fetchWithRetry`, `ANTHROPIC_MAX_RETRIES`, `ANTHROPIC_FIRST_BYTE_TIMEOUT_MS`, `ANTHROPIC_STALL_TIMEOUT_MS`); append-only.
   - `.claude/docs/adr/0146-live-turn-lifecycle-progress-channel.md`: check whether the `retry` progress stage wording must distinguish self-correct retry from transport retry; edit (append-only note) only if it does, else say so in Notes.
   - `.claude/docs/plan.md` and `.claude/docs/roadmap.md`: grep for #1797 gap tracking; update only if present.
4. No em dashes in lines you add.

### Acceptance criteria
- `test -f packages/agent-ui/a2ui/src/live-agent/anthropic-retry.test.ts && grep -qF 'first-byte timeout is not retried' packages/agent-ui/a2ui/src/live-agent/anthropic-retry.test.ts && grep -qF 'caller abort is rethrown unwrapped' packages/agent-ui/a2ui/src/live-agent/anthropic-retry.test.ts && grep -qF 'doFetch AbortError is rethrown as the same object' packages/agent-ui/a2ui/src/live-agent/anthropic-retry.test.ts && grep -qF 'Retry-After above the cap sleeps the capped delay' packages/agent-ui/a2ui/src/live-agent/anthropic-retry.test.ts`
- (guard) `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/anthropic-retry.test.ts packages/agent-ui/a2ui/src/live-agent/anthropic-timeouts.test.ts packages/agent-ui/a2ui/src/live-agent/anthropic-sse.test.ts packages/agent-ui/a2ui/src/live-agent/anthropic-tool-loop.test.ts`
- `test -f .claude/docs/lld/a2ui-live-agent.lld.md && grep -qF 'anthropic-retry.test.ts' .claude/docs/lld/a2ui-live-agent.lld.md && grep -qF 'fetchWithRetry' .claude/docs/lld/a2ui-live-agent.lld.md`
- `test -f .claude/docs/adr/0073-a2ui-live-model-provider-seam.md && grep -qF 'fetchWithRetry' .claude/docs/adr/0073-a2ui-live-model-provider-seam.md`
- (guard) `test -z "$(git diff -U0 HEAD -- .claude/docs/adr | grep -E '^-' | grep -v '^---')"`
- (guard) `test -z "$(git diff --name-only HEAD -- . ':(exclude).sdlc' | grep -vxF -e packages/agent-ui/a2ui/src/live-agent/anthropic-retry.test.ts -e .claude/docs/lld/a2ui-live-agent.lld.md -e .claude/docs/spec/a2ui-live-agent.spec.md -e .claude/docs/adr/0073-a2ui-live-model-provider-seam.md -e .claude/docs/adr/0146-live-turn-lifecycle-progress-channel.md -e .claude/docs/plan.md -e .claude/docs/roadmap.md)"`
- `grep -c 'Negative control' .sdlc/retry-tests-and-docs/step-1/builder-L3.md` (the verifier reads the builder Notes: four named mutations, each with its failing result)
- (guard) `! git diff -U0 HEAD -- . ':(exclude).sdlc' | grep -E '^[+]' | grep -v '^[+][+][+]' | grep -q $'\xe2\x80\x94'`
- (guard) `DL=$(ls -d ~/.claude/plugins/cache/nonoun-plugins/docs/*/scripts/doc_lint.py | sort -V | tail -1); python3 "$DL" .claude/docs/lld/a2ui-live-agent.lld.md >/dev/null`
- (guard) `npm run check`
