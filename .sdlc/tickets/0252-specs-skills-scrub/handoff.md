---
id: T-0252
title: "Spec and LLD path scrub, app-shell superseded markers, skills and agents scrub, old tickets archived"
type: chore           # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0249]          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Specs, LLDs, skills and agents cite only paths and processes that exist, and retired designs are marked superseded.

## Context
Source: the 2026-10-15 repo scrub audits (https://claude.ai/artifact/WKiuHupQFWhonnQbKA2GQT). Kim's rulings 2026-10-15: work items live in `.sdlc/tickets/` (topics layout, T-0242); CHANGELOG.md becomes a pointer to merged PRs and releases (old text archived); the npm publish scope is `@agent-ui-kit/*` (renamed at publish time; READMEs note the alias). No em dashes. ADRs stay frozen and cited.
- About 14 spec/LLD files cite `tools/agent/*` files that moved to `packages/agent-ui/a2ui/src/agent/` (a2ui-live-agent spec+lld, message-lifecycle, a2a-a2ui-bridge, app-surfaces-m2, the 4 admin LLDs, feed/report/content families, closed-loop spec); `a2ui/src/stream/*` cites (streaming-pipeline); `generate-agent-content.mjs` (now `generate-agent-assets.mjs`).
- 9 docs describe the removed `ui-app-shell` with no superseded marker (agent-app-shell spec+lld, app-surfaces-m4, shell-archetypes-m5, shell-responsive, nav-rail-family, agent-app-surfaces prd).
- Skills: due-process and project-docs (teamwork plugin seats, no sdlc-lite lane), repo-hygiene (adr_queue.py, campaign_close.py, harness:repo-cleaner), project-facts (NOTES.md, T-0242 planned), doc-standards references and evals (ADR numbering for a frozen log), site-authoring evals, a2ui-payload-authoring node-idioms (old sm/md/lg size), a2ui-corpus-curation (`catalog-a2ui_0_9.json`), fleet-review (TKT-era bars); add a closed-loop pointer (chat:probe, run-capped, `.sdlc/evals/rounds/`) to seat-map, component-testing, a2ui-payload-authoring; agents/a2ui-build-agent names the ADR line as decision home.
- Archive: 64 `.claude/docs/tickets` files cited nowhere, `.claude/overhaul-run-2026-08-14.md`, `overhaul-run-2026-08-20.md`, `overhaul-wave1-plan.json`, `attention-trend.csv`, reports `knowledge-harvest-2026-10-03` and `roadmap-wave-2026-08-05`; remove `scripts/catalog-attr-diff.mjs` and `scripts/generate-sitemap.d.mts` (verify unused).

## Constraints
Do not flip `proposed` statuses on shipped specs (doc-standards section 2). Keep every cited ADR. Generated files only through their scripts.

## Done when
- A backticked-path existence check over `.claude/docs` and `.claude/skills` reports no missing path outside history sections (script saved beside the handoff).
- The 9 app-shell docs carry a superseded line naming the replacement.
- `doc_lint`, the skill and wiring checks in `check:scripts`, and `npm run check` exit 0.

## Acceptance criteria
- `python3 .sdlc/tickets/0252-specs-skills-scrub/path_check.py` exits 0 (rules and the allowlist with reasons are in the script docstring and `path_check.allow.txt`).
- `test -z "$(grep -L '^> Superseded' .claude/docs/spec/agent-app-shell.spec.md .claude/docs/lld/agent-app-shell.lld.md .claude/docs/spec/app-surfaces-m4.spec.md .claude/docs/lld/app-surfaces-m4.lld.md .claude/docs/spec/shell-archetypes-m5.spec.md .claude/docs/lld/shell-archetypes-m5.lld.md .claude/docs/lld/shell-responsive.lld.md .claude/docs/spec/nav-rail-family.spec.md .claude/docs/lld/nav-rail-family.lld.md .claude/docs/prd/agent-app-surfaces.prd.md)"` exits 0, and no status line changed: `! git diff 39415bf5 -- .claude/docs | grep -q '^[-+]> Status'` exits 0.
- `npx vitest run site/lib/docs-grammar.test.ts site/lib/adr.test.ts site/lib/sitemap.test.ts` exits 0.
- `npm run check` exits 0.
- `test ! -e scripts/catalog-attr-diff.mjs` exits 0; `scripts/generate-sitemap.d.mts` stays (it is the type surface `site/lib/sitemap.test.ts` imports).
