---
id: T-0324
title: "A blackjack deal that settles needs a two-card 21 (natural); otherwise phase playing with Hit and Stand"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-16
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
Round 8 cluster F, `.sdlc/evals/rounds/2026-10-16-r8-matrix/report.md` (`## Why it failed and how to fix it`): `blackjack-rounds-haiku` (:9) dealt A and 9, called it a natural and settled; BANKROLL_MISMATCH's repair then accepted the settle. NATURAL_ACTIONS checks that a natural has no moves, not that a settled deal is a natural.

## Done when
- A Croupier check: a deal turn that settles without a two-card 21 fails with a named code and a repair asking for phase playing with Hit and Stand; the bankroll repair no longer endorses the false settle; a test from :9 red at the base; the T-0314 contract tests (fixtures for the new check), the catalog and live-agent suites and `npm run check` exit 0.

## Acceptance criteria
- A test from the recorded :9 round 1 (A and 9 settled on the 25 deal) is red at the base (`ff222f19`: BANKROLL_MISMATCH) and green after: the deal gets SETTLED_WITHOUT_NATURAL alone, with a repair asking for phase "playing" with Hit and Stand, and no "settles as a win" payout text; a real natural still settles and is priced: `npx vitest run packages/agent-ui/a2ui/src/catalog/personas/croupier/checks.test.ts -t "T-0324"` exits 0 (exit 1 at the base).
- The T-0314 contract tests, with a `croupier-action-applied` probe for the settled two-card 20: `npx vitest run packages/agent-ui/a2ui/src/live-agent/check-contracts.test.ts` exits 0.
- The catalog, live-agent and probe suites: `npx vitest run packages/agent-ui/a2ui/src/catalog packages/agent-ui/a2ui/src/live-agent scripts/e2e-admin/probe` exits 0.
- `npm run check` exits 0.

## Outcome

2026-10-16 · lane: full L2 · verdict: closed by reason (Merged in the round 8 checks lane; verifier L2 pass) · verifier: none · base: none
- Changed: see commits
- Commits: none
