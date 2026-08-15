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
- Wave 1 (mechanical renames): EMPTY — all renames killed at kill-switch (family-consistency +
  seat-name blast radius + #197 precedent); all 34 names grandfathered
- Wave 2 (knowledge extraction + trim): 11 seeds W2-1…W2-11 — PENDING Gate A
- Wave 3 (contested): 3 rows W3-1…W3-3 — PENDING Gate A

## Emergent-item queue

| # | evidence | blocker shape | proposed solution | intake route | status |
|---|---|---|---|---|---|
| E1 | naming-audit `validate.py` crashes `TypeError: unhashable type: 'dict'` when author_registry holds structured entries (line 122); manifest-authoring says "populate from committers" with no format stated | tooling defect (upstream authorkit) | coerce/validate manifest shape and fail with a clean message; document the string format in MANIFEST-TEMPLATE | `gh issue create` on the authorkit plugin repo | queued → Gate A |
| E2 | `check-routing` runs plugin trigger-eval suites only; this non-plugin estate (6/28 skills carry evals/) gets UNMEASURED routing proofs in Phase 6 | capability gap (upstream harness) | an estate-mode target (or per-skill eval discovery) so project estates get routing proofs | `gh issue create` on the harness plugin repo | queued → Gate A |

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
