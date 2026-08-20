<!-- target-path: .claude/ops/plan.md -->
# Ops plan — agent-ui

- **Dispatch**: 2026-08-20T22:01:23Z sweep firing (chore-planner, /sweep-chores, standalone-read
  mode — all three seats returned: decision-watcher, issue-sorter, repo-cleaner; seat findings
  read from durable state + this firing's report file, live `gh` refetched by this seat).
- **Evidence**: durable ops state (`adr-queue.json` rewritten 22:03:27Z with 2 harvest rows,
  already applied · `adr-checkpoint.json`/`watch-checkpoint.json` advanced ·
  `reports/2026-08-20T220123Z-repo-cleaner.md`) + live `gh` (issues/PRs, `backlog`/`roadmap`
  excluded at read time; #1282 and upstream #46 verified directly) + the prior plan
  (2026-08-20T05:25:20Z compose, carry-forward only).
- **UNMEASURED seats**: none — the dispatch named all three returned, none UNMEASURED, and this
  seat's own live `gh` reads all succeeded.
- **Corrections vs the prior plan**: prior 1.1 (land the 05:25Z payloads) DONE — commit
  `993d6198` landed them; superseded by this firing's 1.1. Prior 3.1 (adr-0195 harvest confirm)
  RESOLVED — confirmed and executed, PR #1518 merged (commit `cbc13042` drained the queue row);
  its remote branch was among the 10 repo-cleaner closed this firing. Prior 3.2 (#1282) DROPPED
  per its own drop condition — live-verified CLOSED this firing (`gh issue view 1282` → CLOSED,
  `task`, assigned kimgranlund). Prior 4.1 carries forward (verified still OPEN upstream, below).
  Prior standing note "adr-0226 stays proposed" is STALE — adr-0226 was ratified as amended this
  window and is now a harvest row (3.1). No entry dropped as parked — no carried id shows a
  `backlog`/`roadmap` label in evidence.
- **needs-ruling lane**: none — issue-sorter reports zero ruling-shaped items, zero holds
  (19 issues + 24 PRs since checkpoint, all pre-classified, all sole-trusted-operator-authored,
  zero mints; checkpoint advanced).
- **Blocked-by convention (#193)**: no queue entry this firing is issue-backed, and no literal
  `Blocked-by:` line appears in evidence. One soft edge named inline: the two `/make-pack`
  harvest executions wait on 3.1's confirm.
- **Verdict**: hygiene and intake both came back fully clean this firing — repo-cleaner closed
  all 10 undeleted merged-PR remote branches (executed + reverified gone, 0 findings remain,
  0 open PRs, primary clean and synced) and issue-sorter needed zero actions across 19 issues +
  24 PRs. The live queue is human-decision work only: one batched confirm over the two fresh
  ADR-harvest rows (adr-0227, adr-0226) and one repo-shape ruling on the missing RDD tier.

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## 1. Gated mutations already verified safe

### 1.1 Land this firing's remaining ops state — one commit, ops paths ONLY (dispatching host; 5 min)
- **Action**: the seat payloads (`adr-queue.json`, `adr-checkpoint.json`,
  `watch-checkpoint.json`, `reports/2026-08-20T220123Z-repo-cleaner.md`) are already applied on
  disk; apply this plan's payload, then `git add` exactly those ops paths + this plan and commit
  on `main`. Do NOT stage `.claude/ops/sweep-in-flight.json` — it is this sweep's own live
  marker (session `aa604436` matches this dispatch; repo-cleaner withheld `sync_main.py` for
  exactly this reason) — leave it until the sweep concludes.
- **Owner**: dispatching host (the ops-write split's dispatching session).
- **Evidence**: ops-write-sandbox-rules (dispatcher applies + lands payloads); repo-cleaner
  report Inventory (own-session marker, `sync_main.py` withheld); applied-state mtimes 22:13Z.
- **Size**: 5 minutes.

## 2. Blocking other work

(none — 0 open PRs repo-wide, no held worktrees, no entry in evidence blocks another; the one
locked worktree found at firing time was the dispatching session's own live build-1554 dispatch,
since merged (#1554/#1557) and reaped.)

## 3. Human-decision items

### 3.1 Batched confirm — TWO fresh harvest rows in `adr-queue.json`: adr-0227 and adr-0226 (Kim confirms; host executes; ~5 min)
- **Action**: one `AskUserQuestion` round over both queued candidates (decision-watcher's
  batched confirm, deferred to the dispatching session):
  - **adr-0227** (new, ratified 2026-08-20) — the ONE shared/app-state grammar (single-owner
    signal-backed store, explicit injection, StorageAdapter persistence, CSS cascade for
    presentational axes) + fact-shaped context-request re-trigger. Proposed target:
    `/make-pack .claude/skills/component-patterns` — a new shared-state-grammar row in
    `references/patterns-table.md` (rows 39/42 cite ADR-0192/0193 individually but carry no
    general grammar row; placement judgment stays with the doc seat). Related context, separate
    lane: open issue #1549 records adr-0227's clause-5 exception (resource-idb-store blob tier)
    as dev work — the harvester should see it, this queue does not own it.
  - **adr-0226** (amended, ratified 2026-08-20) — Button wire-level `icon`/`iconOnly` props
    (ICON_NAMES vocabulary, label-is-accessible-name, validator `requires:` cross-prop check).
    Proposed target: `/make-pack .claude/skills/a2ui-payload-authoring` — extend
    `references/node-idioms.md`'s Button entry (drop the Column(Icon,Button) workaround), with
    the queue row also noting a possible component-patterns cross-prop-validation row
    (catalog-wide floor, not Button-scoped) for the doc seat to judge.
  Confirmed → host dispatches the `/make-pack` runs; declined → the row drops with a note. Soft
  edge: both harvest executions wait on this confirm (#193 inline naming; no literal
  `Blocked-by:`).
- **Owner**: Kim (the confirm); dispatching host fans out the doc seat(s).
- **Evidence**: `adr-queue.json` (2 `harvest` rows, queued 2026-08-20T22:03:27Z, each with
  origin/main-resolved absence evidence); decision-watcher findings this firing.
- **Size**: ~5 minutes to confirm; doc-seat execution ~1 hour per row, not this queue's.

### 3.2 RDD-tier gap — decision-watcher's Revalidation mode is blocked in this repo; rule the repo shape (Kim; minutes)
- **Action**: decision-watcher's Revalidation mode found no `.claude/docs/rdd/` directory here
  and blocked rather than improvised. Decide ONE of: (a) mint an RDD tier in this repo's docs
  tree, or (b) scope Revalidation to ADR/IDR-only for agent-ui. This is a human repo-shape
  ruling — neither this seat nor a future sweep builds the directory unprompted. Note the
  standing 2026-08-18 ruling (IDR tier = global intent only) as adjacent precedent when ruling.
- **Owner**: Kim (the ruling); host executes whichever shape is ruled.
- **Evidence**: decision-watcher findings this firing (Revalidation blocked, repo-shape gap
  flagged for a human decision).
- **Size**: minutes to rule; implementation follows the ruling, sized then.

## 4. Hygiene debt

### 4.1 nonoun-plugins#46 — ratify-only-flip hash gap, verified still OPEN upstream this firing; pin stands (upstream lane; 0 min here)
- **Action**: carried forward (prior 4.1). Live-verified this firing:
  `kimgranlund/nonoun-plugins#46` ("adr_checkpoint.py: hash the amendment ratification marker")
  is OPEN. INTERIM PIN unchanged: when Kim ratifies an amendment on an already-`accepted` ADR
  with no body-byte change, the host re-dispatches decision-watcher with an explicit "re-judge
  adr-00NN amendment" instruction. This firing's adr-0226 amendment surfaced without the pin
  being needed — still not evidence the upstream gap closed; the pin stays until #46 does.
- **Owner**: nonoun-plugins upstream (the script fix) · dispatching host (the pin, per firing) ·
  Kim (unparking the upstream bundle).
- **Evidence**: live `gh issue view 46 -R kimgranlund/nonoun-plugins` this firing → OPEN.
- **Size**: 0 minutes here; small tooling task upstream.

## Standing notes (not queue entries)

- **Hygiene fully clean this firing**: 10 merged-PR remote branches (#1518, #1520–#1528) closed
  via `campaign_close.py`, reverified gone (`ls-remote --heads origin` → only `main`); 0 open
  PRs repo-wide; `primary_checkout_check.py` clean; both reap scripts 0 fail.
- **Intake fully clean this firing**: 19 issues + 24 PRs since the last checkpoint, all already
  properly minted/kinded, all sole-trusted-operator-authored; zero mints, zero holds; checkpoint
  advanced.
- **Open unassigned issues #1553 (ui-card footer pin) / #1549 (adr-0227 clause-5 exception)**:
  visibility only — open board items routed through normal dev planning, not ops debt. Neither
  carries `backlog`/`roadmap`; #1549 is named as context inside 3.1.
- **Dirty `main` is this sweep's own marker**: `.claude/ops/sweep-in-flight.json` (pid 79606,
  session `aa604436`) — leave alone until the sweep concludes; `sync_main.py` correctly
  withheld.
- **gitignore G1 noise** (6 stale rules): standing Kim-ruled keep-list, never re-proposed.
- **gen-ui-kit**: out of this board's scope (dedicated session per Kim's ruling).

*Composed by chore-planner, 2026-08-20T22:01:23Z sweep firing — returned as payload per the #125
ops-write split; written and landed by the dispatching session.*

Dispatch: 2026-08-20T22:01:23Z
