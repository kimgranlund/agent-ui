---
id: T-0372
title: "Re-vendor the geometry resolver from the mathematical-design-system skill, no visual change"
type: chore           # feature | bug | chore | spike | idea
status: ready     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-18
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
The repo derives its foundations from the skill's current resolver, with every token it emits today unchanged.

## Intent
- Do: vendor the skill's `scale.mjs` and `curvature.mjs` beside the current file, keeping the current one as `legacy-scale.mjs`; point `generate-foundations.mjs` at the new resolver at regular density, rounding only at CSS emission; add a parity test that every token in today's `foundations.gen.css` and `foundations-bridge.gen.css` is byte-identical.
- Non-goals: any visible change; renames; density or radius changes (T-0373, T-0374).
- Done when: `node scripts/generate-foundations.mjs --check` exits 0 with no diff to the generated CSS; the parity test passes and fails when a coefficient is nudged; `npm run check` and `npx vitest run packages/agent-ui/shared` exit 0.

## Context
Source of truth: the skill at `~/.claude/skills/mathematical-design-system` (`scripts/lib/scale.mjs`, `scripts/lib/curvature.mjs`, `references/geometry-contract.md`, checks `scripts/check-geometry.mjs` and `scripts/check-curvature.mjs`). The repo's vendored resolver is `packages/agent-ui/shared/src/tokens/scale.mjs` (an older snapshot), emitted by `node scripts/generate-foundations.mjs` into `foundations.gen.css` and `foundations-bridge.gen.css` (ADR-0245, frozen; decisions now live in tickets and `.claude/docs/references/`). Gates: `foundations.test.ts`, the foundations census (`node scripts/foundations-census.mjs --gate`), `sizing-gates.test.ts`, `npm run check`.
Differences found 2026-10-18: content/brand tier rows; control height 3n + 2 margin with 5 densities (regular = 4n); spacing as container factors and role percentages of one margin reference; icon 2n and glyph n+6 in a square 3n wrapper; floats kept until presentation; type roles renamed (sectionKicker, groupKicker), fieldLabel 10, smallControl added; percentage curvature presets with concentric nesting and a pill cap; label-edge radius compensation on buttons; table row 2n + 2.5d.
Where the new model cannot reproduce a current token exactly, keep that token on the legacy path and list it in the report; do not change it.

## Acceptance criteria
verifier: L3
1. `node scripts/generate-foundations.mjs --check` exits 0 and `git diff --exit-code main -- packages/agent-ui/shared/src/tokens/foundations.gen.css packages/agent-ui/shared/src/tokens/foundations-bridge.gen.css packages/agent-ui/shared/src/tokens/scale.mjs` exits 0 (no sheet byte and the repo's own resolver unchanged).
2. The skill's files are vendored untouched: `cmp ~/.claude/skills/mathematical-design-system/scripts/lib/scale.mjs packages/agent-ui/shared/src/tokens/vendor/mathematical-design-system/scale.mjs` exits 0, and the same for `curvature.mjs`.
3. `npx vitest run packages/agent-ui/shared` exits 0, including the parity test (sha pins of both sheets), the nudge test over every vendored anchor, the refuse-to-emit test on a negative Q slope, and the resolve() mirror over all 108 cells.
4. `node scripts/foundations-census.mjs --gate` exits 0 with an empty allowlist, and its `selftest` exits 0.
5. `npm run check` exits 0.
6. Only the generator, `scripts/lib/foundations-model.mjs` and `foundations.test.ts` import the vendor folder; no consumer import of `tokens/scale.mjs` changed.

## Constraints
Generated files only through their script. No visual change. ADR-0245 is not edited.
