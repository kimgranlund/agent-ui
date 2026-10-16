---
id: T-0316
title: "Check defects D1 to D3 found by the T-0314 contract tests"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-16
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
Fix the three check defects `packages/agent-ui/a2ui/src/live-agent/check-contracts.test.ts` and `produce-loop-property.test.ts` (T-0314) holds in its shrink-only allowlists, and shrink each allowlist entry as it is fixed.

## Defects
- D1: `fleetSecretCheck` (`packages/agent-ui/a2ui/src/catalog/hidden-state-checks.ts:212`) reads every clickable BoardGrid with no word cue as a Battleship board, so a tic-tac-toe board gets FLEET_SECRET_MISSING (`KNOWN_CROSS_FIRES`).
- D2: on `a2ui-basic--concierge`, concierge-surface-required asks for ProductCard, Grid or DescriptionList, which that catalog lacks.
- D3 (low): the framed-choice repair tells a2ui-basic turns to drop a CardContent that catalog lacks.

## Done when
- Each defect's allowlist entry is removed and the contract tests stay green; each fix red-first; the catalog and live-agent suites and `npm run check` exit 0.
