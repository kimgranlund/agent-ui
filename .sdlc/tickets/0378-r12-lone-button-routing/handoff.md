---
id: T-0378
title: "The lone-Button rule never reaches poker Deal again turns (round 12 cluster O)"
type: bug             # feature | bug | chore | spike | idea
status: ready     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P3         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-18
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
On poker Deal again turns, the composed prompt carries the one-Button rule (a lone action Button with no Row), so the one-child Row stops shipping.

## Intent
- Do: route the rule to the turns that miss it. Conductor call 2026-10-19 after the debate: the rule lives in the croupier persona Surface style (agent.md:60, v16 to v17), per architect-L1.md, which the fable plan-reviewer passed. 11 of 12 lone-Row turns loaded `game-hud` only or no mini-skill; candidates are a clause in `prompts/mini-skills/game-hud.md`, or a keyless check. Model-read text: debate rule (Opus architect, fable plan-reviewer).
- Non-goals: card-game-sheet and game-table-chrome (T-0375 already fixed them).
- Done when: a composed-prompt test shows the r12 :57 turn's prompt holds the one-Button rule; the prompt-equivalence test stays green with no recapture (no mini-skill changes; the persona is not in the baseline), and the croupier seed digest, PRESETS_DIGEST, manifest seedDigest and seedVersion move through the deliberate seed-change flow; `npm run check` exits 0.

## Context
Round 12 archive `.sdlc/evals/rounds/2026-10-19-r12-targeted/` (report.md "Why it failed and how to fix it", fog report 6bae5f5b20e6a9741951dd4a). Trace lines `:n` are 1-based lines of its `traces/2026-10-19.jsonl`. Kim chose to ticket this cluster on 2026-10-19. Cluster O: 12 turns in 8 runs (five-card-draw 7, Omaha 3, hold'em 2) send `actions` Row > `againBtn`; grammar.md:188 says a lone action carries no Row.

## Constraints
Debate rule for any model-read text. grammar.md changes only by Kim's ruling.
