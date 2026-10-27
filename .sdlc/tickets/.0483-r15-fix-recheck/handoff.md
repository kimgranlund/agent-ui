---
id: T-0483
title: "A paid rerun of the four round 15 failing cells confirms T-0478 to T-0482"
type: spike           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0480]  # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-27
claimed_by: claude:a8ce3b21 2026-10-27
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
A small paid Haiku round reports whether the four round 15 failing cells now pass.

## Context
Round 15 (`.sdlc/evals/rounds/2026-10-26-r15-pattern/`) failed 4 of 69. Fixes since, each proven by keyless replay: T-0478 (ConfirmReceipt, in-your-order claim), T-0479 and T-0482 (GameHud check, grammar.md:44), T-0480 (Itinerary), T-0481 (claim negatives). Cells: `smoke-negotiator-first-offer-haiku`, `smoke-shopkeeper-browse-and-add-haiku`, `reach-shopkeeper-cart-amount-haiku`, `reach-concierge-day-itinerary-haiku`, 3 samples each, commands taken from round 15's `live-commands.sh`.

## Constraints
Cap 1 USD (Kim 2026-10-27). A new round folder; never rewrite a finished one. Never read or print .env or keys. A cell still failing gets a proposed fix layer and keyless test for Kim, not filed. No em dashes.

## Done when
- `report.md` in the new round folder gives each cell's round 15 and new pass counts, the codes that fired, and cost.
- `npm run check` passes.
- Lane: solo because size L1 (steps.py lane)

## Outcome

2026-10-27 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: be31c52e658a
- Changed: A paid recheck of the four round 15 failing cells passes 12 of 12 Haiku runs for 0.10 USD
- Commits: none
- Check: 1 `report.md` in the new round folder gives each cell's round 15 and new pass counts, the codes tha...: pass
- Check: 2 `npm run check` passes: pass
- Follow-up: fix-now: .sdlc/evals/rounds/2026-10-27-r15-recheck/report.md:5 says... -> notes.md
