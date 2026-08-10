<!-- target-path: .claude/ops/plan.md -->
# Ops plan — agent-ui

- **Dispatch**: 2026-08-10, third sweep (chore-lead fan-out; three seat reports attached —
  decision-watcher, issue-sorter, repo-cleaner; nothing refetched). Prior plan (2026-08-10 second
  sweep, landed as commit `0feb1141`) read as carry-forward source. Main at `08044a0c`, clean,
  matches origin/main exactly.
- **Seats**: decision-watcher 🟢 (zero ADR drift; 178 live ADRs, numbering to 0179, 0108 gap
  confirmed real; the adr-0179 harvest candidate RE-VERIFIED against the ADR's own Decision text —
  target skill still has zero `references/` files, genuinely unlanded; confirm explicitly deferred
  to next interactive dispatch — unattended firing; checkpoint/queue writes no-ops) ·
  issue-sorter 🟢 (#670 CLOSED via PR #679, stateReason COMPLETED, 11:36:21Z; #680 NEW bug, filed
  and root-caused today by the owner, complete file-bug-shaped record + same-author Findings
  comment naming the exact CSS mechanism, no fix yet, no dedup collision; #616 unchanged upstream
  wait; checkpoint → 12:04:23Z) · repo-cleaner 🟢 (main clean at `08044a0c`, 0 open PRs of 395,
  1 stale remote ref pruned — #679's branch, clean merge; carried item 4.3 RESOLVED: the second
  worktree is GONE, a real state change, the earlier report accurate for its time; NEW: pid 30537
  still alive since Aug 3, cwd now resolves to the MAIN checkout — flagged 🟡, nothing executed;
  1 orphaned local branch held pending the pid check) — 3/3 returned, 0 UNMEASURED.
- **Supersedes**: the 2026-08-10 second-sweep plan; per-item disposition below.
- **Verdict**: steadier still than the last sweep — #670 went ruling→build→merge→closed inside
  five hours (PR #679) with no ops involvement needed, and the board sits at 0 open PRs / 2 open
  issues. Three decisions stand: **#680's build dispatch** (new, owner-root-caused, the sweep's
  most actionable item), the **pid-30537 entanglement check** (a live long-running session now
  cwd'd at the main checkout — worth Kim's direct eye, and it gates the one held branch deletion),
  and the carried adr-0179 harvest confirm. Plus the recurring landing leg, this time including
  one filename normalization.

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## Prior-plan disposition (2026-08-10 second sweep → this dispatch)

| Item | Fate |
|---|---|
| 3.1 #670 build-unblocked — decide the build dispatch | **Resolved** — built, merged (PR #679), issue CLOSED completed 11:36:21Z (issue-sorter, fresh `gh` verification); retired |
| 3.2 confirm-gate the adr-0179 harvest candidate | **Carried** → **3.3** below — decision-watcher re-verified the candidate against the ADR's Decision text this firing (not just re-stated) and explicitly deferred the confirm to the next interactive dispatch |
| 4.1 land sweep ops delta (recurring) | **Resolved for that sweep** — landed as `0feb1141`; recurs → **4.1** below for this firing's delta (verified unlanded: 3 modified checkpoints + 3 untracked reports in `git status` at planning time) |
| 4.2 encode ops-seat contract rulings in nonoun-plugins (cross-repo) | **Carried ×6** → **4.2** below — still no landing evidence; scope grows by one instance (the report-filename deviation, see 4.1) |
| 4.3 audit the second-worktree provenance gap | **Resolved** — repo-cleaner settled it: the worktree is gone (registration + directory both removed), a REAL state change since 06:33:16Z, not an inventory blind spot; the earlier report was accurate for its time. No seat-reliability defect. Spawned **3.2** below (the surviving pid) |
| Standing note: keep-live worktree `agent-a02368e41e2b2641c` | **Retired** — the worktree no longer exists; its pid survives and is handled as **3.2**, its orphaned branch inside the same row |
| Standing note: open issues (2: #670, #616) | **Superseded** — still 2, but the set changed: #670 closed, #680 opened (see 3.1) |

## 1. Gated mutations already verified safe

(none this sweep — 0 open PRs of 395; the one merged-PR branch remnant (#679's
`fix/670-author-prearm-pickers` remote-tracking ref) was already pruned by repo-cleaner as a
verified clean merge; the one candidate deletion remaining — the orphaned local branch
`worktree-agent-a02368e41e2b2641c` — is deliberately NOT here: repo-cleaner verified it
mechanically safe (zero unique commits) but held it pending a human liveness check, so it rides
3.2 until that check clears.)

## 2. Blocking other work

(none this sweep — #616 remains an external upstream wait on `a2ui-project/a2ui#2150` (upstream
still open, reverified this firing), not a queue blocker; nothing else waits on anything.)

## 3. Human-decision items

### 3.1 #680 build dispatch — new owner-root-caused bug, fix-ready (NEW, the sweep's headline)
- **Action**: Kim/host decides when to dispatch the build for #680 ("Composer's compacted picker
  trigger keeps ghost grid gaps — not a true icon-only box"). The diagnosis is already on the
  issue: Kim's own Findings comment names the exact CSS mechanism (`button.css` `:has()` selectors
  vs. `conversation-composer.css`'s `@container` compaction). No fix applied yet; no design
  questions open. The ops queue stages the decision only — it does not start the build.
- **Owner**: Kim (go/when decision); a build seat dispatched by the host on a yes.
- **Evidence**: issue-sorter this dispatch — filed and root-caused today by the owner
  (friendlies-allow-listed), complete template record, labels bug+doing correct, no dedup
  collision (#665/#673 both closed), no linked PR.
- **Size**: ~2 min decision; the build itself est. 1–2 h given the root cause is pre-named,
  outside ops scope

### 3.2 pid-30537 entanglement check → then delete its orphaned branch (NEW)
- **Action**: Kim directly checks the long-lived session at pid 30537 (alive continuously since
  Aug 3; its worktree vanished this window and its cwd now resolves to the MAIN checkout — a
  live-session-entanglement risk on the checkout every other session shares). Decide: does that
  session have any remaining stake in the branch name `worktree-agent-a02368e41e2b2641c`, and
  should the process itself be wound down? If no stake: delete via
  `git branch -d worktree-agent-a02368e41e2b2641c` (plain `-d` suffices — zero unique commits,
  repo-cleaner-verified).
- **Owner**: Kim (the liveness/stake check — it is his session to identify); the branch delete
  then executes at the next repo-cleaner firing, or by the host on the spot.
- **Evidence**: repo-cleaner this dispatch — pid confirmed alive with cwd at the main checkout;
  branch verified zero-unique-commit and fast-forward-safe; deletion explicitly held, not
  executed (ambiguity ≠ license to execute).
- **Size**: ~5 min check; ~1 min delete on a yes

### 3.3 Confirm-gate the adr-0179 harvest candidate (carried, re-verified this firing)
- **Action**: next human-present firing, run `adr_queue.py pending` and put the single row to Kim
  in one batched AskUserQuestion confirm: harvest ADR-0179's consumer-assembly patterns
  (origin-keyed `#contextFor()` routing, band-driven pair→triple docking off
  SHELL_COMPACT_BREAKPOINT, retract-don't-delete divider-unpaint) into
  `agent-ui-composition-patterns/SKILL.md`. If confirmed, dispatch `/make-pack` against that
  skill scoped to ADR-0179's Decision section.
- **Owner**: Kim (the confirm decision), staged by decision-watcher/chore-lead's next
  human-present firing; `/make-pack` follows only on a yes.
- **Evidence**: decision-watcher this dispatch — candidate RE-VERIFIED against the ADR's own
  Decision text (not just re-stated); target skill still has zero `references/` files; confirm
  deferred solely because this firing was unattended.
- **Size**: ~5 min confirm; ~30–45 min harvest if confirmed

## 4. Hygiene debt

### 4.1 Land this firing's ops-state delta — with one filename normalization (recurring)
- **Action**: chore-lead's close-out commits and pushes the already-written payloads —
  `.claude/ops/adr-checkpoint.json`, `.claude/ops/watch-checkpoint.json` (→ 12:04:23Z),
  `.claude/ops/state-checkpoint.json` (worktree inventory 2→1), the three new reports, and this
  `plan.md`. Before committing: rename `reports/20260810T120510Z.md` →
  `reports/2026-08-10T120510Z.md` — it is the only file in the reports dir deviating from the
  hyphenated timestamp convention every other report uses (verified against the full dir
  listing at planning time).
- **Owner**: chore-lead close-out (per `rulings.md` §"Seat-payload landing leg")
- **Evidence**: `git status --porcelain -- .claude/ops/` at planning time: 3 modified checkpoints
  + 3 untracked reports, uncommitted; precedent commits `0feb1141`, `3f4aba65`.
- **Size**: ~5 min

### 4.2 Encode the ops-seat contract rulings into the harness agents (cross-repo, carried ×6)
- **Action**: one change in the nonoun-plugins repo (harness plugin): (a) `chore-lead.md` gains
  the close-out landing leg; (b) evidence write-back ownership; (c) the seat-side payload-fence
  rule (fenced payload = verbatim content + target path; the 2026-08-09 repo-cleaner incident);
  (d) the mandatory first-line `Status:` enum in the ops seats' report contracts; (e) NEW
  instance this firing: pin the report-filename format (`YYYY-MM-DDTHHMMSSZ.md`, hyphenated) in
  the seat contracts — the decision-watcher's `20260810T120510Z` deviation shows the format is
  currently convention, not contract.
- **Owner**: host session in the nonoun-plugins repo (not doable from this checkout)
- **Evidence**: `rulings.md` §"Seat-payload landing leg" + §"Evidence write-backs"; sixth
  consecutive sweep with no landing evidence in nonoun-plugins; deviation instances now span
  three distinct seats.
- **Size**: ~30 min

## Standing notes (not queue entries)

- **Open issues (2)**: #680 (bug, doing — fix-ready per 3.1, no linked PR yet) · #616 (task,
  size:small, upstream-gated on `a2ui-project/a2ui#2150` — external wait, re-enters ops scope
  only if the gate lifts and it stalls).
- **pid 30537 is live** — no reap, no branch delete, until 3.2's human check clears. The
  worktree it once locked is already gone; only the process and its branch name remain.
- **ADR ledger restated**: 178 live ADRs, numbering runs to 0179 — **0108 was never issued** (a
  real numbering gap, not a missing file). Harvest queue = exactly the adr-0179 row (3.3).
- **PR tally**: 395 total (389 MERGED, 6 historical CLOSED-unmerged, no branch remnants).
- **gitignore KEEP-LIST fence is permanent** — 7 G1 warnings, Kim-ruled standing noise, exit 0
  is the whole gate. No sweep re-proposes a trim.
- **`.claude/ops/` is git-tracked** — landing legs end in commit+push, not just a write.
- **Report-contract watch continues** — all three seats 🟢 with clean forms this firing except
  the filename deviation (handled in 4.1/4.2); the two prior incidents (202038Z payload fence,
  first-sweep Status-line omission) stay encoded in 4.2's scope.

*Written by chore-planner, 2026-08-10 third sweep. Landed by chore-lead's close-out per the
landing-leg ruling.*
