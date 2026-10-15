---
id: T-0074
title: "P2: quizmaster fragment with QuestionCard"
type: feature        # feature | bug | chore | spike | idea
status: done     # proposed | ready | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0068, T-0072]
created: 2026-10-12
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
P2: quizmaster fragment with QuestionCard (child P2 of the preset-widgets campaign; design `.sdlc/tickets/.0065-preset-widgets-design/design.md`).

## Intent
- Do: design.md section 4 QuestionCard and section 8 row P2. New fragment folder `packages/agent-ui/a2ui/src/catalog/personas/quizmaster/` with `QuestionCard` (two-way `value`, the BookingForm precedent), the record in `catalog/records.ts`, `personas/{index,manifests}.ts`, `registry/registry-wiring.test.ts`, `site/lib/agent-manifest/quizmaster.manifest.json`, quizmaster `localPatterns: 'quizmaster'` and `seedVersion` 3. Seeds in the format T-0064 landed (`persona-exemplars.ts`). Follow skill a2ui-multi-catalog.
- Files (the scope): new `personas/quizmaster/**`, `personas/{index,manifests}.ts`, `catalog/records.ts`, `registry/registry-wiring.test.ts`, `site/lib/agent-manifest/quizmaster.manifest.json`, `site/pages/agent-admin-presets.ts` quizmaster entry
- Non-goals: anything outside the scope list; the other children; the live leg and any key.
- Done when: fragment, registry-wiring and persona tests green; coverage gate green with the new seeds; manifest writer test; npm run check and npm test exit 0; no em dash in any added line (generated single-line files that embed unchanged text excepted, say so); records repaired in the same change.

## Context
Campaign order (design.md section 8): A0 (ADR-0243 draft) first, then Kim comments `ratify ADR-0243` on its PR and the conductor runs `scripts/adr_ratify.py`; then W0, C1, C2, C3 (C1 to C3 in parallel); R1 after C1 to C3; P1 and P2 after W0 and R1; S1 last. Dependencies recorded in front matter: T-0068, T-0072. Related: T-0064 (catalog previews, in flight: its coverage gate and seed format apply), T-0066 (prompt contradictions, in flight). If a dependency's work has merged, rebase onto main first. Close-first: one verifier per ticket and a pass is final; docs-only tickets skip the verifier.

## Constraints
Imports point inward only. Light DOM, ARIA via ElementInternals. Never hand-edit generated files. No push without approval; the conductor opens PRs after the verifier passes. Stop and report blocked if the scope list blocks a file you must touch.

## Styling review (Kim, 2026-10-12)
Mockup approved. Do NOT use a border-left highlight for selected/correct/wrong states (Kim). Explanation opens in place. Option row about 44px.

## Closed

2026-10-12: Merged in #1902; verifier pass
