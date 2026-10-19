---
id: T-0374
title: "Visible geometry changes from the skill model: glyph, field label, tiers, density heights, curvature presets"
type: feature        # feature | bug | chore | spike | idea
status: ready     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L4             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0373]          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-18
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
The visible parts of the skill's model reach the library, each behind Kim's mockup approval.

## Intent
- Do: glyph n+6; fieldLabel 10 and smallControl; the new content and brand tier rows; five densities that change control height; curvature presets in place of radius = margin; label-edge radius compensation on buttons. One step per change, each with a screenshot against an approved mockup.
- Non-goals: re-vendoring or renames (T-0372, T-0373).
- Done when: each step's screenshot is approved by Kim and the gates above stay green.
- Kim ruled 2026-10-19: density changes control height (tight 3n to loose 5n); 24/32/40 holds at regular density, and the no-one-off-heights rule is restated as "at regular density".
- Kim ruled 2026-10-19: fractional px, the model's floats ship; the T-0373 emit-time whole-px gate is relaxed to finite and monotonic, with a sub-pixel border check.
- Kim ruled 2026-10-19: balanced (50%) is the default radius preset; pill stays opt-in.

## Context
Source of truth: the skill at `~/.claude/skills/mathematical-design-system` (`scripts/lib/scale.mjs`, `scripts/lib/curvature.mjs`, `references/geometry-contract.md`, checks `scripts/check-geometry.mjs` and `scripts/check-curvature.mjs`). The repo's vendored resolver is `packages/agent-ui/shared/src/tokens/scale.mjs` (an older snapshot), emitted by `node scripts/generate-foundations.mjs` into `foundations.gen.css` and `foundations-bridge.gen.css` (ADR-0245, frozen; decisions now live in tickets and `.claude/docs/references/`). Gates: `foundations.test.ts`, the foundations census (`node scripts/foundations-census.mjs --gate`), `sizing-gates.test.ts`, `npm run check`.
Differences found 2026-10-18: content/brand tier rows; control height 3n + 2 margin with 5 densities (regular = 4n); spacing as container factors and role percentages of one margin reference; icon 2n and glyph n+6 in a square 3n wrapper; floats kept until presentation; type roles renamed (sectionKicker, groupKicker), fieldLabel 10, smallControl added; percentage curvature presets with concentric nesting and a pill cap; label-edge radius compensation on buttons; table row 2n + 2.5d.

## Constraints
Kim approves each mockup before its step builds. The three rulings are recorded above.
