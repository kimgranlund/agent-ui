---
id: T-0285
title: "Concierge facility-hours turns never draw ServiceCard: facility-info-card is index-only and the loaded persona asks for a compact info surface"
type: bug             # feature | bug | chore | spike | idea
status: proposed     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
One ruled composite for a Concierge facility-hours answer, taught where the model sees it, with the scenario oracles agreeing.

## Repro
`.sdlc/evals/rounds/2026-10-15-r4-fixes/`: the facility turns that expect ServiceCard, traces :11, :15, :81, :134, :138, :153 ("Which restaurants and bars does the hotel have?", "When do the pool and gym close?", "What are the opening hours of the pool, gym and spa?"). Keyless: `npm run chat:probe -- --replay 2026-10-15-r4-fixes/runs/regress-concierge-facilities-then-tour-sonnet-1/fixture.json`.

## Expected
The facility answer draws the composite the oracle names, on every model.

## Actual
None of the 6 turns draws ServiceCard: Haiku answers in prose (:11, :81) or carries a BookingForm over (:15); Sonnet answers in prose (:134) or ships a Card with a DescriptionList (:138, :153). No check fires. `regress-concierge-facilities-then-tour-sonnet-1` fails on this turn alone.

## Context
Fog report `ffe6d0ef720852da99edbff0`, decision d1, finding f2 (T-0275 decision analysis). `facility-info-card` (`site/pages/agent-admin-libraries.ts:137`, "ONE ServiceCard per facility") is `load: index-only` on every one of these turns, so only its one-line description reaches the model. The always-loaded persona `surfaceStyle` (`site/pages/agent-admin-presets.ts:332`) says "Facts (hours, directions, policies) -> a compact info surface", which matches what Sonnet draws (a guess: the trace records the persona section size, not its text). The oracles are `scripts/e2e-admin/probe/scenarios/concierge.ts:26, 36, 44` and `routing.ts:86, 90`. T-0279 (services, ruled ProductCard) keeps ServiceCard for "a service or agent to open" and does not cover facility hours. Found by T-0275.

## Constraints
The failing test lands before or with the fix, never after. Needs a ruling first (ServiceCard per facility, or a DescriptionList info surface), like T-0279.

## Done when
- Kim rules the facility-hours composite; the persona `surfaceStyle`, the `facility-info-card` skill and the scenario oracles agree.
- The ruled composite is taught in loaded context (a mini-skill or a composite-moment row), with a test that fails on the other composite.
- `npx vitest run scripts/e2e-admin/probe/scenarios` and `npm run check` exit 0.
