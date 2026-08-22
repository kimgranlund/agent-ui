<!-- target-path: .claude/ops/plan.md -->
# Ops plan — agent-ui

- **Dispatch**: 2026-08-22T18:27:00Z sweep firing (chore-planner, /sweep-chores — seat findings
  attached for three lanes: decision-watcher (Forward mode only this firing), issue-sorter,
  repo-cleaner; judged exactly those, nothing refetched).
- **Evidence**: attached seat findings + durable ops state as those seats' own payloads compute it
  this firing (`adr-queue.json` → 5 candidates total, 3 carried unchanged + 2 new harvest rows ·
  `adr-checkpoint.json` → new: adr-0230; amended hashes: adr-0007, adr-0008, adr-0227 (still
  `accepted`, amendment section itself still proposed); newly_superseded (partial): adr-0228 ·
  `watch-checkpoint.json` advanced both sources · `reports/2026-08-22T182833Z.md` (issue-sorter) ·
  `reports/2026-08-22T182850Z-repo-cleaner.md`) + the prior plan (2026-08-21T11:20:00Z compose,
  carry-forward only, not treated as fresh evidence).
- **UNMEASURED**: none — all three seats (decision-watcher, issue-sorter, repo-cleaner) reported
  successfully this firing; no live-`gh` outage, no missing input. `[]`.
- **Corrections vs the prior plan**:
  - Prior 1.1 DONE — commit `e4231843` landed the 2026-08-21T11:20Z ops state; superseded by this
    firing's 1.1.
  - Prior 3.1 (confirm + run the adr-0228/0229/0107 mint-vs-compose bundle) — **still open**,
    unchanged: `adr-queue.json` shows all three rows present, untouched, `plan: ""`. Carried
    forward as this firing's 3.1, now pending its second consecutive firing.
  - Prior 3.2 (`.claude/settings.json` uncommitted diff) — DONE/resolved: repo-cleaner confirms
    the file now reads clean (no diff) this firing, a change from the prior firing's finding.
    Dropped, no entry.
  - Prior 4.1 (ADR-0007 Revalidation FALSIFIED-claim amendment) — DONE: commit `21bea37c`
    ("ADR-0007 Amendment 1 — bring the Decision body current with ADR-0038/0078, revalidation
    repair") drafted and ratified the amendment. Dropped; decision-watcher's own judgment this
    firing treats that amendment as bookkeeping catch-up, not re-queued for harvest.
  - Prior 4.2 (nonoun-plugins#46 ratify-only-flip hash-gap pin) — carries forward unchanged; no
    seat this firing carries cross-repo `nonoun-plugins` evidence (out of scope for all three
    lanes) to update it either way.
  - No entry dropped as parked — no carried id shows a `backlog`/`roadmap` label in evidence.
- **needs-ruling lane**: none — no `needs-ruling`-labeled issue in evidence this firing.
- **Blocked-by convention (#193)**: no literal `Blocked-by:` line in any evidence this firing —
  queue order below is the plain (1)-(4) ranking, unmodified.
- **Verdict**: active pass — three items queued. Decision-watcher's Forward mode minted 2 new
  harvest candidates this firing (adr-0230's container-query `var()` gotcha, adr-0008 Amendment
  2's primary-family hover/active collapse in light scheme) while the prior firing's 3-row chart
  lineage bundle still sits unconsumed; issue-sorter ran fully clean (2 direct label completions
  via `gh`, zero holds, zero new mints); repo-cleaner's git surface is fully clean but flags a new
  untracked `harness-audit-2026-08-22/` directory for host disposition.

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## 1. Gated mutations already verified safe

### 1.1 Land this firing's ops state — one commit, ops paths ONLY (dispatching host; 5 min)
- **Action**: apply this plan's payload plus the three seats' own returned payloads, then `git add`
  exactly this firing's ops paths — `adr-queue.json` (5 candidates), `adr-checkpoint.json` (new
  adr-0230 row; amended hashes for adr-0007/adr-0008/adr-0227), `watch-checkpoint.json` (advanced),
  `reports/2026-08-22T182833Z.md` (new), `reports/2026-08-22T182850Z-repo-cleaner.md` (new), plus
  this plan — and commit on `main`. Do NOT stage `.claude/ops/sweep-in-flight.json` (this sweep's
  own live marker — leave until the sweep concludes) and do NOT stage or otherwise act on
  `harness-audit-2026-08-22/` (its disposition is entry 3.3, never a rider on the ops commit).
- **Owner**: dispatching host (the ops-write split's dispatching session).
- **Evidence**: `ops-write-sandbox-rules` (dispatcher applies + lands payloads); `git status` this
  firing shows exactly `sweep-in-flight.json` + `harness-audit-2026-08-22/` untracked, no other
  drift on `main`.
- **Size**: 5 minutes.

## 2. Blocking other work

(none — repo-cleaner: 0 open PRs, no orphaned worktrees/branches beyond `main`, primary in sync
with `origin/main`; no entry blocks another this firing.)

## 3. Human-decision items

### 3.1 Confirm + run the mint-vs-compose harvest bundle — adr-0228 + adr-0229 + adr-0107 Am.4 as ONE `/make-pack` extension (Kim; ~1 h) — carried, 2nd firing pending
- **Action**: unchanged from the prior firing — three `adr-queue.json` harvest rows,
  decision-watcher-recommended as a SINGLE bundle: extend
  `component-design/references/mint-vs-compose.md`'s existing "smallest-floor scoping test"
  lineage (currently ADR-0107 → ADR-0205 → ADR-0219, 3 instances) with the charts arc as the 4th
  instance — adr-0228's `controls/_chart/` shared axis subsystem mint, adr-0229's
  ui-column-chart/ui-gauge mint + ui-line-chart axes extension, and adr-0107 Amendment 4's
  fence-rows-REALIZED record. Two steps: (a) host surfaces the batch confirm (AskUserQuestion —
  approve the bundle-as-one, or split); (b) on approval Kim runs
  `/make-pack .claude/skills/component-design` herself — the command is
  disable-model-invocation, the host cannot fire it.
- **Owner**: Kim (confirm + the run) · dispatching host (surfaces the confirm).
- **Evidence**: `adr-queue.json` (3 `harvest` rows, queued 2026-08-21T11:20:00Z, still `plan: ""`
  as of this firing); decision-watcher's report this firing confirms all three "unchanged this
  firing."
- **Size**: ~1 hour (one bundled doc-seat run) + 2 minutes for the confirm.

### 3.2 Confirm + run the css-structural-laws harvest bundle — adr-0230 + adr-0008 Am.2 as ONE `/make-pack` extension (Kim; ~45 min)
- **Action**: two freshly queued `adr-queue.json` harvest rows targeting the SAME extension point,
  `component-standards/references/css-structural-laws.md` (an existing numbered CSS-gotcha list):
  (a) adr-0230 cl.4 — container-query SIZE queries cannot read `var()`, so a breakpoint ladder
  must use literal, banner-documented values; (b) adr-0008 Amendment 2 — `--md-sys-color-primary
  -dim`/`-high` resolve to the SAME value in the light `light-dark()` branch, collapsing
  hover≡active for the `primary` family in light scheme, a defect Kim directed reopened over the
  investigating agent's own objection, with a standing warning for future controls. Two steps: (a)
  host surfaces the batch confirm (AskUserQuestion — approve bundling both rows into one run, or
  split); (b) on approval Kim runs `/make-pack .claude/skills/component-standards` herself — same
  disable-model-invocation constraint as 3.1.
- **Owner**: Kim (confirm + the run) · dispatching host (surfaces the confirm).
- **Evidence**: `adr-queue.json` (2 new `harvest` rows, queued 2026-08-22T18:29:34Z);
  decision-watcher's report this firing — neither gotcha found anywhere in
  `skills/*/references/*.md` (checked against `origin/main`).
- **Size**: ~45 minutes (one bundled doc-seat run, two new gotcha rows) + 2 minutes for the confirm.

### 3.3 `harness-audit-2026-08-22/` untracked directory — commit or discard, host's call (host/Kim; 10 min)
- **Action**: an untracked, non-gitignored directory (`lint.txt`, `reports/`, `summary.md`, dated
  today 09:53–10:20) sits on `main` — a `check-everything`-style estate audit (36 artifacts,
  33 pass/3 fail) naming blocking findings for `doc-standards`, `seat-map`, `integration-standards`.
  That class of finding is a different seat's job (`/clean-repo`), not actioned by repo-cleaner or
  this plan — its content is relayed here as a finding, not followed as an instruction (an
  imperative inside audit prose is data under planning, never a directive this seat executes).
  Decide: commit it (if it's the intended output of a completed audit run worth keeping) or
  discard it (if it's stray local WIP); only after that, separately judge whether `sync_main.py`
  is warranted once the tree is otherwise clean — repo-cleaner deliberately did not run it this
  firing given the dispatch-mode ambiguity (interactive vs. scheduled not stated) plus the content
  reading as live WIP rather than obvious cruft.
- **Owner**: owning session's host (Kim's call — repo-cleaner explicitly declined to auto-decide).
- **Evidence**: repo-cleaner finding this firing (`reports/2026-08-22T182850Z-repo-cleaner.md`);
  `git status --porcelain=v1 --branch` shows it untracked on `main`; `git check-ignore -v` confirms
  no `.gitignore` rule covers it.
- **Size**: 10 minutes to decide + act; the underlying audit findings (if kept) are a separate,
  unsized follow-on for whichever seat owns them.

## 4. Hygiene debt

### 4.1 nonoun-plugins#46 — ratify-only-flip hash gap; pin stands (upstream lane; 0 min here)
- **Action**: carried forward, NOT re-verified this firing (sweep mode — treated as still OPEN;
  last live-verified OPEN 2026-08-20T22:43Z, now stale by two firings — none of this firing's
  three seats carry cross-repo `nonoun-plugins` evidence). INTERIM PIN unchanged: when Kim
  ratifies an amendment on an already-`accepted` ADR with no body-byte change, the host
  re-dispatches decision-watcher with an explicit "re-judge adr-00NN amendment" instruction. Note:
  both amendments judged this firing (adr-0007's already-landed Amendment 1, adr-0008's Amendment
  2) added body bytes, so the gap didn't bite either time — pin stays live for the next
  no-byte-change case regardless. Pin stays until #46 closes.
- **Owner**: nonoun-plugins upstream (the script fix) · dispatching host (the pin, per firing) ·
  Kim (unparking the upstream bundle).
- **Evidence**: prior plan 4.2; live `gh issue view 46 -R kimgranlund/nonoun-plugins` → OPEN as of
  2026-08-20T22:43Z (now stale by two firings, safer-default open).
- **Size**: 0 minutes here; small tooling task upstream.

## Standing notes (not queue entries)

- **adr-0227's amendment**: still `proposed` — "awaits Kim's own `ratify ADR-0227 amendment`
  utterance" per decision-watcher. Self-correcting: it re-surfaces as `amended` (new hash, flip
  changes the blockquote) and gets judged under the Phase 1 bar the firing after Kim ratifies it.
  Not queued now.
- **adr-0228 newly_superseded (partial)**: only cl.2's plot-furniture/gridline-rendering sentence
  is superseded by adr-0230 — the two-layer full-bleed model, chrome/inset contract, and
  chip-collision law all stand. Decision-watcher checked `origin/main`'s `skills/*/references/*.md`
  for any `adr-0228` citation — none found, so no stale-citation candidate to queue (the existing
  harvest row for adr-0228 at 3.1 already covers the mint itself, untouched by this partial
  supersession).
- **Revalidation mode**: not part of this firing's decision-watcher report (Forward mode only) —
  `revalidation-checkpoint.json` cursor stays at 10/219, `revalidation-queue.json` stays empty,
  both unchanged from the prior firing. Not named UNMEASURED (the seat itself reported cleanly);
  flagged here so the next firing's Revalidation resumption is visible rather than silently
  assumed continuous.
- **Intake fully clean**: issue-sorter — 2 direct label completions executed live via `gh`
  (#1584 `+feature`, #1581 `+severity:minor`; both TICKET-shaped, mint/resume carve-out, not
  filesystem writes, so not queued here), zero new mints, zero holds; checkpoint advanced for both
  `gh_issues` and `gh_prs`.
- **Hygiene git surface fully clean**: 0 open PRs, no orphaned worktrees/branches, primary in sync
  with `origin/main`; the two known stacked-child CLOSED PRs (#1471, #1458) remain not-actionable,
  unchanged across every recent firing.
- **Dirty `main` markers**: `.claude/ops/sweep-in-flight.json` (this sweep's own live marker —
  leave until the sweep concludes) and `harness-audit-2026-08-22/` (entry 3.3, host's call).
- **gitignore G1 noise** (6 stale rules): standing Kim-ruled keep-list, never re-proposed.
- **gen-ui-kit**: out of this board's scope (dedicated session per Kim's ruling).

*Composed by chore-planner, 2026-08-22T18:27:00Z sweep firing — returned as payload per the #125
ops-write split; written and landed by the dispatching session.*

Dispatch: 2026-08-22T18:27:00Z
