---
id: T-0210
title: "Every catalog id reader handles the multi-domain grammar (<base>--<d1>+<d2>)"
type: chore           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Every reader of a catalog id parses it through `catalog-id.ts`, so a multi-domain id (`<base>--<d1>+<d2>`) gets the right guidance, budget key and catalog instead of silently falling back to base.

## Context
Evidence: T-0205 map `.sdlc/runtime/tasks/context-archaeology/archaeologist-L1.md`. Ticket E of the five routing-stability tickets Kim approved 2026-10-14.
- Known readers: `promptBudgetFor` keys on `includes('--')`; `selectionGuidanceForId` splits at the first `--`. The catalog SPEC lists the other sites (W1, W2).
- Grammar: `catalog/catalog-id.ts:13-40` (T-0202 `a14d176f`).

## Done when
- A test per reader with a two-domain id.
- A grep shows no ad hoc `split('--')` or `includes('--')` on catalog ids outside `catalog-id.ts`.
- `npm run check` plus the touched tests.

## Constraints
No em dashes. Never hand-edit generated files; rerun their scripts. Live spend only through `chat:probe` under the stated cap.

## Outcome

2026-10-15 · lane: full L1 · verdict: closed by reason (Merged in #2008: splitCatalogId and isDerivedCatalogId; every catalog id reader uses them; two-domain test) · verifier: none · base: none
- Changed: see commits
- Commits: none
