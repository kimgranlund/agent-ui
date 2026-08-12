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
  "targetCatalogs" scoping, reject-loud collisions. NOT for composing payloads (a2ui-compose);
  NOT for the ui-* fleet map (agent-ui-catalog); NOT for agent-admin's Catalogs shelf/section
  or entry kinds (agent-admin-library-kinds).
user-invocable: false
disable-model-invocation: false
---

# Multi-catalog interop — the ADR-0169 patterns

Five ratified patterns (§1–§5 below — §5 joined via GH #480/ADR-0172) govern every "another catalog" ask in `@agent-ui/a2ui`. The contract is
the ADR itself — `.claude/docs/adr/0169-a2ui-basic-catalog-upstream-interop.md` (accepted
2026-08-04); this skill routes to its clauses — the tables stay in the ADR. `a2ui-basic`
(upstream A2UI Basic) is the type specimen; any third catalog follows the same four patterns.

**Routing boundary.** This skill answers and routes; the build lands elsewhere: renderer /
catalog / registry code → the `a2ui-builder` agent · payload authoring → `a2ui-compose` ·
fleet inventory → `agent-ui-catalog`. A "second catalog id" objection citing ADR-0097 is
answered by ADR-0169's own Non-collision section (its Non-collision section): 0097 rejected a policy VIEW
of the default catalog; a genuinely distinct component set with its own wire dialect earns a
real second catalog. A "compose a persona's local patterns onto a base catalog" ask routes to
§5 below, NOT to §1 — §1 registers a whole, independently-authored catalog beside the default;
§5's compose-time overlay MERGES a persona-scoped fragment onto an ALREADY-registered base. The
two have no merge primitive in common (`persona-catalog-composition.spec.md` §1's own framing).

## 1 · Registering a catalog beside the default

A new catalog is a sibling package folder mirroring `default/`'s shape — `catalog.json` +
`index.ts` + `factories.ts` + `functions.ts` + its tests (Decision cl.1) —
and it pre-registers in the `Renderer` constructor, right after the default:
`this.#registry.register(catalog, factories, functions)` (cl.2). That makes
every renderer host catalog-capable with zero call-site edits. Two shapes the ADR explicitly
rejects (cl.2's rejected-alternatives list): rebuild-the-renderer-per-catalogId, and registering only in one
page's bootstrap — interop is a property of the PACKAGE, not a demo.

The partition is gate-encoded: every upstream type is either a declared
`components` key or a reasoned row in the exclusion table (cl.12), and a
coverage test asserts exactly-one-of for the full upstream set (cl.14 — the
ADR-0087 discipline). An excluded type simply isn't declared, so an emitted instance fails
CATALOG at validate — the allowlist working as designed (cl.12's E1 row); separately, the
registry's FACTORY_MISSING gate guarantees every DECLARED type has a factory (the Context's FACTORY_MISSING paragraph).

## 2 · Machine schema is ground truth

The pinned upstream MACHINE schema (the literal JSON Schema files, fetched and dated) is the
authority for every wire property name, enum, required-ness, and children shape — it
supersedes the prose implementation guide wherever the two differ (the Context's schema-authority ruling); prose keeps
authority for RENDERING guidance only (the same Context passage). Every mapping-table cell is read from
the schema — prose-inferred names are the rev.1 defect the ADR itself closed: rev.2
re-derived five inferred prop names against the fetched schema and records the closure
(cl.9 provenance; F1).

Good: "the schema's `oneOf` at upstream-basic-catalog.json says `name` is a closed 59-value
enum, so declare that enum." Bad (labeled): "the v0.9.1 guide's example shows `iconName`, so
use that" — prose-derived wire names are how rev.1's five `⚑` markers happened.

## 3 · Widen wire tolerances at the seams, not by forking

A foreign dialect's commit or action shape lands as a CLOSED widening at the existing seam,
byte-identical when unused — a renderer fork or an improvised per-catalog branch is the
anti-pattern these seams exist to make unnecessary:

- **Two-way commits** — `ValueSlot` gains optional `readProp` (the DOM property read on
  commit, when it differs from the wire prop) and a closed `marshal` literal enum
  (`'singletonStringList'`); absent ⇒ today's behavior, and `marshal` stays a JSON-safe enum,
  never a function (cl.7 — amends ADR-0019/0161). This is exactly the repair
  path `input.ts`'s own closing law demands: "repair `a2ui-catalog` and re-derive, do not
  improvise" (the Context's no-improvised-fallback ruling).
- **Actions** — upstream's `{event:{name,context}}` shape is a THIRD documented Postel arm at
  the single wire-read chokepoint `readActionSpec`; the canonical `{action,…}` shape and the
  outbound wire are untouched (cl.10 — amends ADR-0011). Arms the renderer
  cannot honestly serve are EXCLUDED with a named follow-up, and most fail loudly at
  validate — with one recorded exception: `{functionCall}` VALIDATES but is excluded at
  render time only (the Button paints; the click dispatches nothing), because
  `matchesSchemaType` deliberately checks only top-level prop types; its validate-time gate
  is the GH #429 follow-up (cl.10's booked follow-up + cl.12's E7 row).

## 4 · Per-catalog functions + catalogId threaded end-to-end

- **Function impls override per catalog**: `Registry.register` takes an optional third
  `functions` table; lookup is `entry.functions?.[name] ?? catalogFunctions[name]`
  (cl.8). Two dialects (`{valid,message}` vs upstream booleans) share names
  without colliding; the shared table stays the default catalog's home.
- **`catalogId` threads the whole path**: the client runner forwards the picker's sanitized
  id on the POST body (cl.5; picker entry cl.6); both server
  hosts hold ALL catalogs in a map and select fail-closed via the shared `selectCatalog`
  helper — an unknown id degrades to the default (no 500, no mixed catalog+prompt;
cl.3); the one
  `deps.catalog` seam feeds both prompt and validator, and the producer deletes any pinned
  catalog-id literal and stamps `createSurface.catalogId = deps.catalog.catalogId` as the
  authority over the model-authored id (cl.4 — the mis-stamp at
  `produce.ts:81` is the cautionary specimen).
- **Id policy**: short local id (`a2ui-basic`) is the registry/picker/corpus/outbound key;
  the upstream canonical URI registers as an inbound-only alias — same bytes, second id;
  the picker and the outbound stamp use the short id alone (cl.13).

## 5 · Composed/derived catalogs

A persona's own local pattern set (a booking flow's calendar+confirm idiom, a card-table's
hand/score layout) is package-authored `catalog.json`-shaped CONTENT, never a whole standalone
`Catalog` — `composeCatalog(base: Catalog, local: CatalogFragment, personaId: string): Catalog`
(`catalog/compose.ts`) merges it onto an ALREADY-registered base at `Renderer` construction time
(`persona-catalog-composition.spec.md` SPEC-R2, ADR-0172 cl.2), producing a NEW, independently-
registered `Catalog` document — never a fork of `Registry.register` itself (SPEC-N4): the
derive-then-register step is strictly upstream, calling the SAME `register()` seam §1's whole-
catalog pattern already uses, so `CATALOG_FACTORY_MISSING` and `loadCatalog`'s re-validation both
apply unmodified.

**Collision policy: reject-loud (ruled).** A colliding component/function name fails that
(fragment, base) pairing with a `CatalogComposeError` at `Renderer` construction — never a silent
override; a collision against one base never blocks another base's non-colliding pairing. The
full policy prose is ADR-0172 cl.4 + `persona-catalog-composition.spec.md` SPEC-R3 (cite, don't
restate — this section's earlier copy is exactly what GH #761 thinned).

**Naming: `<base>--<persona>`.** `agent-ui--concierge`, `a2ui-basic--croupier` — the base id is
always the FIRST segment, so a reader (or `sanitizeCatalog`) can tell which base a derived id
came from without a lookup. A fragment MAY target more than one base (its own `targetCatalogs`
field) — a fragment naming both `agent-ui` and `a2ui-basic` produces TWO independently-composed,
independently-registered derived catalogs, one per base, never one three-way merged document.
Worked pattern (both shipped bases):

```
targetCatalogs: ['agent-ui', 'a2ui-basic']
  → composeCatalog(agentUiCatalog, fragment, 'concierge')   registers as agent-ui--concierge
  → composeCatalog(a2uiBasicCatalog, fragment, 'concierge') registers as a2ui-basic--concierge
```

An unregistered `targetCatalogs` entry (a typo, or a not-yet-shipped third base) fails loud the
SAME way a collision does — never a silently-skipped pairing.

**Threading.** A turn resolves to the base alone (identity case) or the derived id; a base
mismatch degrades to the base, never an error (SPEC-R5 AC3 owns the full resolution table).
`sanitizeCatalog` (`agent-admin-schema.ts`) recognizes registered derived ids with its standing
fail-closed-to-default posture.

## Citation key

`cl.N` = `.claude/docs/adr/0169-a2ui-basic-catalog-upstream-interop.md`'s Decision clause N
(ratified 2026-08-04). Cite by CLAUSE ID, never line number — "append-only" does not freeze line
positions (an in-place ratified amendment moved every line anchor this file once carried,
GH #761); clause ids survive every append.
`persona-catalog-composition.spec.md` = `.claude/docs/spec/persona-catalog-composition.spec.md`
(accepted); its `SPEC-R#`/`SPEC-N#` ids and ADR-0172 (`.claude/docs/adr/0172-persona-catalog-
composition-intake.md`, accepted) are §5's own citation pair, the same "cite, don't restate the
table" discipline the `0169:N` citations above already follow.
