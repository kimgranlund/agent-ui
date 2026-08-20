<!-- target-path: .claude/ops/plan.md -->
# Ops plan — agent-ui

- **Dispatch**: 2026-08-20T07:05:00Z sweep firing (chore-planner, /sweep-chores, sweep mode —
  three attached seat reports: decision-watcher, issue-sorter, repo-cleaner).
- **Evidence**: exactly this firing's three seat reports and their fenced payloads
  (`adr-queue.json` rewrite · `adr-checkpoint.json` advance to 221 ADRs ·
  `watch-checkpoint.json` advance · `reports/2026-08-20T033659Z-issue-sorter.md` ·
  `reports/2026-08-20T033740Z.md`) plus the prior plan (2026-08-20T01:40:26Z compose,
  carry-forward only). Nothing refetched.
- **UNMEASURED seats**: none — the dispatch named zero UNMEASURED seats and all three returned;
  issue-sorter reached both sources (both checkpoint entries advance, status ok); repo-cleaner
  fetched/pruned/reverified live. Inherited gap: #1437 and #1282 live state remain unverified —
  the seat reports sweep an update window (2026-08-20T01:41:31Z→03:36:59Z), not the open board,
  and neither id appeared in-window.
- **Payload-fence audit (ops-write-sandbox-rules)**: CLEAN — zero violations.
  decision-watcher: BOTH state files fenced at their target paths (`adr-queue.json`,
  `adr-checkpoint.json`) — the prior firing's narrated-but-absent checkpoint is thereby
  RECOVERED (prior 2.1 resolved; no `/tmp` archaeology or re-dispatch needed). issue-sorter:
  `watch-checkpoint.json` + suffixed report both fenced; `friendlies.json`/`held-items.md`
  correctly omitted as unchanged, not conditionally narrated. repo-cleaner: full report fenced
  at its named path.
- **Corrections vs the prior plan**: prior 1.1 (land 01:40Z payloads) superseded by this
  firing's 1.1. Prior 2.1 (checkpoint recovery) RESOLVED — see audit above. Prior 3.1
  (adr-0163 harvest confirm) RESOLVED-BY-EVIDENCE — the harvest shipped and merged (PR #1501;
  repo-cleaner closed its `harvest-adr-0163` branch this firing) and the rewritten
  `adr-queue.json` no longer carries the row; the queue now holds exactly the two fresh
  candidates below. Prior 3.3 (`1466-routing-followups` locked-worktree ruling)
  RESOLVED-BY-EVIDENCE — repo-cleaner finds both previously locked worktrees gone; nothing to
  rule on. Prior 4.1 (seat-suffix report-path convention, upstream filing owed)
  RESOLVED-BY-EVIDENCE — issue-sorter this firing names and USES the convention as canonical
  in `watch-tickets` ("the #774 collision fix"), emitting its report at the suffixed path; the
  fix exists upstream, nothing left to file. Prior 2.2, 3.2, 4.2 carry forward (below). No
  entry dropped as parked — no carried id shows a `backlog`/`roadmap` label in evidence.
- **needs-ruling lane**: none — issue-sorter reports zero ruling-shaped items, zero holds
  (11 issues + 34 PRs in window, all pre-classified, all sole-friendly-authored, zero mints).
- **Blocked-by convention (#193)**: no literal `Blocked-by:` lines in evidence this firing.
  Soft edges named inline: both harvest executions wait on 3.1's confirm; the adr-0224 harvest
  additionally waits on its amendment's ratification state (GH #1505 — see 3.1's inline note).
- **Verdict**: clean, low-debt firing — every payload fenced (last firing's one violation
  recovered by this firing's own checkpoint payload), the estate stays at zero
  worktree/local-branch backlog (only 2 leftover merged-PR remote branches closed, reverified
  gone, 0 open PRs), intake a verified no-op — the only human work is one batched confirm over
  the two fresh ADR-harvest rows (adr-0224 correction, adr-0225 new-pattern rows).

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## 1. Gated mutations already verified safe

### 1.1 Land this firing's fenced ops state — one commit, ops paths ONLY (dispatching host; 5 min)
- **Action**: apply every fenced payload in this firing's reports verbatim, then `git add`
  exactly those ops paths — `adr-queue.json`, `adr-checkpoint.json`, `watch-checkpoint.json`,
  `reports/2026-08-20T033659Z-issue-sorter.md`, `reports/2026-08-20T033740Z.md`, and this plan
  — and commit on `main`. Do NOT stage or stash `.claude/ops/sweep-in-flight.json`: it is this
  sweep's own live marker (session `8e38eb01` matches this dispatch; repo-cleaner withheld
  `sync_main.py` for exactly this reason) — leave it until the sweep concludes.
- **Owner**: dispatching host (the ops-write split's dispatching session).
- **Evidence**: ops-write-sandbox-rules (dispatcher applies + lands payloads); repo-cleaner
  report `reports/2026-08-20T033740Z.md` (Inventory: own-session marker evidence; Executed:
  `sync_main.py` withheld rationale).
- **Size**: 5 minutes.

## 2. Blocking other work

(none — #1437, the sole carried blocker entry, verified CLOSED below and dropped; see the
2026-08-20T05:00:00Z addendum at the end of this file.)

## 3. Human-decision items

### 3.1 Batched confirm — the TWO fresh harvest rows in `adr-queue.json` (Kim confirms; host executes; ~5 min)
- **Action**: one `AskUserQuestion` round over both queued candidates (per decision-watcher's
  step-6 batched-confirm contract; queue was empty going in, holds exactly these two):
  **adr-0224** — the ratified restyle amendment (GH #1505) retires cl.3's status-tinted
  accent edge for a full-perimeter outline + enlarged status dot, so
  `component-design/references/mint-vs-compose.md`'s TYPE-arm worked example (~line 124) now
  cites anatomy the shipped component no longer has → EXTEND that reference. Inline check
  during the confirm: the seat's prose says "ratified" but its own evidence field says
  "proposed/awaiting ratification per header, GH #1505" — verify the amendment's real
  ratification state first (the known stale-guard-banner class cuts both ways); genuinely
  unratified → the adr-0224 harvest waits on the flip.
  **adr-0225** — ratification (GH #1478) mints a SECOND `EXCLUSION_ALLOWLIST` justification
  category ("persona-scoped content type") beside ADR-0112 cl.6's chrome family, plus a
  reusable "depicted-object color" pigment-token exception, neither cited anywhere in
  `skills/*/references` on `origin/main` → NEW reference rows (component-patterns'
  patterns-table.md + wherever the color exception lands). Confirmed → host dispatches
  `/make-pack` at the named reference files (placement judgment stays with `save-lessons`
  Phase 2); declined → rows drop with a note.
- **Owner**: Kim (the confirm); dispatching host fans out the doc seat.
- **Evidence**: this firing's `adr-queue.json` payload (2 `harvest` rows, queued
  2026-08-20T03:37:37Z, each with its own grep-against-origin/main absence evidence);
  decision-watcher report (Judged §, Batched confirm §).
- **Size**: ~5 minutes to confirm; doc-seat execution ~1 hour, not this queue's.

### 3.2 Issue #1282 — ADR-0203 booked repairs still need an owner; state UNVERIFIED four firings running (Kim/host; minutes)
- **Action**: carried forward (prior 3.2). Still no fresh evidence — this firing's window
  (updated 2026-08-20T01:41:31Z→03:36:59Z) did not touch it. Verify with one
  `gh issue view 1282 --json state,labels` before acting: CLOSED or now `backlog`/`roadmap` →
  drop at next compose; still open → assign + dispatch a build seat or schedule into the next
  campaign. Only the ownership decision is queued; execution is dev work.
- **Owner**: Kim (or host under standing autonomy) assigns; a build seat executes.
- **Evidence**: prior plan 3.2 (carry-forward; last live read: OPEN, unassigned, `task`, no
  `Blocked-by:` line). No fresher evidence in this firing's reports.
- **Size**: minutes to verify + assign.

## 4. Hygiene debt

### 4.1 nonoun-plugins#46 — ratify-only-flip hash gap, still open upstream; pin stands (upstream lane; 0 min here)
- **Action**: carried forward (prior 4.2; no evidence it closed). INTERIM PIN unchanged: when
  Kim ratifies an amendment on an already-`accepted` ADR with no body-byte change, the host
  re-dispatches decision-watcher with an explicit "re-judge adr-00NN amendment" instruction.
  This firing both deltas (adr-0224 amendment, adr-0225 status flip) surfaced unprompted as
  hash changes — good firings, still not evidence the upstream gap closed; the pin stays
  until #46 does.
- **Owner**: nonoun-plugins upstream (the script fix) · dispatching host (the pin, per
  firing) · Kim (unparking the upstream bundle).
- **Evidence**: prior plan 4.2 (carry-forward); this firing's decision-watcher classify delta
  (`amended: adr-0224, adr-0225`).
- **Size**: 0 minutes here; small tooling task upstream.

## Standing notes (not queue entries)

- **Executed hygiene this firing**: 2 merged-PR remote branches closed via `campaign_close.py`
  (#1492 `1489-summary-action-card`, #1501 `harvest-adr-0163`), both clean/exit 0,
  reverified gone; 6 stale `origin/*` refs pruned; `primary_checkout_check.py` clean; 0 open
  PRs repo-wide; worktree/local-branch backlog holds at zero after the prior firing's big reap.
- **Both previously locked worktrees are gone** (`1466-routing-followups`,
  `1489-summary-action-card`) — the prior plan's 3.3 liveness question is moot; dropped with
  this note, not silently.
- **Seat-suffix report-path convention is now canonical** in `watch-tickets` (the #774
  collision fix) — issue-sorter used it this firing; the prior plan's 4.1 upstream-filing
  entry is resolved and dropped with this note.
- **Dirty `main` is this sweep's own marker**: `.claude/ops/sweep-in-flight.json` (pid 930,
  session `8e38eb01`) — leave alone until the sweep concludes; `sync_main.py` correctly
  withheld.
- **gitignore G1 noise** (6 stale rules): standing Kim-ruled keep-list, never re-proposed.
- **`delete_branch_on_merge` is `false` on this repo** — the per-firing branch-close trickle is
  structural; a repo-setting flip stays a Kim ruling, not ops debt — named so it doesn't read
  dropped.
- **Intake lane clean**: 11 issues + 34 PRs in window, all pre-classified, all
  sole-friendly-authored; zero mints, zero holds, zero non-owner filings all-time; bootstrap
  gates (roster/MCP offer) long-resolved (2026-08-05).
- **gen-ui-kit**: out of this board's scope (dedicated session per Kim's ruling).

*Composed by chore-planner, 2026-08-20T07:05:00Z sweep firing — returned as payload per the #125
ops-write split; written and landed by the dispatching session.*

Dispatch: 2026-08-20T07:05:00Z

---

## Addendum — 2026-08-20T05:00:00Z firing (a separate, concurrent three-seat sweep dispatched
before this compose's e2bd3074 commit was discovered; merged here rather than overwriting)

- **#1437 dropped**: verified `gh issue view 1437 --json state,closedAt` → **CLOSED
  2026-08-20T00:19:07Z**, well before either firing's own window opened. Both this plan's 2.1
  and its own prior-plan ancestors carried it forward unverified for several firings; the
  marshal's same-session Findings on the issue (docs-chrome-narrow-open golden reproduced
  green on current main, full `test:browser` chain ran clean) are the real closing evidence.
  Dropped, not carried a sixth time.
- **Executed hygiene this firing** (additive to 07:05Z's own): 3 further merged-PR remote
  branches closed via `campaign_close.py` — #1513 (`1508-command-modal-icons`), #1514
  (`1510-drill-contained-design`), #1507 (`harvest-adr-0224-0225`) — each clean/exit 0,
  reverified gone. Note: closing #1507's branch is what makes 3.1's adr-0224/adr-0225 harvest
  question below moot on the MERGE side — the harvest PR is landed; only Kim's confirm-or-not
  on the reference-content questions in 3.1 remains outstanding, unaffected by this branch
  close.
- **Two live worktrees held throughout, confirmed KEPT by this firing's own repo-cleaner
  dry-run too**: `1195-drill-s1-stack-default` (locked, drill S1 build) and
  `1515-breadcrumb-design` (the #1515 breadcrumb design lane, mid-fix at this addendum's write
  time) — never flagged, never touched.
- **decision-watcher delta**: one further new ADR since this plan's own 221-count baseline —
  **adr-0226** ("catalog Button icon mechanism," `status: proposed`) — held pending
  ratification, not yet judgeable (the proposed-marker gate); re-surfaces as `amended` for
  judgment once Kim ratifies or returns it. `adr-checkpoint.json`'s `adr-0226` entry reflects
  this.
- **issue-sorter delta**: window 2026-08-20T03:36:59Z→05:00:00Z — 6 issues (#1478/#1483/#1495/
  #1508/#1510/#1515) + 8 PRs (#1492/#1501/#1507/#1509/#1511/#1512/#1513/#1514), all
  sole-friendly-authored and already correctly kind-labeled at filing; nothing minted, nothing
  held.
- **3.1's harvest confirm (adr-0224/adr-0225) is STILL LIVE and STILL NEEDS KIM** — nothing in
  this addendum resolves it; surfacing again here so it isn't lost under the newer addendum
  text: the reference-content questions (mint-vs-compose.md's stale TYPE-arm example; the two
  new patterns-table/pigment-exception rows) await the batched confirm this plan's own §3.1
  describes.
