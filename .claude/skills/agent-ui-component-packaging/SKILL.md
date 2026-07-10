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
| The `{name}.md` descriptor — what the frontmatter declares (the field set `FIELD_SHAPE` enumerates) | the schema SOURCE: `packages/agent-ui/components/src/descriptor/component-descriptor.ts` (hand-rolled parser — **block-style YAML + inline `[a, b]` arrays**; flow mappings do not parse) | ADR-0004 (descriptor replaces api.json; one parser, two consumers — the contract trip-wire and the site) |
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
- The descriptor is **trip-wired against source** (`compareDescriptorToSource` /
  `compareDescriptorToProps`): `customStates` must match the `internals.states` calls +
  `:state()` CSS; every styled slot must be declared. Declare truthfully or the gate reds.
- New site-visible surfaces (a doc/demo page) drag standing site gates with them — nav/TOC
  enumeration, preview partition sets; see [[agent-ui-component-testing]] for the gate list.

## Cross-links

Design-time law → [[agent-ui-component-standards]] · probes/gates/DoD →
[[agent-ui-component-testing]] · prior mechanisms → [[agent-ui-component-patterns]] · the
build procedure that walks this shape in order → [[agent-ui-component-create]].
