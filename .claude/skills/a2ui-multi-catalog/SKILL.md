---
name: a2ui-multi-catalog
description: >-
  Route to the ratified multi-catalog interop patterns (ADR-0169) for @agent-ui/a2ui. Use for
  "add another catalog", "register a catalog / a second catalog", "upstream A2UI interop",
  "a2ui-basic", "catalog schema ground truth" — and for widening wire tolerances for an
  upstream dialect (foreign commit/action shapes) without forking the renderer, per-catalog
  function implementations, or threading catalogId end-to-end (picker → proxy/worker →
  producer → authority stamp). ALSO §5's composed/derived catalogs: a "persona catalog
  fragment" (CatalogFragment) merged via composeCatalog, "derived catalog" base--persona ids,
  "targetCatalogs" scoping, reject-loud collisions. NOT for composing payloads (a2ui-payload-authoring);
  NOT for the ui-* fleet map (component-catalog); NOT for agent-admin's Catalogs shelf/section
  or entry kinds (admin-library-kinds).
user-invocable: false
disable-model-invocation: false
---

# Multi-catalog interop — the ADR-0169 patterns

Five ratified patterns (§1–§5 below — §5 joined via GH #480/ADR-0172) govern every "another catalog" ask in `@agent-ui/a2ui`. The contract is
the ADR itself — `.claude/docs/adr/0169-a2ui-basic-catalog-upstream-interop.md` (accepted
2026-08-04); this skill routes to its clauses — the tables stay in the ADR. `a2ui-basic`
(upstream A2UI Basic) is the type specimen; any third catalog follows the same four patterns.

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
   collisions; `<base>--<persona>` naming; multi-base `targetCatalogs`.

## Citation key

`cl.N` = `.claude/docs/adr/0169-a2ui-basic-catalog-upstream-interop.md`'s Decision clause N
(ratified 2026-08-04). Cite by CLAUSE ID, never line number — "append-only" does not freeze line
positions (an in-place ratified amendment moved every line anchor this file once carried,
GH #761); clause ids survive every append.
`persona-catalog-composition.spec.md` = `.claude/docs/spec/persona-catalog-composition.spec.md`
(accepted); its `SPEC-R#`/`SPEC-N#` ids and ADR-0172 (`.claude/docs/adr/0172-persona-catalog-
composition-intake.md`, accepted) are §5's own citation pair, the same "cite, don't restate the
table" discipline the `0169:N` citations above already follow.
