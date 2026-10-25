---
id: T-0464
title: "An OptionDeck icon name outside the icon pack shows a neutral fallback glyph, not an empty tile"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-25
claimed_by: claude:a8ce3b21 2026-10-25
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
An OptionDeck card whose `icon` names no glyph in the icon pack shows a neutral default glyph in its tone tile, never an empty tile.

## Context
T-0455's sweep: `icon: "compass"` (not in Phosphor) rendered an empty tile. Kim ruled 2026-10-25 for a fallback glyph.

## Constraints
Fix in the control (or the icons adapter if the fallback belongs there for every consumer; say which and why). Failing-first test. A screenshot of the fallback tile.

## Done when
- A test that fails before the fix proves an unknown icon name renders the fallback glyph.
- A screenshot in the artifacts dir.
- `npm run check` plus the touched folders' tests and the option-deck browser tests pass.
- Lane: solo because size L1 (steps.py lane)

## Outcome

2026-10-25 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 913474054077
- Changed: An OptionDeck icon name outside the icon pack shows a sparkle fallback glyph instead of an empty tile
- Commits: none
- Check: 1 A test that fails before the fix proves an unknown icon name renders the fallback glyph: pass
- Check: 2 A screenshot in the artifacts dir: pass
- Check: 3 `npm run check` plus the touched folders' tests and the option-deck browser tests pass: pass
- Check: 4 Lane: solo because size L1: pass
- Follow-up: note: packages/agent-ui/components/src/controls/option-deck/option-deck.t... -> notes.md
