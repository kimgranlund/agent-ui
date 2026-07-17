# agent-ui

A zero-dependency, signals-based web-component library in strict, modern TypeScript — FACE
(Framework-Agnostic Custom Elements) custom elements with light DOM, ARIA via `ElementInternals`
only (no native form elements), a tagged-template renderer, and typed-signal props. First component
family: FACE form controls.

The one ruled exception is the opt-in `@agent-ui/code/editor` surface, which adopts CodeMirror 6
(lazy-loaded) — every other default barrel in the library stays dependency-free.

## Packages

An npm-workspaces monorepo; source lives under `packages/agent-ui/*`.

- `@agent-ui/shared` — cross-cutting tokens/styles/utility types (color, dimensional, and runtime).
- `@agent-ui/components` — the whole framework: the signals kernel (`reactive/`), the base element
  classes (`dom/`), reusable traits (`traits/`), and the full `ui-*` FACE control suite
  (`controls/`).
- `@agent-ui/a2ui` — the A2UI (Agent2UI) Generative-UI runtime: a renderer, validator, and default
  catalog for streaming agent-composed interfaces, plus the Node-first agent producer toolkit.
- `@agent-ui/a2a` — the A2A (Agent2Agent) protocol layer: wire types and validation pinned to
  spec v0.3.0.
- `@agent-ui/icons` — a swappable icon-pack adapter, with a Phosphor pack shipped as `./phosphor`.
- `@agent-ui/app` — app-surface compositions (an application shell, master-detail, settings, and
  the `ui-agent-admin` reference app) built on top of components + a2ui + shared.
- `@agent-ui/router` — a memory-first SPA router with opt-in URL reflection.
- `@agent-ui/code` — the code+prose family: a zero-dep core plus opt-in subpath packs for syntax
  highlighting, markdown rendering, and the CodeMirror-backed editable source editor.

## Getting started

```sh
npm install
npm run dev     # the docs site (site/) — the app entry point, with live examples for every control
npm run build   # production build of the docs site
```

The docs site's own [Getting started](site/pages/getting-started.ts) page is the fullest
walkthrough: workspace packages, the load-bearing CSS import order, a minimal runnable example, and
per-control subpath imports for tree-shaking.

## Commands

- `npm run check` — the standing type gate: `tsc` (packages) → `check:site` (the docs site's own
  `tsconfig.json`) → `check:tools` (`tsconfig.tools.json`, scripts + a2ui tools). All `noEmit` —
  type-checking only, no build output.
- `npm test` — the full Vitest suite (jsdom), once. `npm run test:watch` for watch mode.
  `npm run test:browser` runs the real-engine (Chromium/WebKit) suite.
- `npm run dev` / `npm run build` — the docs site.
- `npm run size` — the bundle-size budget check.

`npm run check && npm test` must stay green before any change is considered done.

## Going deeper

Project-scoped documentation — the architecture plan, per-milestone goals, the coherence process,
and the full reference/ADR/spec/ticket corpus — lives under [`.claude/docs/`](.claude/docs/). See
[CLAUDE.md](CLAUDE.md) for the conventions an agent (or a new contributor) needs to work in this
codebase, and [CONTRIBUTING.md](CONTRIBUTING.md) for how a change gets made and landed here.
