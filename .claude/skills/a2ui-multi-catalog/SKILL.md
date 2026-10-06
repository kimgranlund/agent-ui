---
name: a2ui-multi-catalog
description: >-
  The multi-catalog interop patterns (ADR-0169) for @agent-ui/a2ui. Use for "add another catalog",
  "register a catalog / a second catalog", "upstream A2UI interop", "a2ui-basic", "catalog schema
  ground truth", widening wire tolerances for an upstream dialect, per-catalog function
  implementations, or threading catalogId end-to-end. ALSO composed/derived catalogs: "persona
  catalog fragment" (CatalogFragment) via composeCatalog, "derived catalog" base--persona ids,
  "targetCatalogs" scoping, reject-loud collisions. NOT for composing payloads (a2ui-payload-
  authoring); NOT for the ui-* fleet map (component-catalog); NOT for agent-admin's Catalogs shelf
  or entry kinds (admin-library-kinds).
user-invocable: false
disable-model-invocation: false
---

# Multi-catalog interop — the ADR-0169 patterns

Five ratified patterns (§1–§5 below — §5 joined via GH #480/ADR-0172) govern every "another catalog" ask in `@agent-ui/a2ui`. The contract is
the ADR itself — `.claude/docs/adr/0169-a2ui-basic-catalog-upstream-interop.md` (accepted
2026-08-04); this skill routes to its clauses — the tables stay in the ADR. `a2ui-basic`
(upstream A2UI Basic) is the type specimen; any third catalog follows the same five patterns.

**Routing boundary.** This skill answers and routes; the build lands elsewhere: renderer /
catalog / registry code → the `a2ui-build-agent` agent · payload authoring → `a2ui-payload-authoring` ·
fleet inventory → `component-catalog`. A "second catalog id" objection citing ADR-0097 is
answered by ADR-0169's own Non-collision section (its Non-collision section): 0097 rejected a policy VIEW
of the default catalog; a genuinely distinct component set with its own wire dialect earns a
real second catalog. A "compose a persona's local patterns onto a base catalog" ask routes to
§5 below, NOT to §1 — §1 registers a whole, independently-authored catalog beside the default;
§5's compose-time overlay MERGES a persona-scoped fragment onto an ALREADY-registered base. The
two have no merge primitive in common (`persona-catalog-composition.spec.md` §1's own framing).

## The five patterns (index — read references/interop-patterns.md for the worked clauses)

1. **Registering a catalog beside the default** — a sibling package folder mirroring
   `default/`'s shape, pre-registered in the `Renderer` constructor (cl.1/cl.2); the
   gate-encoded declared-or-excluded partition (cl.12/cl.14).
   A catalog whose factories create controls the page has not imported registers with a control
   loader, the optional fourth `register` argument (ADR-0233): for example
   `renderer.register(catalog, factories, undefined, createControlLoader(CONTROLS, { css: 'host' }))`
   from `@agent-ui/components/loader` and `@agent-ui/components/registry`. The renderer then defers a
   surface's messages until the controls they need are defined, and reports a failed load as
   `CONTROL_LOAD` with placeholders (runtime SPEC-R9 AC3). Without a loader, apply stays synchronous.
2. **Machine schema is ground truth** — the pinned upstream JSON Schema is the wire authority,
   never the prose guide (cl.9; rev.1's `⚑`-marked prose-inferred-name defect).
3. **Widen wire tolerances at the seams, not by forking** — closed `ValueSlot`/`marshal`
   widening for two-way commits (cl.7) and a third Postel arm at `readActionSpec` for actions
   (cl.10), both byte-identical when unused.
4. **Per-catalog functions + `catalogId` threaded end-to-end** — `Registry.register`'s optional
   functions table (cl.8); the picker→server→producer id thread with fail-closed `selectCatalog`
   (cl.3/cl.4/cl.5/cl.6); short-id-is-the-key policy (cl.13).
5. **Composed/derived catalogs** — `composeCatalog(base, fragment, personaId)` merges a
   package-authored `CatalogFragment` onto an already-registered base (ADR-0172 cl.2); reject-loud
   collisions; `<base>--<persona>` naming; multi-base `targetCatalogs`. A persona package may ship
   `controls` records (`ControlRecord`) for its own controls; the derived entry's loader routes those
   tags to them and every other tag to the base loader (`persona-catalog-composition.spec.md`
   SPEC-R2 AC7).
   Selection guidance follows the same shape (ADR-0232): each base catalog and each persona fragment
   carries its own `selection.json` sidecar; `selectionGuidanceFor` resolves a derived
   `<base>--<persona>` id to the union of the base's entries and the fragment's. Edges inside one
   catalog or fragment are reciprocal; the persona edge rule lets a fragment edge point one-way at a
   base type present in every base the fragment targets, since a base can never name persona types.
   A third catalog ships its own sidecar, or its inventory composes with no clause.
   A new persona fragment also gets a hand-written agent manifest in `site/lib/agent-manifest/`
   (ADR-0235), or `site/lib/agent-manifest/agent-manifest.test.ts` reds.
   The capability registry (ADR-0237) indexes all of it per catalog id: `registryViewFor(registry, id)` from
   `@agent-ui/a2ui/registry` splits the id on the first `--` and returns the base's types plus the persona
   fragment's, with the guidance from both sidecars. It is a derived index, never a source (ADR-0173 cl.5), so
   a new persona fragment or catalog is registered the usual way and then picked up by
   `npm run generate:registry`; the loader's persona list is hard-coded and a gate holds it equal to
   `SHIPPED_PERSONA_CATALOG_MANIFESTS`. A persona type carries a derived control tag only when it is itself a
   fleet control (`PlayingCard`); a composition such as `BookingForm` carries none.
   A persona's server-safe `PersonaCatalogManifest` may declare `semanticChecks` (ADR-0238, proposed):
   pure, DOM-less domain checks `produce()` runs after the shared validator on every turn whose
   selected catalog is one of the persona's derived ids, resolved by `semanticChecksForCatalog`. The
   Croupier's hand check (`personas/croupier/checks.ts`) is the worked example; the contract is
   `src/catalog/semantic-check.ts`.

## Citation key

`cl.N` = `.claude/docs/adr/0169-a2ui-basic-catalog-upstream-interop.md`'s Decision clause N
(ratified 2026-08-04). Cite by CLAUSE ID, never line number — "append-only" does not freeze line
positions (an in-place ratified amendment moved every line anchor this file once carried,
GH #761); clause ids survive every append.
`persona-catalog-composition.spec.md` = `.claude/docs/spec/persona-catalog-composition.spec.md`
(accepted); its `SPEC-R#`/`SPEC-N#` ids and ADR-0172 (`.claude/docs/adr/0172-persona-catalog-
composition-intake.md`, accepted) are §5's own citation pair, the same "cite, don't restate the
table" discipline the `0169:N` citations above already follow.
