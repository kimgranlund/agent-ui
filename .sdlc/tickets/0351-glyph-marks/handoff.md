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

## Acceptance criteria
verifier: L3

Scope note: the select caret (T-0148) and the calendar carets (T-0149) were already `ui-glyph` children at the base; the remaining setIcon calls in text-field (`magnifying-glass`, `eye`, `eye-slash`, `calendar-blank`) are pictorial icons that ADR-0245 cl.5 keeps on the pack, not marks.

- `! grep -n clip-path packages/agent-ui/components/src/controls/badge/badge.css`
- `! grep -n clip-path packages/agent-ui/components/src/controls/game-hud/game-hud.css packages/agent-ui/components/src/controls/result-card/result-card.css`
- `! grep -n "aria-hidden" packages/agent-ui/components/src/controls/badge/badge.ts packages/agent-ui/components/src/controls/game-hud/game-hud.ts`
- `! git grep -n "createElement('ui-glyph')" -- packages/agent-ui/components/src/controls/badge/badge.ts packages/agent-ui/components/src/controls/game-hud/game-hud.ts packages/agent-ui/components/src/controls/result-card/result-card.ts packages/agent-ui/components/src/controls/text-field/text-field.ts packages/agent-ui/components/src/controls/tabs/tabs.ts packages/agent-ui/components/src/controls/breadcrumb/breadcrumb.ts`
- `! git grep -nE "setIcon\([^)]*'(x|minus|plus|check|more|dots-three|caret-[a-z]+)'" -- packages/agent-ui/components/src/controls/badge packages/agent-ui/components/src/controls/select packages/agent-ui/components/src/controls/text-field packages/agent-ui/components/src/controls/calendar packages/agent-ui/components/src/controls/tabs packages/agent-ui/components/src/controls/breadcrumb`
- `npm run check`
- `npx vitest run packages/agent-ui/components/src/controls/badge packages/agent-ui/components/src/controls/tabs packages/agent-ui/components/src/controls/breadcrumb packages/agent-ui/components/src/controls/text-field packages/agent-ui/components/src/controls/glyph packages/agent-ui/components/src/controls/game-hud packages/agent-ui/components/src/controls/result-card packages/agent-ui/components/src/controls/sandbox-frame packages/agent-ui/components/src/controls/tree-shake.test.ts packages/agent-ui/a2ui/src/catalog/default/factories.test.ts`
- `npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/components/src/controls/badge packages/agent-ui/components/src/controls/tabs packages/agent-ui/components/src/controls/breadcrumb packages/agent-ui/components/src/controls/text-field packages/agent-ui/components/src/controls/glyph packages/agent-ui/components/src/controls/game-hud packages/agent-ui/components/src/controls/result-card packages/agent-ui/components/src/controls/product-card packages/agent-ui/components/src/controls/control-rule.browser.test.ts`
- `npx vitest run --config vitest.browser.config.ts --project site site/pages/dogfood-render.browser.test.ts site/pages/breadcrumb-demo.browser.test.ts site/pages/badge-demo.browser.test.ts site/pages/text-field-demo.browser.test.ts`
- `npm run test:visual`
- Before and after screenshots of badge, text-field (search clear, number stepper), tabs overflow, breadcrumb overflow, game-hud stats and result-card stats at sm, md and lg are in the run's `shots/` folder and listed in solo-report.md.
