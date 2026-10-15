---
id: T-0223
title: "Quizmaster and Stylist inner boxes use the card's inner child radius, not corner-base minus 2px"
type: chore           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Quizmaster and Stylist inner boxes in `packages/agent-ui/a2ui/src/catalog/personas/*/factories.ts` take the card's inner child radius (`--ui-card-child-radius`), as CardTable's felts do since T-0204 (#1991), instead of `corner-base - 2px`.

## Done when
- A browser test per composite asserts the inner box radius is below the card's (pattern: `box-region.browser.test.ts` from T-0204).
- `npm run check` plus the touched folders' tests exit 0.

## Acceptance criteria
- (red) `npx vitest run -c vitest.browser.config.ts --project packages packages/agent-ui/a2ui/src/catalog/personas/box-region.browser.test.ts` exits 0: in both engines the QuestionCard option rows and explanation, and the ContrastPair sample, sit below the card radius and equal the card's child radius (`--ui-card-child-radius`).
- `npm run check` exits 0.
- Before and after screenshots of the QuestionCard and the ContrastPair (Chromium and WebKit) are in the report.

## Outcome

2026-10-14 · lane: full L2 · verdict: closed by reason (Merged in #1997; batched lane verifier L2 pass) · verifier: none · base: none
- Changed: see commits
- Commits: none
