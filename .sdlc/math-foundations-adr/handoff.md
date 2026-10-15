---
id: T-0091
title: "Foundations overhaul ADR: derive sizes, margins, gutters and type from one n, with separate icon and glyph containers"
type: spike           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-12
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Question
Can agent-ui's foundations (control heights, insets, icon boxes, radii, container margins and gutters, type) be derived from one integer n per the `mathematical-design-system` skill (~/.claude/skills/mathematical-design-system/SKILL.md, with scale.mjs and tokens.css beside it), and what does adopting it change?

## Goal
One proposed ADR (draft only, status proposed, ratified later by Kim) at `.claude/docs/adr/`, plus a delta table. The ADR amends or supersedes the parts of ADR-0046 (container box model), ADR-0078 (ui-text axes) and ADR-0223 (fill-by-default sizing) that it touches, and names every record it invalidates. No production code lands from this spike.

## Context
- Kim's decisions (2026-10-12): full overhaul ADR; `icon` and `glyph` each get their own container and their own distinct size; component geometry changes with the new margin, gutter, inset, padding and gap systems.
- Today: no concept of a glyph for plus, minus, carets, check; controls use icons only. `glyph="name"` is currently the `ui-icon` icon-name attribute (packages/agent-ui/icons, guarded by glyph-usage-coverage.test.ts), so the ADR must resolve that clash. Likely reading: icon = pictorial symbol in a `2n` container; glyph = functional mark (plus, minus, caret, check, dot) in a smaller `2n - 2c` container. The ADR proposes the names and the migration for the existing attribute.
- Current control ramp is 24 / 28 / 36 px (lib sm / md / lg), no 32. In the skill: widget tier is 24 / 28 / 32, product tier 28 / 36 / 44, so 36 is product md and 32 is widget lg. The ADR maps the library's sm / md / lg onto `data-tier`, `data-scale`, `data-size`, or rejects the skill with evidence.
- Tokens live in packages/agent-ui/shared/src/tokens/dimensions.css (499 lines) and tokens.css; ADR-0046 is the box model (6px inset, 12 / 6 region padding, 8px gap, fixed rem). Controls read these through `:where(ui-{cmp})` blocks.
- The skill's rules: height 4n, inset n, icon 2n, radius n, c = ceil(n/4), glyph 2n - 2c; containers group / widget / card / layout with margin, gutter, radius as multiples of n; placement offset = container margin - child inset; type from linear and Q formulas; contract checks M1 to M10 in `check()`.

## Constraints
- Spike: the deliverable is the ADR draft plus the delta table (today's value, derived value, which controls move, by how many px) and a plan of waves for a later build. Run the skill's `check()` and quote its result; use scale.mjs for every number rather than hand arithmetic.
- Cover: token generation from one config (and where the config lives, gate for check()), icon and glyph containers and sizes, the mark set and how marks are drawn, margin and gutter systems vs ADR-0046, per-control geometry changes, type, the `glyph` attribute clash and migration, A2UI catalog and payload impact, the K6 prompt budget, density and scale axes, sizing-gates.test.ts, and risk (visible look change across every control, 40px and XL steps do not exist).
- ADR amendments are append-only. Next free ADR number; read the ADR log rules in the doc-standards skill. Generated files are never hand-edited. No em dashes anywhere.
- Docs-only diff: gate is doc_lint plus `npm run check`; also regenerate adr-index, sitemap indexes and llms-full if the ADR title adds a row, per CLAUDE.md. Do not push or open a PR; the conductor does that after approval.
- Mockup before any build: the ADR names a mockup deliverable (control row at each step with icon and glyph containers) as step 0 of the build tickets.

## Step 0 decisions (Kim 2026-10-12)
See .sdlc/foundations-mockup/approval.md: canvas at data-scale=md, keep the pill for buttons and toggles, avatar 4n, mockup approved. To apply to ADR-0245 (still proposed) after PR #1912 merges: button/toggle radius row and clause 3 "pill radius retires" text, the open-items clause, the avatar and canvas rulings.

## Closed

2026-10-14: ADR-0245 accepted 2026-10-13 with Amendments 1 to 7; Kim signed off 2026-10-14
