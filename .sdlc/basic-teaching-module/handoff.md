---
id: T-0077
title: "a2ui-basic teaching module: move dialect rules from a seed comment into a mini-skill, recapture baseline"
type: chore           # feature | bug | chore | spike | idea
status: done     # proposed | ready | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-12
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Give the a2ui-basic catalog its own teaching: a mini-skill carrying the dialect rules (Button child Text, event actions, array value) that today live only in a seed header comment.

## Intent
- Do: add a mini-skill for a2ui-basic under the prompt mini-skills registry (catalogId a2ui-basic), move the rules out of basic-exemplars.ts header comment, recapture the prompt baseline once via the a2ui-prompt-authoring flow.
- Non-goals: new components; changing the default catalog teaching.
- Done when: a2ui-basic turns select the mini-skill (test), the baseline is recaptured once, check and npm test exit 0, K6 bound holds.

## Context
Source: legacy catalog audit 2026-10-12. Files: packages/agent-ui/a2ui/src/agent/prompts/mini-skills/, src/agent/mini-skills.ts, src/examples/basic-exemplars.ts (line ~15). Skill: a2ui-prompt-authoring. W0 (merged soon) made derived ids inherit their base; a2ui-basic ids carry no --, unchanged.

## Constraints
Prompt baseline recapture only through the deliberate flow, once. No em dashes.

## Closed

2026-10-12: Merged in #1895; second verifier pass
