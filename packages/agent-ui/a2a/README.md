# @agent-ui-kit/a2a

A2A (Agent2Agent) protocol support, pinned to spec v0.3.0: wire types for AgentCard / Message / Task / Artifact, JSON-RPC method shapes, and strict validation. Zero dependencies, isomorphic (browser + node).

## Install

```sh
npm install @agent-ui-kit/a2a
```

## Usage

```js
import { validateA2a } from '@agent-ui-kit/a2a'
```

Use the typed wire shapes to build A2A servers/clients and validate inbound messages against the pinned spec version. Version pinning is deliberate: A2A v1.0 renames JSON-RPC methods (wire-breaking) — this package speaks v0.3.0.

## CDN (no build step)

```html
<script type="module">
  import { validateA2a } from 'https://esm.sh/@agent-ui-kit/a2a@0.0.5'
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

MIT © Kim Granlund · [Docs](https://ui.nonoun.io) · [Source](https://github.com/kimgranlund/agent-ui)
