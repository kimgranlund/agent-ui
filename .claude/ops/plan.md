# Ops plan — agent-ui

- **Dispatch**: 2026-08-09, second sweep of the day (chore-lead fan-out; three seat reports
  attached — decision-watcher, issue-sorter, repo-cleaner; nothing refetched). Prior plan read as
  carry-forward source; `rulings.md` + live git tracking state consulted only to verify
  between-sweep landings.
- **Seats**: decision-watcher 🟢 (176/176 ADRs clean vs checkpoint `88b429b`, zero delta,
  harvest trio 0173/0174/0175 landed and accepted; no checkpoint/queue changes) · issue-sorter 🟢
  (3 open issues, 0 open PRs; #624 verified properly triaged; checkpoint → 2026-08-09T12:34:24Z) ·
  repo-cleaner 🟢 (1 worktree, 1 branch, HEAD==origin/main, zero scripts executed; 8th identical
  G1 list; full report payload → `.claude/ops/reports/2026-08-09T123459Z.md`) — 3/3 returned, no
  UNMEASURED sections.
- **Supersedes**: the first 2026-08-09 plan; per-item disposition below.
- **Verdict**: steady-state clean — the prior plan's queue carries forward unchanged in shape;
  the only fresh facts this firing are issue #624's arrival (triaged clean, dev backlog, no ops
  action) and the checkpoint advance. Zero gated mutations, zero blockers; two optional human
  decisions and three hygiene entries remain, none new.

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## Prior-plan disposition (first 2026-08-09 plan → this dispatch)

| Item | Fate |
|---|---|
| 3.1 optional #613 comment (#621/#623 clean ships) | **Carried** → **3.1** (2nd carry — undecided; no new campaign_close evidence arrived to change its content) |
| 3.2 wait vs. deliberate linked-worktree test | **Carried** → **3.2** — variable untested again this firing (repo-cleaner: no merge from inside a linked worktree since #622) |
| 4.1 commit sweep ops delta | **Resolved for that sweep** — `88b429b` landed it; **recurs** → **4.1** for this firing's delta |
| 4.2 trim 17 stale gitignore rules | **Carried** → **4.2** (8th cycle, byte-identical G1 list re-proposed, exit 0) |
| 4.3 encode landing-leg ruling in `chore-lead.md` | **Carried** → **4.3** — no report evidence it landed in nonoun-plugins |

## 1. Gated mutations already verified safe

(none this sweep — PR #623 merged before this firing with branch hygiene already fully clean per
repo-cleaner; no surviving remote branches, 0 open PRs.)

## 2. Blocking other work

(none this sweep — 0 open PRs, no in-flight lanes, no stranded state. #616 remains
upstream-gated: an external wait, not a queue blocker.)

## 3. Human-decision items

### 3.1 Optional: extend #613's clean-ship record with the #621/#623 campaign_close evidence (2nd carry)
- **Action**: decide whether to post the dated corroborating comment on #613 (two more clean
  ships after the #622 survivor), or skip — either resolves the entry. Under the evidence-first
  ruling the load-bearing capture point remains the NEXT SURVIVOR's verbatim `gh pr merge`
  output; this comment is context only, and its marginal value shrinks each clean firing. If
  still undecided next sweep, the planner proposes retiring it.
- **Owner**: Kim (post or skip)
- **Evidence**: prior plan entry 3.1 (proposed-not-posted by repo-cleaner); repo-cleaner
  2026-08-09 second firing — "#613 still has no new evidence this firing"; `rulings.md`
  §"#613 fix path".
- **Size**: 5 min

### 3.2 Decide: wait for a natural #613 test, or run a deliberate linked-worktree merge
- **Action**: the best-fitting root-cause variable (branch checked out in a linked worktree at
  merge time, per #622) went untested again — no qualifying merge occurred this firing. Decide:
  (a) keep the standing evidence-first ruling (wait for the next natural survivor — the default,
  no action needed), or (b) accelerate with one deliberate test: merge a throwaway PR whose
  branch is checked out in a linked worktree and capture `gh pr merge`'s verbatim output.
- **Owner**: Kim (ruling refinement) → host session (runs the test only if (b))
- **Evidence**: repo-cleaner 2026-08-09 — "no merge from inside a linked worktree since #622";
  `rulings.md` — linked-worktree checkout (#622) vs. not checked out anywhere (#618–#621, clean).
- **Size**: 5 min decision; ~30 min test only if (b)

## 4. Hygiene debt

### 4.1 Commit this sweep's ops-state delta once chore-lead lands it (recurring)
- **Action**: after chore-lead's close-out writes this firing's payloads
  (`watch-checkpoint.json` → 2026-08-09T12:34:24Z, this plan,
  `reports/2026-08-09T123459Z.md`), `git add .claude/ops && git commit` on main. The substrate
  is tracked (`1f09816`, prior delta landed at `88b429b`); an uncommitted delta re-opens the
  durability gap.
- **Owner**: host (Kim's session at `/Users/kimba/Projects/nonoun/agent-ui`), after chore-lead's
  landing leg
- **Evidence**: `git log -- .claude/ops/` → `88b429b` (prior sweep landed+committed);
  issue-sorter's checkpoint payload and repo-cleaner's report payload are return-values this
  firing, not yet on disk; `rulings.md` §"Seat-payload landing leg".
- **Size**: 5 min

### 4.2 Trim the 17 stale gitignore rules (8th cycle)
- **Action**: review and trim the rules `gitignore_check.py` flags, byte-identical eight firings
  running: `logs`, `*.log`, `npm-debug.log*`, `yarn-debug.log*`, `yarn-error.log*`,
  `pnpm-debug.log*`, `lerna-debug.log*`, `dist-ssr`, `*.local`, `.vscode/*`, `.idea`, `*.suo`,
  `*.ntvs*`, `*.njsproj`, `*.sln`, `*.sw?`, `.claude/docs/other`. Propose-only per the seat's
  standing rule; one host inline pass ends the recurring flag.
- **Owner**: host inline (apply); repo-cleaner remains propose-only
- **Evidence**: repo-cleaner 2026-08-09 — "same 17 pre-existing G1 stale-rule warnings as every
  prior sweep (unchanged... never executed)", exit 0.
- **Size**: 15 min

### 4.3 Encode the landing-leg ruling into `chore-lead.md` (cross-repo, carried)
- **Action**: one-time change in the harness plugin (nonoun-plugins repo): `chore-lead.md`'s
  body gains the close-out landing leg (seats return payloads; chore-lead writes them to
  `.claude/ops/` before reporting up) as part of its done-condition. Until then every dispatch
  brief must restate the contract manually — this firing's brief mis-stated the planner's write
  path, which is exactly the drift the encoding closes.
- **Owner**: host session in the nonoun-plugins repo (not doable from this checkout)
- **Evidence**: `rulings.md` lines 10–13 (flagged residual); this dispatch's brief asserted the
  planner writes `plan.md` directly, contradicting both the seat definition and the ruling.
- **Size**: ~20 min

## Standing notes (not queue entries)

- **#624 is dev backlog, not ops debt** — main-menu nav polish (`ui-nav-rail` parts), task,
  size:small, assigned kimgranlund, full section contract present (issue-sorter, verified
  against live state). New since the last report; no triage or ops action.
- **#613 stays open** per the evidence-first ruling — standing tracker, not debt; next state
  change is a natural survivor capture (or entry 3.2's ruling refinement).
- **#616 is upstream-gated** (size:small, unassigned, unchanged) — external wait; re-enters ops
  scope only if the gate lifts and it stalls.
- **Repo surface fully clean**: 0 open PRs, 1 worktree (main, in sync with origin/main by SHA),
  1 local branch, origin/main the only remote, HEAD==origin/main.
- Executed-this-sweep actions (176-ADR classify vs `88b429b`, #624 live-state verification,
  `gitignore_check.py` read-only pass) are recorded in the seat reports, not re-queued. Zero
  scripts matched an execution gate.

*Written by chore-planner, 2026-08-09 second sweep. This seat queues; it executed nothing above,
and this file was landed by the dispatching session per the 2026-08-09 landing-leg ruling.*
