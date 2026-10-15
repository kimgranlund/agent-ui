---
id: T-0089
title: "ResultCard: a default-catalog ui-result-card for game ends and settled summaries (ADR-0244)"
type: feature        # feature | bug | chore | spike | idea
status: done       # proposed | ready | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0087, T-0084]          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-12
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Every game preset ends on one ResultCard that states the outcome in words, shows the final figures and holds the restart Button, so no game dead-ends and the end state is visible on the wire (ADR-0244 cl.2, admission route C).

## Intent
- Do, in order:
  0. Mockup gate. Draw the ResultCard mockup section (win, loss, draw and done states; light and dark) in the approved visual language: the `.hud`, `.stat`, `.btn` and `.actions` rules of the widget mockups (/private/tmp/claude-501/widgets-artifact/own.css, /private/tmp/claude-501/local-artifact/mockups.html) and the ADR-0046 container box model. Kim approves it before any code; record the approval under Styling review. No build starts on an unapproved mockup.
  1. Build `ui-result-card` per the fork sheet below (ADR-0233: descriptor, generated props and registry), with its doc page, nav entry and a visual baseline.
  2. Add the default row `ResultCard` (props outcome, title, summary, stats; children ChildList), its selection.json sidecar entry and the reciprocal notFor edges the sidecar gate forces, an example seed (the T-0064 preview coverage gate), then regenerate `assets.gen.ts` and the selection projection and recapture the prompt baseline deliberately (skill a2ui-prompt-authoring), never to get green.
  3. Teach it: the End state sentence of the board-grid, guess-hud, word-tiles, color-duel, deal-sheet and quest-log packs, the Quizmaster `grand-reveal` workflow (a Modal holding one ResultCard) and the Travel Agent `trip-plan` closing summary become ONE ResultCard (outcome, title, summary, final stats) whose child is the Play again Button (its action context carries newGame true). Bump `seedVersion` wherever seeded text changes so saved stores pick it up (the T-0082 precedent).
  4. Re-measure K6 (the response-type LLD section 4 script; the T-0087 probe is a ready copy) and record it in the PRD K6 row with this ticket id; it must stay under 46,430.
- Files (the scope): packages/agent-ui/components/src/controls/result-card/**, the generated registry files, the site doc page and nav, packages/agent-ui/a2ui/src/catalog/default/{catalog.json,selection.json} and its example seed, packages/agent-ui/a2ui/src/agent/assets.gen.ts and the prompt baseline (regenerated), the selection projection (regenerated), site/pages/agent-admin-libraries.ts, site/pages/agent-admin-presets.ts, the affected site/lib/agent-manifest/*.manifest.json (regenerated), .claude/docs/spec/a2ui-catalog.spec.md (one row), .claude/docs/prd/response-type-selection.prd.md (K6 row).
- Non-goals: the Croupier (CardTable keeps its status and Deal again children); an `action` prop on the row (rejected in ADR-0244); renderer changes (T-0081); a new mini-skill; any live leg or key.
- Done when: every Acceptance criterion below exits 0 and Kim's mockup approval and parity confirmation are recorded.

## Fork sheet (ADR-0244, the contract)
| Row | Decision |
|---|---|
| Tag, class | `ui-result-card`, `UIResultCardElement`; descriptor `result-card.md`; base `UIElement` (display with data props, not form-associated); tier `pattern`; light DOM; fill-by-default with the reflected `inline` opt-out (ADR-0223) |
| Anatomy | Card surface with ADR-0046 regions. `[data-part="header"]`: `[data-part="outcome"]` (glyph plus outcome word pill) and `[data-part="title"]` · `[data-part="summary"]` · `[data-part="stats"]` with one `[data-part="stat"]` per entry (label, value, signed delta; the GameHud stat look) · the producer's children follow as direct host children and form the actions row |
| Props | `outcome` (enum win, lose, draw, done; default done; reflected), `title`, `summary`, `stats` (the GameHud stat shape `{label, value, delta, intent}`, at most 4; extras dropped with a catalog warning, valueless entries dropped, ADR-0201); all bindable. Children ChildList (the producer's Buttons). No `action` prop |
| Events | None of its own; each action is the producer's own Button, so no host click wiring exists and a click on the summary never restarts |
| Geometry | `pattern` tier, container spacing, no new geometry row. The control stamps `size="lg"` on every direct `ui-button` child (36px; the `personas/action-row.ts` behaviour re-homed, components cannot import a2ui) |
| Tokens | `--ui-result-card-*` over `--md-sys-color-*`: win success, lose danger, draw warning, done neutral |
| States | Outcome always shows word plus glyph (Win check, Loss cross, Draw equals, Done dot; final words and glyphs per the approved mockup), never color alone. Empty summary or stats renders no box. No children renders no actions row (taught, a named prompt-only residual) |
| A11y | Role `group` via internals, `ariaLabel` from the outcome word and title; the header is a polite live region so a changed outcome is announced once (the GameHud status precedent); deltas are signed text |
| Catalog | Default row `ResultCard`; sidecar use "the settled outcome of a game, deal or booking with its next action"; not for GameHud (the live score while play goes on), Toast (a passing round result) |
| Site surfaces | Descriptor, doc page and nav entry, catalog preview seed, visual baseline |

## Acceptance criteria
1. `npx vitest run packages/agent-ui/components/src/controls/result-card` exits 0 (unit tests and descriptor drift; they cover the four outcomes, word plus glyph, the stats cap and valueless-entry drop, and the empty-box law).
2. `npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/components/src/controls/result-card` exits 0. The browser test asserts ADR-0046 geometry by computed style (ink 6px inside the frame plus region padding 12 inline and 6 block, 8px between regions, and no left-edge accent: no element's left border differs in width or color from its right border) and that every direct `ui-button` child carries size lg and renders 36px tall at the default scale.
3. `npx vitest run packages/agent-ui/components/src/controls/sizing-gates.test.ts packages/agent-ui/components/src/controls/naming-gates.test.ts packages/agent-ui/components/src/controls/styling-gates.test.ts` exits 0.
4. `npx vitest run packages/agent-ui/a2ui/src/catalog/default packages/agent-ui/a2ui/tools/registry/generate.test.ts` exits 0 (descriptor agreement, catalog-or-allowlist, sidecar edges, projection drift).
5. `node scripts/generate-agent-assets.mjs --check` exits 0.
6. `test -f packages/agent-ui/components/src/controls/result-card/result-card.css && ! grep -q "border-left" packages/agent-ui/components/src/controls/result-card/result-card.css` exits 0.
7. `test -s .sdlc/0089-result-card/parity/mockup.png && test -s .sdlc/0089-result-card/parity/widget.png` exits 0: the approved mockup section and the rendered catalog seed, same width and theme, side by side; Kim confirms parity under Styling review.
8. `grep -q "T-0089" .claude/docs/prd/response-type-selection.prd.md` exits 0 (the K6 re-measure is recorded, under 46,430).
9. `npm run check` exits 0 and `npm test` exits 0.
10. No em dash in any added line (generated single-line files that embed unchanged text excepted, say so).

## Context
ADR-0244 (proposed; this ticket stays blocked until Kim ratifies it) admits ResultCard by route C: the end-state law ("say win or lose, offer Play again") is restated in six packs (site/pages/agent-admin-libraries.ts:249-300) and the grand-reveal workflow (site/pages/agent-admin-presets.ts:567), each a Badge plus a Button or a Modal of five components, and nothing on the wire tells a finished game from a live one. K6 today 45,454 of 46,430; the T-0087 probe prices this row at +286, about 18 percent low by the ADR-0243 calibration (predicted 835, measured 985). Kill switch (ADR-0244 Consequences): if the persona leg shows games still ending on a bare Badge and Button, drop the row and keep the pack text. T-0084 lands first so the control starts on the shared container tokens. Related: T-0081 (renderer action forwarding; not needed here).

## Constraints
Imports point inward only. Light DOM, ARIA via ElementInternals. Events only from the closed set. Never hand-edit generated files. Action Buttons at the lg step, never a custom height. No border-left highlights. No push without approval. Stop and report blocked if the scope list blocks a file you must touch.

## Styling review
Step 0 mockup APPROVED by Kim 2026-10-12 as drawn (section #rcard of /private/tmp/claude-501/local-artifact/mockups.html; baseline .sdlc/0089-result-card/parity/mockup.png, light and dark PNGs beside it): outcome pill (glyph plus word on a tinted container), title, summary, up to four stats, 36px buttons, empty-box law. ADR-0244 ratified (#1911 in the merge queue). Build starts after T-0084 (#1906) merges. Parity of the built widget against mockup.png is still Kim's to confirm.

## Closed

2026-10-14: merged #1919; Kim signed off 2026-10-14 after the look verifier and two dogfood passes
