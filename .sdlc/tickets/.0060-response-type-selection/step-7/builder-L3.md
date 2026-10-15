<!-- role=builder level=L3 model=opus effort=high -->
## Status
done

## Changes
- packages/agent-ui/app/src/controls/agent-admin/agent-admin-schema.ts: `PREFERS_KEY`, `PREFERS_OPTIONS`, `ResponsePrefers`, fail-closed `sanitizePrefers` (default `auto`); `prefers?` on `AdminTurnRequest` and `AdminSurfaceTurnRequest`; `{ kind: 'text-delta'; text }` on `AdminSurfaceTurnEvent`; the stale "frozen handle has no incremental prose method" comment repaired.
- packages/agent-ui/app/src/controls/agent-admin/agent-admin.ts: a "Response type" row (`data-part="prefers-row"`, a `ui-segmented-control` Auto/Text/Surface) appended to Surface Options, reflected in `#applyMasterStates`; the surface request sends `prefers: sanitizePrefers(store.get(PREFERS_KEY))`; a `text-delta` event calls `handle.textDelta`.
- packages/agent-ui/app/src/controls/agent-admin/agent-admin.test.ts: `describe('prefers persona setting')` (default `auto` renders and is sent, a stored `text` is reflected and sent, a malformed value reads `auto`).
- packages/agent-ui/app/src/controls/conversation/conversation.ts: `AgentTurnHandle.textDelta(text)` accumulates fragments and paints them into the bubble; `setNote` replaces them; `finalize()` with no note keeps the streamed text (trimmed) instead of the tally; the guard stub gains the no-op.
- packages/agent-ui/app/src/controls/conversation/conversation.test.ts: `describe('text-delta')` (accumulated painting, note replaces, no-note keeps streamed text, a late fragment is inert).
- site/lib/admin-live-runner.ts: `prefers` sent only when not `auto`; a `textDelta` meta arm yields `{ kind: 'text-delta', text }`; the stored turn is `appendAssistantTurn(withUser, turnLines.join('\n'), note)`.
- site/lib/admin-live-runner.test.ts: `describe('text-delta')`, `describe('prefers request key')`, `describe('reply note in history')`.
- site/lib/plan-runner.ts: `TurnOutcome.note`, captured in `drainTurn` and returned on the success and `error` exits; the four calls pass `outcome.note` / `synthOutcome.note` / `planOutcome.note`; the drainTurn doc comment updated.
- site/lib/plan-runner.test.ts: the two pinned assertions (planner OFF fixture note `hi`, declining fixture note `just building it`) moved to `<note>\n<jsonl>`; `describe('plan runner reply note')` (ordinary turn, note-only step, note kept on an `error` exit).
- site/pages/a2ui-chat.ts, site/pages/a2ui-live.ts, site/pages/devtools-harness.ts, site/pages/gen-ui-live.ts: `appendAssistantTurn(..., note)` on one line each.

## Checks
- `redck.py record` before the first edit: 7 pre-edit controls red, recorded in red-checkpoint.jsonl.
- The six `(red)` vitest criteria (agent-admin `prefers persona setting`, admin-live-runner `text-delta` / `prefers request key` / `reply note in history`, plan-runner `plan runner reply note`, conversation `text-delta`): each exit 0.
- `(red)` call-site python criterion: exit 0, `9 []`.
- `(guard)` `npx vitest run --project packages packages/agent-ui/app/src/controls/agent-admin packages/agent-ui/app/src/controls/conversation`: exit 0, 40 files, 973 tests passed.
- `(guard)` `npx vitest run --project site site/lib/admin-live-runner.test.ts site/lib/plan-runner.test.ts`: exit 0, 107 passed.
- `(guard)` `git diff --quiet $SDLC_BASE_SHA -- .../activity-step.ts`: exit 0.
- `(guard)` scope loop: exit 0, no out-of-scope file.
- `npm run check`: exit 0.
- `npx vitest run --project site site/pages site/lib`: exit 0 (80 files passed, 1 skipped).
- `npm run e2e:admin` (local only, not a criterion): exit 0, 25 passed, 0 failed, negative controls red as expected.

## Notes
- `prefers` is on both request types. The produce route (`/__a2ui/agent`, step 6) is the only one that accepts `prefers`, so the surface runner is the one that sends it. `AdminTurnRequest.prefers` follows the handoff's wording, but the component does not set it and `createAdminAgentTurn` does not forward it, so the `/chat` body is unchanged.
- The component always puts the sanitized value on the surface request, `auto` included. The runner is the one that drops the key on `auto` (RTS-R7 AC2).
- The new row uses its own `data-part="prefers-row"` and not `surface-row`. Out-of-scope tests list the `surface-row` set exactly: `agent-admin.browser.test.ts:2021` and `:3838`, and `admin-help.test.ts` for the `[switch|label|spacer|?]` grammar and the fixed Surface-tab help keys. Because of that, the row gets no card chrome and has no help icon, since `agent-admin.css` and `ADMIN_HELP` are both out of scope. Its label and spacer reuse the styled `surface-label` and `surface-spacer` parts. Without the `surface-row` flex rule, the picker (block-level, fill by default) probably sits on its own line under the label. That layout was not checked in a browser. Follow-up: style `prefers-row` (or move it to `surface-row` and update those tests) and give it an `ADMIN_HELP` entry.
- These records are now stale and outside this step's scope: `agent-admin.md` (it says Surface Options has "five `surface-row`s" and does not list `prefers-row` or `surface-prefers`), `conversation.md` and the app-surfaces LLD (the `AgentTurnHandle` method list does not include `textDelta`).
- One extra conversation behavior was pinned by a test. If deltas were painted and no note ever arrives, `finalize()` keeps the trimmed streamed text instead of overwriting it with the `summarize()` tally.
- No test covers the `agent-admin.ts` branch that turns a `text-delta` event into `handle.textDelta`, and the handoff named none. Each side is tested on its own: the runner event and the handle painting. The discriminated union makes the branch typecheck (`npm run check` exit 0).
- Commits are on feat/response-type-selection: 1f40a493, d3fb7804, 21edfbf2, abe53183. The last one removes a no-op `inline` attribute: `segmented-control.css` has no `[inline]` rule. The agent-admin and conversation guard (973 passed) and `npx tsc --noEmit` (exit 0) were run again after it. Nothing was pushed, and no throwaway worktree was created.
