---
id: T-0566
title: "Basic exemplars drop inert props and ticket records use relative paths"
type: chore           # feature | bug | chore | spike | idea
status: done
size: L1
priority: P3
depends: []
created: 2026-10-29
claimed_by: claude:a8ce3b21 2026-10-29
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
The a2ui-basic exemplars stop using props the INERT_PROP check flags, and closed ticket records carry repo-relative paths only.

## Intent
- Do: drop or replace `validationRegexp` and `displayStyle` in `packages/agent-ui/a2ui/src/examples/basic-exemplars.ts` and keep its corpus shard in step through the corpus's own admit flow; replace absolute local paths with repo-relative ones in the closed handoffs `tickets.py check` warns on (`absolute path in a tracked work record`).
- Done when: `tickets.py check` prints no absolute-path warning; the examples and corpus tests pass; `npm run check` exits 0.

## Context
T-0556 (PR 2361) added INERT_PROP; its notes say the Basic exemplars still use the two inert props. The close step warned on absolute paths in the 0539, 0541, 0552, 0557 and 0560 handoffs.

## Constraints
No em dashes. No paid runs. Never rewrite a finished round archive.
- Lane: solo because size L1 (steps.py lane)

## Outcome

2026-10-29 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 4b1be4538010
- Changed: Basic exemplars drop the inert props, re-admitted with fresh verdicts, and closed ticket records use relative paths
- Commits: none
- Check: 1 `tickets.py check` prints no absolute-path warning: pass
- Check: 2 The examples and corpus tests pass: pass
- Check: 3 `npm run check` exits 0: pass
- Follow-up: note: .sdlc/tickets/roadmap.md: tickets.py check reports the roadmap as... -> notes.md
