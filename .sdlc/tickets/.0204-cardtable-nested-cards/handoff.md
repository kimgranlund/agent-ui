---
id: T-0204
title: "CardTable surface nests bordered cards: doubled borders and repeat-rounded children"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
A live Croupier CardTable surface in Test Chat shows one bordered, rounded container per level that needs it: no doubled borders, no concentric rounded corners a few px apart, no border clipped or overflowing on the right edge. A test that fails today passes after the fix.

## Repro
1. `npm run dev`, open agent-admin Test Chat, Croupier preset, Sonnet 5.5 or Haiku 5.5.
2. Say "Let's play blackjack", press a bet.
3. Look at the CardTable surface at a narrow (about 210px wide crop shown) or normal chat width.

## Expected
One card frame for the table (or none, if the chat surface frame already draws it). The Dealer and You hand regions are flat or quietly filled, with a radius that derives from the parent (concentric: inner radius = outer radius minus inset) or none. Playing cards keep their own radius. Nothing overflows the frame edge.

## Actual
Kim's screenshots 2026-10-14: the outer surface frame and the CardTable `ui-card` each draw a border, producing two rounded corners a few px apart at the top left; the hand regions are another rounded filled box inside; the right edge of the hand rows and cards overflows the frame (border cut off, cards bleed past it).

## Context
- CardTable is a region-less `ui-card` root (`packages/agent-ui/a2ui/src/catalog/personas/box-region.ts`, `croupier/factories.ts`). Guess: the A2UI surface frame in chat, the CardTable `ui-card`, and possibly a producer-emitted Card wrapper stack up; the hand rows have no `min-width: 0` or overflow handling.
- The dogfood render lint (`site/pages/dogfood-render.browser.test.ts`, nested cards rule, `.claude/docs/references/dogfood-lint.md`) checks demo and catalog widgets but evidently not this composite in the chat surface. Extend it, or add a CardTable render test, so nested bordered containers and right-edge overflow fail.
- If the producer wraps CardTable in a Card, also add a croupier check or prompt rule against it.
- Geometry: ADR-0245, A2UI surface at widget/md.

## Constraints
The failing test lands with the fix. Evidence is a before and after screenshot of the real CardTable in Test Chat (inner loop rule). Gate: `npm run check` plus the touched folders' tests.

Kim's screenshots: before-kim-1.png (whole table), before-kim-2.png (the doubled top-left corner), beside this handoff.

## Acceptance criteria
- (red) The surface and the working glow share the card root's corner: `npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/app/src/controls/surface-host/surface-host.browser.test.ts` exits 0 (the T-0204 case was 22px against 18px before the fix, both engines).
- (red) The CardTable felts and result line nest inside the card corner: `npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/a2ui/src/catalog/personas/box-region.browser.test.ts` exits 0 (felt 18px against card 18px before).
- The jsdom tests of the touched folders stay green: `npx vitest run packages/agent-ui/app/src/controls/surface-host/ packages/agent-ui/a2ui/src/catalog/personas/` exits 0.
- The dogfood render lint stays green over the CardTable seeds: `npx vitest run --config vitest.browser.config.ts --project site site/pages/dogfood-render.browser.test.ts` exits 0.
- `npm run check` exits 0.
- Evidence beside this handoff: before-probe-dark.png and after-probe-dark.png (chat-probe replay croupier-haiku-hit, dark, the surface host), before-working-300.png (the working glow at 22px around the 18px card).
- Right-edge overflow did not reproduce (bare host at 200 to 480px and the real page at 640 and 1440px: every CardTable part ends at least 19px inside the host); not changed.

## Outcome

2026-10-14 · lane: solo L2 · verdict: closed by reason (Merged in #1991; verifier L2 pass in wave-nc) · verifier: none · base: none
- Changed: A card-rooted surface takes the card's corner; CardTable felts use the inner radius
- Commits: none
