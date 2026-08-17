<!-- target-path: .claude/ops/plan.md -->
# Ops plan — agent-ui

- **Dispatch**: 2026-08-17T14:07:20Z (chore-planner, sweep-9 — /sweep-chores, single host).
- **Evidence**: three fresh seat reports (issue-sorter · repo-cleaner @ 14:07:20Z · decision-watcher
  — all MEASURED, both gh sources reachable, payloads already applied to `.claude/ops/`) + the
  prior plan (sweep-8 + its resolution ledger / ruling round / night tally / final tally / closing
  addenda — carry-forward source only).
- **Live state at compose**: 3 open issues (#1081/#1083/#1084 — live-pixel verification tasks,
  unassigned by design, parked for Kim's own surface; Kim holds the in-session test crib sheet) ·
  0 open PRs (30 most recent all MERGED, through #1097) · 1 worktree (main, clean, in sync) ·
  1 local branch · origin main-only · `ops:reap-branches` dry-run: zero reapable — repo-cleaner's
  healthiest-ever survey, ZERO proposals.
- **Blocked-by convention (#193)**: no `Blocked-by:` line appears in any evidence this sweep (seat
  reports carry none for #1081/#1083/#1084) — the convention reorders nothing.
- **Corrections vs the prior plan (sweep-8)**: its entire queue is retired — 1.1/1.2/1.3, 2.1,
  3.1/3.2/3.3/3.4, 4.1/4.2/4.3 all DONE per its own resolution ledger and addenda (docs wave
  #1042–#1050, bug wave #1061–#1064, harvests #1070/#1072, ADR-0193-amendment/0195/0196/0197 all
  ratified and built, #1092 diet shipped as PR #1097). Carried forward: the nonoun-plugins#46
  checkpoint-hash gap (still open upstream) and its interim ratification pin; the live-pixel trio.
- **Corrections vs this sweep's seat reports**: decision-watcher asks a human glance to confirm
  ADR-0193's amendment ratify flip is real (banner blockquote still says "proposed"). The prior
  plan's 13:5x addendum already carries the proof — Kim's utterance on #1077, amendment-mode flip
  `11c4c86f`, build PR #1095 merged — so 3.2 below is scoped to the one-line cosmetic banner
  repair, not a re-verification. Also: decision-watcher notes the 0193-amendment WAS caught by
  `classify` this firing (body text changed in the same window) — a coincidence of timing, not
  evidence the nonoun-plugins#46 gap is closed; the pin stands (4.1).
- **Verdict**: repo pristine, board reduced to Kim's live-pixel trio — the queue is one state
  landing leg, one 3-row ADR harvest confirm (+ 6-row clear), one cosmetic banner repair, and
  Kim's own surface checks.

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## 1. Gated mutations already verified safe

### 1.1 Land this sweep's state — commit + push `.claude/ops/` ONLY (dispatching host; 5 min)
- **Action**: `git add .claude/ops/adr-checkpoint.json .claude/ops/adr-queue.json
  .claude/ops/watch-checkpoint.json .claude/ops/reports/2026-08-17T140720Z.md .claude/ops/plan.md`
  → commit `ops(sweep-9): seat payloads + plan` (state-only, never source) → push. Working tree is
  otherwise clean (repo-cleaner: nothing else to stage), so no exclusion caveats this sweep.
- **Owner**: dispatching host (the ops-write split's dispatching session; `rulings.md`
  "Seat-payload landing leg — RULED 2026-08-09").
- **Evidence**: all four seat payloads returned target-pathed and applied verbatim this firing
  (issue-sorter: watch-checkpoint advance to 14:07:20Z; decision-watcher: checkpoint 196 ADRs +
  queue 9 rows; repo-cleaner: report 2026-08-17T140720Z.md); `.claude/ops/` is git-tracked
  (standing note).
- **Size**: 5 minutes.

## 2. Blocking other work

- **(none this sweep)** — 0 open PRs, no in-flight lanes, no shared-file serialization, no entry
  waits on another entry. Evidence: repo-cleaner §Inventory (1 worktree / 1 branch / 0 PRs);
  issue-sorter board-shape check (only the parked trio open).

## 3. Human-decision items

### 3.1 ADR-queue batched confirm — 3 pending harvest rows in ONE AskUserQuestion, plus the 6-row harvested clear (host asks → Kim rules → make-pack; 5 min + ~1 h/harvest)
- **Action**: one round covering the 3 `pending` rows: (a) `adr-0196` answered-state law — the
  THIRD ADR-0191/TKT-0062-shaped state-law proof (`:state(answered)`, alias-only token pair, fixed
  7-step precedence, 7-choice-control scope, answered-not-disabled + append-amendment template) →
  patterns-table: extend row 33 or sibling row; (b) `adr-0197` barrel-lazy-split, third proof
  (dogfood → markdown → agent-admin), TWO facets: the decision rule → patterns-table new row, AND
  the eager-closure test-methodology refinement (bundle gate must assert absence from the
  transitive EAGER closure, not merely `isEntry` chunks — the weaker check passes vacuously) →
  component-testing/test-craft.md; (c) `adr-0193-amendment` sync-read extension
  (`SyncReadableStorageAdapter`, narrowing-factory idiom as the deliberate inverse of ADR-0192's
  optional-probe idiom) → extend patterns-table row 35. On YES per row: dispatch `/make-pack`
  (placement is make-pack's own judgment, per each row's `plan`). SAME round: confirm clearing the
  6 `status:harvested` rows (0191/0192/0183/0193/0160/0190 — all with `landed_in` filled via PRs
  #1070/#1072) — `adr_queue.py clear <scratch> --ids …` → payload → landing leg, per
  ops-write-sandbox-rules; sweep-8 precedent (its 3.1 cleared 0178-amendment/0187 the same way).
- **Owner**: dispatching host (the ask; the `clear` payload) → Kim (the ruling) → make-pack seat
  (each approved harvest).
- **Evidence**: decision-watcher report this sweep — per-row grep proofs (row 33 forward-pointer
  only; `moduleIds`/`bundle.test`/`rolldown`/`isEntry` zero hits corpus-wide; row 35 base-only);
  `adr-queue.json` payload: 9 rows total, 3 `pending` queued 14:11:35Z + 6 `harvested`.
  decision-watcher correctly deferred the confirm (dispatched unattended, named-not-attempted).
- **Size**: 5 minutes to rule; ~1 h per approved harvest (3); 2 min for the clear payload.

### 3.2 ADR-0193 amendment guard-banner lag — one-line doc repair, Kim's nod first (Kim rules → host repairs; 5 min)
- **Action**: the amendment header in `.claude/docs/adr/0193-shared-storage-adapter-seam.md`
  (line ~173) reads "(2026-08-17, ratified …)" while the guard-banner blockquote below it still
  says "and proposed: … carries no ratification of its own until Kim gives one" — the known
  cosmetic banner-lag class (`adr_ratify.py` amendment-mode deliberately doesn't touch the
  blockquote; standing note below, plus memory's amendment-stale-guard-banner precedent). The flip
  is REAL: Kim's utterance on #1077, flip `11c4c86f`, build PR #1095 merged (prior plan 13:5x
  addendum). Ask Kim to confirm the one-line banner repair (ADR prose is owner-territory); on YES
  the host edits the blockquote to reflect ratified state and lands it as a docs-only commit.
- **Owner**: Kim (the nod) → dispatching host (the one-line edit + commit).
- **Evidence**: decision-watcher §Flagged-not-acted; prior plan addendum 13:5x (flip `11c4c86f`,
  PR #1095); memory `decision-watcher-amendment-stale-guard-banner` (cosmetic class, don't misread
  as unexecuted).
- **Size**: 2 minutes to rule; 3 minutes to repair.

### 3.3 Live-pixel trio #1081 / #1083 / #1084 — Kim's own surface, crib sheet in hand (Kim; ~10 min each)
- **Action**: run the in-session test crib sheet on the real agent-admin surface: #1081 (verify
  #1064's fix, PR #1073) · #1083 (pixel-check the GH #1030 + #1032 fixes live) · #1084 (live-repro
  probe: why #1061's turn 2 emitted an empty createSurface+deleteSurface pair). Close each with
  the observed result; #1084 may mint a follow-up bug if the repro lands. No seat touches these —
  pixel-truth over repo-truth (standing law): "fixed" = rendered on Kim's live surface.
- **Owner**: Kim (deliberately unassigned-on-board; parked for the human surface).
- **Evidence**: issue-sorter board-shape check (all three OPEN, unassigned, `task`, expected
  state confirmed); repo-cleaner §Open issues (all `size:small`, updated within ~2 h, no claims).
- **Size**: ~10 minutes each on the live surface.

## 4. Hygiene debt

### 4.1 nonoun-plugins#46 — checkpoint ratify-only-flip hash gap, still open upstream (upstream lane; pin stands here)
- **Action**: no local build — the widening of `adr_checkpoint.py`'s hash basis rides the upstream
  issue (filed from sweep-8's 3.2 ruling; part of the PARKED cross-repo encoding bundle, Kim
  2026-08-13). INTERIM PIN unchanged: whenever Kim ratifies an amendment on an already-`accepted`
  ADR with no same-window body change, the host re-dispatches decision-watcher with an explicit
  "re-judge adr-00NN amendment" instruction. Note: this firing's 0193-amendment WAS caught by
  `classify` — because its body changed in the same window, NOT because the gap closed.
- **Owner**: nonoun-plugins upstream (script) · dispatching host (the pin, per firing) · Kim
  (bundle unparking).
- **Evidence**: decision-watcher report §Classify (the explicit "contrary to the dispatch note…
  was caught this time" caveat); nonoun-plugins#46 open at dispatch (stated in the sweep brief).
- **Size**: 0 minutes here; small tooling task upstream.

## Standing notes (not queue entries)

- **Board shape (this compose)**: 3 open issues, all Kim's-surface; 0 PRs; nothing to mobilize.
  `held-items.md` empty; `friendlies.json` unchanged (roster confirmed 2026-08-05, MCP offer
  declined on record).
- **Healthiest-ever baseline**: 1 worktree / 1 branch / origin main-only / 0 PRs /
  `ops:reap-branches` dry-run clean — the next repo-cleaner firing diffs against
  `reports/2026-08-17T140720Z.md`.
- **Teamwork plugin re-enabled today** (#1085 closed; claude-plugins#491 fixed via hooks removal,
  reversing f07ab329) — if a PreToolUse(Bash) prompt regression reappears under bypass, that is a
  re-open of #1085's class, not a new mint.
- **adr_ratify.py amendment-mode cosmetic** (heading flips, guard blockquote keeps "proposed") —
  deliberate scope, not a bug; 3.2 is the manual prose repair for the one instance now flagged.
- **Interim ratification pin (4.1)** — fires on any ratify-only amendment flip until
  nonoun-plugins#46 lands.
- **gitignore KEEP-LIST fence is permanent** — 7 standing G1 warnings (exit 0), never re-propose.
- **`worktree-agent-<hash>` = live marker** while its worktree exists — moot at this compose
  (zero lane worktrees), kept for the next multi-lane wave.
- **gen-ui-kit**: out of this board's scope (dedicated session per Kim's ruling).
- **`.claude/ops/` is git-tracked** — landing legs end in commit+push, not just a write (1.1).

*Composed by chore-planner (sweep-9, /sweep-chores), 2026-08-17T14:07:20Z firing — returned as
payload per the #125 ops-write split; written and landed by the dispatching session.*
