<!-- target-path: .claude/ops/peer-coordination.md -->
# Peer-session coordination — standing record

- **Charter**: the AGENT-UI session (host, `/lead-team` 2026-08-15) coordinates board work across
  concurrent peer sessions. Peers are separate host processes — NOT reachable by SendMessage;
  this file + the PR #924 thread + ADR-0005 claims ARE the coordination channel.
- **Roster (2026-08-15)**: AGENT-UI (coordinator; merges) · AUTHORKIT (estate-overhaul campaign,
  worktree `overhaul-2026-08-14`, locked) · UIBUILD-01 · UIBUILD-02.

## Standing lane protocol

1. **Claim before touching** (ADR-0005): assignee + dated claim comment on the issue; check
   `gh issue view N` for an existing claim FIRST. First claim wins; a stood-down lane says so
   on the record (zero salvage — see PR #924 thread, #925–#928 instance).
2. **Seats/peers never merge**: draft PRs only, session named in the PR body. AGENT-UI verifies
   (mergeable + gates evidence + Findings write-back) and merges serially, re-running
   `npm run check && npm test` on main between merges, judged by exit codes only.
3. **Owner rulings park, never build**: a decide-later issue gets an options+recommendation
   affordance comment with a `ruling: X` reply verb; whoever claims after the ruling executes it.
4. **Machine discipline**: foreground gates; stagger full `npm test` runs (concurrent suites
   poison each other — flaky-gates). Red on a loaded machine → isolate before believing it.
   Measured instance: 2026-08-15, load 30–52, three non-overlapping failing sets, all green
   in isolation.
5. **Residue**: each session reaps its OWN worktrees/branches after merge; nobody force-removes
   another session's worktree. Stale peer residue gets flagged here, not deleted.

## State (last updated 2026-08-15, post board-zero)

- Board: 0 open issues · 0 open PRs. Overnight tally: #917–#921 built+merged (PRs #919/#922/#923),
  W2 #925–#935 merged (PRs #939–#943, #946), W3 #936/#938 executed by peers, #937 closed-parked
  (reopen when claude-plugins#253 lands or Kim rules `ruling: B` on the issue).
- Flagged peer residue (owners to reap): worktrees `agent-a004b4beec8ffcb13`,
  `agent-a48149f7db88727c6`, `agent-aa23ed6cf92030408` (refactor/927, merged),
  `agent-aa7f622bfbde02144` (docs/928, merged); locked `overhaul-2026-08-14` (AUTHORKIT's, live).
- Gate note on main: S9 exemplar sweep widened to skill references/ (commit 341fe63f) after the
  W2 extractions moved the cited tables.
