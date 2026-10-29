---
id: T-0528
title: "The size cluster is re-derived with a gated slider row, and router, code/editor, a2ui, a2a, icons and devtools get budgeted rows"
type: chore           # feature | bug | chore | spike | idea
status: done
size: L2
priority: P2         # P1 | P2 | P3
depends: []
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
The GH #354 cluster leg of measure-size passes again with slider gated somewhere, and the packages with no or meaningless rows get real ones.

## Intent
- Do: re-derive `CLUSTER_EXPECTED` after T-0196's amount-picker to slider import, re-measure the cluster budget, and give slider a gated home (a slider plus amount-picker pair row, or an amount-picker override that absorbs it) (H2); measure `@agent-ui/router` and `@agent-ui/code/editor` absolutely instead of as negative marginals (L2); add budgeted rows for `@agent-ui/a2ui` (`.`, `./registry`, `./agent`, `./examples`, `./corpus`), `@agent-ui/a2a .`, `@agent-ui/icons` (`.`, `./phosphor`) and `@agent-ui/devtools .` at measured plus headroom (L3). Report the a2ui root barrel's static pull of the persona and domain catalogs as a follow-up, do not fix it here.
- Done when: the cluster leg passes; every new row is within budget; `npm run check` exits 0.

## Context
From the T-0523 bundle-size sweep (#2328):

| # | Row | Measured / budget | Over or headroom | Culprits (est gz) | Belongs? | Fix |
| --- | --- | --- | --- | --- | --- | --- |
| H2 | cluster membership (GH #354 leg) | derived [calendar, color-picker, swatch, text-field] vs pinned five | fails | `amount-picker.ts:22` statically imports `../slider/slider.ts` (T-0196, 5b1feee50), so slider gains a masker outside the cycle and leaves the cluster | the import is legitimate | slider is now masked by color-picker (inside the cluster) and amount-picker (outside), so no row gates slider's ~328 B gz at all: re-derive `CLUSTER_EXPECTED` to four, re-measure the cluster budget, and give slider a gated home (a slider+amount-picker pair row, or give amount-picker an override that absorbs slider) |

| # | Row or gap | Note | Fix |
| --- | --- | --- | --- |
| L2 | `@agent-ui/router` marginal -2363 B gz, `@agent-ui/code/editor` marginal -4677 B gz | negative marginals: since ADR-0233 these entries no longer pull the whole `components .` barrel, so `solo - foundation` is not a marginal and both budgets pass at any size up to foundation + budget | measure them absolutely (the `code .` and `traits/*` precedent) or against the components modules they really reach |
| L3 | packages with no row: `@agent-ui/a2ui` (`.`, `./registry`, `./agent`, `./examples`, `./corpus`), `@agent-ui/a2a .`, `@agent-ui/icons` (`.`, `./phosphor`), `@agent-ui/devtools .` | worst-case barrel figures measured here: a2ui `.` 59901 B gz eager (catalog/personas/croupier/checks.ts 10378, domains/hospitality/factories.ts 3247, default/catalog.json 3007, renderer.ts 2765), a2a `.` 7267 (arena 3035, corpus 1348), devtools `.` 3184, icons `.` 1102 | add budgeted rows; and flag that the a2ui root barrel re-exports `SHIPPED_PERSONA_CATALOGS` and `SHIPPED_DOMAIN_CATALOGS` (`catalog/index.ts:53-54`), so a consumer that touches them statically pulls the croupier checks module (97 KB source, 49 KB rendered, about 10.4 KB gz est); whether app's eager closure reaches it was not checked here (app bundles only with measure-size's own plugin), and the persona and domain packages belong behind a subpath either way |

## Constraints
Budgets live in `scripts/measure-size.mjs`; every budget change carries a dated reason comment naming its mover (existing precedent around :205 and :265). Generated files only through their scripts. No em dashes.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
- `out=$(node scripts/measure-size.mjs 2>&1); ! printf "%s\n" "$out" | grep -qE "cluster (membership drifted|exceeds)|slider pair (membership drifted|exceeds)|router exceeds|code/editor \(wrapper\) exceeds|a2ui, a2a, icons or devtools entry exceeds"`
- `out=$(node scripts/measure-size.mjs 2>&1); printf "%s\n" "$out" | grep -qE "slider pair \[amount-picker \+ slider\]: marginal [0-9]+ B gz .* within budget"`
- `out=$(node scripts/measure-size.mjs 2>&1); test "$(printf "%s\n" "$out" | grep -cE "^@agent-ui/(router|code/editor) \(.* within budget .*absolute")" -eq 2`
- `out=$(node scripts/measure-size.mjs 2>&1); test "$(printf "%s\n" "$out" | grep -cE "^@agent-ui/(a2ui|a2a|icons|devtools)[^:]*: [0-9]+ B gz .* within budget")" -eq 9`
- `npm run check`

verifier: L3

## Outcome

2026-10-28 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 16a8e95f82d1
- Changed: The size cluster is re-derived with a gated slider pair row, router and code/editor are measured absolutely, and a2ui, a2a, icons and devtools get budgeted rows
- Commits: none
- Check: 1 no cluster/slider-pair/router/code-editor/package-entry failure line: pass
- Check: 2 slider pair row within budget: pass
- Check: 3 router and code/editor absolute rows: pass
- Check: 4 nine a2ui/a2a/icons/devtools rows within budget: pass
- Check: 5 `npm run check`: pass
- Follow-up: fix-now: scripts/measure-size.mjs:348 a stray if packageEntryOver... -> notes.md
- Follow-up: note: node scripts/measure-size.mjs still exits 1 on rows owned by T-0525... -> notes.md
- Follow-up: note: a2ui  -> notes.md
