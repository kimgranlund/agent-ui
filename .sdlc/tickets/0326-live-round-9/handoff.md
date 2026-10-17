---
id: T-0326
title: "Live round 9: full matrix after the round 8 fixes ($42 cap)"
type: chore           # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-17
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A full before and after against rounds 6 and 8 (`.sdlc/evals/rounds/2026-10-15-r6-matrix/`, `2026-10-16-r8-matrix/`) after the round 8 fixes: T-0320 (brace verdict), T-0321 (forced SURFACE_DROPPED repair; the fallback never ships a check-failed round), T-0322 (check gaps), T-0323 (poker on a Card frame), T-0324 (blackjack natural), T-0325 (hold'em scenario).

## Approval
Kim 2026-10-17: full matrix, $42 cap. Live calls use the main checkout's `.env` (never read or print it).

## Scope
- Phase 1: a round 9 generator reusing round 8's 87 runs (same scenarios, models and order, with T-0325's hold'em steps), pinned by a test; `.sdlc/evals/rounds/<today>-r9-matrix/live-commands.sh`; `--describe` and `--cap 42 --dry-run`; report the command (`--round r9-matrix`), counts and expected spend; stop.
- Phase 2: read `~/.claude/skills/context-fog-of-war/SKILL.md` fresh and follow its checklist on your own; committed audit mapping and `audit.py link` per cluster; the trace's stopReason, maxTokens and prompt-section digests.

## Report
`report.md`: the matrix against rounds 6, 8; per ticket T-0320 to T-0325 fixed live, partly, not exercised or regressed; the T-0321 halt count against round 8 (Kim's condition: revisit if halts rise); DEALT_IN_BETTING, SETTLED_WITHOUT_NATURAL, concierge-edit-applied and the new SURFACE_MISSING and PRODUCT_CARD_MISSING fires and saves; poker surfaces (Card frame vs CardTable, PlayingCard on turn 0); the R8 round-1 count again; runs that passed in round 8 and fail now (regressions) with a cause each; spend; new clusters with why-and-fix rows; the fog report id; `## Skill notes`.

## Constraints
No prompt or code fixes in this ticket. Screenshots stay out of the repo.

## Acceptance criteria
- `npx vitest run --project scripts scripts/e2e-admin/probe` exits 0 (the round 9 generator pin among the probe tests).
- `test -s .sdlc/evals/rounds/2026-10-17-r9-matrix/report.md` exits 0, and the report holds the matrix against rounds 6 and 8, the per-ticket table for T-0320 to T-0325, the T-0321 halt count against round 8 and the churn against round 8.
- `jq -e '.reportId and (.round == "2026-10-17-r9-matrix")' .sdlc/evals/fog/2026-10-17-r9-matrix.json` exits 0.
- `jq -e '.totals.costUsd <= 42 and .stop == "done"' .sdlc/evals/rounds/2026-10-17-r9-matrix/round.json` exits 0.
- `python3 /Users/kimgranlund/.claude/plugins/cache/sdlc-lite/sdlc-lite/0.24.0/scripts/tickets.py --root .sdlc check` exits 0.
- `npm run check` exits 0.

## Done when
- The round folder holds traces, ledger, round.json, runs/, README and report.md with the matrix, the per-ticket table and the halt count; spend at or under $42.
- The fog report is published and its id recorded.
- `python3 ~/.claude/plugins/cache/sdlc-lite/sdlc-lite/0.24.0/scripts/tickets.py --root .sdlc check` and `npm run check` exit 0.
