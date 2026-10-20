---
id: T-0382
title: "Blackjack: A2UI update renders before the turn summary"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-19
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
After a player action in blackjack (hit, stand, double), the A2UI surface update renders first and the text summary of the turn appears last. A test that failed before the fix passes after it.

## Repro
1. Start a blackjack game with the croupier persona in a chat surface (reported by Kim 2026-10-19; the exact surface was not named, so check the agent-admin Test Chat and the site chat).
2. Click hit, stand or double.

## Expected
The surface updates (cards, totals, HUD) render, then the summary text appears below or after them.

## Actual
The summary text appears before the A2UI output renders for that turn.

## Context
Reported by Kim 2026-10-19 from a live session. Croupier persona: `packages/agent-ui/a2ui/src/catalog/personas/croupier/`; recorded turns in its `__fixtures__/`.
Guess, not verified: either the model emits prose before the A2UI messages and the chat shows streamed text as it arrives while the surface waits for its messages, or the chat host paints text and surface in the order they arrive. Find which (producer order, prompt teaching, or host rendering) before fixing. A fix in a model-read prompt follows the debate rule, and grammar.md is byte-pinned (Kim's ruling only).

## Constraints
The failing test lands before or with the fix, never after. Prefer a fix in the host or producer ordering over teaching-only steering, because models do not reliably follow ordering instructions.

## Acceptance criteria
- (red) `npx vitest run packages/agent-ui/app/src/controls/conversation/conversation.test.ts -t T-0382` exits 0: a resumed action-click turn holds its streamed summary until finalize, after the surface update.
- `npx vitest run packages/agent-ui/app/src/controls/conversation/conversation.test.ts` exits 0: fresh-bubble turns still stream text live (RTS-R5 AC3).
- `npm run check` exits 0.

## Plan review
- Kim 2026-10-19: paint order is enough; the summary stays above the card on a reopened bubble (GH #1221 layout kept).
- Conductor 2026-10-19: the inherited red at site/pages/agent-admin-app.ts:1721 was this worktree's whole-dir node_modules symlink (a second copy of the components types). main is green, and with lane-local @agent-ui links `npm run check` exits 0 here. Reverify.

## Outcome

2026-10-19 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 64c8bd6afd41
- Changed: the turn summary paints after the A2UI surface update on a reopened bubble
- Commits: 58f78a8 T-0382: note the worktree install fix; 1145338 T-0382: record Kim's ruling on summary position; 6556461 T-0382: Blackjack: A2UI update renders before the turn summary
- Check: 1 (red) T-0382 test exits 0: pass
- Check: 2 full conversation.test.ts exits 0: pass
- Check: 3 `npm run check` exits 0: pass
- Follow-up: note: conversation.browser.test.ts was not run not a named criterion; it... -> notes.md
