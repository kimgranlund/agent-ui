---
id: T-0062
title: "A2UI skills and references: repair the 21 stale or missing items found by the 2026-10-11 audit"
type: chore           # feature | bug | chore | spike | idea
status: done        # proposed | ready | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-11
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The A2UI skills, their references, the live-agent spec and LLD, agent-model.md and the a2ui AGENTS.md describe the code and the accepted ADRs as they are today, including ADR-0242 (response type), the turn deadline, the Haiku 5.5 request shape and the lazy-catalog warm seam.

## Intent
- Do: work through the audit items in `.sdlc/0062-a2ui-skills-refresh/audit-items.md` (copied from the 2026-10-11 audit; each has a path:line, what is wrong and the evidence). VERIFY each claim against the code or the ADR before editing, and drop or adjust any item that turns out false. Edits are docs only: skills (`.claude/skills/**`), `.claude/docs/{spec,lld,references}/**`, `packages/agent-ui/a2ui/AGENTS.md`.
- Non-goals: any code change; the ADRs themselves; rubrics; the three docs the audit found current.
- Done when: `doc_lint.py` exits 0 on every touched doc under .claude/docs; `npm run check` exits 0; `site/lib/docs-grammar.test.ts`, `site/lib/adr.test.ts` and `site/lib/sitemap.test.ts` exit 0 (regenerate the sitemap and llms-full if a doc they index changed: `node scripts/generate-sitemap.mjs`, `node scripts/generate-llms-full.mjs`); a CHANGELOG line only if the changelog policy requires one; no em dash in any added line; stale records repaired in the same change.

## Context
Audit by a read-only agent on 2026-10-11 after T-0060/T-0061 (#1876 to #1882) and the lazy-catalog, Haiku 5.5 and turn-deadline series. Docs-only ticket: no verifier (sdlc-lite 0.22.3 close-first rule); gates are the evidence.

## Constraints
Docs only. Keep skill frontmatter descriptions intact (they are routing text) unless an item says otherwise. Commit locally in the worktree; no push.

## Closed

2026-10-11: Merged in #1883 (docs only, no verifier per close-first)
