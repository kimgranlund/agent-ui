---
id: T-0373
title: "Adopt the skill's geometry structure: type roles, control surface anatomy, spacing roles, emit-time rounding"
type: chore           # feature | bug | chore | spike | idea
status: ready     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0372]          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-18
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
The foundations use the skill's structure (type role names, control surface anatomy, spacing roles, emit-time rounding) while every rendered size stays the same.

## Intent
- Do: rename type roles to the skill's (sectionKicker, groupKicker) through the bridge so consumers keep working; derive icon and glyph wrapper anatomy from `resolveControlSurface` at today's sizes; express the spacing ladder as a margin reference plus role percentages; replace the model-level whole-px rule (M7) with an emit-time whole-px gate.
- Non-goals: values that change what renders (T-0374).
- Done when: the T-0372 parity test still passes; `npm run check`, the shared and components tests, the census gate and `sizing-gates.test.ts` exit 0; a screenshot of the button, field and card demos matches main.

## Context
Source of truth: the skill at `~/.claude/skills/mathematical-design-system` (`scripts/lib/scale.mjs`, `scripts/lib/curvature.mjs`, `references/geometry-contract.md`, checks `scripts/check-geometry.mjs` and `scripts/check-curvature.mjs`). The repo's vendored resolver is `packages/agent-ui/shared/src/tokens/scale.mjs` (an older snapshot), emitted by `node scripts/generate-foundations.mjs` into `foundations.gen.css` and `foundations-bridge.gen.css` (ADR-0245, frozen; decisions now live in tickets and `.claude/docs/references/`). Gates: `foundations.test.ts`, the foundations census (`node scripts/foundations-census.mjs --gate`), `sizing-gates.test.ts`, `npm run check`.
Differences found 2026-10-18: content/brand tier rows; control height 3n + 2 margin with 5 densities (regular = 4n); spacing as container factors and role percentages of one margin reference; icon 2n and glyph n+6 in a square 3n wrapper; floats kept until presentation; type roles renamed (sectionKicker, groupKicker), fieldLabel 10, smallControl added; percentage curvature presets with concentric nesting and a pill cap; label-edge radius compensation on buttons; table row 2n + 2.5d.

## Constraints
No rendered size change. Generated files only through their script.
