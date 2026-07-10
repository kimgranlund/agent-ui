---
name: agent-ui-catalog
description: >-
  Route to the fleet MAP for composing with agent-ui: which ui-* control does which job, how
  to enumerate what actually exists (the descriptors are the inventory — never a copied
  list), the tier partition, and which components are deliberately NOT agent-emittable. Use
  for "which control do I use for X", "what does the fleet have for showing/editing/picking
  Y", "is there a chart/date/upload control", "can an agent emit this type" — BEFORE
  composing a surface. Routing only: the inventory lives in the descriptors and the choosing
  guide (derive, never restate). NOT for building/changing a control
  (agent-ui-component-design/-create) or assembly mechanics (agent-ui-composition-patterns).
user-invocable: false
disable-model-invocation: false
---

# The fleet catalog — how to know what exists

The inventory is **derived, never listed here** — a copied roster is stale the day the next
control ships. Three owners answer every "what exists / which one" question:

## How to enumerate (the ground truth)

- **The descriptors ARE the inventory**: glob
  `packages/agent-ui/components/src/controls/*/[a-z]*.md` — one descriptor per shipped
  component; its frontmatter gives the tag, `tier:` (the geometry size-class — the
  control/indicator/range/pattern/container/layout/display partition), attributes with enum
  values, events, and slots. Read the descriptor before using an unfamiliar control; it is
  the attributes-as-API record (ADR-0004).
- **By-job routing**: the site choosing guide — the `GROUPS` table inside
  `site/pages/choosing.ts` (read the file; it exports nothing) — is the curated "I need to
  …" → control decision layer, and `site/gallery.html` (`<component-gallery>`) renders
  every shipped member live.
- **Agent-emittable vs page-chrome**: the A2UI default catalog
  (`packages/agent-ui/a2ui/src/catalog/default/`) is the emittable set;
  `EXCLUSION_ALLOWLIST` (in its `index.test.ts`) is the deliberate, permanent NOT-emittable
  set (page/app-owner chrome — the ADR-0087 catalog-or-allowlist gate). If you're composing
  a surface an AGENT will drive over A2UI, only catalog types exist; route payload work to
  [[a2ui-compose]].

## The stable shape (families only — members are the descriptors' to say)

The fleet organizes by job family: action (e.g. `ui-button`) · entry (e.g. `ui-text-field`)
· selection (e.g. `ui-checkbox`) · range (e.g. `ui-slider`) · overlay (e.g. `ui-popover`) ·
container/layout (e.g. `ui-card`; plus `ui-app-shell` in `@agent-ui/app`) · display (e.g.
`ui-text`). No roster here — an omission from a list is invisible, so a list here would
quietly answer "the fleet doesn't have that" wrongly (it already did once, at review). Even
the family SET grows: the form spine (`ui-field`/`ui-form-provider`) and app-owner chrome
(toast, theme-provider) are whole job families later than this taxonomy. Enumerate; never
recall.

Beyond `@agent-ui/components`: `@agent-ui/app` (the shell), `@agent-ui/router` (headless
core + element subpaths), `@agent-ui/icons` (swappable packs). The package DAG and when to
reach for each is [[agent-ui-compose-app]]'s territory.

## Cross-links

Assembly mechanics (forms, box-model, overlays, theming) → [[agent-ui-composition-patterns]]
· compose procedures → [[agent-ui-compose-ui]] / [[agent-ui-compose-layout]] /
[[agent-ui-compose-app]] · building a MISSING control → [[agent-ui-component-design]].
