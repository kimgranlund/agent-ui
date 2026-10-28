---
id: T-0513
title: "The a2ui-live render-lint negative control picks a fixed literal that is not the 12px card radius, so it passes again on main"
type: bug             # feature | bug | chore | spike | idea
status: done
size: L1
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
`site/pages/a2ui-live.browser.test.ts` passes on main again: its negative control (around :239) no longer uses 12px as the "unrelated" literal now that T-0497 made 12px the card radius those panes really compute.

## Intent
- Do: confirm the test fails on main in both engines; read what the concentric assertions above it now expect after T-0497; change the negative control so it still proves those assertions are not vacuous (pick a literal neither pane computes, or assert against the pre-T-0497 concentric value) and update its title; keep the assertions above it unchanged unless they are also stale.
- Non-goals: radius tokens or any production CSS.
- Done when: the test file passes in both engines through `scripts/gate_lock.py`; the negative control fails when the literal is set to the value the panes actually compute (mutation noted); `npm run check` exits 0.

## Context
Found by the T-0506 solo: fails on main at 226589606, independent of T-0506. T-0497 (#2301) set demo figures and event logs to the card radius, 12px.

## Constraints
Tests only. No em dashes.
- Lane: solo because size L1 (steps.py lane)

## Outcome

2026-10-28 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 0008a066a97d
- Changed: The a2ui-live negative control uses a literal off the radius ramp, so it passes again on main
- Commits: none
- Check: 1 The test file passes in both engines through `scripts/gate_lock.py`: pass
- Check: 2 The negative control fails when the literal is set to the value the panes compute: pass
- Check: 3 `npm run check` exits 0: pass
- Follow-up: note: scripts/reap-scratch-clones.mjs selftest discovery count flaked... -> notes.md
