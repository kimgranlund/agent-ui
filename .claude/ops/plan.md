<!-- target-path: .claude/ops/plan.md -->
# Ops plan — agent-ui

- **Dispatch**: 2026-08-13 (chore-lead-sweep4) — HYBRID evidence mode: PR #795's unmerged sweep
  output (decision-watcher + issue-sorter + repo-cleaner, branch `worktree-ops-sweep-refresh`,
  opened 2026-08-12T18:20Z) stands in as this cycle's seat reports per the dispatch brief (no 4th
  same-day seat fan-out — the documented collision pattern), PLUS directed live re-verification of
  everything time-sensitive. Prior landed plan (2026-08-12 MCP-focus standalone) read as
  carry-forward source; PR #795's own unlanded plan.md read as intermediate evidence.
- **Live re-verification this dispatch** (nothing below taken from the briefing on faith):
  #783 CLOSED completed 2026-08-12T21:02:44Z · #787 CLOSED 20:28Z · #788 CLOSED 17:16Z · all five
  slice PRs MERGED (#792 18:18Z, #794 18:18Z, #796 19:04Z, #797 20:28Z, #798 20:58Z) · open
  issues = exactly {#793, #791, #782, #616} · `git worktree list` = main checkout only · upstream
  `a2ui-project/a2ui#2150` OPEN (updated 2026-08-08) · standing gates re-run on main HEAD
  38cc4d81: `npm run check` exit 0, `npm test` exit 0 (`npm run test:browser` NOT run —
  UNMEASURED, deliberate; #798's own gate-green S5 record covers the browser shards at merge time).
- **Landing-time amendments (host, 2026-08-13)**: composed against HEAD 38cc4d81; landed at HEAD
  64033e62 (the two intervening commits — 05f9ad8b, 64033e62 — touch only `.claude/ops/`, so the
  gate run stands). The harvest batch is FOUR rows, not five (decision-watcher-sweep-2's fresh
  classify, landed 05f9ad8b: 0179/0180/0181/0183; 0184 judged NO; 0182 still `proposed`). Entries
  1.1 and 2.1 were executed by the host during this same cycle — recorded RESOLVED below with
  evidence, kept for the record.
- **Verdict**: the #783 arc is COMPLETE and its closure verified sound (all 5 slices merged, gates
  green live). Tier 1 and Tier 2 are already executed. The queue's center of gravity is now human
  confirms — the 4-row ADR harvest batch, #782 Fork 2, #791's ruling — plus one mobilizable small
  build (#793).

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## Prior-plan disposition (2026-08-12 MCP-focus plan → this dispatch)

| Item | Fate |
|---|---|
| 2.1 dispatch GH #783's design leg (FOCUS) | **RESOLVED — whole arc shipped and closed**: design (PR #786 SPEC v0.2 + ADR-0185 accepted, PR #790 LLD+decomp) AND build S1–S5 (PRs #792/#794/#796/#797/#798) all MERGED 2026-08-12; #783 CLOSED completed 21:02Z; gates re-verified green on main this dispatch |
| 3.1 adr-0179 harvest confirm | **CARRIED, widened** → 3.1 — decision-watcher's fresh classify judged 0180/0181/0183 in and re-verified 0179 (0184 NO, 0182 not yet ratified) — landed directly to main via 05f9ad8b, no further landing action needed |
| 3.3 rule the GH #782 design fork | **PARTIALLY RESOLVED, carried** → 3.2 — Fork 1 shipped (PR #789 MERGED 2026-08-12T17:37Z); Fork 2 (rail+pane overlay seam) still unruled |
| 4.1 land plan.md delta | **RECURRING** → folded into 2.1 (one ops commit) |
| 4.3 decision-watcher pass over unjudged ADRs | **RESOLVED** — 0180/0181/0183/0184 judged this cycle via 05f9ad8b; 0182 correctly held at `proposed` (not yet ratified); the residual 0178-amendment/0185 gap → 4.3 |
| 4.5 encode ops-seat rulings in nonoun-plugins | **CARRIED ×11** → 4.2 (cross-repo) |
| Standing note: ADR-0182 `proposed` | **CONFIRMED, not stale** — still `proposed`, not yet ratified; no queue action due |
| Standing note: #616 upstream UNMEASURED | **RESOLVED this dispatch** — upstream #2150 verified OPEN live; #616 stays blocked |

## 1. Gated mutations already verified safe

### 1.1 Delete the four surviving merged-slice remote branches — RESOLVED, executed 2026-08-13
- **Finding**: all four (`mcp-agent-config-s1`, `mcp-agent-config-s2-services-get`,
  `feat/mcp-agent-config-s3-per-pack-reject`, `feat/mcp-agent-config-s4`) deleted by the host,
  exit 0, after per-branch head-OID equality against the MERGED PR heads was re-verified —
  #792=cfe60efc, #796=e3370df3, #794=746ef4b0, #797=f86299d4 (squash-merge repo, so `--merged`
  ancestry is silent by construction; OID-equality is the safety proof). No worktree held any of
  them; #798's branch was already reaped at merge. Origin is main-only.
- **Owner**: RESOLVED — no further action.

## 2. Blocking other work

### 2.1 Land PR #795's durable payload + this plan, close #795 unmerged — RESOLVED (this commit completes it)
- **Finding**: executed by the host, 2026-08-13. PR #795's two still-valuable files landed at
  64033e62 — `watch-checkpoint.json` (pure timestamp advance to the completed 17:53Z issue-sorter
  pass; main WAS behind on that file, contra the composing-time skip note) and
  `.claude/ops/reports/2026-08-12T181116Z.md` (pure addition). Its `adr-queue.json` (stale 5-row
  set) and `plan.md` were dropped as superseded. #795 CLOSED unmerged with the supersession
  recorded; `worktree-ops-sweep-refresh` deleted (0 remote refs). This plan write is the item's
  final leg.
- **Owner**: RESOLVED — no further action.

### 2.2 Repair the decision-watcher checkpoint gap — RESOLVED, moot
- **Finding**: the fresh decision-watcher pass (05f9ad8b) re-derived the checkpoint clean; no
  malformed-payload gap survives. The residual unjudged-ADR gap is 4.3, not a repair.
- **Owner**: RESOLVED — no further action.

## 3. Human-decision items

### 3.1 Confirm-gate the FOUR-row ADR harvest batch — RESOLVED, harvested 2026-08-13
- **Finding**: Kim confirmed ALL FOUR in the batched round; one harvest seat landed them
  sequentially (PR #800 MERGED): adr-0179 → 5 composition-patterns rows (superseded-in-part
  material skipped) · adr-0180 → component-patterns mechanism row + a cross-linked
  composition-patterns consumer row (the queue row named both tables as gaps) · adr-0181 +
  adr-0183 → component-patterns rows. Zero citation drift found; §5b anchors throughout.
  Queue rows consumed (this commit) — `adr-queue.json` empty.
- **Owner**: RESOLVED — no further action.

### 3.2 Rule GH #782 Fork 2 — RESOLVED, ruled 2026-08-13
- **Finding**: Kim ruled keep-two-hairlines (in-session confirm). #782 CLOSED as
  ruled-and-complete (Fork 1 had shipped via PR #789; Fork 2 = no change, no build).
- **Owner**: RESOLVED — no further action.

### 3.3 Rule GH #791 — RESOLVED, ruled + closed 2026-08-13
- **Finding**: Kim ruled GENERALIZE (in-session confirm): tool-kind packs reject id collisions,
  the standing rule. #791 CLOSED on PR #799's merge — every shipped tool-kind pack now rejects
  (Integrations #799 · MCP-services #797) through the S3 vehicle (#794). Ruling + close-out
  recorded on the issue; stale `doing` label cleared.
- **Owner**: RESOLVED — no further action.

## 4. Hygiene debt

### 4.1 Mobilize GH #793 — RESOLVED, shipped 2026-08-13
- **Finding**: confirmed in the mobilize round, built by a dispatched seat, PR #799 MERGED
  (flag flip + the end-to-end pack-grain test: colliding add rejected visibly, store unchanged,
  picker row disabled, non-colliding adds unaffected). #793 CLOSED completed. Gates green on
  merge; the SPEC-R6 fence held (exit 1) throughout.
- **Owner**: RESOLVED — no further action.

### 4.2 Encode the ops-seat contract rulings into the harness agents (cross-repo, carried ×11)
- **Action**: unchanged — one change in the nonoun-plugins repo.
- **Owner**: host session in the nonoun-plugins repo (not doable from this checkout).
- **Size**: ~30 min

### 4.3 Narrow decision-watcher follow-up — judge adr-0178's amendment + adr-0185
- **Action**: one checkpoint-grain decision-watcher dispatch: harvest-judge adr-0178's amendment
  (its hash deliberately left stale by the 2026-08-12 firing so the drift re-surfaces — the
  "harvest-0178" lane it deferred to never landed queue output) and adr-0185 (new, accepted
  2026-08-12 with the MCP arc). adr-0182 stays excluded until ratified.
- **Owner**: decision-watcher seat, next firing or a direct dispatch.
- **Evidence**: `adr_checkpoint.py classify` on main post-05f9ad8b: "new: adr-0182, adr-0185;
  amended: adr-0178, adr-0179" — 0179 queued, the others unjudged.
- **Size**: ~15 min

## Standing notes (not queue entries)

- **Board shape (end of cycle, 2026-08-13)**: **1 open issue — #616 (blocked)**; #793/#791/#782
  all closed this cycle (PRs #799/#800 merged). 0 open PRs · 0 extra worktrees · origin main-only.
  Remaining queued actions: 4.2 (cross-repo) and 4.3 (the 0178/0185 decision-watcher follow-up).
- **This cycle's lesson (chore-lead-sweep4)**: multiple same-day sweep generations produced real,
  valuable, UNCOORDINATED direct-to-main writes that a naive "land the sweep PR verbatim"
  recommendation would have regressed. The save was cross-checking every claim against live
  `git`/`gh` state immediately before writing — including this session's own earlier reports.
  Fold into 4.2's cross-repo encoding: seat-payload landing legs re-verify at write time, not
  just at report time.
- **#616 stays blocked** — upstream `a2ui-project/a2ui#2150` verified OPEN live this dispatch.
- **#783 closure soundness** — independently verified, all 5 slice PRs MERGED, gates green.
- **gitignore KEEP-LIST fence is permanent** — 7 standing G1 warnings, never re-propose.
- **held-items.md**: empty since first firing — nothing trust-gated.
- **`.claude/ops/` is git-tracked** — landing legs end in commit+push, not just a write.

*Composed by chore-planner (hybrid dispatch: PR #795 seat output + live re-verification),
2026-08-13; landing-time amendments by the host (execution state, 4-row harvest set) — written
and landed by the dispatching session per the #125 ops-write split.*
