---
id: T-0296
title: "Admiral: a surrender ends with one ResultCard beside the revealed board"
type: feature        # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-16
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A battleship surrender ends like a normal game end: one ResultCard (the loss, shots, a Play again action) with the revealed board kept beside it (Kim's ruling 2026-10-16, `.sdlc/notes/notes.md`).

## Context
Round 6 cluster A (`.sdlc/evals/rounds/2026-10-15-r6-matrix/report.md`, `## Why it failed and how to fix it`): all three models reveal the fleet on the board and ship no ResultCard (:112, :298, :484). The board-grid End state only says "when a fleet is sunk"; no mini-skill is framed on the surrender turn. Cause (b) ambiguous guidance with (a) exposure.

## Scope
The board-grid End state in `site/pages/agent-admin-libraries.ts` (and the always-indexed description line if the rule must reach the model there) names a surrender or concession; the Admiral persona text if needed (no catalog type names in persona text, the modality lint); a RESULT_CARD_MISSING check that fires on a concession turn. Flip `scripts/e2e-admin/probe/replays/admiral-surrender-board-reveal.test.mjs` to expect the check firing (repaired round AUTHORED proves mechanics only).

## Done when
- The replay and the new check's test exit 0, each red at the base.
- `site/pages/agent-admin-presets.test.ts`, the manifest drift test (`site/lib/agent-manifest`, bump seedVersion and regenerate if the seed changes) and `npm run check` exit 0.

## Lane bundle
- T-0296 Admiral: a surrender ends with one ResultCard beside the revealed board (`.sdlc/tickets/0296-admiral-surrender-result-card`)
- T-0300 A settled table frames Deal again alone in a Card: a LONE_BUTTON_FRAME check (`.sdlc/tickets/0300-lone-button-frame`)
