---
id: T-0354
title: "Explicit format asks ('as a card', 'as a table', 'build me a form') force a surface even where the catalog owns the noun"
type: bug             # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-17
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
An explicit format ask ("as a card", "as a table", "build me a form", "show me a summary card") forces a surface in every catalog, while a game word that a catalog's domain types own ("show me the cards", "show me the dealer's hole card") still does not.

## Repro
1. `detectUserOverride('as a card', croupierTypes)` and `detectUserOverride('build me a form', conciergeTypes)` return no override today (T-0348 verifier probe, 2026-10-17).

## Expected
Both return the surface override. `show me the cards` in croupier still returns none.

## Actual
No override: T-0348's domain-noun rule drops `card`, `table` and `form` for catalogs whose domain types contain them.

## Context
Kim's ruling 2026-10-17: keep T-0348's domain-noun rule, but exempt explicit format phrasing. Code: `packages/agent-ui/a2ui/src/agent/response-type.ts` (`detectUserOverride`, domainSurfaceNouns). The T-0348 verifier listed the lost asks per catalog (croupier, quizmaster, concierge). Spec: response-type-selection RTS-R6.

## Constraints
The failing test lands before or with the fix. No prompt text changes.

## Outcome

2026-10-18 · lane: full L1 · verdict: pass · verifier: verifier-L1 (opus) · base: ecad202386a5
- Changed: Explicit format asks force a surface in owning catalogs (#2125)
- Commits: 45dcca5 T-0354: Explicit format asks force a surface where the catalog owns the noun (#2125)
- Check: 1 Goal: explicit format asks ("as a card", "as a table", "build me a form", "show me a summary card...: pass
- Check: 3 Expected: "show me the cards" in croupier still returns none: pass
- Check: 4 Constraint: the failing test lands with the fix, and no prompt text changes: pass
- Follow-up: decide: packages/agent-ui/a2ui/src/agent/response-type.ts:177 "show me a... -> notes.md
- Follow-up: decide: packages/agent-ui/a2ui/src/agent/response-type.ts:177 the solo... -> notes.md
- Follow-up: decide: packages/agent-ui/a2ui/src/agent/response-type.ts:224 "make me a... -> notes.md
- Follow-up: note: the default catalog also changed -> notes.md
- Follow-up: note: I could not remove the scratch probe dir... -> notes.md
