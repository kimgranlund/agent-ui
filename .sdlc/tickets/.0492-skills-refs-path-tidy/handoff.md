---
id: T-0492
title: "site-authoring sitemap rule inverted back, docs/ shorthand paths and the roster-source rename fixed in skills and references"
type: chore           # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P3         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
Skills and references state the current sitemap rule, real doc paths and the current roster-source names.

## Context
Found by T-0487.
- `.claude/skills/site-authoring/references/content-types.md:190-191` says the sitemap excludes demo pages by design via `EXCLUDED_SUFFIX`; that symbol is gone and `site/lib/sitemap.test.ts:161-170` (`canonicalPageFor`) makes `{slug}-demo.html` the preferred entry (GH #1619, f181f8b66). A missing demo is a G2 failure (High).
- Shorthand `docs/plan.md`, `docs/process.md`, `docs/references/...`, `docs/lld/...` paths that live under `.claude/docs/`: `.claude/docs/references/component-authoring-foundations.md:5,11,17,24,31,38,43,49`, `component-authoring-best-practices.md:22`, `.claude/skills/site-authoring/references/best-practices.md:21`, `content-types.md:115`, `.claude/skills/admin-library-kinds/references/single-select-catalog.md:26`.
- `.claude/docs/references/state-and-persistence.md:78,110` name `persona-roster-source.ts` and `createPersonaRosterSource<P>()`; the code is `packages/agent-ui/app/src/controls/agent-admin/agent-roster-source.ts` with `createAgentRosterSource` and `AgentRosterView`. Update the body; keep the rename note at `:186-190`.

## Constraints
Docs only. No em dashes.

## Done when
- Each record above matches the code.

## Acceptance criteria
- `grep -rn 'EXCLUDED_SUFFIX' .claude/skills/` finds nothing.
- `grep -rnE '\`docs/(plan|process|references|lld)' .claude/docs/references .claude/skills` finds nothing.
- `npm run check` and `doc_lint` exit 0.
- Lane: solo because size L1 (steps.py lane)

## Outcome

2026-10-28 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: eb742cd01a35
- Changed: Skills and references state the demo-preferred sitemap rule, real .claude/docs paths and the agent-roster-source names
- Commits: none
- Check: 1 `grep -rn 'EXCLUDED_SUFFIX' .claude/skills/` finds nothing: pass
- Check: 2 `grep -rnE '\`docs/(plan|process|references|lld)' .claude/docs/references .claude/skills` finds n...: pass
- Check: 3 `npm run check` and `doc_lint` exit 0: pass
- Check: 4 Lane: solo because size L1: pass
- Follow-up: note: four added lines in the diff carry pre-existing em dashes on edited... -> notes.md
