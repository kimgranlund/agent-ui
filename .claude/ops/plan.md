# Ops plan — agent-ui
<!-- target-path: .claude/ops/plan.md -->

- **Dispatch**: 2026-08-09, sixth sweep of the day (chore-lead fan-out; three seat reports
  attached — decision-watcher, issue-sorter, repo-cleaner; nothing refetched). Prior plan (fifth
  sweep) read as carry-forward source. Main verified clean at `af956bfc`, even with origin.
- **Seats**: decision-watcher 🟢 (177 ADRs scanned, 0 delta; the ADR-0178 harvest candidate
  RECONCILED AS LANDED — PR #623 covered the 0173/0174/0175 ruling, PR #648 landed 0178's own
  harvest into `agent-ui-a2ui-meta-line-facts/SKILL.md`, content verified verbatim on disk;
  `adr-queue.json` cleared to `{"candidates": []}`) · issue-sorter 🟢 (open issues exactly
  #616 + #651, 0 open PRs, 7-day gating sweep of 100 items all friendly-authored, zero holds;
  payload = checkpoint bump to 20:20:14Z) · repo-cleaner 🟢 on substance / 🟡 on payload form
  (field clean: 1 live peer worktree correctly untouched, remotes = origin/main only, no
  #613-class survivors, gitignore G1 warnings 7 — but its report-file payload block carried only
  the target path, not the content, so chore-lead correctly did NOT land it) — 3/3 returned,
  no UNMEASURED sections.
- **Supersedes**: the fifth 2026-08-09 plan; per-item disposition below.
- **Verdict**: steady-state with one flag. Ops surface fully drained — no gated mutations, no
  blockers, and (new this firing) no pending human decisions: the ADR harvest queue is empty.
  The flag: this firing's repo-cleaner report artifact did not land
  (`.claude/ops/reports/2026-08-09T202038Z.md` — malformed payload fence), leaving a gap in the
  append-only report history; queued as hygiene 4.2.

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## Prior-plan disposition (fifth 2026-08-09 plan → this dispatch)

| Item | Fate |
|---|---|
| 3.1 confirm-gate the ADR-0178 harvest candidate | **Resolved — landed, gate overtaken.** The harvest shipped to main via PR #648 (personaPatch worked example + apply-gate write-discipline axis, verified verbatim in SKILL.md by decision-watcher); the 0173–0175 "harvest all three" ruling had already landed via PR #623 (`91af4274`). Queue row cleared; no successor entry |
| 4.1 land sweep ops delta (recurring) | **Resolved for that sweep; recurs** → **4.1** below for this firing's payloads |
| 4.2 encode landing-leg + write-back rulings in `chore-lead.md` (cross-repo) | **Carried ×3** → **4.3** — no report or repo evidence it landed in nonoun-plugins; this firing's malformed-payload incident adds a third clause to encode |

## 1. Gated mutations already verified safe

(none this sweep — 0 open PRs; most recent merge #650 matches main's HEAD `af956bfc` exactly; no
merged PR left a surviving remote branch; remotes reduced to origin/main; `campaign_close.py` /
`sync_main.py` triggers all false per repo-cleaner.)

## 2. Blocking other work

(none this sweep — main clean and even with origin; worktree `agent-ac09976e6aa67b4ff` is #651's
LIVE "doing" decomposition (updated 20:11:50Z, 9 min pre-sweep), active peer work, not a blocker
and not reap-eligible; #616 remains an external upstream wait, not a queue blocker.)

## 3. Human-decision items

(none this sweep — `adr-queue.json` is empty for the first time since the 0173–0175 wave queued;
`held-items.md` and `friendlies.json` unchanged, zero holds, zero batch confirms pending.)

## 4. Hygiene debt

### 4.1 Land this firing's ops-state delta (recurring)
- **Action**: chore-lead's close-out commits + pushes the applied payloads —
  `.claude/ops/adr-queue.json` (→ empty), `.claude/ops/watch-checkpoint.json` (→ 20:20:14Z),
  and this `plan.md` once landed. Two of three seat payloads are already written to the working
  tree; the commit is the remaining leg. `.claude/ops/` is git-tracked, so an uncommitted delta
  is drift against origin, not scratch.
- **Owner**: chore-lead close-out (per `rulings.md` §"Seat-payload landing leg")
- **Evidence**: this dispatch's own statement of applied payloads; `rulings.md`; main verified
  at `af956bfc` pre-application.
- **Size**: ~5 min

### 4.2 Repair the append-only report-history gap (this firing's report artifact)
- **Action**: write `.claude/ops/reports/2026-08-09T202038Z.md` from repo-cleaner's handoff
  substance, which is fully preserved verbatim in chore-lead's sweep record — a manual write-up
  is cheaper and sufficient; a clean re-dispatch of repo-cleaner is NOT needed (its findings are
  intact, only the artifact is missing). While there, verify the fifth firing's report also
  landed: the newest on-disk report is `2026-08-09T145512Z.md` (fourth firing), so the 18:46Z
  sweep's artifact may share the gap — land it from the same preserved record if absent.
- **Owner**: chore-lead (this firing's close-out, or next firing's pre-flight)
- **Evidence**: chore-lead's flag this dispatch (payload fence carried only the path string, no
  content — malformed per the fence-carries-verbatim-content contract, correctly rejected);
  `ls .claude/ops/reports/` showing nothing on disk after `145512Z`.
- **Size**: ~10 min (low priority — history completeness only, no decision rides on it)

### 4.3 Encode the ops-seat contract rulings into the harness agents (cross-repo, carried ×3)
- **Action**: one change in the nonoun-plugins repo (harness plugin): (a) `chore-lead.md` gains
  the close-out landing leg (seats return payloads; chore-lead writes `.claude/ops/` before
  reporting up); (b) `chore-lead.md` gains evidence write-back ownership (dated tracker comments
  from seat evidence); (c) NEW from this firing — the seat-side payload-fence rule (a fenced
  payload block carries the verbatim file content paired with its target path; a path-only fence
  is malformed and will not land), encoded where the ops seats' report contracts live, cited to
  the 2026-08-09 repo-cleaner incident.
- **Owner**: host session in the nonoun-plugins repo (not doable from this checkout)
- **Evidence**: `rulings.md` §"Seat-payload landing leg" + §"Evidence write-backs"; third
  consecutive sweep with no landing evidence; the 202038Z malformed-payload incident this firing.
- **Size**: ~25 min

## Standing notes (not queue entries)

- **ADR harvest ledger clean** — 0173/0174/0175 (PR #623) and 0178 (PR #648) all landed and
  content-verified; `adr-queue.json` empty; decision-watcher's schedule continues from an
  unchanged checkpoint baseline.
- **#651 (3-pane admin IA, size:big, "doing")** — live decomposition in worktree
  `agent-ac09976e6aa67b4ff`, opened 20:11 by the friendly author. Active dev work; every future
  sweep must keep treating this worktree/branch as live peer work until the label drops or the
  issue closes — not orphan-reap material.
- **#616 upstream-gated, unchanged** every sweep (`a2ui-project/a2ui#2150`) — external wait;
  re-enters ops scope only if the gate lifts and it stalls.
- **gitignore KEEP-LIST fence is permanent** — now 7 G1 warnings (down from 8), still Kim-ruled
  standing noise, exit 0 is the whole gate. No sweep re-proposes a trim.
- **`.claude/ops/` is git-tracked** — corrects a prior briefing's scratch/untracked assumption;
  landing legs must therefore end in commit+push, not just a write.
- **Point-in-time caveat** (repo-cleaner's own flag): 14 PRs merged since the immediately-prior
  report — high concurrent-session churn; this snapshot ages fast.
- 3 stale remote-tracking refs pruned by the dispatcher this firing (all already-merged/deleted:
  `fix/644-prose-arm-history`, `harvest/0178-meta-line-facts`, `task/646-try-it-tabs`) —
  executed pre-sweep, recorded here, not queued.

*Written by chore-planner, 2026-08-09 sixth sweep. Landed by chore-lead's close-out per the
landing-leg ruling.*
