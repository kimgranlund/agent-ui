---
id: T-0504
title: "Tests pin the valid-round SURFACE_DROPPED and SURFACE_CLAIMED empty-round repairs, and the swatch value test stops passing when the part is absent"
type: chore           # feature | bug | chore | spike | idea
status: done
size: L1
priority: P2         # P1 | P2 | P3
depends: [T-0501]          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
Every empty-round repair path T-0501 added has a test that fails without it. (The swatch-guard half moved to T-0510.)

## Intent
- Do: in `packages/agent-ui/a2ui/src/live-agent/produce-empty-repair.test.ts`, add scripted-adapter cases for the valid-round SURFACE_DROPPED site and the SURFACE_CLAIMED site in `packages/agent-ui/a2ui/src/agent/produce.ts` (both set `forcedRepairPending`); show each fails when its `forcedRepairPending = true` line is removed.
- Non-goals: any production code change.
- Done when: the new cases pass and each one reds when its production line is removed (mutation shown in the report); `npm run check`, `npx vitest run packages/agent-ui/a2ui/src/live-agent/produce-empty-repair.test.ts` exit 0.

## Context
T-0501 verifier note (produce.ts valid-round SURFACE_DROPPED and SURFACE_CLAIMED sites untested); T-0495 verifier note (text-field-geometry.browser.test.ts:870 guard lets an absent part pass). Run browser tests through `scripts/gate_lock.py`.

## Constraints
Tests only. No em dashes.
- Lane: solo because size L1 (steps.py lane)

## Plan review
- conductor: rerun after T-0501 (#2307) merged; lane rebased onto it; swatch half dropped (done by T-0510).

## Outcome

2026-10-28 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 833bd7dd69a1
- Changed: A test pins the valid-round SURFACE_DROPPED empty-round repair, so every T-0501 repair site now reds when removed
- Commits: none
- Check: 1 Scripted-adapter cases for the valid-round SURFACE_DROPPED site and the SURFACE_CLAIMED site exis...: pass
- Check: 2 `npx vitest run packages/agent-ui/a2ui/src/live-agent/produce-empty-repair.test.ts` exit 0: pass
- Check: 3 `npm run check` exit 0: pass
- Check: 4 No production code change: pass
