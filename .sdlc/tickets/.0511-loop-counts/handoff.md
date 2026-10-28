---
id: T-0511
title: "Assert-in-loop tests assert their item count first"
type: chore           # feature | bug | chore | spike | idea
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
Each assert-in-loop test (M2) asserts how many items it iterates before the loop, so an empty selection fails instead of passing.

## Intent
- Do: add `expect(items.length).toBe(n)` or `toBeGreaterThan(0)` (exact count where the fixture fixes it) before each loop.
- Non-goals: production code.
- Done when: each changed test fails with an empty selection (mutation noted); `npm run check` and the touched tests (browser through `scripts/gate_lock.py`) exit 0.

## Context
From the T-0508 weak-test sweep (#2311), findings copied here:

M2. Zero-iteration loops: the whole claim sits inside a loop over `querySelectorAll` with no count asserted, so an empty render passes.
- `packages/agent-ui/components/src/controls/command-modal/command-modal.test.ts:219` (ids on options)
- `packages/agent-ui/components/src/controls/playing-card/playing-card.test.ts:208` (index text)
- `packages/agent-ui/components/src/controls/select/select.test.ts:306` (group aria-labelledby)
- `packages/agent-ui/components/src/controls/select/select.test.ts:778`, `combo-box/combo-box.test.ts:1289,1312` (aria-selected all false)
- `packages/agent-ui/app/src/controls/agent-admin/agent-admin.test.ts:201` (absence of `data-availability` on rows: empty list or broken render both pass)
- `packages/agent-ui/app/src/controls/super-shell/super-shell-bar-seam.browser.test.ts:340` (corner radii)
- `packages/agent-ui/components/src/controls/amount-picker/amount-picker.browser.test.ts:168` (preset chip height)
- `packages/agent-ui/components/src/controls/suggestions/suggestions.browser.test.ts:92-98` (gap only checked for same-row pairs; a fully wrapped layout checks nothing)
- `site/pages/table-doc.browser.test.ts:53` (no width cap on specimen tables)
Why vacuous: `for (x of [])` asserts nothing. Fix: `expect(list.length, 'anti-vacuous').toBe(<n>)` (or `toBeGreaterThan(0)`) before each loop; for suggestions count the same-row pairs measured.
Proposed ticket: "Anti-vacuous counts before ten assert-in-loop tests".

## Constraints
Tests only. No em dashes. No paid runs.
- Lane: solo because size L1 (steps.py lane)

## Outcome

2026-10-28 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 0008a066a97d
- Changed: Assert-in-loop tests assert their item count first, so an empty selection fails
- Commits: none
- Check: 1 Each M2 assert-in-loop test asserts its item count before the loop (exact where the fixture fixes...: pass
- Check: 2 Each changed test fails with an empty selection (mutation): pass
- Check: 3 `npm run check` exits 0: pass
- Check: 4 Touched tests exit 0: pass
- Follow-up: note: no em dashes in added lines the em dashes in the diff context are... -> notes.md
