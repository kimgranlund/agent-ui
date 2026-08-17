<!-- target-path: .claude/ops/plan.md -->
# Ops plan — agent-ui

- **Dispatch**: 2026-08-17 ~04:35Z (chore-planner, sweep-8 — /sweep-chores run by AGENT-UI-3, a
  /lead-team host coordinating with live peer host AGENT-UI-2; focus "clear the boards").
- **Evidence**: three fresh seat reports (issue-sorter · repo-cleaner @ 04:28:57Z · decision-watcher —
  all MEASURED, payloads already applied to `.claude/ops/`) + `.claude/ops/peer-coordination.md`
  (bottom section, the 04:30Z lane split) + the prior plan (sweep-7, carry-forward source only) + two
  narrow live reads at compose: `gh issue list --json body` for the #193 `Blocked-by:` grep and
  `git worktree list`/`git branch -vv`/`gh pr view 1022 1033 --json headRefOid` to tier the
  repo-cleaner proposals (see Corrections).
- **Live state at compose**: 8 open issues (#1042–#1049), ALL claimed + `in-flight`: #1042–#1046
  AGENT-UI-2 (5 worktrees on `104x-*` branches @ 521ce770), #1047–#1049 AGENT-UI-3 (3 docs-writer
  worktrees @ c97882b6, dispatched 04:31Z) · 0 open PRs · `main` @ c97882b6 (one commit past
  repo-cleaner's 521ce770 snapshot — the peer-coordination note) · 9 worktrees (main + 8 lane
  worktrees, 7 locked; `agent-a1617e…`/#1042 unlocked) · 21 local branches · origin: `main` + one
  stale local tracking ref · uncommitted: 4 applied ops payloads + `peer-coordination.md` + the
  pre-existing `.claude/settings.json` edit.
- **Blocked-by convention (#193)**: all 8 open bodies grepped → ZERO `Blocked-by:` lines. The
  convention reorders nothing this sweep; the merge-serialization edges in 2.1 are peer-protocol
  judgments (shared docs-site files), never inferred `Blocked-by:` edges.
- **Corrections vs the prior plan (sweep-7)**: its entire 23-issue board (#949–#976) CLOSED — every
  wave entry retired; sweep-7 3.1 (2-row confirm) grew to a 5-row confirm (3.1 below); sweep-7 4.2
  (`KeyError: 'kind'` schema drift) RESOLVED — the `adr-0178-amendment` row now carries `kind`;
  sweep-7 4.1 (`status-dialects.md` dirty) RESOLVED — not dirty now; sweep-7 4.3 worktree
  (`musing-newton`) GONE.
- **Corrections vs this sweep's seat reports** (planner judgment on live evidence, not seat
  error-blame): (a) repo-cleaner classed five `worktree-agent-*` branches as orphaned bookkeeping —
  their hashes match the five LIVE AGENT-UI-2 worktrees 1:1 (`agent-a1617e…`↔`1042`,
  `a1fb27…`↔`1045`, `a5ccd7…`↔`1044`, `a739f3…`↔`1046`, `ae10cb…`↔`1043`) and three more appeared
  for AGENT-UI-3's lanes — they are the Agent-tool worktree base markers, NOT reapable while the
  worktree lives (4.1). (b) `956-agent-ui-data` @ b1dc7cdd is one commit AHEAD of PR #1022's
  merged head f316a5a6 (`git cherry origin/main` → `+`, not patch-equivalent to main) — NOT
  verified-safe, moved to human-decision (3.3); `956-data-n5-finish` @ 5d3d9ca7 == PR #1033's
  merged head → verified-safe (1.3). (c) issue-sorter's "#1047–#1049 unassigned" snapshot (04:27Z)
  was superseded at 04:29Z by AGENT-UI-3's re-claim — all 8 assigned now; no action.
- **Verdict**: board fully claimed and in build (nothing to mobilize); ops work is a landing leg,
  two verified-safe git hygiene commands, one 5-row ADR confirm, one tooling-gap ruling, and one
  branch-supersession confirm.

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## 1. Gated mutations already verified safe

### 1.1 Land this sweep's state — commit + push `.claude/ops/` ONLY (AGENT-UI-3 host; 5 min)
- **Action**: `git add .claude/ops/adr-checkpoint.json .claude/ops/adr-queue.json
  .claude/ops/watch-checkpoint.json .claude/ops/reports/2026-08-17T042857Z.md .claude/ops/plan.md
  .claude/ops/peer-coordination.md` → commit `ops(sweep-8): seat payloads + plan` (state-only,
  never source) → `git pull --rebase` if the push is rejected (AGENT-UI-2 pushes to main too) →
  push. Do NOT stage `.claude/settings.json` (4.2 — pre-existing, not the sweep's file).
- **Owner**: `/sweep-chores`'s landing leg = AGENT-UI-3 host (the ops-write split's dispatching
  session; `rulings.md` "Seat-payload landing leg — RULED 2026-08-09").
- **Evidence**: `git status --short` at compose: ` M adr-checkpoint.json · M adr-queue.json ·
  M peer-coordination.md · M watch-checkpoint.json · ?? reports/2026-08-17T042857Z.md` — payloads
  applied verbatim, unlanded; `.claude/ops/` is git-tracked (standing note).
- **Size**: 5 minutes.

### 1.2 `git remote prune origin` — clears the stale `origin/docs/subpath-coverage-gaps` ref (AGENT-UI-3 host; 1 min)
- **Action**: `git remote prune origin` (dry-run already confirmed exactly one ref would prune).
  Non-destructive: touches local tracking refs only, no branch, no worktree.
- **Owner**: AGENT-UI-3 host (peer-coordination.md 04:30Z: "AGENT-UI-3 … owns hygiene: …
  `origin/docs/subpath-coverage-gaps`").
- **Evidence**: repo-cleaner report §Executed: `campaign_close.py 1040` → `C1 PR merged · C4 no open
  PR uses it as base · C2 already absent from remote`, exit 0; `git remote prune origin --dry-run`
  → `[would prune] origin/docs/subpath-coverage-gaps`.
- **Size**: 1 minute.

### 1.3 `git branch -D 956-data-n5-finish` — squash-merged, tip == PR #1033 head (AGENT-UI-3 host; 1 min)
- **Action**: `git branch -D 956-data-n5-finish` (`-D` required: squash-merged, `--merged main`
  cannot see it). Its sibling `956-agent-ui-data` is NOT in this entry — see 3.3.
- **Owner**: AGENT-UI-3 host (hygiene owner per peer-coordination.md; "PR-MERGED verification
  before any deletion" — done below).
- **Evidence**: local tip `5d3d9ca7` == `gh pr view 1033 --json headRefOid` `5d3d9ca7…`, state
  MERGED 2026-08-17T03:12Z; upstream `[origin/956-data-n5-minors: gone]`; not checked out by any
  worktree. Zero unpushed content by construction (tip is the merged head).
- **Size**: 1 minute.

## 2. Blocking other work

### 2.1 Docs-wave merge serialization — 8 in-flight lanes, shared docs-site files (both hosts; hours, in flight)
- **Action**: no ops build — the board IS the wave. Keep the peer protocol: each host ships its
  OWN lanes (push → draft PR → verify gates by exit code → merge → verify MERGED → reap own
  worktree + `104x-*` branch + its `worktree-agent-<hash>` marker together, never chained);
  additive conflicts expected on `_page.ts`, `site/main.ts`, both `sitemap.json`, `llms.txt`, the
  `theme-provider-built.css` fixture — the SECOND merger rebases keep-both + regenerates the
  fixture (#1039 precedent) and re-runs `npm run check` on main between merges. AGENT-UI-2's five
  worktrees are based on 521ce770 (one ops-only commit behind c97882b6) — trivial rebase at PR time.
- **Owner**: AGENT-UI-2 (#1042 #1043 #1044 #1045 #1046) · AGENT-UI-3 (#1047 #1048 #1049).
- **Evidence**: `gh issue list` at compose — all 8 `in-flight`, assignee kimgranlund; `git worktree
  list` — 8 lane worktrees; peer-coordination.md "Lane split — 2026-08-17 ~04:30Z".
- **Size**: hours (build lanes already dispatched); merge legs ~10 min each.

## 3. Human-decision items

### 3.1 ADR-queue batched confirm — 5 rows in ONE AskUserQuestion (host asks → Kim rules → make-pack; 5 min + ~1 h/harvest)
- **Action**: one round covering: HARVEST (a) `adr-0191` fleet `:state(pending)` async-stale law
  → component-patterns patterns-table row (or component-standards host-state vocabulary);
  (b) `adr-0192` "mint a zero-dep sibling off components" rule, third proof (0115→0119→0192) →
  patterns-table row citing all three; (c) `adr-0183` amendment named-morph convention
  (`viewTransitionName`/`setViewTransitionName`, `ui-vt-{surface}-{token}`, pairing law) → extend
  patterns-table row 30 or sibling row. CLEAR (d) `adr-0178-amendment` and (e) `adr-0187` — both
  `status: harvested` with `landed_in` filled since 2026-08-16T22:20Z, never cleared:
  `adr_queue.py clear <path> --ids adr-0178-amendment,adr-0187` (scratch copy → payload → landing
  leg, per ops-write-sandbox-rules). On YES per harvest row: dispatch `/make-pack`; rows advance on
  landing. `adr-0194` is NOT a candidate (duplicate of patterns-table row 30's ADR-0183 shape).
- **Owner**: AGENT-UI-3 host (the ask; the `clear` payload) → Kim (the ruling) → make-pack seat
  (each harvest).
- **Evidence**: decision-watcher report this sweep (grep-verified zero hits for `adr-0191` /
  `:state(pending)` / `--ui-pending-` across `skills/*/references/*.md`; row 30 re-read directly);
  `adr-queue.json` payload: 3 rows `kind: harvest` queued 04:29:49Z + 2 rows `harvested`.
- **Size**: 5 minutes to rule; ~1 h per harvest (3); 2 min for the clear.

### 3.2 `adr_checkpoint.py` ratify-only-flip gap — rule whether to hash the amendment ratification marker (Kim; minutes to rule, small upstream tooling task)
- **Action**: decision-watcher flagged that the classify hash basis (Status cell + Decision/Amendment
  sections) does NOT change when Kim ratifies an already-drafted amendment on an already-`accepted`
  ADR — so the `adr-0040` (GH #1009 barrel re-base), `adr-0160` (GH #1032 agent-turn full-width)
  and `adr-0190` (GH #1030 capability auto-attach) amendments will NOT re-trigger `amended` on
  ratification. Kim rules: widen `adr_checkpoint.py` (nonoun-plugins `watch-adrs`) to hash the
  amendment's own ratification marker — YES/NO. INTERIM MITIGATION either way: when Kim ratifies any
  of those three, the host re-dispatches decision-watcher with an explicit "re-judge adr-00NN
  amendment for harvest" instruction (a manual pin, standing note). `adr-0193`/`adr-0195` need no
  pin — their Status cell flips proposed→accepted, which IS in the hash basis.
- **Owner**: Kim (ruling) → nonoun-plugins follow-up (script; rides the PARKED cross-repo encoding
  bundle, Kim 2026-08-13) · AGENT-UI-3 host (the interim pin).
- **Evidence**: decision-watcher report §"Not yet ripe" — the gap statement; `adr-checkpoint.json`
  payload carries 0040/0160/0190 as `accepted` with amendment content baked into this round's hash.
- **Size**: 2 minutes to rule; small tooling task upstream; pin = 1 line here.

### 3.3 `git branch -D 956-agent-ui-data` — ONE commit ahead of the merged PR head; confirm superseded first (AGENT-UI host or Kim; 5 min)
- **Action**: local tip b1dc7cdd ("fix(data): checker minors — paginated race guard, mutation
  dispose aborts, fromFetchStream res.ok + reader cancel, ndjson early-exit cancel") sits ON TOP of
  PR #1022's merged head f316a5a6 and is not patch-equivalent to anything on main (`git cherry
  origin/main b1dc7cdd f316a5a6` → `+`; the reverse-apply against main fails). peer-coordination.md
  says the n5 tail (checker minors) landed reworked via PR #1029/#1033 — likely superseded, NOT
  proven. Ask the AGENT-UI host that finished #1029 (or Kim): "b1dc7cdd's four fixes are all on main
  via #1029/#1033 — confirm?" → on YES `git branch -D 956-agent-ui-data`; on NO/unknown, open a
  small PR cherry-picking b1dc7cdd onto main and delete after merge.
- **Owner**: AGENT-UI-3 host asks (peer-coordination.md is the channel) → AGENT-UI host / Kim
  confirms → AGENT-UI-3 executes.
- **Evidence**: `gh pr view 1022 --json headRefOid` = f316a5a6, MERGED 02:32Z; `git rev-parse
  956-agent-ui-data` = b1dc7cdd; `git log -3 b1dc7cdd` shows f316a5a6 as its parent; upstream
  `[origin/956-agent-ui-data: gone]`.
- **Size**: 5 minutes to confirm; 1 minute to delete (or ~20 min for the salvage PR).

### 3.4 Pending ratifications decision-watcher surfaced (Kim; minutes each)
- **Action**: `adr-0193` (StorageAdapter seam) and `adr-0195` (`ui-drill`) — Status `proposed`:
  Kim flips via `adr_ratify.py` (proposed→accepted is the one path it covers). The three amendments
  in 3.2 are owner-only Status-cell/marker edits (adr_ratify.py does not cover amendment
  ratification). Never self-flipped by any seat.
- **Owner**: Kim. **Evidence**: decision-watcher §"Not yet ripe" (five items, each `Ratified by:
  pending` / "proposed — Kim ratifies"). **Size**: minutes per flip; each ratified amendment then
  triggers the 3.2 interim pin.

## 4. Hygiene debt

### 4.1 `worktree-agent-<hash>` branches (8) — live worktree markers, NOT orphans; reap WITH the worktree at lane close (each session; propose-only)
- **Action**: do NOT `git branch -D` any `worktree-agent-*` while its paired
  `.claude/worktrees/agent-<hash>` exists (all 8 do at compose; each is checked out by the
  `104x-*` branch of the same hash). At each lane's close, the OWNING session runs `git worktree
  remove .claude/worktrees/agent-<hash>` then `git branch -D 104x-<lane> worktree-agent-<hash>`
  after MERGED verification. Anything left after both hosts have closed all 8 lanes becomes a real
  orphan for the next repo-cleaner firing (which should re-check the hash pairing before
  classing them orphaned — feed this back to `clean-git`'s inventory step: match
  `worktree-agent-<h>` against `git worktree list` paths).
- **Owner**: AGENT-UI-2 (five: a1617e, a1fb27, a5ccd7, a739f3, ae10cb) · AGENT-UI-3 (three: a2dc24,
  a72795, acb64e). Nobody force-removes another session's worktree (peer protocol rule 5).
- **Evidence**: `git worktree list` + `git branch -vv` at compose — 8 pairs, hashes identical;
  repo-cleaner report §Inventory classed five as orphaned "from an earlier naming convention"
  (its `gh pr list --search head:` check is right — these never carry PRs — but PR-absence isn't
  orphan-proof for a base marker). Minor: worktree `agent-a1617e…` (#1042) is the only unlocked one
  — AGENT-UI-2's to lock or ignore.
- **Size**: 1 minute per lane at close; 0 now.

### 4.2 Pre-existing dirty file `.claude/settings.json` (host; 5 min)
- **Action**: host decides commit-or-stash; NOT the sweep's file — excluded from 1.1 (repo-cleaner
  left it untouched per brief; `sync_main.py` correctly withheld — main not dirty beyond it).
- **Owner**: AGENT-UI-3 host. **Evidence**: `git status` ` M .claude/settings.json` (2+/1−) at
  compose; repo-cleaner §Working tree. **Size**: 5 minutes.

### 4.3 Repo-local gated reap script — repo-cleaner's open question (caller files or declines; 5 min)
- **Action**: decide whether to mint a `task`/`size:small` issue: "add `npm run ops:reap-branches`
  (mirroring gen-ui-kit's, issue #138) so squash-merged local branches and closed-lane worktree
  markers stop landing as propose-only every firing". Recommendation: file it — the pairing rule in
  4.1 is exactly the check such a script would encode. On file, issue-sorter triages next firing.
- **Owner**: AGENT-UI-3 host (file or decline on the record) → build-lead later.
- **Evidence**: repo-cleaner §Open questions + §Host-repo reap script check (no `reap` in
  `package.json`/README/CLAUDE.md); three sweeps running of propose-only branch lists.
- **Size**: 5 minutes to file; small task to build.

## Standing notes (not queue entries)

- **Board shape (this compose)**: 8 open issues, all claimed/in-flight across two hosts; 0 PRs;
  nothing to mobilize — this plan is hygiene + decisions only. `held-items.md` empty; nothing
  trust-gated; `friendlies.json` unchanged.
- **Interim ratification pin (3.2)**: on ratification of the `adr-0040` / `adr-0160` / `adr-0190`
  amendments, re-dispatch decision-watcher with an explicit re-judge instruction — the checkpoint
  will NOT catch it on its own until the upstream widening lands.
- **`worktree-agent-<hash>` = live marker** (4.1) — a repo-cleaner firing that sees one whose
  worktree is gone may propose it; one whose worktree lives must not.
- **Branch reaping on origin is near-instant here** — delete-on-merge; only LOCAL residue accrues.
- **gitignore KEEP-LIST fence is permanent** — 7 standing G1 warnings, never re-propose.
- **adr_ratify.py amendment-mode cosmetic** (heading flips, guard blockquote keeps "proposed") —
  deliberate scope, not a bug.
- **nonoun-plugins cross-repo encoding**: PARKED (Kim, 2026-08-13); 3.2's script widening rides it.
- **gen-ui-kit**: out of this board's scope (dedicated session per Kim's ruling).
- **`.claude/ops/` is git-tracked** — landing legs end in commit+push, not just a write (1.1).

*Composed by chore-planner (sweep-8, /sweep-chores run by AGENT-UI-3), 2026-08-17 — returned as
payload per the #125 ops-write split; written and landed by the dispatching session.*
