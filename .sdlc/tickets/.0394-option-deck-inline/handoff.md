---
id: T-0394
title: "OptionDeck gains the ADR-0223 inline opt-out"
type: feature        # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-21
claimed_by: claude:a8ce3b21 2026-10-21
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
ui-option-deck follows ADR-0223 fill-by-default with the one sanctioned opt-out: the reflected `inline` boolean makes the deck hug its content instead of stretching.

## Intent
- Do: add the reflected `inline` boolean prop to ui-option-deck (descriptor `attributes[]`, regenerated props), so `[inline]` drops the T-0388 `inline-size: stretch` fill; a browser test proves the default fills a shrink-to-fit parent and `inline` hugs; decide with evidence whether the catalog row should expose `inline` (match the precedent of other catalog rows) and do it if so.
- Non-goals: any other OptionDeck behaviour.
- Done when: the option-deck browser and visual tests, `sizing-gates.test.ts`, `npm run check` and the whole jsdom suite once exit 0.

## Context
- Raised by the T-0388 verifier (2026-10-21): T-0388 (#2188) made the deck fill unconditionally with `inline-size: stretch`; ADR-0223 names the reflected `inline` boolean as the only opt-out, and option-deck has none. Precedent: ui-option-compare (T-0393) ships `inline`.
- Decided by the conductor under Kim's 2026-10-21 overnight goal ("you make the decisions while I sleep").

## Constraints
- No em dashes; the library ramp; descriptor and generated props stay in sync (never hand-edit `*.props.gen.ts`).
- Lane: solo because size L2 (steps.py lane); overnight goal 2026-10-21

## Acceptance criteria
- `env -u NODE_OPTIONS npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/components/src/controls/option-deck/option-deck.browser.test.ts` exits 0: the default deck fills a shrink-to-fit parent and an `inline` deck hugs its widest card (non-zero, narrower than the parent).
- `env -u NODE_OPTIONS npx vitest run --config vitest.browser.config.ts --project visual packages/agent-ui/components/src/controls/option-deck/option-deck.visual.browser.test.ts` exits 0.
- `env -u NODE_OPTIONS npx vitest run packages/agent-ui/components/src/controls/sizing-gates.test.ts packages/agent-ui/components/src/controls/option-deck` exits 0.
- `env -u NODE_OPTIONS npm run check` exits 0.
- `env -u NODE_OPTIONS npx vitest run` exits 0.
- The OptionDeck catalog row does not expose `inline`: no default catalog row carries an `inline` property, and the OptionCompare precedent ships `inline` on the control only.

## Outcome

2026-10-21 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 05650993413d
- Changed: ui-option-deck gains the reflected inline opt-out (hugs as one column of cards); the catalog row stays without it
- Commits: b5defa9 T-0394: OptionDeck gains the reflected inline opt-out (hugs as one column of cards)
- Check: 1 option-deck browser test (packages project) exits 0: pass
- Check: 2 option-deck visual browser test exits 0: pass
- Check: 3 sizing-gates + option-deck jsdom exits 0: pass
- Check: 4 `npm run check` exits 0: pass
- Check: 5 whole jsdom suite exits 0: pass
- Check: 6 OptionDeck catalog row does not expose `inline`: pass
- Follow-up: note: packages/agent-ui/components/src/controls/option-deck/option-deck.c... -> notes.md
- Follow-up: note: the scratch dir... -> notes.md
