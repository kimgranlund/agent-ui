# Ops plan — agent-ui

- **Dispatch**: 2026-08-09, third sweep of the day (chore-lead fan-out; three seat reports
  attached — decision-watcher, issue-sorter, repo-cleaner; nothing refetched). Prior plan read as
  carry-forward source; `rulings.md` + live git tracking state consulted only to cross-check
  landings.
- **Seats**: decision-watcher 🟢 (176/176 ADRs unchanged, zero candidates; harvest trio
  0173/0174/0175 verified landed at PR #623 / `91af427`; checkpoint + queue files already match —
  nothing to land) · issue-sorter 🟢 (#626 opened = the live build, correctly minted; #624 closed
  via merged PR #625; zero unknown filers; checkpoint payload → 2026-08-09T13:12:44Z) ·
  repo-cleaner 🟢 (campaign_close.py 625 exit 0, branch cleanly absent; 9th identical G1 list,
  exit 0; sync_main.py correctly withheld — live build) — 3/3 returned, no UNMEASURED sections.
- **Supersedes**: the second 2026-08-09 plan; per-item disposition below.
- **Verdict**: steady-state clean with one escalation — both issue-sorter and repo-cleaner
  independently surfaced the same #613 evidence item and neither is chartered to post it; that
  write-back ownership gap is now queue entry 3.1 (Kim rules once, host posts). Zero gated
  mutations, zero blockers.

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## Prior-plan disposition (second 2026-08-09 plan → this dispatch)

| Item | Fate |
|---|---|
| 3.1 optional #613 comment (#621/#623 clean ships) | **Escalated** → **3.1** — new evidence arrived (#625 clean ship + the fetch-prune methodology lesson), and the retire-if-undecided proposal is withdrawn: value went up, not down |
| 3.2 wait vs. deliberate linked-worktree test | **Carried** → **3.2** (3rd carry — #625's branch was checked out nowhere, so the variable went untested again) |
| 4.1 commit sweep ops delta | **Resolved for that sweep** — `643cc5f` landed it; **recurs** → **4.1** for this firing's delta |
| 4.2 trim 17 stale gitignore rules | **Carried** → **4.2** (9th cycle, byte-identical G1 list, exit 0) |
| 4.3 encode landing-leg ruling in `chore-lead.md` | **Carried** → **4.3** — no report evidence it landed in nonoun-plugins |
| Standing note: #624 dev backlog | **Retired** — #624 closed via merged PR #625 this firing |

## 1. Gated mutations already verified safe

(none this sweep — repo-cleaner already executed the one candidate, `campaign_close.py 625`
(exit 0, C2 branch already absent from remote, clean no-op); no surviving remote branches,
0 open PRs.)

## 2. Blocking other work

(none this sweep — #626 is the live dev build, deliberately outside ops classification; no
stranded state, no in-flight ops lanes. #616 remains upstream-gated: an external wait, not a
queue blocker.)

## 3. Human-decision items

### 3.1 Post the #613 evidence comment — and rule who owns evidence write-backs (escalated)
- **Action**: two rulings in one stroke. (a) Post-or-skip: one dated comment on #613 carrying
  this firing's evidence — PR #625 shipped clean (branch `task/624-nav-polish` gone, no
  survivor; clean-ship record now #618–#621 + #625 clean vs. #622 the lone survivor) plus the
  methodology lesson (an apparent survivor in `git branch -r` was a stale LOCAL remote-tracking
  ref; `git fetch --prune` must precede any survivor classification). Unlike the prior optional
  comment, the methodology lesson is load-bearing for the next survivor capture — recommended:
  post. (b) Standing: both issue-sorter and repo-cleaner surfaced this item and neither is
  chartered to post a `gh issue comment` — rule who owns evidence write-backs going forward
  (candidate: chore-lead's landing leg; a comment is not a source mutation).
- **Owner**: Kim (both rulings) → host session at this repo (runs `gh issue comment 613` if (a)
  = post)
- **Evidence**: issue-sorter — "worth relaying to #613, which issue-sorter itself cannot post";
  repo-cleaner proposed-not-executed item (2); chore-lead's dispatch flagging the shared gap;
  `rulings.md` §"#613 fix path" (now amended with the fetch-prune lesson, 2026-08-09).
- **Size**: 10 min (rulings + post)

### 3.2 Decide: wait for a natural #613 test, or run a deliberate linked-worktree merge (3rd carry)
- **Action**: the best-fitting root-cause variable (branch checked out in a linked worktree at
  merge time, per #622) went untested again — #625's branch was checked out nowhere and shipped
  clean, consistent with the hypothesis but not a test of it. Decide: (a) keep the standing
  evidence-first ruling (wait — the default, no action), or (b) accelerate: merge a throwaway PR
  whose branch is checked out in a linked worktree and capture `gh pr merge`'s verbatim output.
- **Owner**: Kim (ruling refinement) → host session (runs the test only if (b))
- **Evidence**: repo-cleaner + issue-sorter this firing (clean-ship pattern extended);
  `rulings.md` — #622 (linked-worktree checkout) vs. #618–#621, #625 (not checked out, clean).
- **Size**: 5 min decision; ~30 min test only if (b)

## 4. Hygiene debt

### 4.1 Commit this sweep's ops-state delta (recurring)
- **Action**: this firing's payloads are landed by this close-out (watch-checkpoint.json →
  both `gh_issues` and `gh_prs` `last_successful_check` = "2026-08-09T13:12:44Z";
  `reports/2026-08-09T131234Z.md`; this plan; the rulings.md fetch-prune amendment).
  `git add .claude/ops && git commit` on main — stage `.claude/ops` ONLY, since the working tree
  carries uncommitted #626 build files that must not ride along. decision-watcher's two files
  need no change this firing.
- **Owner**: chore-lead's own close-out (this dispatch), then report up
- **Evidence**: `git log -- .claude/ops/` → `643cc5f` (prior delta landed); `git status` →
  #626 dev files dirty; issue-sorter's "Needed landing" block; `rulings.md` §"Seat-payload
  landing leg".
- **Size**: 5 min

### 4.2 Trim the 17 stale gitignore rules (9th cycle)
- **Action**: review and trim the rules `gitignore_check.py` flags, byte-identical nine firings
  running: `logs`, `*.log`, `npm-debug.log*`, `yarn-debug.log*`, `yarn-error.log*`,
  `pnpm-debug.log*`, `lerna-debug.log*`, `dist-ssr`, `*.local`, `.vscode/*`, `.idea`, `*.suo`,
  `*.ntvs*`, `*.njsproj`, `*.sln`, `*.sw?`, `.claude/docs/other`. Propose-only per the seat's
  standing rule; one host inline pass ends the recurring flag.
- **Owner**: host inline (apply); repo-cleaner remains propose-only
- **Evidence**: repo-cleaner this firing — "same 17 pre-existing G1 stale-rule warnings as every
  prior sweep", exit 0, no regression.
- **Size**: 15 min

### 4.3 Encode the landing-leg ruling into `chore-lead.md` (cross-repo, carried)
- **Action**: one-time change in the harness plugin (nonoun-plugins repo): `chore-lead.md`'s
  body gains the close-out landing leg (seats return payloads; chore-lead writes them to
  `.claude/ops/` before reporting up) as part of its done-condition. If entry 3.1(b) rules that
  evidence write-backs are also chore-lead's, encode that in the same change.
- **Owner**: host session in the nonoun-plugins repo (not doable from this checkout)
- **Evidence**: `rulings.md` §"Seat-payload landing leg" (flagged residual, still open); no
  report evidence it landed.
- **Size**: ~20 min

## Standing notes (not queue entries)

- **#626 is the live build** (bar-inset unification, size:big, `doing`, correctly minted) — the
  working tree's dirty files are its state; excluded from all hygiene classification, and
  `sync_main.py` stays withheld while it runs.
- **#613 stays open** per the evidence-first ruling — standing tracker, not debt; clean-ship
  record now 5 clean (#618–#621, #625) vs. 1 survivor (#622). Next state change: a natural
  survivor capture, or entry 3.2's ruling.
- **#616 upstream-gated, unchanged** (updatedAt before checkpoint) — external wait; re-enters ops
  scope only if the gate lifts and it stalls.
- **friendlies.json and held-items.md unchanged** this firing; github_mcp_offer stays declined
  (2026-08-05), correctly not re-offered.
- Executed-this-sweep actions (ADR scan vs. checkpoint, `campaign_close.py 625`,
  `gitignore_check.py` read-only) are recorded in the seat reports, not re-queued.

*Written by chore-planner, 2026-08-09 third sweep. Landed by chore-lead's close-out per the
2026-08-09 landing-leg ruling.*
