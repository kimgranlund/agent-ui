---
id: T-0414
title: "The four mini-skill calibration rejection paths get vitest coverage"
type: chore           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-22
claimed_by: claude:a8ce3b21 2026-10-22
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
The four `calibration:` rejection paths in packages/agent-ui/a2ui/src/agent/mini-skills.ts (:94-98, :113-121: non-positive value, non-agent-ui catalog, domain entry, duplicate) are pinned by vitest, so a regression that silently accepts a bad calibration goes red.

## Intent
- Do: refactor only as far as needed to call the validation on a planted asset in a test (export the pure validator, or a factory that takes the asset list), then add one case per rejection path plus one accepted case. Each new rejection case must fail if its guard is removed (show one guard removed and the case red, then restore).
- Non-goals: prompt text; the shipped calibration values.
- Done when: the new tests pass and one guard-removal run is red; `npm run check` and `npx vitest run packages/agent-ui/a2ui/src/agent` exit 0; prompt-equivalence baseline unchanged.

## Context
From .sdlc/notes/notes.md :133 (T-0209 verifier). The paths fire only at module load from a planted asset today.

## Constraints
No em dashes. The prompt stack is byte-pinned.
- Lane: solo because size L1 (steps.py lane); overnight goal 2026-10-21

## Outcome

2026-10-22 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 6762132bd16c
- Changed: parseMiniSkills is exported and each calibration rejection path (non-positive, non-agent-ui catalog, domain entry, duplicate) has a test that goes red when its guard is removed
- Commits: none
- Check: 1 New tests pass and one guard-removal run is red: pass
- Check: 2 `npm run check` exits 0: pass
- Check: 3 `npx vitest run packages/agent-ui/a2ui/src/agent` exits 0: pass
- Check: 4 Prompt-equivalence baseline unchanged: pass
- Check: 5 Refactor limited to exporting a pure validator; no prompt text or calibration values changed: pass
- Follow-up: note: packages/agent-ui/a2ui/src/agent/mini-skills.ts:111 catalogId and... -> notes.md
