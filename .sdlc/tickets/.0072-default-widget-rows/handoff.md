---
id: T-0072
title: "R1: default catalog rows, seeds, sidecars, previews and teaching for the three controls"
type: feature        # feature | bug | chore | spike | idea
status: done     # proposed | ready | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0069, T-0070, T-0071]
created: 2026-10-12
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
R1: default catalog rows, seeds, sidecars, previews and teaching for the three controls (child R1 of the preset-widgets campaign; design `.sdlc/tickets/.0065-preset-widgets-design/design.md`).

## Intent
- Do: design.md section 8 row R1. Add the ProductCard, BoardGrid and GameHud rows to the default catalog (`catalog.json`, factories, `selection.json` with the sidecar clauses from section 4), example seeds so the every-catalog coverage gate from T-0064 stays green, preview cards, mini-skill and pack text updates (`prompts/mini-skills/{product-presentation,game-hud}.md`, the board-grid, word-tiles, trip-plan, guess-hud, deal-sheet, color-duel, quest-log and battle-rounds entries in `agent-admin-libraries.ts`, the Croupier game-hud skill). Re-measure K6 (prompt plus tool definition) and write it into the PRD; if GameHud shows no gain, drop its row and keep the mini-skill. Recapture the prompt baseline ONCE via the documented flow; regenerate assets and the registry with their scripts.
- Files (the scope): the shared default files under `packages/agent-ui/a2ui/src/catalog/default/` , `src/examples/*.ts`, `prompts/mini-skills/*`, `site/pages/agent-admin-libraries.ts`, `site/pages/agent-admin-presets.ts` (Croupier skill), `a2ui-catalog.spec.md`, PRD K6 row, generated assets
- Non-goals: anything outside the scope list; the other children; the live leg and any key.
- Done when: K6 at or under the bound with the number reported; catalog-coverage and registry gates green; npm run check and npm test exit 0; baseline recaptured once; no em dash in any added line (generated single-line files that embed unchanged text excepted, say so); records repaired in the same change.

## Context
Campaign order (design.md section 8): A0 (ADR-0243 draft) first, then Kim comments `ratify ADR-0243` on its PR and the conductor runs `scripts/adr_ratify.py`; then W0, C1, C2, C3 (C1 to C3 in parallel); R1 after C1 to C3; P1 and P2 after W0 and R1; S1 last. Dependencies recorded in front matter: T-0069, T-0070, T-0071. Related: T-0064 (catalog previews, in flight: its coverage gate and seed format apply), T-0066 (prompt contradictions, in flight). If a dependency's work has merged, rebase onto main first. Close-first: one verifier per ticket and a pass is final; docs-only tickets skip the verifier.

## Constraints
Imports point inward only. Light DOM, ARIA via ElementInternals. Never hand-edit generated files. No push without approval; the conductor opens PRs after the verifier passes. Stop and report blocked if the scope list blocks a file you must touch.

## Acceptance criteria
- `npm run check` exits 0 and `npx vitest run` exits 0 in the tree.
- `defaultCatalog.components` has ProductCard, BoardGrid and GameHud, each with a selection.json entry and a factory; `EXCLUSION_ALLOWLIST` has none of the three.
- K6 default + tool is at or under 46,430 chars (measured 45,377).
- `prompt-equivalence.baseline.json` differs from main only by the catalog inventory and mini-skill text of these rows.
- No em dash in an added line except the recorded exceptions (generated baseline, spec line 188).

## Closed

2026-10-12: Merged in #1899; verifier pass on second run
