<!-- target-path: .claude/ops/plan.md -->
# Ops plan — agent-ui

- **Dispatch**: 2026-08-13 (chore-planner, sweep-6 — focus "#829, #830, #831"; seat-reuse mode).
  Written and landed by the host per the #125 ops-write split, WITH landing-time amendments —
  the payload composed mid-flight and three of its entries resolved before landing (below).
- **Live state at LANDING (host-verified, post-amendments)**: 2 open issues — #829 (bug, diagnosis
  in flight) · #830 (task, repair MERGED as PR #839 + judged PASS-5; the judged re-import is the
  host's in-progress leg) — #831 CLOSED (PR #840 merged) · 0 open PRs · origin main-only.
- **Corrections vs the prior plan (decision-watcher + planner catches, landed)**: the stale
  "#696 awaits Kim's flip" line dropped (ratified 01:57Z, built PR #826, tracker #821 closed);
  ADR-0078's second amendment ratified 12:40Z and its caption-wall follow-up ALREADY SHIPPED
  (PR #828 — the payload's §4.1 "verify it didn't already ship" resolves to: it did).
- **Verdict**: hygiene fully clean (all 14 flagged branches already reaped, 1:1 merged-PR
  mapping); the board is two in-flight lanes; the sweep's bookkeeping lands with this commit.

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## 1. Gated mutations already verified safe

(none.)

## 2. Blocking other work

### 2.1 Track the in-flight #829 / #830 lanes to close (host; hours)
- **State at landing**: #831 CLOSED (PR #840 — the authoring-teaching reconciliation; regex pins
  preserved, baselines no-op). #830's repair MERGED (PR #839 — the List-template bind + pager
  readback + honest description; fresh judge verdict PASS qualityScore 5, all dims, incl. the
  shard's first absolute `${/…}` interpolation outside item scope) — REMAINING: the judged
  re-import (host leg, in progress: the two-record VerdictsFile incl. stats-grid's re-issued
  REJECT, then `import-seeds --verdicts`, allowlist entry deletion per its own instruction,
  close #830). #829 diagnosis in flight (build-lead, isolated worktree); on its return:
  verify-before-merge and pixel-check the operator checkout before closing (pixel-truth).
- **Owner**: the #829 build-lead · host (the #830 import + all merges).

## 3. Human-decision items

### 3.1 builder-builtin-section-update.lld.md status — RESOLVED (landed b26f02ac)
- **Finding**: the payload carried this unverified; it was ALREADY ruled and flipped at the
  2026-08-13 close-session confirm round (Kim's in-chat ruling; commit b26f02ac — status
  `accepted (shipped) · v0.2`, the gating clause resolved by ADR-0178's ratified Amendment).
- **Owner**: RESOLVED — no further action.

## 4. Hygiene debt

### 4.1 ADR-0078-amendment caption-wall follow-up — RESOLVED, already shipped
- **Finding**: shipped BEFORE this sweep composed — PR #828 (the #827 booked-repairs wave,
  merged ~13:0xZ): the structured-container mini-skill teaches `Text(variant:'label')`, the
  caption wall retired, its selection test pins the ratified arm, baselines recaptured. The
  payload's UNMEASURED status resolves to done.
- **Owner**: RESOLVED — no further action.

### 4.2 This sweep's landing leg — RESOLVED (this commit)
- **Finding**: plan.md written (this payload+amendments) · watch-checkpoint advanced to
  2026-08-13T16:28:38Z · `adr_checkpoint.py advance` run (185 ADRs; post-advance classify
  clean — the sweep-6 judgments recorded: adr-0178-amendment YES-harvest, adr-0078-second-
  amendment NO, adr-0186 NO, adr-0025 superseded/zero-citation-debt) · the STRANDED
  adr-0178-amendment harvest row re-landed into `adr-queue.json` (1 pending candidate — the
  authorship-scoped re-ruling pattern; awaits a normal save-lessons confirm round, not urgent).
- **Owner**: RESOLVED.

## Standing notes (not queue entries)

- **Board shape (this landing)**: #829 + #830 in flight (→2.1) · 0 open PRs · main + the #829
  build-lead's worktree · origin main-only.
- **adr_ratify.py amendment-mode cosmetic (3-for-3: ADR-0179/0178/0078)**: the heading flips to
  "ratified" but the guard blockquote below keeps reading "proposed" — deliberate script scope,
  not a bug (decision-watcher standing note); widening the flip = a Kim ruling + small tooling
  task, never self-authorized.
- **Branch reaping is near-instant here** — merged-PR branches are `[deleted]` on origin by
  delete-on-merge; future sweeps needn't 1:1 re-verify an already-clean merged-branch list.
- **nonoun-plugins cross-repo encoding**: PARKED (Kim, 2026-08-13 batched confirm; revisit =
  next nonoun-plugins session).
- **gen-ui-kit (0.8.35)**: with its dedicated session per Kim's ruling — out of this board's
  scope (last known: PR #1173 CI-green awaiting Kim's admin merge, then release-pack --go).
- **gitignore KEEP-LIST fence is permanent** — 7 standing G1 warnings, never re-propose.
- **held-items.md**: empty since first firing — nothing trust-gated.
- **`.claude/ops/` is git-tracked** — landing legs end in commit+push, not just a write.

*Composed by chore-planner (sweep-6, seat-reuse mode), 2026-08-13; landing-time amendments by
the host (three entries resolved mid-flight) — written and landed per the #125 ops-write split.*
