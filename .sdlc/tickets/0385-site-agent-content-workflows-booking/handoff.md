---
id: T-0385
title: "site/agent-content/workflows/booking-flow/WORKFLOW.md:12 settles..."
type: idea            # feature | bug | chore | spike | idea
status: claimed        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-20
claimed_by: claude:a8ce3b21 2026-10-21
from: T-0195
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
The concierge booking-flow settle names a confirmed state the flow can actually reach in one settle update, so a model following it never re-asks or sends two messages.

## Context
Follow-up from T-0195 (verifier notes):

`site/agent-content/workflows/booking-flow/WORKFLOW.md:12` settles with "exactly one updateComponents ... status bound to a path holding "confirmed"", but nothing in that flow writes "confirmed" to the draft (the confirm press is the BookingForm's, not a ConfirmReceipt's); a model following it literally either precedes it with an updateDataModel (two messages against grammar's one settle update) or renders a pending receipt with Back and Confirm (`confirm-receipt.ts:272-274`), the re-ask the task goal bars. The taught shape is right; the conductor's live `chat:probe` should watch this turn.

## Constraints
Model-read workflow text goes through the debate rule; no em dashes; seedVersion bumps re-pin digests.
- Lane: solo because size L2 (steps.py lane); overnight goal 2026-10-21

## Debate: booking and table settle wording (T-0385 with T-0390)
Bundled with T-0390 (`.sdlc/tickets/0390-site-agent-content-workflows-table/handoff.md`), decided by the conductor under Kim's 2026-10-21 overnight goal. The workflow bodies are model-read, so the wording goes through the debate rule (Opus architect, then fable plan-reviewer) before a solo applies it.

Ask (architect, debate rule): first re-check both premises against the current tree (T-0198 rewrote booking-flow onto a StepFlow; T-0386 changed the stale-affordance rule). Then propose exact replacement text so that (1) T-0385: the booking-flow settle names a reachable confirmed state (what writes "confirmed", in one settle update, never a pending re-ask), and (2) T-0390: table-reservation and booking-flow, both seeded on the concierge, agree on whether the BookingForm is the confirm step or a ConfirmReceipt read-back follows it, picking the one consistent shape with evidence from confirm-receipt, the hospitality BookingForm, and grammar.md. For each span give before text with line numbers, after text and why; no em dashes; list dependents (seedVersion bumps, digests, probe scenarios). If a premise no longer holds, say so and propose no edit for it. Write no file except your result.

Ask (plan-reviewer, debate rule): review the architect's wording in `.sdlc/runtime/tasks/0385-site-agent-content-workflows-booking/architect-L1.md` as the second voice. Weigh in particular: (1) the T-0385 settle as a literal `"status":"confirmed"` on the ConfirmReceipt in the closing updateComponents, against widget.ts, input.ts and confirm-receipt.ts; (2) the T-0390 decision to drop table-reservation's pending ConfirmReceipt read-back (added by T-0195, whose ConfirmReceipt adoption Kim approved for four presets) and settle in place instead: is the evidence strong enough to reverse that adoption, or should table-reservation keep a read-back and booking-flow change instead? (3) the new root Column wrapper on booking-flow's direct path. Check seed bumps, digests, probe scenarios and em dashes. Verdict pass or replan, with any exact wording fixes.
- Debate outcome 2026-10-22: the architect (architect-L1.md) and the fable reviewer (plan-reviewer-L1.md, pass) agree: the settle writes a literal "status":"confirmed" on the ConfirmReceipt in the closing updateComponents; table-reservation drops its pending read-back and settles in place; booking-flow's direct path roots a Column wrapper. The reviewer's notes land too (escaped quotes in changelog lines; spec.md:282 reworded). Follow-up: grammar.md:83-87 and mini-skills/confirm-receipt.md:6 still teach a pending ConfirmReceipt for a booking.

## Acceptance criteria
Covers T-0385 and T-0390 together (one diff). Wording is the debate-settled text in architect-L1.md spans B1, B2 and 3, with plan-reviewer-L1.md notes applied.
- [ ] booking-flow line 12 and table-reservation line 12 carry the architect's after text; concierge is version 23 and restaurant version 7, each with a new first changelog line holding no inner double quotes; spec.md:282 cites both workflows as confirm-then-settle, not a read-back: `env -u NODE_OPTIONS node scripts/generate-agent-content.mjs --check`
- [ ] seedVersion pins, persona digests and the presets and libraries digests are re-pinned; the booking-flow content pins stay green; the prompt budget holds: `env -u NODE_OPTIONS npx vitest run --project site site/pages/agent-admin-app.test.ts site/pages/agent-admin-seed-digests.test.ts site/pages/agent-admin-prompt-budget.test.ts site/agent-content site/lib/agent-manifest`
- [ ] the standing gate: `env -u NODE_OPTIONS npm run check`
