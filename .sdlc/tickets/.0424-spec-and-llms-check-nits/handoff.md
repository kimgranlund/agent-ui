---
id: T-0424
title: "response-type-selection spec drops the doubled ask-1 line and generate-llms-full honors --check"
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
response-type-selection.spec.md no longer lists the unflagged ask-1 twice, and `node scripts/generate-llms-full.mjs --check` exits non-zero on drift without writing.

## Context
From the 2026-10-23 notes triage (verified still true against main):
- notes.md:185: fix-now: `.claude/docs/spec/response-type-selection.spec.md:143` AC3e now lists "an unflagged `ask-1`" twice (the narrated `ask-1` item was replaced rather than removed); drop the second.
- notes.md:562: decide: scripts/generate-llms-full.mjs note: it ignores `--check` and writes the file (the tree stayed clean because the bytes matched); `site/lib/llms.test.ts` is its gate.

## Constraints
No change to the generated output itself; check:scripts stays green.

## Done when
npm run check plus the touched folders' tests pass; no em dashes in added lines.
- Lane: solo because size L1 (steps.py lane); overnight goal 2026-10-21

## Outcome

2026-10-23 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 00837f149b62
- Changed: response-type-selection spec drops the doubled ask-1 line and generate-llms-full honors --check
- Commits: none
- Check: 1 Goal: spec no longer lists the unflagged ask-1 twice: pass
- Check: 2 Goal: `generate-llms-full.mjs --check` exits non-zero on drift without writing: pass
- Check: 3 Constraint: no change to generated output: pass
- Check: 4 Done when: npm run check plus touched folders' tests pass: pass
- Check: 5 Done when: no em dashes in added lines: pass
