---
id: T-0338
title: "product-card icon header: 2n icon box or a ruled exemption (icon-box debt)"
type: chore           # feature | bug | chore | spike | idea
status: proposed     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P3         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-17
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
product-card's image-free icon header either follows the 2n icon ruling (16px) or carries a ruled exemption.

## Intent
- Do: the fix in Context, one cause.
- Non-goals: other round 9 clusters.
- Done when: Per the ruling: the allowlist line removed, or an exemption with its reason. `npm run check` plus the touched folders' tests exit 0.

## Context
T-0168 icon-box rule; product-card exhibit mode data-part=icon is 48px. Allowlisted in scripts/dogfood-render-allowlist.json. Needs Kim's ruling: fix to the ruling, or exempt the exhibit header as pictorial.

## Constraints
None.
