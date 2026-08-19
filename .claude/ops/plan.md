<!-- target-path: .claude/ops/plan.md -->
# Ops plan — agent-ui

- **Dispatch**: 2026-08-19T04:5xZ sweep firing (chore-planner, /sweep-chores, sweep mode — three
  attached seat reports: decision-watcher, issue-sorter, repo-cleaner; timestamps per the reports
  themselves).
- **Evidence**: exactly the three attached reports plus the prior plan (2026-08-18T15:20Z
  compose, carry-forward only). Nothing refetched.
- **UNMEASURED seats**: none — the dispatch declared the unmeasured list empty ([]), and all
  three seats reported reachable sources (gh auth OK, both issue-sorter checkpoint entries
  advanced; decision-watcher scanned the full 205-ADR corpus; repo-cleaner fetched/pruned live).
  One measurement gap named where it matters: the reports sweep an update WINDOW, not the open
  board — #1282's current open/closed state is not in this firing's evidence (see 3.2).
- **Payload-fence audit (ops-write-sandbox-rules)**: decision-watcher — clean no-op, no blocks
  owed per the no-op clause. issue-sorter — one fenced block (`watch-checkpoint.json`),
  friendlies/held-items correctly omitted as unchanged. repo-cleaner — report fenced at
  `.claude/ops/reports/2026-08-19T045557Z.md`. No narrated-but-absent writes this firing.
- **Corrections vs the prior plan**: 1.1 (rollback repair) DONE — issue-sorter's window opens at
  the HEAD checkpoint value `2026-08-18T01:43:55Z`, proving HEAD's watch-checkpoint was live
  state at this firing, not the stale 2026-08-17 copy. 1.2 (land plan) DONE — the applied state
  the seats read presupposes it. 2.1 (re-fire decision-watcher) DONE — this firing's
  decision-watcher checkpoint covers 205 ADRs incl. 0206 at current hash/status, clean delta.
  3.1 (batched harvest confirm) RESOLVED-BY-EVIDENCE — `adr-queue.json` is empty
  (`{"candidates": []}`): no pending rows exist to enumerate for the ask; the entry's
  precondition is gone. 3.2 carries forward (see below). 4.1 carries forward. No prior entry
  dropped as parked — no id in this plan gained a `backlog`/`roadmap` label in evidence.
- **needs-ruling lane**: none — issue-sorter reports zero ruling-shaped items this firing.
- **Blocked-by convention (#193)**: no literal `Blocked-by:` lines in evidence this firing. The
  one operational ordering edge (2.1 gated on PR #1322's live session) is named inline in 2.1
  and in 1.2's caveat.
- **Verdict**: heavy-but-healthy hygiene firing — repo-cleaner closed 19 merged-PR remote
  branches + 24 orphaned local branches and pruned 17 stale refs; ADR and intake lanes are both
  clean no-ops. The queue is one verified-safe remote-branch delete, the landing leg, one
  off-main-primary timing item, two human calls (`deploy-main2`, #1282 ownership), and the
  standing upstream pin.

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## 1. Gated mutations already verified safe

### 1.1 Delete `origin/corpus-judged-wave-2026-08-18` — no PR, content already on main (dispatching host; 2 min)
- **Action**: `git push origin --delete corpus-judged-wave-2026-08-18`. Repo-cleaner verified
  both safety gates: `gh pr list --head` empty for EVERY state (no PR object ever existed for
  this ref), and the branch tip is already an ancestor of `origin/main` — nothing unmerged.
  `campaign_close.py` doesn't apply (needs a PR number) and `reap-branches.mjs` is local-only,
  so this one push is the whole action.
- **Owner**: dispatching host (repo-cleaner classified it propose-only; the verification is done,
  the execution is one gated push).
- **Evidence**: repo-cleaner firing report `.claude/ops/reports/2026-08-19T045557Z.md`
  (Inventory + Proposed-but-not-executed sections).
- **Size**: 2 minutes.

### 1.2 Land this sweep's ops state — payloads + this plan, ops paths ONLY (dispatching host; 5 min)
- **Action**: apply the three payload blocks (`.claude/ops/reports/2026-08-19T045557Z.md`,
  `.claude/ops/watch-checkpoint.json`, this plan), then `git add` exactly those ops paths and
  commit. CAVEAT, named inline: the primary checkout sits on `fix/a2ui-catalog-empty-specimens`
  (dirty, open PR #1322, a live session's WIP — see 2.1) — the commit lands on that branch, not
  `main`. Either accept that it rides to main via #1322's merge, or hold the push until 2.1
  resolves — never switch the live session's branch to land it (#592 class). Do NOT stage
  `sweep-in-flight.json` (live marker) or the session's own `.claude/docs/roadmap.md` WIP.
- **Owner**: dispatching host (the ops-write split's dispatching session).
- **Evidence**: ops-write-sandbox-rules (payloads applied by the dispatcher, verbatim);
  repo-cleaner's inventory — primary branch, dirty paths, PR #1322 open.
- **Size**: 5 minutes.

## 2. Blocking other work

### 2.1 Return the primary checkout to `main` — blocked by PR #1322's live session (open), named inline (that session's owner → host; 5 min once unblocked)
- **Action**: once the session owning `fix/a2ui-catalog-empty-specimens` (uncommitted
  `.claude/docs/roadmap.md` edit, PR #1322, 6 ahead / 14 behind `origin/main`) merges or parks
  its work: `git checkout main && git pull`. Do not start before that session resolves —
  switching a live peer's branch is the #592 mistake. Until then this P1 blocks clean ops-state
  landing (1.2's caveat) and any main-based dispatch from the primary. Blocker is a live PR
  lane, not a plan entry — nothing to queue behind.
- **Owner**: the session owning PR #1322 resolves; dispatching host executes the switch.
- **Evidence**: repo-cleaner `primary_checkout_check.py` → FAIL P1 (report
  `.claude/ops/reports/2026-08-19T045557Z.md`); risk class unchanged from the prior firing,
  different branch.
- **Size**: 5 minutes once unblocked.

## 3. Human-decision items

### 3.1 `deploy-main2` worktree — confirm purpose, then document or remove (Kim; 5 min)
- **Action**: a detached-HEAD worktree at `29456f06` sits as an untracked sibling directory
  INSIDE the primary tree (`?? deploy-main2/`), not under `.claude/worktrees/`, referenced
  nowhere in `.claude/docs/` or `.claude/ops/`. Rule it: intentional deploy-verification
  checkout (→ document it, one line in ops or docs) or stale cruft (→
  `git worktree remove deploy-main2`). Repo-cleaner's one unresolvable open question this
  firing — genuinely ambiguous, never guessed at.
- **Owner**: Kim (the ruling); host executes whichever branch.
- **Evidence**: repo-cleaner report, Inventory + Open questions.
- **Size**: 5 minutes to rule; execution ≤2 minutes either way.

### 3.2 Issue #1282 — ADR-0203 booked repairs still need an owner; state UNVERIFIED this firing (Kim/host; minutes to assign)
- **Action**: carried forward from the prior plan (its 3.2). This firing's reports measure an
  update window, not the open board, so #1282's current state is unmeasured here — verify with
  one `gh issue view 1282 --json state` before acting; if CLOSED, drop this entry at the next
  compose. If still open: assign + dispatch a build seat, or schedule into the next campaign.
  Execution is dev work, not this queue's — only the ownership decision is queued.
- **Owner**: Kim (or host under standing autonomy) assigns; a build seat executes.
- **Evidence**: prior plan 3.2 (carry-forward; `gh issue view 1282` at that compose: OPEN,
  unassigned, `task`, no `Blocked-by:` line). No fresher evidence in this firing's reports.
- **Size**: minutes to verify + assign.

## 4. Hygiene debt

### 4.1 nonoun-plugins#46 — ratify-only-flip hash gap, still open upstream; pin stands (upstream lane; 0 min here)
- **Action**: carried forward (no evidence it closed). INTERIM PIN unchanged: when Kim ratifies
  an amendment on an already-`accepted` ADR with no body-byte change, the host re-dispatches
  decision-watcher with an explicit "re-judge adr-00NN amendment" instruction. This firing was
  safe — decision-watcher's clean delta covered the full 205-file corpus incl. 0206.
- **Owner**: nonoun-plugins upstream (the script fix) · dispatching host (the pin, per firing) ·
  Kim (unparking the upstream bundle).
- **Evidence**: prior plan 4.1 (carry-forward); this firing's decision-watcher report (clean
  no-op, checkpoint current).
- **Size**: 0 minutes here; small tooling task upstream.

## Standing notes (not queue entries)

- **Executed hygiene this firing (no queue entries needed)**: 19 merged-PR remote branches
  closed via `campaign_close.py` (all clean/exit 0, reverified gone) + 24 orphaned
  `worktree-agent-*` local branches reaped via `reap-branches.mjs` (dry-run first, then
  `--execute`, exit 0) + 17 stale `origin/*` refs pruned. The reap script correctly kept both
  live-worktree branches and PR #1334's branch.
- **Two locked agent worktrees are LIVE lanes, not cruft**: `agent-a16738afbb1c8340f`
  (`1340-skills-import-build`) and `agent-a820336c01922f258` (`1321-text-registers-build`).
- **PR #1334** (`fix/radio-group-value-before-children`, 3 pending commits): healthy open lane —
  dev work, not this queue's.
- **Intake lane clean**: 75 issues + 92 PRs in the window, all pre-classified, all
  operator-authored, zero mints, zero holds, zero `needs-ruling`; step-8 MCP offer already
  recorded declined (2026-08-05).
- **gitignore G1 noise** (6 stale rules): standing Kim-ruled keep-list, never re-proposed.
- **`.claude/ops/sweep-in-flight.json`**: this sweep's live marker — never staged, never cruft
  while a sweep runs.
- **gen-ui-kit**: out of this board's scope (dedicated session per Kim's ruling).

*Composed by chore-planner, 2026-08-19T04:5xZ sweep firing — returned as payload per the #125
ops-write split; written and landed by the dispatching session.*
