---
id: T-0496
title: "list-demo at 400px keeps its row actions and badge labels whole"
type: bug             # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P3         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
At 400px, list-demo contact rows keep their one-word action and badge labels whole.

## Context
Found by T-0488 (F5). At 400px the contact-row "Message" ui-button gets 50 to 57px of the 66px it needs ("Mess..."), and four ui-badge hosts paint 5 to 12px past their right edge ("Owner", "Invited"). Crop: /private/tmp/claude-501/-Users-kimgranlund-Projects-nonoun-agent-ui/a8ce3b21-c0a4-4e5f-b099-1796666e5f7f/scratchpad/0488-shots/crops/list-demo-400.png

## Constraints
Fix in the demo page or the list row's layout (wrap, or drop the email line before squeezing trailing actions). If the cause is in a control, fix it there with a failing-first test. Screenshot before and after. No em dashes.

## Acceptance criteria
- At 400px no list-demo button label is truncated and no badge content passes its host edge (measured in a browser test or the dogfood-render lint).
- The site dogfood-render browser test exits 0.
- `npm run check` exits 0.
- Lane: solo because size L1 (steps.py lane)

## Outcome

2026-10-28 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: c01455b8045c
- Changed: list-demo at 400px keeps its Message action and badge labels whole
- Commits: none
- Check: 1 At 400px no list-demo button label is truncated and no badge content passes its host edge: pass
- Check: 2 The site dogfood-render browser test exits 0: pass
- Check: 3 `npm run check` exits 0: pass
- Check: 4 Lane: solo because size L1: pass
- Follow-up: note: site/pages/list-demo.ts:33 fix uses inline style on the demo page... -> notes.md
