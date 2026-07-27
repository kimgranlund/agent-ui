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
// …or compose the parts: super-shell, master-detail, nav-rail, settings, conversation, surface-host.
```

> **Consumer profile:** any modern bundler — no Vite-family constraint. This package's published output
> contains no Vite-only import queries. Proven by a real install smoke (GH #283): the actual publish
> build packed to tarballs, installed into a scratch app outside the repo, then bundled by **esbuild** and
> by **webpack** (both non-Vite) and driven in a real headless browser — `<ui-super-shell>` upgraded and
> rendered with the `--md-sys-color-*` token chain resolved and zero console errors. Like every
> `@agent-ui-kit` control package these are BROWSER modules: they need a DOM, so a plain Node ESM import
> (no DOM) is not a supported consumption mode for any of them. The old Vite-only constraint came from
> `ui-app-shell`'s `?raw`/`?url` imports, removed by ADR-0156; it applied through `0.0.5` and earlier.

## CDN

Unverified for this package — use a bundler. Nothing rules CDN use out anymore (the Vite-family
constraint above is gone), but no probe covers `@agent-ui-kit/app` yet: the release smoke's esm.sh leg
(`scripts/verify-consumer-install.mjs`) covers `shared`/`icons`/`components` only. The rest of the family
is CDN-friendly and verified as such on every release.

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
