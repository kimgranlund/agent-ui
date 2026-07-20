# @agent-ui-kit/app

App-surface compositions for the agent-ui family: application shells, a settings surface, a conversation (chat) surface with an inline generative-UI canvas, and the agent-admin workbench that ties them together.

## Install

```sh
npm install @agent-ui-kit/app
```

## Usage

```js
import '@agent-ui-kit/app/agent-admin'     // <ui-agent-admin> — the whole workbench
import '@agent-ui-kit/app/agent-admin.css'
// …or compose the parts: app-shell, master-detail, nav-rail, settings, conversation, surface-host.
```

> **Consumer profile:** this package targets Vite/Rolldown-family bundlers — one internal module uses Vite import queries (`?raw`/`?url`), so plain Node ESM / webpack / esbuild consumers can't import the root barrel. The rest of the family has no such constraint.

## CDN

Not recommended: this package's Vite-family constraint (the `?raw`/`?url` import queries noted
above) applies to CDN module rewriters too — use a Vite/Rolldown bundler for `@agent-ui-kit/app`.
The rest of the family is CDN-friendly.

## The @agent-ui-kit family

| Package | What it is |
|---|---|
| [`@agent-ui-kit/components`](https://www.npmjs.com/package/@agent-ui-kit/components) | The component framework: signals kernel, 50+ light-DOM `ui-*` custom elements |
| [`@agent-ui-kit/shared`](https://www.npmjs.com/package/@agent-ui-kit/shared) | Design tokens + foundation stylesheets (color, dimensions, themes) |
| [`@agent-ui-kit/icons`](https://www.npmjs.com/package/@agent-ui-kit/icons) | Swappable icon-pack adapter (+ a Phosphor pack) |
| [`@agent-ui-kit/a2ui`](https://www.npmjs.com/package/@agent-ui-kit/a2ui) | A2UI protocol renderer, validator, and component catalog |
| [`@agent-ui-kit/a2a`](https://www.npmjs.com/package/@agent-ui-kit/a2a) | A2A (Agent2Agent) protocol wire types + validation (spec v0.3.0) |
| [`@agent-ui-kit/router`](https://www.npmjs.com/package/@agent-ui-kit/router) | Memory-first SPA router with opt-in URL reflection |
| [`@agent-ui-kit/code`](https://www.npmjs.com/package/@agent-ui-kit/code) | Code + prose: highlighter registry, markdown renderer, source editor |
| [`@agent-ui-kit/app`](https://www.npmjs.com/package/@agent-ui-kit/app) | App-surface compositions: shells, conversation, agent admin |

MIT © Kim Granlund · [Docs](https://ui.nonoun.io) · [Source](https://github.com/kimgranlund/agent-ui)
