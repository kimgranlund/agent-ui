---
id: T-0403
title: "The concierge and restaurant personas and the concierge booking-confirmed exemplar settle a booking in place with ConfirmReceipt, not a BookingConfirmation read-back"
type: chore           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-22
claimed_by: claude:a8ce3b21 2026-10-22
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
No persona text or persona exemplar still steers a confirmed booking toward a BookingConfirmation read-back on agent-ui--hospitality: the concierge and restaurant personas and the concierge confirm-turn exemplar teach the settle in place (one ConfirmReceipt, status the literal "confirmed", data bound to the draft), matching grammar G2b and T-0397/T-0401.

## Intent
- Do: reword the read-back clauses in site/agent-content/personas/concierge/agent.md (:65 "with the confirmation reading back exactly what was submitted", :69 "settle it as the booking confirmation reading back what the form holds") and site/agent-content/personas/restaurant/agent.md (:39 "reading back the submitted values"), each with a seedVersion bump and a migration line in the history list; move the persona-concierge-booking-confirmed exemplar (packages/agent-ui/a2ui/src/examples/persona-exemplars.ts:107, :180-192) to a ConfirmReceipt settle in place.
- Non-goals: a2ui-basic--hospitality (BookingConfirmation stays there); grammar.md; the composite-moments and checks.ts text (T-0401).
- Done when: `git grep -n "reading back" -- site/agent-content/personas packages/agent-ui/a2ui/src/examples` finds no booking read-back on an agent-ui persona; `node scripts/generate-agent-content.mjs --check`, `npm run check`, the touched folders' tests and the whole jsdom suite exit 0; prompt-equivalence baseline moved only through the deliberate flow in skill a2ui-prompt-authoring.
- If Do needs more steps than this level allows (L1-L2 3, L3 6, L4 10, L5 15), file two tickets.

## Context
Split from T-0401 (conductor ruling under Kim's 2026-10-21 overnight goal; plan-reviewer-L1 goal-coverage finding). Model-read text: follows the debate rule (Opus architect, then fable plan-reviewer) before a solo applies it. The confirm-receipt wording to echo is grammar.md G2b (:108-113) and the T-0401 settleInPlace repair in packages/agent-ui/a2ui/src/catalog/domains/hospitality/checks.ts. If the exemplar is a judged corpus record, rejudge it through a2ui-review-agent before admission.

## Constraints
grammar.md is byte-pinned. Never rewrite .sdlc/evals/rounds. No em dashes.
- Lane: solo because size L2 (steps.py lane); overnight goal 2026-10-21

## Debate
- Architect ask (2026-10-22): write the exact replacement wording for the three persona clauses (concierge agent.md :65 and :69, restaurant agent.md :39), each persona's seedVersion bump and history line and any migration the bump needs, and the moved persona-concierge-booking-confirmed exemplar (its description and message stream), echoing grammar G2b and the T-0401 settle-in-place repair; name every pin, digest, budget and baseline that moves, whether the exemplar is a judged corpus record (and so needs a rejudge), and the risks. Verify the wording fits each persona's prompt budget.
- Plan-reviewer ask (2026-10-22): challenge architect-L1.md: is the base-neutral plain-words wording strong enough to steer a ConfirmReceipt settle on agent-ui and still correct on a2ui-basic; does the exemplar's Column-wrapped ConfirmReceipt match grammar G2b and the T-0401 repair; is the CATALOG_COVERAGE_EXEMPT entry the right call versus keeping a BookingConfirmation seed on agent-ui; are all moving pins named. Replay it and report pass, replan or blocked.
- Debate outcome 2026-10-22: the architect (architect-L1.md) and the fable reviewer (plan-reviewer-L1.md, pass, replayed green on origin/main) agree on the base-neutral plain-words persona clauses, concierge v24 and restaurant v8, the Column-wrapped ConfirmReceipt exemplar and the CATALOG_COVERAGE_EXEMPT entry for agent-ui--hospitality BookingConfirmation.

## Acceptance criteria
- `git grep -n "reading back" -- site/agent-content/personas packages/agent-ui/a2ui/src/examples` exits 1 (no hits).
- `env -u NODE_OPTIONS node scripts/generate-agent-content.mjs --check` exits 0.
- `env -u NODE_OPTIONS npm run check` exits 0.
- The touched folders' tests exit 0: `env -u NODE_OPTIONS npx vitest run packages/agent-ui/a2ui/src/examples site/pages/agent-admin-app.test.ts site/pages/agent-admin-seed-digests.test.ts site/pages/agent-admin-presets.test.ts site/pages/agent-admin-prompt-budget.test.ts site/lib/agent-manifest site/agent-content site/lib/a2ui-catalog-selector.test.ts packages/agent-ui/a2ui/src/live-agent/prompt-equivalence.test.ts`.
- The persona clauses, changelog lines, exemplar and coverage exemption match architect-L1.md Interfaces byte for byte; `prompt-equivalence.baseline.json` is unchanged.

## Outcome

2026-10-22 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 55d814a16507
- Changed: Concierge (v24) and restaurant (v8) personas teach the booking settle in place in plain words; the persona-concierge-booking-confirmed exemplar settles as a Column-wrapped ConfirmReceipt; agent-ui--hospitality BookingConfirmation coverage-exempt
- Commits: none
- Check: 1 `git grep -n "reading back" -- site/agent-content/personas packages/agent-ui/a2ui/src/examples` e...: pass
- Check: 2 `env -u NODE_OPTIONS node scripts/generate-agent-content.mjs --check` exits 0: pass
- Check: 3 `env -u NODE_OPTIONS npm run check` exits 0: pass
- Check: 4 touched folders' vitest set exits 0: pass
- Check: 5 persona clauses, changelog lines, exemplar and coverage exemption match architect-L1.md Interface...: pass
- Follow-up: note: site/agent-content/personas/concierge/agent.md:65 carries an em... -> notes.md
