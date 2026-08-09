# Ops plan — agent-ui

- **Dispatch**: 2026-08-09, fifth sweep of the day (chore-lead fan-out; three seat reports
  attached — decision-watcher, issue-sorter, repo-cleaner; nothing refetched). Prior plan (fourth
  sweep) read as carry-forward source.
- **Seats**: decision-watcher 🟢 (177/177 ADRs; one flip — adr-0178 proposed→accepted; impact
  detector fired; one harvest candidate queued in `adr-queue.json`, confirm gate correctly
  deferred to a human round) · issue-sorter 🟢 (3 open issues unchanged and correctly classified,
  0 open PRs, zero holds; payload = checkpoint timestamp bump only) · repo-cleaner 🟢 (worktrees:
  main checkout only, clean, even with origin/main; branches: main only both sides; 0 open PRs;
  the 4 fetch-pruned refs confirmed cleanly-merged non-survivors, not #613-class; gitignore's 8
  G1 warnings RECLASSIFIED as Kim-ruled KEEP-LIST permanent noise) — 3/3 returned, no UNMEASURED
  sections.
- **Supersedes**: the fourth 2026-08-09 plan; per-item disposition below.
- **Verdict**: steady-state — the repo's ops surface is fully drained. No gated mutations, no
  blockers. Open work: one human confirm-gate (the ADR-0178 harvest candidate), the recurring
  payload landing, and the carried cross-repo `chore-lead.md` encode.

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## Prior-plan disposition (fourth 2026-08-09 plan → this dispatch)

| Item | Fate |
|---|---|
| 1.1 reap worktree `agent-a76f2b0def232c02f` | **Retired — done** (was already closed in the prior plan; repo-cleaner re-confirms it absent this firing) |
| 3.1 Kim ratifies/returns ADR-0178 | **Resolved — ratified.** decision-watcher confirms the proposed→accepted flip; the follow-on it predicted fired on schedule (impact detector, harvest candidate queued). Successor entry: **3.1** below (confirm-gate the harvest) |
| 4.1 land sweep ops delta (recurring) | **Resolved for that sweep** (`7bed879`); **recurs** → **4.1** for this firing's payloads |
| 4.2 gitignore trim | **Retired PERMANENTLY.** The prior trim (`c4e043e5`) was reverted per Kim's explicit ruling (KEEP-LIST fence, main `87d38f1a`); repo-cleaner reclassified the 8 G1 warnings as standing warn-only noise. Never re-queue a gitignore-trim action — encoded in `rulings.md` |
| 4.3 encode rulings in `chore-lead.md` | **Carried** → **4.2** — no report or repo evidence it landed in nonoun-plugins |

## 1. Gated mutations already verified safe

(none this sweep — 0 open PRs; most recent merge #647 at 2026-08-09T18:14:21Z left no surviving
remote branch; `campaign_close.py` not needed; all pruned refs verified cleanly-merged.)

## 2. Blocking other work

(none this sweep — main clean and even with origin/main, no stranded lanes, no held approvals
blocking a seat. #616 remains an external upstream wait, not a queue blocker.)

## 3. Human-decision items

### 3.1 Confirm-gate the ADR-0178 harvest candidate (successor to the ratify item)
- **Action**: Kim (via an interactive AskUserQuestion round in a host session) confirms or
  declines the queued harvest: extend `.claude/skills/agent-ui-a2ui-meta-line-facts/SKILL.md` —
  NOT a new skill, per decision-watcher's placement ruling — with (a) a third worked-example
  subsection (ask-arm precedent → `personaPatch`; modality-gate seam → `surfaceAuthoring`) and
  (b) a new subsection stating the host-side apply-gate three-filter write discipline
  (enumerated-key filter → per-key sanitizer → `validateNewEntry`), the genuinely new axis. On
  confirm, the host executes via `/make-pack` or an inline SKILL.md edit and clears the
  `adr-queue.json` row in the same change.
- **Owner**: Kim (confirm) → host session (execute)
- **Evidence**: decision-watcher this firing — adr-0178 flipped to accepted, impact detector
  fired, candidate row in `.claude/ops/adr-queue.json` (kind `harvest`), citing
  `.claude/docs/adr/0178-agent-authoring-conversational-persona-hydration.md:65-163`.
- **Size**: ~5 min to confirm; ~25 min to execute the skill extension

## 4. Hygiene debt

### 4.1 Land this firing's ops-state delta (recurring) — DONE
- **Status**: closed by this dispatch's own close-out leg. Wrote `.claude/ops/adr-checkpoint.json`
  (adr-0178 hash/status updated to accepted, 177 other entries unchanged),
  `.claude/ops/adr-queue.json` (one new harvest candidate; queue was empty before),
  `.claude/ops/watch-checkpoint.json` (gh timestamps → 2026-08-09T18:46:23Z, status ok), and this
  `plan.md`. Commit + push is this session's next step.
- **Owner**: chore-lead's close-out (the landing leg, per `rulings.md` §"Seat-payload landing
  leg" — seats and planner return payloads; chore-lead writes)
- **Evidence**: the three seat payload declarations this firing; `rulings.md`.

### 4.2 Encode the landing-leg + evidence-write-back rulings into `chore-lead.md` (cross-repo, carried ×2)
- **Action**: one change in the harness plugin (nonoun-plugins repo): `chore-lead.md` gains
  (a) the close-out landing leg (seats return payloads; chore-lead writes `.claude/ops/` before
  reporting up) and (b) evidence write-back ownership (chore-lead posts dated tracker comments
  from seat evidence) — both ruled 2026-08-09, both still enforced only via dispatch-prompt text.
- **Owner**: host session in the nonoun-plugins repo (not doable from this checkout)
- **Evidence**: `rulings.md` §"Seat-payload landing leg" + §"Evidence write-backs"; second
  consecutive sweep with no landing evidence.
- **Size**: ~20 min

## Standing notes (not queue entries)

- **ADR-0178 is ACCEPTED** — the #633 arc's design contract is ratified; #633 and #634 both
  CLOSED via merged #647/#641. The arc's residue is dev-side: #638 (booked repairs, partially
  drained) stays a correctly-classified dev-backlog task, not ops debt.
- **#644** — fresh bug (agent-admin PROSE arm shared #history, size:small, filed 2026-08-08) —
  dev backlog, correctly classified, not ops debt.
- **#616 upstream-gated, unchanged** every sweep (a2ui-project/a2ui#2150) — external wait;
  re-enters ops scope only if the gate lifts and it stalls.
- **gitignore KEEP-LIST fence is permanent** — the 8 G1 "matches nothing" warnings are Kim-ruled
  standing noise (main `87d38f1a`, trimmed then reverted on his explicit ruling). No future sweep
  proposes a trim; `gitignore_check.py` exit 0 is the whole gate.
- **friendlies.json and held-items.md unchanged**; everything this window authored by the sole
  friendly; zero holds.
- Executed-this-sweep actions (ADR scan, `git fetch --prune` by the dispatcher, checkpoint reads)
  are recorded in the seat reports, not re-queued.

*Written by chore-planner, 2026-08-09 fifth sweep. Landed by chore-lead's close-out per the
landing-leg ruling.*
