// site/main.ts — the /site bootstrap (slice A1). This is the app dev/build entry reintroduced after G0
// parked it (plan §12); everything in /site (the Phase-2/3 pages + the A2UI canvas) mounts through here.
//
// Resolution model (the key contract for downstream /site builders): the `@agent-ui/*` packages are
// npm-workspace symlinks under node_modules, each with an `exports` map. Vite (Rolldown) resolves every
// bare specifier below — and the CSS barrels' inner `@import '@agent-ui/shared/...'` — through those
// `exports` maps. NO `resolve.alias` is needed (and the index.ts aliases in vitest.config.ts must NOT be
// mirrored: under Rolldown prefix-matching they would rewrite the CSS/`./components` subpaths into
// `.../src/index.ts/<subpath>` and break the build). This is the same path the `*.browser.test.ts`
// suites already prove out against real engines.
//
// Import order is load-bearing (ADR-0003): the colour `--c-*` roles + `--ui-{height,font,gap}-*` ramp from
// the FOUNDATION barrel must be declared BEFORE a control's `:where()` block reads them, so foundation CSS
// loads tokens-first, then the per-component CSS, then the behaviour that self-defines the controls.
import '@agent-ui/components/foundation-styles.css' // [1] foundation: tokens.css → dimensions.css
import '@agent-ui/components/component-styles.css' // [2] per-control CSS, after the foundation
import '@agent-ui/components/components' // [3] self-defining ui-* controls (registers ui-button on import)

// Smoke: render a live <ui-button> so the built/served output proves the control self-defined, the CSS
// cascade resolved, and the bare specifiers + barrels wired up end to end.
const mount = document.querySelector('#app')
if (mount) {
  const button = document.createElement('ui-button')
  button.textContent = 'Button'
  mount.append(button)
}
