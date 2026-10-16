---
id: T-0275
title: "Live round 4: rerun round 3's 31 failed runs plus Concierge and Lexicographer long flows ($15 cap)"
type: chore           # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0258, T-0265, T-0274]          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
Round 4 measures whether the round 3 fixes (T-0262 to T-0274, T-0258) hold live: every round 3 run that failed is rerun on the same model, plus Concierge and Lexicographer long flows.

## Approval
Kim approved 2026-10-15: rerun round 3's 31 failed runs plus Concierge and Lexicographer long flows on Haiku and Sonnet, spend cap $15 (the runner stops at $15 whatever is queued). Wait for T-0258, T-0265 and T-0274 to merge first. Live calls use the main checkout's `.env` (never read or print it).

## Scope
- The 31 failed runs from `.sdlc/evals/rounds/2026-10-15-r3-routing/` (ledger.jsonl verdict fail), same scenario and model, with oracles regenerated from the current generators (T-0270 doc-only, T-0272 stud fixes).
- Long flows on Haiku and Sonnet: a full Concierge booking through confirmation (expects a pre-filled BookingForm and one BookingConfirmation, T-0266), a spa services ask (ServiceCard, T-0267), and a Lexicographer game from opening through a give-up (word board on the opening, ResultCard on the give-up, T-0268 and T-0274).
- Write these as a round 4 generator beside `round3.ts` (pinned by a test), check with `run-capped.ts --describe` and `--cap 15 --dry-run`. Phase 1 stops there and reports the run command; the conductor runs the round; phase 2 writes the report.

## Report
`.sdlc/evals/rounds/<date>-r4-fixes/report.md`: per fix ticket fixed live, partly or still failing; check fire and save rates against round 3; the cheapest passing model per preset against round 3; routing-expect misses with causes; spend. Ingest and publish the context-fog-of-war report and record its id. Draft one proposed ticket per real failure and turn useful failures into keyless replays.

## Constraints
Screenshots go to the evidence cache, never the repo. No prompt or code fixes in this ticket: it measures and files.

## Done when
- The round folder holds traces, ledger, round.json, runs/, README and report.md; spend at or under $15.
- The fog report is published and its id recorded.
- Every real failure has a proposed ticket; `tickets.py check` and `npm run check` exit 0.
