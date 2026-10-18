---
id: T-0189
title: "playing-card corner index: a type floor or a ruled pictorial exemption"
type: chore           # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Decide the playing card corner index under the 9px type floor (ADR-0245 M5): a floor on the index or a ruled pictorial exemption, so `demo/playing-card-demo#type-floor` leaves the render allowlist or cites the ruling.

## Intent
- Do: Pick one with Kim; implement it; update or delete the allowlist line.
- Non-goals: other allowlist entries.
- Done when: render lint `demo/playing-card-demo` green in both engines; screenshot viewed.

## Context
Filed by T-0170 (lint allowlist owners, 2026-10-14), which repointed the allowlist reason to this ticket.

## Constraints
Never add an allowlist entry without an owner (T-0170 format check). No em dashes.
