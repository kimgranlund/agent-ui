---
id: T-0373
title: "Adopt the skill's geometry structure: type roles, control surface anatomy, spacing roles, emit-time rounding"
type: chore           # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
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
1. `node scripts/generate-foundations.mjs --check` exits 0, and the derived sheet moved by its header, the two renamed type lines and the one-release alias rule for the old label names (a comment and one rule) only: `test "$(git diff --numstat c6a183afd -- packages/agent-ui/shared/src/tokens/foundations.gen.css | cut -f1,2)" = "$(printf '5\t3')"` exits 0.
2. The repo's frozen resolver and the vendored skill files are untouched: `git diff --exit-code c6a183afd -- packages/agent-ui/shared/src/tokens/scale.mjs packages/agent-ui/shared/src/tokens/vendor` exits 0.
3. `npx vitest run packages/agent-ui/shared packages/agent-ui/components` exits 0: the re-pinned parity shas, the nudge test over every vendored anchor (control surface, margin reference, the four spacing roles), the emit-time gate (E1 refuses a fractional emitted length or type off the 0.5px grid; M7's level and type forms no longer refuse, its component-part form still does), checkAnchors never throwing (A5 for a role outside 0 to 200 or a negative margin reference), the unemitted surface guard, the resolve() mirror with the kicker names and the surface anatomy over 108 cells, `sizing-gates.test.ts` and the dogfood assets freshness test.
4. `npx vitest run --config vitest.browser.config.ts packages/agent-ui/shared/src/tokens/foundations.browser.test.ts` exits 0: the kickers and the old `--md-sys-type-{section,group}-label` (aliased in foundations.gen.css) compute the former label values on every cell and are undefined in the legacy opt-out.
5. `node scripts/foundations-census.mjs --gate` exits 0 and `node scripts/foundations-census.mjs selftest` exits 0 (a read of an old label name is a tokens finding; every consumer reads the kicker names), and `node scripts/foundations-codemod.mjs selftest` exits 0 (the codemod renames such a read).
6. `npm run check` exits 0.
7. No rendered change: the button, field, card, text, table, command-modal, split and split-pane demo screenshots in `.sdlc/runtime/tasks/0373-foundations-geometry-structure/screens/` match main pixel for pixel, apart from the max-delta-1 corner antialiasing that a main-against-main capture also shows.

## Constraints
No rendered size change. Generated files only through their script.

## Outcome

2026-10-18 · lane: full L3 · verdict: pass · verifier: verifier-L3 (fable) · base: c6a183afd710
- Changed: Foundations adopt the skill's structure, no rendered change (#2158)
- Commits: none
- Check: 1 `node scripts/generate-foundations.mjs --check` exits 0 and the derived sheet moved by header, tw...: pass
- Check: 2 The frozen resolver and the vendored skill files are untouched: pass
- Check: 3 `npx vitest run packages/agent-ui/shared packages/agent-ui/components` exits 0 with the named tests: pass
- Check: 4 `npx vitest run --config vitest.browser.config.ts packages/agent-ui/shared/src/tokens/foundations...: pass
- Check: 5 `node scripts/foundations-census.mjs --gate`, `selftest` and `node scripts/foundations-codemod.mj...: pass
- Check: 6 `npm run check` exits 0: pass
- Check: 7 No rendered change in the eight demo screenshots: pass
- Follow-up: decide: .sdlc/runtime/tasks/0373-foundations-geometry-structure/screens/... -> notes.md
- Follow-up: note: packages/agent-ui/shared/src/tokens/foundations-bridge.gen.css:94,1... -> notes.md
