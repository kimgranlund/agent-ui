---
id: T-0425
title: "Retire the dead foundations-alias marker exemption from the census rules"
type: chore           # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-23
claimed_by: claude:a8ce3b21 2026-10-23
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
The `foundations-alias` marker exemption that only the census selftests use is removed (or proven live and kept with a reason), so the census gate carries no dead rule.

## Context
From the 2026-10-23 notes triage (verified still true against main):
- notes.md:217: decide: scripts/lib/foundations-rules.mjs:204 note: `ALIAS_MARKER` and the marker exemption at :214 keep working code for a `foundations-alias` marker nothing in packages or site carries any more (only the census selftests use it); the solo report flags the same.

## Constraints
`node scripts/foundations-census.mjs --gate` stays green; no allowlist growth.

## Done when
npm run check plus the touched folders' tests pass; no em dashes in added lines.
- Lane: solo because size L1 (steps.py lane); overnight goal 2026-10-21

## Outcome

2026-10-23 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 00837f149b62
- Changed: Retire the dead foundations-alias marker exemption from the census rules
- Commits: none
- Check: 1 npm run check plus the touched folders' tests pass; no em dashes in added lines: pass
