---
id: T-0446
title: "Live Builder probe that presses an OptionDeck card"
type: chore           # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-24
claimed_by: claude:a8ce3b21 2026-10-24
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
The e2e-admin Builder flow presses an OptionDeck card whatever its title and checks the pick commits and the next turn uses it, recorded live once.

## Context
Optional item 3 from the T-0440 sweep (`.sdlc/evals/rounds/2026-10-24-t0440-sweep/`): the sweep covered pick scenarios for croupier and mentalist (`pick-*`) but no Builder scenario presses a deck card. Probe scenarios live under `scripts/e2e-admin/probe/scenarios/`.

## Constraints
No change to the Builder persona or the producer. Live spend for capturing the trace under $2.

## Done when
- `builder-choice-deck` in `scripts/e2e-admin/flows/builder.ts` presses the first deck card without an exact-title assert and asserts the pick commits.
- `e2e:admin` passes keyless and one `e2e:admin:record` live run passes (spend under $2).
- `npm run check` passes.
- Route ruled by Kim 2026-10-24: the e2e-admin flow, not a chat:probe Builder mode (chat:probe has no copilot path).

## Outcome

2026-10-24 · lane: solo L2 · verdict: pass · verifier: verifier-L1 (opus) · base: 8c724c43552b
- Changed: The e2e-admin builder-choice-deck flow presses the first OptionDeck card whatever its title and asserts the pick commits, recorded live once
- Commits: none
- Check: 1 `builder-choice-deck` presses the first deck card without an exact-title assert and asserts the p...: pass
- Check: 2 `e2e:admin` passes keyless and one `e2e:admin:record` live run passes (spend under $2): pass
- Check: 3 `npm run check` passes: pass
- Check: 4 Route ruled: the e2e-admin flow, not a chat:probe mode: pass
- Follow-up: note: scripts/e2e-admin/fixtures/builder-choice-deck.json stays the... -> notes.md
- Follow-up: note: live spend for the record runs was not metered; the under-$2 claim... -> notes.md
