<!-- target-path: .claude/ops/plan.md -->
# Ops plan — agent-ui

- **Dispatch**: 2026-08-10T22:17Z firing, fourth sweep (chore-lead fan-out; three seat reports
  attached — decision-watcher, issue-sorter, repo-cleaner; nothing refetched). Prior plan
  (2026-08-10 third sweep, landed as commit `69e45cd8`) read as carry-forward source.
- **Seats**: decision-watcher 🟡 (delta: adr-0180 NEW, still `proposed`, no harvest candidate yet;
  adr-0179 AMENDED — GH #686 unified-header amendment ratified 2026-08-10T15:30:16Z, verified
  against the real GH utterance; the queued 0179 harvest candidate updated in place; attention
  flag = ADR-0179's own body text still reads "proposed" below its ratified heading, see 2.2) ·
  issue-sorter 🟢 (11 issues + 10 PRs touched since the 12:04:23Z checkpoint, all owner-authored,
  all labeled — 0 held, 0 mints, 0 unmeasured sources; checkpoint applied) · repo-cleaner 🟢
  (3 worktrees / 5 local + 2 remote branches / 405 PRs (398 merged, 6 closed-unmerged, 1 open
  draft) / 9 open issues; zero mutations — no gated script had a target; two propose-only
  findings, see 2.1 and 3.2) — 3/3 returned, 0 UNMEASURED.
- **Supersedes**: the 2026-08-10 third-sweep plan; per-item disposition below.
- **Verdict**: a busier board than last sweep (2 → 9 open issues, one live draft PR #692) and two
  new mechanical snags, both propose-only: a **dead-pid lock stranding the active
  gh-691-authoring-hydration worktree** (2.1) and **ADR-0179's stale "proposed" body text sitting
  under its ratified heading** (2.2) — the latter directly gates the now-ripe **adr-0179 harvest
  confirm** (3.1, candidate re-scoped this firing to the ratified amendment's decision surface).
  The pid-30537 hold enters its third consecutive carry (3.2). Plus the recurring landing leg.

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## Prior-plan disposition (2026-08-10 third sweep → this dispatch)

| Item | Fate |
|---|---|
| 3.1 #680 build dispatch decision | **Carried, UNVERIFIED** → **3.3** below — no seat named #680 this sweep (issue-sorter's touched set is un-enumerated), so its open/closed state is unconfirmed; the entry now leads with a verify step |
| 3.2 pid-30537 entanglement check + orphaned-branch delete | **Carried ×3** → **3.2** below — repo-cleaner re-confirmed pid 30537 alive (since Aug 3, cwd = main checkout), branch still zero-unique-commit, still held pending Kim |
| 3.3 confirm-gate the adr-0179 harvest candidate | **Carried, RE-SCOPED** → **3.1** below — the GH #686 amendment ratified 2026-08-10T15:30:16Z; decision-watcher updated the candidate in place: the fixed pair/triple banding + pane-nav arc is now superseded-in-part and must NOT be harvested |
| 4.1 land sweep ops delta + filename normalization (recurring) | **Resolved for that sweep** — landed as `69e45cd8`; the `20260810T120510Z` rename verified done (reports dir all hyphenated at planning time); recurs → **4.1** below for this firing's delta |
| 4.2 encode ops-seat contract rulings in nonoun-plugins (cross-repo) | **Carried ×7** → **4.2** below — still no landing evidence |
| Standing note: open issues (2: #680, #616) | **Superseded** — 9 open issues per repo-cleaner's survey; only #691 is individually named this sweep (see standing notes) |

## 1. Gated mutations already verified safe

(none this sweep — repo-cleaner ran the full survey and no gated script had a target:
`campaign_close.py` found no merged PR with a surviving remote branch, `sync_main.py` moot with
main clean. The gh-691 worktree unlock is deliberately NOT here despite the dead-pid proof:
repo-cleaner held it as a human resume-check call, and this queue honors the seat's own hold.)

## 2. Blocking other work

### 2.1 Stale git lock on the gh-691-authoring-hydration worktree (NEW)
- **Action**: Kim resume-checks whether any session intends to resume in worktree
  `gh-691-authoring-hydration`; if none, run `git worktree unlock gh-691-authoring-hydration`
  (or the host runs it on Kim's yes). The lock names pid 99449, independently confirmed DEAD
  (`ps -p 99449` empty) — a stale lock, not a live session.
- **Owner**: Kim (resume-check decision); host or next repo-cleaner firing executes the unlock on
  a yes.
- **Evidence**: repo-cleaner this dispatch — dead-pid confirmation; the branch/PR #692/issue #691
  behind the worktree are otherwise healthy and ACTIVE, which is why this blocks: the one open
  draft PR's working tree is stranded behind the lock.
- **Size**: ~2 min check; ~1 min unlock

### 2.2 ADR-0179 body text contradicts its own ratified heading (NEW)
- **Action**: fix ADR-0179's GH #686 amendment body — the heading reads "ratified"
  (2026-08-10T15:30:16Z, verified against the real GH utterance) but the blockquote directly
  below (lines 229–238) still literally reads "proposed... no build dispatches until Kim rules".
  Align the body sentence to the ratified state. Touch ONLY the stale blockquote — the Status
  cell is already correctly flipped and stays owner-only territory (adr-status-guard).
- **Owner**: host (or a small doc-fix seat it dispatches) — decision-watcher flagged it as
  out-of-scope for itself; a stale doc-currency defect, not a status flip.
- **Evidence**: decision-watcher this dispatch (its 🟡 flag); the ratification flip updated the
  heading marker only. Blocking rationale: the stale sentence is a literal build-hold instruction
  that would stall any fresh-context reader — including the 3.1 harvest seat this queue stages.
- **Size**: ~10 min

## 3. Human-decision items

### 3.1 Confirm-gate the adr-0179 harvest candidate — now ripe, scope UPDATED (carried, re-scoped)
- **Action**: next human-present firing, put the single pending row to Kim in one
  AskUserQuestion confirm: harvest ADR-0179's patterns into
  `agent-ui-composition-patterns/SKILL.md` per the RATIFIED amendment's decision surface —
  (1) unified header: ONE three-zone bar (agent selector / pane-visibility / actions), pane nav
  retired everywhere, place vocabulary [Chat | Settings | Co-pilot]; (2) origin-keyed
  `#contextFor()` routing (survives byte-for-byte); (3) retract-don't-delete divider-unpaint
  token-repoint. **Do NOT harvest** the superseded-in-part material: the prior amendment's fixed
  pair/triple banding and the pane-nav-persist/hidden arc. If confirmed, dispatch `/make-pack`
  scoped to agent-ui-composition-patterns. Sequence after 2.2 lands (the harvest seat reads the
  ADR).
- **Owner**: Kim (the confirm), staged by decision-watcher/chore-lead's next human-present
  firing; `/make-pack` follows only on a yes.
- **Evidence**: decision-watcher this dispatch — candidate updated in place against the ratified
  GH #686 amendment; corpus grep clean (no existing row covers this); exactly one pending row in
  adr-queue.json.
- **Size**: ~5 min confirm; ~30–45 min harvest if confirmed

### 3.2 pid-30537 stake check → then delete its orphaned branch (carried ×3 — aging)
- **Action**: Kim directly checks the long-lived session at pid 30537 (alive since Aug 3, cwd =
  main checkout): any remaining stake in the branch name `worktree-agent-a02368e41e2b2641c`, and
  should the process be wound down? If no stake: `git branch -d worktree-agent-a02368e41e2b2641c`
  (plain `-d` suffices — zero unique commits, repo-cleaner-verified, no worktree).
- **Owner**: Kim (it is his session to identify); the delete then executes at the next
  repo-cleaner firing, or by the host on the spot.
- **Evidence**: repo-cleaner this dispatch — third consecutive firing with the identical held
  state; the ambiguity is stable, only a human answer clears it.
- **Size**: ~5 min check; ~1 min delete on a yes

### 3.3 #680 build dispatch — carried, state UNVERIFIED this sweep
- **Action**: first, verify #680's current state (`gh issue view 680`) — no seat named it this
  sweep and 11 issues changed since the last checkpoint, so the prior plan's "open, fix-ready" is
  unconfirmed. If still open: Kim decides when to dispatch the build (root cause already on the
  issue — `button.css` `:has()` vs `conversation-composer.css` `@container` compaction). If
  closed: retire this entry.
- **Owner**: host (the verify); Kim (the go/when decision if still open).
- **Evidence**: prior plan entry 3.1 (carry-forward); absence of any #680 mention across all
  three seat reports this sweep.
- **Size**: ~2 min verify; ~2 min decision; build est. 1–2 h outside ops scope

## 4. Hygiene debt

### 4.1 Land this firing's ops-state delta (recurring)
- **Action**: chore-lead's close-out commits and pushes the already-applied payloads —
  `.claude/ops/adr-checkpoint.json`, `.claude/ops/adr-queue.json`,
  `.claude/ops/watch-checkpoint.json`, `.claude/ops/reports/2026-08-10T221726Z.md`, and this
  `plan.md`.
- **Owner**: chore-lead close-out (per `rulings.md` §"Seat-payload landing leg")
- **Evidence**: `git status --porcelain -- .claude/ops/` at planning time: 3 modified checkpoints
  + 1 untracked report, uncommitted; precedent commits `69e45cd8`, `0feb1141`, `3f4aba65`.
- **Size**: ~5 min

### 4.2 Encode the ops-seat contract rulings into the harness agents (cross-repo, carried ×7)
- **Action**: one change in the nonoun-plugins repo (harness plugin): (a) `chore-lead.md` gains
  the close-out landing leg; (b) evidence write-back ownership; (c) the seat-side payload-fence
  rule; (d) the mandatory first-line `Status:` enum in ops-seat report contracts; (e) pin the
  report-filename format (`YYYY-MM-DDTHHMMSSZ.md`, hyphenated).
- **Owner**: host session in the nonoun-plugins repo (not doable from this checkout)
- **Evidence**: `rulings.md` §"Seat-payload landing leg" + §"Evidence write-backs"; seventh
  consecutive sweep with no landing evidence in nonoun-plugins.
- **Size**: ~30 min

## Standing notes (not queue entries)

- **adr-0180 is `proposed`** — no harvest candidate yet; decision-watcher re-triggers
  automatically once ratified. Ratification is Kim's flip (adr_ratify.py path), not an ops action.
- **Board shape**: 9 open issues · 1 open draft PR (#692, gh-691-authoring-hydration — active,
  healthy, stranded only by 2.1's lock) · 405 PRs total (398 merged, 6 closed-unmerged).
- **#616 upstream wait** — last verified third sweep (gated on `a2ui-project/a2ui#2150`); not
  individually re-verified this sweep; re-enters ops scope only if the gate lifts and it stalls.
- **pid 30537 is live** — no reap, no branch delete, until 3.2's human check clears.
- **Harvest queue** = exactly the adr-0179 row (3.1); the ADR ledger now numbers to 0180
  (the 0108 gap remains real, per the third sweep).
- **gitignore KEEP-LIST fence is permanent** — 7 G1 warnings, Kim-ruled standing noise, exit 0
  is the whole gate. No sweep re-proposes a trim.
- **`.claude/ops/` is git-tracked** (re-verified this planning pass: `git log` shows the landing
  chain) — landing legs end in commit+push, not just a write.
- **Report-contract watch** — the prior filename deviation is FIXED (reports dir uniformly
  hyphenated at planning time); all three seats returned clean forms with first-line Status
  enums this firing; 4.2 still encodes the contract upstream.

*Written by chore-planner, 2026-08-10T22:17Z firing (fourth sweep). Landed by chore-lead's
close-out per the landing-leg ruling.*
