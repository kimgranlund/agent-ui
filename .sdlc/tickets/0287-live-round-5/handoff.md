---
id: T-0287
title: "Live round 5: rerun round 4's 26 failed runs plus Concierge and Lexicographer long flows ($15 cap)"
type: chore           # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0276, T-0277, T-0278, T-0279, T-0281, T-0282, T-0283, T-0285, T-0286]          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
Round 5 measures whether the round 4 fixes (T-0276 to T-0286) hold live: every round 4 run that failed is rerun on the same model, plus Concierge and Lexicographer long flows.

## Approval
Kim 2026-10-16: "run 5th test when ready". Same shape and cap as round 4: rerun round 4's 26 failed runs plus the Concierge (booking, spa services as ProductCard, facility hours as a compact info card) and Lexicographer long flows on Haiku and Sonnet, spend cap $15 (the runner stops at $15 whatever is queued). Runs after every depends ticket merges. Live calls use the main checkout's `.env` (never read or print it).

## Scope
- The 26 failed runs from `.sdlc/evals/rounds/2026-10-15-r4-fixes/` (ledger.jsonl verdict fail), same scenario and model, regenerated from the current generators (T-0277 Swedish massage, T-0283 stud, T-0279 and T-0285 oracles).
- Long flows on Haiku and Sonnet: Concierge booking through confirmation, spa services (ProductCard per treatment), facility hours (compact info card), Lexicographer opening through give-up.
- A round 5 generator beside `round4.ts` (pinned by a test); `run-capped.ts --describe` and `--cap 15 --dry-run`. Phase 1 stops and reports the run command; the conductor runs the round; phase 2 writes the report.

## Report
`.sdlc/evals/rounds/<date>-r5-fixes/report.md`: per round 4 fix ticket fixed live, partly or still failing; check fire and save rates against round 4; the cheapest passing model per preset against rounds 3 and 4; routing-expect misses; spend. Then the context-fog-of-war decision analysis as round 4 did it: cluster the fails by root cause, hydrate decisions, guidance edges and findings with exact excerpts and event ids, classify each cluster (exposure, conflicting guidance, model ignored clear guidance, check or scenario defect), a `## Why it failed and how to fix it` table, publish and record the report id. One proposed ticket per uncovered cluster; useful fails become keyless replays.

## Constraints
Screenshots go to the evidence cache, never the repo. No prompt or code fixes in this ticket.

## Done when
- The round folder holds traces, ledger, round.json, runs/, README and report.md with the why-and-fix table; spend at or under $15.
- The hydrated fog report is published and its id recorded.
- `tickets.py check` and `npm run check` exit 0.

## Acceptance criteria
verifier: L3
- `npx vitest run scripts/e2e-admin/probe` exits 0: `round5.test.mjs` pins the round to the round 4 ledger fails, and the four new replays pin today's behavior.
- `npm run check` exits 0.
- `python3 /Users/kimgranlund/.claude/plugins/cache/sdlc-lite/sdlc-lite/0.24.0/scripts/tickets.py check` exits 0.
- `python3 -c "import json; d=json.load(open('.sdlc/evals/rounds/2026-10-15-r5-fixes/round.json')); assert d['stop']=='done' and d['totals']['runs']==29 and d['totals']['costUsd']<=15"` exits 0.
- `grep -q 4095416195875afe423e60ea .sdlc/evals/fog/2026-10-15-r5-fixes.json` and `grep -q 4095416195875afe423e60ea .sdlc/evals/rounds/2026-10-15-r5-fixes/README.md` exit 0.
- `.sdlc/evals/rounds/2026-10-15-r5-fixes/report.md` holds `## Why it failed and how to fix it` with one row per cluster A to F, each naming a class, a fix file, a keyless test and a ticket.
