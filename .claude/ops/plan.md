<!-- target-path: .claude/ops/plan.md -->
# Ops plan — agent-ui

- **Dispatch**: 2026-08-26T22:05:00Z sweep firing (chore-planner, three-seat sweep per
  `/teamwork:mobilize-chores` → `harness:sweep-chores`; no repo-local `harness/` tree, so this
  firing planned from durable ops state directly, same as every prior firing this session). Judged
  the three fresh seat reports attached to this dispatch (issue-sorter, repo-cleaner,
  decision-watcher) plus the prior plan (`2026-08-26T16:28:22Z`, carry-forward only) and durable
  state (`adr-queue.json` now 7 rows, `revalidation-queue.json` now 8 rows,
  `revalidation-checkpoint.json`, `watch-checkpoint.json`, `held-items.md`) — no live `gh`/`git`
  call of my own beyond a `git log`/`git status`/`git diff --stat` spot-check confirming every
  prior-plan claim and this firing's file-level state is real on disk.
- **Evidence**:
  `reports/2026-08-26T22-05-00Z-issue-sorter.md` (checkpoint window 16:28:22Z→22:05:00Z; 5 issues
  + 5 PRs, all closure/merge events on already-fully-triaged records — #1670/#1672/#1673/#1674/
  #1675 closed by #1671/#1676/#1677/#1678/#1679 respectively, 1:1; independently confirmed via
  `gh issue list --state open` / `gh pr list --state open`, both empty; both checkpoint entries
  advance to 22:05:00Z) ·
  `reports/2026-08-26T220500Z-repo-cleaner.md` (git surface fully clean: 0 open PRs, 0 open issues,
  5 stale already-merged-PR tracking refs pruned; a second worktree+branch now exist
  — `.claude/worktrees/agent-ui-reviewer` / `reviewer-worktree-2026-08-26` — from this session's own
  `/teamwork:fleet-bootstrap` immediately prior, standing infrastructure not cruft;
  `reap-worktrees.mjs --dry` reads that worktree as `REAP` since its cherry-diff can't distinguish a
  content-identical standing seat from a finished campaign branch — correctly held, not executed,
  not proposed for removal; this exact classification gap already filed as agent-ui#1680 by the
  dispatching session, **treated as ACTIONED not open, not re-proposed here**) ·
  `reports/2026-08-26T220500Z-decision-watcher.md` (forward mode: root-caused and worked around a
  tooling anomaly — `adr_checkpoint.py`'s hash basis changed in harness 3.18.8 with no checkpoint
  migration, briefly flooding all 226 ADRs as "amended"; isolated the true delta by reclassifying
  under 3.18.6, then re-baselined the checkpoint under 3.18.8 to prevent recurrence; filed as a bug
  in the plugins repo by the dispatching session, **treated as ACTIONED not open**; queued 4 new
  harvest rows — adr-0030/0032/0033/0035, each now carrying a landed same-file `## Amendment`,
  confirmed against `origin/main` at `ac6b80f2`. Revalidation mode: sampled cursor 35→40,
  adr-0036/0038/0040/0041 falsified, adr-0039 confirmed; 3 of the 4 new falsified findings
  (adr-0036/0038/0041) share an ADR-0140 rename-propagation root cause already filed as a separate
  agent-ui task by the dispatching session, **treated as ACTIONED not open, not re-proposed**;
  adr-0040 (recurring silent budget re-basing) has **not** been filed anywhere — named as open
  below. All four previously-queued falsified rows (adr-0030/0032/0033/0035) independently
  re-verified accurate against their now-landed Amendments; `queue-clear` explicitly not run per
  `watch-adrs`'s own boundary — command named for a human) ·
  `git log --oneline -25` (confirms prior plan's own 1.1 landed as `220ae0ac`, and prior plan's 4.2
  landed as the four merged PRs `ac6b80f2`/`55d8e075`/`5245599a`/`7b3f8bb9`) ·
  `git diff --stat` on the durable state files (`adr-checkpoint.json` +1130/−202 lines — the
  corpus-wide re-baseline; `adr-queue.json` +28 lines / 4 new rows; `revalidation-queue.json` +28
  lines / 4 new rows; `revalidation-checkpoint.json` cursor 35→40; `watch-checkpoint.json` both
  sources → 22:05:00Z; `fleet.json`/`fleet-roster.md` +52/+3 lines, confirmed as fleet-bootstrap's
  own dirt, out of this seat's 1.1 scope).
- **UNMEASURED**: none — both `gh` sources reachable all firing (issue-sorter's own
  `gh auth status`/`gh api rate_limit` check, 5000/5000 unused); `git` reachable throughout. `[]`.
- **Corrections vs the prior plan** (2026-08-26T16:28:22Z) — both open entries resolved or carried:
  - Prior 1.1 (land the 16:28:22Z ops state) — **DONE**: commit `220ae0ac` ("ops: 2026-08-26T16:28Z
    sweep state..."), confirmed by `git log`. Superseded by this firing's own 1.1.
  - Prior 4.1 (harvest the ADR-restatement-gap fix via `/make-pack`) — **STILL OPEN, carried
    forward as new 4.1, elevated further** — `adr-queue.json`'s same-shape candidate count grew
    3→6 this firing (adr-0021/0025 plus newly-added adr-0030/0032/0033/0035), and the
    corpus-wide confirmed-and-individually-fixed instance count grew 5→9 — see Verdict below.
  - Prior 4.2 (file + land dated restatement amendments for adr-0030/0032/0033/0035) — **DONE, all
    four**: filed as issues #1672(adr-0030)/#1673(adr-0032)/#1674(adr-0033)/#1675(adr-0035),
    fixed via merged PRs #1679/#1676/#1678/#1677 respectively (confirmed by `git log` — commits
    `ac6b80f2`/`7b3f8bb9`/`55d8e075`/`5245599a` — and independently re-verified accurate by
    decision-watcher's own re-read of all four landed Amendments against shipped code). Dropped as
    completed-and-proven; each now instead feeds new 4.1 (as a 4th–7th worked instance of the
    still-undocumented pattern) and new 3.1 (their revalidation-queue rows still need a human
    `queue-clear`).
  - No entry dropped as parked — 0 open issues exist this firing, so nothing carries `backlog` or
    `roadmap` to check against.
- **New this firing** (decision-watcher, forward mode): a tooling anomaly
  (`adr_checkpoint.py`'s hash-basis change, harness#929, no checkpoint migration) briefly flooded
  all 226 ADRs as "amended" — root-caused, worked around live (reclassified under 3.18.6 to isolate
  the true 4-ADR delta), then the checkpoint was re-baselined under 3.18.8 so the flood doesn't
  repeat next firing. Filed as a bug in the plugins repo by the dispatching session — **ACTIONED,
  not open, not re-proposed**. 4 new ADR-queue harvest rows (adr-0030/0032/0033/0035) — see 4.1.
- **New this firing** (decision-watcher, revalidation mode): sampled cursor 35→40 —
  adr-0036/0038/0041 falsified via a *distinct* root cause (ADR-0140's 2026-07-18 corpus-wide
  `--ui-*`→`--md-sys-*` rename swept shipped code but never propagated into these ADRs' own
  Decision-prose token names; mechanism/values all verified byte-correct, only the literal name is
  stale) — already filed as a separate agent-ui task by the dispatching session, **ACTIONED, not
  open, not re-proposed**. adr-0040 falsified via an unrelated cause (recurring silent budget
  re-basing, the exact failure mode its own 2026-08-16 Amendment claimed to close) — **not filed
  anywhere yet** — new 4.2 below. adr-0039 confirmed (box-alignment `start`/`end` still live) — no
  action.
- **New this firing** (issue-sorter): 5 closures + 5 merges since the prior checkpoint, all
  closure/merge events on already-fully-triaged records from this session's own prior-firing
  dispatches — clean no-op for this seat's own remit. Repo now carries 0 open issues, 0 open PRs.
- **New this firing** (repo-cleaner): git surface fully clean, 5 stale tracking refs pruned. A
  second worktree+branch (`agent-ui-reviewer` / `reviewer-worktree-2026-08-26`) now exist as
  standing fleet infrastructure from this session's own `/teamwork:fleet-bootstrap`, run
  immediately before this sweep (standing context for this plan, not itself a finding) — a
  reviewer seat and a planner seat are both now live and idle in the background. `reap-worktrees.mjs`
  cannot tell that worktree apart from a finished campaign worktree; already filed as agent-ui#1680
  by the dispatching session — **ACTIONED, not open, not re-proposed**.
- **needs-ruling lane**: none this firing — 0 open issues exist, so no issue can carry the
  `needs-ruling` label. §3 below is a human-decision item of a different shape (a batch confirm on
  already-verified-safe queue state), not a labeled-issue ruling.
- **Blocked-by convention (#193)**: 0 open issues this firing — nothing to grep a `Blocked-by:`
  line from; no blocker relationship to check on any entry below.
- **Verdict — the ADR-restatement-gap harvest fix is now past the point batching helps**: every
  one of 9 corpus-wide instances of the same defect shape (header records a supersession, the
  Decision-body prose is never restated) is now **individually fixed** —
  adr-0007/0017/0018/0021/0025 (fixed earlier, PRs #1615/#1625/#1626/#1636/#1635) plus
  adr-0030/0032/0033/0035 (fixed **this session**, PRs #1679/#1676/#1678/#1677) — yet the
  doc-standards convention that would let a future ADR author or reviewer recognize and fix this
  shape without re-deriving the rationale each time is **still unwritten**
  (`adr-log-mechanics.md`'s Amendment/Supersession/Extension table still carries only 3 rows,
  confirmed against `origin/main` by both this seat's own prior read and decision-watcher's fresh
  check this firing). `adr-queue.json` now carries 6 rows proposing the exact same fix text
  verbatim (`plan` field unchanged since the first candidate) — going from 3 candidates to 6 netted
  **zero new design work**, only more evidence that batching further buys nothing. This stays
  hygiene debt by contract (queue order is fixed by the entry, not by urgency), but it holds the
  top of §4 for the second firing running. Two more items surfaced this firing: adr-0040's own
  silent-drift recurrence needs its first-ever filing (new 4.2), and adr-0129's dual-maintained-CSS
  harvest candidate has now sat unconverted-to-an-action for 4 consecutive firings since
  2026-08-25T17:57:12Z (new 4.3) — named explicitly so it stops being silent background noise.

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## 1. Gated mutations already verified safe

### 1.1 Land this firing's ops state — one commit, ops paths ONLY (dispatching host; 5 min)
- **Action**: `git add` exactly: `.claude/ops/adr-checkpoint.json` (modified, +1130/−202 lines —
  the corpus-wide hash-basis re-baseline under harness 3.18.8, resolving the tooling anomaly for
  every future firing), `.claude/ops/adr-queue.json` (modified, +4 rows: adr-0030/0032/0033/0035,
  now 7 total), `.claude/ops/revalidation-queue.json` (modified, +4 rows:
  adr-0036/0038/0040/0041 falsified, now 8 total; the existing adr-0030/0032/0033/0035 rows are
  left untouched here — see 3.1), `.claude/ops/revalidation-checkpoint.json` (modified, cursor
  35→40), `.claude/ops/watch-checkpoint.json` (modified, both `gh_issues`/`gh_prs` → 22:05:00Z),
  `.claude/ops/reports/2026-08-26T22-05-00Z-issue-sorter.md` (new),
  `.claude/ops/reports/2026-08-26T220500Z-repo-cleaner.md` (new),
  `.claude/ops/reports/2026-08-26T220500Z-decision-watcher.md` (new), plus this plan's own payload
  once applied — then commit on `main`. Do NOT stage `.claude/ops/fleet.json` or
  `.claude/ops/fleet-roster.md` (this session's own `/teamwork:fleet-bootstrap` output, a different
  seat's scope) and do NOT stage `.claude/ops/sweep-in-flight.json` (this sweep's own live marker,
  same exclusion as every prior firing).
- **Owner**: dispatching host (the ops-write split's dispatching session).
- **Evidence**: `git status --porcelain` and `git diff --stat` this compute pass (7 modified + 3
  untracked ops paths this seat's own remit; 2 modified + 1 untracked paths correctly excluded as
  a different seat's scope); `ops-write-sandbox-rules` (dispatcher applies + lands payloads).
- **Size**: 5 minutes.

## 2. Blocking other work

(none — 0 open PRs, 0 open issues, primary exactly current with `origin/main`; no entry blocks
another this firing.)

## 3. Human-decision items

### 3.1 Run the revalidation queue-clear for adr-0030/0032/0033/0035 (Kim; ~5 min)
- **Action**: all four rows' underlying findings are now fixed — each ADR carries a landed,
  merged, same-file `## Amendment` (PRs #1679/#1676/#1678/#1677), and decision-watcher
  independently re-read all four this firing and confirmed each accurately restates its clause
  against shipped reality. Per `watch-adrs`'s own boundary ("never decides a queued
  falsified/untestable finding is 'resolved' on its own — only a human clearing the queue row does
  that"), no seat may self-clear this; run:
  ```
  python3 "<harness plugin root>/scripts/revalidation_checkpoint.py" queue-clear <path> --ids adr-0030:falsified,adr-0032:falsified,adr-0033:falsified,adr-0035:falsified
  ```
- **Owner**: Kim.
- **Evidence**: `.claude/ops/revalidation-queue.json` (4 rows still open, full evidence text
  per-ADR); decision-watcher's report (independent re-verification of all four landed Amendments);
  `.claude/ops/adr-queue.json`'s new rows (citing the same 4 merged PRs as their own evidence).
- **Size**: ~5 minutes (single mechanical command).

**Status: DONE (2026-08-26T22:2X:00Z, same firing)** — Kim confirmed via AskUserQuestion, run by
the dispatching session: `revalidation_checkpoint.py queue-clear` — cleared 4 candidate(s), 4
remain (adr-0036/0038/0040/0041, this firing's own fresh findings).

## 4. Hygiene debt

### 4.1 Harvest the ADR-restatement-gap fix now via `/make-pack` (Kim; ~20 min) — held at top of §4 for the 2nd firing running
- **Action**: `adr-queue.json` carries 6 rows proposing the identical fix (extend
  `.claude/skills/doc-standards/references/adr-log-mechanics.md`'s Amendment/Supersession/
  Extension table with a 4th row for "a header-recorded partial supersession whose Decision-body
  prose goes unrestated until a dedicated Amendment") — adr-0021, adr-0025, adr-0030, adr-0032,
  adr-0033, adr-0035. Every one of the 9 corpus-wide worked instances of this shape
  (adr-0007/0017/0018/0021/0025/0030/0032/0033/0035) is now individually fixed via its own landed
  Amendment; only the convention documenting the pattern for the *next* ADR author/reviewer is
  still unwritten. The fix text is already drafted verbatim in `adr-queue.json`'s own `plan`
  field — this is purely a batching decision, not a design decision, and batching has stopped
  paying for itself (3→6 candidates this firing, zero new design work). Same lane as the
  5-candidate batch shipped via #1607 (commit `e91d612b`).
- **Owner**: Kim (`/make-pack` runner).
- **Evidence**: `.claude/ops/adr-queue.json` (6 of 7 rows, identical `plan` field);
  `.claude/ops/revalidation-queue.json` (adr-0030/0032/0033/0035 rows, same pattern, now fixed);
  precedent commit `e91d612b` (#1607).
- **Size**: ~20 minutes once run.

### 4.2 File a task for adr-0040's recurring silent budget re-basing (Kim; ~10 min) — net-new finding, not yet filed anywhere
- **Action**: ADR-0040's own 2026-08-16 Amendment argued explicitly for ending silent,
  script-comment-only budget re-basing after finding 11 prior undocumented instances — yet the
  same row has been silently re-based ≥8 more times since (58KB→70KB+ per `measure-size.mjs`'s own
  comment ladder), none fed back as a further Amendment: the exact failure mode the Amendment
  claimed to close, recurring immediately after it landed. File a task (owner: unassigned per
  `revalidation-queue.json`) asking for either a further dated Amendment recording the current real
  budget, or a process fix that makes re-basing feed back automatically — the choice is the
  ticket-owner's, not decided here. Distinct root cause from 4.1/4.3 and from the already-filed
  ADR-0140 rename-propagation task (adr-0040's staleness is a re-basing-discipline gap, not a
  token-rename gap) — do not fold it into that filing.
- **Owner**: Kim (file-task runner); any available dev to action once filed.
- **Evidence**: `.claude/ops/revalidation-queue.json`'s adr-0040 row (full 58KB→70KB+ ladder
  evidence); ADR-0040's own 2026-08-16 Amendment text (the fix it argued for, now recurring).
- **Size**: ~10 minutes to file; further sizing depends on the fix chosen.

### 4.3 Harvest adr-0129's dual-maintained-CSS-drift class (Kim; ~15–20 min) — queued since 2026-08-25T17:57:12Z, unconverted for 4 consecutive firings
- **Action**: `adr-129`'s row (unchanged mtime this firing) flags a generalizable defect class — a
  promoted control's CSS drifting as dual-maintained truth between its site-consumer copy and its
  package-owned canonical copy (GH #1163's root-card logic and ADR-0100's container-type repair
  both independently missed one copy) — not yet covered by any `references/*.md`. Distinct fix
  target from 4.1 (different pattern, different target doc); surfaced as its own entry now because
  it has sat as background-only prose across 4 consecutive sweep firings without ever becoming an
  actionable line.
- **Owner**: Kim (`/make-pack` runner).
- **Evidence**: `.claude/ops/adr-queue.json`'s adr-0129 row (full evidence text, citing GH #1163
  and ADR-0100); `.claude/docs/adr/0129-app-surfaces-m2-composition-and-transport-boundary.md`
  L70-107 (Amendment 2, the artboard-extraction precedent this harvest would generalize from).
- **Size**: ~15–20 minutes.

## Standing notes (not queue entries)

- **Prior plan (2026-08-26T16:28:22Z) fully triaged**: its 1.1 landed (`220ae0ac`); its 4.2 landed
  in full (4 issues filed, 4 PRs merged, closing them 1:1); its 4.1 carries forward as new 4.1
  above, elevated for the 2nd consecutive firing.
- **Repo surface is at a clean floor**: 0 open issues, 0 open PRs, primary at exact parity with
  `origin/main` — the entire actionable queue this dispatch is hygiene debt (§4) plus one batch
  confirm (§3.1, now DONE); §2 is empty.
- **Fleet-bootstrap context (standing, not a finding)**: this session's own
  `/teamwork:fleet-bootstrap`, run immediately before this sweep, left a reviewer seat
  (background-subprocess, walled, holding for its first review task) and a planner seat
  (background, holding for its first design/decomposition charter) both live and idle. The
  reviewer's own worktree is what `reap-worktrees.mjs` currently misreads as reapable — see
  agent-ui#1680 (ACTIONED, not open).
- **Two cross-cutting findings ACTIONED elsewhere this firing, not re-proposed here**: the
  `adr_checkpoint.py` hash-basis tooling anomaly (filed as claude-plugins#945) and the
  ADR-0140 rename-propagation root cause behind adr-0036/0038/0041 (filed as agent-ui#1681) —
  both filed by the dispatching session, both out of this plan's own action list by design.
- **No entry parked this firing** — 0 open issues exist, so none can carry `backlog`/`roadmap`.
- **Dirty `main` markers**: `.claude/ops/fleet.json`/`fleet-roster.md` (this session's own
  fleet-bootstrap, dirty-but-intentional, a different seat's scope — not staged by 1.1) and
  `.claude/ops/sweep-in-flight.json` (this sweep's own live marker, session `agent-ui-81` — leave
  until the sweep concludes).
- **gen-ui-kit**: out of this board's scope (dedicated session per Kim's ruling).

*Composed by chore-planner, 2026-08-26T22:05:00Z sweep firing — returned as payload per the #125
ops-write split; written and landed by the dispatching session.*
