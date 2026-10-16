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

## Lane bundle
One solo lane (wave-gr), one commit per ticket, in order:
1. T-0308: drop the reference-Badge example from the grammar and the library text (`.sdlc/tickets/0308-grammar-drop-reference-badge/`).
2. T-0312: persona type-name lint, Croupier reword, pin tests per ruling, committed audit mapping (`.sdlc/tickets/0312-persona-type-name-lint/`).
3. T-0313: one matcher per composite moment, the structured-container trigger fix, the Play again vocabulary fix (this ticket).

## Acceptance criteria
verifier: L3
- (red) `npx vitest run --project packages packages/agent-ui/a2ui/src/catalog/composite-moments.test.ts -t "ask cue"` exits 0: the BookingConfirmation, ProductCard and BookingForm rows carry the Concierge ask cues (confirm, services, booking) in that precedence, each matching its round-scenario sentence. The facility ask stays local to `personas/concierge/checks.ts`: its answer (one Card holding a DescriptionList) is no composite, so no row owns it.
- `npx vitest run --project packages packages/agent-ui/a2ui/src/catalog` exits 0 with `personas/concierge/checks.test.ts` unchanged: every Concierge moment resolves with the same finding path and message as before.
- `npx vitest run --project scripts scripts/e2e-admin/probe` exits 0 (the Concierge replays unchanged).
- (red) `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/mini-skills.test.ts -t "confirm turn"` exits 0: structured-container is not selected on a booking confirm turn; a trip summary turn still selects it.
- `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent packages/agent-ui/a2ui/src/agent` exits 0 (agent-assets freshness; the prompt-equivalence baseline recaptured deliberately only if the trigger edit moves it).
- `npm run check` exits 0.

## Conductor ruling (2026-10-16)
The "Play again." retrieval part is dropped from T-0313: its criterion already passes at the base (retrieval returns nothing for "Play again." on agent-ui), so no change can be shown, and the semantic checks already catch the case (round 6: 6 of 6 saved). The real defect the solo found, cross-game retrieval on the shared agent-ui catalog ("New game" ranks the word board first for the Admiral), is filed separately for the debate process. Judge T-0313 on its other two parts.
