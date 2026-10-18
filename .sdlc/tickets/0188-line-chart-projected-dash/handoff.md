---
id: T-0188
title: "line-chart projected dash: user-unit dash or a ruled screen-px exemption"
type: chore           # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Decide the line-chart projected dash: a user-unit dash (no non-scaling-stroke with a dasharray) or a ruled exemption, so `demo/line-chart-demo#dash-scale` leaves the render allowlist or cites the ruling.

## Intent
- Do: Pick one with Kim; implement it; update the allowlist line or delete it.
- Non-goals: other allowlist entries.
- Done when: render lint `demo/line-chart-demo` green in both engines; the dash reads the same at every box size.

## Context
Filed by T-0170 (lint allowlist owners, 2026-10-14), which repointed the allowlist reason to this ticket.

## Constraints
Never add an allowlist entry without an owner (T-0170 format check). No em dashes.
