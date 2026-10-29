---
id: T-0530
title: "The a2ui root barrel stops re-exporting the shipped persona and domain catalogs, which move to a subpath"
type: chore           # feature | bug | chore | spike | idea
status: done
size: L2
priority: P2         # P1 | P2 | P3
depends: []
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-29
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
Importing `@agent-ui/a2ui` no longer statically pulls the shipped persona and domain catalogs (and with them the croupier checks module, about 10 KB gz): `SHIPPED_PERSONA_CATALOGS` and `SHIPPED_DOMAIN_CATALOGS` move to an `@agent-ui/a2ui/catalogs` subpath (or the nearest existing subpath), and the root barrel stops re-exporting them.

## Intent
- Do: follow the repo's subpath precedent (package.json exports, a budgeted measure-size row, tree-shake test, component-packaging.md or the a2ui package docs); repoint every in-repo import (site, app, devtools, tests) to the subpath; keep `SHIPPED_PERSONA_CATALOG_MANIFESTS` where it is (server-safe twin, GH #516); re-measure the a2ui `.` row and lower its budget to the new figure plus headroom.
- Non-goals: changing any catalog.
- Done when: the a2ui `.` row drops by roughly the croupier checks and factories weight (before and after reported); no in-repo import of the two names from the root remains; `npm run check`, the a2ui layering tests and the tree-shake test exit 0.

## Context
T-0523 sweep L3 and report: `packages/agent-ui/a2ui/src/catalog/index.ts:53-54` re-exports both, so `.` carries `catalog/personas/croupier/checks.ts` (10378 B gz) and `domains/hospitality/factories.ts` (3247). Breaking export change for 0.2.x consumers, approved by Kim 2026-10-28 in this ticket.


## Constraints
Generated files only through their scripts. Layering law: a2ui imports downward only (AGENTS.md). No em dashes.

Waits on PR 2331 (T-0528) merging.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
- The root barrel no longer re-exports the two lists: `bash -c "! grep -nE 'SHIPPED_(PERSONA|DOMAIN)_CATALOGS\b' packages/agent-ui/a2ui/src/catalog/index.ts | grep -v '^[0-9]*:\s*//' | grep -q export"` exits 0.
- No in-repo import of either name from the root remains: `bash -c "! git grep -nE 'import .*SHIPPED_(PERSONA|DOMAIN)_CATALOGS[^_].*from .@agent-ui/a2ui.$'"` exits 0.
- The subpath exists in the exports map: `node -e "process.exit(require('./packages/agent-ui/a2ui/package.json').exports['./catalogs']==='./src/catalog/shipped.ts'?0:1)"` exits 0.
- `npm run check` exits 0.
- `npx vitest run packages/agent-ui/a2ui/src/layering.test.ts packages/agent-ui/app/src/layering.test.ts packages/agent-ui/components/src/controls/tree-shake.test.ts packages/agent-ui/app/src/controls/agent-admin site/lib/a2ui-catalog-selector.test.ts site/lib/agent-manifest site/pages/agent-admin-presets.test.ts` exits 0.
- `npm run size` prints the a2ui `.` row within its new 51200 B gz budget (measured 50571, was 60593) and a `./catalogs` row within 15360; its only OVER line is the pre-existing `traits/overlay` row, red at the base sha too.

## Outcome

2026-10-29 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 1e59e50b555c
- Changed: The a2ui root barrel stops pulling the shipped persona and domain catalogs, which move to the ./catalogs subpath
- Commits: none
- Check: 1 root barrel no longer re-exports the two lists: pass
- Check: 2 no in-repo import from the root: pass
- Check: 3 subpath in exports map: pass
- Check: 4 `npm run check`: pass
- Check: 5 vitest set: pass
- Check: 6 `npm run size`: pass
- Follow-up: note: packages/agent-ui/a2ui/src/catalog/index.ts:53 and... -> notes.md
