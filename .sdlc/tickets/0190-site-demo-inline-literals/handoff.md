---
id: T-0190
title: "site demos: inline type sizes and off-ramp spacing literals move to tokens"
type: chore           # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The site demos left in scripts/dogfood-compose-allowlist.json after T-0170 (inline font-size captions, off-ramp spacing such as 0.4rem, 1.25rem, 2px, a literal radius) move to tokens, and their allowlist lines go.

## Intent
- Do: Map each literal to a --md-sys-type-* role or a --md-sys-space-* / level token, or a ui-row / ui-column; delete each migrated line.
- Non-goals: other allowlist entries.
- Done when: `node scripts/dogfood-compose.mjs --gate` exit 0 with fewer entries; touched demos' screenshots viewed.

## Context
Filed by T-0170 (lint allowlist owners, 2026-10-14), which repointed the allowlist reason to this ticket.

## Constraints
Never add an allowlist entry without an owner (T-0170 format check). No em dashes.
