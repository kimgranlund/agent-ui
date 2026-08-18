<!-- target-path: .claude/ops/plan.md -->
# Ops plan — agent-ui

- **Dispatch**: 2026-08-18T15:20:00Z firing (chore-planner, /sweep-chores — RE-DISPATCH; the
  firing's first planner returned the prior plan verbatim, a stale-regurgitation defect this
  compose replaces).
- **Evidence**: three attached seat reports — all dated the 2026-08-17T04:2xZ firing, i.e. STALE
  by ~35 h of activity (the overnight board-zero campaign PRs #1230–#1256, PRs #1280/#1281/#1284/
  #1285, the doc-tier ratify round) — plus the applied `.claude/ops/` state, the prior plan
  (carry-forward only), and this planner's own narrow live reads (`gh issue list`, `gh pr list`,
  `git worktree list`, `git branch -vv`, HEAD-vs-working-tree ops diff, ADR status cells
  0198–0206).
- **UNMEASURED seats**: none by dispatch declaration — but all three attached reports predate the
  interim; where live reads contradict them, the live read governs and is cited.
- **Defect found at compose (top of queue)**: applying the 2026-08-17 payloads ROLLED BACK the
  working tree behind committed state. HEAD (`a6429220`, sweep of 2026-08-18T01:44Z) holds
  adr-queue = 4 pending rows (0198/0199/0200/0112-toast), adr-checkpoint = 202 ADRs
  (0201/0202/0203 proposed), watch-checkpoint @ 2026-08-18T01:43:55Z. The working tree now holds
  the older 5-row queue (0191/0192/0183 pending — all three already harvested and cleared per that
  same HEAD commit), a 194-ADR checkpoint, and a 2026-08-17T04:27Z watch-checkpoint. Entry 1.1
  reverses it before anything else lands.
- **Live state at compose**: 1 open issue (#1282 — ADR-0203 amendment booked repairs; `task`,
  unassigned, no `Blocked-by:` line) · 0 open PRs · 1 worktree, `main` @ `cc4074c7` tracking
  `origin/main`, clean but for the three rolled-back ops JSONs + the untracked
  `sweep-in-flight.json` marker · ADR corpus 206 files, 0198–0206 ALL read `accepted` on disk
  today (0201/0202/0203 flipped, 0204/0205/0206 minted+ratified after HEAD's checkpoint).
- **Blocked-by convention (#193)**: #1282 carries no `Blocked-by:` line; the one ordering edge in
  this queue (3.1 behind 2.1) is named inline in both entries.
- **Corrections vs the prior plan**: its 1.1 landing leg DONE (commit `a6429220`); its 3.2
  off-main-primary DONE (primary is `main`, the `planner-adr-wave` WIP landed); its 3.3
  (0201/0202/0203 rulings) DONE — all three read `accepted` on disk, verified this compose; its
  3.1 four-row confirm carries forward as 3.1 below, now deliberately held behind 2.1 so Kim rules
  ONCE over the full post-ratify set; its 4.1 carries as 4.1. Prior look-pass carries
  (#1101/#1104/#1141): board is at 1 open issue, so all three are closed — dropped as resolved,
  not parked.
- **Attached-report findings superseded by live state**: repo-cleaner's whole propose-only list
  (2 squash-merged `#956` branches, 5 `worktree-agent-*` refs, the stale
  `origin/docs/subpath-coverage-gaps` tracking ref, 5 locked AGENT-UI-2 peer worktrees) — live
  `git branch -vv` / `git worktree list` show exactly `main`, nothing else; all resolved in the
  interim, nothing to queue. issue-sorter's 8-open-issue board (#1042–#1049) — all closed; today's
  board is #1282 alone.
- **Dispatch-headline discrepancy, named**: the dispatch expects "8 pending harvest candidates"
  incl. 0202/0204/0205/0206 — NO queue on disk or at HEAD carries those four; they become real
  only when 2.1's re-fire judges the post-checkpoint ratify wave. The four that exist at HEAD:
  0198/0199/0200/0112-toast.
- **Verdict**: repo surface is the cleanest it has been all month (1 issue / 0 PRs / 1 branch);
  the queue is one rollback repair, one stale-evidence re-fire, one batched harvest confirm, and
  one unowned tracking issue — no unmeasured live sources.

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## 1. Gated mutations already verified safe

### 1.1 Reverse the stale-payload rollback — restore HEAD's three ops JSONs (dispatching host; 2 min)
- **Action**: `git checkout -- .claude/ops/adr-queue.json .claude/ops/adr-checkpoint.json
  .claude/ops/watch-checkpoint.json` (plain HEAD restore of files this firing's own apply step
  stomped — not the sha-restore trap; no staged work is at risk, `git status` shows only these
  three modified). HEAD's copies are strictly newer on all three axes (4-pending queue vs stale
  5-row; 202-ADR checkpoint vs 194; watch-checkpoint 2026-08-18T01:43:55Z vs 2026-08-17T04:27:02Z).
  The 2026-08-17 report file `reports/2026-08-17T042857Z.md` was already committed previously —
  no action there. Do this BEFORE landing this plan.
- **Owner**: dispatching host (the session that applied the stale payloads reverses them).
- **Evidence**: `git status --porcelain` (exactly the 3 JSONs modified); HEAD-vs-working-tree
  diff read this compose (queue pending sets, checkpoint counts, checkpoint timestamps);
  `git log` — `a6429220` is the newest ops commit.
- **Size**: 2 minutes.

### 1.2 Land this plan — commit + push `.claude/ops/plan.md` ONLY (dispatching host; 3 min)
- **Action**: after 1.1, write this plan file, `git add .claude/ops/plan.md` (that path EXACTLY —
  the three JSONs are back at HEAD and carry no delta; `sweep-in-flight.json` is the live marker,
  never staged), commit `ops(sweep 2026-08-18T15:20Z): fresh plan — rollback repair + re-fire
  queue`, push to `origin/main`.
- **Owner**: dispatching host (ops-write split's dispatching session).
- **Evidence**: this plan returned as a target-pathed payload per ops-write-sandbox-rules;
  `.claude/ops/` is git-tracked (standing note); primary checkout is `main`, so the push reaches
  origin directly.
- **Size**: 3 minutes.

## 2. Blocking other work

### 2.1 Re-fire decision-watcher on the post-checkpoint ratify wave — blocks 3.1 (dispatching host; ~15 min seat run)
- **Action**: dispatch decision-watcher fresh. The newest checkpoint (HEAD, 202 ADRs) predates:
  0203's amendment ratification (GH #664 flip, utterance on #1277), 0201/0202/0203's
  proposed→accepted flips, the mint+ratify of 0204/0205/0206, and the doc-tier round (IDR-0005..
  0008 accepted, IDR-0001..0004 superseded, agent-admin-app PRD accepted — IDRs/PRD only if its
  corpus covers them). Expected output: new queue rows for some/all of 0202/0204/0205/0206 and
  the 0203-amendment — the dispatch's "8 pending" headline made real. This BLOCKS 3.1 (named
  there) so the confirm round covers the full set once.
- **Owner**: dispatching host (the dispatch), decision-watcher (the judgment).
- **Evidence**: ADR status cells read this compose — 0198–0206 all `accepted` on disk;
  HEAD checkpoint still lists 0201/0202/0203 `proposed` and stops at 202 files; #1282's body
  cites the 0203-amendment flip dated 2026-08-18.
- **Size**: ~15 minutes of seat run.

## 3. Human-decision items

### 3.1 ADR-harvest batched confirm — ONE AskUserQuestion over the full pending queue, AFTER 2.1 (host asks → Kim rules → make-pack; 5 min + ~1 h/harvest)
- **Action**: blocked by 2.1 (open — do not run the ask before its queue payload lands; the
  blocker is entry 2.1 above, named per blocked-by-rules). Then one round over ALL pending rows:
  HEAD's four — (a) **adr-0198** flowEnd meta-line + closing-turn protocol → a2ui-prompt/payload-
  authoring; (b) **adr-0199** `:state(working)` eighth host-custom-state → patterns-table row
  beside 33–34; (c) **adr-0200** devtools top-tier mint → patterns-table NEW row distinguishing
  the two mint geometries (sibling-off-components vs top-tier-above-catalog); (d) **adr-0112
  amendment** Toast-enters-catalog → narrow row 23 + harvest the Toast-emittable fact — plus
  whatever 2.1 queues (expected 0202/0204/0205/0206-shaped rows). On YES per row: dispatch
  `/make-pack` (placement its judgment). Run `adr_queue.py pending .claude/ops/adr-queue.json`
  first to enumerate the live set.
- **Owner**: dispatching host (the ask) → Kim (the ruling) → make-pack seat (each approved
  harvest).
- **Evidence**: HEAD adr-queue (4 pending rows @ 2026-08-18T01:46Z, read this compose); prior
  plan 3.1's per-row judgment evidence (grep proofs) stands for those four; 2.1's evidence for
  the expected additions.
- **Size**: 5 minutes to rule; ~1 h per approved harvest.

### 3.2 Issue #1282 — ADR-0203 amendment's booked repairs need an owner (Kim/host; assignment minutes, execution a dev lane)
- **Action**: the board's sole open issue: the tracking record for the ADR-0203 amendment's
  booked repairs (checklist in body; stays OPEN until they execute, closing it IS the record).
  Unassigned, `task`, no `Blocked-by:` line. Decide the lane: assign + dispatch a build seat, or
  schedule it into the next campaign. Execution is dev work, not this queue's — only the
  ownership decision is queued here.
- **Owner**: Kim (or host under standing autonomy) assigns; a build seat executes.
- **Evidence**: `gh issue view 1282` this compose — OPEN, unassigned, labels `[task]`, body cites
  the ratification utterance (#1277, comment 5332016731) and the booked-items checklist;
  `Blocked-by:` grep = 0 hits.
- **Size**: minutes to assign; execution sized by the checklist (unestimated here — body read was
  partial; the assignee sizes it).

## 4. Hygiene debt

### 4.1 nonoun-plugins#46 — ratify-only-flip hash gap, still open upstream (upstream lane; pin stands; 0 min here)
- **Action**: carried forward (no evidence it closed). INTERIM PIN unchanged: when Kim ratifies
  an amendment on an already-`accepted` ADR with no same-window body change, the host
  re-dispatches decision-watcher with an explicit "re-judge adr-00NN amendment" instruction.
  This window is safe — every flip in the 0201–0206 wave changed body bytes (status cells /
  appended amendment text), so 2.1's `classify` will catch them; the pin matters for future
  ratify-only flips.
- **Owner**: nonoun-plugins upstream (the script fix) · dispatching host (the pin, per firing) ·
  Kim (unparking the upstream bundle).
- **Evidence**: prior plan 4.1 (carry-forward); the attached decision-watcher report's own
  original statement of the gap (its "ratify-only flip will NOT re-trigger amended" paragraph).
- **Size**: 0 minutes here; small tooling task upstream.

## Standing notes (not queue entries)

- **Git surface fully clean (live-verified this compose)**: 1 worktree, 1 branch (`main` @
  `cc4074c7` = origin/main), 0 open PRs, no stashes in evidence. Every propose-only item from the
  attached repo-cleaner report (the two `#956` squash-merged branches, five `worktree-agent-*`
  refs, `origin/docs/subpath-coverage-gaps`, five AGENT-UI-2 peer worktrees) resolved in the
  interim — nothing carried.
- **Stale-regurgitation + stale-apply, the double defect this firing**: the first planner
  returned the old plan verbatim, and the apply leg wrote a superseded firing's payloads over
  newer committed state. Worth an upstream note to /sweep-chores: the apply step should refuse a
  payload whose source-firing timestamp predates the newest ops commit touching the same file.
  Not minted as an issue by this seat (minting is issue-sorter's/host's); flagged for the host.
- **gitignore G1 noise** (6–7 rules): standing Kim-ruled KEEP-LIST, never re-proposed.
- **`.claude/ops/sweep-in-flight.json`**: this sweep's live marker — never staged, never cruft
  while a sweep runs.
- **Board-zero context**: the 2026-08-18 overnight campaign closed the full 26-issue wave
  (PRs #1230–#1256) and the prior look-pass items — the anchor "0 open / 0 open" held until
  #1282 was minted as the ratify round's tracking record.
- **gen-ui-kit**: out of this board's scope (dedicated session per Kim's ruling).

*Composed by chore-planner (re-dispatch), 2026-08-18T15:20:00Z firing — returned as payload per
the #125 ops-write split; written and landed by the dispatching session.*
