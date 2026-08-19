# Overhaul run — 2026-08-19 (agent-ui)

Invocation: `/overhaul-execute .claude/*` · driver: interactive host session
(Rebuilt 2026-08-19 late: the primary-checkout copy was stash-dropped and recovered by the marshal desk (dangling c60501ec); tracked files verified 0-diff vs shipped branches, this ledger reconstructed.)

## Phase 0 — scope
One estate: `.claude/` (governed, naming.manifest.json; 29 skills + 3 stub dirs + 6 agents; no commands, no doctrine manifest; 2 worktree paths noise-excluded). Gate 1 APPROVED (include).

## Phase 1 — baselines
- naming-audit: 5 errors, 0 exemptions
- bloat-audit: 24/35 flagged (12 long-body, 6/6 agents dense-description), 0 duplicate pairs
- attention rent: skills 29/21,504 chars · agents 6/7,355 chars; collide 119 unfenced pairs; usage 13 zero-evidence
- doctrine axis absent · pattern axis absent · trend baseline row appended

## Phase 2 — plan
`.claude/overhaul-plan-2026-08-19.md` (fallback path; make-doc bypass ruled OK at Gate A).

## Gate A — APPROVED (framing + ALL waves: W0-1, W1-1/2/3, W2-1/2/3)

## Waves
- **W0-1** merge analysis {composition-patterns, layout-composition, ui-composition}: **keep-separate** — already reciprocally fenced; corpus 4 files/29.7k chars (not thin); merged pack would fail plan-skill-split self-check. No reshape handoff.
- **W1**: stubs deleted (a2ui-compose, a2ui-corpus-curate, docs-author — empty husks, zero refs) · ObjectVocab 'rendering' registered · 'due-process' exemption added → **naming 5 → 0 errors, 1 exemption**. fix-old-names n/a (no rename executed).
- **W2-1** (#1450): agents 6/6 dieted to ≤700 chars (696/699/690/692/662/698), fences kept → **PR #1455**
- **W2-2** (#1451): a2ui-review/component-build/seat-map descriptions → wiring stubs 168/167/154 (from 478/663/270; −922 chars rent) → **PR #1456** (rev 3 is authoritative; rev 2 was a stash-recovery artifact)
- **W2-3** (#1452): long-body sweep — 3 of 12 had real bloat (package-release 8,777→5,807 · site-authoring 13,707→12,148 · a2ui-catalog-rendering-review failure-branch dedup); 9 evidence-vetoed untouched → **PR #1458** (stacked on #1456)
- W1 + campaign records → **PR #1457**
- Gates: npm run check exit 0 · npm test exit 0 (host, foreground); #1452's worktree gates 0/0 (11,460 tests)

## Gate B — never fired (no trigger tripped; W2-3's 12→3 narrowing was evidence-veto, no later wave premised on it)

## Phase 6 — prove
- naming re-run: 0 errors / 1 exemption ✅ (baseline 5/0)
- rent re-run: skills 21,504→20,582 · agents 7,355→4,137 (−44%); trend row appended
- bloat flags 24→18 on working tree (W2-3's body cuts on unmerged PR #1458 lower it further)
- doctrine: absent baseline → absent (clean by absence)
- routing proof: DONE — check-routing (estate mode) · **138/148 cases pass · 5/8 suites clean** · static gate clean · 5 E6 coverage warns carried · Persist: skipped, estate run has no single plugin key
  - Matrix (failures only): a2ui-build → 1 stolen (t02, by a2ui-catalog-rendering-review, 3-of-3) · a2ui-catalog-rendering-review → 1 leaked (t12, 2-of-3) · a2ui-review → 5 stolen (t01/02/06/09/10 — STRUCTURAL: suite predates the W2-2 wiring-stub demotion; no vote can rescue a "not a routing target" description; suite is obsolete, not the description wrong) · admin-library-kinds → 2 stolen (t13/t08, both won by a2ui-catalog-rendering-review 2-of-3; "catalog row toggling" prompts carry no agent-admin cue) · integration-standards → 1 leaked (n06 "Slack MCP for Claude Code", 3-of-3; the true owner update-config is outside the estate menu — menu-scope artifact, fence already present) · dead 0 · hung 0
  - Tuning: (1) a2ui-catalog-rendering-review description — scope "add a prop or new type to the A2UI catalog" to the catalog PAGE cards and fence the package's catalog.json/factory code to a2ui-build (fixes t02, likely t13/t08 gravity too); (2) admin-library-kinds description — add row-toggle/selection-snap vocabulary (fixes t13/t08 from the owning side); (3) a2ui-review/evals — REWRITE or RETIRE post-demotion (owns t12's fence-target hole and all 5 structural fails); (4) integration-standards n06 — no edit, cross-estate menu artifact.

## Emergent queue (final additions)
5. a2ui-review eval suite obsolete post-W2-2 (5 structural fails + t12 fence-target hole) — OPEN; proposed: rewrite the suite as no-trigger-only, or retire it; route: file-task
6. Two description tunings from the routing matrix (catalog-rendering-review scope cut; admin-library-kinds vocabulary add) — OPEN; route: file-task

## Emergent queue
1. make-doc bypass for plan doc — RESOLVED at Gate A (keep as-is)
2. Builders #1450/#1451 edited the shared checkout, no worktree/commit — RESOLVED: host shipped via temp worktrees; #1452 mandated isolation (known class)
3. Marshal-desk stash-drop of this WIP + recovery (c60501ec) — RESOLVED: 0-diff vs branches; ledger rebuilt; PR #1456 rev2/rev3 churn documented in its body
4. 5 E6 coverage warns (project-facts, repo-hygiene, seat-map, site-authoring, ui-composition have no evals) — OPEN, proposed solution: seed eval suites for the routable ones (seat-map now wiring-only, needs none); route: file-task if Kim wants it

## PRs (drafts, human merge)
#1455 (W2-1) · #1456 (W2-2, rev 3) · #1457 (W1+records) · #1458 (W2-3, stacked on #1456)
