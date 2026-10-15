<!-- role=verifier level=L2 model=sonnet effort=high -->
## Verdict
pass

## Criteria
- #1 composite buttons lg, ProductCard props, seeds: pass. Evidence: `npx vitest run --project packages <personas, product-card, board-grid, game-hud, product-card-action.test.ts, examples>` exit 0, 26 files, 483 tests. Covers croupier card-table, quizmaster question-card, agent-manifest and capability-registry-adjacent tests in the full run below.
- #2 real-engine geometry: pass. Evidence: `npx vitest run --config vitest.browser.config.ts --project packages <product-card.browser.test.ts, board-grid.browser.test.ts>` exit 0, 4 files, 26 tests. Assertions are concrete (action height `toBe(36)`, fontSize 16px, outline 2px solid, media `grayscale(1)`, opacity 0.45, cells 46px, narrow board < 46 and >= 34, 12-col board exactly 34, half star `::before` width = half), so they go red on the old 28px/52-floor code.
- #3 ProductCard goldens: pass. Evidence: `--project visual packages/agent-ui/components/src/controls/product-card` exit 0, 4 tests (three re-baselined PNGs in the diff).
- #4 prompt budget and baseline: pass. Evidence: prompt-budget.test.ts and prompt-equivalence.test.ts exit 0, 52 tests. K6 re-measured with the LLD section 4 script (loadCatalogById agent-ui, buildSystemPromptSections(c, [], undefined, []), renderSurfaceTool([])): 44,811 + 643 = 45,454, under 46,430. Budget arithmetic: croupier worst case 140,801 rounds up to the next 100 (140,900) plus 300 = 141,200, matching `PROMPT_CHAR_BUDGET_DERIVED = 141_200` in prompt-budget.ts.
- #5 standing gates: pass. Evidence: `npm run check` exit 0; `npm test` exit 0 (724 files passed, 2 skipped; 15,185 tests passed, 7 skipped).
- #6 ADR-0243 Amendment 2: pass. Evidence: the grep -c prints 1 and exits 0. Added lines in the ADR diff contain 0 em dashes.
- #7 screenshots: pass. Evidence: .sdlc/0083-widgets-match-mockups/screens/ holds mockup-*, before-real-*, after-real-*, side-by-side-{pc,bg,ct,gh,qc}.png plus before/after-measure.json. after-measure.json shows the ProductCard Book buttons at h 36, font 16px (weight 400, accepted).

Mockup parity, judged from the side-by-side PNGs:
- ProductCard: five-star rating with number and count, struck old price, selected (primary outline plus ghost "Selected"), disabled (grey media plus faded "Unavailable") all match the mockup. The catalog-page specimen shows the same states.
- BoardGrid: 46px cells, with hit (danger ink), miss and sunk (success ink) marks in the new battle-board example; matches the mockup. Wordle tiles are fine.
- CardTable: green "Your turn" pill, "showing 9", medium cards (75px, accepted), Hit, Stand and Double at 36px.
- GameHud: green "Your turn" check pill matches.
- QuestionCard Check answer is at lg; option rows are unchanged.

## Out of scope changes
None. The diff from 30b5b5f7 touches only the controls, personas, examples, catalog default rows, generated files, ADR-0243, the spec and PRD wording, the budget and baseline, and the site preview files, all in the ticket's scope. Working tree is clean of tracked changes. The base sha 30b5b5f7 is a real commit (the shas in the brief resolve, so the diff scope check was done against it).

## For the next attempt
None.

NOTES (not failures):
- `largeActionButtons` in /Users/kimgranlund/Projects/nonoun/agent-ui/.claude/worktrees/wave-wm/packages/agent-ui/a2ui/src/catalog/personas/action-row.ts never disconnects its MutationObserver; it is collected with the root, so harmless.
- Button font weight stays 400 (accepted decision); the mockup was 600.
- The product-presentation mini-skill still lists the old ProductCard props (known nit).
