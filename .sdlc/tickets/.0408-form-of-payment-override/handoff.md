---
id: T-0408
title: "detectUserOverride no longer reads 'a form of payment' as a request for a surface"
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
A user turn like "make me a form of payment" or "what forms of payment do you take" is not read as an explicit surface request by `detectUserOverride` (packages/agent-ui/a2ui/src/agent/response-type.ts), while "make me a form", "build a form for the booking" and "make me a form of the order details" still force a surface.

## Intent
- Do: in response-type.ts, exclude the noun phrase "form(s) of payment" from the surface noun match, the same way `list` excludes "list of" and the table-of-contents exclusion at :200 (an explicit lookahead, not a broad change to NOUN_END). Add cases to the response-type tests beside it: the payment phrasings stay non-surface, the three positive phrasings above still force a surface. Show the new negative case red on main first.
- Non-goals: any prompt text under packages/agent-ui/a2ui/src/agent/prompts/; other nouns.
- Done when: the new tests fail on main and pass after; `npm run check` and `npx vitest run packages/agent-ui/a2ui/src/agent packages/agent-ui/a2ui/src/live-agent` exit 0; prompt-equivalence baseline unchanged.

## Context
From .sdlc/notes/notes.md :381: "of" is in NOUN_END (:154), so "a form of payment" after a build verb forces a surface in concierge. Spec .claude/docs/spec/response-type-selection.spec.md.

## Constraints
No em dashes. The prompt stack is byte-pinned.
- Lane: solo because size L1 (steps.py lane); overnight goal 2026-10-21

## Outcome

2026-10-22 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 1cfb3396050a
- Changed: detectUserOverride excludes 'form(s) of payment' from the surface noun match; build-a-form phrasings still force a surface
- Commits: none
- Check: 1 the new tests fail on main and pass after: pass
- Check: 2 `npm run check` exits 0: pass
- Check: 3 `npx vitest run packages/agent-ui/a2ui/src/agent packages/agent-ui/a2ui/src/live-agent` exits 0: pass
- Check: 4 prompt-equivalence baseline unchanged, no prompt text touched: pass
- Check: 5 exclusion is an explicit lookahead, not a NOUN_END change: pass
