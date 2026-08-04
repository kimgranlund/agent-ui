---
name: a2ui-multi-catalog
description: >-
  Route to the ratified multi-catalog interop patterns (ADR-0169) for @agent-ui/a2ui. Use for
  "add another catalog", "register a catalog / a second catalog", "upstream A2UI interop",
  "a2ui-basic", "catalog schema ground truth" — and for widening wire tolerances for an
  upstream dialect (foreign commit/action shapes) without forking the renderer, per-catalog
  function implementations, or threading catalogId end-to-end (picker → proxy/worker →
  producer → authority stamp). NOT for composing payloads against a catalog (a2ui-compose);
  NOT for the ui-* fleet map — which control does which job (agent-ui-catalog).
user-invocable: false
disable-model-invocation: false
---

# Multi-catalog interop — the ADR-0169 patterns

Four ratified patterns govern every "another catalog" ask in `@agent-ui/a2ui`. The contract is
the ADR itself — `.claude/docs/adr/0169-a2ui-basic-catalog-upstream-interop.md` (accepted
2026-08-04); this skill routes to its clauses — the tables stay in the ADR. `a2ui-basic`
(upstream A2UI Basic) is the type specimen; any third catalog follows the same four patterns.

**Routing boundary.** This skill answers and routes; the build lands elsewhere: renderer /
catalog / registry code → the `a2ui-builder` agent · payload authoring → `a2ui-compose` ·
fleet inventory → `agent-ui-catalog`. A "second catalog id" objection citing ADR-0097 is
answered by ADR-0169's own Non-collision section (`0169:98-110`): 0097 rejected a policy VIEW
of the default catalog; a genuinely distinct component set with its own wire dialect earns a
real second catalog.

## 1 · Registering a catalog beside the default

A new catalog is a sibling package folder mirroring `default/`'s shape — `catalog.json` +
`index.ts` + `factories.ts` + `functions.ts` + its tests (`0169:114-131`, Decision cl.1) —
and it pre-registers in the `Renderer` constructor, right after the default:
`this.#registry.register(catalog, factories, functions)` (`0169:133-154`, cl.2). That makes
every renderer host catalog-capable with zero call-site edits. Two shapes the ADR explicitly
rejects (`0169:147-150`): rebuild-the-renderer-per-catalogId, and registering only in one
page's bootstrap — interop is a property of the PACKAGE, not a demo.

The partition is gate-encoded: every upstream type is either a declared
`components` key or a reasoned row in the exclusion table (`0169:467-477`, cl.12), and a
coverage test asserts exactly-one-of for the full upstream set (`0169:501-525`, cl.14 — the
ADR-0087 discipline). An excluded type simply isn't declared, so an emitted instance fails
CATALOG at validate — the allowlist working as designed (`0169:471`, E1); separately, the
registry's FACTORY_MISSING gate guarantees every DECLARED type has a factory (`0169:45-49`).

## 2 · Machine schema is ground truth

The pinned upstream MACHINE schema (the literal JSON Schema files, fetched and dated) is the
authority for every wire property name, enum, required-ness, and children shape — it
supersedes the prose implementation guide wherever the two differ (`0169:21-38`); prose keeps
authority for RENDERING guidance only (`0169:40-41`). Every mapping-table cell is read from
the schema — prose-inferred names are the rev.1 defect the ADR itself closed: rev.2
re-derived five inferred prop names against the fetched schema and records the closure
(`0169:286-288`, cl.9 provenance; `0169:565-567`, F1).

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
  never a function (`0169:233-260`, cl.7 — amends ADR-0019/0161). This is exactly the repair
  path `input.ts`'s own closing law demands: "repair `a2ui-catalog` and re-derive, do not
  improvise" (`0169:71-79`).
- **Actions** — upstream's `{event:{name,context}}` shape is a THIRD documented Postel arm at
  the single wire-read chokepoint `readActionSpec`; the canonical `{action,…}` shape and the
  outbound wire are untouched (`0169:397-417`, cl.10 — amends ADR-0011). Arms the renderer
  cannot honestly serve are EXCLUDED with a named follow-up, and most fail loudly at
  validate — with one recorded exception: `{functionCall}` VALIDATES but is excluded at
  render time only (the Button paints; the click dispatches nothing), because
  `matchesSchemaType` deliberately checks only top-level prop types; its validate-time gate
  is the GH #429 follow-up (`0169:412-417` + the E7 row at `0169:477`; `0169:552-555`).

## 4 · Per-catalog functions + catalogId threaded end-to-end

- **Function impls override per catalog**: `Registry.register` takes an optional third
  `functions` table; lookup is `entry.functions?.[name] ?? catalogFunctions[name]`
  (`0169:262-281`, cl.8). Two dialects (`{valid,message}` vs upstream booleans) share names
  without colliding; the shared table stays the default catalog's home.
- **`catalogId` threads the whole path**: the client runner forwards the picker's sanitized
  id on the POST body (`0169:211-216`, cl.5; picker entry `0169:218-231`, cl.6); both server
  hosts hold ALL catalogs in a map and select fail-closed via the shared `selectCatalog`
  helper — an unknown id degrades to the default (no 500, no mixed catalog+prompt;
`0169:156-184`, cl.3); the one
  `deps.catalog` seam feeds both prompt and validator, and the producer deletes any pinned
  catalog-id literal and stamps `createSurface.catalogId = deps.catalog.catalogId` as the
  authority over the model-authored id (`0169:186-209`, cl.4 — the mis-stamp at
  `produce.ts:81` is the cautionary specimen).
- **Id policy**: short local id (`a2ui-basic`) is the registry/picker/corpus/outbound key;
  the upstream canonical URI registers as an inbound-only alias — same bytes, second id;
  the picker and the outbound stamp use the short id alone (`0169:479-499`, cl.13).

## Citation key

`0169:N` = `.claude/docs/adr/0169-a2ui-basic-catalog-upstream-interop.md` line N (the file as
ratified 2026-08-04). On any suspicion of drift — the ADR is append-only once accepted, so
line numbers move only via a superseding ADR — re-open the cited lines before relying on them.
