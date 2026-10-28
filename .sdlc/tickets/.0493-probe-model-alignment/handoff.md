---
id: T-0493
title: "foundations-probe reads its expected geometry from foundations-model.mjs, so it stops flagging a correct tree"
type: chore           # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P3         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
`node scripts/foundations-probe.mjs --strict` exits 0 on the current tree because its expected values come from the same model the generator uses.

## Context
Found by T-0488 (F1). The probe reports 21 of 48 rows mismatched, all stale expectations: ui-button md pad 4 inset 4 r 8 measured vs 8 / 6 / 16 expected; text-field, select, textarea md r 8 vs 16; toggle r 8 vs 16; otp cell r 4 vs 8; multi-select r 10. The measured values are the T-0374 model's (radius h/2 x 0.5, button pad (q - 2)n/4, label inset gutter 2 + compensation 2). Cause: `scripts/foundations-probe.mjs` CLASSES hard-codes the Amendment 5 pill `2 * r.n` and reads margin and label inset from `packages/agent-ui/shared/src/tokens/scale.mjs` instead of `scripts/lib/foundations-model.mjs`. Probe output: /private/tmp/claude-501/-Users-kimgranlund-Projects-nonoun-agent-ui/a8ce3b21-c0a4-4e5f-b099-1796666e5f7f/scratchpad/0488-shots/probe.txt

## Constraints
Point the probe's CLASSES at `foundations-model.mjs` (resolve(), radiusAmounts()). Report whether repo `scale.mjs` tiers are still read by anything else; do not retire them here. Do not change generated CSS. No em dashes.

## Acceptance criteria
- `node scripts/foundations-probe.mjs --strict` exits 0 on this tree.
- A planted wrong expectation (one CLASSES value changed) makes `--strict` exit non-zero, reverted after.
- `npm run check` exits 0.
- Lane: solo because size L2 (steps.py lane)

## Outcome

2026-10-28 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: c01455b8045c
- Changed: foundations-probe reads its expected geometry from foundations-model.mjs, so --strict passes on a correct tree
- Commits: none
- Check: 1 `node scripts/foundations-probe.mjs --strict` exits 0 on this tree: pass
- Check: 2 A planted wrong expectation makes `--strict` exit non-zero: pass
- Check: 3 `npm run check` exits 0: pass
- Follow-up: note: the builder reported which tiers of the repo scale.mjs are still... -> notes.md
