<!-- target-path: .claude/ops/plan.md -->
# Ops plan — agent-ui

- **Dispatch**: 2026-08-19T21:56:06Z sweep firing (chore-planner, /sweep-chores, sweep mode —
  three attached seat reports: issue-sorter, repo-cleaner, decision-watcher; payloads already
  applied on disk at compose time).
- **Evidence**: exactly the three seat reports/applied artifacts
  (`.claude/ops/reports/2026-08-19T215606Z.md`, `.claude/ops/reports/2026-08-19T215606Z-repo-cleaner.md`,
  `.claude/ops/adr-checkpoint.json` + `.claude/ops/adr-queue.json`) plus the prior plan
  (2026-08-19T04:5xZ compose, carry-forward only) plus the dispatch's standing context
  (#1437/#1438/#1440). Nothing refetched.
- **UNMEASURED seats**: none — all three seats returned, all sources reachable (both
  issue-sorter checkpoint entries advanced; decision-watcher checkpoint now 220 ADRs;
  repo-cleaner fetched/pruned/verified live). One inherited gap: #1282's live state is still
  unverified (see 3.2) — the seat reports sweep an update window, not the open board.
- **Payload-fence audit (ops-write-sandbox-rules)**: issue-sorter — report + advanced
  `watch-checkpoint.json` applied; friendlies/held-items correctly omitted as unchanged.
  repo-cleaner — full report applied at the `-repo-cleaner`-suffixed path (deliberate collision
  workaround, see 4.2). decision-watcher — `adr-checkpoint.json` (220) + `adr-queue.json`
  (8 candidates) applied. No narrated-but-absent writes this firing.
- **Corrections vs the prior plan**: prior 1.1 (delete `origin/corpus-judged-wave-2026-08-18`)
  RESOLVED-BY-EVIDENCE — absent from this firing's remote inventory (12 stale refs pruned; PR
  cross-ref found only the 6 merged-PR branches, all closed this firing; 0 open PRs). Prior 1.2 +
  2.1 DONE — `primary_checkout_check.py` clean on `main`, byte-identical to `origin/main`, both
  runs. Prior 3.1 (deploy-main2) RESOLVED-BY-EVIDENCE — absent from this firing's worktree
  inventory and the primary-checkout gate is clean. Prior 3.2 and 4.1 carry forward (below). No
  entry dropped as parked — no carried id shows a `backlog`/`roadmap` label in evidence.
- **needs-ruling lane**: none — issue-sorter reports zero holds, zero ruling-shaped items
  (61 issues + 84 PRs in window, all pre-classified, all sole-friendly-authored).
- **Blocked-by convention (#193)**: no literal `Blocked-by:` lines in evidence this firing. The
  one soft ordering edge (harvest execution waits on 3.1's human confirm) is named inline there.
- **Verdict**: clean-and-current firing — intake is a verified no-op, repo hygiene executed its
  whole gated set (6 remote + 9 local reaps, both live worktrees preserved), and the ADR lane
  queued 7 harvest rows + 1 stale citation. The queue is one verified-safe config fix, the
  ops-state landing leg, one red-gate watch, two human confirms, and three hygiene items.

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## 1. Gated mutations already verified safe

### 1.1 Fix `branch.main.merge` — repoint upstream to `origin/main` (dispatching host; 1 min)
- **Action**: on the primary checkout run `git branch --set-upstream-to=origin/main main`. The
  config currently points at `refs/heads/1411-tracker-partition` (a rename artifact per
  `git reflog show main`). Verified safe: content is byte-identical to `origin/main` (0 ahead /
  0 behind) — cosmetic today, but it already produced one confusing pre-fetch divergence read.
  Config-only; no bundled script gates it, so this one command is the whole action.
- **Owner**: dispatching host (repo-cleaner classified it propose-only; verification is done).
- **Evidence**: repo-cleaner report `.claude/ops/reports/2026-08-19T215606Z-repo-cleaner.md`
  (Inventory + Proposed-but-not-executed).
- **Size**: 1 minute.

### 1.2 Land this sweep's applied ops state — one commit, ops paths ONLY (dispatching host; 5 min)
- **Action**: `git add` exactly the applied ops paths — both firing reports,
  `watch-checkpoint.json`, `adr-checkpoint.json`, `adr-queue.json`, and this plan — and commit
  on `main` (clean this firing, no branch caveat; the prior firing's off-main trap is resolved).
  Do NOT stage `.claude/ops/sweep-in-flight.json` (live marker) or any non-ops path. This also
  clears repo-cleaner's withheld `sync_main.py` condition — the dirt IS this sweep's own state.
- **Owner**: dispatching host (the ops-write split's dispatching session).
- **Evidence**: ops-write-sandbox-rules (dispatcher applies + lands payloads); repo-cleaner
  report, `sync_main.py` withheld-on-live-state rationale + Proposed-but-not-executed.
- **Size**: 5 minutes.

## 2. Blocking other work

### 2.1 #1437 — visual golden red; verification in progress, track to green (marshal; watch, hours)
- **Action**: the visual-golden gate is red and the marshal is already verifying — no new
  dispatch from this queue. Track it: a red golden gate blocks pixel-verified merges on every
  visual lane until it resolves. If the marshal's verification stalls past this firing's
  horizon, escalate to Kim with the marshal's findings rather than re-dispatching cold.
- **Owner**: marshal (already engaged); dispatching host escalates only on stall.
- **Evidence**: dispatch standing context 2026-08-19T21:56:06Z (not in seat-report evidence —
  named as such).
- **Size**: 0 minutes here; watch item until green.

## 3. Human-decision items

### 3.1 Batch-confirm 7 HARVEST candidates in `adr-queue.json` (Kim confirms; host executes; ~10 min to confirm)
- **Action**: one batched confirm over the 7 queued harvest rows, then per-row doc-seat
  execution (execution waits on this confirm — the one soft ordering edge this compose):
  adr-0210 (host-mediated handle model → trust-boundary reference, alongside ADR-0073) ·
  adr-0217 (function-vs-type placement arm → mint-vs-compose.md) · adr-0208 (skillpack import
  source → admin-library-kinds roster-and-interface.md) · adr-0211 (wire-mark jsdom-probe
  methodology → a2ui-catalog authoring guidance) · adr-0107-am3 (third fence-lift instance →
  mint-vs-compose.md smallest-floor section) · adr-0223 (fill-by-default min-width role
  taxonomy + exemption table → component-standards/geometry) · adr-0219 (CVD-safe categorical
  identity → component-patterns patterns-table row). Confirmed rows clear from the queue as
  they harvest; declined rows drop with a note.
- **Owner**: Kim (the confirm); dispatching host fans out doc seats per confirmed row.
- **Evidence**: `.claude/ops/adr-queue.json` (7 `harvest` rows, queued 2026-08-19T22:01:18Z,
  each with its own grep-verified absence evidence).
- **Size**: ~10 minutes to confirm; execution 2-4 hours across doc seats, not this queue's.

### 3.2 Issue #1282 — ADR-0203 booked repairs still need an owner; state UNVERIFIED two firings running (Kim/host; minutes)
- **Action**: carried forward (prior plan 3.2). Still no fresh evidence — this firing's reports
  again measure an update window, not the open board. Verify with one
  `gh issue view 1282 --json state,labels` before acting: CLOSED or now `backlog`/`roadmap` →
  drop at next compose; still open → assign + dispatch a build seat or schedule into the next
  campaign. Execution is dev work, not this queue's — only the ownership decision is queued.
- **Owner**: Kim (or host under standing autonomy) assigns; a build seat executes.
- **Evidence**: prior plan 3.2 (carry-forward; last live read: OPEN, unassigned, `task`, no
  `Blocked-by:` line). No fresher evidence in this firing's reports.
- **Size**: minutes to verify + assign.

## 4. Hygiene debt

### 4.1 adr-0021 stale citation — `component-standards/SKILL.md:50` needs ADR-0223 cl.3(b)'s relocation note (host → save-lessons Phase 6; ~20 min)
- **Action**: the SKILL.md line cites ADR-0021's entry-floor law without noting ADR-0223
  clause 3(b) relocated the ~20ch floor from the unconditional default into the `[inline]`
  hug-state leg (token names/defaults unchanged). Route to save-lessons Phase 6 for the
  fix/retire plan per decision-watcher's own classification — a doc repair, not a ruling.
- **Owner**: dispatching host (dispatch the save-lessons Phase 6 pass / a doc seat).
- **Evidence**: `.claude/ops/adr-queue.json`, the `stale-citation` row (adr-0021), with its
  re-read of ADR-0223's own text.
- **Size**: ~20 minutes.

### 4.2 Seat-suffix report-filename convention — file the harness-plugin gap upstream (Kim/host; 5 min)
- **Action**: this firing's issue-sorter and repo-cleaner reports collided on the identical
  standing-default path (`reports/<timestamp>.md`); repo-cleaner disambiguated by hand with a
  `-repo-cleaner` suffix. File one upstream nonoun-plugins issue proposing a standing
  seat-suffixed report-path convention for any multi-seat firing — a plugin doctrine gap, not
  this repo's to fix locally.
- **Owner**: Kim or dispatching host files upstream; nonoun-plugins owns the fix.
- **Evidence**: repo-cleaner report, naming note + Proposed-but-not-executed.
- **Size**: 5 minutes to file.

### 4.3 nonoun-plugins#46 — ratify-only-flip hash gap, still open upstream; pin stands (upstream lane; 0 min here)
- **Action**: carried forward (no evidence it closed). INTERIM PIN unchanged: when Kim ratifies
  an amendment on an already-`accepted` ADR with no body-byte change, the host re-dispatches
  decision-watcher with an explicit "re-judge adr-00NN amendment" instruction. This firing was
  safe — decision-watcher's delta covered 15 new ADRs to a 220-ADR checkpoint cleanly.
- **Owner**: nonoun-plugins upstream (the script fix) · dispatching host (the pin, per firing) ·
  Kim (unparking the upstream bundle).
- **Evidence**: prior plan 4.1 (carry-forward); this firing's applied `adr-checkpoint.json`.
- **Size**: 0 minutes here; small tooling task upstream.

## Standing notes (not queue entries)

- **Executed hygiene this firing (no queue entries needed)**: 6 merged-PR remote branches
  closed via `campaign_close.py`, all clean/exit 0 (#1427 #1432 #1414 #1415 #1431 #1425,
  reverified gone) + 9 local REAP rows via `scripts/reap-branches.mjs` (dry-run 0 fail/0 warn,
  then `--execute`) incl. 3 orphaned worktree-agent markers + 12 stale `origin/*` refs pruned.
  Both live worktrees correctly preserved by both gated scripts.
- **Two locked agent worktrees are LIVE lanes, not cruft**: `agent-a3539f9b43d026844`
  (`1445-table-dogfood`) and `agent-a773fb963b42942b1` (`0223-s3-leaves-gate-flip`, observed
  mid-firing with live concurrent work — untouched).
- **#1438** (rating pointer-pick build): ruled by Kim, decision made — an owned dev lane, not
  ops debt. **#1440** (reap-worktrees.mjs mechanism): marshal will take — owned tooling lane.
  Neither queued; both named here so they don't read as silently dropped.
- **Intake lane clean**: 61 issues + 84 PRs in window, all pre-classified, all authored by the
  sole friendlies login; zero mints, zero holds, zero `needs-ruling`; bootstrap gates
  (roster/MCP offer) long-resolved (2026-08-05).
- **gitignore G1 noise** (6 stale rules): standing Kim-ruled keep-list, never re-proposed.
- **`.claude/ops/sweep-in-flight.json`**: this sweep's live marker — never staged, never cruft
  while a sweep runs.
- **gen-ui-kit**: out of this board's scope (dedicated session per Kim's ruling).

*Composed by chore-planner, 2026-08-19T21:56:06Z sweep firing — returned as payload per the #125
ops-write split; written and landed by the dispatching session.*
