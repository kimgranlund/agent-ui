# Ops plan — agent-ui

- **Dispatch**: 2026-08-09, sweep mode (chore-lead fan-out; three seat reports attached —
  decision-watcher, issue-sorter, repo-cleaner; nothing refetched). Prior plan read as
  carry-forward source; durable state (`rulings.md`, git tracking state) consulted to verify
  between-sweep resolutions.
- **Seats**: decision-watcher 🟢 (176/176 ADRs clean, zero delta; harvest queue cleared to
  `{"candidates": []}`) · issue-sorter 🟢 (nothing to classify; 2 open issues, 0 open PRs;
  checkpoint → 2026-08-09T12:01:20Z) · repo-cleaner 🟢 (1 worktree, 1 branch, all merged;
  campaign_close for #621/#623 both already-gone; one 🟡 risk flagged) — 3/3 returned, no
  UNMEASURED sections.
- **Supersedes**: the fourth 2026-08-08 plan; per-item disposition below.
- **Verdict**: cleanest board since the ops seats began — every human-gated entry from the prior
  plan resolved between sweeps (four Kim rulings landed in `rulings.md`, the ops substrate got
  tracked at `1f09816`, PR #621 merged and the S5 lane shipped). Five small entries remain: two
  optional human decisions and three hygiene items; nothing blocks anything.

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## Prior-plan disposition (fourth 2026-08-08 plan → this dispatch)

| Item | Fate |
|---|---|
| 1.1 post #613 evidence comment | **Resolved** — #613's dated 2026-08-09 comment exists (cited by `rulings.md` §"#613 fix path"); residual optional extension → **3.1** |
| 2.1 merge PR #621 | **Resolved** — merged between sweeps; campaign_close this firing found the branch already gone; 0 open PRs repo-wide |
| 2.2 commit `.claude/ops/` | **Resolved** — commit `1f09816` tracks the ops substrate (6-cycle carry ended); recurring residual (commit each sweep's delta) → **4.1** |
| 3.1 rule the #613 fix path | **Resolved** — RULED 2026-08-09 evidence-first: tracker stays open, capture `gh pr merge` verbatim output at the next survivor; residual untested variable → **3.2** |
| 3.2 harvest confirm 0173/0174/0175 | **Resolved** — RULED 2026-08-09 harvest all three; dispatched and landed; `adr-queue.json` now empty (decision-watcher) |
| 3.3 ops-state landing-leg ruling | **Resolved** — RULED 2026-08-09: chore-lead lands all seat payloads at close-out; flagged cross-repo residual (encode in `chore-lead.md`) → **4.3** |
| 3.4 friendlies `standing_rule` | **Resolved** — RULED hold-first-filing (2026-08-08, re-confirmed 08-09; recorded in `friendlies.json`'s policy block) |
| 4.1 trim 17 stale gitignore rules | **Carried** → **4.2** (7th cycle, byte-identical G1 list re-proposed) |

## 1. Gated mutations already verified safe

(none this sweep — campaign_close for #621 and #623 found both remote branches already absent;
verification only, no surviving mutations to queue.)

## 2. Blocking other work

(none this sweep — 0 open PRs, no in-flight lanes, no stranded state. #616 is upstream-gated:
an external wait, not a queue blocker.)

## 3. Human-decision items

### 3.1 Optional: extend #613's clean-ship record with this sweep's evidence
- **Action**: decide whether to post a dated comment on #613 adding this firing's
  campaign_close results (#621 and #623, both branches already absent — two more clean ships
  after the #622 survivor). Explicitly proposed-not-posted by repo-cleaner ("human call"). Under
  the evidence-first ruling the load-bearing capture point is the NEXT SURVIVOR's verbatim
  `gh pr merge` output, so this comment is corroborating context, not required protocol.
- **Owner**: Kim (post it, or skip — either resolves the entry)
- **Evidence**: repo-cleaner 2026-08-09 — "optionally attach this sweep's campaign_close
  evidence to #613 extending its clean-ship run (human call, not posted by repo-cleaner)";
  `rulings.md` §"#613 fix path" (evidence-first, 2026-08-09).
- **Size**: 5 min

### 3.2 Decide: wait for a natural #613 test, or run a deliberate linked-worktree merge
- **Action**: repo-cleaner's one 🟡 — the best-fitting root-cause variable (branch checked out
  in a linked worktree at merge time, per the #622 evidence) went untested again this firing
  because no merge happened from inside a linked worktree. Decide whether to (a) keep the
  standing evidence-first ruling as-is (wait; capture verbatim output at the next natural
  survivor — the default, no action needed), or (b) accelerate with one deliberate test: merge a
  throwaway PR whose branch is checked out in a linked worktree and capture `gh pr merge`'s
  verbatim output.
- **Owner**: Kim (ruling refinement) → host session (runs the test only if (b))
- **Evidence**: repo-cleaner 2026-08-09 🟡 — "#613's root cause (worktree-checkout variable)
  still not conclusively tested — no merge happened from inside a linked worktree this firing";
  `rulings.md` — "Best-fitting variable so far: branch checked out in a linked worktree at merge
  time (#622) vs. not checked out anywhere (#618–#621, clean)."
- **Size**: 5 min decision; ~30 min test only if (b)

## 4. Hygiene debt

### 4.1 Commit this sweep's ops-state delta once chore-lead lands it (new, recurring)
- **Action**: after chore-lead's close-out writes this sweep's payloads (cleared
  `adr-queue.json`, `watch-checkpoint.json` → 2026-08-09T12:01:20Z, this plan, seat reports),
  `git add .claude/ops && git commit` on main. Now that the substrate is tracked (`1f09816`),
  each sweep leaves modified tracked files; an uncommitted delta re-opens the durability gap the
  6-cycle entry just closed.
- **Owner**: host (Kim's session at `/Users/kimba/Projects/nonoun/agent-ui`), after chore-lead's
  landing leg
- **Evidence**: commit `1f09816` (substrate tracked); `rulings.md` §"Seat-payload landing leg" —
  chore-lead writes, but committing is a git mutation outside its leg; on-disk checkpoint
  (04:38) predates this sweep's reported 12:01:20Z advance, confirming the delta is not yet
  landed.
- **Size**: 5 min

### 4.2 Trim the 17 stale gitignore rules (7th cycle)
- **Action**: review and trim the rules `gitignore_check.py` flags, byte-identical seven firings
  running: `logs`, `*.log`, `npm-debug.log*`, `yarn-debug.log*`, `yarn-error.log*`,
  `pnpm-debug.log*`, `lerna-debug.log*`, `dist-ssr`, `*.local`, `.vscode/*`, `.idea`, `*.suo`,
  `*.ntvs*`, `*.njsproj`, `*.sln`, `*.sw?`, `.claude/docs/other`. Propose-only per the seat's
  standing rule; one host inline pass ends the recurring flag.
- **Owner**: host inline (apply); repo-cleaner remains propose-only
- **Evidence**: repo-cleaner 2026-08-09 — "same 17 pre-existing G1 stale-rule warnings as every
  prior sweep, exit 0, proposed-not-executed."
- **Size**: 15 min

### 4.3 Encode the landing-leg ruling into `chore-lead.md` (cross-repo, flagged by the ruling)
- **Action**: the 2026-08-09 landing-leg ruling names its own residual: until the agent
  definition itself carries the contract, every chore-lead dispatch brief must restate it
  manually. Make the one-time change in the harness plugin (nonoun-plugins repo):
  `chore-lead.md`'s body gains the close-out landing leg (seats return payloads; chore-lead
  writes them to `.claude/ops/` before reporting up) as part of its done-condition.
- **Owner**: host session in the nonoun-plugins repo (not doable from this checkout)
- **Evidence**: `rulings.md` lines 10–13 — "encoding this into `chore-lead.md`'s own body is a
  separate change in that repo (nonoun-plugins), flagged, not done from here."
- **Size**: ~20 min

## Standing notes (not queue entries)

- **#613 stays open** per the evidence-first ruling — it is the standing tracker, not debt; its
  next state change is a natural survivor capture (or entry 3.2's ruling refinement).
- **#616 is upstream-gated** (size:small, unchanged per issue-sorter) — dev backlog waiting on
  an external party; re-enters ops scope only if the gate lifts and it stalls.
- **Repo surface fully clean**: 0 open PRs, 1 worktree (main), 1 local branch (main), prior
  sweep's `feat/614` checkout returned to main, 2 stale remote-tracking refs pruned this firing.
- Executed-this-sweep actions (campaign_close verification #621/#623, `git fetch --prune`,
  176-ADR classify, checkpoint advances, `gitignore_check.py` read-only) are recorded in the
  seat reports, not re-queued. `sync_main.py` correctly not run (tree clean).

*Written by chore-planner, 2026-08-09 sweep. This seat queues; it executed nothing above, and
this file was landed by the dispatching session per the 2026-08-09 landing-leg ruling.*
