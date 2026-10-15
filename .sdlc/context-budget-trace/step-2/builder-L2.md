<!-- role=builder level=L2 model=opus effort=low -->
## Status
done

## Changes
- `packages/agent-ui/devtools/src/timeline/events.ts`: the `turn-end` arm gains `usage?: TokenUsage`. `recordTurn` keeps the most recent `meta.a2uiMeta.trace?.usage`, and both `turn-end` yields add it only when it is defined.
- `packages/agent-ui/devtools/src/capture/format.ts`: new local `isTokenUsage` predicate (with an `isOptNumber` helper) and a `usage` rule in `EVENT_FIELD_RULES['turn-end']`. The capture version stays 1.
- `packages/agent-ui/devtools/src/timeline/turn-usage.test.ts`: new file covering cases (a) through (e).

## Checks
- `npx vitest run --project packages packages/agent-ui/devtools/src/timeline/turn-usage.test.ts`: exit 0, 5/5 passed.
- grep for `usage?: TokenUsage` in events.ts and the `[usage, ` rule in format.ts: exit 0.
- (guard) `DEVTOOLS_CAPTURE_VERSION = 1 as const` grep: exit 0.
- (guard) `DEVTOOLS_EVENT_KINDS` has no usage or budget kind: exit 0.
- (guard) `npx vitest run --project packages packages/agent-ui/devtools`: exit 0, 82 passed.
- (guard) site project run over devtools-harness, devtools-harness.helper and agent-admin-debug-export tests: exit 0, 22 passed.
- (guard) changed-files allowlist: exit 0. `SDLC_BASE_SHA` came from the env, or from `base-sha` in the artifacts dir if unset.
- `npx tsc`: exit 0.

## Notes
None
