# Decomposition — @agent-ui/app size diet, round 2 (GH #1092: lazy-split the agent-admin arm · double-catalog audit · ineffective-dynamic-import ruling)

> Status: proposed · v0.1 · 2026-08-17 · Contract: [ADR-0197](../adr/0197-app-barrel-agent-admin-lazy-split.md)
> (proposed — build starts only from the RATIFIED text). Owning issue: GH #1092 (size:big,
> due-process per GH #969); measured hunt plan: GH #1080 Findings (2026-08-17). One writer per
> file per slice; every slice ends `npm run check && npm test` green AND `npm run size` judged by
> EXIT CODE, never grep.

## Baselines (measured 2026-08-17, GH #1080 — cited, not re-measured)

- App marginal on main@2b65338b: **104714 B gz**; budget re-based 102 → **103 KB (105472 B)** as
  the ruled LAST re-base of the drift class (`scripts/measure-size.mjs` ledger note, 2026-08-17).
- Entry-graph attribution (rendered bytes, Rolldown `modules`): agent-admin arm ≈ **263 KB**
  (~22 % of 1.19 MB; est. 20–25 KB gz) · double catalog (default + a2ui-basic) ≈ **84 KB**
  (a2ui-basic pair ~2.5 KB gz min win) · defeated text-field dynamic imports
  (calendar + color-picker + value-codec) ≈ **56 KB** eager (~4–5 KB gz).
- **End-state target:** app marginal UNDER the 102 KB checkpoint (104448 B gz) with **≥ 2 KB
  headroom** (≤ ~102.4 KB measured; expected landing ≈ 80–85 KB gz if S1 delivers to estimate);
  budget restored to 102 KB; NEVER raised again.

## Slices

| Slice | What | Est. gz win | Acceptance (per-slice) | Blast radius |
|---|---|---|---|---|
| **S1 — agent-admin lazy-split** (ADR-0197 cl.1–4; MANDATORY) | Barrel drops the static agent-admin arm; `./agent-admin-entries` + `./agent-admin-prompt-lint` subpaths added; memoized `loadAgentAdmin()` accessor; all in-repo consumers repointed | **20–25 KB** | `agent-admin-lazy.bundle.test.ts` (moduleIds assertion + negative control, the markdown-lazy.bundle pattern) · runtime-parity quartet (lazy/memo/failure + one browser leg) · `check`+`test` green · `npm run size` exit 0 | `app/src/index.ts` · `app/package.json` · ~15–20 site/lib+pages consumer files (compile-checked repoint, `tsc` enumerates) · app identity/layering tests |
| **S2 — measure + budget restore** (ADR-0197 cl.5; MANDATORY, immediately after S1) | Fresh `npm ci` + `npm run size`; record landing figure on GH #1092; `APP_MARGINAL_BUDGET` 103 → 102 KB + ledger note ("the promised diet landed") | — (locks S1) | `npm run size` exit 0 at 102 KB with ≥ 2 KB measured headroom; ledger note updated in the same change | `scripts/measure-size.mjs` only |
| **S3 — double-catalog audit** (CONTINGENT: run only if S2's headroom < 2 KB, else file as follow-on finding on #1092) | Enumerate barrel-graph consumers of the a2ui-basic catalog pair; subpath or lazy-compose it off the eager path | ~2.5–8 KB | Bundle-shape test proving a2ui-basic absent from the app entry chunk; runtime parity on the surface that consumed it; `size` exit 0 | `surface-host`/`conversation` catalog wiring · possibly `@agent-ui/a2ui` exports (if its export set changes shape → its OWN ADR, out of ADR-0197's scope) |
| **S4 — INEFFECTIVE_DYNAMIC_IMPORT ruling** (CONTINGENT, same trigger as S3; touches `@agent-ui/components`, coordinate ADR-0048/0080/0123 owners) | `controls/index.ts`'s static calendar/color-picker exports defeat `text-field.ts`'s dynamic imports (`text-field.ts:385,456`). Either (a) accept + document (warnings ruled benign, comment in controls/index.ts + measure-size note) or (b) restructure the components barrel — which changes ITS export set → a separate ADR, not this arc | ~4–5 KB (option b only) | Option a: the two Rolldown warnings documented, zero code change. Option b: out of #1092's scope — mint its own record first | components `controls/index.ts` · text-field/calendar/color-picker cluster rows in measure-size |

## Sequencing

S1 → S2 (same PR or adjacent; S2 is the lock). Expected: S1 alone lands ~80–85 KB, making S3/S4
follow-on findings rather than build slices — they execute ONLY if S2 measures < 2 KB headroom
under 102 KB. S3 before S4 (app-local before cross-package). Nothing lands before ADR-0197 is
ratified (proposed-marker law).

## Out of scope (hard fences)

- **No budget raise, ever** — measure-size.mjs's 2026-08-17 ledger note rules the 103 KB re-base
  the LAST of its class; this arc only lowers it (back to 102 KB, S2).
- **No reopening #468** (stale 79 KB baseline — GH #1080's ruling); #1092 owns this arc.
- **No behavior change** — every split ships the markdown-lazy-style runtime-parity + bundle-shape
  test pair; pixel truth on the site's agent-admin pages is part of S1's review.
- **No components-barrel restructure inside this arc** (S4 option b requires its own ADR).
- **No module moves on disk** — S1 is barrel/exports/consumer wiring only.

## Risks

- **Consumer sprawl:** ~20 site files import agent-admin symbols from the `.` barrel; mitigation —
  the migration is compile-enforced (`tsc` red until every site is repointed), one writer, one PR.
- **ADR number collision:** 0197 minted by a non-host seat; host re-numbers at ratification if a
  parallel lane claimed it (host-owned ADR numbers, 2026-08-16 ruling).
- **Estimate risk:** gz ≠ rendered×0.09 exactly (shared-dictionary effects); S2's fresh measure is
  the truth, and S3/S4 are the contingency if the estimate over-promised.
