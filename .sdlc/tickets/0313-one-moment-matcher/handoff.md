---
id: T-0313
title: "One matcher per composite moment for teaching and check; the structured-container trigger fix; the Play again vocabulary fix (P1, P5)"
type: feature        # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-16
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
P1 as revised and P5's replacement (Kim 2026-10-16 debate): the composite-moment rows in `packages/agent-ui/a2ui/src/catalog/composite-moments.ts` become the one matcher for both teaching and check, absorbing the Concierge `askedMoment` (`catalog/personas/concierge/checks.ts:30-52`); fix the `structured-container` mini-skill triggers so it is not framed on a confirm; a vocabulary fix so "Play again." in the Admiral does not pull the word-board exemplar. No round-1 moment line, no lexical gate. Source: `.sdlc/work/routing-architecture-review/` (proposals, challenge and rebuttal under `.sdlc/runtime/tasks/routing-architecture-review/`).

## Done when
- Tests: the Concierge moments resolve through the rows with no behavior change on the existing replays; structured-container is not selected on a confirm turn; "Play again." retrieval excludes the word board; each red at the base. The catalog, live-agent and probe suites and `npm run check` exit 0.
