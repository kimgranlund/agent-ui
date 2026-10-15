## Task goal
Make each turn report what it assembled and what the provider billed: a declared whole-prompt budget with a structured over-budget result (never silent truncation), prompt-section sizes on `TurnTrace`, and token usage from the provider on the trace and the devtools timeline. Tracks GH #1809 and the token accounting remainder of GH #1797.

## Step 2: Devtools turn-end carries the turn's token usage
level: L2
### Do
Depends on: step 1 (`TokenUsage` on `TurnTrace`).

1. **`packages/agent-ui/devtools/src/timeline/events.ts`.**
   - The `turn-end` arm (:70) gains `usage?: TokenUsage`, via `import type { TokenUsage } from '@agent-ui/a2ui/agent/meta-line'`, the subpath devtools already imports (:19-20). A provider import stays banned (`layering.test.ts:153`).
   - `recordTurn` latches `meta.a2uiMeta.trace?.usage` from each `meta` event; the last one seen wins. Both `turn-end` yields (:142 error path, :145) spread it only when defined, so a turn without it has no `usage` key at all.
   - `DEVTOOLS_EVENT_KINDS` (:34) stays closed: no new kind. SPEC-R7 forbids a second vocabulary.
2. **`packages/agent-ui/devtools/src/capture/format.ts`.**
   - Add to `EVENT_FIELD_RULES['turn-end']` (:79) the triple `['usage', (v) => v === undefined || isTokenUsage(v), 'absent or a TokenUsage object']`. The predicate is needed because the rules are required-field checks.
   - `isTokenUsage` is a local predicate: a record with numeric `inputTokens` and `outputTokens`, and each cache field either undefined or a number.
   - `DEVTOOLS_CAPTURE_VERSION` stays 1, so old captures still parse.
3. **New `packages/agent-ui/devtools/src/timeline/turn-usage.test.ts`**, built with `scriptTransport` and the `recordTurn` helper shape from `events.test.ts:21-25`. Cases:
   - (a) a meta-line whose trace carries usage gives `turn-end.usage` deep-equal to it;
   - (b) no trace usage gives `'usage' in turnEnd === false`;
   - (c) a capture whose `turn-end` carries usage round-trips equal through `serializeCapture` and `parseCapture`;
   - (d) a v1 capture whose `turn-end` lacks usage parses;
   - (e) a malformed usage throws `CaptureParseError` with field `timeline[2].usage`.
4. **Dependents left untouched on purpose.** The change is additive, and both are covered by the guards below and the step 4 gates:
   - `site/pages/devtools-harness*.test.ts` and `agent-admin-debug-export.test.ts` pin kind sequences only.
   - The harness page renders serialized rows (`devtools-harness.ts:150-158`), so there is no page change.

Focused check: `npx tsc`.
### Acceptance criteria
- `npx vitest run --project packages packages/agent-ui/devtools/src/timeline/turn-usage.test.ts`
- `grep -qF "usage?: TokenUsage" packages/agent-ui/devtools/src/timeline/events.ts && grep -qE "^\s*\[.usage., " packages/agent-ui/devtools/src/capture/format.ts`
- (guard) `grep -qF "export const DEVTOOLS_CAPTURE_VERSION = 1 as const" packages/agent-ui/devtools/src/capture/format.ts`
- (guard) `! grep -E "^export const DEVTOOLS_EVENT_KINDS" packages/agent-ui/devtools/src/timeline/events.ts | grep -qE "usage|budget"`
- (guard) `npx vitest run --project packages packages/agent-ui/devtools`
- (guard) `npx vitest run --project site site/pages/devtools-harness.test.ts site/pages/devtools-harness.helper.test.ts site/pages/agent-admin-debug-export.test.ts`
- (guard) `{ git diff --name-only "$SDLC_BASE_SHA" -- . ":(exclude).sdlc"; git ls-files --others --exclude-standard -- . ":(exclude).sdlc"; } | grep -vxE "packages/agent-ui/a2ui/src/agent/(meta-line|agent-transport|system-prompt|prompt-budget|produce|index)\.ts|packages/agent-ui/a2ui/src/live-agent/(meta-line|prompt-budget|produce-budget-usage|produce-loop|a2ui-surface-toggle|genui-exclusive)\.test\.ts|packages/agent-ui/devtools/src/timeline/(events\.ts|turn-usage\.test\.ts)|packages/agent-ui/devtools/src/capture/format\.ts" | { ! grep -q .; }`
