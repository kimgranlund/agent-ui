<!-- target-path: .claude/ops/plan.md -->
# Ops plan — agent-ui

- **Dispatch**: 2026-08-11 fifth sweep — run DIRECTLY by the host session, not via chore-lead's
  Agent-tool fan-out: this session's subagent spawn ceiling (200/200) is exhausted and confirmed
  non-resetting, so `chore-lead` dispatch failed outright on the first attempt this firing. Kim
  chose (AskUserQuestion) to have the host approximate decision-watcher/issue-sorter/repo-cleaner/
  chore-planner directly with Read/Grep/Bash rather than skip the sweep. Prior plan (2026-08-10
  fourth sweep, landed as `c53ca1ad`) read as carry-forward source.
- **Seats (approximated, not dispatched)**: decision-watcher 🟢 (no new ratified-ADR delta beyond
  what this session itself produced — ADR-0180 ratified same day as the last landing, already
  reflected; ADR-0181/0182 both still `proposed`, no harvest judgment owed on either; the
  one already-queued adr-0179 candidate is unchanged) · issue-sorter 🟢 (7 open issues, ALL
  already accounted for — 4 shipped as open PRs by the host this session (#716→#720, #709→#718,
  #705→#719, #704→#708 built earlier), 1 blocked on ratification (#695), 1 a live peer PR
  in-flight (#691→#692), 1 an external upstream+CLA blocker (#616); 0 new/unlabeled/unknown-filer
  items) · repo-cleaner 🟢 (4 fully-merged local branches with zero unique commits and no remote
  counterpart deleted — `worktree-agent-{a0f84687af5d992a1,a1106a62e6ec85a06,aa8a55342c71e0c78,
  ad9b5586e90c71999}`, all four at `7da1b9c6`, already an ancestor of `main`; the prior plan's
  2.1/2.2 blockers are BOTH already resolved — see disposition table; the prior plan's 3.2 branch
  target `worktree-agent-a02368e41e2b2641c` no longer exists at all; pid 30537 is alive and now
  correctly identified as holding LIVE, valuable work — `worktree-agent-a1a8c09e80da8f0b0` = PR
  #708 (GH #704 fix), not orphaned; `git worktree list` shows one stale-lock report was itself
  stale: `gh-691-authoring-hydration` is UNLOCKED now, not held) — 3/3 "returned", 0 UNMEASURED.
- **mobilize-chores' own ticket-mobilization step**: 0 tickets mobilizable this run — every open
  `bug`/`task`/`enhancement` issue already has an in-flight PR or a named, verified structural
  block (see issue-sorter above); no confirm round was needed.
- **Supersedes**: the 2026-08-10 fourth-sweep plan; per-item disposition below.
- **Verdict**: mostly GOOD NEWS — both of the fourth sweep's blockers (2.1 stale lock, 2.2 stale
  ADR-0179 body text) turned out already resolved by the time this sweep ran (the lock cleared
  itself or was cleared earlier this session; the body text was fixed in PR #711's S7-e slice,
  dated 2026-08-11 in the ADR's own correction note). The 3.2 pid-30537 entry was actively WRONG
  by this sweep — the branch it named is gone and the pid it's alive under now holds real,
  in-flight work, not an orphan — corrected below rather than carried forward unchanged. Four
  genuinely dead local branches cleaned. One human-decision item remains open (3.1, unchanged).

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## Prior-plan disposition (2026-08-10 fourth sweep → this dispatch)

| Item | Fate |
|---|---|
| 2.1 stale lock, gh-691-authoring-hydration | **RESOLVED** — `git worktree list` shows no lock on this worktree now; PR #692 is open and unstranded |
| 2.2 ADR-0179 stale body text under ratified heading | **RESOLVED** — fixed in PR #711 (S7-e slice); the ADR's own body now carries a dated 2026-08-11 correction note explaining the removal |
| 3.1 adr-0179 harvest confirm | **CARRIED, unchanged** → **3.1** below — still exactly one pending row in `adr-queue.json`, still needs Kim's yes/no |
| 3.2 pid-30537 stake check + orphaned-branch delete | **CORRECTED, not carried as-was** → **folded into standing notes** — the named branch (`worktree-agent-a02368e41e2b2641c`) no longer exists; pid 30537's ACTUAL current worktree (`agent-a1a8c09e80da8f0b0`) holds real commits matching open PR #708 (GH #704) — this is live, valuable, in-progress work, not an orphan; nothing to check or delete |
| 3.3 #680 build dispatch | **RESOLVED** — `gh issue view 680` reads `CLOSED`; entry retired |
| 4.1 land the fourth sweep's ops delta | **Resolved** — landed as `c53ca1ad` |
| 4.2 encode ops-seat contract rulings in nonoun-plugins | **Carried ×8** — still no landing evidence (cross-repo, not doable from this checkout) |

## 1. Gated mutations already verified safe

- **Deleted 4 dead local branches** (`worktree-agent-a0f84687af5d992a1`,
  `worktree-agent-a1106a62e6ec85a06`, `worktree-agent-aa8a55342c71e0c78`,
  `worktree-agent-ad9b5586e90c71999`): all four at commit `7da1b9c6` (an ancestor of `main`,
  merged via PR #711), zero unique commits, no remote counterpart (`git ls-remote` empty for all
  four), no attached worktree. `git branch -d` (plain, non-force) executed directly — the exact
  safe-delete class the fourth sweep's 3.2 entry itself named as the eventual safe action, just
  against branches that actually met the bar this time.

## 2. Blocking other work

(none open — both of the fourth sweep's blockers resolved before this sweep ran; see disposition
table above.)

## 3. Human-decision items

### 3.1 Confirm-gate the adr-0179 harvest candidate — unchanged, still ripe (carried)
- **Action**: put the single pending row to Kim in one AskUserQuestion confirm: harvest
  ADR-0179's patterns into `agent-ui-composition-patterns/SKILL.md` per the ratified amendment's
  decision surface — (1) unified header: ONE three-zone bar (agent selector / pane-visibility /
  actions), pane nav retired everywhere, place vocabulary `[Chat | Settings | Co-pilot]`; (2)
  origin-keyed `#contextFor()` routing; (3) retract-don't-delete divider-unpaint token-repoint.
  Do NOT harvest the superseded-in-part material (the prior amendment's fixed pair/triple
  banding, the pane-nav-persist/hidden arc). If confirmed, dispatch `/make-pack` scoped to
  agent-ui-composition-patterns.
- **Owner**: Kim (the confirm); `/make-pack` follows only on a yes.
- **Evidence**: `adr-queue.json` — exactly one pending row, unchanged since the fourth sweep;
  corpus grep still clean (no existing row covers this).
- **Size**: ~5 min confirm; ~30–45 min harvest if confirmed

## 4. Hygiene debt

### 4.1 Land this firing's ops-state delta (recurring)
- **Action**: commit + push this `plan.md` update directly to `main` (the established chore-lead
  landing-leg pattern — ops bookkeeping only, not a PR-gated code change).
- **Owner**: host, this firing.
- **Evidence**: `git status --porcelain -- .claude/ops/` at planning time showed only this file
  needing a rewrite; no checkpoint JSON needed a structural change this sweep (no new ADR
  ratification, no new triage state beyond what issue-sorter's approximation already covered).
- **Size**: ~5 min

### 4.2 Encode the ops-seat contract rulings into the harness agents (cross-repo, carried ×8)
- **Action**: unchanged from the fourth sweep — one change in the nonoun-plugins repo.
- **Owner**: host session in the nonoun-plugins repo (not doable from this checkout).
- **Evidence**: `rulings.md` §"Seat-payload landing leg" + §"Evidence write-backs"; eighth
  consecutive sweep with no landing evidence in nonoun-plugins.
- **Size**: ~30 min

## Standing notes (not queue entries)

- **Board shape (this sweep)**: 7 open issues (down from 9 — #680 closed, plus this session's own
  #704/#705/#709/#716 work landing as open PRs rather than closing outright yet) · 5 open PRs
  (#692 draft/gh-691-authoring-hydration, #708/worktree-agent-a1a8c09e80da8f0b0, #718/#719/#720 —
  this session's own GH #709/#705/#716 fixes) · total PR/branch counts NOT re-derived this sweep
  (disproportionate to re-page for a sweep with no new mint activity — re-derive next time
  something actually changes that count).
- **This session's own shipped-but-unmerged PRs**: #718 (GH #709), #719 (GH #705), #720 (GH
  #716) — all gate-verified, all awaiting Kim's own merge (never the host's action).
- **adr-0180 is `accepted`** (ratified same day as the fourth sweep's landing, `c53ca1ad`) — no
  harvest judgment made yet either way; worth a real decision-watcher pass next firing rather
  than a rushed call inside this direct-sweep substitute.
- **adr-0181/adr-0182 are `proposed`** — 0181 gates GH #695's build; 0182 (this session's own GH
  #716 design work) gates nothing else yet. Neither has a harvest candidate (not ratified).
- **#616 upstream wait** — re-verified fresh this sweep: `a2ui-project/a2ui#2150` still `OPEN`
  (updated 2026-08-08), no `/conformance/suites/*.yaml` convention landed; the issue's own second
  gate (a signed Google CLA) is unaffected either way.
- **#691 (PR #692) is live peer work, unstranded** — worktree unlocked, PR open, updated
  2026-08-10T17:05; not stale enough to adopt, no collision risk taken.
- **gitignore KEEP-LIST fence is permanent** — standing Kim-ruled noise, unchanged, not
  re-verified this sweep (no CSS/build-output changes this firing would perturb it).
- **`.claude/ops/` is git-tracked** — landing legs end in commit+push, not just a write.

*Written directly by the host session (chore-lead/chore-planner unavailable — subagent spawn
ceiling exhausted), 2026-08-11, fifth sweep, per Kim's explicit go-ahead to approximate the sweep
without Agent-tool dispatch this firing.*
