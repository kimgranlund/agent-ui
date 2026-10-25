---
id: T-0459
title: "Every open decide item in notes.md is sorted into ticket, drop or done for one ruling"
type: chore           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P3         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-25
claimed_by: claude:a8ce3b21 2026-10-25
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
One list sorts every open `decide:` item in `.sdlc/notes/notes.md` into ticket (with a one-line title and size), drop (stale or done, with the evidence) or done (with the commit), so Kim rules it once.

## Context
notes.md holds 149 `decide:` lines; items routed with ` -> T-NNNN` are already handled. Roadmap leftovers to weigh in the same list: the planner-stage parallel-step design (roadmap §3, leg 4), AC19's sheet set, the identity S3-c layout cards, GH #644.

## Constraints
Read-only on code. Do not file tickets or edit notes.md; the list is the deliverable.

## Done when
- A triage list in the artifacts dir covering every unrouted `decide:` item with its source line and a verdict backed by evidence (a file:line, a commit or a test).
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
- `.sdlc/runtime/tasks/0459-notes-triage/triage.md` lists every `decide:` line in `.sdlc/notes/notes.md` that carries no `->` verdict, by line number, and the four roadmap leftovers (leg 4, AC19, S3-c, GH #644).
- Each row has one verdict (ticket with title and size, drop, or done) and evidence a reader can check: a file:line, a commit sha, a test, or a ticket path.
- No tracked file outside `.sdlc/tickets/0459-notes-triage/` changed, and `.sdlc/notes/notes.md` is unchanged.

## Outcome

2026-10-25 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 609287843e27
- Changed: Every open decide item in notes.md is triaged into ticket, drop or done with evidence
- Commits: none
- Check: 1 triage.md lists every unrouted `decide:` line by line number plus the four roadmap leftovers: pass
- Check: 2 each row has one verdict and checkable evidence: pass
- Check: 3 no tracked file outside the ticket dir changed and notes.md unchanged: pass
- Follow-up: note: redck.py deviations printed no process deviation: lines no red... -> notes.md
- Follow-up: note: scripts/e2e-admin/probe/scenarios/shopkeeper.ts:2-3 still says... -> notes.md
