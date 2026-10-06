# @agent-ui-kit/components

The agent-ui component framework: a fine-grained signals kernel, 50+ accessible light-DOM `ui-*` custom elements (form controls, containers, overlays, data-viz), and a token-driven styling system. Zero runtime dependencies.

## Install

```sh
npm install @agent-ui-kit/components
```

## Usage

The host contract is four lines: the token foundation first, the shared seam sheet once, the sheet of each control you use, then the control modules (each self-defines its tag on import). Each control sheet imports the sheets of the controls it composes, so the order of lines 3 and 4 within themselves does not matter.

```js
import '@agent-ui-kit/components/foundation-styles.css'
import '@agent-ui-kit/components/shared-styles.css'
import '@agent-ui-kit/components/controls/button.css'
import '@agent-ui-kit/components/controls/button'
```

```html
<ui-button variant="solid">Save</ui-button>
```

Add one `controls/{name}.css` and one `controls/{name}` import per control your app uses. For demos and prototypes only, `@agent-ui-kit/components/all.css` and `@agent-ui-kit/components/all` load the whole fleet; an app that imports them pays for every control.

Design notes: light-DOM rendering (your CSS reaches everything), ARIA via `ElementInternals` (form-associated custom elements — real form participation, no native inputs), and per-component `--ui-{name}-*` CSS custom-property seams over the shared `--md-sys-*` token system.

## CDN (no build step)

```html
<!-- styles: shared's two sheets DIRECTLY (foundation-styles.css uses bare @imports a browser
     can't resolve), then the seam sheet and each control sheet (relative imports only, CDN-safe) -->
<link rel="stylesheet" href="https://esm.sh/@agent-ui-kit/shared@0.0.5/tokens.css">
<link rel="stylesheet" href="https://esm.sh/@agent-ui-kit/shared@0.0.5/dimensions.css">
<link rel="stylesheet" href="https://esm.sh/@agent-ui-kit/components@0.0.5/shared-styles.css">
<link rel="stylesheet" href="https://esm.sh/@agent-ui-kit/components@0.0.5/controls/button.css">

<script type="module">
  import 'https://esm.sh/@agent-ui-kit/components@0.0.5/controls/button' // self-defines ui-button
</script>

<ui-button variant="solid">Save</ui-button>
```

esm.sh rewrites the bare `@agent-ui-kit/*` sibling imports for you; pin the version in real pages.

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
