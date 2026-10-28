# agent-ui

A zero-dependency, signals-based web-component library in strict, modern TypeScript: FACE
(form-associated custom elements) with light DOM, ARIA via `ElementInternals` only (no native form
elements), a tagged-template renderer, typed-signal props and traits. On top of it sit the A2UI
generative-UI layer, the A2A protocol layer and the app compositions they power.

Two ruled dependency exceptions, both opt-in and lazy-loaded, never on a default barrel: CodeMirror 6
on `@agent-ui/code/editor` (ADR-0139) and pdfjs-dist on the `@agent-ui/app` ingestion seam (ADR-0202).

## Release status

The source on `main` is unreleased. Workspace packages are named `@agent-ui/*`, versioned `0.0.0` and
marked private; at publish time `npm run publish:packages` renames them to `@agent-ui-kit/*` and
releases them in lockstep. The latest release is `v0.2.0` (2026-10-25) of nine packages; `devtools` has never
been published. Where releases and merged changes are listed:
[CHANGELOG.md](CHANGELOG.md).

## Packages

An npm-workspaces monorepo of ten packages under `packages/agent-ui/*`. The layering and the import
rules between them are in [AGENTS.md](AGENTS.md).

| Package | What it is |
| --- | --- |
| `@agent-ui/shared` | tokens, utility types, the `StorageAdapter` persistence seam |
| `@agent-ui/components` | the framework: signals kernel, base elements, traits and the `ui-*` controls |
| `@agent-ui/a2ui` | A2UI: renderer, validator, catalogs and the agent producer toolkit |
| `@agent-ui/a2a` | Agent2Agent wire types and validation pinned to spec v0.3.0 |
| `@agent-ui/icons` | swappable icon-pack adapter with a Phosphor pack on `./phosphor` |
| `@agent-ui/app` | app-surface compositions: `ui-super-shell`, its presets and the agent-admin app |
| `@agent-ui/router` | memory-first SPA router with opt-in URL reflection |
| `@agent-ui/code` | code and prose: highlighting, markdown and the CodeMirror editor |
| `@agent-ui/data` | headless data layer: the `DataSource<T>` seam and signal-backed resources |
| `@agent-ui/devtools` | chat and A2UI dev and debug harness: transports, capture and replay |

## Getting started

```sh
npm install
npm run dev     # the docs site (site/), the app entry, with live examples for every control
npm run build   # production build of the docs site
```

The docs site's own [Getting started](site/pages/getting-started.ts) page is the fullest
walkthrough: workspace packages, the CSS import order, a minimal runnable example, and per-control
subpath imports.

## Commands

- `npm run check`: the standing gate, `tsc` then `check:site`, `check:tools` and `check:scripts`
  (type checks plus the repo's script selftests and generated-file freshness checks).
- `npm test`: the full Vitest (jsdom) suite, run by CI on every pull request.
- `npm run test:browser`: the real-engine browser shards.
- `npm run size`: the bundle-size budget check.

Locally a change runs `npm run check` plus the tests of the folders it touched; CI runs the full suite
and a pull request merges on CI green. The full command list and gate rules are in
[AGENTS.md](AGENTS.md).

## Going deeper

- [AGENTS.md](AGENTS.md): conventions, gates and where each kind of truth lives.
- [CONTRIBUTING.md](CONTRIBUTING.md): how a change gets made and landed.
- [`.claude/docs/`](.claude/docs/): plan, goals, roadmap, process, references and design documents.
