---
id: T-0407
title: "ConfirmReceipt keeps keyboard focus on the receipt when Confirm removes its own actions row"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-22
claimed_by: claude:a8ce3b21 2026-10-22
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
Pressing Confirm on a ui-confirm-receipt keeps keyboard focus inside the receipt: the actions row that held the focused Confirm button is removed (confirm-receipt.ts:268), and focus currently drops to the document body, which strands keyboard and screen-reader users.

## Intent
- Do: in packages/agent-ui/components/src/controls/confirm-receipt/confirm-receipt.ts, when Confirm removes the actions row while focus is inside it, move focus to a sensible target in the receipt (the receipt host or its settled status, made focusable with tabindex -1 as needed) before or as the row is removed; announce nothing new beyond what ElementInternals already exposes. Add a test beside it (jsdom, and the browser test if the control has one) that presses Confirm by keyboard and asserts document.activeElement is inside the receipt, failing on main. Update the descriptor confirm-receipt.md Keyboard/focus prose if it has such a section.
- Non-goals: the record order (notes :583, Kim's design call); the a2ui catalog row or mini-skill.
- Done when: the new test fails on main and passes after; `npm run check`, the confirm-receipt folder tests and its browser test exit 0.

## Context
From the T-0195 verifier notes (.sdlc/notes/notes.md :582). Components are light-DOM, ARIA via ElementInternals, never host attributes (root AGENTS.md). Skill component-build, component-testing.

## Constraints
No em dashes. Never hand-edit *.props.gen.ts.
- Lane: solo because size L1 (steps.py lane); overnight goal 2026-10-21

## Outcome

2026-10-22 · lane: solo L1 · verdict: closed by reason (already delivered by T-0195 (ed1caa261, #2179): Confirm focuses the settled mark (confirm-receipt.ts:180, :198), descriptor :137, tests confirm-receipt.test.ts:230 and browser :218; notes :582 was stale) · verifier: none · base: none
- Changed: see commits
- Commits: none
