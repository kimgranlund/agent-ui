# @agent-ui-kit/code

The code + prose family for agent-ui: a zero-dependency highlighter core, seven hand-rolled tokenizers, a sanitized markdown renderer, and an editable-first source editor (the editor pack lazy-loads CodeMirror 6 per mount — no CodeMirror in your bundle otherwise).

## Install

```sh
npm install @agent-ui-kit/code
```

## Usage

```js
import '@agent-ui-kit/code/highlight'      // seven tokenizers, self-registering
import '@agent-ui-kit/code/highlight.css'

import '@agent-ui-kit/code/markdown'       // <ui-markdown> — renders the agent-common markdown subset
import '@agent-ui-kit/code/markdown.css'   // into real components, sanitized by construction

import '@agent-ui-kit/code/editor'         // <ui-code-editor> — editable-first; CodeMirror 6 lazy-loads
import '@agent-ui-kit/code/editor.css'     // per mount (source + richtext live-preview modes)
```

The default entries are dependency-free; only `./editor` pulls the CodeMirror runtime, declared here and loaded lazily.

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
