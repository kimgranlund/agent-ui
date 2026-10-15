---
id: T-0207
title: "Prompt budget enforced against real preset prose; non-selected domain guidance leaves the always-on inventory"
type: feature        # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The budget leg measures the real largest preset `personaSystem` (not a 16 KB assumption) and fails when over; and per-type selection guidance for domains the agent did not select leaves the always-on inventory, so new domain composites stop growing every agent's prompt.

## Context
Evidence: T-0205 map `.sdlc/runtime/tasks/context-archaeology/archaeologist-L1.md`. Ticket B of the five routing-stability tickets Kim approved 2026-10-14.
- `prompt-budget.ts:25,48`: BASE 141 100, DERIVED 142 000; worst measured 140 735. Five raises in 8 days. Over budget only reports unless `promptBudget.mode === 'halt'` (`produce.ts:1165`).
- Preset prose lives in `site/pages/agent-admin-presets.ts` (81 KB) and `agent-admin-libraries.ts`; the budget matrix assumes 16 KB.
- Selection clauses: `system-prompt.ts:187-199`, `selection-guidance.ts:357` (budget 9 300). Domain filter for mini-skills already exists (T-0202, CA-R4); mirror it for inventory guidance.
- Lands before the new patterns T-0193, T-0195 to T-0199.

## Done when
- A budget test that composes each real preset's prompt and fails over budget (seed one oversized preset to show it bites).
- A test that a domain-free agent's prompt contains no croupier-only selection clause.
- Report the new measured worst case and the headroom in the ticket Outcome.
- `npm run check` plus the touched tests.

## Acceptance criteria
- `npx vitest run --project site site/pages/agent-admin-prompt-budget.test.ts` exits 0: every shipped preset's real composed persona, on the catalog it resolves to, stays within `promptBudgetFor` under the worst-case matrix and within the proxy's 16,384-char persona cap; a seeded oversized croupier preset reports over.
- `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/prompt-budget.test.ts` exits 0 on the shared matrix helper.
- `npm run check` exits 0.
- `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/domain-guidance.test.ts` exits 0: a catalog selects its `+` tail's domains or its persona fragment's domain; a fragment-homed domain type the catalog does not select loses its clause and edges (default-homed rows exempt until W2); a plain agent-ui blackjack prompt carries no croupier row, edge or game-table-chrome teaching, and the croupier catalog does (control). Red before the change, green after.
- `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/mini-skills.test.ts` exits 0: game-table-chrome is the one module retagged `domain: games`.
- The prompt-equivalence baseline is unchanged (no shipped inventory line moves; Kim's call B, 2026-10-14).

## Constraints
No em dashes. Never hand-edit generated files; rerun their scripts. Live spend only through `chat:probe` under the stated cap.

## Outcome

2026-10-14 · lane: solo L2 · verdict: closed by reason (Merged in #1993; batched verifier L2 pass) · verifier: none · base: none
- Changed: Budget test on real presets; domain-guidance filter (inert until W2); game-table-chrome scoped to games
- Commits: none
