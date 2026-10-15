---
id: T-0261
title: "Live round 3: routing pressure pack, round 2 regressions, long flows ( cap)"
type: chore           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0260]          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
Round 3 measures whether the round 2 fixes hold with real models, where routing goes wrong under pressure, and which model is good enough per preset; it files a ticket for every real failure.

## Approval
Kim approved 2026-10-15: run round 3, spend cap $20 (the runner stops at $20 whatever is queued). Live calls use the main checkout's `.env` (never read or print it).

## Scope
- A. The routing pressure pack: `scripts/e2e-admin/probe/scenarios/routing-pack.sh` (T-0260), 12 runs.
- B. Round 2 regressions: from `.sdlc/evals/rounds/2026-10-15-r2-presets/` (report.md, ledger, live-commands.sh), every scenario that failed, rerun on the model it failed on plus Haiku. Cover T-0214, T-0229, T-0230, T-0231, T-0232, T-0233, T-0234, T-0236, T-0238, T-0240 and T-0253 at least once each. About 20 runs.
- C. Long flows on Haiku, Sonnet and Opus: a full croupier hand (deal, bet, hit, stand, deal again) and a full Concierge booking through confirmation. About 6 runs, with `--expect-routing` oracles where useful.
- Write B and C as a scenario generator beside the existing ones (pinned by a test like `routing.test.mjs`), combine with the pack into one `live-commands.sh`, check it with `run-capped.ts --describe`, then run `run-capped.ts <file> --cap 20 --round 2026-10-15-r3-routing`.

## Report
`.sdlc/evals/rounds/2026-10-15-r3-routing/report.md`:
- pass rate per round 2 fix (fixed live, partly, still failing);
- per new check (NEW_ROUND_NOT_BETTING, MOVES_MISSING, ACTION_NOT_APPLIED, NARRATED_MECHANICS, hidden state, composite moments): how often it fired, how often the repair round saved the turn, the extra cost;
- per preset, the cheapest model that passes;
- routing-expect misses with their cause, read from the trace `routing` and `events` blocks;
- spend from the ledger.
Then ingest the round folder with context-fog-of-war (`engineer.py ingest` with `.sdlc/evals/fog-manifest.json`), `fog.py validate`, `library.py publish`, and record the report id in `.sdlc/evals/fog/<round>.json` and the round README (`--describe`). Draft one bug ticket per real failure (new handoff folders via tickets.py new, status proposed) and turn each failing live run into a keyless replay where it helps.

## Constraints
Screenshots go to the evidence cache (T-0256), never the repo. No prompt or code fixes in this ticket: it measures and files.

## Done when
- The round folder holds traces, ledger.jsonl, round.json, runs/ (reports and fixtures), README and report.md; spend is at or under $20.
- The fog report is published and its id recorded.
- Every real failure has a proposed ticket; `tickets.py check` and `npm run check` exit 0.

## Outcome

2026-10-15 · lane: full L2 · verdict: closed by reason (Round 3 done: 44 runs, $14.38; report, fog report c8da0f95748fb8e6be9038ea, tickets T-0262 to T-0273; verifier L2 pass) · verifier: none · base: 041a20c3b6bb
- Changed: see commits
- Commits: 2f2cfd7 T-0261: round 3 tickets ready; T-0266 ruling (Kim); e890ce9 T-0261: live round 3 archive, report, fog record, 12 proposed tickets and 4 pinned replays; f0c9103 T-0261: seven-card-stud on all models and blackjack-rounds on Opus back in the regressions (44 runs); 5f43b6b T-0261: Lexicographer regression oracle on the first guess (the opening ranks no word board keyless); 79ff3d5 T-0261: round 3 generator (routing pack, round 2 regressions, long flows) and live-commands.sh; 04ebaff T-0261: file live round 3 ticket; T-0260 ticket archived
