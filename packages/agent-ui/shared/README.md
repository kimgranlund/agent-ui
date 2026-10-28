# @agent-ui-kit/shared

Design tokens and foundation stylesheets for the agent-ui family: the `--md-sys-*` color/dimension token system (an extension of Material Design 3), the typographic scale, and loadable theme packs. Zero dependencies, CSS-first.

> Published on npm as `@agent-ui-kit/shared`; inside this repository the workspace package is `@agent-ui/shared`,
> renamed at publish time. The latest release is 0.2.0 (tag `v0.2.0`); the source on `main` is unreleased
> work past it.

## Install

```sh
npm install @agent-ui-kit/shared
```

## Usage

```js
// The foundation, in order: color tokens, the dimensional ramp, the derived foundations
// (control geometry: --md-sys-height, --md-sys-icon-box), then the bridge that aliases the old ramp names.
import '@agent-ui-kit/shared/tokens.css'
import '@agent-ui-kit/shared/dimensions.css'
import '@agent-ui-kit/shared/foundations.css'
import '@agent-ui-kit/shared/foundations-bridge.css'
// Optional: the document base layer, and named theme packs.
import '@agent-ui-kit/shared/base.css'
```

Most consumers don't import these directly — `@agent-ui-kit/components/foundation-styles.css` aggregates them in the right order. Import this package directly when you only want the token layer.

- Color roles: `--md-sys-color-{family}-{role}`, scheme-complete via `light-dark()`.
- Type scale: `--md-sys-typescale-{role}-{size}-{size|weight|line-height|tracking}` (M3-verbatim core rows).
- Theme packs: `@agent-ui-kit/shared/themes/<name>.css` re-declare the color surface under `[theme='<name>']`.

## CDN (no build step)

```html
<link rel="stylesheet" href="https://esm.sh/@agent-ui-kit/shared@0.2.0/tokens.css">
<link rel="stylesheet" href="https://esm.sh/@agent-ui-kit/shared@0.2.0/dimensions.css">
<link rel="stylesheet" href="https://esm.sh/@agent-ui-kit/shared@0.2.0/foundations.css">
<link rel="stylesheet" href="https://esm.sh/@agent-ui-kit/shared@0.2.0/foundations-bridge.css">
```

Link the four in this order: `tokens.css` before `dimensions.css` (the ramp reads the color layer's variables), then `foundations.css`, then `foundations-bridge.css`. These four sheets are fully self-contained, no bare imports.

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
