---
id: T-0292
title: "The 'What services could I add' oracle still expects ServiceCard after T-0279 ruled a priced services list ProductCard"
type: chore           # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
The "What services could I add for the rest of my stay?" oracle agrees with Kim's T-0279 ruling.

## Intent
- Do: change the step's expect in `scripts/e2e-admin/probe/scenarios/concierge.ts` facilities-then-tour from ServiceCard to ProductCard (and its `expectComponents`), regenerate every live-commands.sh that carries it, and pin it in the scenarios test.
- Non-goals: any prompt, skill or catalog change.
- Done when: `npx vitest run scripts/e2e-admin/probe/scenarios` and `npm run check` exit 0.

## Context
`.sdlc/evals/rounds/2026-10-15-r5-fixes/` trace :130: Sonnet draws a ProductCard grid of spa treatments and tours, which is what T-0279 ruled for a priced, bookable services list; `regress-concierge-facilities-then-tour-sonnet-1` fails on this step alone. Haiku draws a Card with a DescriptionList (:62). T-0285 kept ServiceCard here ("for a service or agent to open"), but the step asks for bookable services. Fog report `4095416195875afe423e60ea`, decision d4, finding f5. If Kim prefers ServiceCard, the ticket becomes a skill change instead; ask first.

## Constraints
The frozen round folders keep their own commands and fixtures.

## Ruling (Kim, 2026-10-16)
ProductCard. Priced, bookable add-on services ("What services could I add for the rest of my stay?") follow the T-0279 ruling: one ProductCard each with its price and a Book action. Change the scenario oracle; no skill change.
