---
id: T-0574
title: "Drill transitions follow dir=rtl, the leak-gate title is accurate, and the dark primary-high tone is settled"
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
Three small leftovers are closed: drill's opt-in View Transitions slide follows dir=rtl, the status-stream leak-gate test title says what it tests, and dark `primary-high` is either kept equal to the hover tone with a stated reason or moved one stop with numbers.

## Intent
- Do: (1) `packages/agent-ui/components/src/controls/drill/drill.css` View Transitions layer (about lines 341 to 356) mirrors under rtl like the CSS-transform slide (T-0539), with a browser test that fails on base (dropped: plan defect, see Plan review); (2) rename the status-stream case in `packages/agent-ui/components/src/leak-gate.browser.test.ts` ("not re-armed on reconnect with no running entry" arms a running entry, T-0541 note); (3) T-0567 left dark `primary-high` at the same 350 stop as `primary-hover` in seven packs: check whether any control shows them together, and report or adjust within AA.
- Done when: touched tests and `npm run check` exit 0.

## Constraints
No em dashes. No paid runs. Browser tests through scripts/gate_lock.py.
- Lane: solo because size L1 (steps.py lane)

## Plan review
- plan defect: step 1: drill has no View Transitions slide (no `::view-transition-*` rule for drill; under `[data-vt-active]` the platform cross-fade runs with no horizontal motion), and the CSS-transform slide was already mirrored by T-0539 and is covered by `drill.browser.test.ts`; part 1 is dropped, conductor 2026-10-29.

## Outcome

2026-10-29 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 11d20e79fa13
- Changed: The status-stream leak-gate test title is accurate; drill needs no View Transitions mirror and the dark primary-high tone stays equal to hover
- Commits: none
- Check: 1 Done when: touched tests and `npm run check` exit 0 (part 1 dropped by the conductor's Plan revie...: pass
- Follow-up: note: part 3 is a report with no token change; dark primary-high is 400... -> notes.md
