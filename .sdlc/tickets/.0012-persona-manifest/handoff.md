---
id: T-0012
title: "Per-persona manifest tying config, catalog fragment, selection sidecar and seedVersion (GH #1812)"
type: feature        # feature | bug | chore | spike | idea
status: done     # proposed | ready | blocked | done | dropped (build progress lives in /board)
size: M              # S | M | L | XL
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-05
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
A persona's agent config (site/pages/agent-admin-presets.ts, with its own seedVersion), its catalog fragment (catalog/personas/<id>/manifest.ts) and its selection.json live in different places and can drift; for example the Croupier prompt changed (seedVersion 6) independently of its sidecar and manifest. Add one manifest per persona that names all four and a gate that checks they agree. Also deci

## Intent
- Do: design only in this lane (architect then plan); no build until the no-barrels wave (#1814) has merged, because it edits the same generated surface.
- Non-goals: any build or merge before the design is reviewed.
- Done when: an architect result and a reviewed plan exist, or the first design fork is recorded for Kim.

## Context
GH #1812: full text via `gh issue view 1812`. Origin: the 2026-10-05 generative-systems review of agent-ui. Epic: GH #1817. Read `.sdlc/rollout-2026-10-05.md` and `.claude/docs/references/agent-model.md` first. Evidence in the issue is from a review: verify before building. Related designs: ADR-0232 (selection sidecars), ADR-0233 (no barrels, ratified), `.sdlc/work/no-barrels/`.

## Constraints
No key reaches a headless run (ADR-0073); no em dashes; ADRs never self-ratified; accepted ADRs and dated reports are historical.

## Rulings
- Kim ruled 2026-10-05: manifest pins sidecar and fragment DIGESTS (not version-only). Architect: `architect-L1.md`.
- Plan is design-only until the no-barrels wave (#1814) merges: a build step must not start before then; record that as a `Depends on` line in step 1.

## Plan review
- plan review: replan: .sdlc/0012-persona-manifest/plan-reviewer-L1.md
- plan review: replan: step 1 and step 2 and plan: the "promotion rule in ADR-0172 Decision §1" is not stated in ADR-0172 or persona-catalog-composition.spec.md; it lives in `.claude/docs/decompositions/md-content-concierge-croupier-promotion.decomp.md:21-25` (status proposed, v0.1, GH #497). Cite that note and say it is proposed; never cite ADR-0172 for it. Record how the fragment fork is settled.
- plan review: replan: step 1: `DriftInput.shippedManifests[].targetCatalogs` is required but `PersonaCatalogManifest.targetCatalogs?` is optional; state the absent-value mapping in `readTreeInput()` (read via `targetsFor` semantics at compose.ts:170).
- conductor note: first replan for this task; keep edits minimal (these four findings only).

## Closed

2026-10-06: Merged to main in #1829
