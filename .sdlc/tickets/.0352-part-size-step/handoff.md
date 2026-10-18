---
id: T-0352
title: "Card action parts declare their own size step inside a data-tier region (GH #1940)"
type: bug             # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-17
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A card's action part keeps its own size step inside a `data-tier` region, so the service-card action stays at its intended height instead of growing from 24 to 28.

## Intent
- Do: let a part declare its own step (a `data-scale` or `data-size` on the part that resolves against the region's ramp like any control), and apply it to the service-card, product-card and board-grid action parts (for example `service-card.css:89`, `--ui-service-card-action-height`).
- Non-goals: new per-part tokens (Kim ruled for the part declaring its step, 2026-10-17); changes to the ramp itself.
- Done when: a test asserts the service-card action height outside and inside a `data-tier="widget"` region matches its declared step; the same holds for product-card and board-grid; `npm run check` plus those three control folders' tests exit 0; a before and after screenshot in a widget region.
- If Do needs more steps than this level allows (L1-L2 3, L3 6, L4 10, L5 15), file two tickets.

## Context
GH #1940 (closed into this ticket). Found in lane a06 (T-0099) of the ADR-0245 campaign: parts read the card's own n, and `data-size` on a part cannot change it. Ramp: sm 24 / md 32 / lg 40, widget register 20 / 24 / 28 (AGENTS.md Inner loop).

## Constraints
The foundations census gate stays green; no one-off heights.

## Acceptance criteria
- `npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/components/src/controls/service-card packages/agent-ui/components/src/controls/product-card packages/agent-ui/components/src/controls/board-grid` exits 0, including the T-0352 describes: the service-card and product-card action holds scale.mjs's md step at the root and in product and widget regions at scales sm, md and lg, with and without a card-level `data-size="lg"`, and a host or ancestor token override still reaches the button.
- `npx vitest run packages/agent-ui/components/src/controls/service-card packages/agent-ui/components/src/controls/product-card packages/agent-ui/components/src/controls/board-grid` exits 0.
- `npm run check` exits 0.
- Before and after screenshots in the artifacts dir (`before-widget.png`, `after-widget.png`).
- Kim's ruling 2026-10-17: both actions are md (no visual change at the default card size); board-grid cells scaling with the board is correct, so board-grid is out of scope beyond its stale cell-size comment.

## Outcome

2026-10-17 · lane: full L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 38ce3e9e3c81
- Changed: Card action parts hold the md step; host overrides still reach them (#2116)
- Commits: none
- Check: 1 Browser run of service-card, product-card, board-grid (T-0352 describes: md step at root, product...: pass
- Check: 2 jsdom run of the three folders: pass
- Check: 3 `npm run check`: pass
- Check: 4 Before and after screenshots in the artifacts dir: pass
- Check: 5 Kim's ruling (both actions md, no visual change at the default card size, board-grid out of scope...: pass
- Follow-up: note: git grep finds no other reader of --ui-service-card-action- or... -> notes.md
