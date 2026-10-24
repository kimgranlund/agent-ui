---
id: T-0441
title: "roadmap.md Now and Next reflect what shipped since 2026-10-15 and propose the next arc"
type: chore           # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-24
claimed_by: claude:a8ce3b21 2026-10-24
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
roadmap.md section 2 (Now) and section 3 (Next) reflect what shipped since 2026-10-15 (from the done tickets and merged PRs), drop stale lines, and end with two or three candidate next arcs, each with a why and a size, for Kim's ruling.

## Context
Kim 2026-10-24 asked for the next waves; roadmap.md still says as of 2026-10-15. .sdlc/tickets/roadmap.md is generated and lists open tickets only.

## Constraints
roadmap.md is revised in place per its own section 1 rules; ADRs are frozen; no em dashes; doc_lint plus check gate a docs-only diff, and the sitemap carve-out applies if it triggers.

## Done when
doc_lint and npm run check pass; the candidate arcs are listed in the report for Kim.
- Lane: solo because size L2 (steps.py lane); overnight goal 2026-10-21

## Acceptance criteria
1. `python3 /Users/kimgranlund/.claude/plugins/cache/nonoun-plugins/docs/1.22.5/scripts/doc_lint.py .claude/docs/roadmap.md` exits 0.
2. `npm run check` exits 0.
3. roadmap.md section 2 and section 3 leads are dated 2026-10-24, name only shipped work that the merged log since 2026-10-15 shows, and section 3 ends its lead with two or three candidate arcs, each with a why and a size; each lead it retires has a dated line under section 4.

## Outcome

2026-10-24 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: b066d868331f
- Changed: roadmap.md Now and Next reflect what shipped through 2026-10-24 and propose three next arcs
- Commits: none
- Check: 1 doc_lint on .claude/docs/roadmap.md exits 0: pass
- Check: 2 `npm run check` exits 0: pass
- Check: 3 sections 2 and 3 leads dated 2026-10-24, only shipped work from the merged log, section 3 lead en...: pass
- Follow-up: note: .claude/docs/roadmap.md section 4 Later still carries the stale... -> notes.md
- Follow-up: note: the builder reports verify_scope.py exit 1 from a pre-existing... -> notes.md
