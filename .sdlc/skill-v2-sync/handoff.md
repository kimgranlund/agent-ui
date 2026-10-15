---
id: T-0120
title: "Foundations v2: adopt the updated mathematical-design-system (density, M11, pill 2n, section and group labels, exceptions derived)"
type: feature
status: done
size: L3
priority: P1
depends: []
created: 2026-10-13
router: .sdlc/AGENTS.md
---

## Goal
The peer repo updated the mathematical-design-system skill (~/.claude/skills/mathematical-design-system, scale.mjs now has data-density and m, the control rule, min width 4n, label inset). Kim 2026-10-13 rulings: rename the kicker roles to section label and group label (ui-text kicker stays an alias); add contract M11 (no derived px quantity shrinks as n grows) and make the radio dot glyph minus 2; derive the hand-set exceptions instead of keeping them; controls, content and type keep separate scaling laws (no change); the half-pixel group label is fine.

## Scope (one brief paragraph, per the Inner loop rule)
(1) Re-vendor the skill's scale.mjs into packages/agent-ui/shared/src/tokens/scale.mjs (byte copy plus the sha test) and regenerate foundations.gen.css and the bridge; map the retired [density] to data-density (container spacing only: m = n + a*d) per the new skill instead of data-scale, with the ADR-0245 Amendment 3 saying so; (2) rename the tokens --md-sys-type-section-kicker and --md-sys-type-group-kicker to section-label and group-label everywhere (CSS, descriptors, generator, tests, docs), keep the ui-text variant kicker as an alias reading group-label for small uppercase labels; (3) M11 in the generator gate (check) and the radio dot becomes glyph minus 2 (checkbox, radio, switch tests re-pinned); (4) derive the exceptions: button and toggle radius 2n (pill, replacing the h/2 special case), avatar a 4n circle (inline 2n), gauge ring stroke 4c, swatch 4n square radius n, the A2UI artboard padding 3n and gap 2n (card level, instead of 16 and 12), column-chart segment radius group radius n + c (instead of the pinned 12); update derive.mjs and its output, the delta table and the ADR (append-only Amendment 3), geometry.md and tokens.md; (5) do NOT adopt the new control rule (box padding n plus label inset n minus c) here; list the controls and px it would move in the report as a follow-up. Re-pin affected tests and re-mint goldens family by family after eye review; unexplained golden diffs stay red and are reported. Local gate: npm run check, the touched folders' tests, the four browser shards and the visual shard, the census gate and probe --strict; no per-ticket verifier; no em dashes; commit locally, do not push; report in one short message with every px that changed.

## Closed

2026-10-13: merged as #1942
