---
id: T-0083
title: "Widget style gaps vs the approved mockups: buttons 36px, ProductCard states and stars, BoardGrid cell size, example payload intents"
type: bug             # feature | bug | chore | spike | idea
status: done     # proposed | ready | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-12
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The merged widgets (ProductCard, BoardGrid, GameHud, CardTable) match the mockups Kim approved, with a test for each behaviour change. QuestionCard is already fixed (T-0082, #1903).

## Repro
1. Compare the approved mockup sections (/private/tmp/claude-501/local-artifact/mockups.html, ids #pc #bg #gh #ct; CSS /private/tmp/claude-501/widgets-artifact/own.css, body.html) with the real widgets rendered from the example seeds (the showcase at /private/tmp/claude-501/local-artifact/index.html needs the dev server). Use a headless Playwright screenshot of both, side by side.

## Expected
1. Buttons: the primary action buttons in ProductCard (its internal action button), CardTable (Hit, Stand, Double) and the QuestionCard Check answer render at the library's LARGE step (36px at the default scale, via the button's `size=lg`, NOT a custom 32px or 39px value). The library ramp is sm 24 / md 28 / lg 36 (dimensions.css); no 32px step exists. QuestionCard option rows stay 44px.
2. ProductCard: rating renders five star glyphs (filled, half or empty by value) plus the number and optional count, not one star; add the states the approved mockup showed: struck-through old price (`priceOld` or similar), `selected` (primary outline, ghost action labelled by actionLabel) and `disabled` (image desaturated, action disabled). Add the wire props to the default catalog row and sidecar, and record them as an appended Amendment on ADR-0243 (append-only).
3. BoardGrid: the cell side follows the approved mockup (46px battle cells, 52px tile cells) on the control row, with the 34px floor kept as the minimum; add a battle-board example (hit, miss, sunk marks with the danger-high and success-high ink Kim asked for) to the board seed or a second seed so the showcase and catalog page show it.
4. Example payloads: GameHud and CardTable seeds use the green success status pill for 'Your turn' as in the mockup; CardTable cards use the medium card size; dealer total reads like the mockup.
5. Screenshots (unselected, selected, disabled, revealed where relevant) of every changed widget next to its mockup, viewed and attached in the ticket folder.

## Actual
Measured 2026-10-12: mockup buttons 39px tall 14px/600; real Book 24px, Hit/Stand/Double and Check answer 28px, weight 400. ProductCard shows one star; the mockup showed five and three extra states. Pills are info blue where the mockup was green.

## Context
Controls under packages/agent-ui/components/src/controls/{product-card,board-grid,game-hud}/, croupier factories packages/agent-ui/a2ui/src/catalog/personas/croupier/factories.ts, default catalog rows packages/agent-ui/a2ui/src/catalog/default/{catalog.json,factories.ts,selection.json}, seeds in src/examples/{catalog-frontier,persona-exemplars}.ts. Controls' build verifiers checked behaviour, not mockup parity. After the change regenerate generated files with their scripts, keep K6 under 46,430 and report the number, recapture the prompt baseline only if prompt text changes (once).

## Constraints
No em dashes. No border-left highlights. Keep existing wire props working (additive only).

## Acceptance criteria
verifier: L3

1. Composite action Buttons sit at size="lg", ProductCard gains stars, priceOld, ratingCount, selected, disabled, the renderer drops a disabled card's click, and the seeds read "Your turn", "showing 9" and md cards: `npx vitest run --project packages packages/agent-ui/a2ui/src/catalog/personas packages/agent-ui/components/src/controls/product-card packages/agent-ui/components/src/controls/board-grid packages/agent-ui/a2ui/src/renderer/product-card-action.test.ts packages/agent-ui/a2ui/src/examples` exits 0.
2. Real-engine geometry: the ProductCard action is 36px tall with the 16px lg font, selected draws a 2px outline, disabled greys the media and fades the action, a half star clips to half; BoardGrid cells are 46px with room and floor at 34px: `npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/components/src/controls/product-card/product-card.browser.test.ts packages/agent-ui/components/src/controls/board-grid/board-grid.browser.test.ts` exits 0.
3. The re-baselined ProductCard goldens hold: `npx vitest run --config vitest.browser.config.ts --project visual packages/agent-ui/components/src/controls/product-card` exits 0.
4. Prompt budget and baseline: `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/prompt-budget.test.ts packages/agent-ui/a2ui/src/live-agent/prompt-equivalence.test.ts` exits 0; K6 (default agent-ui composition plus renderSurfaceTool([]), the LLD section 4 script) measures 45,454, under 46,430.
5. Standing gates: `npm run check` exits 0 and `npm test` exits 0.
6. ADR-0243 carries an appended Amendment 2 and no new em dash: `grep -c "## Amendment 2: the merged widgets match the approved mockups" .claude/docs/adr/0243-preset-widgets-admission-placement-derived-inheritance.md` exits 0.
7. Screenshots (mockup, before, after, side by side) are in .sdlc/0083-widgets-match-mockups/screens/.

## Closed

2026-10-12: Merged in #1905; verifier pass
