# @agent-ui-kit/components

The agent-ui component framework: a fine-grained signals kernel, 50+ accessible light-DOM `ui-*` custom elements (form controls, containers, overlays, data-viz), and a token-driven styling system. Zero runtime dependencies.

## Install

```sh
npm install @agent-ui-kit/components
```

## Usage

```js
// 1. Styles: the token foundation, then the component sheets.
import '@agent-ui-kit/components/foundation-styles.css'
import '@agent-ui-kit/components/component-styles.css'
// 2. Elements: the whole fleet (self-defining on import)…
import '@agent-ui-kit/components/components'
```

```html
<ui-button variant="solid">Save</ui-button>
<ui-text-field label="Name" required></ui-text-field>
<ui-select name="model" label="Model">…</ui-select>
```

Or import per control for a smaller graph:

```js
import '@agent-ui-kit/components/controls/button'
import '@agent-ui-kit/components/controls/menu'
```

Design notes: light-DOM rendering (your CSS reaches everything), ARIA via `ElementInternals` (form-associated custom elements — real form participation, no native inputs), and per-component `--ui-{name}-*` CSS custom-property seams over the shared `--md-sys-*` token system.

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
