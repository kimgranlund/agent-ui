<!-- target-path: .claude/ops/plan.md -->
# Ops plan — agent-ui

- **Dispatch**: 2026-08-20T22:43:58Z sweep firing (chore-planner, /sweep-chores, standalone-read
  mode — all three seats returned: decision-watcher, issue-sorter, repo-cleaner; none UNMEASURED;
  seat findings from the dispatch + durable state, live `gh` refetched by this seat).
- **Evidence**: durable ops state (`adr-queue.json` unchanged, 2 harvest rows ·
  `revalidation-checkpoint.json` NEW, cursor 5, sampled 22:46:12Z · `watch-checkpoint.json`
  advanced · `reports/2026-08-20T224358Z-repo-cleaner.md`) + live `gh` this firing (0 open
  issues, 0 open PRs, `backlog`/`roadmap` excluded at read time; upstream #46 verified directly)
  + the prior plan (22:01:23Z compose, carry-forward only).
- **UNMEASURED seats**: none — all three returned, and this seat's own live `gh` reads all
  succeeded.
- **Corrections vs the prior plan**: prior 1.1 (land the 22:01Z payloads) DONE — commit
  `e8d57b57` landed them; superseded by this firing's 1.1. Prior 3.1 changed shape — Kim
  ANSWERED the batched confirm (both harvest rows APPROVED in the host's AskUserQuestion round);
  the decision is no longer open, but `/make-pack` is command-only
  (disable-model-invocation), so execution waits on Kim running it herself — recast as this
  firing's 3.1. Prior 3.2 (RDD-tier gap) RESOLVED and dropped — ruled ADR/IDR-only scope for
  agent-ui; Revalidation mode ran its first pass under that ruling this firing (5/5 CONFIRMED).
  Prior 4.1 carries forward (verified still OPEN upstream, below). Prior standing note on open
  issues #1549/#1553 is STALE — both closed this session (repo-cleaner independently reverified:
  genuinely closed, branches deleted; not a stale-claim finding). No entry dropped as parked —
  no carried id shows a `backlog`/`roadmap` label in evidence.
- **needs-ruling lane**: none — issue-sorter fully clean, 0 mints, checkpoint advanced
  (everything discovered since the last check was already-closed/merged history).
- **Blocked-by convention (#193)**: no queue entry this firing is issue-backed; no literal
  `Blocked-by:` line in evidence. The prior soft edge (harvests wait on the confirm) is
  discharged — the confirm happened; 3.1 now waits only on Kim's own hands.
- **Verdict**: maintenance no-op pass — nothing new to queue. Hygiene and intake are both fully
  clean two firings running; decision-watcher's forward mode was a clean no-op and its
  Revalidation mode is now LIVE on this repo (first run: 5 claims sampled, 5/5 CONFIRMED,
  cursor 0→5 of 217). The only open ops debt is the two Kim-approved `/make-pack` harvest runs
  (command-only, Kim executes) and the standing upstream #46 pin.

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## 1. Gated mutations already verified safe

### 1.1 Land this firing's ops state — one commit, ops paths ONLY (dispatching host; 5 min)
- **Action**: apply this plan's payload, then `git add` exactly this firing's ops paths —
  `watch-checkpoint.json` (modified), `revalidation-checkpoint.json` (new),
  `reports/2026-08-20T224358Z-repo-cleaner.md` (new), plus this plan — and commit on `main`.
  Do NOT stage `.claude/ops/sweep-in-flight.json` — it is this sweep's own live marker; leave
  it until the sweep concludes.
- **Owner**: dispatching host (the ops-write split's dispatching session).
- **Evidence**: ops-write-sandbox-rules (dispatcher applies + lands payloads); `git status`
  this firing shows exactly those paths dirty/untracked plus the in-flight marker.
- **Size**: 5 minutes.

## 2. Blocking other work

(none — 0 open PRs repo-wide, no held worktrees in evidence, no entry blocks another.)

## 3. Human-decision items

### 3.1 Run the two APPROVED `/make-pack` harvests — adr-0227 and adr-0226 (Kim runs; ~1 h/row)
- **Action**: both `adr-queue.json` harvest rows are already Kim-approved (AskUserQuestion
  round, prior session) — no decision remains, only execution, and `/make-pack` is command-only
  (disable-model-invocation), so Kim runs each herself:
  - `/make-pack .claude/skills/component-patterns` — adr-0227's shared/app-state grammar as a
    new shared-state-grammar row in `references/patterns-table.md` (rows 39/42 cite
    ADR-0192/0193 individually but carry no general grammar row; placement judgment stays with
    the doc seat).
  - `/make-pack .claude/skills/a2ui-payload-authoring` — adr-0226's Button `icon`/`iconOnly`
    props as an extend of `references/node-idioms.md`'s Button entry (drop the
    Column(Icon,Button) workaround), noting the possible component-patterns
    cross-prop-validation row (catalog-wide floor) for the doc seat to judge.
  After each run lands, decision-watcher's next firing drains the corresponding queue row.
- **Owner**: Kim (the runs — command-only; the host cannot fire them programmatically).
- **Evidence**: `adr-queue.json` (2 `harvest` rows, queued 2026-08-20T22:03:27Z, unchanged this
  firing); decision-watcher findings this firing (both candidates UNCHANGED/still pending);
  host-surfaced approval, prior AskUserQuestion round.
- **Size**: ~1 hour per row (the doc-seat work inside each command run).

## 4. Hygiene debt

### 4.1 nonoun-plugins#46 — ratify-only-flip hash gap, verified still OPEN upstream this firing; pin stands (upstream lane; 0 min here)
- **Action**: carried forward. Live-verified this firing: `kimgranlund/nonoun-plugins#46`
  ("adr_checkpoint.py: hash the amendment ratification marker") is OPEN. INTERIM PIN unchanged:
  when Kim ratifies an amendment on an already-`accepted` ADR with no body-byte change, the
  host re-dispatches decision-watcher with an explicit "re-judge adr-00NN amendment"
  instruction. The pin stays until #46 closes.
- **Owner**: nonoun-plugins upstream (the script fix) · dispatching host (the pin, per firing) ·
  Kim (unparking the upstream bundle).
- **Evidence**: live `gh issue view 46 -R kimgranlund/nonoun-plugins` this firing → OPEN.
- **Size**: 0 minutes here; small tooling task upstream.

## Standing notes (not queue entries)

- **Revalidation mode is now LIVE on this repo** (new capability this firing): first run under
  the ruled ADR/IDR-only scope sampled 5 claims (adr-0001..0005), all CONFIRMED; cursor
  advanced 0→5 of 217; checkpoint at `revalidation-checkpoint.json`. Subsequent firings resume
  from the cursor — no action needed.
- **Hygiene fully clean, second consecutive firing**: repo-cleaner 0 findings, 0 executions;
  #1549/#1553 independently reverified genuinely closed with branches deleted; 0 open PRs;
  0 open issues repo-wide this firing.
- **Intake fully clean, second consecutive firing**: issue-sorter 0 mints, checkpoint advanced
  (all discoveries were already-closed/merged history).
- **Dirty `main` is this sweep's own marker**: `.claude/ops/sweep-in-flight.json` — leave alone
  until the sweep concludes.
- **gitignore G1 noise** (6 stale rules): standing Kim-ruled keep-list, never re-proposed.
- **gen-ui-kit**: out of this board's scope (dedicated session per Kim's ruling).

*Composed by chore-planner, 2026-08-20T22:43:58Z sweep firing — returned as payload per the #125
ops-write split; written and landed by the dispatching session.*

Dispatch: 2026-08-20T22:43:58Z
