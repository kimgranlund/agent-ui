---
id: T-0507
title: "The theme-provider built CSS fixture is regenerated so it carries the 12px card radius"
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
`site/lib/__fixtures__/theme-provider-built.css` matches what the current build emits, including the 12px card radius from T-0497, instead of the old concentric calc.

## Intent
- Do: find how the fixture is produced (see `site/lib/theme-provider-build-fixture.test.ts` and `theme-provider-build.browser.test.ts`), regenerate it with that path, and confirm the fixture tests still pass; if the fixture test does not catch drift, report that.
- Non-goals: theme-provider source changes.
- Done when: the fixture no longer holds the pre-T-0497 radius calc; `npm run check` and the theme-provider fixture tests exit 0.

## Context
T-0497 verifier note: the fixture still holds the old concentric calc; a built file, not source.

## Constraints
Regenerate, do not hand-edit, unless the fixture has no generator (then say so in the report). No em dashes.
- Lane: solo because size L1 (steps.py lane)

## Outcome

2026-10-28 · lane: solo L1 · verdict: closed by reason (already fixed by T-0497 (#2301): the fixture already carries the 12px card radius, regen reports fresh) · verifier: none · base: 97e49c89b1b1
- Changed: see commits
- Commits: none
