---
id: T-0128
title: "Admiral preset: the board is one BoardGrid with actionName, not a Grid of cell Buttons"
type: feature        # feature | bug | chore | spike | idea
status: done
size: L2
priority: P2
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-13
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
T-0081 (#1935) made the A2UI renderer forward a control's own action event, so BoardGrid's actionName sends {row, col} on a cell click. The Admiral (battleship style) preset still builds its board as a Grid of cell Buttons.

## Scope (one brief paragraph, per the Inner loop rule)
Find the Admiral preset or persona under packages/agent-ui/a2ui/src (catalog personas, examples, seeds, prompts and any fixture or corpus record that carries its board) and rebuild the board as one BoardGrid with actionName, the cell click arriving as an A2UI action with {row, col}; keep the game behaviour and the turn flow identical, update its tests, seeds and prompt guidance (watch the K6 prompt budget, 46,430), and regenerate agent assets and the registry projection with their scripts. Evidence: a screenshot of the board at 400 and 1000px before and after in the ticket folder, viewed. Local gate: npm run check plus the touched folders' tests (browser files through gate_lock.py; a golden only with '<file> --update', the file filter before the flag, and only after viewing it). Regenerate generated files with their scripts, never by hand. Root is n 5 / 6 / 7 (heights 20 / 24 / 28). Two other lanes are running: stay out of the shell, page chrome and container CSS (T-0121) and out of control padding, badge, checkbox and scripts/generate-foundations.mjs (T-0122). Commit locally, do not push, no per-ticket verifier, no em dashes, report in one short message with exit codes.

## Closed

2026-10-13: merged (see queue-f1 log PR)
