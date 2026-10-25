---
id: T-0461
title: "The prompt budget test comment, the presets header and roadmap section 3 match today's code"
type: chore           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-25
claimed_by: claude:a8ce3b21 2026-10-25
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
Three stale records match the code (T-0459 triage rows 1, 5 and 17, ruled by Kim 2026-10-25).

## Context
- `site/pages/agent-admin-prompt-budget.test.ts:8-10` still says worst case 130 097 against PROMPT_CHAR_BUDGET_DERIVED 142 000 and base 141 100; the constants are now `packages/agent-ui/a2ui/src/agent/prompt-budget.ts:66` (149_200) and `:110` (150_200).
- `site/pages/agent-admin-presets.ts:29-30` says library skills are "projected wholesale into the live prompt", stale since SPEC-R14 made a `context` skill index-only; `:27` carries an em dash.
- `.claude/docs/roadmap.md:351-352` says GH #644 is in progress; it shipped in e67c9a668 (PR #649) and closed 2026-08-09.

## Constraints
Comments and docs only; no behavior change. No em dashes.

## Done when
- The three records state today's values and status, with no em dash in the touched lines.
- `npm run check` plus `site/pages/agent-admin-prompt-budget.test.ts` pass, and doc_lint passes for roadmap.md.
- Lane: solo because size L2 (steps.py lane)

## Outcome

2026-10-25 · lane: solo L2 · verdict: pass · verifier: verifier-L1 (opus) · base: 913474054077
- Changed: The prompt budget comment, presets header and roadmap section 3 match today's code
- Commits: none
- Check: 1 The three records state today's values and status, with no em dash in the touched lines: pass
- Check: 2 `npm run check` plus the budget test pass, and doc_lint passes for roadmap.md: pass
- Follow-up: note: site/pages/agent-admin-presets.ts:27-28 still uses middle dots and... -> notes.md
- Follow-up: note: redck.py deviations printed no lines no red criteria. -> notes.md
