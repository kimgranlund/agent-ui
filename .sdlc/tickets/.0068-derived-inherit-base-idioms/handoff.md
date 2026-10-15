---
id: T-0068
title: "W0: derived catalogs inherit the base catalog mini-skills and exemplars"
type: feature        # feature | bug | chore | spike | idea
status: done     # proposed | ready | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0067]
created: 2026-10-12
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
W0: derived catalogs inherit the base catalog mini-skills and exemplars (child W0 of the preset-widgets campaign; design `.sdlc/tickets/.0065-preset-widgets-design/design.md`).

## Intent
- Do: design.md section 7 clause 3 and section 8 row W0: `selectMiniSkills` and the corpus retrieval scope on the BASE id of a `<base>--<persona>` catalog (split on the first `--`, as `selectionGuidanceForId` already does). Replay the Croupier recorded fixtures (`recorded-replay.test.ts`) before and after: a derived turn now sees base idioms, so check the K6 probe stays within bound and report the number. Update SPEC-R6 in `persona-catalog-composition.spec.md` and the matching line in `packages/agent-ui/a2ui/AGENTS.md`.
- Files (the scope): `packages/agent-ui/a2ui/src/agent/mini-skills.ts`, `src/agent/produce.ts` (~1061), `src/corpus/retrieve.ts` (~63), their tests, `.claude/docs/spec/persona-catalog-composition.spec.md`, `packages/agent-ui/a2ui/AGENTS.md`
- Non-goals: anything outside the scope list; the other children; the live leg and any key.
- Done when: red-then-green tests for a derived id retrieving base mini-skills and exemplars; Croupier recorded-replay green; K6 number reported; npm run check and npm test exit 0; no em dash in any added line (generated single-line files that embed unchanged text excepted, say so); records repaired in the same change.

## Context
Campaign order (design.md section 8): A0 (ADR-0243 draft) first, then Kim comments `ratify ADR-0243` on its PR and the conductor runs `scripts/adr_ratify.py`; then W0, C1, C2, C3 (C1 to C3 in parallel); R1 after C1 to C3; P1 and P2 after W0 and R1; S1 last. Dependencies recorded in front matter: T-0067. Related: T-0064 (catalog previews, in flight: its coverage gate and seed format apply), T-0066 (prompt contradictions, in flight). If a dependency's work has merged, rebase onto main first. Close-first: one verifier per ticket and a pass is final; docs-only tickets skip the verifier.

## Constraints
Imports point inward only. Light DOM, ARIA via ElementInternals. Never hand-edit generated files. No push without approval; the conductor opens PRs after the verifier passes. Stop and report blocked if the scope list blocks a file you must touch.

## Closed

2026-10-12: Merged in #1892; verifier pass
