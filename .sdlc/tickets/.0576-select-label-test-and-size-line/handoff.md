---
id: T-0576
title: "The Select undeclared-label test asserts the label, and measure-size drops a stray line"
type: chore           # feature | bug | chore | spike | idea
status: done
size: L1
priority: P3
depends: []
created: 2026-10-29
claimed_by: claude:a8ce3b21 2026-10-29
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
Two small defects from the T-0573 notes triage are fixed.

## Intent
- Do: (G1) in `packages/agent-ui/a2ui/src/renderer/renderer.test.ts` (the aria-label span assertion near line 436), assert that `ui-select`'s `label` stays empty when the payload sends an undeclared label, so the test fails if the prop is applied; (G2) delete the stray `packageEntryOver` read at `scripts/measure-size.mjs:467`, which runs before its `let` at about line 1247 and would throw on the control-count failure path.
- Done when: G1's new assertion fails with the T-0552 allow-list reverted and passes on main; the a2ui renderer tests, `node scripts/measure-size.mjs selftest` and `npm run check` exit 0.

## Constraints
No em dashes. No paid runs. No budget changes.
- Lane: solo because size L1 (steps.py lane)

## Outcome

2026-10-29 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: b7dea60d460a
- Changed: The Select undeclared-label test asserts the label stays empty, and measure-size drops a stray read
- Commits: none
- Check: 1 G1 new assertion fails with the T-0552 allow-list reverted and passes on main: pass
- Check: 2 G2 stray `packageEntryOver` read removed: pass
- Check: 3 a2ui renderer tests, `node scripts/measure-size.mjs selftest`, `npm run check` exit 0: pass
