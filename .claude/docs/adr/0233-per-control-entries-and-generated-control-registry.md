# ADR-0233 — Per-control entry points and a descriptor-generated control registry replace the family and CSS barrels

> Source: agent-ui ADR log (this directory, the numbered files ARE the index; status lives in each ADR's own header). · 2026-10-05
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-10-05 |
> | **Proposed by** | the sdlc-lite run `no-barrels` (architect L1, planner L3) |
> | **Ratified by** | kimgranlund (repo owner), 2026-10-05, ratified by Kim in the sdlc-lite session (run no-barrels) |
> | **Repairs** | `.claude/docs/references/component-packaging.md` · `.claude/docs/goals.md` · `.claude/skills/component-build/SKILL.md` · `.claude/skills/component-packaging/SKILL.md` · `component-testing` skill · `app-composition` skill · `package-release/references/release-facts.md` · `packages/agent-ui/components/README.md` · `packages/agent-ui/a2ui/README.md` · the a2ui runtime SPEC, the renderer LLD and the persona-composition SPEC · `genui-dogfood.lld.md` · amendments in [`0003-single-file-component-css-barrels-host-page.md`](./0003-single-file-component-css-barrels-host-page.md), [`0040-foundation-barrel-budget-7kb.md`](./0040-foundation-barrel-budget-7kb.md) and [`0080-per-control-exports-marginal-size-gate.md`](./0080-per-control-exports-marginal-size-gate.md) |
> | **Supersedes / Superseded by** | **Supersedes in part [ADR-0003](./0003-single-file-component-css-barrels-host-page.md)** (the barrel clause only; single-file CSS and the behavior-only `.ts` invariant stand) · **Amends [ADR-0080](./0080-per-control-exports-marginal-size-gate.md)** cl.1-2 (T4 becomes folders, `registry.gen.ts` and exports) · **Amends [ADR-0040](./0040-foundation-barrel-budget-7kb.md)** family row (it measures `./all`) · relates [ADR-0173](./0173-descriptor-inversion-generation-intake.md) (the descriptor is the generation source) · relates [ADR-0197](./0197-app-barrel-agent-admin-lazy-split.md) cl.5 (the app row re-bases downward, which cl.5 keeps ordinary) |

## Context

Two hand-maintained lists both run side effects. `packages/agent-ui/components/src/controls/index.ts`
holds 87 `export *` lines, each executing a top-level `customElements.define`. `src/component-styles.css`
holds one `@import` per control under an "append-only, do not reorder" rule. Every runtime importer of
the family barrel pays for the whole fleet. The four A2UI catalog factory modules (`default`,
`a2ui-basic`, `concierge`, `croupier`) import it, so any `@agent-ui/app` or renderer consumer carries all
87 controls eagerly, and Rolldown warns `INEFFECTIVE_DYNAMIC_IMPORT` because the barrel defeats
text-field's lazy calendar and color-picker arms.

Measured facts:

- Stub experiment (barrel stubbed to `export {}`, Rolldown): `app .` eager 114640 to 67415 B gz;
  `app/surface-host` 94682 to 28112 B gz.
- `npm run size` is red on main already: the app marginal row is 106987 against 106559 B gz (exit 1);
  the family row is 72051 against 72192 B gz.
- Each `{name}.ts` already self-defines and already imports its real sibling dependencies (43 sibling
  edges, including two dynamic ones in `text-field.ts`). The barrel adds nothing but eagerness.
- The only proven CSS order dependence is `controls/card/card.css:14`, which seeds `--ui-container-bg`
  by later source over `_surface/container.css` at equal `:where()` specificity. No other control sheet
  declares a foreign `:where(ui-other)` rule.
- Browsers apply every duplicate `@import` separately, so a seam sheet imported twice would land after
  `card.css` and reset its seed.

## Decision

1. Per-control entry points are the only path package code uses. Each `{name}.ts` self-defines and
   imports its sibling controls.
2. The descriptor gains `uses:` (a block sequence of tags, `uses: []` when empty; optional in the schema,
   required for the components fleet by gate). `uses` equals the import graph (static and `import()`
   specifiers, `import type` stripped), and `{name}.css` opens with an `@import` prologue equal to the
   sheets of its `uses`. Both are written by `scripts/codemod-uses.mjs`.
3. `shared-styles.css` holds the three cross-family seams (`_surface/container.css`,
   `container-box.css`, `_chart/chart-axis.css`). The host contract is `foundation-styles.css`, then
   `shared-styles.css`, then control sheets (or `all.css`). Control sheets never import a `_` seam. No
   control sheet (a fleet folder's `{name}.css`) styles a foreign `:where(ui-x)`. The `_` seam sheets
   that `shared-styles.css` links once are the one sanctioned cross-family exception (`_surface/*.css`
   styles `:where(ui-row)` by design, which is why the foreign-`:where` gate scans fleet folders only).
   Order independence is proven by a browser shuffle gate, and this replaces the "DO NOT REORDER" rule.
4. `scripts/generate-controls.mjs` generates `src/controls/registry.gen.ts` (export `./registry`),
   `src/all.gen.ts` and `src/all.gen.css` (exports `./all` and `./all.css`, demo-only, never imported by
   package code) and the `./controls/{name}` and `./controls/{name}.css` entries of `package.json`
   exports. All are committed and drift-gated by regenerate-and-compare.
5. `./loader` exposes `createControlLoader` and `ensureControls`. `CatalogEntry` gains `controls`; when a
   loader is present and some tags are undefined, a surface's messages queue and apply after the load
   resolves (deferred apply per surface, order preserved), and a load failure emits `CONTROL_LOAD` and
   renders the existing placeholder. Built-in catalogs register the components registry with
   `css: 'host'`; persona packages add `controls` records. An absent loader keeps today's synchronous
   behavior.

   > Note (2026-10-07, append-only, nothing above is edited): [ADR-0241](./0241-lazy-catalog-bodies-behind-an-eager-manifest.md)
   > adds a second gate to this deferred-apply queue. A surface on a known-but-unloaded catalog id queues its
   > `updateComponents` behind the catalog body load first, then behind the control gate above, in the same order-preserving
   > per-surface queue.
6. Every package declares `sideEffects`, and publish rewrites it from `./src/` to `./dist/`.
7. `./components` and `./component-styles.css` are removed with no alias.
8. Scope: components and a2ui restructure. The other packages get `sideEffects` only, because app, code,
   data and router already ship per-arm subpaths with lazy heavy arms.

## Consequences

- Consumers load only the controls they import; the app eager bundle drops by roughly 47 KB gz, and the
  app row re-bases downward under ADR-0197 cl.5.
- Adding a control means adding its folder and descriptor and running the generator; no shared list is
  hand-edited.
- New gates: `uses` drift, CSS `uses` prologue, foreign `:where`, browser CSS shuffle, registry and
  `all` drift, `all` purity, and the rewritten ADR-0080 T4 and family-coherence checks.
- The host contract grows to four lines (foundation, shared, control sheets or `all.css`).
- Hosts that wire `controls` see deferred surface timing until every tag is defined; the sync fast path
  holds when all tags are pre-defined.
- `all.gen.css` regenerates in sorted order; the first regeneration is itself a shuffle experiment and
  a visual baseline diff is a finding, not a refresh.
- The app size row stays red until the a2ui catalogs stop importing the fleet.
- LLDs, spec intakes, tickets, decompositions, older ADRs and dated reports that name the barrels are
  build history and stay untouched. The records named in Repairs are the ones later steps repair, plus
  the three amendments this ADR records.

## Alternatives considered

- **Controls import their own CSS from `.ts`** (constructable sheets or `import './x.css'`): rejected,
  it breaks ADR-0003's behavior-only invariant, tsc-verbatim publish cannot bundle CSS, and the CDN path
  breaks.
- **Seams `@import`ed from each control sheet**: rejected, duplicate `@import`s re-apply in browsers and
  reset `card.css`'s later-source seed.
- **`@layer` to encode order**: rejected, it changes precedence against every unlayered host and site
  rule and touches 87 sheets and every CSS probe for a guarantee the seam sheet gives for free.
- **Exports subpath patterns instead of explicit entries**: rejected for now, esm.sh behavior is
  unverified and the size script's T5 enumeration would go vacuous; kept as a later simplification.
- **Deriving `uses` from the import graph alone**: rejected, the descriptor is the documented contract
  (ADR-0173); a declared field plus a bijection gate catches both phantom and missing deps and feeds the
  site.
- **Create elements before definitions and rely on upgrade**: rejected, it opens a
  parent-sees-undefined-children path no test covers.
- **One registry spanning descriptors, catalogs and sidecars**: rejected, layering forbids components
  knowing a2ui; the join is at runtime (`WidgetFactory.tag` to `registry.gen.ts`), and ADR-0232 sidecars
  stay prompt-only.
- **Keeping `./components` as a deprecated alias**: rejected by Kim's ruling; an alias is a barrel by
  another name.
