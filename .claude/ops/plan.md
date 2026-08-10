<!-- target-path: .claude/ops/plan.md -->
# Ops plan — agent-ui

- **Dispatch**: 2026-08-10, second sweep (chore-lead fan-out; three seat reports attached —
  decision-watcher, issue-sorter, repo-cleaner; nothing refetched). Prior plan (2026-08-10 first
  sweep, landed as commit `3f4aba65`) read as carry-forward source. Main at `d5daffe1`, clean,
  matches origin/main exactly.
- **Seats**: decision-watcher 🟢 (zero ADR drift; checkpoint + queue byte-identical to last firing,
  independently verified via a scratch-copy `advance` run — no payload; count restated as 178 live
  ADRs, numbering to 0179, 0108 never issued; adr-0179 harvest candidate carried unchanged;
  0173/0174/0175 harvest re-confirmed landed via PR #623/#648) · issue-sorter 🟢 (PRs #674–#678 all
  MERGED ~06:22Z, each verified via `gh pr view`, closing #669/#672/#673/#666/#664; open issues
  7→2; #670's three forked design questions RULED by Kim on-issue 06:31:02Z — build unblocked; #616
  unchanged external wait; zero unknown authors, zero holds; payload: watch-checkpoint →
  06:31:56Z + report 063156Z) · repo-cleaner 🟢 (main clean at `d5daffe1`, dirty-main rule
  honored; SECOND worktree found — LOCKED, live pid 30537 since Aug 3 — correctly untouched but
  flagged as a provenance discrepancy vs. the prior report's "exactly one worktree"; 5 stale
  remote-tracking refs pruned, all clean merges, no #613-class survivor; PRs 394 total / 0 open,
  prior 389-tally a cosmetic --limit undercount; gitignore exit 0, 7 G1 warnings standing; nothing
  executed; payload: state-checkpoint + report 063316Z) — 3/3 returned, no UNMEASURED sections.
- **Supersedes**: the 2026-08-10 first-sweep plan; per-item disposition below.
- **Verdict**: steady-state and the cleanest board in days — 0 open PRs, 2 open issues — with one
  status change that outranks everything queued: **#670 is now build-unblocked** (Kim's on-issue
  ruling, 06:31:02Z). That is the sweep's most actionable item; it changes what's buildable next
  even though it mutates no ops state. Behind it: the carried adr-0179 harvest confirm, the
  recurring landing leg, and one new hygiene row auditing the second-worktree provenance gap.

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## Prior-plan disposition (2026-08-10 first sweep → this dispatch)

| Item | Fate |
|---|---|
| 3.1 confirm-gate the adr-0179 harvest candidate | **Carried unchanged** → **3.2** below — decision-watcher explicitly carried it, not re-decided; still awaiting the batched Kim confirm |
| 4.1 land sweep ops delta (recurring) | **Resolved for that sweep** — landed as commit `3f4aba65`; recurs → **4.1** below for this firing's payloads (verified unlanded: ops tree clean, reports dir ends at 050520Z) |
| 4.2 encode ops-seat contract rulings in nonoun-plugins (cross-repo) | **Carried ×5** → **4.2** below — not doable from this checkout, still no landing evidence |
| Standing note: live peer work rides the main checkout (#666/#670/#673) | **Retired** — main is clean; #666/#673 closed via PRs #677/#676; #670 remains open but no dirty state rides the checkout |
| Standing note: open issues (7) | **Superseded** — now 2 (#670, #616); #669/#672/#673/#666/#664 closed by PRs #674–#678 |

## 1. Gated mutations already verified safe

(none this sweep — 0 open PRs of 394; no merged PR left a surviving remote branch (the 5 stale
remote-tracking refs pruned this firing all traced to the just-merged #674–#678 branches, clean
merges, not #613-class survivors); main clean and even with origin; nothing quarantine-eligible;
no host-repo gated reap script exists.)

## 2. Blocking other work

(none this sweep — #616 remains an external upstream wait on `a2ui-project/a2ui#2150`, not a queue
blocker; #670's former design-question block is LIFTED, see 3.1.)

## 3. Human-decision items

### 3.1 #670 is build-unblocked — decide the build dispatch (NEW, the sweep's headline)
- **Action**: Kim/host decides when to dispatch the build for #670 (Author composer-first empty
  state missing the Model/Effort picker). All three previously-forked design questions
  (storage / precedence / effort-scope) were ruled by Kim directly on the issue; nothing remains
  open on design. The ops queue stages the decision only — it does not start the build.
- **Owner**: Kim (go/when decision); a build seat dispatched by the host on a yes. Not an ops-seat
  action.
- **Evidence**: Kim's OWNER comment on #670, 2026-08-10T06:31:02Z — "Build now unblocked"
  (issue-sorter, verified in-window); label/state unchanged (bug + doing, open); no linked PR yet;
  repo-cleaner's independent cross-check concurs.
- **Size**: ~2 min decision; the build itself is issue-sized (est. 1–3 h), outside ops scope

### 3.2 Confirm-gate the adr-0179 harvest candidate (carried, unchanged)
- **Action**: next human-present firing, run `adr_queue.py pending` and put the single row to Kim
  in one batched AskUserQuestion confirm: harvest ADR-0179's consumer-assembly patterns
  (origin-keyed `#contextFor()` routing, band-driven pair→triple docking off
  SHELL_COMPACT_BREAKPOINT, retract-don't-delete divider-unpaint) into
  `agent-ui-composition-patterns/SKILL.md`. If confirmed, dispatch `/make-pack` against that skill
  scoped to ADR-0179's Decision section.
- **Owner**: Kim (the confirm decision), staged by decision-watcher/chore-lead's next
  human-present firing; `/make-pack` follows only on a yes.
- **Evidence**: decision-watcher this dispatch — candidate unchanged, carried not re-decided;
  `adr-queue.json` byte-identical to last firing (scratch-copy `advance` verification).
- **Size**: ~5 min confirm; ~30–45 min harvest if confirmed

## 4. Hygiene debt

### 4.1 Land this firing's ops-state delta (recurring)
- **Action**: chore-lead's close-out writes, commits, and pushes the returned payloads —
  `.claude/ops/watch-checkpoint.json` (→ 2026-08-10T06:31:56Z),
  `.claude/ops/state-checkpoint.json` (worktree inventory 1→2),
  `.claude/ops/reports/2026-08-10T063156Z.md` (new),
  `.claude/ops/reports/2026-08-10T063316Z.md` (new), and this `plan.md`.
- **Owner**: chore-lead close-out (per `rulings.md` §"Seat-payload landing leg")
- **Evidence**: `git status --porcelain -- .claude/ops/` at planning time: CLEAN at `3f4aba65` —
  every payload above exists only in seat reports, none on disk; reports dir verified ending at
  `2026-08-10T050520Z.md`; precedent commits `3f4aba65`, `8509797b`.
- **Size**: ~5 min

### 4.2 Encode the ops-seat contract rulings into the harness agents (cross-repo, carried ×5)
- **Action**: one change in the nonoun-plugins repo (harness plugin): (a) `chore-lead.md` gains
  the close-out landing leg (seats return payloads; chore-lead writes `.claude/ops/` before
  reporting up); (b) `chore-lead.md` gains evidence write-back ownership (dated tracker comments
  from seat evidence); (c) the seat-side payload-fence rule (fenced payload = verbatim content +
  target path; a path-only fence is malformed — the 2026-08-09 repo-cleaner incident); (d) the
  mandatory first-line `Status:` enum in the ops seats' report contracts (the 2026-08-10
  first-sweep issue-sorter omission; no recurrence observed this firing).
- **Owner**: host session in the nonoun-plugins repo (not doable from this checkout)
- **Evidence**: `rulings.md` §"Seat-payload landing leg" + §"Evidence write-backs"; fifth
  consecutive sweep with no landing evidence in nonoun-plugins.
- **Size**: ~25 min

### 4.3 Audit the second-worktree provenance gap (NEW this firing)
- **Action**: determine why `.claude/worktrees/agent-a02368e41e2b2641c` (LOCKED, live pid 30537,
  running since Aug 3, branch `worktree-agent-a02368e41e2b2641c` at `d5daffe1`, clean) was absent
  from the prior firing's inventory (`2026-08-10T050520Z.md` stated "exactly one worktree")
  despite its process predating that report. Two candidate explanations to settle: an inventory-
  method blind spot in that firing's repo-cleaner pass (a seat-reliability defect — would warrant
  a brief fix), or a real state change the timeline evidence contradicts. The worktree itself
  stays UNTOUCHED — it is genuinely live; this row audits the report, not the tree.
- **Owner**: next repo-cleaner firing (chore-lead adds one line to its brief: reconcile the
  050520Z inventory claim against the pid-30537 timeline and report which explanation holds)
- **Evidence**: repo-cleaner this dispatch — flagged, deliberately not re-investigated;
  `state-checkpoint.json` payload now tracks 2 worktrees. Ruled a queue row rather than a standing
  note because it questions the accuracy of a durable report artifact (stale/inaccurate records
  are defects, not noise).
- **Size**: ~10 min

## Standing notes (not queue entries)

- **Keep-live: worktree `agent-a02368e41e2b2641c`** — LOCKED, pid 30537 alive (verified via `ps`
  this firing), clean at `d5daffe1`. Never reap while the pid is alive; 4.3 audits its
  *reporting* history only.
- **Open issues (2)**: #670 (bug, doing — build-unblocked per 3.1, no linked PR yet) · #616
  (task, size:small, upstream-gated on `a2ui-project/a2ui#2150` — external wait, re-enters ops
  scope only if the gate lifts and it stalls).
- **ADR ledger restated**: 178 live ADRs, numbering runs to 0179 — **0108 was never issued** (a
  real numbering gap, not a missing file). Future counts reading 178 files against a 0179 max are
  correct, not drift. Harvest history clean (0173/0174/0175 via PR #623, 0178 via PR #648); queue
  = exactly the adr-0179 row (3.2).
- **PR tally corrected**: 394 total (388 MERGED, 6 historical CLOSED-unmerged, no branch
  remnants). The prior report's 389/388/1 was a `--limit` query-scope undercount — cosmetic, not
  an event.
- **gitignore KEEP-LIST fence is permanent** — 7 G1 warnings, Kim-ruled standing noise, exit 0 is
  the whole gate. No sweep re-proposes a trim.
- **`.claude/ops/` is git-tracked** — landing legs end in commit+push, not just a write.
- **Report-contract watch continues** — no seat-side deviation this firing (all three 🟢, forms
  clean); the two prior incidents (202038Z payload fence, first-sweep Status-line omission) stay
  encoded in 4.2's scope.

*Written by chore-planner, 2026-08-10 second sweep. Landed by chore-lead's close-out per the
landing-leg ruling.*
