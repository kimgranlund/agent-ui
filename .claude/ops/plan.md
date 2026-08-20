<!-- target-path: .claude/ops/plan.md -->
# Ops plan — agent-ui

- **Dispatch**: 2026-08-20T01:40:26Z sweep firing (chore-planner, /sweep-chores, sweep mode —
  three attached seat reports: decision-watcher, issue-sorter, repo-cleaner).
- **Evidence**: exactly this firing's three seat reports and their fenced payloads
  (`.claude/ops/adr-queue.json` rewrite · `.claude/ops/watch-checkpoint.json` advance ·
  `.claude/ops/reports/2026-08-20T014605Z.md`) plus the prior plan (2026-08-19T21:56:06Z
  compose, carry-forward only). Nothing refetched.
- **UNMEASURED seats**: none — all three seats returned; issue-sorter reached both sources
  (both checkpoint entries advance); repo-cleaner fetched/pruned/verified live. Inherited gap:
  #1282's live state remains unverified for a third firing (see 3.2) — the seat reports sweep
  an update window, not the open board.
- **Payload-fence audit (ops-write-sandbox-rules)**: ONE VIOLATION —
  decision-watcher's `.claude/ops/adr-checkpoint.json` is a **narrated-but-absent write**: the
  report claims both scratch files are "held at /tmp/... for the dispatching session to apply
  verbatim", but only `adr-queue.json` has a target-pathed fenced block; the checkpoint has
  none, and a `/tmp` path reference is not a payload. Named, not absorbed — recovery queued
  at 2.1. issue-sorter — `watch-checkpoint.json` payload present; friendlies/held-items
  correctly omitted as unchanged; no report-file path claimed, none owed. repo-cleaner — full
  report payload present at its named path (unsuffixed this firing; no collision — the only
  report file emitted).
- **Corrections vs the prior plan**: prior 1.1 (`branch.main.merge` repoint) DONE — this
  firing's repo-cleaner reads it correctly `refs/heads/main`, no longer a finding. Prior 3.1
  (7 harvest rows) and 4.1 (adr-0021 stale citation) RESOLVED-BY-EVIDENCE — decision-watcher's
  rewritten `adr-queue.json` carries neither; the queue now holds exactly one fresh candidate
  (adr-0163, queued 2026-08-20T01:41:50Z). Prior 1.2 recurs as this firing's 1.1. Prior 2.1,
  3.2, 4.2, 4.3 carry forward (below). No entry dropped as parked — no carried id shows a
  `backlog`/`roadmap` label in evidence.
- **needs-ruling lane**: none — issue-sorter reports zero ruling-shaped items, zero holds
  (33 issues + 34 PRs in window, all pre-classified, all sole-friendly-authored; 16 new issues
  #1450–#1489 all minted via the capture skills with full record shape).
- **Blocked-by convention (#193)**: no literal `Blocked-by:` lines in evidence this firing.
  Soft edges named inline: 1.1's landing set excludes the checkpoint until 2.1 resolves;
  adr-0163 harvest execution waits on 3.1's confirm.
- **Verdict**: heavy-hygiene, one-violation firing — repo-cleaner executed its largest gated
  set yet (33 merged-PR remote branches closed, 4 worktrees + 8 branch/marker rows reaped,
  both live worktrees preserved), intake is a verified no-op, the ADR lane queued one fresh
  harvest row — but decision-watcher's checkpoint payload is narrated-but-absent and must be
  recovered before its next firing, and `main` carries a live parallel session's untracked
  state that the landing commit must not sweep.

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## 1. Gated mutations already verified safe

### 1.1 Land this firing's fenced ops state — one commit, ops paths ONLY (dispatching host; 5 min)
- **Action**: apply every fenced payload in this firing's reports, then `git add` exactly those
  ops paths — `adr-queue.json`, `watch-checkpoint.json`,
  `reports/2026-08-20T014605Z.md`, and this plan — and commit on `main`. EXCLUDES
  `adr-checkpoint.json` (no fenced payload exists — blocked by 2.1; land it in a follow-up
  commit once recovered, never reconstruct it by hand). Do NOT stage
  `.claude/ops/sweep-in-flight.json` (this sweep's live marker) nor the two untracked
  live-session paths on `main` (`.claude/ops/sweep-in-flight.json` aside:
  `.claude/overhaul-run-2026-08-20.md` belongs to the running `/overhaul-execute` session,
  pid 5719 — repo-cleaner withheld `sync_main.py` for exactly this reason; do not stash).
- **Owner**: dispatching host (the ops-write split's dispatching session).
- **Evidence**: ops-write-sandbox-rules (dispatcher applies + lands payloads); repo-cleaner
  report `.claude/ops/reports/2026-08-20T014605Z.md` (Inventory: dirty-`main` evidence;
  Executed: `sync_main.py` withheld rationale).
- **Size**: 5 minutes.

## 2. Blocking other work

### 2.1 Recover decision-watcher's adr-checkpoint payload — narrated-but-absent write (dispatching host; 10 min)
- **Action**: the checkpoint advance exists only as a claimed `/tmp/decision-watcher-adr-checkpoint.json`
  scratch file, never as a target-pathed fenced block — a contract violation per
  ops-write-sandbox-rules (the issue-#140 class). Without it, `.claude/ops/adr-checkpoint.json`
  stays at the prior firing's 220-ADR state and the next decision-watcher firing re-judges
  already-judged ADRs. Recover: if the named `/tmp` scratch still exists, inspect it, verify it
  is a plausible superset of the applied 220-ADR checkpoint, apply + land it (follow-up to
  1.1's commit); otherwise re-dispatch decision-watcher for the checkpoint payload alone.
  Blocks the next decision-watcher firing's correctness — resolve before that firing.
- **Owner**: dispatching host.
- **Evidence**: decision-watcher report this firing (prose claims two scratch files; only the
  `adr-queue.json` fence exists); ops-write-sandbox-rules §narrated-but-absent.
- **Size**: 10 minutes (or one re-dispatch).

### 2.2 #1437 — visual golden gate; carried watch, evidence now two firings stale (marshal; watch, 0 min here)
- **Action**: carried forward (prior 2.1). No fresh evidence this firing in any seat report or
  dispatch context — the marshal was verifying as of 2026-08-19T21:56Z. A red golden gate
  blocks pixel-verified merges on every visual lane. One `gh issue view 1437 --json state`
  (or the marshal's own word) at next host touch: green/closed → drop at next compose; still
  red → escalate to Kim with the marshal's findings rather than re-dispatching cold.
- **Owner**: marshal (engaged as of last evidence); dispatching host verifies/escalates.
- **Evidence**: prior plan 2.1 (carry-forward; original source was dispatch standing context,
  not seat reports — named as such then and now). No fresher evidence this firing.
- **Size**: 0 minutes here; minutes to verify at next host touch.

## 3. Human-decision items

### 3.1 Confirm the adr-0163 HARVEST candidate in `adr-queue.json` (Kim confirms; host executes; ~5 min to confirm)
- **Action**: one confirm on the single queued row — adr-0163's ratified amendment (commit
  2b883062) retires both cl.3 native-form-element exceptions via ui-table dogfooding
  ui-checkbox/ui-radio/ui-button, carrying the capture-phase click-guard technique
  (native radio-group semantics without roving-tabindex) + the ADR-0223 `inline` opt-out rule
  for composed controls in `<td>`/`<th>`. Grep-verified absent from every existing citation
  site; candidate target: a dogfood-over-native-exception row + click-guard technique in
  component-patterns/references/patterns-table.md (or component-build's references).
  Confirmed → host dispatches one doc seat; declined → row drops with a note.
- **Owner**: Kim (the confirm); dispatching host fans out the doc seat.
- **Evidence**: this firing's `adr-queue.json` payload (1 `harvest` row, queued
  2026-08-20T01:41:50Z, with its own grep-against-origin/main absence evidence).
- **Size**: ~5 minutes to confirm; ~1 hour doc-seat execution, not this queue's.

### 3.2 Issue #1282 — ADR-0203 booked repairs still need an owner; state UNVERIFIED three firings running (Kim/host; minutes)
- **Action**: carried forward (prior 3.2). Still no fresh evidence — this firing's window
  (updated ≥ 2026-08-19T21:57:35Z) did not touch it. Verify with one
  `gh issue view 1282 --json state,labels` before acting: CLOSED or now `backlog`/`roadmap` →
  drop at next compose; still open → assign + dispatch a build seat or schedule into the next
  campaign. Only the ownership decision is queued; execution is dev work.
- **Owner**: Kim (or host under standing autonomy) assigns; a build seat executes.
- **Evidence**: prior plan 3.2 (carry-forward; last live read: OPEN, unassigned, `task`, no
  `Blocked-by:` line). No fresher evidence in this firing's reports.
- **Size**: minutes to verify + assign.

### 3.3 `1466-routing-followups` — stale-but-locked worktree needs a liveness ruling (Kim/host; 5 min)
- **Action**: the branch's own PR #1471 was CLOSED-not-merged (superseded by the merged
  `1466-routing-rebased`/PR #1473) and its remote tracking ref reads `gone`, but it sits in a
  locked worktree, so both gated reap scripts correctly declined to touch it. Human check
  whether that lane is still live: dead → unlock so the next repo-cleaner firing reaps it;
  live → leave locked and note why.
- **Owner**: Kim (or host, if the lane's liveness is independently verifiable).
- **Evidence**: repo-cleaner report `.claude/ops/reports/2026-08-20T014605Z.md`
  (Proposed-but-not-executed + Risks 🟡).
- **Size**: 5 minutes.

## 4. Hygiene debt

### 4.1 Seat-suffix report-filename convention — upstream filing still owed (Kim/host; 5 min)
- **Action**: carried forward (prior 4.2; no evidence it was filed). No collision THIS firing
  — only repo-cleaner emitted a report file, at the unsuffixed standing-default path
  (`reports/2026-08-20T014605Z.md`) — which is exactly why the gap stays latent, not fixed.
  File one upstream nonoun-plugins issue proposing a standing seat-suffixed report-path
  convention for multi-seat firings.
- **Owner**: Kim or dispatching host files upstream; nonoun-plugins owns the fix.
- **Evidence**: prior plan 4.2 (carry-forward; the 2026-08-19 collision); this firing's
  unsuffixed repo-cleaner report path.
- **Size**: 5 minutes to file.

### 4.2 nonoun-plugins#46 — ratify-only-flip hash gap, still open upstream; pin stands (upstream lane; 0 min here)
- **Action**: carried forward (no evidence it closed). INTERIM PIN unchanged: when Kim
  ratifies an amendment on an already-`accepted` ADR with no body-byte change, the host
  re-dispatches decision-watcher with an explicit "re-judge adr-00NN amendment" instruction.
  This firing decision-watcher DID catch the ADR-0163 ratified amendment unprompted (heading
  reads **ratified**, commit 2b883062) — one good firing is not evidence the upstream gap
  closed; the pin stays until #46 does.
- **Owner**: nonoun-plugins upstream (the script fix) · dispatching host (the pin, per
  firing) · Kim (unparking the upstream bundle).
- **Evidence**: prior plan 4.3 (carry-forward); this firing's decision-watcher adr-0163 row.
- **Size**: 0 minutes here; small tooling task upstream.

## Standing notes (not queue entries)

- **Executed hygiene this firing (no queue entries needed)** — the largest gated set this seat
  has measured: 33 merged-PR remote branches closed via `campaign_close.py`, all clean/exit 0,
  reverified gone (`git branch -r` now shows only `origin/main`); first-ever
  `reap-worktrees.mjs --execute` removed 4 merged-PR-tip worktrees; `reap-branches.mjs
  --execute` (run second, per seat-map ordering) deleted 4 local branches + 4 orphaned
  worktree markers; 10 stale `origin/*` refs pruned; `primary_checkout_check.py` clean both
  runs; 0 open PRs repo-wide.
- **Two locked worktrees are LIVE lanes, not cruft**: `1489-summary-action-card`
  (`agent-a391225d4e8890e21`, advanced mid-firing `13febfb4`→`5fab8aab` — live concurrent
  work) and `1466-routing-followups` (locked, but see 3.3 — liveness in question).
- **Dirty `main` is a live parallel session's own state**: `.claude/ops/sweep-in-flight.json`
  (pid 5719, session agent-ui-86-8e38eb01) + `.claude/overhaul-run-2026-08-20.md` — leave
  both alone until that session concludes; `sync_main.py` correctly withheld.
- **`delete_branch_on_merge` is `false` on this repo** (confirmed via `gh api`) — the 33-branch
  backlog is structural, not incidental; repo-cleaner absorbs it per firing. A repo-setting
  flip would be a Kim ruling, not ops debt — not queued, named so it doesn't read dropped.
- **Intake lane clean**: 33 issues + 34 PRs in window, 16 new issues (#1450–#1489) all
  pre-classified with full record shape; zero mints, zero holds, zero `needs-ruling`;
  bootstrap gates (roster/MCP offer) long-resolved (2026-08-05).
- **gitignore G1 noise** (6 stale rules): standing Kim-ruled keep-list, never re-proposed.
- **gen-ui-kit**: out of this board's scope (dedicated session per Kim's ruling).

*Composed by chore-planner, 2026-08-20T01:40:26Z sweep firing — returned as payload per the #125
ops-write split; written and landed by the dispatching session.*

Dispatch: 2026-08-20T01:40:26Z
