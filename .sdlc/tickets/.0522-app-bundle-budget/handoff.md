---
id: T-0522
title: "The @agent-ui/app root bundle fits its size budget again (61071 vs 59925 B gz)"
type: bug             # feature | bug | chore | spike | idea
status: done
size: L2
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
`node scripts/measure-size.mjs` reports the `@agent-ui/app` root row within its budget again (measured 61071 B gz against 59925 on main, found by the T-0521 solo).

## Intent
- Do: confirm the overrun on main; find what grew (bisect the row's history or diff the bundle's module list against the commit where it last fit); cut the growth if it is an unintended import on the default barrel (move it behind a subpath or a lazy import), otherwise raise the budget with a dated reason comment in measure-size.mjs, following the existing comment precedent there (around :205 and :265).
- Non-goals: other rows (a separate sweep covers them).
- Done when: the app root row is within budget with the cause named in the report; `npm run check` and the tree-shake tests exit 0; any budget change carries its reason.

## Context
measure-size.mjs is the consumer-budget and tree-shake gate (`npm run size`). Budgets live as `[label, entry, budget]` rows near :40.

## Constraints
No public export removed without stating it in the report. No em dashes.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
verifier: L3
- The app root row is within its budget: `node scripts/measure-size.mjs 2>&1 | grep -q '^@agent-ui/app \. .* within budget (62141 B gz)'` (the script's own exit stays 1 on the other rows, the T-0523 sweep's scope).
- The re-base carries its dated reason: `grep -q 'RE-BASED 2026-10-28 (T-0522' scripts/measure-size.mjs`
- `npm run check`
- `npx vitest run packages/agent-ui/components/src/controls/tree-shake.test.ts packages/agent-ui/app/src/catalog-lazy.bundle.test.ts`

## Plan review
- ruling: Kim 2026-10-28 approved raising APP_MARGINAL_BUDGET 59925 -> 62141 (ADR-0197 cl.5 confirmation).

## Outcome

2026-10-28 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 7ec42c1856cb
- Changed: The @agent-ui/app root budget is re-based to 62141 B gz for reviewed feature weight, per Kim's ADR-0197 confirmation
- Commits: none
- Check: 1 App root row within budget: pass
- Check: 2 Dated reason present: pass
- Check: 3 `npm run check`: pass
- Check: 4 tree-shake and catalog-lazy bundle tests: pass
- Follow-up: decide: scripts/measure-size.mjs:779 the budget raise is an unattended... -> notes.md
