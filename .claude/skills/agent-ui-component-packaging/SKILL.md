---
name: agent-ui-component-packaging
description: >-
  Route to the build-time SHAPE standards for a ui-* component: the per-component folder and
  its exact file set, the single {name}.css convention, barrels/exports and package.json
  subpaths, the {name}.md descriptor schema, and the marginal-size budget discipline. Use for
  "where do the files go", "what does the descriptor declare", "how is this exported",
  "what's the size budget" — when laying a component onto disk or wiring it into the package
  surface. Routing only: the standards live in .claude/docs/references/ and the descriptor
  schema source (cite, never copy). NOT for design-time law — anatomy/geometry/states/tokens
  (agent-ui-component-standards) — or the test bar (agent-ui-component-testing).
user-invocable: false
disable-model-invocation: false
---

# Component packaging — the shape layer's map

How a `ui-*` component is laid out on disk, exposed by the package, and described to its
consumers. Routing + reading order only; each row's owner doc/source is the single authority.

## The routing table

| Question | Owner (read this) | Decision authority |
|---|---|---|
| Folder + file set, single-CSS rule, barrels, host page | `.claude/docs/references/component-packaging.md` (the resolved shape) | ADR-0003 (single-file component CSS + barrels + host-page packaging) |
| The `{name}.md` descriptor — what the frontmatter declares (the field set `FIELD_SHAPE` enumerates) | the schema SOURCE: `packages/agent-ui/components/src/descriptor/component-descriptor.ts` (hand-rolled parser — **block-style YAML + inline `[a, b]` arrays**, and inline flow mappings for `codec:` — ADR-0173 OF1; GH #761 corrected this row's earlier they-do-not-parse claim, contradicted by the parser's own tests) | ADR-0004 (descriptor replaces api.json; one parser, three consumers — the contract trip-wire, the site, and ADR-0173's `scripts/generate-props.mjs` generator) |
| Whether a control's `static props` table is GENERATED from its descriptor, or still hand-mirrored; the widened grammar fields; the per-control ratchet | the generator SOURCE: `packages/agent-ui/components/src/descriptor/generate-props.ts` (+ CLI `scripts/generate-props.mjs`) — see "The descriptor generation ratchet" below | ADR-0173 (descriptor inversion — the props layer only; the catalog row stays hand-authored forever, cl.5) |
| Base classes, `static props` + `ReactiveProps` declare-merge, events, `internals` | `.claude/docs/plan.md` §5, realized in `packages/agent-ui/components/src/dom/` | — |
| Naming, strict-TS constraints, import layering | `CLAUDE.md` (Conventions — already in every session's context; don't restate it) | the per-package `layering.test.ts` trip-wires |
| Size budgets + tree-shaking | `scripts`' `npm run size` — **manual by Kim's ruling, deliberately NOT in `check && test`**; run it by hand whenever the bundle surface changes | ADR-0040 (budget re-base + the gate-wiring recommendation recorded, not applied) |

## Packaging facts that bite (route-to hints)

- A component **self-defines on import** (`customElements.get` guard); consumers import the
  folder's barrel or the package subpath — check `packages/agent-ui/components/package.json`
  `exports` for the subpath pattern (e.g. `./controls/text`, `./controls/theme-provider`).
- A **direct single-control subpath consumer outside the package** needs a matching
  `vitest.config.ts` `resolve.alias` entry (the broad `@agent-ui/components` alias
  prefix-matches and mangles subpaths under vitest) — the `controls/text` entry there is the
  commented precedent.
- The descriptor is **trip-wired against source, permanently** (`compareDescriptorToSource`):
  `customStates` must match the `internals.states` calls + `:state()` CSS; every styled slot must
  be declared. Declare truthfully or the gate reds. It is also trip-wired against props
  (`compareDescriptorToProps`) **for unconverted controls only** — see the ratchet below; a
  converted control's props are checked by the generator-drift gate instead.
- New site-visible surfaces (a doc/demo page) drag standing site gates with them — nav/TOC
  enumeration, preview partition sets; see [[agent-ui-component-testing]] for the gate list.

## The descriptor generation ratchet (ADR-0173)

The descriptor inverts from a hand-mirrored MIRROR into the generating SOURCE for exactly one
artifact — a control's `static props` table — never the catalog row (`@agent-ui/a2ui`'s own
hand-authored wire contract, cl.5; two of its three catalog shapes can never generate from fleet
descriptors at all). Five grammar fields on an `attributes[]` row carry the generation-facing facts
beyond `type`/`default`/`reflect`/`values` (`component-descriptor.ts`'s `ParsedAttribute`):

| Field | Carries | Specimen |
|---|---|---|
| `attribute` | string \| `false` — an attribute-name override, or opts a prop OUT of DOM reflection | `button.md`'s `icon-only` |
| `tsType` | a TS type expression, legal (and required) only when `type: json` AND no `codec:` is declared (a codec's own type rides its import) | PROSPECTIVE — no live descriptor carries one at HEAD (GH #761); the shape a `split.md` sizes-array row WOULD use: `number[] \| undefined` |
| `const` | the exported shared-tuple constant name, legal only when `type: enum` | `badge.md`'s `const: INTENTS` |
| `codec` | `{ import, name }` — a bespoke, already-assembled `PropConfig` import for a control whose codec encodes real validation logic no field can express | `table.md`'s `codec: { import: './table-model.ts', name: 'tableColumnsProp' }` |
| `description` | plain-scalar per-attribute teaching, emitted as a provenance-stamped comment in the generated file | — |

**The ratchet is per-control, never fleet-wide** (cl.6): a control is "converted" the moment its
folder carries a committed `{name}.props.gen.ts` — the filesystem itself is the migration-allowlist,
no separate list to keep in sync (`scripts/generate-props.mjs`'s own `alreadyConverted()`). The OLD
`compareDescriptorToProps` (s10) trip-wire in a control's own `*-descriptor.test.ts` retires in the
SAME COMMIT that lands its generator-drift-gate coverage — never a commit where both exist for a
control, never one where neither does (cl.4c/OF4).

**The drift-wire test names**: `descriptor/props-gen-driftwire.test.ts` regenerates every converted
control's props module in-memory from its `.md` and diffs it byte-for-byte against the committed
`{name}.props.gen.ts` (cl.4b — the generator CLI and this gate share ONE implementation,
`generate-props.ts`, so they cannot drift into two). `a2ui/src/catalog/default/descriptor-agreement.test.ts`
is a SEPARATE, fleet-wide gate live from wave 1 (not scoped to converted controls) — it checks every
catalog `PropDef` whose `mapsTo` names a descriptor attribute agrees on type/enum members (cl.5);
curated omissions and non-props `mapsTo` targets (`textContent`, controller-owned props, value-mark
plumbing) are legal, recorded exceptions in that file's own table, never a silent pass.

Regenerate a converted control after any descriptor edit: `node scripts/generate-props.mjs {name}`
(no args regenerates every already-converted control). Never hand-edit a `{name}.props.gen.ts` —
the drift gate's own negative-control assertion exists to catch exactly that.

## Cross-links

Design-time law → [[agent-ui-component-standards]] · probes/gates/DoD →
[[agent-ui-component-testing]] · prior mechanisms → [[agent-ui-component-patterns]] · the
build procedure that walks this shape in order → [[agent-ui-component-create]].
