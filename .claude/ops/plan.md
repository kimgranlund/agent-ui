<!-- target-path: .claude/ops/plan.md -->
# Ops plan — agent-ui

- **Dispatch**: 2026-08-12 SWEEP (chore-lead fan-out; all three seats returned — decision-watcher 🟡,
  issue-sorter 🟢, repo-cleaner 🟢; none UNMEASURED). Seat state already applied to `.claude/ops/`
  by the coordinating session, with ONE exception (the checkpoint gap, entry 2.1). Prior plan
  (2026-08-12 standalone MCP-focus dispatch) read as carry-forward source.
- **Evidence mode**: seat reports (primary) + directed live-`gh` re-verification of the named
  claims (#786/#789/#790 merges, ADR-0185 status, #782 fork state, #616/#791 dispositions, board
  mobilizability). Upstream `a2ui-project/a2ui#2150` verified OPEN live this dispatch (updated
  2026-08-08) — the prior plan's UNMEASURED marker on it is cleared.
- **Board-shape corrections vs. the seat snapshots** (live drift during/after the sweep):
  6 open issues, not 5 — GH #793 (Integrations-pack `rejectOnCollision` flag flip, `task`,
  `size:small`) filed 18:11:54Z, seconds after repo-cleaner's inventory; and 2 open DRAFT PRs —
  #792 (GH #783 S1) + #794 (GH #783 S3), the live peer's build slices, opened 18:10–18:12Z.
  GH #791 is no longer "parked pending SPEC-R6": SPEC-R6 + its LLD-C5 vehicle now exist (PRs
  #786/#790 merged), PR #794 is that vehicle in draft, #791 carries `doing`. The dispatch
  briefing's "nothing mobilizable" claim is CONFIRMED even after these corrections.
- **Verdict**: the board is fully in-flight or gated — zero mobilizable items; the queue's head is
  an ops self-repair: decision-watcher's `adr-checkpoint.json` payload never landed (malformed
  fence — a `TARGET:` header with no JSON body; the coordinator correctly refused to re-derive it),
  so the checkpoint still lacks adr-0181–0185 and holds pre-amendment hashes for adr-0178/0179 —
  the same 7 deltas re-fire as "new/amended" every sweep until repaired.

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## Prior-plan disposition (2026-08-12 standalone → this sweep)

| Item | Fate |
|---|---|
| 2.1 dispatch GH #783's design leg (FOCUS) | **RESOLVED** — design leg shipped: SPEC v0.2 PR #786 MERGED 17:11Z + ADR-0185 ratified/`accepted`; LLD + sliced decomposition PR #790 MERGED 17:54Z. Build now in flight (peer session): S1 = draft PR #792, S3 = draft PR #794 |
| 3.1 adr-0179 harvest confirm | **CARRIED, widened** → 3.1 — the queue is now 5 rows (0179 re-verified + 0181/0182/0183/0184 newly judged this sweep) |
| 3.3 rule the GH #782 design fork | **PARTIALLY RESOLVED** → 3.2 — Fork 1 shipped (PR #789 MERGED 17:37Z); only Fork 2 remains unruled |
| 4.1 land plan.md delta | **RECURRING** → 4.2 |
| 4.3 decision-watcher pass over unjudged accepted ADRs | **MOSTLY RESOLVED** — this sweep judged 0181–0185 and re-verified 0179; ADR-0180's judgment is still unevidenced (checkpointed, no queue row, no recorded no-verdict) → folded into 2.1 |
| 4.5 encode ops-seat rulings in nonoun-plugins | **CARRIED ×10** → 4.3 (cross-repo) |
| Standing note: ADR-0182 `proposed` | **STALE, corrected** — 0182 `accepted`+ratified 2026-08-12 (GH #716); now a harvest row in 3.1 |
| Standing note: #616 upstream UNMEASURED | **RESOLVED** — upstream #2150 verified OPEN live this dispatch; #616 stays blocked |

## 1. Gated mutations already verified safe

(none — repo-cleaner already executed both in-sweep: PR #789's and PR #790's surviving remote
branches closed via `campaign_close.py`, deletion re-verified. The two remaining remote feature
branches — `mcp-agent-config-s1`, `feat/mcp-agent-config-s3-per-pack-reject` — back OPEN draft
PRs #792/#794 and are NOT safe to touch.)

## 2. Blocking other work

### 2.1 Repair the decision-watcher checkpoint gap (KNOWN GAP from this sweep — not a silent success)
- **Action**: re-dispatch decision-watcher with an emit-checkpoint-ONLY brief: re-run classify (or
  reuse this firing's classification — same 7 deltas) and return a WELL-FORMED fenced payload for
  `.claude/ops/adr-checkpoint.json` — actual JSON inside the fence, never a `TARGET:` header
  pointing at prose or a /tmp scratch path — advancing the hash-map past adr-0181–0185 (new) and
  adr-0178/0179 (amended). The brief must state: do NOT re-queue harvest rows (`adr-queue.json`
  already holds this firing's 5 rows — re-queuing duplicates an applied write); DO record a
  harvest judgment (yes/no) for ADR-0180, the fifth sweep's carried residue. This blocks: every
  future decision-watcher firing re-detects the same 7 deltas until it lands, and 3.1's confirm
  gate risks double-queuing against a stale checkpoint.
- **Owner**: chore-lead (or host) re-dispatches decision-watcher; the coordinating session applies
  the payload per the #125 split.
- **Evidence**: this sweep's decision-watcher report (malformed `adr-checkpoint.json` fence, named
  by the coordinator) · `adr-checkpoint.json` verified this dispatch: 179 entries, adr-0181–0185
  ABSENT, adr-0178/0179 present with pre-amendment hashes · `adr-queue.json` mtime 18:01, 5 rows
  applied.
- **Size**: ~10–15 min

## 3. Human-decision items

### 3.1 Confirm-gate the FIVE-row ADR harvest queue (batch confirm)
- **Action**: put all five pending rows to Kim in one AskUserQuestion batch confirm; on yes,
  dispatch `/make-pack` per target. Rows (all evidence in `adr-queue.json`, queued 17:58:51Z):
  adr-0179 (re-verified; origin-keyed `#contextFor()` routing · band-driven docking ·
  retract-don't-delete · shown-set model → `agent-ui-composition-patterns`) · adr-0181
  (additive-only pane-visibility writer + attention degrade ladder → same target, companion row) ·
  adr-0182 (host-derived builder-mission gate, 3rd meta-line lineage entry →
  `agent-ui-a2ui-meta-line-facts` Lineage section) · adr-0183 (opt-in View Transitions family +
  settled-once boundary → composition-patterns row; producer-seam placement fork noted for
  Phase 2) · adr-0184 ("EXTEND, never port" rule → `agent-ui-component-patterns` /
  component-design step 2).
- **Owner**: Kim (the confirm); `/make-pack` dispatches follow only on a yes.
- **Evidence**: `adr-queue.json` — exactly 5 rows, applied this sweep; all five source ADRs
  verified `accepted` with real ratification utterances cited per row.
- **Size**: ~10 min confirm; ~1–2 h harvest if all confirmed

### 3.2 Rule GH #782 Fork 2 (rail+pane overlay seam) — Fork 1 is DONE
- **Action**: put Fork 2 to Kim (or a design seat) for a ruling, then dispatch the small build it
  gates. Fork 1 (content-fill component-side default) shipped via PR #789, MERGED 17:37Z — only
  Fork 2 remains.
- **Owner**: Kim (ruling); host dispatches the build after.
- **Evidence**: GH #782 open, `size:small` · PR #789 merge verified live this dispatch ·
  repo-cleaner + decision-watcher concur on the Fork 1/Fork 2 split.
- **Size**: ~15 min ruling; small build behind it

## 4. Hygiene debt

### 4.1 Agent-owner repair: issue-sorter's own contract doc-drift (2 findings — NOT this repo's backlog)
- **Action**: repair issue-sorter's agent definition where it lives (the harness plugin /
  nonoun-plugins repo — issue-sorter cannot self-edit): (1) its brief cites
  `.claude/docs/spec/spec-ticketing-watch-triage.md` and `spec-linear-adapter.md`, which do not
  exist under this repo's `<name>.spec.md` convention; (2) its brief cites ADR-0002/ADR-0003 as
  the ticketing-backend authority, but those numbers are unrelated here
  (validator-parity-reconciliation / css-barrels) — the real authority is ADR-0145 (accepted
  2026-07-18, GitHub Issues backend), which the seat correctly used in practice. Optional same-
  change touch-up: `held-items.md`'s header echoes the phantom spec filename. This is a
  maintainer/agent-owner repair, deliberately distinct from the live ops backlog above.
- **Owner**: Kim / host session in the nonoun-plugins repo (not doable from this checkout).
- **Evidence**: issue-sorter's sweep report (both findings, with the seat's own ADR-0145
  cross-check) · `.claude/ops/held-items.md:3-4` (the phantom citation, locally visible).
- **Size**: ~20–30 min (rides naturally with 4.3 — same repo, same owner)

### 4.2 Land this dispatch's plan.md delta (recurring)
- **Action**: the DISPATCHING session writes this payload to `.claude/ops/plan.md`, then
  commit+push to `main` (ops bookkeeping, not PR-gated). Never this seat's write — the #125 split.
- **Owner**: dispatching session (host).
- **Evidence**: this payload; `.claude/ops/` is git-tracked.
- **Size**: ~5 min

### 4.3 Encode the ops-seat contract rulings into the harness agents (cross-repo, carried ×10)
- **Action**: unchanged — one change in the nonoun-plugins repo; fold 4.1's two contract repairs
  into the same change.
- **Owner**: host session in the nonoun-plugins repo (not doable from this checkout).
- **Evidence**: `rulings.md` §"Seat-payload landing leg" + §"Evidence write-backs"; tenth
  consecutive sweep with no landing evidence.
- **Size**: ~30 min

## Standing notes (not queue entries)

- **Board shape (verified live, 2026-08-12 ~18:15Z)**: 6 open issues · 2 open draft PRs · zero
  mobilizable. #783 (big) — build in flight, peer session: S1 = draft PR #792, S3 = draft PR #794,
  S1/S4 fold #787's ADR-0185 repairs, S4 owns the MCP-services pack. #787 — tracking record, stays
  OPEN until the build lands (closes with S1/S4, never dispatched separately). #791 (`doing`) —
  inside the in-flight S3 arc; its SPEC-R6 park is superseded (the vehicle exists). #793 (new) —
  the one-flag Integrations-pack flip, gated on PR #794 merging; small and well-specified, but
  dispatching it before S3 lands builds on an unmerged vehicle — hold until #794 merges, then it
  IS mobilizable. #782 — human decision (3.2). #616 — upstream-blocked, verified live (#2150 OPEN).
- **Live peer worktrees are untouchable**: `agent-a3f88ac68e8e53f58` (S1) and
  `agent-a0f9cea24259ce9b7` (S3) + their `worktree-agent-*` scaffold branches belong to the live
  #783 build peer. Post-merge reaping rides that peer's ship leg — reap the worktree BEFORE
  `--delete-branch` (the GH #613 rule), never from this queue mid-flight.
- **Sweep hygiene verdicts (repo-cleaner)**: no orphaned local branches (the 3-firing orphan
  resolved externally) · 7 `.gitignore` G1 warnings are Kim-ruled permanent noise, never
  re-propose · ADR-0005 claim-staleness gate not-applicable here · full inventory at
  `.claude/ops/reports/2026-08-12T181116Z.md`.
- **adr-0178's new Amendment is still `proposed`** — Kim's gate, never self-flipped; no harvest
  candidate until ratified. (The ADR's own Status is `accepted`; the pending marker is on the
  Amendment.)
- **issue-sorter intake**: 54 issues + 46 PRs since last checkpoint, all sole-friendly
  (kimgranlund) — nothing minted, nothing held; `watch-checkpoint.json` advanced (applied).
- **`.claude/ops/` is git-tracked** — landing legs end in commit+push, not just a write.

*Composed by chore-planner (sweep dispatch, three seats attached), 2026-08-12 — returned as
payload; written and landed by the dispatching session per the #125 ops-write split.*
