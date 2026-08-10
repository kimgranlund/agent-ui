<!-- target-path: .claude/ops/plan.md -->
# Ops plan — agent-ui

- **Dispatch**: 2026-08-10, first sweep (chore-lead fan-out; three seat reports attached —
  decision-watcher, issue-sorter, repo-cleaner; nothing refetched). Prior plan (2026-08-09 sixth
  sweep) read as carry-forward source. Main at `13033f9f`, up to date with origin; uncommitted
  diff (`agent-admin*`, `conversation.*`) confirmed as task-666b's live work on #666/#670/#673.
- **Seats**: decision-watcher 🟡 (178→179 ADRs; adr-0179 "agent-admin three-pane IA" clears the
  save-lessons impact bar — origin-keyed context routing, band-driven pair→triple docking,
  retract-don't-delete divider-unpaint — queued as the 1 pending harvest candidate, confirm
  deferred to a human-present firing; 0173/0174/0175 ruling still landed, no supersedes) ·
  issue-sorter 🟢 on substance / 🟡 on form (clean sweep, checkpoint-only delta to 05:03:40Z;
  window 08-09T20:20:14Z→08-10T05:03:40Z; 13 issues + 11 all-MERGED PRs touched; all authors
  friendly, zero holds; handoff omitted its explicit `Status:` line — process flag, see standing
  notes) · repo-cleaner 🟢 (1 worktree = main only, remotes = origin/main after pruning 10 stale
  refs all traced to merged/deleted PR branches, 0 open PRs of 389 total, gitignore exit 0 with
  7 G1 warnings, main's dirty state correctly left untouched, nothing executed) — 3/3 returned,
  no UNMEASURED sections.
- **Supersedes**: the 2026-08-09 sixth-sweep plan; per-item disposition below.
- **Verdict**: steady-state with one pending human decision. The ADR harvest queue holds exactly
  one candidate (adr-0179) awaiting a batched confirm — the sole item above hygiene. No gated
  mutations, no blockers; the report-history gap carried as 4.2 is resolved (fresh artifact
  `2026-08-10T050520Z.md` on disk, substance never lost); the cross-repo encode carries a fourth
  time.

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## Prior-plan disposition (2026-08-09 sixth sweep → this dispatch)

| Item | Fate |
|---|---|
| 4.1 land sweep ops delta (recurring) | **Resolved for that sweep** — landed as commit `8509797b` ("sixth 2026-08-09 sweep landing"); recurs → **4.1** below for this firing's payloads |
| 4.2 repair the report-history gap (missing `2026-08-09T202038Z.md`) | **Resolved — landed this firing.** Chore-lead's dispatch rules the gap repaired: `2026-08-10T050520Z.md` is on disk (verified by `ls`), the 202038Z substance was preserved verbatim in the sweep record and never lost. No backfill queued; row cleared |
| 4.3 encode ops-seat contract rulings in nonoun-plugins (cross-repo) | **Carried ×4** → **4.2** below — not doable from this checkout, no evidence it landed; the issue-sorter Status-line omission this firing adds weight to encoding the handoff contract where the seats' report contracts live |

## 1. Gated mutations already verified safe

(none this sweep — 0 open PRs; no merged PR left a surviving remote branch (10 stale
remote-tracking refs pruned this firing were all already-merged/deleted, no #613-class survivor);
main's dirty state is task-666b's live peer work, not quarantine-eligible; no host-repo gated
reap script exists.)

## 2. Blocking other work

(none this sweep — main even with origin at `13033f9f`; live #666/#670/#673 work proceeds as
direct edits in the shared checkout (see standing notes); #616 remains an external upstream wait,
not a queue blocker.)

## 3. Human-decision items

### 3.1 Confirm-gate the adr-0179 harvest candidate (the 1 pending queue row)
- **Action**: next human-present firing, run `adr_queue.py pending` and put the single row to Kim
  in one batched AskUserQuestion confirm: harvest ADR-0179's consumer-assembly patterns
  (origin-keyed context routing across simultaneously-mounted composers, band-driven pair→triple
  docking off the shell's named breakpoint ladder, retract-don't-delete divider-unpaint) into
  `agent-ui-composition-patterns/SKILL.md`. If confirmed, dispatch `/make-pack` against that
  skill scoped to ADR-0179's Decision section.
- **Owner**: Kim (the confirm decision), staged by decision-watcher/chore-lead's next
  human-present firing; `/make-pack` dispatch follows only on a yes.
- **Evidence**: decision-watcher's report this dispatch — candidate judged against the
  save-lessons impact bar, no existing SKILL.md row covers it; `adr-queue.json` (1 candidate,
  applied by chore-lead this firing); ADR-0179 accepted 2026-08-09, amended+ratified 2026-08-10,
  GH #651/#662/#665.
- **Size**: ~5 min confirm; ~30–45 min harvest if confirmed

## 4. Hygiene debt

### 4.1 Land this firing's ops-state delta (recurring)
- **Action**: chore-lead's close-out commits + pushes the applied payloads —
  `.claude/ops/adr-checkpoint.json` (178→179), `.claude/ops/adr-queue.json` (1 candidate),
  `.claude/ops/watch-checkpoint.json` (→ 2026-08-10T05:03:40Z),
  `.claude/ops/reports/2026-08-10T050520Z.md` (new, currently untracked), and this `plan.md`
  once applied. `.claude/ops/` is git-tracked; an uncommitted delta is drift against origin.
- **Owner**: chore-lead close-out (per `rulings.md` §"Seat-payload landing leg")
- **Evidence**: `git status --porcelain -- .claude/ops/` this dispatch: 3 modified + 1 untracked;
  precedent commit `8509797b` (the sixth-sweep landing).
- **Size**: ~5 min

### 4.2 Encode the ops-seat contract rulings into the harness agents (cross-repo, carried ×4)
- **Action**: one change in the nonoun-plugins repo (harness plugin): (a) `chore-lead.md` gains
  the close-out landing leg (seats return payloads; chore-lead writes `.claude/ops/` before
  reporting up); (b) `chore-lead.md` gains evidence write-back ownership (dated tracker comments
  from seat evidence); (c) the seat-side payload-fence rule (a fenced payload block carries
  verbatim file content paired with its target path; a path-only fence is malformed and will not
  land — the 2026-08-09 repo-cleaner incident); (d) NEW this firing — reassert the handoff
  contract's mandatory first-line `Status:` enum in the ops seats' report contracts (the
  2026-08-10 issue-sorter omission).
- **Owner**: host session in the nonoun-plugins repo (not doable from this checkout)
- **Evidence**: `rulings.md` §"Seat-payload landing leg" + §"Evidence write-backs"; fourth
  consecutive sweep with no landing evidence in nonoun-plugins; the 202038Z malformed-payload
  incident (2026-08-09) and the Status-line omission (this firing).
- **Size**: ~25 min

## Standing notes (not queue entries)

- **Process flag — issue-sorter handoff form**: this firing's handoff omitted the explicit
  first-line `Status:` enum (substance unambiguous, no queue entry warranted). Second seat-side
  report-contract deviation in two days (after the 202038Z payload fence); both now feed 4.2's
  encode. Watch for recurrence.
- **#651 family CLOSED** — the 3-pane admin IA closed 2026-08-09T23:16:12Z alongside
  #656/#658/#660/#662/#665; its live worktree is gone (1 worktree = main only). The prior plan's
  keep-live note for `agent-ac09976e6aa67b4ff` is retired.
- **Live peer work rides the main checkout** — #666/#670/#673 ("doing") are landing as direct
  edits in the shared checkout (task-666b), not separate worktrees, despite the dispatch brief
  anticipating parallel worktrees (repo-cleaner's observation, not a finding). Sweeps must keep
  treating main's `agent-admin*`/`conversation.*` dirty state as live work — never `sync_main.py`
  fodder, never drift — until those issues close.
- **Open issues (7)**: #673 (bug, doing) · #672 (enhancement, size:small) · #670 (bug, doing) ·
  #669 (bug, doing — confirmed independently by both issue-sorter and repo-cleaner) · #666
  (task, doing, size:small) · #664 (task, size:small) · #616 (task, size:small, carried,
  upstream-gated on `a2ui-project/a2ui#2150` — external wait, re-enters ops scope only if the
  gate lifts and it stalls).
- **ADR ledger**: 179 on disk; harvest history clean (0173/0174/0175 via PR #623, 0178 via
  PR #648, all content-verified); queue = exactly the adr-0179 row (3.1).
- **gitignore KEEP-LIST fence is permanent** — 7 G1 warnings (down from 8), Kim-ruled standing
  noise, exit 0 is the whole gate. No sweep re-proposes a trim.
- **`.claude/ops/` is git-tracked** — landing legs end in commit+push, not just a write.

*Written by chore-planner, 2026-08-10 first sweep. Landed by chore-lead's close-out per the
landing-leg ruling.*
