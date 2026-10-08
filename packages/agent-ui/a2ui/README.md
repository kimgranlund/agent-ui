# @agent-ui-kit/a2ui

A2UI (agent-generated UI) support for the agent-ui family: a zero-dependency renderer for the A2UI wire protocol, a strict message validator, and the default component catalog mapping protocol types onto `ui-*` elements.

## Install

```sh
npm install @agent-ui-kit/a2ui
```

## Usage

```js
import '@agent-ui-kit/components/foundation-styles.css'
import '@agent-ui-kit/components/shared-styles.css'
import '@agent-ui-kit/components/all.css' // or one `@agent-ui-kit/components/controls/{name}.css` per control your surfaces use
import { /* renderer + validator + catalog */ } from '@agent-ui-kit/a2ui'
import { /* seed payloads */ } from '@agent-ui-kit/a2ui/examples'
```

The host links the styles: `foundation-styles.css`, `shared-styles.css`, and the control sheets (or `all.css`). You never import the controls yourself: the renderer defines the controls a surface uses, on demand, before it renders them (ADR-0233). A message whose controls are not defined yet waits for them; later messages for that surface queue behind it in order.

Catalogs load the same way (ADR-0241). The default `agent-ui` catalog ships with the renderer. The upstream A2UI Basic catalog (`a2ui-basic`, and its canonical URI) and the persona catalogs (`agent-ui--concierge` and the like) are known by id on every renderer, but their code is a separate chunk fetched the first time a surface names one. Messages for that surface wait for it in order; if the chunk fails to load, the renderer reports one error for the surface and drops it. `await renderer.preload(catalogId)` fetches a catalog ahead of time.

Feed validated A2UI server messages (`createSurface` / `updateComponents` / `updateDataModel`) to the renderer and it maintains live surfaces — two-way input bindings, validity checks, dynamic lists, and action round-trips included. `./examples` ships seed payload transcripts; `./corpus` is the exemplar store.

> The agent-producer toolkit (`./agent`) is published and Node-only: import it from a server or CLI, not a browser bundle. Its prompts, selection sidecars and dogfood fleet rows are embedded at build time by `scripts/generate-agent-assets.mjs` (ADR-0236), so it reads no repo path at runtime. The pure `./agent/meta-line` types are published too.

## CDN (no build step)

```html
<!-- styles come from the components/shared sheets (see @agent-ui-kit/components' CDN section) -->
<script type="module">
  import * as a2ui from 'https://esm.sh/@agent-ui-kit/a2ui@0.0.5'
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
