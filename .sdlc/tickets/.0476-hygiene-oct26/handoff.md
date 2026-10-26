---
id: T-0476
title: "Notes routing, probe seed digest and prompt budget headroom"
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
The T-0459 triage items read routed, a live chat-probe fixture records the persona seed digest, and the prompt budget test documents the croupier headroom.

## Context
Open follow-ups: T-0459 triage left items unmarked in `.sdlc/notes/notes.md` (add ` -> T-NNNN` or a ruling); `scripts/chat-probe.mjs` fixtures carry no seedVersion or digest (T-0457 note); croupier is at 138 880 of 150 200 prompt tokens (T-0429 note, `site/pages/agent-admin-prompt-budget.test.ts`). Also mark the T-0457 notes item claiming run 3 ends in a Select scene as wrong (` -> dropped T-0473: run 3 ends in a BookingForm`) and carry the dropped T-0473 folder. Wave 4.

## Constraints
No model-read text changes. No em dashes.

## Done when
- The roadmap Open follow-ups list drops the triaged items.
- A live fixture written by chat:probe includes the persona seedVersion and digest.
- `npm run check` plus the touched folders' tests pass.
- Lane: solo because size L1 (steps.py lane)

## Outcome

2026-10-26 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 2997308cdb72
- Changed: Notes items triaged by T-0459 read routed, and a live chat:probe fixture records the persona seedVersion and seed digest
- Commits: none
- Check: 1 The roadmap Open follow-ups list drops the triaged items: pass
- Check: 2 A live fixture written by chat:probe includes the persona seedVersion and digest: pass
- Check: 3 `npm run check` plus the touched folders' tests pass: pass
- Check: 4 Lane: solo because size L1: pass
- Follow-up: note: .sdlc/notes/notes.md: line 267 ui-button pressed tone stays... -> notes.md
