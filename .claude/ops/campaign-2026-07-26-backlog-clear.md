# Campaign — clear the known backlog (2026-07-26)

Coordinator: host session under `/teamwork:lead-team` (host holds the `team-lead` contract; every
other seat is a real dispatch). Charter bound 2026-07-26.

## Charter

Clear agent-ui's entire known backlog as one gated multi-seat campaign: GH #273, #276, #278, plus
the unfiled roadmap §2/§3 repair now that the ADR-0156 removal gate has closed.

## Frontier state

| Slice | Work | Seat | Status |
|---|---|---|---|
| S1 | #278 (residual ADR-0156 doc cleanup) + roadmap §2/§3 repair | `teamwork:planner` | built, in review |
| S1-critic | independent review of S1's diff | `docs:doc-checker` | 🟢 PASS (see verdict below) |
| S1b | 3 critic repairs + #278's fleet-wide SAME-DEFECT set | fresh `teamwork:planner` | dispatched, on top of `94422ee` |
| S2 | #273 (a2ui-chat.ts Effort-picker parity) | `teamwork:docs-writer` | 🟢 built, `ae39333`, gates 0/0 |
| S2-critic | independent review of S2's diff | `teamwork:code-checker` | 🟢 PASS — gates independently re-run 0/0 |
| **S2 SHIPPED** | PR #279 → main, closes #273 | coordinator | 🟢 awaiting Kim's merge |
| S1b-critic | independent review of `6f19bb1` (static, git-objects) | `docs:doc-checker` | 🔴 FAIL (narrow) — 4 `scripts/` sites |
| S1c | #278's real closure via an INVERTED (exclusions-only) contract | `teamwork:builder` | dispatched |
| S3 | #276 (gen-ui-live theme-flip solo race — root-cause) | `teamwork:builder` | 🔴 PAUSED — two consecutive API 529s, no work done, tree untouched |

S1 build artifact: branch `docs-278-adr0156-aftermath`, commit `94422ee`, 7 files, +34/−34,
unpushed. `npm run check` = 0, `npm test` = 0 (382 files / 6924 tests).

Slices run **serially in the main tree**, not as a concurrent fan-out: this repo has an observed
failure mode where two non-isolated dispatches share one Edit/Write sandbox and one is silently
locked out, and worktree isolation would cost an `npm install` per slice (a fresh worktree without
its own install resolves `@agent-ui/*` through the main checkout — CLAUDE.md §Always).

**Refinement (2026-07-26):** the constraint is *one writer at a time*, not one dispatch at a time.
Critic seats (`docs:doc-checker`, `teamwork:code-checker`) hold no Edit/Write, so a review may run
concurrently with one build slice. The campaign uses that: at most one Edit/Write-holding seat is
live at any moment, with read-only critics overlapped freely.

**Second refinement — the branch-point hazard (discovered by S2, 2026-07-26).** The tree is SHARED,
so a seat running `git checkout -b` inherits whatever branch is currently checked out, not `main`.
S2 caught this itself: its branch initially forked from `docs-278-adr0156-aftermath` (S1's branch,
one commit ahead of main) rather than main. It stashed, `git reset --hard main`, popped, and
verified the parent before committing — final parent confirmed by the coordinator as `9db4596`.

Two campaign laws follow:
1. Every build slice must VERIFY its branch parent (`git rev-parse --short HEAD^`) before committing
   and state it in Evidence.
2. A critic that RE-RUNS gates needs the tree on the branch it is reviewing, so it may not be
   overlapped with a writer that checks out a different branch. Read-only critics overlap writers
   ONLY when reviewing statically via git objects. This is why S1b was held behind S2-critic rather
   than run concurrently.

## Rulings made by the coordinator

- **#273 fork ruled: parity, not opt-out.** The issue offers two fixes; `a2ui-live` (PR #272) and
  `gen-ui-live` (PR #275) both already carry the Effort picker, so giving `a2ui-chat` the same
  wiring is the consistent choice and the issue's own smaller change. Recorded here rather than
  left to the seat.

## Standing laws carried in every dispatch

- Gates run in the **foreground**; judged by **exit code**, never by grepping output.
- ADR **Status cells are Kim-reserved** — no seat flips one. ADR body edits are append-only +
  REV-annotated (doc-standards §2).
- Seats **commit on a branch and stop**; `git push` / `gh pr create` are denied to dispatched
  sessions. The host ships.
- Return in the `write-handoff` shape (Status/Summary/Files changed/Tests+checks run/Evidence/
  Risks/Open questions/Recommended next action).

## Budget

Per slice: one focused build pass, ≤2 repair attempts per finding. The same gate failing twice
stops the slice and escalates the locus (contract, not seat). Review gate per slice before commit:
generator ≠ critic.

## Decisions log

- 2026-07-26 — charter bound; S1 dispatched.
- 2026-07-26 — **S1 returned 🟢**; handoff shape valid, both gates exit 0. Sent to `docs:doc-checker`
  as S1-critic. Nothing pushed.
- 2026-07-26 — **replan (loop-rules decision), locus = the contract, not the seat.** GH #278's
  Acceptance is scoped fleet-wide ("no comment outside a historical record or frozen archive
  presents `ui-app-shell` as live design precedent") but its Summary enumerated only 8 sites. S1's
  residual sweep found ~30 further same-shape sites. The enumeration under-cut its own acceptance
  criterion, so S1b is cut from the acceptance criterion rather than re-dispatching S1 (Priority 7:
  the committed tree is the source of truth; a stood-down seat is not re-dispatched). S1-critic's Q4
  verdict supplies the SAME-DEFECT / OUT-OF-SCOPE partition so S1b does not edit records that should
  stay historical.
- 2026-07-26 — **gate-ordering clarification.** S1 was briefed to commit before review, which reads
  against Priority 3's "review before a commit". Ruled: the reviewable unit is a stable SHA on an
  **unpushed** branch, so the enforced gate for this campaign is *no push and no PR before the
  critic passes*. Applies to S2 and S3 identically.

## S1-critic verdict (2026-07-26) — PASS as slice S1; #278 Acceptance still OPEN

Scores: contract fidelity 5/5 · doc-standards §2 compliance 5/5 · citation accuracy 4/5 · roadmap
self-conventions 5/5 · truthfulness of new claims 4/5.

- **Q1 — legal.** Supersedes-cells only; Status cells read `superseded` before AND after `94422ee`.
  The deleted 35-word tail was written by `f0debd6` while Status was still `accepted` and was
  falsified hours later by `8261636`'s flip — removing a now-false lifecycle pointer is §2's
  REV-annotated mechanical-pointer-repair exception. Shared-date REV claim sound.
- **Q2 — clause-3 quote verbatim-true.** But "per-side" appears NOWHERE in ADR-0156; the
  parenthetical attributes #278's own rationale to clause 3. Fact is true (`super-shell.ts:93-105`),
  criterion met, wording nit only.
- **Q3 — one factual error.** `roadmap.md:190` claims the flips went "via the sanctioned script
  path". FALSE — `adr_ratify.py` covers proposed→accepted ONLY (commit `8261636`'s own message says
  so); the flips were Kim's owner-reserved hand-edit plus manual README-row propagation. Must be
  repaired before this branch is pushed.
- **Q4 — partition delivered.** 138 raw hits swept. The builder's ~30-site list was directionally
  right but BOTH under-reported (missed the entire `components` package, `shell-breakpoint.ts`,
  `_page.css`) and would be over-broad taken whole.

**The scoping tiebreaker S1b inherits:** fix a site only if it (a) states or implies the component
or file currently exists or behaves, (b) describes a scenario that can no longer occur, or (c) cites
app-shell as precedent steering a FUTURE design choice. Past-tense origin notes, measurement
provenance, Kim's Figma frame proper nouns, the site's own `.app-shell` CSS class, and generated
artifacts stay untouched.

## Coordinator's own verification of the critic's Q3 finding (2026-07-26)

Not taken on the critic's word — checked at source before briefing a repair:

- `scripts/adr_ratify.py:4` — "The ONLY sanctioned agent-side path for flipping an ADR
  `proposed -> accepted`"; `:109` fail-closes unless the Status cell reads `proposed`.
- Commit `8261636`'s message — "Kim's own clause-5 flip of the three Status cells (the
  owner-reserved edit — never an agent Edit) … adr_ratify.py regenerates for proposed->accepted but
  **has no path for accepted->superseded**."

`roadmap.md:190` therefore asserts the exact inverse of the commit it cites in the same sentence.
CONFIRMED as the campaign's one true factual defect. S1b's repair text is grounded in these two
sources, not in the critic's paraphrase.

## 🔴 Branch-base defect on `docs-278-adr0156-aftermath` (found 2026-07-26, coordinator's own miss)

`git log main..docs-278-adr0156-aftermath` shows THREE commits, not two:

    85dea87  S1b's fleet-wide sweep
    94422ee  S1's aftermath fix
    f0c35d2  chore: migrate retired plugin/skill/agent names   <-- foreign, not on main

S1 hit the shared-tree branch-point hazard and forked from `chore/rename-migration-sweep` instead
of `main`. S2 hit the same hazard, caught it, and reset; S1 did not, and the coordinator verified
S2's parent (because S2 flagged it) without going back to check S1's. **Locus: the coordinator, not
the seat** — the verify-your-parent law was written into S2's successors' briefs only after S2
surfaced it, so S1 never carried it.

Two consequences:
1. A PR from this branch would sweep another branch's in-flight work into #278.
2. **Both slices' green gates ran on a base containing `f0c35d2`** — a skill/agent RENAME migration.
   Green on that base does not prove green on `main`. Gates MUST be re-run after the base repair.

Repair plan (integration step, coordinator-owned, non-destructive): **DONE 2026-07-26.**
- New branch `build-278-adr0156-aftermath` cut from `main` @ `9db4596`; `94422ee` → `438469f` and
  `85dea87` → `6f19bb1` cherry-picked clean, no conflicts. Old branch left intact as a fallback.
- Verified: `git log main..build-278-adr0156-aftermath` = exactly 2 commits. `git diff` old↔new =
  exactly `f0c35d2`'s 78 files / 197 renames, i.e. the foreign commit and nothing else was dropped.
- **Gates re-measured by the coordinator on the clean base:** `npm run check` → 0, `npm test` → 0
  (382 files / 6924 tests). The earlier green was void; this one is not. S1b's disjointness
  reasoning was correct, and is now measured rather than reasoned.
- `npm run test:browser` — UNMEASURED / skipped-not-passed on this branch (comment-only edits to two
  `.browser.test.ts` files). Stated, not implied.

## 🔴 S1b-critic verdict: FAIL (narrow) — and the ESCALATION it forces

Clean on Q2 (zero over-reach — every DO-NOT-TOUCH site verified untouched at `6f19bb1`), Q3 (A1 now
truthful, verified at source against `adr_ratify.py:4` and `8261636`'s message), Q4 (the
`shell-breakpoint.test.ts` "five"→"three" self-declared over-reach was RIGHT — the banner
contradicted its own `SITES` array of three), and Q5 (both self-reported risks verified TRUE:
`_page.ts:897-903` builds a plain `<a>`; `a2ui-live.ts:93-100` hosts on `ui-super-shell`
`data-slot="content"`).

FAILS Q1 — #278's fleet-wide clause. Four same-defect sites remain, all in `scripts/`:
1. `measure-size.mjs:26` — present-tense "what `ui-app-shell` adds ON TOP OF the components foundation"
2. `measure-size.mjs:196-197` — states the deleted `app-shell.ts` currently exists AND justifies live
   stub code by it
3. `measure-size.mjs:302` — runtime console label prints a false barrel inventory to whoever runs
   the size gate next
4. `publish-packages.mjs:28-35` — present-tense behavior claim about the deleted file
Minor: `publish-packages.mjs:67` (`'app-shell'` npm keyword — stale metadata that SHIPS on next
publish); `_page.ts:895-896` vs `_page.css:342` now disagree on CTA intent.

### Locus escalation — the contract, not the seat (Priority 4)

This is the SECOND scope miss of the same shape: S1's enumeration under-cut #278's acceptance
(~30 sites), and now S1b's enumeration missed `scripts/` entirely. Critically, the list S1b was given
came FROM the S1-critic's own full-tree sweep — so two independent enumerations both missed the same
directory. A third enumeration is not the fix.

**Structural repair for S1c: invert the contract.** Stop handing the seat a list of sites to fix.
Hand it (a) the stable, twice-verified OUT-OF-SCOPE list, (b) the tiebreaker, and (c) an instruction
to derive its own targets from a MECHANICAL whole-repo sweep — every tracked file, `scripts/` and
`packages/*/package.json` explicitly included — treating the four known sites as confirmed starting
points, not as the boundary. Enumerate the exclusions, never the inclusions.

## Coordinator's own mechanical sweep (2026-07-26) — the escalation VALIDATED

Ran `git grep -c -i "app-shell" 6f19bb1` across the whole tree (ref-pinned, immune to branch
switching). It confirmed the critic's four `scripts/` sites verbatim — and surfaced TWO more files
that NEITHER enumeration ever named:

1. **`.claude/skills/app-composition/SKILL.md:5,33,35` — the highest-impact site in the whole
   campaign.** A LIVE skill teaching consumers to compose applications on `ui-app-shell` +
   `ui-app-shell-region`, pointing at the deleted demo page `site/pages/app-shell.ts`. Line 5 sits in
   the skill's own `description`, which is loaded into every session's routing menu — it is in the
   coordinator's own context while writing this. Tiebreaker (c) at maximum blast radius: it does not
   merely record stale precedent, it actively routes FUTURE composition work to a removed component.
   Beyond #278's literal letter (a SKILL.md is not a code comment) but squarely inside its spirit and
   the standing "stale context is a defect" conviction.
2. **`vitest.config.ts:158`** — cites `app-shell.ts` as the reason for a CSS-asset resolver stanza.
   Paired with `publish-packages.mjs:28-35`'s "confined to exactly this one file (checked
   repo-wide)", this raises a BEHAVIOR question, not a prose one: with that file deleted, are the
   resolver stanza and the publish caveat now DEAD CONFIGURATION? S1c must determine, not assume —
   other `?url`/`?raw` consumers may have appeared since.

Three independent enumerations (S1's issue list, S1-critic's Q4 partition, S1b's execution) each
missed sites a single mechanical grep found in one command. The inverted contract is not a
preference; it is the demonstrated fix.

## Ship decision

`94422ee` is **held, not shipped**, despite the PASS: it contains the false `adr_ratify.py`
mechanism claim. S1b lands its repairs as a NEW commit on top of `94422ee` on the same branch
(Priority 7 — a later change is a new commit, not an in-place re-edit by a stood-down seat), and the
branch ships as ONE PR closing #278 once S1b is itself gated.

## 🟡 RESUMED (2026-07-26, later same day)

PR #279 confirmed MERGED (`2026-07-26T10:39:42Z`) — Kim merged it manually outside auto mode (PR
merges are classifier-blocked for the coordinator). **#273: CLOSED.**

Tree reconfirmed clean at `6f19bb1` on `build-278-adr0156-aftermath`. S1c re-dispatched
(`S1c-app-shell-mechanical-sweep-2`) with the identical inverted-contract brief — the first two
attempts died pre-work on API 529s, so nothing to change. S3 queued behind it (one-writer rule:
both are Edit/Write seats in the same shared tree, dispatching them together would just recreate the
branch-point race).

## 🔴 CYCLE CLOSED: BLOCKED (2026-07-26) — external platform, not the work

Three consecutive `API 529 Overloaded` failures across TWO different seats (S3 twice, S1c once).
Platform-wide, not seat-specific. Stop condition reached; no further dispatches until it clears.

**Nothing was lost and nothing is half-done.** Verified after each failure: no branch created by S3,
no partial edits by S1c, tree clean, `HEAD` = `6f19bb1`.

### RESUME HERE — exact state for a successor

Tree: on `build-278-adr0156-aftermath` @ `6f19bb1`, clean. Gates measured green on this commit
(check 0 / test 0, 382 files / 6924 tests). `test:browser` UNMEASURED on this branch.

Two dispatches to re-fire, in this order (one writer at a time):

1. **S1c** — `teamwork:builder`, the INVERTED (exclusions-only) contract. Charter: close #278's
   fleet-wide acceptance via a mechanical `git grep -i "app-shell"` sweep over ALL tracked files,
   deriving its own targets. Confirmed starting points (NOT the boundary): `measure-size.mjs:26`,
   `:196-197`, `:302`; `publish-packages.mjs:28-35` and `:67` (the `'app-shell'` npm keyword that
   SHIPS); `_page.ts:895-896` vs `_page.css:342` contradiction; and
   `.claude/skills/app-composition/SKILL.md:5,33,35` — a LIVE skill routing future work to the
   removed component (coordinator-ruled IN scope). Plus the ONE behavior question:
   `vitest.config.ts:158` + the publish caveat may be DEAD CONFIG — determine with a repo-wide
   `?url`/`?raw` sweep, but do NOT remove live config in that slice; report it.
   Commits on top of `6f19bb1`; then an S1c-critic pass; then the branch ships as ONE PR closing #278.
2. **S3** — `teamwork:builder`, #276. Branch from `main` at `9db4596` EXPLICITLY
   (`git checkout -b fix-276-theme-flip-race main`). Measure the ~14% baseline over 15–20 solo runs
   BEFORE any change. Resolve fork (A) test-asserts-too-early vs (B) a real bridge propagation race;
   the (A) fix is FORBIDDEN until (B) is ruled out with file:line evidence, because a value-change
   wait goes green either way and would HIDE a live stale-token bug. If (B): stop and report —
   the fix belongs to the component seat, not the builder.

### 🟢 #278 SHIPPED (2026-07-26) — PR #280

`073cbcc` independently reviewed twice: first pass FAIL (narrow — 4 `scripts/` sites + the live
`SKILL.md` missed), repaired in `073cbcc`; second pass **PASS**, no required fixes. Coordinator
spot-verified 3 load-bearing claims itself before shipping (file list, the shadow-DOM falsehood, the
dead-config claim) rather than trusting the report alone. Pushed by branch ref (not checkout) while
S3 was mid-flight on a different branch, so its in-progress diagnostic file was never disturbed.

PR: https://github.com/kimgranlund/agent-ui/pull/280 — mergeable, awaiting Kim (PR merges are
classifier-blocked for the coordinator under auto mode, same as #279).

### 🟡 #276 built (2026-07-26) — `ec3ded7` on `fix-276-theme-flip-race`, critic reviewing

Verdict (A) — test-sampling defect, NOT a token-bridge race. Coordinator spot-verified the two
load-bearing citations before sending to review: `queueMicrotask(flush)` confirmed at
`scheduler.ts:26`; `#syncTheme()`'s `getComputedStyle(this).colorScheme` read inside the
MutationObserver callback confirmed at `sandbox-frame.ts:301`. Commit touches exactly one file.

The statistical ~14% baseline did NOT reproduce naturally (0/40 samples before AND after the fix on
this hardware) — so the builder forced the race deterministically instead of relying on an
unreproducible baseline, and showed the OLD read fails 2/2 engines under the forced race while the
NEW settle-wait passes 2/2. Sent to `teamwork:code-checker` as S3-critic, with Q1 pointed
specifically at whether "the bridge never posts data disagreeing with its own DOM at post time" is
the RIGHT definition of correctness for SPEC-R6, or whether a real GenUI surface could still flash
the wrong colour for one frame — i.e. whether the (A) verdict itself should be overturned to (B).

Builder separately surfaced an unfixed, non-blocking product observation: the observer fires 4+
`host-context-changed` round trips per single flip (one redundant pre-flip snapshot). Not touched,
recommended as its own issue for the component seat.

### 🟢 #276 SHIPPED (2026-07-26) — PR #282

Critic: PASS, (A) upheld, but on STRONGER grounds than the builder's own — the forced-race
reproduction wasn't in the shipped diff (unreviewable as presented, a real finding), so the critic
independently re-derived a structural anti-masking proof instead of trusting the claim: the stale
post always equals what the frame already displays (never a reversion), postMessage is FIFO, and the
provider's write sits inside the observed subtree so a trailing correct notify is generated on every
flip BY CONSTRUCTION — convergence isn't empirical luck. Coordinator did not fabricate the missing
forced-race harness to paper over the gap; stated it plainly in the PR body instead.

PR: https://github.com/kimgranlund/agent-ui/pull/282 — mergeable, awaiting Kim.

## 🟢 CAMPAIGN COMPLETE (2026-07-26)

All three GH issues + the roadmap repair closed. Every slice built by one seat, reviewed by an
independent second seat in fresh context, and shipped only after a PASS — one review (#278's first
pass) caught real defects and forced a repair before the PASS that actually shipped.

| Issue | PR | Verdict |
|---|---|---|
| #273 | #279 — **MERGED** 2026-07-26T10:39:42Z | parity fix, whole-path proof verified by critic + coordinator |
| #278 | #280 — **MERGED** | fleet-wide sweep, 2 review cycles (FAIL→repair→PASS) |
| #276 | #282 — **MERGED** 2026-07-26T11:21:07Z | root-caused (A) not (B), critic upgraded the proof from trusted to structural |

## CLOSED (loop-rules decision: DONE) — 2026-07-26

All three PRs merged by Kim (PR merges are classifier-blocked for the coordinator under auto mode
throughout this campaign — every merge was a human action, correctly). Charter satisfied in full:
the entire known backlog at charter-bind time is clear. No open slice, no pending review, no branch
left unshipped. `docs-278-adr0156-aftermath` (the contaminated original branch, superseded by
`build-278-adr0156-aftermath`) may be deleted; it was never pushed.

### Campaign scoreboard at close

- **#273 — DONE, shipped.** PR #279 open against main, built + independently reviewed, gates 0/0.
- **#278 — BUILT, reviewed FAIL (narrow), 6 sites + 1 behavior question remain.** Branch clean and
  gate-green; not shippable until S1c lands, because the acceptance clause is not yet met.
- **#276 — NOT STARTED.** Zero work performed; diagnosis brief prepared and sharpened.
- Roadmap repair — DONE, inside `438469f`/`6f19bb1`.

## Deferred / surfaced, not in charter

- Wider `ui-app-shell` precedent drift → became S1b (above).
- `packages/agent-ui/app/src/controls/app-shell/__screenshots__/` — two stale, gitignored visual
  baseline dirs survived the PR #268 folder removal on local disk. Harmless to git. Not removed.
- `roadmap.md`'s "Last synthesis pass: 2026-07-25" header left while §2 reads "as of 2026-07-26" —
  deliberate (a targeted repair is not a synthesis pass). Surfaced for Kim, not changed.
