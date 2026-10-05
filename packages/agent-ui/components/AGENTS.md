# @agent-ui/components

The framework: signals kernel, base elements, traits and the `ui-*` controls. Root `AGENTS.md` and `CLAUDE.md` hold the package DAG, gates and conventions; this file holds only what is local here.

## Layers

- `src/reactive/` <- `src/dom/` <- `src/traits/` <- `src/controls/`. A file imports only from its own or a lower layer, and never from `@agent-ui/a2ui`. Gate: `src/layering.test.ts`.

## Controls

- One folder per control under `src/controls/`, holding its descriptor `{name}.md`. A control self-defines its tag on import.
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
