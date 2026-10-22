---
id: T-0401
title: "Retire the remaining BookingConfirmation confirm-turn expectations: the composite-moments repair hint and the probe routing oracles"
type: chore           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0397]         # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-22
claimed_by: claude:a8ce3b21 2026-10-22
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
Nothing still steers or checks a hotel or table booking's confirm turn toward a BookingConfirmation read-back now that the grammar and workflows settle a BookingForm booking in place with a ConfirmReceipt (T-0385, T-0390, T-0397).

## Intent
- Do:
  1. `packages/agent-ui/a2ui/src/catalog/composite-moments.ts` (about 213-229) and `packages/agent-ui/a2ui/src/catalog/domains/hospitality/checks.ts` (about 151-158): the repair text that sends a no-surface confirm turn toward "a BookingConfirmation reading back the values on the open BookingForm" matches the settle in place. Repair text is model-read, so the wording goes through the debate rule (Opus architect, fable plan-reviewer).
  2. `scripts/e2e-admin/probe/scenarios/routing.ts` (about 78-92), `round3.ts` (about 126-129), `round4.ts` (about 78-81): the concierge confirm-turn oracles expect ConfirmReceipt; finished round archives stay byte-identical (use the existing archive transforms).
- Non-goals: retiring the BookingConfirmation catalog type itself.
- Done when: the composite-moments, hospitality checks and probe tests, the probe selftest, `npm run check` and the whole jsdom suite once exit 0; nothing under `.sdlc/evals` changes.

## Context
- Raised by the T-0397 solo and verifier (2026-10-22). T-0399 (#2195) already made a literal confirmed ConfirmReceipt answer the booking-confirmation repair.
- Depends on T-0397 landing first. Decided by the conductor under Kim's 2026-10-21 overnight goal.

## Constraints
- Model-read repair text through the debate rule; finished run records never rewritten; no em dashes.
- Lane: solo because size L2 (steps.py lane); overnight goal 2026-10-21

## Debate: confirm-turn repair text
Ask (architect, debate rule): propose exact replacement text for the model-read repair strings in `packages/agent-ui/a2ui/src/catalog/composite-moments.ts` (about 213-229, the BookingConfirmation row's cue) and `packages/agent-ui/a2ui/src/catalog/domains/hospitality/checks.ts` (about 151-158) so a no-surface confirm turn is repaired toward the settle in place (the BookingForm's wrapper child becomes ONE ConfirmReceipt with a literal "status":"confirmed"), matching grammar.md after T-0397 and the two workflows; keep anything a2ui-basic--hospitality still needs (ConfirmReceipt is absent there, T-0399). Also give the exact probe oracle changes for routing.ts, round3.ts and round4.ts with the archive transforms that keep `.sdlc/evals` byte-identical. For each span give before text with line numbers, after text and why; list tests and pins; no em dashes. Write no file except your result.

Ask (plan-reviewer, debate rule): review the architect's design and wording in `.sdlc/runtime/tasks/0401-booking-confirmation-leftovers/architect-L1.md` as the second voice. It goes beyond wording: a new `unless` negative catalog gate in semantic-check.ts and a twin check for a2ui-basic--hospitality, because the repair-text vocabulary gate reds a repair naming a type a ridden catalog lacks. Is that mechanism the smallest sound fix (versus, say, catalog-aware message templates), and does it keep a2ui-basic--hospitality's repair byte-identical? Is the settle-in-place repair text unambiguous and consistent with grammar.md post T-0397 (including the root-type re-create case)? Are the probe oracle changes right with the existing archive transform, nothing under .sdlc/evals changing? Check pins, tests and em dashes. Verdict pass or replan, with any exact fixes.
- Debate outcome 2026-10-22: the architect (architect-L1.md) and the fable reviewer (plan-reviewer-L1.md, pass, replayed green) agree on the `unless` gate, the settle-in-place repair, the byte-identical a2ui-basic twin and the probe oracle moves. Conductor ruling under the overnight goal: the Goal narrows to the Do; the concierge and restaurant persona read-back lines and the persona-concierge-booking-confirmed exemplar go to a follow-up ticket (each needs a seedVersion bump and its own debate). The new confirm probe uses a wrapper-root session so it reads the updateComponents arm.

## Acceptance criteria
- On agent-ui--hospitality the confirm SURFACE_MISSING repair asks for the settle in place (one updateComponents on a wrapped form's surface, or the root form's surface re-created under its id) with ONE ConfirmReceipt and a literal "status" "confirmed", and names no BookingConfirmation: `env -u NODE_OPTIONS npx vitest run --project packages packages/agent-ui/a2ui/src/catalog packages/agent-ui/a2ui/src/live-agent` exits 0.
- a2ui-basic--hospitality keeps the T-0289 read-back byte-identical through `concierge-basic-surface-required`, gated `unless` ConfirmReceipt, and the T-0314 vocabulary gate stays green with `KNOWN_VOCABULARY_GAPS` empty (same command).
- The routing, round 3 and round 4 concierge confirm oracles expect ConfirmReceipt, routing-pack.sh is regenerated, and the archive pins hold: `env -u NODE_OPTIONS npx vitest run --project scripts scripts/e2e-admin/probe` exits 0 and `git status --short .sdlc/evals` prints nothing.
- `env -u NODE_OPTIONS node scripts/chat-probe.mjs selftest`, `npm run check` and the whole jsdom suite (`env -u NODE_OPTIONS npx vitest run`) exit 0.

## Outcome

2026-10-22 · lane: solo L2 · verdict: pass · verifier: verifier-L3 (fable) · base: 55d814a16507
- Changed: Semantic checks gain an unless gate; the hospitality confirm repair and composite-moments ask settle a booking in place with one ConfirmReceipt on agent-ui, a byte-identical twin keeps a2ui-basic's read-back; probe oracles expect ConfirmReceipt
- Commits: none
- Check: 1 On agent-ui--hospitality the confirm SURFACE_MISSING repair asks for the settle in place with ONE...: pass
- Check: 2 a2ui-basic--hospitality keeps the T-0289 read-back byte-identical through `concierge-basic-surfac...: pass
- Check: 3 The routing, round 3 and round 4 concierge confirm oracles expect ConfirmReceipt, routing-pack.sh...: pass
- Check: 4 `env -u NODE_OPTIONS node scripts/chat-probe.mjs selftest`, `npm run check` and the whole jsdom s...: pass
