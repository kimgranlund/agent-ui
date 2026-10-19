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

## Acceptance criteria
verifier: L3
1. `node scripts/generate-foundations.mjs --check` exits 0, and the derived sheet moved by its header and the two renamed type lines only: `test "$(git diff --numstat c6a183afd -- packages/agent-ui/shared/src/tokens/foundations.gen.css | cut -f1,2)" = "$(printf '3\t3')"` exits 0.
2. The repo's frozen resolver and the vendored skill files are untouched: `git diff --exit-code c6a183afd -- packages/agent-ui/shared/src/tokens/scale.mjs packages/agent-ui/shared/src/tokens/vendor` exits 0.
3. `npx vitest run packages/agent-ui/shared packages/agent-ui/components` exits 0: the re-pinned parity shas, the nudge test over every vendored anchor (control surface, margin reference, the four spacing roles), the emit-time gate (E1 refuses a fractional emitted length or type off the 0.5px grid, M7 no longer refuses), the resolve() mirror with the kicker names and the surface anatomy over 108 cells, `sizing-gates.test.ts` and the dogfood assets freshness test.
4. `npx vitest run --config vitest.browser.config.ts packages/agent-ui/shared/src/tokens/foundations.browser.test.ts` exits 0: the kickers and the bridged `--md-sys-type-{section,group}-label` compute the former label values on every cell and are undefined in the legacy opt-out.
5. `node scripts/foundations-census.mjs --gate` exits 0 and `node scripts/foundations-census.mjs selftest` exits 0 (the lints read the bridged label names as derived).
6. `npm run check` exits 0.
7. No rendered change: the button, field and card demo screenshots in `.sdlc/runtime/tasks/0373-foundations-geometry-structure/screens/` match main pixel for pixel, apart from the max-delta-1 corner antialiasing that a main-against-main capture also shows.

## Constraints
No rendered size change. Generated files only through their script.
