## Task goal
Rebase the transport-retry change (GH #1797 gap d, PR #1806) onto the first-byte-deadline and stall-guard change (gap c, PR #1805), keeping both features.

## Step 1: Rebase and resolve the anthropic.ts conflict, gates green
level: L3
guard timeout: 300

### Do
Follow the task handoff at `.sdlc/work/rebase-retry/handoff.md` exactly: `git rebase origin/fix/anthropic-sse-deadline`, resolve the `anthropic.ts` conflict by hand using the stated design, continue the rebase, run the gates. Do not push.

### Acceptance criteria
- `git merge-base --is-ancestor origin/fix/anthropic-sse-deadline HEAD`
- `test -f packages/agent-ui/a2ui/src/agent/providers/anthropic.ts && grep -q 'ANTHROPIC_FIRST_BYTE_TIMEOUT_MS' packages/agent-ui/a2ui/src/agent/providers/anthropic.ts && grep -q 'ANTHROPIC_STALL_TIMEOUT_MS' packages/agent-ui/a2ui/src/agent/providers/anthropic.ts && grep -q 'fetchWithRetry' packages/agent-ui/a2ui/src/agent/providers/anthropic.ts && grep -q 'ANTHROPIC_MAX_RETRIES' packages/agent-ui/a2ui/src/agent/providers/anthropic.ts`
- `test -f packages/agent-ui/a2ui/src/agent/providers/anthropic.ts && ! grep -qE '^(<<<<<<<|=======|>>>>>>>)' packages/agent-ui/a2ui/src/agent/providers/anthropic.ts`
- (guard) `git diff --quiet origin/fix/anthropic-sse-deadline HEAD -- packages/agent-ui/a2ui/src/live-agent/anthropic-timeouts.test.ts`
- (guard) `test -z "$(git diff --name-only origin/fix/anthropic-sse-deadline HEAD | grep -vxF -e packages/agent-ui/a2ui/src/agent/providers/anthropic.ts -e packages/agent-ui/a2ui/src/live-agent/anthropic-retry.test.ts)"`
- (guard) `test -z "$(git status --porcelain -- . ':(exclude).sdlc')"`
- (guard) `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/anthropic-timeouts.test.ts packages/agent-ui/a2ui/src/live-agent/anthropic-retry.test.ts packages/agent-ui/a2ui/src/live-agent/anthropic-sse.test.ts packages/agent-ui/a2ui/src/live-agent/anthropic-tool-loop.test.ts`
- (guard) `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent`
- (guard) `npx vitest run --project tools packages/agent-ui/a2ui/tools`
- (guard) `npm run check`
