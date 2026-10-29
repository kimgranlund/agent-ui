---
id: T-0561
title: "The composer popups follow dir=rtl"
type: chore           # feature | bug | chore | spike | idea
status: done
size: L1
priority: P3
depends: [T-0538]
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
The conversation-composer's two popups align to the logical start and end under dir=rtl, like the other overlays.

## Intent
- Do: pass the `rtl` argument T-0538 added to `computePosition` at both composer call sites; add an RTL browser test for each popup.
- Non-goals: the overlay trait itself (T-0538 owns it).
- Done when: the new tests fail on base and pass after; the app conversation tests and `npm run check` exit 0.

## Context
T-0538 (PR 2345) made overlay placement logical through a new `rtl` argument on `computePosition` (`components/src/traits/overlay.ts`). Its verifier noted: `packages/agent-ui/app/src/controls/conversation/conversation-composer.ts:1329` and `:1572` call `computePosition` without it, so the composer popups stay physical under rtl.

## Constraints
No em dashes. No paid runs. Browser tests through scripts/gate_lock.py. Starts after PR 2345 merges.
- Lane: solo because size L1 (steps.py lane)

## Outcome

2026-10-28 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 387b335bfaa1
- Changed: The conversation-composer popups align to the logical start and end under dir=rtl
- Commits: none
- Check: 1 The new tests fail on base and pass after: pass
- Check: 2 The app conversation tests exit 0: pass
- Check: 3 `npm run check` exits 0: pass
- Check: 4 Both composer call sites pass the rtl argument: pass
