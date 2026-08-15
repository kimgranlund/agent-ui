---
name: component-packaging
description: >-
  Route to the build-time SHAPE standards for a ui-* component: the per-component folder and
  its exact file set, the single {name}.css convention, barrels/exports and package.json
  subpaths, the {name}.md descriptor schema, and the marginal-size budget discipline. Use for
  "where do the files go", "what does the descriptor declare", "how is this exported",
  "what's the size budget" — when laying a component onto disk or wiring it into the package
  surface. Routing only: the standards live in .claude/docs/references/ and the descriptor
  schema source (cite, never copy). NOT for design-time law — anatomy/geometry/states/tokens
  (component-standards) — or the test bar (component-testing).
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
  enumeration, preview partition sets; see [[component-testing]] for the gate list.

## The descriptor generation ratchet (ADR-0173) — read `references/descriptor-generation-ratchet.md`

Whether a control's `static props` table is generated from its descriptor (never the catalog
row), the five `attributes[]` grammar fields that carry generation-facing facts (`attribute` ·
`tsType` · `const` · `codec` · `description`), the per-control (never fleet-wide) ratchet timing
for retiring the old `compareDescriptorToProps` trip-wire, the drift-wire test names, the
7-control bespoke-codec allowlist, and the regenerate command all live in
`references/descriptor-generation-ratchet.md` — read it before converting a control or touching
a `{name}.props.gen.ts` sibling. Architecture-level rationale (why props generate but the catalog
row never does) lives in `component-standards`' own `references/descriptor-generation.md`
instead — this file is the packaging-mechanics angle only, not a second copy of that one.

## Cross-links

Design-time law → [[component-standards]] · probes/gates/DoD →
[[component-testing]] · prior mechanisms → [[component-patterns]] · the
build procedure that walks this shape in order → [[component-build]].
