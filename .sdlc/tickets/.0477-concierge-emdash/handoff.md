---
id: T-0477
title: "Remove the em dash in the concierge Surface style"
type: chore           # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P3         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-26
claimed_by: claude:a8ce3b21 2026-10-26
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
`site/agent-content/personas/concierge/agent.md:67` carries no em dash.

## Context
Pre-existing em dash noted by T-0457. Model-read text, so the debate rule applies. Wave 4.

## Constraints
Opus author, Fable (verifier L3) review. Regenerate the manifest seedDigest and re-pin `site/pages/agent-admin-seed-digests.test.ts`. No em dashes.

## Done when
- `grep -n '—' site/agent-content/personas/concierge/agent.md` exits 1.
- `npm run check` plus the touched folders' tests pass.
- Lane: solo because size L1 (steps.py lane)

## Outcome

2026-10-26 · lane: solo L1 · verdict: pass · verifier: verifier-L3 (fable) · base: 2997308cdb72
- Changed: The concierge Surface style carries no em dash (four replaced with plain punctuation), seed digests re-pinned
- Commits: none
- Check: 1 `grep -n '—' site/agent-content/personas/concierge/agent.md` exits 1: pass
- Check: 2 `npm run check` plus the touched folders' tests pass: pass
- Check: 3 Lane: solo because size L1 (steps.py lane): pass
- Follow-up: decide: .sdlc/tickets/0477-concierge-emdash/handoff.md:22 Constraints say... -> notes.md
- Follow-up: note: site/agent-content/personas/concierge/agent.md:4 keeps "version"... -> notes.md
- Follow-up: note: site/agent-content/personas/concierge/agent.md:63 ...unless the... -> notes.md
