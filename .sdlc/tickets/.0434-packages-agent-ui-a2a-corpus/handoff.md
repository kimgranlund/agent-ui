---
id: T-0434
title: "The A2A concept corpus says the arena plays live on the production site"
type: chore           # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-23
claimed_by: claude:a8ce3b21 2026-10-24
from: T-0430
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
The A2A concept corpus record (packages/agent-ui/a2a/corpus/concept/v0_3_0/a2a.jsonl line 11) describes the arena's live run as it now is: live on the production site through the Worker route /__a2a/arena with a rate limit and caps (T-0430), and in dev through the proxy; the a2a-concepts page that derives from it reads the same.

## Context
T-0430 verifier note: the record still says the live run is dev-only behind a proxy. The corpus is drift-gated; regenerate or re-sync whatever derives from it with its script.

## Constraints
Corpus edits follow the corpus's own drift gate and versioning; never hand-edit generated outputs.

## Done when
The corpus drift gate and the a2a-concepts tests pass; npm run check plus a2a tests pass.
- Lane: solo because size L1 (steps.py lane); overnight goal 2026-10-21

## Outcome

2026-10-24 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: b066d868331f
- Changed: The A2A concept corpus says the arena plays live on the production site
- Commits: none
- Check: 1 The corpus drift gate and the a2a-concepts tests pass; npm run check plus a2a tests pass: pass
- Follow-up: note: packages/agent-ui/a2a/tools/corpus/seeds.ts:254 new body text keeps... -> notes.md
