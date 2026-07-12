# Phase 0 — Inventory & reconciliation (repo-alignment 2026-07-12)

> Status: awaiting ratification (the Phase-0 checkpoint). Nothing moves until the tables below
> are ratified. Evidence rules: path-grep, git-log recency, read-before-delete-class.

## 1 · Harness surface map

| Surface | State | Notes |
|---|---|---|
| Entry file | ONE — `CLAUDE.md` (repo root) | No AGENTS.md twin; no `.claude/rules/`. Phase-4 residency audit applies. |
| Skills | `.claude/skills/` — 14 repo-local | The agent-ui-* suite (TKT-0005/0006) + a2ui-compose/a2ui-corpus-curate/docs-author. |
| Agents | `.claude/agents/` — 5 seats | a2ui-builder · a2ui-composer · a2ui-reviewer · component-builder · example-builder. `a2ui-builder.md` cites old-tree paths (`docs/specs/…`) — Phase-4 wiring item. |
| Hooks | `.claude/hooks/` — 3 (adr-status-guard.py · bundle-size-reminder.sh · css-comment-guard.py) + settings.json registrations | Liveness to verify in Phase 4. |
| Settings | `settings.json` + `settings.local.json` | Double-registration / matcher audit in Phase 4. |
| CI | **N/A — no `.github/workflows`** | Template premise false (calibration log). Gates are npm scripts run locally/by seats. |

## 2 · Root strays (delete-class candidates — manifest only, nothing moved)

| Path | Evidence | Disposition (proposed) |
|---|---|---|
| `undefined/dist-shared-build-cache/` | Empty dir tree, untracked, mtime 2026-07-10 14:02. Root cause CONFIRMED: `site/lib/build-css.ts:179` builds `${root}/dist-shared-build-cache` — a caller passed an undefined `root`. | `delete` + a hardening note (build-css could throw on a non-absolute root). |
| `public/` (repo root) | Contains ONLY `.DS_Store` (ignored); zero tracked files; not the site's public (that's `site/public/`). | `delete` |
| `.claude/docs/other/` | Contains ONLY `.DS_Store`. | `delete` |

## 3 · Design-doc corpus map

**Total ≈ 300 documents.** Classification by the repo's own signals (status frontmatter, recency, inbound references):

| Class | Corpus | Count | Evidence |
|---|---|---|---|
| **Active** | `adr/` | 118 accepted · 5 proposed · 3 superseded (+ README index + template) | The adr gate enforces status vocabulary. |
| **Active** | `prd/` 9 · `spec/` 19 · `lld/` 23 · `decompositions/` 75 · `tickets/` 24 (23 done · 1 open) · `rubrics/` 7 | ~157 | The NEW charter map (established at the a2a wave, 2026-07-08). |
| **Active** | `.claude/docs/specs/` — the a2ui expert-system tree (own README + NEXT.md frontier + prd + 6 specs under `specs/specs/` + 6 llds + 1 decomp) | ~16 | **LIVE** — last commit 2026-07-11 (`bdf17cf`, the CP-M2 wave edited `a2ui-catalog.spec.md`). |
| **Reference** | `references/` 9 · `goals.md` · `plan.md` · `process.md` | 12 | The law layer; skills route to it. |
| **Ambiguous → Phase 4** | `.claude/docs/llds/` — 7 component-level LLDs (gallery, field/form-provider, icon-adapter, indicator, listbox-roving, overlay-controller, range-element) | 7 | G7/G8-era internals designs, all SHIPPED; last commit 2026-07-08; 3 inbound doc references. Active-vs-reference is a judged call — flagged, not silently classed. |
| **Parked** | `drafts/` — container-family-design.md | 1 | Known-parked (memory record); untouched since 2026-07-04. |

## 4 · The reconciliation table — the generation split (the campaign's real subject)

There are no duplicate harness trees; the repo's genuine split is **two live doc-map generations**:

| Axis | Old generation | New generation | Winner rule (proposed) |
|---|---|---|---|
| Specs | `.claude/docs/specs/specs/*.spec.md` (6 a2ui specs) + charter files | `.claude/docs/spec/*.spec.md` (19) | **New map wins for placement**; the a2ui tree's CONTENT is canonical and live — this is a `relocate`+redirect decision, not a content merge. |
| LLDs | `.claude/docs/specs/llds/` (6) + `.claude/docs/llds/` (7) | `.claude/docs/lld/` (23) | Same rule; the 7 component LLDs may instead class as reference (Phase 4 verdict). |
| PRDs | `.claude/docs/specs/a2ui-expert-system.prd.md` | `.claude/docs/prd/` (9) | Same rule. |
| Decomps | `.claude/docs/specs/decompositions/` (1) | `.claude/docs/decompositions/` (75) | Same rule. |
| Frontier | `.claude/docs/specs/NEXT.md` (tree-wins rule, last touched 2026-07-08) | tickets/ + the goal queue | Phase 4: NEXT.md liveness vs the ticket spine. |

**Blast radius if relocated:** only 4 files reference `docs/specs/specs/` paths and 3 reference `docs/llds/` — low coupling. But `a2ui-builder.md` (an agent seat) and the a2ui skills cite old paths; the referrer-repair map is mandatory before any move. Generated indexes (llms-full, sitemap) regenerate, never hand-repair.

## 5 · Status-vs-reality drift (headline finding → Phase 4 lens)

1. **Five foundational ADRs still read `proposed`:** 0015 (container surface/space model), 0017 (native dialog modal), 0018 (nested radius), 0019 (two-way binding), 0020 (modal persistent) — all from the June foundation waves, all SHIPPED and cited as settled law across dozens of later docs (0019 is cited as "the ADR-0019 pattern" in ~every bindable-prop design). Never self-ratify: these need Kim's explicit flip or a documented reason they stay proposed.
2. **`spec/` status vocabulary:** 18 of 19 specs read `proposed` (many `pending doc-review`) although their builds shipped and their reviews happened. Either the convention is "specs stay proposed forever" (then the vocabulary is noise) or the statuses rotted. Phase 4 judges per-doc; Phase 3 first surveys what the status grammar is SUPPOSED to be.
3. **3 superseded ADRs** — supersession-chain integrity to verify in Phase 4 (dangling pointers).

## 6 · Proposed next phases (scope decision at checkpoint)

- Phase 1 (unify) reshapes to: execute §2 stray deletions + (IF ratified) the §4 relocation with referrer repair.
- Phase 3: survey + codify the doc grammar (status vocabulary per type, the ID spine) — feeds the naming master plan Kim asked about separately; these two workstreams share the inventory.
- Phase 4 lenses: entry-file residency (CLAUDE.md) · skills/agents wiring (old-path citations, staleness) · hooks/settings semantics · corpus liveness (the §5 items + NEXT.md + llds/ class + per-doc drift).

## 7 · CHECKPOINT OUTCOME (ratified by Kim, 2026-07-12 at the AskUserQuestion prompt)

1. **Doc-map split → UNIFY onto the new map.** The a2ui expert-system tree relocates into
   `spec/ · lld/ · prd/ · decompositions/`; the old `specs/` dir dissolves; referrer-repair map
   mandatory; `docs/llds/` relocates into `lld/` in the same package (placement ≠ liveness — the
   Phase-4 lens still judges those docs' class where they land).
2. **Strays → delete all three** + the build-css hardening guard (throw on a non-absolute root).
3. **The five June ADRs (0015/0017/0018/0019/0020) → RATIFIED accepted** at this checkpoint —
   the campaign flips them with Ratified-by citing this ruling.
4. **Scope → full campaign** (phases 1–6, checkpointed).
