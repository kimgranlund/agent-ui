# Ops plan — agent-ui

- **Dispatch**: 2026-08-08, sweep mode, fourth dispatch this date (window since ~15:10;
  chore-lead fan-out, three seat reports attached — decision-watcher + issue-sorter inline,
  repo-cleaner also landed at `.claude/ops/reports/2026-08-08T222423Z.md`, verified present on
  disk at plan time; nothing refetched)
- **Seats**: decision-watcher 🟢 (all 176 ADR hashes match, zero delta; 3 harvest candidates
  still pending) · issue-sorter 🟢 (nothing to route — every author allow-listed; checkpoint
  bumped to 2026-08-08T22:23:08Z, applied by the dispatching session) · repo-cleaner 🟢
  (campaign_close #619/#620 verification-only clean; zero orphans; s5-615 live lane untouched)
  — 3/3 returned, no UNMEASURED sections
- **Supersedes**: the third 2026-08-08 plan; per-item disposition below
- **Verdict**: repo surface clean and the in-flight lane healthy — the one entry unblocking
  other work is Kim's merge of PR #621 (gates the staged S5 ship); all seven other entries are
  carry-forward, and the queue is human-gated for the third consecutive cycle.

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## Prior-plan disposition (third 2026-08-08 plan → this dispatch)

| Item | Fate |
|---|---|
| 1.1 post #613 evidence comment | **Carried** → 1.1, evidence widened: #619/#620 both shipped clean this firing (branches already absent), making three consecutive clean ships (#618, #619, #620) against the one 17-branch recurrence |
| 2.1 commit `.claude/ops/` | **Carried** → 2.2 (6th cycle; repo-cleaner again: the ops substrate is the only untracked content) |
| 3.1 rule the #613 fix path | **Carried** → 3.1 (evidence now 3 clean ships vs one recurrence-at-scale; repo-cleaner's own framing: "lightly confirming, not conclusive proof its fix holds at scale") |
| 3.2 harvest confirm 0173/0174/0175 | **Carried** → 3.2 (4th consecutive firing pending; decision-watcher re-confirms the three candidates byte-unchanged) |
| 3.3 ops-state landing-leg ruling | **Carried** → 3.3 (mixed landing paths reproduced again this firing — see entry) |
| 3.4 friendlies `standing_rule` | **Carried** → 3.4 (zero unknown filers again — gap latent, not resolved) |
| 4.1 trim 17 stale gitignore rules | **Carried unchanged** → 4.1 (6th cycle, byte-identical G1 list re-proposed) |
| — | **New** → 2.1 merge PR #621 (from this dispatch's window context + issue-sorter) |

---

## 1. Gated mutations already verified safe

### 1.1 Post the #613 evidence comment (carried; evidence widened again)
- **Action**: one dated Findings comment on issue #613 (ADR-0145 write-back) recording the full
  trail: (a) the recurrence — 17 remote branches surviving merged PRs #588–#608, closed on the
  2026-08-08T13:27Z firing; (b) the counter-evidence — three consecutive clean ships since:
  #618 (branch deleted at ship time, independently reverified), and #619/#620 this firing
  (campaign_close found both remote branches already absent, verification only, no mutation).
  One comment, all facts, so the next evaluator sees the whole picture.
- **Owner**: host or chore-lead (repo-cleaner has correctly declined to self-comment, three
  firings running)
- **Evidence**: repo-cleaner 2026-08-08T22:24:23Z — "#619 and #620 (both clean, remote branches
  already absent — verification only)"; "Issue #613 stays open … only lightly confirming, not
  conclusive proof its fix holds at scale"; prior firing's 17-branch close list.
- **Size**: 5 min

## 2. Blocking other work

### 2.1 Merge PR #621 (identity S4) — gates the live S5 lane (new)
- **Action**: Kim reviews and merges PR #621 (closes #614). The S5 build —
  `feat/615-identity-s5-account` + worktree `.claude/worktrees/s5-615` — is a LIVE in-flight
  lane staged to ship only after #621 lands; until then it idles and #614/#615 stay open under
  `doing`.
- **Owner**: Kim (merges are Kim's)
- **Evidence**: dispatch window context (this sweep) — "#621 … OPEN awaiting merge; s5-615 …
  ships after #621 merges, not an orphan"; issue-sorter 2026-08-08T22:23Z — #621 a normal
  execution artifact (Closes #614), no routing needed; repo-cleaner — s5-615 correctly left
  untouched, #614/#615 `doing` labels accurate (same-day activity).
- **Size**: ~15 min review + merge
- **Blocks**: the S5 ship, #614/#615 close-out, and the next campaign_close cycle.

### 2.2 Commit `.claude/ops/` to git (6th cycle)
- **Action**: `git add .claude/ops && git commit` on main — or make the ignore decision explicit
  for any subtree (`reports/`, `mb-live-proof/`) that shouldn't ride along. Still fully
  untracked; until it lands, every sweep's checkpoints, queues, and reports have no history and
  no durability past the working tree.
- **Owner**: host (Kim's session at `/Users/kimba/Projects/nonoun/agent-ui`)
- **Evidence**: repo-cleaner 2026-08-08T22:24:23Z `sync_main.py` section — "the only untracked
  content is the standing `.claude/ops/` substrate itself"; carried 2026-08-04 → 08-05 →
  08-08 ×4.
- **Size**: 10 min
- **Blocks**: durability of all checkpoint/queue state and every seat's delta economics next firing.

## 3. Human-decision items

### 3.1 Rule the #613 path — recurrence-at-scale vs three clean ships
- **Action**: Kim evaluates #613 once entry 1.1 lands the record: the skip recurred on a
  17-branch batch, then three consecutive small ships ran clean. Decide: (a) directed fix
  session against the ship-time campaign_close leg, (b) keep #613 open until a real multi-PR
  batch tests the criterion at scale (its acceptance asks for zero survivors across a full
  sweep), or (c) close as resolved and reopen on recurrence.
- **Owner**: Kim (ruling) → host session (any fix, once ruled)
- **Evidence**: repo-cleaner 2026-08-08T22:24:23Z — "this firing's 2 merges were clean but
  that's only lightly confirming, not conclusive proof its fix holds at scale."
- **Size**: 10 min ruling; fix ~1 h only if (a)

### 3.2 Batched confirm — three ADR harvest candidates (0173 / 0174 / 0175), 4th firing pending
- **Action**: one AskUserQuestion round with Kim over the three `adr-queue.json` rows:
  **ADR-0173** descriptor-generation architecture (props-gen inversion) → likely new reference
  file in `agent-ui-component-standards`; **ADR-0174** planner-stage modality-gate + additive
  plan-arm meta-line pattern → likely a new skill (no axis owns the producer toolkit's envelope
  architecture); **ADR-0175** mint-vs-compose criteria for aggregate-valued FACE fields → likely
  new reference file in `agent-ui-component-design`. On confirm, dispatch the harvests.
- **Owner**: Kim, via the host session (decision-watcher states it has no AskUserQuestion tool —
  the confirm must happen with Kim directly)
- **Evidence**: decision-watcher 2026-08-08 (inline, this firing) — zero ADR delta across all
  176 hashes; the 3-candidate queue unchanged since 2026-08-07T21:34:50Z; 4th consecutive
  firing in this state.
- **Size**: 10 min confirm; follow-ons ~1 h (0174) + 2 × ~45 min (0173/0175)

### 3.3 Encode the ops-state landing leg (carried; inconsistency reproduced a fourth time)
- **Action**: rule the standing mechanism for seat-payload persistence under the #125
  write-split — chore-lead's close-out always lands seat payloads before reporting up, or seats
  get explicit write authorization — and encode it in chore-lead's and each ops seat's dispatch
  brief so per-firing landing verification stops being queue work.
- **Owner**: Kim (ruling) → chore-lead (brief-update pass)
- **Evidence**: this firing shows three different landing paths at once — repo-cleaner's report
  landed as a file (`reports/2026-08-08T222423Z.md`, verified present), issue-sorter's
  checkpoint bump was "already applied by the dispatching session," decision-watcher was
  inline-only. Fourth consecutive plan carrying this.
- **Size**: 15 min ruling + ~30 min brief pass

### 3.4 Decide the friendlies `standing_rule` (carried)
- **Action**: rule how a future new/unknown issue author is handled at first contact —
  `auto-friendly-on-access` vs `hold-first-filing` — and record it in `friendlies.json`'s
  policy block (field exists, still `null`).
- **Owner**: Kim, via the host session
- **Evidence**: issue-sorter 2026-08-08T22:23Z — every discovered item (#609, #611, #613,
  #614, #615, #621) authored by `kimgranlund`, the sole allow-list entry; the gap stayed
  latent again.
- **Size**: 5 min

## 4. Hygiene debt

### 4.1 Trim the 17 stale gitignore rules (6th cycle)
- **Action**: review and trim the rules `gitignore_check.py` flags, byte-identical six firings
  running: `logs`, `*.log`, `npm-debug.log*`, `yarn-debug.log*`, `yarn-error.log*`,
  `pnpm-debug.log*`, `lerna-debug.log*`, `dist-ssr`, `*.local`, `.vscode/*`, `.idea`, `*.suo`,
  `*.ntvs*`, `*.njsproj`, `*.sln`, `*.sw?`, `.claude/docs/other`. Propose-only per the script
  and the seat's standing rule; a host inline pass ends the recurring flag.
- **Owner**: host inline (apply); repo-cleaner remains propose-only
- **Evidence**: repo-cleaner 2026-08-08T22:24:23Z — "same 17 pre-existing G1 stale-rule
  warnings as every prior sweep (proposed, never self-edited)."
- **Size**: 15 min

---

## Standing notes (not queue entries)

- **s5-615 is live, not debt**: `feat/615-identity-s5-account` + `.claude/worktrees/s5-615` are
  an in-flight S5 build staged behind #621 — repo-cleaner correctly left them untouched; they
  re-enter cleanup scope only if found stranded AFTER #621 and the S5 ship both land.
- **After #621 merges**: the next repo-cleaner firing runs campaign_close for #621, and the
  primary checkout (currently on `feat/614`, per repo-cleaner's sync_main evaluation) needs
  returning to main + pull before any pixel-truth "is it fixed" answer (standing craft).
- **Open dev backlog, not ops debt**: #609, #611, #613, #614 (closes via #621), #615 (the live
  S5) — all correctly labeled (issue-sorter); none is queue material here except #613
  (entries 1.1/3.1).
- Executed-this-sweep actions (campaign_close verification for #619/#620, gitignore_check.py
  read-only, 176-ADR checkpoint classify, watch-checkpoint bump) are recorded in the seat
  reports, not re-queued. `sync_main.py` correctly not run — a stash would strand the ops
  substrate, and the primary checkout is legitimately on `feat/614`.

*Written by chore-planner, 2026-08-08 sweep (fourth dispatch this date). This seat queues; it
executed nothing above.*
