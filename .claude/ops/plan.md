# Ops plan — agent-ui

- **Dispatch**: 2026-08-09, fourth sweep of the day (chore-lead fan-out; three seat reports
  attached — decision-watcher, issue-sorter, repo-cleaner; nothing refetched). Prior plan read as
  carry-forward source; `rulings.md` + `git log/status -- .claude/ops/` consulted only to
  cross-check landings.
- **Seats**: decision-watcher 🟢 (177 ADRs scanned, 1 new — adr-0178, proposed, impact detector
  correctly not fired; queue stays empty, harvest trio rows cleared/landed) · issue-sorter 🟢
  (8 issues + 5 PRs touched since checkpoint 13:12:44Z; all authored by the sole friendly; zero
  holds, zero mints needed; #634 new + shape-complete; checkpoint → payload) · repo-cleaner 🟢
  (PR #636 verified MERGED at 14:50:17Z mid-window, correcting the dispatch's "known-live" prior;
  worktree `agent-a76f2b0def232c02f` proven merged-and-stale by zero-diff vs. main; gitignore
  17→8; `campaign_close.py 636` exit 0 clean no-op) — 3/3 returned, no UNMEASURED sections.
- **Supersedes**: the third 2026-08-09 plan; per-item disposition below.
- **Verdict**: cleanest sweep of the day — the #613 arc is fully CLOSED (root-caused via the
  PR #627 deliberate probe; both carried decision entries retire), zero open PRs, main clean.
  Close-out executed live (this session had shell access chore-lead's dispatch lacked): 1.1
  self-resolved by a concurrent session, 4.1 and 4.2 committed + pushed (`7bed879`, `c4e043e5`).
  Only 3.1 (Kim's ADR-0178 ratify/return) and 4.3 (cross-repo `chore-lead.md` encode) remain open.

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## Prior-plan disposition (third 2026-08-09 plan → this dispatch)

| Item | Fate |
|---|---|
| 3.1 post #613 evidence + rule write-back ownership | **Retired — both halves ruled** 2026-08-09: evidence write-backs belong to chore-lead's landing leg (`rulings.md`), first comment posted by host; #613 subsequently CLOSED root-caused |
| 3.2 wait vs. deliberate linked-worktree test | **Retired — resolved** by the same-day ruling (deliberate test) and its execution: PR #627 probe (`11226e1`, cleanup `baf2e12`), verbatim output on #613, root cause = worktree-held-branch merge rule |
| 4.1 commit sweep ops delta | **Resolved for that sweep** (landings `88b429b`/`643cc5f` + successors in history); **recurs** → **4.1** for this firing's live delta |
| 4.2 trim 17 stale gitignore rules | **Carried, scope reduced** → **4.2** — PR #632 retired 9 of 17; 8 remain (one NEW: `.vitest-attachments/`); the "after #626 ships" gate has lifted (#626 closed via merged #629/#632) |
| 4.3 encode landing-leg ruling in `chore-lead.md` | **Carried** → **4.3**, widened — the evidence-write-back ruling rides the same nonoun-plugins change per `rulings.md` |
| Standing note: #626 live build | **Retired** — #626 closed via merged #629/#632; working tree clean, `sync_main.py` withholding no longer applies |

## 1. Gated mutations already verified safe

### 1.1 Reap the merged-stale worktree `agent-a76f2b0def232c02f` — DONE (self-resolved)
- **Status**: closed. By the time this queue's close-out leg checked `git worktree list`, the
  worktree and its branch were already gone — another concurrent session in this workspace reaped
  it independently between repo-cleaner's report and this verification pass. No action taken here;
  confirmed absent (`git worktree list` shows only the primary checkout, `git branch -a` has no
  `633`/`worktree-agent` match).
- **Evidence**: repo-cleaner report `.claude/ops/reports/2026-08-09T145512Z.md` (original
  zero-diff proof) + this close-out's live re-check, 2026-08-09.

## 2. Blocking other work

(none this sweep — 0 open PRs, main clean and even with origin/main, no stranded ops lanes.
The #633 family is the live dev arc and just advanced via #636's merge; #616 remains an external
upstream wait, not a queue blocker.)

## 3. Human-decision items

### 3.1 Ratify — or return — ADR-0178 (agent-authoring flow, GH #633)
- **Action**: Kim rules on ADR-0178 ("Agent-authoring flow (GH #633): conversational persona
  hydration"), currently `proposed` — a legitimate hold, never agent-flipped. If accepted, flip
  via the ratification path (`adr_ratify.py` covers proposed→accepted). Follow-on is automatic:
  the ADR's content hash is now tracked, so the status flip registers as `amended` at the next
  decision-watcher firing and gets judged for harvest then (decision-watcher flags it as likely
  clearing the impact bar — substantial multi-clause decision).
- **Owner**: Kim (ratification is owner-only)
- **Evidence**: decision-watcher handoff 2026-08-09 — 177 scanned, 1 new (`adr-0178`), status
  `proposed`, detector correctly not fired; hash basis in `.claude/ops/adr-checkpoint.json`.
- **Size**: ~15 min (read + flip)

## 4. Hygiene debt

### 4.1 Land this firing's ops-state delta (recurring) — DONE
- **Status**: closed. Committed `7bed879` on `main` (`adr-checkpoint.json`, `watch-checkpoint.json`,
  `reports/2026-08-09T145512Z.md`, this `plan.md`), scoped to `.claude/ops/` only — the two
  unrelated dirty `site/pages/agent-admin-*` files (another live session's in-progress work) were
  left untouched. Pushed to `origin/main` (`70c4b3ad..7bed8799`).
- **Owner**: chore-lead's own close-out (this dispatch's landing leg, per the standing ruling)
- **Evidence**: `git log -- .claude/ops/` → `7bed879`; `rulings.md` §"Seat-payload landing leg".

### 4.2 Trim the 8 remaining stale gitignore rules (carried, reduced scope) — DONE
- **Status**: closed. Retired all 8 `G1`-flagged lines (`*.log`, `npm-debug.log*`, `*.local`,
  `.vscode/*` + its now-orphaned `!.vscode/extensions.json` exception, `.idea`, `*.sw?`,
  `.claude/docs/other`, `.vitest-attachments/`). Verified `git status` showed no newly-untracked
  junk after the trim (nothing was silently relying on those ignores). Committed `c4e043e5`,
  pushed to `origin/main`.
- **Owner**: host inline (apply); repo-cleaner remains propose-only
- **Evidence**: repo-cleaner this firing — `gitignore_check.py` exit 0, 8 warnings verbatim in
  `reports/2026-08-09T145512Z.md`; `git log -- .gitignore` → `c4e043e5`.

### 4.3 Encode the landing-leg + evidence-write-back rulings into `chore-lead.md` (cross-repo, carried)
- **Action**: one change in the harness plugin (nonoun-plugins repo): `chore-lead.md`'s body
  gains (a) the close-out landing leg (seats return payloads; chore-lead writes `.claude/ops/`
  before reporting up) and (b) evidence write-back ownership (chore-lead posts dated tracker
  comments from seat evidence) — both RULED 2026-08-09, both currently enforced only via
  dispatch-prompt text.
- **Owner**: host session in the nonoun-plugins repo (not doable from this checkout)
- **Evidence**: `rulings.md` §"Seat-payload landing leg" + §"Evidence write-backs" — both name
  the agent-definition encode as the flagged residual; no report evidence it landed.
- **Size**: ~20 min

## Standing notes (not queue entries)

- **#613 is CLOSED, root-caused** — the worktree-held-branch merge rule (`gh pr merge
  --delete-branch` aborts before the remote delete when the branch is checked out in a linked
  worktree; PR #627 probe, verbatim on #613). Practice rule stands: reap worktrees before
  `--delete-branch` merges; repo-cleaner's sweep is the safety net. The clean-ship ledger retires
  with it.
- **#633 is the live dev arc** (`doing`, unassigned by convention, advanced by #636's merge) —
  dev work, outside ops classification. Its design contract is queue entry 3.1's ADR-0178.
- **#634** — fresh bug, `size:big`, shape-complete per issue-sorter — dev backlog, not ops debt.
- **#616 upstream-gated, unchanged** every sweep — external wait; re-enters ops scope only if the
  gate lifts and it stalls.
- **adr-queue.json is empty** — the ADR-0173/0174/0175 harvest rows have advanced off the queue;
  no landing residue.
- **friendlies.json and held-items.md unchanged**; every discovered item this firing was authored
  by the sole friendly; `github_mcp_offer` stays declined (2026-08-05), correctly not re-offered.
- **Priors decay inside sweep windows** (repo-cleaner's 🟡, second instance of the lesson): the
  "known-live" worktree prior went stale between dispatch and verification. Every prior carried
  into a sweep needs live re-verification, not inheritance — dispatch briefs should state priors
  as of-a-timestamp, never as facts.
- Executed-this-sweep actions (ADR scan, `campaign_close.py 636`, `gitignore_check.py`
  read-only, `git fetch --prune`) are recorded in the seat reports, not re-queued.

*Written by chore-planner, 2026-08-09 fourth sweep. Landed by chore-lead's close-out per the
landing-leg ruling.*
