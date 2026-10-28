---
id: T-0497
title: "Site demo figures and event logs take the card-level radius (12px), not the 36px wrapper radius"
type: chore           # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P3         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
Site `.demo-figure` and `.event-log` boxes use the card-level radius, 12px, at regular density.

## Context
Found by T-0488 (F6). Both take r 36 (card radius 12 plus card margin 24), the concentric radius for a wrapper around an inner card, but they hold controls or text directly. Kim ruled 2026-10-28: card level, 12px (a leaf container holding text takes its own level's radius, clause 3). `.matrix` in `site/pages/permutations.css` is T-0494's, not this ticket's. Crop: /private/tmp/claude-501/-Users-kimgranlund-Projects-nonoun-agent-ui/a8ce3b21-c0a4-4e5f-b099-1796666e5f7f/scratchpad/0488-shots/crops/select-log.png

## Constraints
Use the card-level token, never a literal. Site CSS only; do not touch site/pages/permutations.css. Screenshot one demo page before and after. No em dashes.

## Acceptance criteria
- A browser measurement (new test or the dogfood-render lint) reads a `.demo-figure` and an `.event-log` computed radius equal to the card-level radius, and fails with the fix reverted.
- The site dogfood-render browser test exits 0.
- `npm run check` exits 0.
- Lane: solo because size L2 (steps.py lane)

## Outcome

2026-10-28 · lane: solo L2 · verdict: pass · verifier: verifier-L1 (opus) · base: cc7ba404114d
- Changed: Site demo figures and event logs take the card-level radius, 12px, per Kim's ruling
- Commits: none
- Check: 1 A browser measurement reads `.demo-figure` and `.event-log` computed radius equal to the card-lev...: pass
- Check: 2 The site dogfood-render browser test exits 0: pass
- Check: 3 `npm run check` exits 0: pass
- Check: 4 Lane: solo because size L2: pass
- Follow-up: note: site/lib/fixtures/theme-provider-built.css still holds the old... -> notes.md
