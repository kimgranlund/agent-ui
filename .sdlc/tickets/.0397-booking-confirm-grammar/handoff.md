---
id: T-0397
title: "grammar.md and the confirm-receipt mini-skill teach the booking settle in place; concierge probe scenarios expect ConfirmReceipt"
type: chore           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0395]         # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-21
claimed_by: claude:a8ce3b21 2026-10-22
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
The producer's grammar and the confirm-receipt mini-skill teach the same booking confirm the workflows now teach (T-0385, T-0390): the BookingForm is the confirm step and a ConfirmReceipt settles in place with a literal "confirmed" status; and the concierge probe scenarios expect what the workflow teaches.

## Intent
- Do:
  1. `packages/agent-ui/a2ui/src/agent/prompts/grammar.md` (about lines 83-87, the booking ConfirmReceipt with status bound to a path holding "pending" and the settle arm about lines 102-107) and `prompts/mini-skills/confirm-receipt.md:6`: reconcile with the booking settle in place, keeping the pending read-back for a receipt surface with no BookingForm (cart-summary, trip-plan), through the debate rule.
  2. `scripts/e2e-admin/probe/scenarios/concierge.ts` (about lines 28, 39, 52, 66 and the `expectComponents` at 31, 43, 55, 68): the confirm turns expect ConfirmReceipt, not BookingConfirmation.
- Non-goals: other flows; the live probe run itself (live spend is Kim's call).
- Done when: the wording is settled by the debate rule (Opus architect, fable plan-reviewer) before it is applied; a deliberate prompt-equivalence recapture; pins in system-prompt-grammar.test.ts and mini-skills.test.ts; `npm run check`, the a2ui prompt tests, the probe scenario typecheck or selftest, and the whole jsdom suite once exit 0.

## Context
- Raised by the T-0385 plan reviewer and verifier (2026-10-22); see `.sdlc/tickets/.0385-site-agent-content-workflows-booking/handoff.md` and `.sdlc/notes/notes.md`. Filed by hand because tickets.py 0.25.1 marks a follow-up starting with a path as a duplicate (sdlc-lite T-0675).
- Depends on T-0395 landing first (it also edits grammar.md).
- Decided by the conductor under Kim's 2026-10-21 overnight goal.

## Constraints
- grammar.md is byte-pinned: the debate rule and a deliberate recapture; both prompt budgets hold; no em dashes.
- Lane: solo because size L2 (steps.py lane); overnight goal 2026-10-21

## Debate: booking confirm in grammar and the mini-skill
Ask (architect, debate rule): propose exact replacement text for grammar.md's booking ConfirmReceipt clause (about lines 83-87) and its settle arm (about 102-107), and for mini-skills/confirm-receipt.md:6, so a booking with a BookingForm confirms with the form and settles in place with a literal "status":"confirmed" (as booking-flow and table-reservation now teach, T-0385/T-0390), while a receipt surface with no BookingForm (cart-summary, trip-plan) keeps its pending read-back. Re-check against confirm-receipt.ts, widget.ts, the two workflows and the T-0384/T-0386/T-0395 grammar lines. For each span give before text with line numbers, after text and why; measure both prompt budgets and the mini-skill budget; list pins and dependents (system-prompt-grammar.test.ts, mini-skills.test.ts, baseline keys, library digests); no em dashes. Also give the exact probe scenario changes for scripts/e2e-admin/probe/scenarios/concierge.ts (confirm turns expect ConfirmReceipt). Write no file except your result.

Ask (plan-reviewer, debate rule): review the architect's wording in `.sdlc/runtime/tasks/0397-booking-confirm-grammar/architect-L1.md` as the second voice. Is "a booking collected in a BookingForm" the right discriminator (travel composes hospitality but keeps trip-plan's read-back)? Are the G-spans and the mini-skill span unambiguous to a model and consistent with the two workflows, confirm-receipt.ts and widget.ts? Is the `asArchivedBookingConfirmation` archive transform the right way to keep finished round pins byte-identical (T-0398, in flight, adds a similar transform to the same routing.ts for the concierge-to-hospitality relabel)? Check budgets, pins, digests and em dashes. Verdict pass or replan, with any exact wording fixes.
- Debate outcome 2026-10-22: the architect (architect-L1.md) and the fable reviewer (plan-reviewer-L1.md, pass) agree. Grammar G1, G2a, G2b and mini-skill M land as written, with the concierge probe changes, the asArchivedBookingConfirmation transform, the pins, the recapture, and a deliberate budget re-measure.

## Acceptance criteria
verifier: L3
- grammar.md carries G1, G2a and G2b and mini-skills/confirm-receipt.md:6 carries M exactly as architect-L1.md gives them; the two existing settle arms stay verbatim.
- concierge.ts confirm turns and expectComponents expect ConfirmReceipt; `asArchivedBookingConfirmation` maps them back on concierge lines and wraps every round byte pin (round, round3 to round10), composed with T-0398's `asArchivedConciergeDomain`; nothing under `.sdlc/evals` changes.
- New pins in system-prompt-grammar.test.ts (B2) and mini-skills.test.ts (confirm-receipt); prompt-equivalence baseline recaptured; assets.gen.ts regenerated; prompt budgets re-measured (BASE 147 700, DERIVED 148 700, RE-MEASURED T-0397 notes); LIBRARIES_DIGEST re-pinned; meta-line-vocabulary.md and composition-patterns.md repaired.
- `env -u NODE_OPTIONS npm run check` exit 0
- `env -u NODE_OPTIONS npx vitest run --project packages packages/agent-ui/a2ui` exit 0
- `env -u NODE_OPTIONS npx vitest run --project scripts scripts/e2e-admin/probe` exit 0
- `env -u NODE_OPTIONS npx vitest run site/pages/agent-admin-seed-digests.test.ts` exit 0
- `env -u NODE_OPTIONS npx vitest run` exit 0 (whole jsdom suite, once)
- Conductor: verify the spans landed exactly as debated, the recapture moved only the expected keys, the budget re-measure follows the rule, the archive transforms keep .sdlc/evals byte-identical, and the pins bite. Run npm run check, the a2ui and probe tests and the whole jsdom suite once.

## Outcome

2026-10-22 · lane: solo L2 · verdict: pass · verifier: verifier-L3 (fable) · base: 2b2103365eff
- Changed: grammar.md and the confirm-receipt mini-skill settle a BookingForm booking in place with a literal confirmed ConfirmReceipt; concierge probes expect ConfirmReceipt (debated)
- Commits: 1484e9d T-0397: grammar and the confirm-receipt mini-skill settle a BookingForm booking in place; concierge probes expect ConfirmReceipt (debated)
- Check: 1 grammar.md carries G1, G2a and G2b and mini-skills/confirm-receipt.md:6 carries M exactly as arch...: pass
- Check: 2 concierge.ts confirm turns and expectComponents expect ConfirmReceipt; `asArchivedBookingConfirma...: pass
- Check: 3 New pins in system-prompt-grammar.test.ts (B2) and mini-skills.test.ts (confirm-receipt); prompt-...: pass
- Check: 4 `env -u NODE_OPTIONS npm run check` exit 0: pass
- Check: 5 `env -u NODE_OPTIONS npx vitest run --project packages packages/agent-ui/a2ui` exit 0: pass
- Check: 6 `env -u NODE_OPTIONS npx vitest run --project scripts scripts/e2e-admin/probe` exit 0: pass
- Check: 7 `env -u NODE_OPTIONS npx vitest run site/pages/agent-admin-seed-digests.test.ts` exit 0: pass
- Check: 8 `env -u NODE_OPTIONS npx vitest run` exit 0 (whole jsdom suite, once): pass
- Check: 9 Conductor: verify the spans landed exactly as debated, the recapture moved only the expected keys...: pass
- Follow-up: note: scripts/e2e-admin/probe/scenarios/routing.ts:78-92... -> notes.md
