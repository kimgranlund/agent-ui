---
id: T-0351
title: "Badge intent marks and the setIcon carets, clear and stepper marks move to ui-glyph children (GH #1941)"
type: chore           # feature | bug | chore | spike | idea
status: ready     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-17
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
Every pseudo-element or setIcon mark left over from the ADR-0245 rollout renders as a `ui-glyph` child on the derived geometry, with a deliberate golden re-mint.

## Intent
- Do: replace the badge's 9 clip-path intent polygons (`packages/agent-ui/components/src/controls/badge/badge.css` around :158) with `ui-glyph` children; move the remaining setIcon marks (select caret, text-field clear, stepper, calendar carets, tabs, breadcrumb) to `ui-glyph` children; update each descriptor and re-mint the affected goldens on purpose.
- Non-goals: generated mask tokens (Kim ruled them out, 2026-10-17); new icons; any change to ui-icon's public API.
- Done when: `grep -rn clip-path badge.css` shows no intent-mark polygons, and no control above calls setIcon for a mark; `npm run check` plus the touched control folders' tests (jsdom and browser shards for those folders) exit 0; before and after screenshots of each control show the same marks at the ramp sizes.
- If Do needs more steps than this level allows (L1-L2 3, L3 6, L4 10, L5 15), file two tickets.

## Context
GH #1941 (closed into this ticket). Kim's ruling 2026-10-17: ui-glyph children, not mask tokens. Source: the ADR-0245 foundations campaign notes (2026-10-13). The symbol rename and ui-glyph landed in that campaign; follow its pattern. Golden re-mint follows skill `component-testing`.

## Constraints
The foundations census gate (`node scripts/foundations-census.mjs --gate`) stays green; no px geometry literals; light DOM, ARIA via ElementInternals.
