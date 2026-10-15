<!-- role=verifier level=L2 model=sonnet effort=high -->
## Verdict
pass

## Criteria
- Precondition loop (`anthropic-timeouts` and `anthropic-retry` test files exist): pass. Evidence: the loop printed no MISSING line and exited 0.
- `npx vitest run --project packages .../anthropic-usage.test.ts`: pass. Evidence: 1 file and 7 tests passed. The check bites: in a throwaway worktree, dropping the `usage` argument from the main-loop parse call failed (e), (f), (g), and removing the `message_delta` merge failed (a), (b), (e), (f), (g).
- `grep -qF "export function newUsageCollector(" .../providers/anthropic.ts`: pass. Evidence: exit 0.
- (guard) `git diff --quiet "$SDLC_BASE_SHA" -- .../anthropic-sse.test.ts`: pass. Evidence: exit 0. The diff against `dce7f6fe` touches only `anthropic.ts`, plus the untracked new test.
- (guard) adapter-dependents vitest run: pass. Evidence: 13 files and 104 tests passed. Not run at base, because it is green on the built tree.
- (guard) scope pipeline: pass. Evidence: exit 0. The only non-`.sdlc` changes are `providers/anthropic.ts` and `anthropic-usage.test.ts`, both on the allowlist.
- Focused check `npx tsc`: pass. Evidence: exit 0.
- Builder claims accepted after checking the diff:
  - One collector is created after the `res.ok` and body checks, and passed to both the main and trailing parse calls.
  - The usage event is emitted right before `done`, only when a collector was passed and usage was seen.
  - The fourth argument is optional, so the two-argument path is unchanged.

Steelman: I drafted a fail on the zero-default behavior (usage `{}` emits zeros). The builder would answer that the handoff only requires emitting "when a usage object was seen", and real frames always carry `output_tokens`. The handoff does not forbid this, so I dropped the finding.

## Out of scope changes
None. The type-only `TokenUsage` import from `../meta-line.ts` is a new edge inside `a2ui`. `meta-line.ts` has no imports, and the gates tests and `tsc` passed.

## For the next attempt
None
