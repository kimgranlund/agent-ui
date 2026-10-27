---
id: T-0480
title: "A day plan with timed stops answered with no Itinerary is a missing composite"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [file:.sdlc/evals/rounds/2026-10-26-r15-pattern/report.md]  # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-26
claimed_by: claude:a8ce3b21 2026-10-27
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
The bug is fixed and a keyless replay that failed before the fix passes after it.

## Repro
1. `npm run chat:probe -- --replay .sdlc/evals/rounds/2026-10-26-r15-pattern/runs/reach-concierge-day-itinerary-haiku-3/fixture.json` exits 1.

## Expected
A say turn that plans a day with two or more timed stops and writes no Itinerary gets a missing-Itinerary finding, and the :150 replay ends with an Itinerary.

## Actual
The guest gave the date and all three times. r1 writes the plan as prose plus a meta note asking party size (SURFACE_CLAIMED); r2 builds only the `ask-1` OptionDeck, so the plan never reaches a surface.

## Context
Live round 15 (T-0475), cluster Y, 1 of 69 runs; full row in `.sdlc/evals/rounds/2026-10-26-r15-pattern/report.md`. May be prompt drift from T-0477 (concierge content changed). Fix layer: an Itinerary row in `packages/agent-ui/a2ui/src/catalog/composite-moments.ts`, unit case in `composite-moments.test.ts`. Depends on T-0478, which edits the same file. Cause a guess until the failing test shows it.

## Constraints
The failing test lands before or with the fix, never after. Prefer the check over prompt text; any model-read text change gets a Fable review. Measure afterwards with 3 samples of the failing cell (a separate paid run, Kim's call). No em dashes.

## Also in scope (Kim 2026-10-27, from the T-0478 Fable review)
- `composite-moments.ts:332`: the ConfirmReceipt row's `words` gate takes `total`, so a bill with a tip AmountPicker beside a "Total" Text fires CONFIRM_RECEIPT_MISSING. Add that negative and narrow the gate.
- `composite-moments.ts:331`: `lacks` lists BookingForm and BookingConfirmation but only the GameHud and StepFlow guards have a bite test; add the two.

## Done when
- A tip-and-total bill unit case passes with no CONFIRM_RECEIPT_MISSING, and a bite test per booking guard.
- The named replay(s) pass and a unit case covers the new rule.
- A false-positive sweep over recorded round 14 and 15 fixtures for the persona stays green.
- `npm run check` plus the touched folders' tests pass.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
- The authored replay passes keyless: `npx vitest run scripts/e2e-admin/probe/replays/concierge-haiku-day-plan-no-itinerary.test.mjs` exits 0 (rounds 1 and 2 verbatim draw ITINERARY_MISSING, round 3 ends on an Itinerary; it failed `expect-component` before the row).
- The same fixture passes the probe leg: `npm run chat:probe -- --replay scripts/e2e-admin/probe/replays/concierge-haiku-day-plan-no-itinerary.json` exits 0.
- The unit cases (the Itinerary row, the tip-and-total bill negative, a bite test per BookingForm and BookingConfirmation guard) pass: `npx vitest run packages/agent-ui/a2ui/src/catalog/composite-moments.test.ts` exits 0.
- The touched folders' tests pass: `npx vitest run packages/agent-ui/a2ui/src/catalog packages/agent-ui/a2ui/src/live-agent packages/agent-ui/a2ui/tools/agent scripts/e2e-admin/probe` exits 0.
- The standing gate passes: `npm run check` exits 0.
- The keyless replay of every round 14 and round 15 fixture (runs/*/fixture.json, 138) exits as it did at the base sha: the same 9 pre-existing reds, no new one.


## Outcome

2026-10-27 · lane: solo L2 · verdict: pass · verifier: verifier-L3 (fable) · base: 02b5afbc391b
- Changed: A say turn that plans a day with two or more timed stops and no Itinerary gets ITINERARY_MISSING, and a tip-and-total bill no longer trips CONFIRM_RECEIPT_MISSING
- Commits: none
- Check: 1 The authored replay passes keyless (`npx vitest run scripts/e2e-admin/probe/replays/concierge-hai...: pass
- Check: 2 The same fixture passes the probe leg (`npm run chat:probe -- --replay scripts/e2e-admin/probe/re...: pass
- Check: 3 The unit cases pass (`npx vitest run packages/agent-ui/a2ui/src/catalog/composite-moments.test.ts...: pass
- Check: 4 The touched folders' tests pass (`npx vitest run packages/agent-ui/a2ui/src/catalog packages/agen...: pass
- Check: 5 The standing gate passes (`npm run check` exits 0): pass
- Check: 6 The keyless replay of every round 14 and round 15 fixture (138) exits as it did at the base sha, ...: pass
- Follow-up: decide: packages/agent-ui/a2ui/src/catalog/composite-moments.ts:267 decide... -> notes.md
- Follow-up: decide: packages/agent-ui/a2ui/src/catalog/composite-moments.ts:260 note... -> notes.md
- Follow-up: decide: .sdlc/tickets/roadmap.md:122 note: the one em dash in an added... -> notes.md
- Follow-up: decide: .sdlc/tickets/0480-itinerary-missing-composite/handoff.md:19 note... -> notes.md
- Follow-up: decide: scripts/e2e-admin/probe/replays/concierge-haiku-itinerary-target-cl... -> notes.md
