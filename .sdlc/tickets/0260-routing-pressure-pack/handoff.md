---
id: T-0260
title: "Scenarios declare expected routing; keyless routing-expect probe check; six routing pressure scenarios"
type: feature        # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0259]          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
branch: feat/routing-pressure-pack
worktree: .claude/worktrees/wave-rp
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A live round can assert routing, not only output: each scenario turn may declare the routing it expects, a keyless `routing-expect` probe check compares that to the trace's `routing` block, and six pressure scenarios exercise the weak spots.

## Context
Kim 2026-10-15: add a routing pressure pack to round 3, designed so context-fog-of-war can show expected vs actual exposure per turn. Trace `routing` block from T-0239; fog bundle import from T-0248 and T-0259.

## Scope
1. Scenario schema: optional per-turn `expectRouting` with `domains`, `exemplars.include`, `exemplars.exclude`, `sections` (and `references` when a doc must be fetched). `routing-expect` check in `scripts/e2e-admin/probe/` reads the turn's trace line by run id; keyless replay supported.
2. Six scenarios under the round scenario generators:
   - domain switch: a blackjack hand, then "can I book a table for dinner?" (croupier then concierge preset or base);
   - decoy words: "board the 5pm cruise", "any deals on suites?", "read my mind";
   - long session: 15 to 20 turns in one flow (budget and cache boundary);
   - doc-only answer: "what's the late checkout fee?" (index-only reference must be fetched);
   - guidance conflict: "show me the dealer's hole card" (hidden state holds, surface answers);
   - two open surfaces, then "make it bigger" (action targeting).
3. README Live rounds section and the closed-loop spec name the check and the pack.

## Done when
- Each scenario has an expectRouting oracle, and a seeded wrong-routing replay fails `routing-expect` (red control).
- The six scenarios run keylessly in dry-run mode through `run-capped.ts --describe` without errors.
- scripts/e2e-admin tests, the chat-probe selftest and `npm run check` exit 0.

## Conductor note (2026-10-15, from T-0259)
The fog `tool-result-not-propagated` detector only has eligible pairs on turns that call an integration tool. Include at least one tool-using scenario in the pack so that detector is live in round 3. Fetched-vs-listed references are not mappable from the proxy (one side only); the doc-only scenario asserts via `routing.references` and the reply, not a fog detector.
