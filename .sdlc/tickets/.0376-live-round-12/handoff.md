---
id: T-0376
title: "Live round 12: measure the round 11 wave (T-0345, T-0359, T-0363, T-0367 to T-0371)"
type: chore           # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0375]          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-18
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A live round measures the round 11 wave on Haiku, so each shipped fix is confirmed or reopened with evidence.

## Intent
- Do: plan the round with `scripts/e2e-admin/probe/scenarios/plan.ts --affected` over T-0345, T-0359, T-0363, T-0367 to T-0371 and T-0375; run it live; archive under `.sdlc/evals/rounds/`; fog analysis; a report comparing with round 11.
- Non-goals: fixes (each finding becomes its own ticket).
- Done when: the round archive and report exist and every fix in scope has a measured verdict.
- Live spend cap: $12 for the round, runs and judge together (Kim, 2026-10-18).

## Context
Kim chose a full round 12 on 2026-10-18. Round 11 cost $8.66; the long-run cap of $15 has about $5 left, so this round needs a new cap.

## Constraints
Spend stays under Kim's cap. Archives are never rewritten.

verifier: L3

## Acceptance criteria
1. `test -f .sdlc/evals/rounds/2026-10-19-r12-targeted/signals.md && test -d .sdlc/evals/rounds/2026-10-19-r12-targeted/judged && test -f .sdlc/evals/rounds/2026-10-19-r12-targeted/ledger.jsonl`
2. `python3 -c "import json,sys; d=json.load(open('.sdlc/evals/rounds/2026-10-19-r12-targeted/round.json')); sys.exit(0 if d['totals']['costUsd'] < 12 and d['cap'] == 12 and d['stop'] == 'done' else 1)"`
3. `grep -q 6bae5f5b20e6a9741951dd4a .sdlc/evals/fog/2026-10-19-r12-targeted.json`
4. Every fix in scope has a measured verdict in the report: `python3 -c "import sys; t=open('.sdlc/evals/rounds/2026-10-19-r12-targeted/report.md').read(); sys.exit(0 if all(('| ' + k + ' ') in t for k in ['T-0345','T-0359','T-0363','T-0367','T-0368','T-0369','T-0370','T-0371','T-0375']) and '6bae5f5b20e6a9741951dd4a' in t else 1)"`
5. `npm run check`
6. No earlier round archive changes: `git diff --quiet 97fe7a8d2 HEAD -- .sdlc/evals/rounds/2026-10-18-r11-targeted .sdlc/evals/rounds/2026-10-18-smoke`

## Outcome

2026-10-18 · lane: full L2 · verdict: pass · verifier: verifier-L3 (fable) · base: 97fe7a8d2d26
- Changed: Live round 12 measured the round 11 wave, $1.73 of $12 (#2159)
- Commits: none
- Check: 1 `test -f .../signals.md && test -d .../judged && test -f .../ledger.jsonl`: pass
- Check: 2 `round.json` costUsd < 12, cap == 12, stop == done: pass
- Check: 3 `grep -q 6bae5f5b20e6a9741951dd4a .sdlc/evals/fog/2026-10-19-r12-targeted.json`: pass
- Check: 4 every fix in scope has a measured verdict in report.md: pass
- Check: 5 `npm run check`: pass
- Check: 6 `git diff --quiet 97fe7a8d2 HEAD -- .sdlc/evals/rounds/2026-10-18-r11-targeted .sdlc/evals/rounds...: pass
- Follow-up: fix-now: .sdlc/evals/rounds/2026-10-19-r12-targeted/report.md:39 "r11 14 of... -> notes.md
- Follow-up: fix-now: report.md:33 "No earlier live baseline" for T-0363 is stale... -> notes.md
- Follow-up: fix-now: report.md:33 names ask-1 for all six openings; :200... -> notes.md
- Follow-up: decide: .sdlc/evals/README.md:31 attributes r12 to T-0343... -> notes.md
- Follow-up: note: report.md:5 "$0.58" is the judge log total; the 36 judged files sum... -> notes.md
