<!-- target-path: .claude/ops/plan.md -->
# Ops plan — agent-ui

- **Dispatch**: 2026-08-28T01:15:00Z sweep firing (chore-planner, three-seat sweep per
  `/teamwork:mobilize-chores` → `harness:sweep-chores`; no repo-local `harness/` tree, so this
  firing planned from durable ops state directly). Judged the three fresh seat reports attached to
  this dispatch (issue-sorter, repo-cleaner, decision-watcher, all timestamped
  `2026-08-28T011500Z`) plus the prior plan (`2026-08-27T23:20:00Z`, carry-forward only) and durable
  state (`adr-queue.json` — 1 row, adr-0129, unchanged; `revalidation-queue.json` — 1 row,
  freshly re-populated this firing after hitting zero last firing; `revalidation-checkpoint.json`
  cursor 60; `watch-checkpoint.json` both sources at this firing's timestamp; `held-items.md`
  unchanged, nothing held) — plus one targeted live check for ground no attached report covered:
  independently confirming the dispatch context's claim that a follow-up task for ADR-0058's
  re-verification was already filed.
- **Evidence**:
  `reports/2026-08-28T011500Z-issue-sorter.md` (clean; #1686 independently re-confirmed CLOSED via
  merged PR #1689 at 01:07:19–20Z; no other issue/PR falls inside the checkpoint window; held-items
  unchanged) ·
  `reports/2026-08-28T011500Z-repo-cleaner.md` (0 open PRs; 0 open issues at survey time — #1686
  closed, #1690 not yet filed when this report ran; 1 stale `origin/*` ref pruned; #1686's scratch
  clone independently re-confirmed gone (0 rows on `--dry`); reviewer worktree still
  `KEEP(fleet-seat)`; consecutive-unchanged-firing count reset to 0) ·
  `reports/2026-08-28T011500Z-decision-watcher.md` (forward mode: clean no-op, 226/226 ADRs
  unchanged. Revalidation mode, cursor 55→60: adr-0057/0059/0060/0061 confirmed; adr-0058
  **falsified** — the Decision's pinned AA-contrast remedy numbers went stale after the
  2026-07-10 ramp rework, though the deferral ruling itself still holds; named, not run, a
  follow-up `file-task` as the next step) ·
  `.claude/ops/revalidation-queue.json` (1 row, `adr-0058`, `kind: falsified`, `queued_at:
  2026-08-28T01:36:51Z`) · `.claude/ops/revalidation-checkpoint.json` (`cursor: 60`) ·
  `git status --porcelain` (3 modified: `revalidation-checkpoint.json`,
  `revalidation-queue.json`, `watch-checkpoint.json`; 4 untracked: the 3 new seat reports +
  `sweep-in-flight.json` — nothing else pending) ·
  `git log --oneline -6` (confirms, in order: `a3b31a0d` → `720b907d` #1688 merge → `b2dc8ecb`
  4th-shape fold-in → `676b8415` checkpoint/queue-clear commit → `0e8f2943` prior plan
  (2026-08-27T23:20:00Z) landing its own payload → `fa1fd751` #1689 merge, closing #1686) ·
  `git fetch origin main` + `git rev-parse HEAD`/`origin/main` + `git ls-remote origin
  refs/heads/main` (all three return `fa1fd751…` — primary is at exact, push-verified parity with
  `origin/main`) ·
  targeted live check on the dispatch's ADR-0058 follow-up-task claim: `gh issue list --state
  open` first returned `[]` (transient list-endpoint lag on an issue created seconds earlier,
  `01:39:49Z`) — a retry plus `gh issue view 1690 --json body,labels,state,createdAt` independently
  confirmed **#1690** ("ADR-0058: re-verify and re-pin the four intent `-selected` remedy
  formulas...") exists, **OPEN**, created `2026-08-28T01:39:49Z`, labeled `task`+`size:small` only
  (no `backlog`/`roadmap`, no `needs-ruling`), body carries no `Blocked-by:` line — the dispatch's
  claim holds, corroborated rather than taken on its word alone · `gh pr list --state open` (0).
- **UNMEASURED**: none — both `gh` sources reachable all firing (issue-sorter's own check; my own
  targeted live check also succeeded, after one transient lag on the first read); `git`/`origin`
  reachable throughout. `[]`.
- **Corrections vs the prior plan** (2026-08-27T23:20:00Z):
  - Prior 1.1 (land that firing's own plan.md payload — the only uncommitted artifact) —
    **DONE**: commit `0e8f2943`, confirmed by `git log`.
  - Prior 4.1 (harvest adr-0129, 7 consecutive firings unconverted as of that plan) — **STILL
    OPEN, carried forward, now 8 consecutive firings unconverted** (`queued_at` unchanged at
    2026-08-25T17:57:12Z; no commit since touches this row).
  - **Not a prior-plan entry, but explicitly actioned this firing (named for continuity):**
    decision-watcher's revalidation-mode finding (adr-0058 falsified) named a `file-task` next
    step without running it; the dispatching session filed it directly, before this plan was
    composed — ticket **#1690**, confirmed live (see Evidence). Treated as **ACTIONED, not open,
    not re-proposed** — this plan does not queue "file a task for adr-0058," and does not treat
    #1690 as a chore-planner queue entry (regular dev-ticket triage/build is out of this board's
    scope, same footing as #1686/#1687 in prior firings).
  - No entry dropped as parked — the sole open issue this firing (#1690) carries neither `backlog`
    nor `roadmap`.
- **New this firing** (issue-sorter): #1686 independently reconfirmed closed via merged PR #1689;
  no other tickets filed inside the checkpoint window; nothing held.
- **New this firing** (repo-cleaner): 1 stale `origin/*` ref pruned (#1689's merged branch); the
  #1686 scratch clone reap independently re-confirmed gone; reviewer worktree still
  `KEEP(fleet-seat)`; consecutive-unchanged-firing count reset to 0 (new merged PR + closed ticket
  + scratch-clone state all changed vs. the prior report).
- **New this firing** (decision-watcher, forward mode): clean no-op, 226/226 unchanged.
- **New this firing** (decision-watcher, revalidation mode, cursor 55→60): adr-0057/0059/0060/0061
  confirmed; **adr-0058 falsified** (stale pinned AA-contrast numbers post-ramp-rework; deferral
  itself still holds) — queued into `revalidation-queue.json`, then converted same-firing into
  ticket #1690 by the dispatching session (see Corrections above).
- **Milestone, new this firing (chore-planner's own cross-reference)**: `revalidation-queue.json`
  went from **0 rows** (a first-time milestone last firing) back to **1 row** this firing — the
  queue's first fresh finding since hitting zero. Not a gap in either direction; a normal
  detection cycle. The row stays queued (not chore-planner's to clear) until #1690's actual
  amendment work lands and the queue is cleared the way the adr-0040/adr-0049 rows were two
  firings ago.
- **needs-ruling lane**: none this firing — the sole open issue (#1690) carries `task`+`size:small`
  only, verified live.
- **Blocked-by convention (#193)**: 1 open issue this firing (#1690); its body (already read via
  live `gh issue view`) carries no `Blocked-by:` line. No blocker relationship changes this plan.
- **Verdict — a second consecutive clean-conversion firing, this time on a single-item cycle
  closed inside its own firing window.** The adr-0058 revalidation finding was detected, queued,
  and converted to a filed, correctly-labeled ticket (#1690) before this plan was even composed —
  independently corroborated live, not taken on the dispatch's word. What's left: land this
  firing's own ops-state + plan payload (§1.1, the only uncommitted artifact) and keep pushing the
  one hygiene item now eight firings stale (§4.1). §2 and §3 are empty this firing — no blockers,
  no pending human decisions.

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## 1. Gated mutations already verified safe

### 1.1 Land this firing's ops-state + plan payload (dispatching host; ~3–5 min)
- **Action**: `git add` the 3 new seat reports
  (`reports/2026-08-28T011500Z-{issue-sorter,repo-cleaner,decision-watcher}.md`),
  `revalidation-checkpoint.json` (cursor 60), `revalidation-queue.json` (1 row, adr-0058), and
  `watch-checkpoint.json` (both sources advanced), plus this plan's own payload once applied —
  commit and push to `main` in one batch, matching the pattern of every prior firing's own 1.1.
- **Owner**: dispatching host (the ops-write split's dispatching session).
- **Evidence**: `git status --porcelain` (3 modified + 4 untracked, listed above, nothing else
  pending); `git rev-parse HEAD`/`origin/main` + `git ls-remote origin refs/heads/main` (all three
  = `fa1fd751…`, confirming primary is otherwise current before this batch lands);
  `ops-write-sandbox-rules` (dispatcher applies + lands payloads; direct-to-main
  push-verification convention cited, not re-derived).
- **Size**: 3–5 minutes.

## 2. Blocking other work

(none — 0 open PRs live-confirmed, primary exactly current with `origin/main` at `fa1fd751`; the
sole open issue, #1690, carries no `Blocked-by:` line and blocks nothing else in evidence.)

## 3. Human-decision items

(none this firing — the one pending thread, decision-watcher's named-but-not-run `file-task` step
for adr-0058, was actioned directly by the dispatching session before this plan was composed
(ticket #1690, independently confirmed live) and is already actioned, not carried forward as
open. No new human-decision item surfaced this firing.)

## 4. Hygiene debt

### 4.1 Harvest adr-0129's dual-maintained-CSS-drift class (Kim; ~15–20 min) — queued since 2026-08-25T17:57:12Z, now 8 consecutive firings unconverted
- **Action**: `adr-0129`'s row (unchanged evidence text this firing) flags a generalizable defect
  class — a promoted control's CSS drifting as dual-maintained truth between its site-consumer copy
  and its package-owned canonical copy (GH #1163's root-card logic and ADR-0100's container-type
  repair both independently missed one copy) — not yet covered by any `references/*.md`. Restated
  again because it remains the single most stale unconverted item in this queue and the gap between
  firings continues widening (7→8).
- **Owner**: Kim (`/make-pack` runner).
- **Evidence**: `.claude/ops/adr-queue.json`'s sole remaining row (full evidence text, citing GH
  #1163 and ADR-0100, byte-unchanged since 2026-08-25T17:57:12Z, confirmed still the only row);
  `.claude/docs/adr/0129-app-surfaces-m2-composition-and-transport-boundary.md` L70-107
  (Amendment 2, the artboard-extraction precedent this harvest would generalize from).
- **Size**: ~15–20 minutes.

## Standing notes (not queue entries)

- **Prior plan (2026-08-27T23:20:00Z) fully triaged**: its 1.1 landed (`0e8f2943`); its 4.1 carries
  forward above, one firing more stale.
- **Ticket #1690** (ADR-0058 re-verification amendment): filed directly by the dispatching session
  this firing (`2026-08-28T01:39:49Z`), OPEN, labeled `task`+`size:small`, no `Blocked-by:` line,
  no `backlog`/`roadmap` — regular dev-ticket triage/build, out of this board's scope; not
  duplicated into this plan's queue, same footing as #1686/#1687 in prior firings. #1686 is CLOSED
  (merged via #1689) and dropped, not re-proposed.
- **`revalidation-queue.json` holds 1 row (adr-0058)** — the queue's first fresh finding since
  hitting zero rows last firing. Stays queued until #1690's actual amendment work lands; not
  chore-planner's to clear.
- **`adr-queue.json` unchanged**: still its single most-stale row, adr-0129 only.
- **Repo surface is at a clean floor**: 0 open PRs, primary at exact parity with `origin/main`
  (`fa1fd751`, push-verified); 1 open issue (#1690, regular dev ticket, not ops debt) — the entire
  actionable ops queue this dispatch is one plan-payload landing and one long-carried hygiene
  harvest; §2 and §3 are both empty this firing.
- **The #1680 reap-worktrees fix continues to hold live**, re-confirmed independently this firing
  by repo-cleaner.
- **Fleet-bootstrap context (standing, not a finding)**: the reviewer seat
  (`.claude/worktrees/agent-ui-reviewer`, branch `reviewer-worktree-2026-08-26`) remains live and
  idle, `KEEP(fleet-seat)`.
- **No entry parked this firing** — 1 open issue exists (#1690), carries neither `backlog` nor
  `roadmap`.
- **Dirty `main` markers**: none reported by repo-cleaner beyond this sweep's own
  `sweep-in-flight.json` marker (leave until the sweep concludes).
- **gen-ui-kit**: out of this board's scope (dedicated session per Kim's ruling).

*Composed by chore-planner, 2026-08-28T01:15:00Z sweep firing — returned as payload per the #125
ops-write split; written and landed by the dispatching session.*
