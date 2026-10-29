---
id: T-0525
title: "The red measure-size rows are re-based to measured plus headroom, each citing its mover"
type: chore           # feature | bug | chore | spike | idea
status: done
size: L1
priority: P2         # P1 | P2 | P3
depends: []
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
Every red row of `node scripts/measure-size.mjs` that the T-0523 sweep classed as reviewed growth is re-based to its measured size plus headroom, so those rows pass.

## Intent
- Do: re-base `@agent-ui/components/all` (H1), the sandbox-frame (H3) and otp-field (H4) per-control overrides, and pre-emptively the status-stream (M3) and drill (M4) overrides; each to measured plus a stated headroom, each comment citing its movers from the findings below and "Kim 2026-10-28 ruling (ADR-0197 cl.5 confirmation, T-0525)". Leave the cluster (T-0528) and the root barrel (T-0526) rows alone.
- Done when: `node scripts/measure-size.mjs` shows those five rows within budget; the only remaining reds, if any, are the cluster leg owned by T-0528 and the `@agent-ui/app .` marginal row owned by T-0522 (PR 2327); `npm run check` exits 0.

## Context
From the T-0523 bundle-size sweep (#2328):

| # | Row | Measured / budget | Over or headroom | Culprits (est gz) | Belongs? | Fix |
| --- | --- | --- | --- | --- | --- | --- |
| H1 | `@agent-ui/components/all` (demo-only) | 87419 / 73728 B gz | +13691 (118.6%) | ten controls minted after the re-base, none re-based: option-deck 1914, amount-picker 1750, option-compare 1715, result-card 1385, game-hud 1257, board-grid 1274, confirm-receipt 1245, step-flow 1125, product-card 890, glyph 543 (glyph.ts 330 + glyph-paths.ts 213); their per-control marginals sum to 11557 B; the other named movers are fleet-wide edits since the re-base: text-field.ts +141 lines (T-0135 type=date, T-0495), status-stream.ts +58, gauge.ts +57, badge.ts +46 (intent-mark), value-codec.ts +39, and the T-0351/T-0356 createGlyph migration across controls; what remains is dictionary drift | yes: `all` is every control by definition, and none is a lazy-only dependency | re-base to the measured figure plus headroom (one ruling, the 2026-10-05 precedent), naming the ten mints; ask separately whether the ADR-0243 domain widgets (game-hud, board-grid, product-card, result-card) belong in `components` at all |
| H3 | per-control `sandbox-frame` | 2524 / 2336 B gz | +188 | sandbox-frame.ts 752, bootstrap.ts 659, csp.ts 224, bridge.ts 222, token-bridge.ts 203; one real mover since the last bump: T-0455's widget-register stamp in `bootstrap.ts` (6053aa6d0, +9 lines), the rest drift from H1's ten mints | yes, all of it is the control's own SPEC-R12 machinery | re-bump the override with the T-0455 mover named, in the same ruling as H1 |
| H4 | per-control `otp-field` | 2575 / 2496 B gz | +79 | otp-field.ts 1494, model.ts 511; no `.ts` change since 4d90e8265 (only `otp-field.css` and snapshots moved) | yes | drift class only: re-bump the override in the H1 ruling, citing H1's mints |
| M3 | per-control `status-stream` | 2761 / 2800 B gz (98.6%) | 39 B | status-stream.ts 2251 (one module); glyph migration T-0356/T-0374 (fbe0914a2, e218ea2e7) | yes | fold into the H1 ruling or shrink: the one-module control is the largest single control file in the fleet |
| M4 | per-control `drill` | 2230 / 2304 B gz (96.8%) | 74 B | drill.ts 1677, drill-panel.ts 171; source untouched since the re-base, drift only | yes | fold into the H1 ruling |

## Constraints
Budgets live in `scripts/measure-size.mjs`; every budget change carries a dated reason comment naming its mover (existing precedent around :205 and :265). Generated files only through their scripts. No em dashes.
- Lane: solo because size L1 (steps.py lane)

## Plan review
- conductor: verifier L1 failed on a plan defect (Done when ignored the app row owned by T-0522); Done when amended, build unchanged, reverify.

## Outcome

2026-10-28 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 16a8e95f82d1
- Changed: The red measure-size rows are re-based to measured plus headroom, each citing its mover, per Kim's ADR-0197 confirmation
- Commits: none
- Check: 1 `node scripts/measure-size.mjs` shows the five rows (components/all, sandbox-frame, otp-field, st...: pass
- Check: 2 the only remaining reds are the T-0528 cluster leg and the T-0522 `@agent-ui/app .` row: pass
- Check: 3 `npm run check` exits 0: pass
- Follow-up: note: scripts/measure-size.mjs:231 new comments use "--" and "->"; em... -> notes.md
