---
id: T-0360
title: "Live round 11: measure the round 10 fixes (PARSE array ask, showdown settles, natural skip, playing-card override, deal-again, poker deal) with fog analysis"
type: chore           # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-17
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A targeted live round measures whether the round 10 cluster fixes hold, archived with signals, judged checks where rubrics exist, and a fog analysis, so the next wave of tickets comes from evidence.

## Intent
- Do: plan the round from tags with `scripts/e2e-admin/probe/scenarios/plan.ts` (the regression cells that cover round 10's clusters A to E plus the T-0350 settled-table and T-0357 hold'em opening paths; Haiku and Sonnet as round 10 did), run it with `run-capped.ts --cap 10 --round 2026-10-18-r11-targeted`, run `npm run eval:signals -- --round 2026-10-18-r11-targeted --against 2026-10-17-r10-targeted --min-samples 1`, run `npm run eval:judge -- run --round 2026-10-18-r11-targeted --cap 1` for the personas with rubrics, write the round's `report.md` (per-cluster verdict against round 10, new clusters with trace lines), and file one ticket per new cluster with `tickets.py new`.
- Non-goals: fixing anything found; editing any earlier round archive (finished records are never rewritten).
- Done when: the round folder exists with ledger under $10, signals.md, judged/ output, report.md, and the fog analysis id recorded in report.md; `npm run check` exits 0.
- If Do needs more steps than this level allows (L1-L2 3, L3 6, L4 10, L5 15), file two tickets.

## Context
Kim approved round 11 at about $10 (2026-10-17, long-run rulings in `.sdlc/notes/notes.md`). Round 10 archive and report: `.sdlc/evals/rounds/2026-10-17-r10-targeted/`. Fixes since: T-0344 (#2110), T-0346 (#2107), T-0347 (#2109), T-0348 (#2108), T-0354 (#2125), T-0350 (#2122), T-0357 (when merged). The fog analysis uses the user skill context-fog-of-war on the round's trace.

## Constraints
Live spend only under the cap; keys checked by HTTP status only; never read or print .env. Never edit an earlier round archive.

## Acceptance criteria
1. `test -f .sdlc/evals/rounds/2026-10-18-r11-targeted/signals.md && test -d .sdlc/evals/rounds/2026-10-18-r11-targeted/judged && test -f .sdlc/evals/rounds/2026-10-18-r11-targeted/report.md`
2. `python3 -c "import json,sys; d=json.load(open('.sdlc/evals/rounds/2026-10-18-r11-targeted/round.json')); sys.exit(0 if d['totals']['costUsd'] < 10 and d['cap'] == 10 else 1)"`
3. `grep -q 2b3686ac6ec777c349cb5600 .sdlc/evals/rounds/2026-10-18-r11-targeted/report.md`
4. `npm run check`
5. No earlier round archive changes: `git diff --quiet 8421bba99 HEAD -- .sdlc/evals/rounds/2026-10-17-r10-targeted .sdlc/evals/rounds/2026-10-18-smoke`

## Outcome

2026-10-18 · lane: full L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 8421bba9988a
- Changed: Live round 11 measured the round 10 fixes; archive 2026-10-18-r11-targeted (#2140)
- Commits: none
- Check: 1 round folder has signals.md, judged/, report.md: pass
- Check: 2 ledger under the $10 cap: pass
- Check: 3 fog id in report.md: pass
- Check: 4 `npm run check`: pass
- Check: 5 no earlier round archive changed: pass
- Check: 6 Goal: new clusters spot-checked: pass
- Check: 7 Goal: tickets T-0367 to T-0371: pass
- Check: 8 Goal: cleanup of the 3 stray smoke runs touched nothing of round 11: pass
- Follow-up: note: .sdlc/evals/rounds/2026-10-18-r11-targeted/report.md says "PARSE... -> notes.md
- Follow-up: note: tickets.py check warns that T-0189, T-0349, T-0350, T-0354 and... -> notes.md
