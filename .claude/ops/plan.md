<!-- target-path: .claude/ops/plan.md -->
# Ops plan — agent-ui

- **Dispatch**: 2026-08-20T05:25:20Z sweep firing (chore-planner, /sweep-chores, sweep mode —
  three attached seat reports: decision-watcher, issue-sorter, repo-cleaner).
- **Evidence**: exactly this firing's three seat reports and their fenced payloads
  (`adr-checkpoint.json` advance to 222 ADRs · `adr-queue.json` rewrite, 1 harvest row ·
  `watch-checkpoint.json` advance · `reports/2026-08-20T052629Z.md` ·
  `reports/2026-08-20T052748Z.md`) plus the prior plan (2026-08-20T07:05:00Z compose + its
  05:00:00Z addendum, carry-forward only). Nothing refetched.
- **UNMEASURED seats**: none — the dispatch named zero UNMEASURED seats ([]) and all three
  returned; issue-sorter reached both sources (both checkpoint entries advanced, status ok);
  repo-cleaner fetched/pruned/reverified live. Inherited gap: #1282's live state remains
  unverified — this firing's discovery window (05:00:00Z→05:26:29Z) swept only #1510/#1497/#1478
  and two merged PRs; #1282 did not appear.
- **Payload-fence audit (ops-write-sandbox-rules)**: CLEAN — zero violations, zero
  narrated-but-absent claims. decision-watcher: both state files fenced at their target paths.
  issue-sorter: `watch-checkpoint.json` + suffixed report both fenced; `friendlies.json` /
  `held-items.md` correctly omitted as unchanged, not conditionally narrated. repo-cleaner:
  executed nothing, so its only durable output — the report — is fenced at its named path.
- **Corrections vs the prior plan**: prior 1.1 (land the 07:05Z/05:00Z payloads) superseded by
  this firing's 1.1. Prior 3.1 (adr-0224/adr-0225 batched harvest confirm) RESOLVED-BY-EVIDENCE
  — decision-watcher this firing states the queue was EMPTY going in (both rows cleared) and the
  prior addendum already recorded the `harvest-adr-0224-0225` PR (#1507) merged; the queue now
  holds exactly the one fresh adr-0195 row below. Prior 3.2 (#1282) and prior 4.1
  (nonoun-plugins#46 pin) carry forward (below). Prior addendum's #1437 drop stands (verified
  CLOSED there; not re-carried). No entry dropped as parked — no carried id shows a
  `backlog`/`roadmap` label in evidence.
- **needs-ruling lane**: none — issue-sorter reports zero ruling-shaped items, zero holds
  (3 issues + 2 PRs in window, all pre-classified, all sole-friendly-authored, zero mints;
  all-time foreign-filing sanity search: zero rows).
- **Blocked-by convention (#193)**: no literal `Blocked-by:` lines in evidence this firing. One
  soft edge named inline: the adr-0195 harvest execution (`/make-pack`) waits on 3.1's confirm.
- **Verdict**: the cleanest firing in the ledger — zero payload violations, zero mutations even
  needed (no merged-branch remainders, 0 open PRs, `main` byte-identical to `origin/main`,
  worktree/local-branch backlog at zero), intake a verified no-op; the only human work is one
  confirm over the single fresh adr-0195 harvest row plus the long-carried #1282 ownership call.

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## 1. Gated mutations already verified safe

### 1.1 Land this firing's fenced ops state — one commit, ops paths ONLY (dispatching host; 5 min)
- **Action**: apply every fenced payload in this firing's three reports verbatim, then `git add`
  exactly those ops paths — `adr-checkpoint.json`, `adr-queue.json`, `watch-checkpoint.json`,
  `reports/2026-08-20T052629Z.md`, `reports/2026-08-20T052748Z.md`, and this plan — and commit
  on `main`. Do NOT stage or stash `.claude/ops/sweep-in-flight.json`: it is this sweep's own
  live marker (session `8e38eb01` matches this dispatch; repo-cleaner withheld `sync_main.py`
  for exactly this reason) — leave it until the sweep concludes.
- **Owner**: dispatching host (the ops-write split's dispatching session).
- **Evidence**: ops-write-sandbox-rules (dispatcher applies + lands payloads); repo-cleaner
  report (Inventory: own-session marker, session-id match; `sync_main.py` withheld rationale);
  all five payload fences present in this firing's reports.
- **Size**: 5 minutes.

## 2. Blocking other work

(none — no entry in evidence blocks another; the two live worktrees, #1510 drill S1 and #1515
breadcrumb, are healthy in-flight dev lanes, both Kim-assigned, both updated within the hour,
correctly untouched by repo-cleaner.)

## 3. Human-decision items

### 3.1 Batched confirm — the ONE fresh harvest row in `adr-queue.json`: adr-0195 (Kim confirms; host executes; ~5 min)
- **Action**: one `AskUserQuestion` round over the single queued candidate (decision-watcher's
  step-7 batched confirm, deferred to the dispatching session — queue was empty going in, holds
  exactly this row): **adr-0195** — the ratified CONTAINED-pane amendment (2026-08-19, verified
  2026-08-20, GH #1510) adds three durable patterns (cl.A1 one-state/three-render-mappings ·
  cl.A7 VT shared-name pairing-law correction · cl.A8 host-container-query auto-degrade) that
  the existing `component-patterns/references/patterns-table.md` ADR-0195 row (cites only
  cl.2–4 on `origin/main`, verified by the seat's own grep) does not carry — and the ADR's own
  cl.A9 names this repair as owed. Confirmed → host dispatches
  `/make-pack .claude/skills/component-patterns` (extend the existing row / add sibling rows —
  placement judgment stays with the doc seat); declined → the row drops with a note. Soft edge:
  the harvest execution waits on this confirm (#193 inline naming; no literal `Blocked-by:`).
- **Owner**: Kim (the confirm); dispatching host fans out the doc seat.
- **Evidence**: this firing's `adr-queue.json` payload (1 `harvest` row, queued
  2026-08-20T05:26:22Z, with origin/main-resolved absence evidence); decision-watcher report
  (Judge §, Placement check §).
- **Size**: ~5 minutes to confirm; doc-seat execution ~1 hour, not this queue's.

### 3.2 Issue #1282 — ADR-0203 booked repairs still need an owner; state UNVERIFIED five firings running (Kim/host; minutes)
- **Action**: carried forward (prior 3.2). Still no fresh evidence — this firing's window
  (2026-08-20T05:00:00Z→05:26:29Z) did not touch it. Verify with one
  `gh issue view 1282 --json state,labels` before acting: CLOSED or now `backlog`/`roadmap` →
  drop at next compose; still open → assign + dispatch a build seat or schedule into the next
  campaign. Only the ownership decision is queued; execution is dev work.
- **Owner**: Kim (or host under standing autonomy) assigns; a build seat executes.
- **Evidence**: prior plan 3.2 (carry-forward; last live read: OPEN, unassigned, `task`, no
  `Blocked-by:` line). No fresher evidence in this firing's reports.
- **Size**: minutes to verify + assign.

## 4. Hygiene debt

### 4.1 nonoun-plugins#46 — ratify-only-flip hash gap, still open upstream; pin stands (upstream lane; 0 min here)
- **Action**: carried forward (prior 4.1; no evidence it closed). INTERIM PIN unchanged: when
  Kim ratifies an amendment on an already-`accepted` ADR with no body-byte change, the host
  re-dispatches decision-watcher with an explicit "re-judge adr-00NN amendment" instruction.
  This firing's one delta (the adr-0195 amendment) surfaced unprompted as a hash change — a
  good firing, still not evidence the upstream gap closed; the pin stays until #46 does.
- **Owner**: nonoun-plugins upstream (the script fix) · dispatching host (the pin, per
  firing) · Kim (unparking the upstream bundle).
- **Evidence**: prior plan 4.1 (carry-forward); this firing's decision-watcher classify delta
  (`amended: adr-0195`, hash-detected).
- **Size**: 0 minutes here; small tooling task upstream.

## Standing notes (not queue entries)

- **Zero mutations needed this firing**: no merged-PR remote branch remained
  (`ls-remote --heads origin` → only `main`; PRs #1150–#1517 surveyed, none OPEN); 2 stale
  `origin/*` refs pruned pre-survey; `primary_checkout_check.py` clean, `main` byte-identical
  to `origin/main` (the prior 2-behind gap resolved); both reap scripts dry-run clean, 0 fail.
- **Two live worktrees held**: `1195-drill-s1-stack-default` (#1510, `KEEP(dirty)`) and
  `1515-breadcrumb-design` (#1515, `KEEP(live-branch)`, 2 pending commits — intake-complete,
  commit 66840a1f not pushed, host ships) — both healthy, correctly untouched.
- **adr-0226 stays `proposed`** ("catalog Button icon mechanism") — held pending ratification
  per the proposed-marker gate; re-surfaces as `amended` for judgment once Kim ratifies or
  returns it. This firing's checkpoint payload carries it as `proposed`.
- **Open unassigned issues #1504/#1496**: named by repo-cleaner for visibility only — open
  board items, not a claim, not ops debt; they route through normal dev planning, not this
  queue.
- **Dirty `main` is this sweep's own marker**: `.claude/ops/sweep-in-flight.json` (pid 22277,
  session `8e38eb01`) — leave alone until the sweep concludes; `sync_main.py` correctly
  withheld.
- **gitignore G1 noise** (6 stale rules): standing Kim-ruled keep-list, never re-proposed.
- **Intake lane clean**: 3 issues + 2 PRs in window, all pre-classified, all
  sole-friendly-authored; zero mints, zero holds, zero non-owner filings all-time; bootstrap
  gates (roster 2026-08-05 / MCP offer declined 2026-08-05, GH #438) long-resolved.
- **gen-ui-kit**: out of this board's scope (dedicated session per Kim's ruling).

*Composed by chore-planner, 2026-08-20T05:25:20Z sweep firing — returned as payload per the #125
ops-write split; written and landed by the dispatching session.*

Dispatch: 2026-08-20T05:25:20Z
