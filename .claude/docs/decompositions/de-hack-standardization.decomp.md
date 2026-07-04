# Decomposition — de-hack / standardization wave

> 2026-07-04. Status: **DONE — all four standardized; gates green** (check · jsdom 2407 · browser 582). T1: `site/` now has its own vitest `test.projects` project (2369 packages + 38 site jsdom; 14 site browser); the 3 tests moved to `site/lib/`. T2: ADR Status is a bare canonical keyword + a biting lint gate (49 ADRs normalized; ALL-CAPS heuristic deleted). T3: a2ui-live consumes the shared `canvas-surface` (one source). T4: off `@vitest/browser/context` (21 files, zero deprecation). Ran as Phase 1 (T4‖T2) → gate → Phase 2 (T3‖T1) → gate. Owner: host-orchestrated. Trigger: Kim — "standardize so we don't rely on hacks" (all four selected). Follows the docs-site playground wave ([ADR-0077](../adr/0077-docs-site-genui-playground-preview-catalog-adr-index.md)); resolves several of its recorded follow-ups.
>
> Residual (agent-flagged, NOT done): the README **index-summary table**'s Status column keeps its own human-facing annotation convention (e.g. "accepted *(amended by 0014)*") — normalize too if wanted. ADR-0066 prose still says "nine" curated icons (the icon fork grew the vocab to 11). Extra hand-authored inline SVGs remain in `button-doc.ts`/`button-permutations.ts`. The a2ui-mode preview caret/focus-reset-on-rebuild residual (ADR-0077).

## The four hacks → standardizations

- **T1 — Site tests get a real test project.** Today `component-preview.browser.test.ts`, `site-adr-index.test.ts`, `site-preview-catalog.test.ts` live under `packages/…/src/` because vitest's `include` is packages-only ([[site-tests-excluded-from-vitest]]). Give `site/` its own vitest project (jsdom + browser); MOVE those 3 tests into `site/` and fix their imports.
- **T2 — ADR status becomes machine-readable.** The ADR-index badge derives status from an ALL-CAPS `SUPERSEDED` text heuristic (ADR-0077 follow-up). Normalize every ADR `Status` cell to a single canonical keyword; drop the heuristic; add a lint gate.
- **T3 — Consolidate the canvas.** `site/lib/canvas-surface.css` is a proven COPY of `a2ui-live`'s artboard. Point `a2ui-live` at the shared module; **preserve `canvas-surface`'s public API**; re-verify a2ui-live gates.
- **T4 — Off the deprecated vitest browser API.** Every `*.browser.test.ts` imports the deprecated `@vitest/browser/context`; migrate the repo to `vitest/browser`.

## Dependencies & phasing (avoid the concurrent-edit tangle)

DAG: `T4 → T1` (T1 moves already-migrated browser tests + owns the config) · `T4 → T3` (T3 may touch `a2ui-live.browser.test.ts` after its migration) · `T2 → T1` (T1 moves the final `site-adr-index.test.ts`). `T4 ⟂ T2` (disjoint). `T3 ⟂ T1` iff T3 keeps `canvas-surface`'s public API stable.

- **Phase 1 (parallel, disjoint files):** T4 (vitest API — browser tests + configs) ‖ T2 (ADR status — ADR docs + `adr.ts` + jsdom test). No shared files. → host gate.
- **Phase 2 (parallel, strict ownership):** T3 (owns `a2ui-live.*` + `canvas-surface.*`, API-stable) ‖ T1 (owns vitest configs + MOVES the 3 site tests; does NOT edit `canvas-surface`). → host gate.

## Per-task spec

### T2 — ADR status machine-readable (design, since it's the one with a real choice)
Each ADR `| **Status** | … |` cell must contain EXACTLY ONE keyword ∈ `{proposed, accepted, superseded, deprecated}`. Any superseded/deprecated DETAIL ("superseded by ADR-XXXX", "Never built", clause notes) moves to the existing `| **Supersedes / Superseded by** | … |` row. Audit all 77; most are already single-word — fix the few that aren't (known: 0037 = "proposed — **SUPERSEDED by [ADR-0038]**… Never built" → Status `superseded`, detail to the Supersedes row). Then simplify `adr.ts` `deriveStatusShort` to read the cell literally (keep the `StatusKey` union; drop the ALL-CAPS heuristic AND the 0007/0033 clause special-casing — unnecessary once cells are clean). Add a real-corpus lint gate: every `NNNN-*.md` (excl. template) Status ∈ the 4 keys. Update `site-adr-index.test.ts` spot-checks (0037→'superseded', 0007/0033→'accepted' now literal), the `0000-template.md` Status guidance, and the README lifecycle. **Chosen over full YAML frontmatter** — the blockquote-table header is the established 77-ADR convention; normalizing the cell + a lint is machine-readable-enough at a fraction of the blast radius (YAML-frontmatter migration is a bigger, separate call if ever wanted).

## Acceptance (every phase, host-run authoritative gate)
`npm run check` (tsc + check:site) · `npm test` (jsdom) · `npm run test:browser` (Chromium+WebKit) all green. T4 additionally: ZERO `@vitest/browser/context` DEPRECATED lines. T1 additionally: the 3 site tests run from `site/` (prove the new project executes them). T2: the status lint gate present + biting. T3: a2ui-live browser gates green with one canvas source.
