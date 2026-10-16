---
id: T-0319
title: "Live round 8: full matrix after the round 6 and 7 fixes and the routing review ($42 cap)"
type: chore           # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-16
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A full before and after against round 6 (`.sdlc/evals/rounds/2026-10-15-r6-matrix/`) on every preset and model, after the round 6 and 7 fixes (T-0296 to T-0305), the settings pane (T-0306), the stale-surface sweep (T-0307) and the routing architecture review rulings (T-0308 to T-0314, T-0316, T-0317).

## Approval
Kim 2026-10-16: full matrix, $42 cap. Live calls use the main checkout's `.env` (never read or print it).

## Scope
- Phase 1: a round 8 generator reusing round 6's 87 runs (same scenarios, models, order: Haiku, Sonnet, Opus), pinned by a test; `.sdlc/evals/rounds/<today>-r8-matrix/live-commands.sh`; `--describe` and `--cap 42 --dry-run`; report the command (`--round r8-matrix`), counts and expected spend, and stop.
- Phase 2, read `~/.claude/skills/context-fog-of-war/SKILL.md` fresh from disk and follow its checklist on your own; use the committed audit mapping (`.sdlc/evals/fog/contract-audit/`) and `audit.py link` per cluster; the trace now carries stopReason, maxTokens and prompt-section digests (T-0311), so use them.

## Report
`report.md`: the preset by model pass-rate matrix against rounds 6 and 7; per ticket fixed live, partly, not exercised or regressed (T-0296 to T-0317); the T-0310 measurement (round-1 render_surface calls on Haiku click turns against round 7's 12 no-tool round-1 calls); FLOW_END_INFERRED count and repair dollars saved against round 6's FLOW_END_MISSING $0.67; SURFACE_NOT_CREATED, EARLIER_ROUND_SHIPPED, SURFACE_DROPPED and the pinpoint-repair compliance on `messages` strings; stop-at-cap events; spend; new clusters with cause class and a why-and-fix row; the published fog report id; `## Skill notes` (steps the ticket had to supply). Useful fails become keyless replays.

## Constraints
No prompt or code fixes in this ticket. Screenshots stay out of the repo.

## Acceptance criteria
- `npx vitest run --project scripts scripts/e2e-admin/probe` exits 0 (the round 8 generator pin and the four round 8 replays).
- `test -s .sdlc/evals/rounds/2026-10-16-r8-matrix/report.md` exits 0, and the report holds the matrix against rounds 6 and 7 and the per-ticket table for T-0296 to T-0317.
- `jq -e '.reportId and (.round == "2026-10-16-r8-matrix")' .sdlc/evals/fog/2026-10-16-r8-matrix.json` exits 0.
- `jq -e '.totals.costUsd <= 42 and .stop == "done"' .sdlc/evals/rounds/2026-10-16-r8-matrix/round.json` exits 0.
- `python3 /Users/kimgranlund/.claude/plugins/cache/sdlc-lite/sdlc-lite/0.24.0/scripts/tickets.py check` exits 0.
- `npm run check` exits 0.

## Done when
- The round folder holds traces, ledger, round.json, runs/, README and report.md with the matrix and the per-ticket table; spend at or under $42.
- The fog report is published and its id recorded.
- `tickets.py check` and `npm run check` exit 0.
