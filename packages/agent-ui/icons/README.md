# @agent-ui-kit/icons

A swappable icon-pack adapter for the agent-ui family: a tiny pure core plus an opt-in Phosphor pack. Zero dependencies; packs self-register on import.

## Install

```sh
npm install @agent-ui-kit/icons
```

## Usage

```js
import '@agent-ui-kit/icons/phosphor' // registers the Phosphor pack (self-registering side-effect import)
```

Then any `ui-icon` from `@agent-ui-kit/components` resolves glyphs through the registered pack:

```html
<ui-icon glyph="plus"></ui-icon>
```

The core entry (`@agent-ui-kit/icons`) carries only the adapter seam — bring your own pack by registering one instead of (or alongside) Phosphor.

## CDN (no build step)

```html
<script type="module">
  import 'https://esm.sh/@agent-ui-kit/icons@0.0.5/phosphor' // registers the Phosphor pack
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
