<!-- role=builder level=L2 model=opus effort=low -->
## Status
done

## Changes
- packages/agent-ui/a2ui/tools/agent/chat-validation.ts: adds `validateResponsePreference` (the three `RESPONSE_PREFERENCES` literals pass, all else `undefined`); `isChatBody` untouched.
- packages/agent-ui/a2ui/tools/agent/dev-proxy-plugin.ts: produce POST body type gains `responsePreference?`/`prefers?: unknown`; both validated and spread into `produce()` opts only when defined.
- packages/agent-ui/a2ui/tools/agent/worker/index.ts: same for `handleProduce`.
- packages/agent-ui/a2ui/src/live-agent/chat-validation.test.ts: `describe('validateResponsePreference ...')`, literals pass; `'TEXT'`, `'both'`, `1`, `null`, `undefined`, `{}` dropped.
- packages/agent-ui/a2ui/src/live-agent/dev-proxy-response-preference.test.ts (new): `describe('host threading')`, 3 tests (text drops the tool; prefers surface adds the paragraph and keeps the tool; `'TEXT'` dropped, tool offered, and a plain turn has no paragraph).
- Committed as a1a258f6 on feat/response-type-selection (no push).

## Checks
- `redck.py record` before edits: 3 red controls recorded.
- C1 grep criterion: exit 0.
- C2 vitest `-t validateResponsePreference` passed-count grep: exit 0.
- C3 vitest `-t "host threading"` passed-count grep: exit 0.
- Guard: chat-validation + dev-proxy-abort (packages) then `--project tools .../worker/` (35 passed): exit 0.
- Guard: scope loop against base 52be6c56: exit 0.
- `npx tsc --noEmit -p .`: exit 0.
- Negative control: with the two spreads removed from dev-proxy-plugin.ts, the threading file went 2 failed / 1 passed; file restored after.

## Notes
The worker's threading is checked only by the C1 structural check, as the handoff says; runtime coverage is left to step 9. The surface paragraph is read from `src/agent/prompts/response-preference-surface.md` via `process.cwd()`, following the chat-validation.test.ts ROOT precedent. No em dashes on added lines.
