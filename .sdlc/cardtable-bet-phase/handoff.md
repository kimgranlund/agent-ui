---
id: T-0088
title: "CardTable: the betting phase of a hand (chips plus stepper, phase prop, Deal)"
type: feature        # feature | bug | chore | spike | idea
status: done     # proposed | ready | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-12
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The Croupier CardTable covers the whole hand lifecycle, including the betting step: at the start of a hand the player sets the bet with chips plus a stepper and presses Deal; during play the bet is read-only; after settlement the result shows and a new hand can start.

## Intent
- Do: add a `phase` prop (betting | playing | settled; default playing so existing payloads are unchanged). In `betting`: hide the hands' zones' cards (or show empty felt), show a bet control built from the library controls: a row of chip buttons (10, 25, 50, 100 as the default; the agent may pass `chips`), a number stepper (ui-text-field type=number, min 1, max bankroll, step 5) for exact amounts, a Clear action, and the bankroll readout. The bet value is two-way bound: the CardTable gets a value mark on `bet` (event `change`, readProp like QuestionCard's a2uiQuestionValue) so the agent's data model carries the chosen bet. The Deal action is a child Button (as the other actions are) the factory leaves enabled only when 1 <= bet <= bankroll (use the Button `checks` / required mechanism if it fits, else the factory sets `disabled` on the first action when out of range; say which). In `playing` the bet shows read-only in the readout and Double is available; in `settled` show the result line (winner, delta) the existing result prop carries, if any, and a new-hand action child.
- Non-goals: split, insurance, side bets; a new control; changing the PlayingCard.
- Done when: a CardTable in each phase renders and behaves (jsdom through the real renderer plus a real-engine geometry test for the betting row at 36px lg buttons and ADR-0046 spacing); chips add to the bet and cannot exceed the bankroll; the bound bet reaches the data model on change; Deal is disabled out of range; the card-layout and game-table-chrome mini-skills and the croupier preset's round-loop teach the lifecycle (bet, deal, play, settle) with the phase prop and a seeded croupier preset seedVersion bump; seeds for betting and settled phases on both bases; every-catalog coverage gate green; K6 under 46,430 (report the number); screenshot of each phase viewed, in the ticket folder.

## Context
Kim 2026-10-12: 'for CardTable black-jack etc we need to incorporate the bet input that occurs in a certain step in the game lifecycle'; chosen input: chips plus stepper. Files: packages/agent-ui/a2ui/src/catalog/personas/croupier/{catalog.json,factories.ts,checks.ts,selection.json,card-table.test.ts,checks.test.ts}, personas/box-region.ts and action-row.ts (T-0084 and T-0083 helpers: keep action buttons direct children, lg size), seeds in src/examples/persona-exemplars.ts, teaching in src/agent/prompts/mini-skills/{card-layout,game-table-chrome}.md and site/pages/agent-admin-presets.ts (croupier), manifest site/lib/agent-manifest/croupier.manifest.json (seedVersion bump is a hand edit, digest by the writer AGENT_MANIFEST_WRITE=1). The hand-check arm (HAND_BINDING, HAND_COUNT) must keep working in every phase. Record the new props as an appended Amendment on ADR-0243 (append-only). Wait for T-0084 (gutters, PR #1906) to merge first: it edits the same croupier factory. Lessons from today: match the approved look with a screenshot pair; ADR-0046 spacing; no border-left; 36px lg buttons; repo Inner loop rule: npm run check plus touched folders' tests locally, CI runs the full suite.

## Constraints
Existing CardTable payloads (no phase prop) render and behave exactly as before. Props additive only. No em dashes.

## Closed

2026-10-12: merged #1917
