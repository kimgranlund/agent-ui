---
id: T-0303
title: "Live round 7: rerun round 6's 11 fails plus Haiku long flows ($6 cap)"
type: chore           # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0296, T-0297, T-0298, T-0299, T-0300, T-0301, T-0302]          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-16
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
Confirm live that the round 6 fixes hold: T-0296 (surrender ResultCard), T-0297 (case-insensitive surface id), T-0298 plus T-0301 (forced render_surface with thinking off on Haiku repair rounds), T-0299 (last-round FEED_SCOPE and binding composite findings), T-0300 (LONE_BUTTON_FRAME), T-0302 (earlier-round fallback instead of a SURFACE_DROPPED halt).

## Approval
Kim 2026-10-16: "Then run round 7 on the fails" (estimate about $3 to $5); cap $6. Live calls use the main checkout's `.env` (never read or print it).

## Scope
- A round 7 generator beside `round6.ts` (pinned by a test): round 6's 11 failing runs (same scenario, model and sample) plus every Haiku long flow, one run each. Order cheapest first.
- Phase 1: generator, `.sdlc/evals/rounds/<today>-r7-fails/live-commands.sh`, `run-capped.ts --describe` and `--cap 6 --dry-run`; report the run command (`--round r7-fails`), counts and expected spend, and stop. The conductor runs the round; phase 2 follows.

## Phase 2
Read `~/.claude/skills/context-fog-of-war/SKILL.md` fresh from disk and follow its routing table and Autonomous run checklist on your own. Report `.sdlc/evals/rounds/<date>-r7-fails/report.md`: per fix ticket fixed live, partly or still failing with trace cites; new tallies seen (FEED_SCOPE_RESCOPED, EARLIER_ROUND_SHIPPED, LONE_BUTTON_FRAME, RESULT_CARD_MISSING); spend; any new cluster with a cause class and a why-and-fix row; whether Haiku output truncation at max_tokens recurs (round 6 :170 hit 4096 at medium). If the skill's contract audit mode (`scripts/audit.py`) is present and its updates-log entry says verified, run `audit.py link` for each failing cluster and cite the contract surfaces. Publish the hydrated fog report and record its id. A `## Skill notes` section lists any step the ticket, not the skill, had to supply. Useful fails become keyless replays.

## Constraints
No prompt or code fixes in this ticket. Screenshots stay out of the repo.

## Done when
- The round folder holds traces, ledger, round.json, runs/, README and report.md with the per-ticket verdict table; spend at or under $6.
- The fog report is published and its id recorded.
- `tickets.py check` and `npm run check` exit 0.

## Acceptance criteria
- `test -f .sdlc/evals/rounds/2026-10-16-r7-fails/report.md -a -f .sdlc/evals/rounds/2026-10-16-r7-fails/README.md -a -f .sdlc/evals/rounds/2026-10-16-r7-fails/round.json -a -f .sdlc/evals/rounds/2026-10-16-r7-fails/ledger.jsonl -a -d .sdlc/evals/rounds/2026-10-16-r7-fails/traces -a -d .sdlc/evals/rounds/2026-10-16-r7-fails/runs` exits 0 (the round folder is complete).
- `python3 -c "import json,sys; sys.exit(0 if json.load(open('.sdlc/evals/rounds/2026-10-16-r7-fails/round.json'))['totals']['costUsd'] <= 6 else 1)"` exits 0 (spend at or under $6).
- `grep -q '^## Round 6 fixes, live' .sdlc/evals/rounds/2026-10-16-r7-fails/report.md` exits 0, and that table gives T-0296 to T-0302 each a verdict with trace cites.
- `python3 -c "import json,sys; r=json.load(open('.sdlc/evals/fog/2026-10-16-r7-fails.json')); sys.exit(0 if len(r['reportId']) == 24 and r['round'] == '2026-10-16-r7-fails' else 1)"` exits 0, and `library.py list` holds that report id.
- `npx vitest run scripts/e2e-admin/probe` exits 0 (round 7 generator pin and the two round 7 replays).
- `npm run check` exits 0.
