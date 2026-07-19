# @agent-ui-kit/router

A memory-first SPA router for the agent-ui family: navigation state lives in a signal store, with URL reflection as an opt-in — usable in embedded surfaces that must never touch the address bar.

## Install

```sh
npm install @agent-ui-kit/router
```

## Usage

```js
import { createRouter } from '@agent-ui-kit/router'          // the core (zero DOM dependency)
import '@agent-ui-kit/router/router-outlet'                   // <ui-router-outlet>
import '@agent-ui-kit/router/router-link'                     // <ui-router-link>
import '@agent-ui-kit/router/router-link.css'
```

Create a router, wire an outlet, navigate by route id; call `connectUrl` only when you want the URL to follow along.

## CDN (no build step)

```html
<link rel="stylesheet" href="https://esm.sh/@agent-ui-kit/router@0.0.5/router-link.css">
<script type="module">
  import { createRouter } from 'https://esm.sh/@agent-ui-kit/router@0.0.5'
  import 'https://esm.sh/@agent-ui-kit/router@0.0.5/router-outlet'
  import 'https://esm.sh/@agent-ui-kit/router@0.0.5/router-link'
</script>
```

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

MIT © Kim Granlund · [Source](https://github.com/kimgranlund/agent-ui)
