---
id: T-0458
title: "Live quality round 14 measures the round 13 fixes against the round 13 baseline"
type: spike           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0456, T-0457]          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-25
claimed_by: claude:a8ce3b21 2026-10-25
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
A round 14 archive under `.sdlc/evals/rounds/` measures the same matrix as round 13 against its baseline, reports pattern-wave reach per control, and files its failure clusters as proposed tickets, the way rounds 3 to 13 ran.

## Context
Round 13: `.sdlc/evals/rounds/2026-10-24-r13-pattern/` (69 Haiku runs, 52 pass, $0.67). Its clusters became T-0448 to T-0453, all merged; T-0457 and T-0456 land first so this round measures them.

## Constraints
Live spend under the round cap. Never rewrite a finished round archive. Model-read text changes are not in scope; clusters become tickets.

## Done when
- The round 14 archive holds the report, traces and churn against round 13.
- Each failure cluster is one proposed ticket.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
- The round 14 archive is complete and under the cap: `jq -e '.totals.runs == 69 and .stop == "done" and .totals.costUsd < 12' .sdlc/evals/rounds/2026-10-26-r14-pattern/round.json`
- The archive holds the report, traces, ledger and commands: `test -s .sdlc/evals/rounds/2026-10-26-r14-pattern/report.md -a -s .sdlc/evals/rounds/2026-10-26-r14-pattern/traces/2026-10-26.jsonl -a -s .sdlc/evals/rounds/2026-10-26-r14-pattern/ledger.jsonl -a -s .sdlc/evals/rounds/2026-10-26-r14-pattern/live-commands.sh`
- The report carries churn against round 13 and per-control reach: `grep -q '^## Churn against round 13' .sdlc/evals/rounds/2026-10-26-r14-pattern/report.md && grep -q '^## Pattern wave reach' .sdlc/evals/rounds/2026-10-26-r14-pattern/report.md`
- No em dash in the report: `! grep -q $'—' .sdlc/evals/rounds/2026-10-26-r14-pattern/report.md`
- No finished round archive changed: `git diff --quiet HEAD -- .sdlc/evals/rounds/2026-10-24-r13-pattern`

## Outcome

2026-10-25 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: ba3ab730de4b
- Changed: Live round 14 measures the round 13 fixes: 64 of 69 Haiku runs pass against round 13's 52, for 0.65 USD
- Commits: none
- Check: 1 Round 14 archive complete and under the cap: pass
- Check: 2 Archive holds report, traces, ledger, commands: pass
- Check: 3 Report carries churn and reach sections: pass
- Check: 4 No em dash in the report: pass
- Check: 5 No finished round archive changed: pass
- Follow-up: note: report.md:87-88 says "None filed by this round" and names the... -> notes.md
- Follow-up: note: the observed 64 of 69 passed 5 failed against round 13's 52 pass... -> notes.md
