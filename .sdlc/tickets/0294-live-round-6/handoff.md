---
id: T-0294
title: "Live round 6: full matrix, every preset on Haiku, Sonnet and Opus ($20 cap)"
type: chore           # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0289, T-0290, T-0292, T-0293]          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A clean scorecard after five rounds of fixes: every shipped preset (Croupier, Concierge, Lexicographer, Admiral) on Haiku, Sonnet and Opus, across their round scenarios and long flows, with the routing pack.

## Approval
Kim 2026-10-16: full matrix, spend cap $20 (the runner stops at $20 whatever is queued; order Haiku, then Sonnet, then Opus so the cap drops Opus first). Runs after the round 5 Concierge lane merges. Live calls use the main checkout's `.env` (never read or print it).

## Scope
- A round 6 generator beside `round5.ts` (pinned by a test): every scenario from the current generators (`concierge.ts`, `croupier.ts`, the Lexicographer and Admiral scenarios, `routing.ts`, the long flows) on all three models, one run each.
- `run-capped.ts --describe` and `--cap 20 --dry-run`. Phase 1 stops and reports the run command and count; the conductor runs the round; phase 2 writes the report.

## Report
`.sdlc/evals/rounds/<date>-r6-matrix/report.md`: a preset by model pass-rate matrix with rounds 3 to 5 for comparison; the cheapest model that passes each preset; per round 5 fix ticket (T-0289 to T-0293, T-0291) fixed live, partly or still failing; check fire and save rates; routing-expect misses; spend. Then the context-fog-of-war decision analysis as rounds 4 and 5 did it: cluster fails by root cause with exposure chains, hydrate decisions, guidance edges and findings, classify each cluster, a `## Why it failed and how to fix it` table, publish and record the report id. One proposed ticket per uncovered cluster; useful fails become keyless replays.

## Constraints
Screenshots go to the evidence cache, never the repo. No prompt or code fixes in this ticket.

## Done when
- The round folder holds traces, ledger, round.json, runs/, README and report.md with the matrix and the why-and-fix table; spend at or under $20.
- The hydrated fog report is published and its id recorded.
- `tickets.py check` and `npm run check` exit 0.
