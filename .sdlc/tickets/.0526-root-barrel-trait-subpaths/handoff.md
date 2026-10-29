---
id: T-0526
title: "scroll-fade and pane-resize move off the components root barrel to ./traits subpaths"
type: chore           # feature | bug | chore | spike | idea
status: done
size: L2
priority: P2         # P1 | P2 | P3
depends: [T-0521]
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
`scroll-fade` and `pane-resize` are published as `./traits/scroll-fade` and `./traits/pane-resize` subpaths and dropped from the `@agent-ui/components` root barrel, freeing about 805 B gz on the row every consumer pays (7659 of 7680 today).

## Intent
- Do: follow the overlay, scroll-spy and (T-0521) roving-focus subpath precedent: package.json exports, a budgeted measure-size row each, tree-shake test leaves, component-packaging.md rows, the traits doc page; repoint every in-repo import of the two traits from the root barrel; update every place that counts the published trait subpaths, including `site/lib/site-manifest.json` (regenerate the sitemap pair with its script) and `site/public/llms.txt`, which still say three after T-0521.
- Non-goals: changing either trait.
- Done when: the `components .` row measures about 6854 B gz; both new rows are within budget; no in-repo import of either trait from the root barrel remains; the trait-count lines read the new number; `npm run check`, the tree-shake test and the affected tests exit 0.

## Context
From the T-0523 bundle-size sweep (#2328):

| # | Row | Measured / budget | Over or headroom | Culprits (est gz) | Belongs? | Fix |
| --- | --- | --- | --- | --- | --- | --- |
| M1 | `@agent-ui/components .` | 7659 / 7680 B gz (99.7%) | 21 B | dom/template.ts 2286, reactive/graph.ts 795, dom/form.ts 746, dom/repeat.ts 701, dom/element.ts 691, dom/props.ts 684, traits/scroll-fade.ts 483, traits/pane-resize.ts 388 | the kernel yes; scroll-fade and pane-resize are traits re-exported on the root by ruling (ADR-0155, GH #52) | move scroll-fade and pane-resize to `./traits/*` subpaths (the overlay and scroll-spy precedent, ADR-0167's route): measured 7659 -> 6854 B gz with both re-exports removed (805 B freed, a virtual-entry bundle in the run records dir) on the row every consumer pays; a breaking export change, so it needs its own ruling |

This is a breaking export change for 0.2.x consumers; Kim approved it in this ticket (2026-10-28).

## Constraints
Budgets live in `scripts/measure-size.mjs`; every budget change carries a dated reason comment naming its mover (existing precedent around :205 and :265). Generated files only through their scripts. No em dashes.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
- `node scripts/measure-size.mjs` prints the components root row (the reactive+dom barrel) at about 6854 B gz within budget, and the traits/pane-resize and traits/scroll-fade rows within budget (the command's own exit stays non-zero from rows other tickets own: all, otp-field, sandbox-frame, the app root).
- `npx vitest run packages/agent-ui/components/src/controls/tree-shake.test.ts packages/agent-ui/app/src/layering.test.ts site/lib/sitemap.test.ts site/lib/llms.test.ts` exits 0.
- `npm run check` exits 0.
- No in-repo source imports paneResize or scrollFade from the @agent-ui/components root barrel; site/lib/site-manifest.json, site/public/llms.txt, site/pages/traits-doc.ts and site/traits-doc.html name six published trait subpaths.

## Outcome

2026-10-28 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 2468be1b0b87
- Changed: scroll-fade and pane-resize move off the components root barrel to ./traits subpaths, 805 B gz off every consumer
- Commits: none
- Check: 1 measure-size rows: pass
- Check: 2 vitest tree-shake, app layering, sitemap, llms: pass
- Check: 3 `npm run check`: pass
- Check: 4 no root-barrel import; six subpaths named: pass
- Follow-up: note: scripts/measure-size.mjs:961 comment says markdown solo stayed... -> notes.md
- Follow-up: note: node scripts/measure-size.mjs also prints the cluster drift slider... -> notes.md
- Follow-up: note: @agent-ui/app marginal moved 61351 -> 62156 on the same frame... -> notes.md
