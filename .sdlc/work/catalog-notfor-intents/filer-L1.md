<!-- role=filer level=L1 model=sonnet effort=medium -->
## Warnings
None

## PR title
Catalog selection guidance: per-type `intents` and `notFor` sidecars rendered in the prompt inventory (ADR-0232 proposed)

## PR body
Tracks GH #1796 (size:big).

### Summary
Every agent-emittable catalog type now carries machine-readable selection guidance: 1 to 3 `intents` and up to 4 `notFor` edges, each with a short `why`. Guidance lives in a `selection.json` sidecar beside each `catalog.json`. A Node-only loader in `./agent` renders it as a clause on each catalog-derived inventory line, for example `- Badge (props: ...) · use: ... · not for: Progress (...)`. A coverage gate fails any type that has no entry. The design is recorded in ADR-0232, which stays `proposed` and is not self-ratified.

The sidecar is not in `catalog.json` or in descriptor frontmatter, for these reasons:
- The default catalog ships in the app's eager browser bundle, and that budget has zero headroom.
- `a2ui-basic` and persona types have no descriptor.
- ADR-0173 cl.5 keeps catalog content hand-curated.

### Changes
- **Loader.** New `agent/selection-guidance.ts`:
  - It validates shape and caps, with typed `SelectionGuidanceError` codes.
  - `selectionGuidanceFor` resolves `agent-ui`, `a2ui-basic`, and derived `<base>--<persona>` ids (union of base and persona).
  - `renderSelectionClause` throws on an unresolvable target.
  - It exports `SELECTION_GUIDANCE_CHAR_BUDGET = 8_600`.
  - It is added to `NODE_ALLOWED` in `gates.test.ts` as the fifth Node-only call site, and exported from the `./agent` barrel only.
- **Sidecars.** Five new files:
  - default: 80 types, 144 edges
  - a2ui-basic: 14 types, 20 edges
  - personas concierge, croupier and fixture-demo: 4 types between them
- **Inventory.** `catalogInventory` appends the clause after `(props: ...)`. A catalog or type with no sidecar entry composes the old line byte-identically. The `buildSystemPrompt` signature is unchanged.
- **Baseline.** `prompt-equivalence.baseline.json` was recaptured through the deliberate-change flow. Only `default`, `defaultExplicit`, `specific` and `blueSky` moved.
- **Worker.** The five sidecars are registered in `fs-shim-content.ts` `FILES`. `fs-shim.test.ts` is adjusted and gains a leg for on-disk sidecars against `FILES`.
- **Gates.**
  - A new coverage gate, `catalog/selection-guidance.test.ts`, checks bijection with the catalog types, reciprocity, the persona edge rule, and orphan sidecars. It carries the 5 required negative controls plus 2 extra.
  - A new loader unit test covers every rejection rule.
  - `prompt-drift.test.ts` gains four legs: clause present, no clause without a sidecar, budget, and the croupier derived catalog.
- **Docs.**
  - New ADR-0232 (`proposed`), plus a regenerated `adr-index.json`.
  - SPEC `a2ui-live-agent` v0.18 (SPEC-R6 paragraph and AC7) and its LLD-C4 row.
  - `a2ui-catalog.spec.md` v0.4 (§5.2 intro).
  - Rubric `a2ui-catalog` v0.3 with a new D7 "Selection guidance" row. `D1–D6` became `D1–D7` in the rubric, `a2ui-review-standards` and `a2ui-expert-harness.spec`.
  - `agent-model.md` glossary entry and the `choosing.ts` header.
  - Seven skills and two agents now mention `selection.json`.
  - Checked and unchanged: `CLAUDE.md`, `AGENTS.md`, `doc-standards`, `component-packaging`, `component-standards` descriptor-generation, the ADR-0173 and ADR-0071 bodies, and SPEC §5.1.

Byte cost: the guidance adds 8 277 chars to the default prompt, which is 24.5% of its 33 750 chars. That is under the 9 570-char ceiling, so the section-render fallback was not needed. The ADR states the cost.

### Verification
All three steps got a verifier verdict of pass, and each criterion was shown red against the base or a planted defect.
- **Step 1, loader, gate and sidecars:**
  - The two new test files pass (75 tests).
  - Python checks passed for bijection and pins, caps and rules, reciprocity, and banned prompt vocabulary.
  - The budget check printed `{ used: 8277, budget: 8600, ceiling: 9570 }`.
  - The `gates.test.ts` run and the em-dash and scope guards pass.
- **Step 2, inventory, baseline and Worker:**
  - Every default and a2ui-basic inventory line ends with its clause.
  - Only the four expected baseline keys moved.
  - The 7 prompt-gate files pass (162 tests), as does `fs-shim.test.ts` (15 tests).
  - Every sidecar on disk is registered in `FILES`.
- **Step 3, ADR and docs:**
  - The ADR greps pass.
  - The `site` sitemap and ADR tests pass (57 tests).
  - The twin-doc, D7 and skill/agent greps pass.
  - `harness_wiring_check.py --rubric-modes` passes (35/35).
- **Whole tree:**
  - `npm run check` exits 0.
  - The a2ui project tests pass (109 files, 2686 tests), and so do the tools project tests (25 files, 367 tests).
  - The em-dash guard passes: ADR-0232 has only its H1 em dash.
- **Not run:**
  - `npm run size` is already red at base (app marginal 106 987 B gz against a 106 559 B budget) and was not a criterion.
  - The Worker runtime was not run on this host. Serving is proven structurally by the `FILES`-versus-disk and aliased-module legs.
  - `doc_lint.py` is not a gate here.

## Changelog entry
Added: per-type selection guidance (`intents` and `notFor`) for the default, a2ui-basic and persona catalogs, as `selection.json` sidecars. The model now sees a `· use: ... · not for: ...` clause on each catalog inventory line. A coverage gate requires an entry for every emittable type. Selection guidance adds 8 277 chars (24.5%) to the default prompt, and the pinned prompt baselines were recaptured. ADR-0232 is proposed.

## Follow-ups
- decide: ADR-0232 is `proposed` and awaits Kim's ratification, and the prompt grows 24.5%. Ratify it, amend it, or switch to the section-render fallback.
- fix-now: Post the due-process phase exit artifacts on GH #1796. The handoff barred issue comments inside the run, so this belongs to the conductor.
- note: Reciprocity may have forced weak reverse `why`s. The gates cannot judge wording, so the D7 review must.
- note: The dogfood (genui) inventory is descriptor-derived and carries no guidance. In-page tooling and the site cannot read the Node-only sidecar. A browser-safe projection of the sidecar was left out of this change.
- note: The new docs, SPEC and rubric are dated 2026-10-05 to match the ratification date, while the local clock and the budget comment read 2026-10-04.
- note: `npm run size` was already red at base, and the Worker serving of the sidecars is proven only structurally.
