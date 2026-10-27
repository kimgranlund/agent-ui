---
id: T-0479
title: "GAME_HUD_MISSING also judges a Negotiator offer card with no GameHud"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [file:.sdlc/evals/rounds/2026-10-26-r15-pattern/report.md]  # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-26
claimed_by: claude:a8ce3b21 2026-10-26
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
The bug is fixed and a keyless replay that failed before the fix passes after it.

## Repro
1. `npm run chat:probe -- --replay .sdlc/evals/rounds/2026-10-26-r15-pattern/runs/smoke-negotiator-first-offer-haiku-1/fixture.json` exits 1.

## Expected
Trace :9 gets GAME_HUD_MISSING and its repair ends with a GameHud.

## Actual
After SURFACE_CLAIMED, r2 builds `ask-1` alone (a Card holding an AmountPicker) with no GameHud. GAME_HUD_MISSING stays silent: `gameAskHudCheck` needs a new OptionDeck, and `GAME_WORDS` finds no game word in "I'd like to buy your brass lantern. What's your price?".

## Context
Live round 15 (T-0475), cluster W2, 1 of 69 runs; full row in `.sdlc/evals/rounds/2026-10-26-r15-pattern/report.md`. Fix layer: catalog check in `packages/agent-ui/a2ui/src/catalog/hidden-state-checks.ts`: judge a new ask surface holding any play control (AmountPicker included) and know the game from the session's game persona or `HUD_GAME_WORDS`. Add a unit case in `hidden-state-checks.test.ts`. Cause read from source, a guess until the failing test shows it.

## Constraints
The failing test lands before or with the fix, never after. Prefer the check over prompt text; any model-read text change gets a Fable review. Measure afterwards with 3 samples of the failing cell (a separate paid run, Kim's call). No em dashes.

## Done when
- The named replay(s) pass and a unit case covers the new rule.
- A false-positive sweep over recorded round 14 and 15 fixtures for the persona stays green.
- `npm run check` plus the touched folders' tests pass.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
- The round 15 negotiator replay, as a keyless test from trace :9, fails before the fix and passes after: `npx vitest run scripts/e2e-admin/probe/replays/negotiator-haiku-claim-amount-ask.test.mjs` exits 0.
- Unit cases cover the persona leg, the AmountPicker ask, a non-game persona, no persona and a shown GameHud, and the game persona set is pinned to the agent content: `npx vitest run packages/agent-ui/a2ui/src/catalog/hidden-state-checks.test.ts site/agent-content/game-hud-placement.test.ts packages/agent-ui/a2ui/src/live-agent/chat-validation.test.ts` exits 0.
- Every recorded replay stays green: `npx vitest run scripts/e2e-admin/probe` exits 0.
- `npm run check` exits 0.

## Outcome

2026-10-26 · lane: solo L2 · verdict: pass · verifier: verifier-L3 (fable) · base: cfceda60f6ed
- Changed: GAME_HUD_MISSING judges a new ask holding any play control, AmountPicker included, and knows the game from the session persona, so a Negotiator offer card with no GameHud is repaired
- Commits: none
- Check: 1 The round 15 negotiator replay, as a keyless test from trace :9, fails before the fix and passes ...: pass
- Check: 2 Unit cases cover the persona leg, the AmountPicker ask, a non-game persona, no persona and a show...: pass
- Check: 3 Every recorded replay stays green (`npx vitest run scripts/e2e-admin/probe` exits 0): pass
- Check: 4 `npm run check` exits 0: pass
- Follow-up: decide: packages/agent-ui/a2ui/src/catalog/hidden-state-checks.ts:476... -> notes.md
- Follow-up: decide: packages/agent-ui/a2ui/src/catalog/hidden-state-checks.ts:485 note... -> notes.md
- Follow-up: decide: .sdlc/tickets/0479-negotiator-hud-check/handoff.md:35 decide: the... -> notes.md
- Follow-up: decide: scripts/e2e-admin/probe/replays/negotiator-haiku-claim-amount-ask.j... -> notes.md
- Follow-up: decide: .sdlc/tickets/0479-negotiator-hud-check/handoff.md:19 note: the... -> notes.md
