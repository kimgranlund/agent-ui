# Overhaul run — 2026-08-14

Driver: `authorkit:overhaul-execute` · target argument: `.claude/*` · run surface: background
session, worktree `overhaul-2026-08-14`.

## Scope table (Phase 0)

| root | markers found | classification | recommended | why |
|---|---|---|---|---|
| `agent-ui/.claude/` | 28 `skills/*/SKILL.md`, 6 `agents/*.md`, 4 `hooks/*`, `settings.json`, `docs/`, `ops/`; NO `naming.manifest.json`; no `.claude-plugin/plugin.json` | ungoverned candidate | IN | the argument names exactly this tree and it carries a full skill+agent estate with no governance manifest |

Noise (auto-excluded, pruned at scan time): `node_modules/`, `.git/`, `dist/`, `.claude/worktrees/`.

## Gate outcomes

- Gate 1 (scope confirm): APPROVED live 2026-08-14 — "IN — full estate". Ungoverned → manifest-authoring runs before measurement.
- Gate A (findings + wave map): not reached
- Gate B (premise change): not reached

## Per-wave status

Plan: `.claude/overhaul-plan-2026-08-14.md` (fallback path; make-doc LLD route deliberately
not taken — campaign artifact, not a product LLD; named deviation).

- Wave 0 (merge/split): EMPTY — no nomination cleared the evidence bar
- Wave 1 (renames): Gate A AMENDED live — "rename all, the names are kind of garbage" superseded
  the plan's kill-all verdict. Re-rendered map (32 renames + lexicon/vocab edits) approved
  in-round; rename-execute's touched-file confirm approved live (103 files / 531 refs).
  EXECUTED 2026-08-14: validator errors=0, exemptions 34 → 1 (example-authoring-agent);
  fix-old-names sweep 0 live stale (5 verified false-positive `orchestrator` prose hits left;
  2 off-plan .github template pointers fixed — under Gate-B trigger-3's divergence bound).
  Landed: PR #924 (draft) on worktree-overhaul-2026-08-14. Merge is the human's.
- Wave 2 (knowledge extraction + trim): 11 seeds APPROVED at Gate A, minted as issues
  #925–#935, each Blocked-by PR #924's merge — builds dispatch after the rename wave lands,
  never before (wave-order edge). No build-lead dispatches this run by design.
- Wave 3 (contested): ruled "file as tasks, decide later" → #936 (W3-1 meta-line-facts
  retire-vs-slim), #937 (W3-2 description trim, blocked on routing proof), #938 (W3-3 —
  substituted: the residual example-authoring-agent exemption; the plan's original W3-3
  conforming-names question was RESOLVED by the rename-all ruling).

## Gate B

Not fired — none of the four triggers tripped (off-plan discovery was 2 .github pointer
fixes; no new rename targets, no kill-switch flip, divergence 2 files < bound, no failed row).

## Emergent-item queue

| # | evidence | blocker shape | proposed solution | intake route | status |
|---|---|---|---|---|---|
| E1 | naming-audit `validate.py` crashes `TypeError: unhashable type: 'dict'` when author_registry holds structured entries (line 122); manifest-authoring says "populate from committers" with no format stated | tooling defect (upstream authorkit) | coerce/validate manifest shape and fail with a clean message; document the string format in MANIFEST-TEMPLATE | `gh issue create` on the authorkit plugin repo | queued → Gate A |
| E2 | `check-routing` runs plugin trigger-eval suites only; this non-plugin estate (6/28 skills carry evals/) gets UNMEASURED routing proofs in Phase 6 | capability gap (upstream harness) | an estate-mode target (or per-skill eval discovery) so project estates get routing proofs | `gh issue create` on the harness plugin repo | queued → Gate A |

Gate-A outcomes: E1 APPROVED → claude-plugins#252 · E2 APPROVED → claude-plugins#253.

## Phase 6 — burn-down + verdict

- Routing proof: **UNMEASURED**, named — harness check-routing has no non-plugin estate mode (E2/#253).
- naming-audit scoreboard: baseline errors=0/exemptions=**34** → now errors=0/exemptions=**1**.
- Degraded/deviated steps, all named: plan doc at fallback path (make-doc LLD route deliberately
  not taken); product code + byte-pinned corpus data + frozen doc history out of rename plan by
  design; session-memory history not rewritten (translation-map memory added instead); W2 builds
  deferred behind PR #924's merge.
- Verdict: 🟢 estate — wave 1 landed gate-green; 🟡 awaiting human: PR #924 merge, then W2
  dispatches (#925–#935) and W3 rulings (#936–#938).

## Close-out (2026-08-15, post-execution)

- Wave 1: PR #924 MERGED (Kim, 01:26Z).
- Wave 2: #925–#928 built by this session's seats → PRs #939–#942 MERGED. #929–#933 built by a
  concurrent board-clear session's folded campaign → PR #943 MERGED (lane split resolved via
  claim-race discipline, note on #930; two duplicate dispatches from this side stood
  down/stopped pre-commit, zero divergent work). #934–#935 remain with that campaign's live
  chore/w2-c-934-935 worktree (active uncommitted work verified at reclaim-check time;
  deliberately NOT reclaimed).
- Wave 3, Kim's live rulings: #936 RETIRE a2ui-meta-line-facts · #937 HOLD for routing proof
  (open, blocked on claude-plugins#253) · #938 rename example-standards → example-authoring.
  Executed as PR #944, MERGED; #936/#938 closed.
- Final burn-down: naming exemptions 34 → 0; validator 33 artifacts, errors=0, warnings=0.
- Residual open: #934, #935 (peer campaign), #937 (held by design). Upstream: claude-plugins
  #252, #253.

## Baselines (Phase 1)

- Governance: `.claude/naming.manifest.json` seeded 2026-08-14 (live-confirmed): scope=grammar,
  brand tokens agent-ui/a2ui/agent-admin, +12 ObjectVocab tokens, 34 exemptions enumerated
  verbatim from the first audit. Validator on landed file: exit 0.
- naming-audit baseline: 34 artifacts · errors=0 · warnings=0 · **exemptions=34** (burn-down starts here).
  Underlying violation classes: 27× terminal-not-in-lexicon, 10× brand-token-in-name (a2ui),
  6× agent-missing--agent-suffix, 1× skill-object unresolved.
- bloat-audit baseline: 34 files scanned · **31 flagged** · 1 duplicate pair · est. recoverable
  784 chars (script-conservative). Flag classes: long-body ×17 (6.7k–21.6k chars, threshold 6k),
  dense-description ×20 (701–1712 chars), phase-heavy ×13 (5–14 phase headings).
  Duplicate pair: agents/a2ui-builder.md ↔ skills/a2ui-build/SKILL.md (sim 0.5 — the seat/skill pair).
