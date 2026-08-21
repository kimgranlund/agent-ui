<!-- target-path: .claude/ops/plan.md -->
# Ops plan — agent-ui

- **Dispatch**: 2026-08-21T11:20:00Z sweep firing (chore-planner, /sweep-chores, sweep mode —
  seat findings attached for all four lanes: decision-watcher Forward + Revalidation,
  issue-sorter, repo-cleaner; judged exactly those, nothing refetched).
- **Evidence**: attached seat findings + durable ops state as applied this firing
  (`adr-queue.json` 3 new harvest rows · `revalidation-queue.json` NEW, 1 falsified row ·
  `revalidation-checkpoint.json` cursor 5→10 of 219 · `watch-checkpoint.json` advanced ·
  `reports/2026-08-21T112000Z-repo-cleaner.md`) + the prior plan (2026-08-20T22:43:58Z compose,
  carry-forward only).
- **UNMEASURED**: live `gh` not consulted this firing (sweep mode — seat evidence only). The one
  live-state carry (upstream nonoun-plugins#46) rides its 2026-08-20T22:43Z verification and is
  treated as still OPEN per the safer default.
- **Corrections vs the prior plan**: prior 1.1 DONE — commit `b844ed2f` landed the 22:43Z ops
  state; superseded by this firing's 1.1. Prior 3.1 DONE — Kim ran both approved `/make-pack`
  harvests (component-patterns gained the ADR-0227 shared-state-grammar row, `e6e0e352`;
  a2ui-payload-authoring's Button entry gained ADR-0226 icon/iconOnly, `20004cd3`); the
  adr-0226/0227 queue rows drained, replaced this firing by the 0228/0229/0107 bundle (new 3.1).
  Prior 4.1 (#46 pin) carries forward. No entry dropped as parked — no carried id shows a
  `backlog`/`roadmap` label in evidence.
- **needs-ruling lane**: none — issue-sorter fully clean, nothing to mint or hold, checkpoint
  advanced.
- **Blocked-by convention (#193)**: no literal `Blocked-by:` line in any evidence this firing.
  3.1's internal confirm-before-run ordering is stated inside the entry itself.
- **Verdict**: active pass — three new items queued. Decision-watcher's Forward mode minted a
  3-row harvest bundle (adr-0228/0229/0107 → ONE mint-vs-compose extension) and its Revalidation
  mode produced this repo's first FALSIFIED claim (adr-0007, amendment-shaped fix); repo-cleaner's
  git surface is fully clean but flags one uncommitted `.claude/settings.json` diff for host
  disposition; intake fully clean, third consecutive firing.

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## 1. Gated mutations already verified safe

### 1.1 Land this firing's ops state — one commit, ops paths ONLY (dispatching host; 5 min)
- **Action**: apply this plan's payload, then `git add` exactly this firing's ops paths —
  `adr-checkpoint.json`, `adr-queue.json`, `revalidation-checkpoint.json`,
  `watch-checkpoint.json` (all modified), `revalidation-queue.json` (new),
  `reports/2026-08-21T112000Z-repo-cleaner.md` (new), plus this plan — and commit on `main`.
  Do NOT stage `.claude/ops/sweep-in-flight.json` (this sweep's own live marker — leave until
  the sweep concludes) and do NOT stage `.claude/settings.json` (its disposition is entry 3.2,
  never a rider on the ops commit).
- **Owner**: dispatching host (the ops-write split's dispatching session).
- **Evidence**: ops-write-sandbox-rules (dispatcher applies + lands payloads); `git status` this
  firing shows exactly those paths dirty/untracked plus the in-flight marker and settings.json.
- **Size**: 5 minutes.

## 2. Blocking other work

(none — repo-cleaner: 0 open PRs, no orphaned worktrees/branches, primary in sync with main; no
entry blocks another.)

## 3. Human-decision items

### 3.1 Confirm + run the mint-vs-compose harvest bundle — adr-0228 + adr-0229 + adr-0107 Am.4 as ONE `/make-pack` extension (Kim; ~1 h)
- **Action**: three freshly queued `adr-queue.json` harvest rows, decision-watcher-recommended
  as a SINGLE bundle: extend `component-design/references/mint-vs-compose.md`'s existing
  "smallest-floor scoping test" lineage (currently ADR-0107 → ADR-0205 → ADR-0219, 3 instances)
  with the charts arc as the 4th instance — adr-0228's `controls/_chart/` shared axis subsystem
  mint, adr-0229's ui-column-chart/ui-gauge mint + ui-line-chart axes extension (with its three
  rejected alternatives), and adr-0107 Amendment 4's fence-rows-REALIZED record (the lineage
  prose goes stale the moment 0228/0229 are judged in). Two steps: (a) host surfaces the batch
  confirm (AskUserQuestion — approve the bundle-as-one, or split); (b) on approval Kim runs
  `/make-pack .claude/skills/component-design` herself — the command is
  disable-model-invocation, the host cannot fire it. Decision-watcher's next firing drains the
  three rows once the extension lands.
- **Owner**: Kim (confirm + the run) · dispatching host (surfaces the confirm).
- **Evidence**: `adr-queue.json` (3 `harvest` rows, queued 2026-08-21T11:20:00Z);
  decision-watcher Forward findings this firing (no existing skill/reference cites adr-0228 or
  adr-0229, checked against origin/main).
- **Size**: ~1 hour (one bundled doc-seat run) + 2 minutes for the confirm.

### 3.2 `.claude/settings.json` uncommitted diff — commit or discard, host's call (host/Kim; 5 min)
- **Action**: decide the disposition of the standing uncommitted diff (reorders
  extraKnownMarketplaces; swaps `screens@nonoun-plugins` → `frontend@nonoun-plugins` in
  enabledPlugins): commit it as an intentional settings change, or discard it as drift. Note
  repo-cleaner's hypothesis that it may relate to the recurring #1576 defect
  (screens:component-checker plugin-load failures in worktrees) — if intentional, the commit
  message should say whether it addresses #1576 or is unrelated.
- **Owner**: owning session's host (Kim's settings, Kim's call).
- **Evidence**: repo-cleaner finding this firing
  (`reports/2026-08-21T112000Z-repo-cleaner.md` — flagged as data, not actioned); `git status`
  shows ` M .claude/settings.json` on main.
- **Size**: 5 minutes.

## 4. Hygiene debt

### 4.1 ADR-0007 body Amendment — Revalidation FALSIFIED claim, first ever on this repo (host drafts, Kim ratifies; ~30 min + ratify)
- **Action**: draft an Amendment on ADR-0007 (append-only Decision text stays untouched) stating
  in body prose what the frontmatter Superseded-by cell already records: of the Decision's
  claimed universal-`*`-selector ramp tokens `--ui-{height,font,gap}-{sm,md,lg}`, only the
  gap leg (plus typescale-size/space-*) still lives on `*`; the height/font/icon control-band
  legs moved to `:root` + per-`[scale]` literal lookup tables under ADR-0038. Then Kim ratifies
  the amendment (real ratify comment — the flip is owner-only). The queue row's owner field is
  `unassigned` (unattended firing, no-fabricated-name rule) — this plan assigns it. Note: the
  amendment ADDS body bytes, so the nonoun-plugins#46 no-byte-change hash gap (4.2) does not
  bite here.
- **Owner**: dispatching host (draft the amendment) · Kim (ratify).
- **Evidence**: `revalidation-queue.json` (claim adr-0007, kind `falsified`, queued
  2026-08-21T11:20:00Z); decision-watcher Revalidation findings — current
  `packages/agent-ui/shared/src/tokens/dimensions.css` vs ADR-0007's Decision prose.
- **Size**: ~30 minutes to draft; Kim's ratify is a one-comment step.

### 4.2 nonoun-plugins#46 — ratify-only-flip hash gap; pin stands (upstream lane; 0 min here)
- **Action**: carried forward, NOT re-verified this firing (sweep mode — treated as still OPEN;
  last live-verified OPEN 2026-08-20T22:43Z). INTERIM PIN unchanged: when Kim ratifies an
  amendment on an already-`accepted` ADR with no body-byte change, the host re-dispatches
  decision-watcher with an explicit "re-judge adr-00NN amendment" instruction. Pin stays until
  #46 closes.
- **Owner**: nonoun-plugins upstream (the script fix) · dispatching host (the pin, per firing) ·
  Kim (unparking the upstream bundle).
- **Evidence**: prior plan 4.1; live `gh issue view 46 -R kimgranlund/nonoun-plugins` → OPEN as
  of 2026-08-20T22:43Z (stale by one firing, safer-default open).
- **Size**: 0 minutes here; small tooling task upstream.

## Standing notes (not queue entries)

- **Revalidation mode second run**: cursor 5→10 of 219 (denominator grew 217→219 with the two
  new ADRs); adr-0006/0008/0009/0010 CONFIRMED (adr-0009's `--ui-focus-ring-*` →
  `--md-sys-state-focus-ring-*` rename judged not-a-falsification, mechanism unchanged);
  adr-0007 is the mode's first FALSIFIED — queued at 4.1.
- **Intake fully clean, third consecutive firing**: issue-sorter 0 mints/0 holds — #1561,
  #1563–#1576 all properly minted by the trusted sole author; checkpoint advanced.
- **Hygiene git surface fully clean**: 0 open PRs, no orphaned worktrees/branches, primary in
  sync with main; the one finding is the settings.json diff (entry 3.2).
- **Dirty `main` markers**: `.claude/ops/sweep-in-flight.json` (this sweep's own live marker —
  leave until the sweep concludes) and `.claude/settings.json` (entry 3.2, host's call).
- **gitignore G1 noise** (6 stale rules): standing Kim-ruled keep-list, never re-proposed.
- **gen-ui-kit**: out of this board's scope (dedicated session per Kim's ruling).

*Composed by chore-planner, 2026-08-21T11:20:00Z sweep firing — returned as payload per the #125
ops-write split; written and landed by the dispatching session.*

Dispatch: 2026-08-21T11:20:00Z
