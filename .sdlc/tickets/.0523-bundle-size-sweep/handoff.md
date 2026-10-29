---
id: T-0523
title: "Bundle size sweep: every package barrel and subpath against its budget, heavy imports on default entries"
type: chore           # feature | bug | chore | spike | idea
status: done
size: L2
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
A ranked list of every package barrel and subpath that is over or within 5 percent of its budget in `scripts/measure-size.mjs`, with the heaviest modules each pulls in and whether each belongs on that entry.

## Intent
- Do: run `node scripts/measure-size.mjs`; for each row over or near budget, list the top modules by gz contribution and flag any that should sit behind a subpath or lazy import (AGENTS.md: the CodeMirror and pdfjs exceptions are opt-in and lazy, never on a default barrel). Write `## Findings` to this handoff, High (over budget) / Medium (near) / Low, each with the row, the numbers, the culprit modules and a one-line fix, plus a proposed ticket per group. The app root overrun has its own ticket (T-0522); note it and move on.
- Non-goals: fixing anything.
- Done when: `## Findings` exists in that shape with the measure-size output it was built from; `git status --short -- . ':!.sdlc'` prints nothing.

## Context
measure-size.mjs budgets near :40 and the reason comments around :205-:265.

## Constraints
Read-only outside `.sdlc`. No em dashes. No paid runs.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
- `## Findings` has High, Medium and Low groups; each row names the measure-size row, measured and budget numbers, culprit modules and a one-line fix; proposed tickets are listed per group; the measure-size output it was built from is included.
- Every over-budget or within-5-percent row in a fresh `node scripts/measure-size.mjs` run appears in Findings; the app row points at T-0522.
- `git status --short -- . ':!.sdlc'` prints nothing.

## Findings

Built from `node scripts/measure-size.mjs` at base 7ec42c185 (exit 1, four failing legs), run 2026-10-28 in the T-0523 lane tree. Culprit figures are estimated gz shares: each module's Rolldown-rendered code minified alone, gzipped, then scaled so the shares sum to the row's real eager gz (the script `attrib.mjs` in the run records dir). They rank modules reliably; they are not leave-one-out marginals. Near means at or above 95 percent of budget.

Root cause across the board: `npm run size` runs in no gate. `git grep` finds it in no `package.json` script but its own, no workflow under `.github/workflows/`, and no test or hook; ADR-0040 section 3 recorded it as a manual run by ruling. The last recorded run is T-0042 (92dfd1a0b, 2026-10-08), so every mint since then landed unmeasured and four legs went red without anyone seeing it.

### High (over budget or failing)

| # | Row | Measured / budget | Over | Culprits (est gz) | Belongs? | Fix |
| --- | --- | --- | --- | --- | --- | --- |
| H1 | `@agent-ui/components/all` (demo-only) | 87419 / 73728 B gz | +13691 (118.6%) | ten controls minted after the re-base, none re-based: option-deck 1914, amount-picker 1750, option-compare 1715, result-card 1385, game-hud 1257, board-grid 1274, confirm-receipt 1245, step-flow 1125, product-card 890, glyph 543 (glyph.ts 330 + glyph-paths.ts 213); their per-control marginals sum to 11557 B; the other named movers are fleet-wide edits since the re-base: text-field.ts +141 lines (T-0135 type=date, T-0495), status-stream.ts +58, gauge.ts +57, badge.ts +46 (intent-mark), value-codec.ts +39, and the T-0351/T-0356 createGlyph migration across controls; what remains is dictionary drift | yes: `all` is every control by definition, and none is a lazy-only dependency | re-base to the measured figure plus headroom (one ruling, the 2026-10-05 precedent), naming the ten mints; ask separately whether the ADR-0243 domain widgets (game-hud, board-grid, product-card, result-card) belong in `components` at all |
| H2 | cluster membership (GH #354 leg) | derived [calendar, color-picker, swatch, text-field] vs pinned five | fails | `amount-picker.ts:22` statically imports `../slider/slider.ts` (T-0196, 5b1feee50), so slider gains a masker outside the cycle and leaves the cluster | the import is legitimate | slider is now masked by color-picker (inside the cluster) and amount-picker (outside), so no row gates slider's ~328 B gz at all: re-derive `CLUSTER_EXPECTED` to four, re-measure the cluster budget, and give slider a gated home (a slider+amount-picker pair row, or give amount-picker an override that absorbs slider) |
| H3 | per-control `sandbox-frame` | 2524 / 2336 B gz | +188 | sandbox-frame.ts 752, bootstrap.ts 659, csp.ts 224, bridge.ts 222, token-bridge.ts 203; one real mover since the last bump: T-0455's widget-register stamp in `bootstrap.ts` (6053aa6d0, +9 lines), the rest drift from H1's ten mints | yes, all of it is the control's own SPEC-R12 machinery | re-bump the override with the T-0455 mover named, in the same ruling as H1 |
| H4 | per-control `otp-field` | 2575 / 2496 B gz | +79 | otp-field.ts 1494, model.ts 511; no `.ts` change since 4d90e8265 (only `otp-field.css` and snapshots moved) | yes | drift class only: re-bump the override in the H1 ruling, citing H1's mints |
| H5 | `@agent-ui/app .` marginal | 61117 / 59925 B gz | +1192 | owned by T-0522 | n/a | T-0522, not repeated here |

### Medium (within 5 percent of budget)

| # | Row | Measured / budget | Headroom | Culprits (est gz) | Belongs? | Fix |
| --- | --- | --- | --- | --- | --- | --- |
| M1 | `@agent-ui/components .` | 7659 / 7680 B gz (99.7%) | 21 B | dom/template.ts 2286, reactive/graph.ts 795, dom/form.ts 746, dom/repeat.ts 701, dom/element.ts 691, dom/props.ts 684, traits/scroll-fade.ts 483, traits/pane-resize.ts 388 | the kernel yes; scroll-fade and pane-resize are traits re-exported on the root by ruling (ADR-0155, GH #52) | move scroll-fade and pane-resize to `./traits/*` subpaths (the overlay and scroll-spy precedent, ADR-0167's route): measured 7659 -> 6854 B gz with both re-exports removed (805 B freed, a virtual-entry bundle in the run records dir) on the row every consumer pays; a breaking export change, so it needs its own ruling |
| M2 | per-control `table` | 2604 / 2624 B gz (99.2%) | 20 B | table.ts 1390, table-model.ts 790, table.props.gen.ts 123; T-0149 scroll cue (305540bdc, +20 lines) | yes | the GH #455 shrink follow-up still owns it; next real table change re-bases or shrinks |
| M3 | per-control `status-stream` | 2761 / 2800 B gz (98.6%) | 39 B | status-stream.ts 2251 (one module); glyph migration T-0356/T-0374 (fbe0914a2, e218ea2e7) | yes | fold into the H1 ruling or shrink: the one-module control is the largest single control file in the fleet |
| M4 | per-control `drill` | 2230 / 2304 B gz (96.8%) | 74 B | drill.ts 1677, drill-panel.ts 171; source untouched since the re-base, drift only | yes | fold into the H1 ruling |
| M5 | `@agent-ui/components/traits/overlay` | 2455 / 2560 B gz (95.9%) | 105 B | traits/overlay.ts 2455 (one module, unchanged since the 2026-08-20 re-base) | yes; its import stays type-only, the row's real guard holds | none now; any overlay change re-bases |
| M6 | heavy import on a default entry: `./controls/text-field` | eager 14846 B gz solo (unbudgeted: a cluster member) | n/a | text-field.ts 3318, traits/overlay.ts 2139, traits/value-codec.ts 1351, color-picker/color.ts 1049 (OKLCH math), glyph 712, swatch.ts 337 | color.ts and swatch.ts are static imports (`text-field.ts:70-71`) for the type=color leg only; every plain text field pays about 1.4 KB gz for them | move `colorCodecOptions` and the swatch preview behind the existing dynamic `import('../color-picker/color-picker.ts')` (`text-field.ts:524`), or a small type=color codec module loaded on first color use |

### Low (watch list and measurement gaps)

| # | Row or gap | Note | Fix |
| --- | --- | --- | --- |
| L1 | cluster 11084 / 11776 (94.1%), split 2010 / 2176 (92.4%), registry 3537 / 3840 (92.1%), line-chart 1913 / 2112 (90.6%), amount-picker 1824 / 2048 (89.1%), code/markdown 4533 / 5120 (88.5%) | 5 to 12 percent headroom; split and line-chart are the drift class, amount-picker is real T-0196 weight (amount-picker.ts 1377) | none now |
| L2 | `@agent-ui/router` marginal -2363 B gz, `@agent-ui/code/editor` marginal -4677 B gz | negative marginals: since ADR-0233 these entries no longer pull the whole `components .` barrel, so `solo - foundation` is not a marginal and both budgets pass at any size up to foundation + budget | measure them absolutely (the `code .` and `traits/*` precedent) or against the components modules they really reach |
| L3 | packages with no row: `@agent-ui/a2ui` (`.`, `./registry`, `./agent`, `./examples`, `./corpus`), `@agent-ui/a2a .`, `@agent-ui/icons` (`.`, `./phosphor`), `@agent-ui/devtools .` | worst-case barrel figures measured here: a2ui `.` 59901 B gz eager (catalog/personas/croupier/checks.ts 10378, domains/hospitality/factories.ts 3247, default/catalog.json 3007, renderer.ts 2765), a2a `.` 7267 (arena 3035, corpus 1348), devtools `.` 3184, icons `.` 1102 | add budgeted rows; and flag that the a2ui root barrel re-exports `SHIPPED_PERSONA_CATALOGS` and `SHIPPED_DOMAIN_CATALOGS` (`catalog/index.ts:53-54`), so a consumer that touches them statically pulls the croupier checks module (97 KB source, 49 KB rendered, about 10.4 KB gz est); whether app's eager closure reaches it was not checked here (app bundles only with measure-size's own plugin), and the persona and domain packages belong behind a subpath either way |
| L4 | CodeMirror and pdfjs-dist | static imports only in `code/src/editor/cm-*.ts` and `app/src/lib/pdf-worker.ts`, reached only through dynamic imports; lazy chunks 177852 and 125715 B gz, on no default barrel | none: both ADR exceptions hold |
| L5 | `INEFFECTIVE_DYNAMIC_IMPORT` warnings (187) | text-field's dynamic calendar and color-picker imports are also static entries in `all.gen.ts` and the leave-one-out bundles | expected for those measure frames; no fix |

### Proposed tickets

1. Ask Kim to revisit ADR-0040 section 3 (size stays a manual run) and wire `npm run size` into a gate (CI or `check:scripts`) once the re-base below lands green. Closes the root cause. (H1 to H4)
2. One size re-base ruling: `all` to the measured figure plus headroom, sandbox-frame, otp-field, and pre-emptively status-stream and drill overrides, each citing its mover (the ten mints, T-0455). (H1, H3, H4, M3, M4)
3. Re-derive the GH #354 cluster after T-0196 and give slider a gated row. (H2)
4. Move scroll-fade and pane-resize off the `components .` root barrel to `./traits/*` subpaths. (M1)
5. Lazy-load text-field's type=color codec and swatch preview. (M6)
6. Measurement gaps: absolute rows for router and code/editor, new rows for a2ui, a2a, icons and devtools entries, and a subpath for the a2ui persona and domain catalogs. (L2, L3)

T-0522 keeps the app row (H5).

### measure-size output (gating rows, warnings dropped, em dashes printed by the script shown as `-`, long override reasons cut at `[...]`)

```text
@agent-ui/components . (reactive+dom barrel): 7659 B gz (21611 B min) - within budget (7680 B gz)
@agent-ui/components/all (demo-only self-defining ui-* family): 87419 B gz (329398 B min) - OVER budget (73728 B gz)
@agent-ui/components/traits/overlay (opt-in subpath): 2455 B gz (6291 B min) - within budget (2560 B gz)
@agent-ui/components/traits/list-reorder (opt-in subpath): 960 B gz (2100 B min) - within budget (1280 B gz)
@agent-ui/components/traits/scroll-spy (opt-in subpath): 432 B gz (748 B min) - within budget (1024 B gz)
@agent-ui/components/registry + loader (entry chunk only): 3537 B gz (13139 B min) - within budget (3840 B gz)   115 lazy chunks excluded
size: the derived import-cycle cluster [calendar, color-picker, swatch, text-field] no longer matches the pinned set [calendar, color-picker, slider, swatch, text-field] - re-derive the cluster row's membership and budget (GH #354), never paper over it
  amount-picker  marginal  1824 B gz - within budget 2048 B   solo 9456 B gz (informational)
  drill          marginal  2230 B gz - within budget 2304 B (override: gzip measurement-frame drift class (the split/status-stream/ [...])
  line-chart     marginal  1913 B gz - within budget 2112 B (override: gzip measurement-frame drift class (the split/status-stream/ [...])
  otp-field      marginal  2575 B gz - OVER   budget 2496 B (override: Kim ruling 2026-08-08 (host round): LLD-mandated machinery ( [...])
  sandbox-frame  marginal  2524 B gz - OVER   budget 2336 B (override: genui-surface.spec.md SPEC §3.2/§3.3 (D9, B1): the CSP build [...])
  split          marginal  2010 B gz - within budget 2176 B (override: gzip measurement-frame drift as the family bundle crossed 33 [...])
  status-stream  marginal  2761 B gz - within budget 2800 B (override: gzip measurement-frame drift from the SAME genui-surface B1  [...])
  table          marginal  2604 B gz - within budget 2624 B (override: RULED 2026-08-05 (GH #445, Kim - "re-base + shrink follow-up [...])
  cluster [calendar + color-picker + slider + swatch + text-field]: marginal 11084 B gz - within budget 11776 B ([...])
@agent-ui/app . (super-shell + master-detail + settings + surface-host + conversation + nav-rail): marginal 61117 B gz - OVER budget (59925 B gz)   solo 68776 B gz (239595 B min, informational - includes the 7659 B gz components foundation)
@agent-ui/app - lazy chunk(s) reachable via a dynamic import (the whole agent-admin arm per ADR-0197 [...]: 601197 B gz (informational)
@agent-ui/app: lazy catalog bodies (ADR-0241 and its Amendment: the default catalog with the built- [...]: 19303 B gz (informational)
@agent-ui/app/lib/pdf-extractor (pdf DocumentExtractor registrar - the pdfjs-dist-FREE entry chunk): 561 B gz - within budget (1024 B gz); zero @agent-ui/components import exists - this figure IS the tree-shake proof, not a marginal
@agent-ui/app/lib/pdf-extractor - the lazy pdf.js chunk(s) (dynamic import('./pdf-worker.ts'), the pdfjs-dist library + its worker asset, never in any main bundle): 125715 B gz (informational, non-gating - ADR-0202 cl.4c/4d)
@agent-ui/router (core + ui-router-outlet + ui-router-link): marginal -2363 B gz - within budget (4096 B gz)   solo 5296 B gz (14509 B min, informational - includes the 7659 B gz components foundation)
@agent-ui/code . (core - token types + registry + projection seam): 551 B gz (1000 B min) - within budget (1536 B gz); zero @agent-ui/components import exists (the no-kernel gate) - this figure IS the tree-shake proof, not a marginal
@agent-ui/code/highlight (seven tokenizers, self-registering): 2469 B gz (6273 B min) - within budget (6144 B gz)
@agent-ui/code/markdown (ui-markdown; pulls ui-text/ui-code/ui-table): marginal 4533 B gz - within budget (5120 B gz)   solo 12192 B gz (38363 B min, informational - includes the 7659 B gz components foundation)
@agent-ui/code/editor (ui-code-editor wrapper - the CM-FREE entry chunk): marginal -4677 B gz - within budget (2048 B gz)   solo 2982 B gz (informational - includes the 7659 B gz components foundation)
@agent-ui/code/editor - the lazy CodeMirror chunk(s) (dynamic import('./cm-editor.ts'), never in any main bundle): 177852 B gz (informational, non-gating - ADR-0139 cl.8c/8d)
@agent-ui/data . (DataSource seam + store + resource/mutation/paginated + DataError; reactive kernel only): 2572 B br (2813 B gz, 7323 B min) - within budget (6144 B br, SPEC-R14 c)
@agent-ui/data/gateway (createGateway onion + withToken + withRetry; zero components import): 1749 B br (1954 B gz, 4286 B min) - within budget (3072 B br)
@agent-ui/data/stream (pushToPull bridge + fromFetchStream/fromEventSource/fromWebSocket + readNdjsonLines): 2097 B br (2341 B gz, 5624 B min) - within budget (4096 B br)
@agent-ui/data . tree-shake probe (SPEC-R1 AC3): clean - 8 modules bundled, 0 from ./gateway|./stream, leaked symbols [], DOM foundation bytes absent (headless - kernel only)
size: a barrel exceeds its budget
size: a control exceeds its per-control marginal budget
size: the import-cycle cluster membership drifted from its pinned set
size: @agent-ui/app exceeds its marginal budget
```

## Outcome

2026-10-28 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 7ec42c1856cb
- Changed: Bundle size sweep: ranked measure-size overruns with culprit modules and proposed fixes
- Commits: none
- Check: 1 `## Findings` has High, Medium and Low groups, each row with measure-size row, measured and budge...: pass
- Check: 2 Every over-budget or within-5-percent row in a fresh run appears in Findings; app row points at T...: pass
- Check: 3 `git status --short -- . ':!.sdlc'` prints nothing: pass
- Follow-up: note: the builder's red-first/deviation check is moot here no red... -> notes.md
- Follow-up: note: the per-module culprit shares are the builder's own estimated... -> notes.md
- Follow-up: note: .sdlc/tickets/roadmap.md has a broken link to... -> notes.md
