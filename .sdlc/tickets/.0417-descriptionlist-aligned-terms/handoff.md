---
id: T-0417
title: "DescriptionList lines up its term column and stacks term over value when narrow"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-22
claimed_by: claude:a8ce3b21 2026-10-22
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
ui-description-list (the DescriptionList catalog type) lays out its rows on one shared grid, so every term sits in one column of the width of the longest term and every value starts at the same edge (Kim 2026-10-22, before-meal-plan.png: Monday, Wednesday and Thursday values each start at a different x, and wrapped value lines hang under the value, not the term). At a narrow container the term stacks above its value. Keys, receipts and the meal-plan use all improve.

## Intent
- Do: find why rows do not share a column (each row its own grid or flex instead of one grid with subgrid or display: contents rows) and fix it in the control CSS (and DOM only if needed), keeping the existing parts, ARIA and props. Add the narrow stacking with a container query at the width the component standards use. Browser tests: terms of different lengths share one value x in a wide container; wrapped value lines align to the value edge; under the narrow threshold term and value stack. Before and after screenshots of the meal-plan shape (seven day rows with long values) at 400px and wide, light and dark, in the ticket folder; compare against the before.
- Non-goals: new props; the heading scale (T-0418); the catalog row text.
- Done when: the new browser tests fail on main and pass after; `npm run check`, the description-list folder's jsdom and browser tests, the dogfood-render sweep for its demo and the foundations census gate exit 0.

## Context
Screenshot before-meal-plan.png. Control under packages/agent-ui/components/src/controls/ (grep description-list). Skills component-build, component-standards, component-testing. Sizing law: root AGENTS.md (fill-by-default, foundations geometry, no px literals).

## Constraints
No em dashes. Never hand-edit *.props.gen.ts. Never re-monolith the browser shards.
- Lane: solo because size L1 (steps.py lane); overnight goal 2026-10-21

## Acceptance criteria
- The T-0417 browser tests (shared value x, wrapped lines on the value edge, stacking below 20rem, the stacked pair gap, side by side at 368px) pass in Chromium and WebKit, and the three red ones failed on main before the CSS change: `env -u NODE_OPTIONS npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/components/src/controls/description-list/description-list.browser.test.ts`
- The description-list jsdom tests pass: `env -u NODE_OPTIONS npx vitest run packages/agent-ui/components/src/controls/description-list`
- The dogfood-render sweep for the demo and the catalog widget passes: `env -u NODE_OPTIONS npx vitest run --config vitest.browser.config.ts --project site site/pages/dogfood-render.browser.test.ts -t "description-list|DescriptionList"`
- The foundations census gate is green: `env -u NODE_OPTIONS node scripts/foundations-census.mjs --gate`
- The regenerated llms corpus matches the descriptor: `env -u NODE_OPTIONS npx vitest run site/lib/llms.test.ts`
- The standing gate is green: `env -u NODE_OPTIONS npm run check`
- Before and after screenshots (340, 400, 720 px; light and dark) sit in `.sdlc/tickets/0417-descriptionlist-aligned-terms/shots/`; the after set shows one term column at 720px and 400px (a 368px content box is over the 20rem boundary) and term over value, pairs parted by the pair gap, at 340px.
- Kim 2026-10-22 (AskUserQuestion after the pass): side-by-side at the 400px column; lower the stack breakpoint to 20rem and add a gap between stacked pairs.

## Outcome

2026-10-22 · lane: solo L1 · verdict: pass · verifier: verifier-L3 (fable) · base: 07a5c2afaa9d
- Changed: DescriptionList rows share one subgrid term column; below 20rem the term stacks over its value with a gap between pairs
- Commits: none
- Check: 1 The T-0417 browser tests (shared value x, wrapped lines on the value edge, stacking below 20rem, ...: pass
- Check: 2 The description-list jsdom tests pass: pass
- Check: 3 The dogfood-render sweep for the demo and the catalog widget passes: pass
- Check: 4 The foundations census gate is green: pass
- Check: 5 The regenerated llms corpus matches the descriptor: pass
- Check: 6 The standing gate is green: pass
- Check: 7 Before and after screenshots (340, 400, 720 px; light and dark) sit in the shots folder; the afte...: pass
- Check: 8 Kim 2026-10-22 (AskUserQuestion after the pass): side-by-side at the 400px column; lower the stac...: pass
