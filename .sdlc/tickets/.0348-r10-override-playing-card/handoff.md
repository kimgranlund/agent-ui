---
id: T-0348
title: "The surface override does not read a playing card as a UI card (round 10 cluster E)"
type: bug             # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-17
branch: fix/0348-override-playing-card
worktree: ../agent-ui.worktrees/wave-w348
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
'Show me the dealer's hole card.' is not a surface request.

## Intent
- Do: the fix in Context, one cause.
- Non-goals: other round 10 clusters.
- Done when: detectUserOverride on 'Show me the dealer's hole card.' is undefined; 'show me a summary card' stays surface; a catalog with PlayingCard treats game-word cards as not surface. `npm run check` plus the touched folders' tests exit 0.

## Context
response-type.ts:138 detectUserOverride: surface verb plus the noun card. Round 10 :15, :19, :23 (routing-guidance-conflict-haiku). Round 10 report .sdlc/evals/rounds/2026-10-17-r10-targeted/report.md cluster E.

## Constraints
None beyond AGENTS.md.

## Outcome

2026-10-17 · lane: full L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 7b9382202d30
- Changed: Surface override ignores nouns a catalog's own domain types use (#2108)
- Commits: none
- Check: 1 detectUserOverride on 'Show me the dealer's hole card.' is undefined (croupier catalog): pass
- Check: 2 'show me a summary card' stays surface: pass
- Check: 3 a catalog with PlayingCard treats game-word cards as not surface: pass
- Check: 4 `npm run check` plus the touched folders' tests exit 0: pass
- Follow-up: decide: side effects, from a probe that runs detectUserOverride per persona... -> notes.md
- Follow-up: note: the probe scratch dir... -> notes.md
