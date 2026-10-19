---
id: T-0376
title: "Live round 12: measure the round 11 wave (T-0345, T-0359, T-0363, T-0367 to T-0371)"
type: chore           # feature | bug | chore | spike | idea
status: proposed     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
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
4. Every fix in scope has a measured verdict in the report: `python3 -c "import sys; t=open('.sdlc/runtime/tasks/0376-live-round-12/solo-report.md').read(); sys.exit(0 if all(('| ' + k + ' ') in t for k in ['T-0345','T-0359','T-0363','T-0367','T-0368','T-0369','T-0370','T-0371','T-0375']) and '6bae5f5b20e6a9741951dd4a' in t else 1)"`
5. `npm run check`
6. No earlier round archive changes: `git diff --quiet 97fe7a8d2 HEAD -- .sdlc/evals/rounds/2026-10-18-r11-targeted .sdlc/evals/rounds/2026-10-18-smoke`
