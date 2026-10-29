---
id: T-0551
title: "The r15-recheck round folder holds the live-commands.sh its report names"
type: chore           # feature | bug | chore | spike | idea
status: done
size: L1
priority: P2         # P1 | P2 | P3
depends: []
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
`.sdlc/evals/rounds/2026-10-27-r15-recheck/live-commands.sh` exists and holds the 12-command extract the folder's report.md (lines 14 and 44) and round.json `liveCommands` already name, so that round's Reproduce line runs.

## Intent
- Do: rebuild the 12 commands from the round's own records (round.json runs, the ledger) in the same format as the other rounds' `live-commands.sh`; add only that file. Kim approved adding this one missing file to the finished archive 2026-10-28; nothing else in the folder changes.
- Non-goals: running the commands (paid).
- Done when: the file exists with 12 commands matching round.json's runs; `git diff --quiet HEAD -- .sdlc/evals/rounds/2026-10-27-r15-recheck` shows only the added file (`git status` lists it as new); `npm run check` exits 0.

## Context
Found by the T-0549 notes triage (notes.md line 986, from T-0483).

## Constraints
Add one file only. No em dashes. No paid runs.
- Lane: solo because size L1 (steps.py lane)

## Outcome

2026-10-28 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 8808a8218e21
- Changed: The r15-recheck round folder holds the live-commands.sh its report names
- Commits: none
- Check: 1 the file exists with 12 commands matching round.json's runs: pass
- Check: 2 `git diff --quiet HEAD -- .sdlc/evals/rounds/2026-10-27-r15-recheck` shows only the added file: pass
- Check: 3 `npm run check` exits 0: pass
