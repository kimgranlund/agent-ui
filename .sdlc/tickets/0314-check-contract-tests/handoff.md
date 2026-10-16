---
id: T-0314
title: "Check contracts: pass and fail fixtures cross-run across all checks, a repair-text vocabulary test, and a repair-loop property test (P2)"
type: chore           # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-16
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
P2 as revised (Kim 2026-10-16 debate): every `SemanticCheck` (`catalog/semantic-check.ts:110`) gets pass and fail fixtures, cross-run against every other check (a fixture that passes its own check must not fail another unexpectedly); a vocabulary test over repair text (check-result framing, no type names the persona forbids); a test-only property test over the repair loop in `agent/produce.ts` with invariant I1 scoped to the turn and a pin of the T-0302 earlier-round fallback. No refactor unless a property fails. Source: `.sdlc/work/routing-architecture-review/` (proposals, challenge and rebuttal under `.sdlc/runtime/tasks/routing-architecture-review/`).

## Done when
- The cross-run, vocabulary and property tests exist and pass; a mutated check makes the cross-run red; any real defect found is filed, not fixed here; `npm run check` exits 0.

## Acceptance criteria
verifier: L3
- `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/check-contracts.test.ts` exits 0: every shipped `SemanticCheck` (the set `semanticChecksDeps` yields over every composed catalog) has a pass and a fail fixture; each fail fixture fires its own check with its named code and each pass fixture passes it; on every catalog a check rides, no co-run check fires on another check's fixture outside a reasoned, shrink-only allowlist; repair text names only types and props of the catalog it rides and keeps the check-result framing.
- `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/check-contracts.test.ts -t "mutated check"` exits 0: a broadened check makes the cross-run report a violation naming it (the standing negative control); the report also shows a planted source mutation turning the file red and reverted.
- `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/produce-loop-property.test.ts` exits 0: over every enumerated round sequence (text and `render_surface` rounds, `messages` as a JSON string, `target` as a string), a shipped turn keeps, updates or deletes every surface an earlier round of the turn created (I1, scoped to the turn and the shipped round), never ships an update to a surface nothing created (I2), and pins T-0302: a failing last round after an earlier valid, drop-free round ships that round's lines with `EARLIER_ROUND_SHIPPED` last.
- `npx vitest run --project packages packages/agent-ui/a2ui/src/catalog packages/agent-ui/a2ui/src/live-agent` exits 0.
- `git diff --quiet 92a90712d3bbab0091b0d091c6c7a7f7b3d57f3a -- packages/agent-ui/a2ui/src/catalog packages/agent-ui/a2ui/src/agent packages/agent-ui/a2ui/tools` exits 0: tests only, no source edit.
- `npm run check` exits 0.
