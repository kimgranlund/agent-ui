<!-- target-path: .claude/ops/plan.md -->
# Ops plan — agent-ui

- **Dispatch**: 2026-08-18T01:4xZ firing (chore-planner, sweep-10 — /sweep-chores).
- **Evidence**: three fresh seat reports (decision-watcher · issue-sorter · repo-cleaner) + the
  prior plan (sweep-9 + its evening/wrap-up addenda — carry-forward source only).
- **UNMEASURED seats**: none — all three seats fired and measured; `gh` reachable for both
  issue-sorter sources and for repo-cleaner's PR cross-reference.
- **Live state at compose**: 27 open issues (the #1188–#1215-era library/ingest/teams/patterns
  backlog wave — ordinary dev intake, all pre-minted and labeled, outside this queue's remit) ·
  0 open PRs (recent history all MERGED/CLOSED through #1187) · 1 worktree, but the primary
  checkout sits OFF MAIN on `planner-adr-wave` (0 ahead/0 behind origin/main) with live
  uncommitted WIP (a 99-line edit to ADR-0198 + untracked `.claude/ops/sweep-in-flight.json`) ·
  origin main-only after repo-cleaner's 6 branch closes · ADR corpus now 203 files (checkpoint
  advanced 196→203; 0201/0202/0203 sit `proposed`).
- **Blocked-by convention (#193)**: no `Blocked-by:` line in any evidence this sweep — the
  convention reorders nothing.
- **Corrections vs the prior plan (sweep-9)**: its queue is retired — sweep-9's 1.1 landed
  (commit e8d57b57-era state on disk), its 3.1 three-row confirm and 6-row clear are DONE
  (decision-watcher independently verified all three former pending rows landed and cleared them,
  plus the 6 harvested rows, in this firing's queue payload), 3.2's banner repair is subsumed by
  the live ADR-0198 amendment WIP now on `planner-adr-wave`-adjacent territory (0193's banner no
  longer flagged by any seat), 3.3's live-pixel trio closed in the 08-17 evening addendum. Prior
  board items #1101/#1104 (Kim's look-pass) and lane #1141: NO seat names them open or closed
  this sweep — if still open they sit inside the 27-issue backlog; the owed look-pass stands
  until Kim closes them, carried as a note, not re-verified here (refetch forbidden in sweep mode).
- **Executed this sweep (by repo-cleaner, gated, verified — no queue entries needed)**: 2 stale
  remote-tracking refs pruned; 6 merged-PR remote branches (#1176/#1177/#1179/#1181/#1186/#1187)
  deleted and reverified gone via `campaign_close.py`, all exit 0.
- **Verdict**: repo healthy after 6 verified branch closes; the queue is one state-landing leg,
  a 4-row ADR-harvest confirm, the off-main-primary resolution, and three proposed-ADR rulings —
  no blockers, no unmeasured seats.

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## 1. Gated mutations already verified safe

### 1.1 Land this sweep's state — apply payloads, commit + push `.claude/ops/` ONLY (dispatching host; 5 min)
- **Action**: write the four fenced payloads verbatim to their target paths
  (`.claude/ops/adr-queue.json` — 4 pending rows; `.claude/ops/adr-checkpoint.json` — 203 ADRs;
  `.claude/ops/watch-checkpoint.json` — both sources @ 01:43:55Z;
  `.claude/ops/reports/2026-08-18T014438Z.md`) plus this plan, then
  `git add` EXACTLY those five paths → commit `ops(sweep-10): seat payloads + plan` → push.
  EXCLUSIONS, both live WIP per the #592 rule: the dirty
  `.claude/docs/adr/0198-ask-flow-completion-flowend-meta-signal.md` edit and the untracked
  `.claude/ops/sweep-in-flight.json` marker — stage neither. CAVEAT: HEAD is `planner-adr-wave`,
  so this state lands on that branch and reaches `origin/main` only when 3.2 resolves — name that
  in the commit if pushed from the branch.
- **Owner**: dispatching host (the ops-write split's dispatching session; `rulings.md`
  "Seat-payload landing leg — RULED 2026-08-09").
- **Evidence**: all four seat payloads returned target-pathed this firing
  (ops-write-sandbox-rules satisfied — no narrated-but-absent claims); repo-cleaner §Inventory
  (dirty-tree contents, branch identity); `.claude/ops/` is git-tracked (standing note).
- **Size**: 5 minutes.

## 2. Blocking other work

- **(none this sweep)** — 0 open PRs, no lane worktrees, no queue entry waits on another entry.
  The one ordering edge (1.1's push reaching main via 3.2) is named inline in both entries.
  Evidence: repo-cleaner §Inventory (1 worktree / 2 local branches, same tip / 0 open PRs).

## 3. Human-decision items

### 3.1 ADR-queue batched confirm — 4 pending harvest rows in ONE AskUserQuestion (host asks → Kim rules → make-pack; 5 min + ~1 h/harvest)
- **Action**: one round over the 4 `pending` rows decision-watcher queued: (a) **adr-0198**
  flowEnd meta-line + closing-turn/courtesy-close protocol → a2ui-prompt-authoring or
  a2ui-payload-authoring (meta-line vocabulary-growth axis, currently tracked by NO pack);
  (b) **adr-0199** `:state(working)` — eighth host-custom-state member → patterns-table new row
  beneath rows 33–34 (identical axis/shape), plus the reduced-motion "static never nothing"
  precedent; (c) **adr-0200** `@agent-ui/devtools` top-tier package mint → patterns-table NEW row
  distinguishing the two mint geometries (sibling-off-components vs top-tier-above-catalog —
  landing it under row 35 verbatim would misstate the DAG); (d) **adr-0112 amendment**
  (Toast enters catalog) → TWO moves: correct/narrow row 23's now-half-wrong exemplar to
  ToastRegion only, and harvest the Toast-emittable fact itself. On YES per row: dispatch
  `/make-pack` (placement is make-pack's own judgment, per each row's `plan`). Run
  `adr_queue.py pending .claude/ops/adr-queue.json` first to confirm the applied state.
- **Owner**: dispatching host (the ask) → Kim (the ruling) → make-pack seat (each approved harvest).
- **Evidence**: decision-watcher report — per-ADR judgment table with grep proofs (meta-line
  vocabulary uncaptured corpus-wide; rows 33–34 shape match; row 35 wording geometry-specific;
  row 23 citation now factually stale); queue payload 4 rows @ 01:46Z; the seat correctly
  deferred the confirm (no AskUserQuestion tool in its dispatch).
- **Size**: 5 minutes to rule; ~1 h per approved harvest (up to 4).

### 3.2 Off-main primary checkout — resolve the `planner-adr-wave` WIP, then return to main (owning session/Kim → host; ~5 min once WIP lands)
- **Action**: the sole/primary checkout is on `planner-adr-wave` (0 ahead/0 behind) with a live
  uncommitted 99-line ADR-0198 edit — by content, the 2026-08-18 `proposed` scene-transition
  amendment decision-watcher's adr-0198 evidence names. Once whatever session owns that branch
  commits/lands its work (and Kim rules on the amendment it drafts), run `git checkout main` on
  the primary and merge/fast-forward as that lane's own process dictates. NEVER switched by a
  seat — repo-cleaner correctly proposed-only per the #592 rule; this stays a human/owning-session
  action. Should not linger past the owning session: this is the exact #592 incident shape.
- **Owner**: the live session owning `planner-adr-wave` (commit/land) → Kim (the amendment
  ruling) → dispatching host (`git checkout main` after).
- **Evidence**: repo-cleaner `primary_checkout_check.py` FAIL + dirty-tree listing; its
  §Proposed-but-not-executed and 🟡 risk line; decision-watcher adr-0198 evidence (the proposed
  scene-transition amendment matching the dirty file).
- **Size**: owned by the live lane; ~5 minutes of checkout/merge once it lands.

### 3.3 Three `proposed` ADRs await Kim's ratification rulings — 0201 / 0202 / 0203 (Kim; minutes each)
- **Action**: adr-0201 (`ui-description-list`, GH #1185 — already BUILT via merged PR #1187, so
  the record trails the build), adr-0202 (pdf.js second runtime-dep exception), adr-0203
  (`AgentTeam` declaration-first record) all sit `proposed`. Per the proposed-marker law these
  are Kim's to flip (`adr_ratify.py` is THE flip path); decision-watcher will reclassify each as
  `amended` and re-judge for harvest the firing it flips. No seat action until then.
- **Owner**: Kim (the flips) → decision-watcher next firing (re-judgment).
- **Evidence**: decision-watcher judgment table (all three "no candidate — not yet ratified,
  Phase 1 Impact bar"); checkpoint payload rows adr-0201/0202/0203 `"status": "proposed"`;
  repo-cleaner PR history (#1187 MERGED, its branch `1185-description-list` closed this sweep).
- **Size**: minutes per ruling.

## 4. Hygiene debt

### 4.1 nonoun-plugins#46 — checkpoint ratify-only-flip hash gap, still open upstream (upstream lane; pin stands here)
- **Action**: carried forward unchanged from sweep-9 (no evidence this sweep says it closed).
  INTERIM PIN: whenever Kim ratifies an amendment on an already-`accepted` ADR with no
  same-window body change, the host re-dispatches decision-watcher with an explicit "re-judge
  adr-00NN amendment" instruction. Note this firing's 0112 and 0193 amendments were both caught
  by `classify` (same-window body changes) — timing, not evidence the gap closed. Relevant to
  3.3: when 0201/0202/0203 flip, the flips themselves change the body, so `classify` catches them.
- **Owner**: nonoun-plugins upstream (script) · dispatching host (the pin, per firing) · Kim
  (bundle unparking).
- **Evidence**: prior plan 4.1 (carry-forward, still open at last sighting); decision-watcher's
  moving-corpus note demonstrating the re-classify-before-advance discipline the pin complements.
- **Size**: 0 minutes here; small tooling task upstream.

## Standing notes (not queue entries)

- **Board shape (this compose)**: 27 open issues — ordinary pre-minted dev backlog
  (#1188–#1215 wave), no `needs-ruling` label in evidence, `held-items.md` and `friendlies.json`
  unchanged (no payloads emitted for either, correctly). Nothing for this queue to mobilize.
- **Prior look-pass carry (unverified)**: #1101/#1104 (Kim's pixel look-pass) and lane #1141 —
  unnamed in this sweep's evidence either way; if open, they're inside the 27. Pixel-truth law
  stands: built+merged ≠ closed until Kim's surface says so.
- **Closed-issue kind-label anomaly** (issue-sorter, visibility only): #1115 and #1105 are
  CLOSED with no kind label — terminal records predating/outside the convention; no
  reclassification owed, recorded so the next firing doesn't re-flag.
- **gitignore G1 count moved 7→6** (`*.log` now matches a real file); the remaining 6 are the
  permanent Kim-ruled KEEP-LIST noise — never re-propose.
- **`.claude/ops/sweep-in-flight.json`** is this sweep's own live marker — never staged, never
  classified as cruft while a sweep runs.
- **decision-watcher's moving-corpus discipline** (re-`classify` before `advance`; caught
  0202/0203 landing mid-firing) — the GH #42 failure mode avoided; worth keeping as the
  reference behavior for future firings.
- **`.claude/ops/` is git-tracked** — landing legs end in commit+push, not just a write (1.1).
- **gen-ui-kit**: out of this board's scope (dedicated session per Kim's ruling).

*Composed by chore-planner (sweep-10, /sweep-chores), 2026-08-18T01:4xZ firing — returned as
payload per the #125 ops-write split; written and landed by the dispatching session.*
