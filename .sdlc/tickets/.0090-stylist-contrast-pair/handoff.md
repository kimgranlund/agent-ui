---
id: T-0090
title: "ContrastPair: a Stylist fragment composite that paints text on a background and rates its contrast (ADR-0244)"
type: feature        # feature | bug | chore | spike | idea
status: done       # proposed | ready | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0087, T-0084]          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-12
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The Stylist shows any text-on-background pairing as one ContrastPair that paints the pair and states a computed WCAG contrast ratio with its AA and AAA verdicts, so no ratio is ever stated from the model's head (ADR-0244 cl.3, admission route B).

## Intent
- Do, in order:
  0. Mockup gate. Draw the ContrastPair mockup section (a passing pair, a failing pair, an Unrated pair; light and dark) in the approved visual language (/private/tmp/claude-501/widgets-artifact/own.css and /private/tmp/claude-501/local-artifact/mockups.html; the badge and card rules) and the ADR-0046 container box model. Kim approves it before any code; record the approval under Styling review.
  1. Create the `personas/stylist` fragment (`agent-ui--stylist`): catalog.json with the `ContrastPair` row, factories.ts with the composite, selection.json with its sidecar entry, index.ts and manifest.ts, and tests; wire it into personas/index.ts, personas/manifests.ts, catalog/records.ts and registry-wiring.test.ts (the T-0074 quizmaster fragment is the worked precedent).
  2. The ratio is a pure, DOM-less function beside the factory (node-safe): WCAG 2.x relative luminance; hex `#rgb`, `#rrggbb`, `#rrggbbaa` and `oklch(L C H [/ A])` parsed; a translucent foreground composited over the background first; the displayed ratio truncated to two decimals, never rounded up, and pass or fail decided on the unrounded value; a translucent background or an unparseable value is Unrated.
  3. Teach it: the Stylist preset gets `localPatterns: 'stylist'` and a `seedVersion`; its `palette-presentation` skill says each proposed text-on-background pairing is ONE ContrastPair and the prose never states a ratio the surface did not compute; refresh stylist.manifest.json with its writer; add a catalog preview seed (the T-0064 gate).
  4. Re-measure the derived prompt (ADR-0234): if `agent-ui--stylist` becomes the worst case, re-derive PROMPT_CHAR_BUDGET_DERIVED by its own formula; record the Stylist K6-shape figure in this ticket's report.
- Files (the scope): packages/agent-ui/a2ui/src/catalog/personas/stylist/**, packages/agent-ui/a2ui/src/catalog/personas/{index,manifests}.ts, packages/agent-ui/a2ui/src/catalog/records.ts, packages/agent-ui/a2ui/src/registry/registry-wiring.test.ts, packages/agent-ui/a2ui/src/agent/prompt-budget.ts (only if re-derived), site/lib/agent-manifest/stylist.manifest.json (regenerated), site/pages/agent-admin-presets.ts (the Stylist entry only), the catalog preview seed, .claude/docs/spec/persona-catalog-composition.spec.md (the fragment list).
- Non-goals: a `ui-contrast-pair` fleet control (only on a second preset, ADR-0225 route); a default-catalog row; a `contrastRatio` catalog function; APCA or any second contrast model; the Alchemist's closeness band; any live leg or key.
- Done when: every Acceptance criterion below exits 0 and Kim's mockup approval and parity confirmation are recorded.

## Fork sheet (ADR-0244, the contract)
| Row | Decision |
|---|---|
| Type, home | `ContrastPair`, a composite factory in `personas/stylist` over `ui-card`, `ui-text` and `ui-badge`; no descriptor, no fleet gates, no site page (ADR-0243 cl.2) |
| Anatomy | A `ui-card` with ADR-0046 regions: header (the `label` and the ratio as text, such as "4.62:1") · a sample region painted with the pair (`background` behind, `foreground` ink) showing `sample` large and one line at body size · a verdict row of three pills: AA body (4.5), AA large (3), AAA body (7) · a values line naming both colors |
| Props | `foreground`, `background` (hex or `oklch()`, the ColorPicker formats), `label`, `sample` (default "Aa"); all bindable |
| Computation | As Intent step 2 |
| Events | None; display only, so it mints no `ui-button` and the 36px lg rule holds by construction (producer Buttons elsewhere on the surface follow ADR-0243 Amendment 2) |
| States | Each verdict pill carries a glyph and a word (Pass with a check, Fail with a cross; success or danger intent), never color alone; Unrated shows the raw values and no pills |
| A11y | Role `group` with an `ariaLabel` composed as text: label, both values, the ratio "to 1", and the floors it passes |
| Catalog | Fragment row `ContrastPair`; sidecar use "a text color on a background with its contrast rating"; not for Swatch (one color alone) |

## Acceptance criteria
1. `npx vitest run packages/agent-ui/a2ui/src/catalog/personas/stylist` exits 0. The tests pin known pairs (#000000 on #ffffff reads 21.00:1 and passes all three; #777777 on #ffffff reads 4.47:1 and fails AA body, passes AA large), a pair whose unrounded ratio sits just under 4.5 never displays 4.50, an oklch() pair, a translucent foreground, and both Unrated cases.
2. `npx vitest run packages/agent-ui/a2ui/src/registry/registry-wiring.test.ts packages/agent-ui/a2ui/src/catalog site/lib/agent-manifest` exits 0.
3. `npx vitest run packages/agent-ui/a2ui/src/live-agent/prompt-budget.test.ts` exits 0.
4. `npx vitest run --config vitest.browser.config.ts --project packages-rest packages/agent-ui/a2ui/src/catalog/personas/stylist` exits 0. The browser test asserts by computed style that the sample region paints the given background and ink, the ADR-0046 geometry (ink 6px inside the frame plus region padding 12 inline and 6 block, 8px between regions), and no left-edge accent (no element's left border differs in width or color from its right border).
5. `node scripts/generate-agent-assets.mjs --check` exits 0.
6. `test -f packages/agent-ui/a2ui/src/catalog/personas/stylist/factories.ts && ! grep -q "ui-button" packages/agent-ui/a2ui/src/catalog/personas/stylist/factories.ts` exits 0.
7. `test -s .sdlc/0090-stylist-contrast-pair/parity/mockup.png && test -s .sdlc/0090-stylist-contrast-pair/parity/widget.png` exits 0: the approved mockup section and the rendered preview seed, same width and theme, side by side; Kim confirms parity under Styling review.
8. `npm run check` exits 0 and `npm test` exits 0.
9. No em dash in any added line (generated single-line files that embed unchanged text excepted, say so).

## Context
ADR-0244 (proposed; this ticket stays blocked until Kim ratifies it) admits ContrastPair by route B, the TYPE arm (ADR-0220): the only wire prop that paints a chosen color is `Swatch.value`, so no composition can draw text in one color on another or compute a ratio, while the Stylist is seeded with the AA floors (`contrast-floors`, site/pages/agent-admin-presets.ts:490-494). One preset, so it is a fragment composite (ADR-0243 cl.2) and is promoted to a control only on a second preset (ADR-0225). Since T-0068 a derived catalog inherits the base's mini-skills and exemplars, so the Stylist keeps its teaching; it pays the derived-id line (143 chars in ADR-0243's measure) plus the row (about 190 by the T-0087 probe) on its own turns only. T-0084 lands first so the composite starts on the shared container tokens.

## Constraints
Imports point inward only; the fragment imports nothing from `src/agent/`. Light DOM, ARIA via ElementInternals. Never hand-edit generated files. No border-left highlights. No push without approval. Stop and report blocked if the scope list blocks a file you must touch.

## Styling review
Step 0 mockup APPROVED by Kim 2026-10-12 as drawn (section #cpair of /private/tmp/claude-501/local-artifact/mockups.html; baseline .sdlc/0090-stylist-contrast-pair/parity/mockup.png, light and dark PNGs beside it): ratio as the header number, painted sample, three pills (AA body, AA large, AAA body) each with glyph and word, Unrated card shows raw values and no number. ADR-0244 ratified (#1911). Parity of the built widget against mockup.png is still Kim's to confirm.

## Closed

2026-10-14: merged #1918; Kim signed off 2026-10-14 after the look verifier and two dogfood passes
