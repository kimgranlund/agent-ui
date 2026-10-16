---
id: T-0265
title: "Haiku answers in prose with no surface on game openings, Admiral shots and Concierge turns, and no check sends these back"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A Haiku turn that should draw or update a surface, but answers in prose only, is sent back the way a Croupier move already is (ACTION_NOT_APPLIED). This covers a game opening, an Admiral shot at its open board, and a Concierge booking or services turn.

## Repro
Read `.sdlc/evals/rounds/2026-10-15-r3-routing/``runs/` (all Haiku 5.5):
1. `regress-croupier-texas-holdem-haiku-1` t0 and `regress-croupier-five-card-draw-haiku-1` t0: the opening is dealt in prose with no table (:68, "Your hole cards are A♥ K♦").
2. `regress-admiral-opening-salvo-haiku-1` t4 and `regress-admiral-row-sweep-haiku-1` t2: `action-updates-surface`, "the say turn targeting enemy-waters was answered with no update to it".
3. `regress-concierge-spa-booking-haiku-1`: no surface on any of 4 turns (:96-:99). The booking is reviewed and "confirmed" in prose.

## Expected
Each of these turns ships its surface, or the repair round makes it.

## Actual
No check fires on these turns. ACTION_NOT_APPLIED (12 fires, all Haiku Croupier) covers only typed moves at an open Croupier table.

## Context
This follows up T-0214, which was fixed for Croupier moves. Sonnet and Opus never showed this shape in round 3. Found by T-0261.

## Acceptance criteria
verifier: L3

- (red) `npx vitest run scripts/e2e-admin/probe/replays/croupier-holdem-haiku-opening-prose.test.mjs` exits 0: the recorded hold'em opening dealt in prose with no table ships with failure codes `SURFACE_MISSING, SEMANTIC_UNCORRECTED` (a repair round was spent on it).
- (red) `npx vitest run scripts/e2e-admin/probe/replays/admiral-haiku-shot-prose.test.mjs` exits 0: "Fire at A2." targeting enemy-waters with no update ships with `ACTION_NOT_APPLIED, SEMANTIC_UNCORRECTED`, the shot that did update enemy-waters keeps no code, and the probe fails only `action-updates-surface:2`.
- (red) `npx vitest run scripts/e2e-admin/probe/replays/concierge-haiku-booking-prose.test.mjs` exits 0: the spa services ask, the booking and the confirm turn, each answered in prose with no surface, ship with `SURFACE_MISSING, SEMANTIC_UNCORRECTED`.
- (red) `npx vitest run --project packages packages/agent-ui/a2ui/src/catalog/personas/concierge/checks.test.ts` exits 0: a services, booking or confirm say turn with no surface is SURFACE_MISSING; one that ships a surface, a question with no booking or services word, and a client turn pass.
- `npx vitest run --project packages packages/agent-ui/a2ui/src/catalog/personas/croupier/checks.test.ts packages/agent-ui/a2ui/src/catalog/hidden-state-checks.test.ts packages/agent-ui/a2ui/src/live-agent/produce-semantic-checks.test.ts packages/agent-ui/a2ui/src/catalog/semantic-check.test.ts` exits 0: a game opening with no table is SURFACE_MISSING (a rules question and a dealt opening pass); a typed shot at a targeted open board with no update is ACTION_NOT_APPLIED; a note-only say turn with no target is judged.
- `npx vitest run scripts/e2e-admin/probe` exits 0: every recorded replay and the trace pins still pass.
- `npm run check` exits 0.

## Outcome

2026-10-15 · lane: full L2 · verdict: closed by reason (Merged in #2036: SURFACE_MISSING and fleet-shot-applied send back prose turns; verifier L3 pass) · verifier: none · base: none
- Changed: see commits
- Commits: none
