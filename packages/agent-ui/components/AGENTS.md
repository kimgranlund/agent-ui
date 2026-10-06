# @agent-ui/components

The framework: signals kernel, base elements, traits and the `ui-*` controls. Root `AGENTS.md` and `CLAUDE.md` hold the package DAG, gates and conventions; this file holds only what is local here.

## Layers

- `src/reactive/` <- `src/dom/` <- `src/traits/` <- `src/controls/`. A file imports only from its own or a lower layer, and never from `@agent-ui/a2ui`. Gate: `src/layering.test.ts`.

## Controls

- One folder per control under `src/controls/`, holding its descriptor `{name}.md`. A control self-defines its tag on import.
- Each descriptor declares `uses:`, the other fleet tags its entry module imports, derived from the import graph (ADR-0233). Never hand-edit it; sync from the repo root with `node scripts/codemod-uses.mjs` (`--check` to verify). Drift gate: `src/controls/uses-driftwire.test.ts`.
- A family whose entry module also self-defines sub-element tags (card, tabs, drill) lists them in an optional `defines:` block after `uses:`. It is the one hand-declared list: `src/controls/defines-driftwire.test.ts` holds it equal to the module graph, and `generate-controls` writes it onto the family's record in `registry.gen.ts` (`ControlRecord.defines`).
- The same codemod writes each `{name}.css` sheet's `@import` prologue from `uses`, so a control sheet is self-contained. A sheet never imports a `_` seam; the seams load once through `src/shared-styles.css`. Gates: `src/controls/css-uses.test.ts` and the two-engine order proof `src/controls/css-order.browser.test.ts`.
- `node scripts/generate-controls.mjs` (`--check` to verify) writes the lazy control registry `src/controls/registry.gen.ts` (`./registry`), the demo-only `src/all.gen.ts` and `src/all.gen.css` (`./all`, `./all.css`) and the `./controls/{name}` and `./controls/{name}.css` exports keys, from the descriptors (ADR-0233). Never hand-edit them. Gates: `src/controls/controls-gen-driftwire.test.ts`; `src/controls/all-purity.test.ts` (package code never imports `all`).
- `package.json` declares `sideEffects`: `./src/controls/**`, `./src/all.gen.ts` and every sheet. A top-level effect outside those patterns would be dropped by a consumer's bundler; gate `scripts/side-effects.test.mjs`.
- A converted control carries a generated `{name}.props.gen.ts`. Never hand-edit it; regenerate from the repo root with `node scripts/generate-props.mjs <name>`. Drift gate: `src/descriptor/props-gen-driftwire.test.ts` (ADR-0173).

## Naming

| Thing | Shape |
|---|---|
| Tag | `ui-{name}` |
| Class | `UI{Name}Element` |
| Tokens | `--ui-{name}-*` |

## Sizing, DOM and ARIA

- Fill-by-default: a control is block-level and fills its container; the reflected `inline` boolean is the one opt-out (ADR-0223). `src/controls/sizing-gates.test.ts` is enforcing.
- Light DOM by default; ARIA goes through `ElementInternals`, never host attributes.

## Skills

| Task | Skill |
|---|---|
| Design intake for a new control | `component-design` |
| Build or upgrade a control | `component-build` |
| Anatomy, geometry, states, tokens | `component-standards` |
| Folder, descriptor, exports | `component-packaging` |
| Test bar | `component-testing` |
