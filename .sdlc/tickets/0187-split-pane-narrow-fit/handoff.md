---
id: T-0187
title: "split-pane demo stacks or scrolls at 400px instead of overflowing the column"
type: chore           # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The split-pane demo stops ending 63px past the 400px column: it stacks or scrolls at narrow widths, so `demo/split-pane-demo#column` leaves the render allowlist.

## Intent
- Do: Stack or scroll the specimen at narrow widths; delete the allowlist line.
- Non-goals: other allowlist entries.
- Done when: render lint `demo/split-pane-demo` green in both engines with no entry; screenshot viewed.

## Context
Filed by T-0170 (lint allowlist owners, 2026-10-14), which repointed the allowlist reason to this ticket.

## Constraints
Never add an allowlist entry without an owner (T-0170 format check). No em dashes.
