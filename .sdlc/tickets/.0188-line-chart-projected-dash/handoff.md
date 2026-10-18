---
id: T-0188
title: "line-chart projected dash: user-unit dash or a ruled screen-px exemption"
type: chore           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
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

## Outcome

2026-10-18 · lane: full L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 45dcca581087
- Changed: Projected dash is a ruled screen-px exemption (#2128)
- Commits: 2a4a3a0 T-0188: line-chart projected dash: ruled screen-px exemption (#2128)
- Check: 1 Entry reason states Kim's ruling and passes the owner-format check: pass
- Check: 2 Solo's user-unit trial screenshots support the reason: pass
- Check: 3 Nothing else changed: pass
- Check: 4 npm run check exit 0: pass
- Check: 5 Dogfood render test exit 0: pass
- Follow-up: note: scripts/dogfood-rules.json and... -> notes.md
