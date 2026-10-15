---
id: T-0093
title: "Foundations Wave 0: generator, foundations.gen.css, ui-glyph and symbol alias, codemod, probe, blocking census gate (ADR-0245)"
type: feature        # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-12
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Land the shared tooling of the foundations campaign on main, additive and visually inert, so ten file-disjoint lanes can migrate in parallel afterwards. ADR-0245 is ratified (accepted); its clause 10 (strategy, waves 10b, gates 10c, consumer stability 10d, rollback 10e) and clauses 1, 4, 5 and 9 are the contract; the campaign plan is .sdlc/foundations-campaign-plan.md (Wave 0 section) and Kim's step 0 rulings are in .sdlc/foundations-mockup/approval.md (pill kept for button and toggle radius, avatar 4n, A2UI canvas at data-scale md).

## Scope (one brief paragraph, per the Inner loop rule)
Build, in this order, committing early: (1) vendor `scale.mjs` (byte copy, see ADR clause 1) and a generator that writes `packages/agent-ui/shared/src/tokens/foundations.gen.css` (additive `--md-sys-*` tokens inside opt-in `data-tier`/`data-scale`/`data-size` regions only, nothing leaks outside them) with `check()` M1 to M10 as a gate, drift-gated like the other `*.gen` files; (2) `ui-glyph` with the closed 12-mark path table (descriptor, registry regeneration per ADR-0233, doc page and nav, visual baseline) and the `symbol` prop on `ui-icon` and `ui-glyph` with `glyph` kept as a deprecated alias, plus the `mapsTo` edits of clause 4 and the `glyph-usage-coverage.test.ts` follow-through; (3) `scripts/foundations-codemod.mjs <dir>` that rewrites a directory's hand-tabled geometry reads, `glyph` call sites and `[scale]`/`[density]` uses to the derived tokens and `symbol` (idempotent, dry-run flag, prints a summary); (4) `scripts/foundations-probe.mjs` (Playwright: computed height, padding and radius per control against `scale.mjs` resolve, with the data-tier opt-in); (5) `scripts/foundations-census.mjs` printing the number of files still on hand-tabled geometry, the glyph prop or the old axes, and `--gate` that fails on any file not on the allowlist `scripts/foundations-allowlist.json` (one entry per line, each with a justification string) and on any stale entry, joined to the existing `check:scripts` chain with no new CI job; the allowlist starts as every current violator so the gate is green. Do not migrate any control; lanes do that. Negative control: show the gate red on a planted `padding: 13px` and on a removed allowlist entry, then green.

## Constraints
Local gate: `npm run check` plus the touched folders' tests; CI runs the full suite. Never hand-edit generated files; regenerate with their scripts. No em dashes. Commit locally, do not push; no per-ticket verifier (Kim reviews, batched at the end). Default pages must look unchanged: the 66 default goldens and `dimensions.test.ts` stay byte-identical.

## Closed

2026-10-12: merged #1920
