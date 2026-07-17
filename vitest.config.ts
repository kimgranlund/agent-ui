import { defineConfig, configDefaults } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

// Vitest is the behaviour runner; `tsc` (npm run check) stays the type gate.
// jsdom is the fast inner loop, split into two vitest PROJECTS (the `test.projects` array — vitest 4's inline
// replacement for the deprecated `vitest.workspace.ts`): `packages` (the framework's own *.test.ts) and `site`
// (the docs-site's own *.test.ts, e.g. site/lib/adr.ts). Both `extends: true` off this root config, inheriting
// the jsdom environment + the resolve aliases below. The browser-truth layer (@vitest/browser + Playwright, for
// @scope / light-dark() / real focus / computed geometry / the AX tree) is a SEPARATE config —
// `vitest.browser.config.ts` / `npm run test:browser` (G5), itself split the same way. The `*.browser.test.ts`
// glob is excluded from both jsdom projects so those real-engine tests never run under jsdom (where computed
// geometry isn't true). Workspace packages resolve via the aliases below.
export default defineConfig({
  test: {
    environment: 'jsdom',
    projects: [
      {
        extends: true,
        test: {
          name: 'packages',
          include: ['packages/agent-ui/*/src/**/*.test.ts'],
          exclude: [...configDefaults.exclude, '**/*.browser.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'site',
          include: ['site/**/*.test.ts'],
          exclude: [...configDefaults.exclude, '**/*.browser.test.ts'],
        },
      },
    ],
  },
  resolve: {
    alias: {
      // More-specific subpaths FIRST (string aliases prefix-match in order): the controls barrel —
      // `@agent-ui/components/components` mirrors the package's `exports["./components"]` (the self-defining
      // ui-* family). Without it, the broad alias below mangles the subpath and a2ui tests can't load a
      // real control (e.g. the default catalog's ui-button factory).
      '@agent-ui/components/components': r('./packages/agent-ui/components/src/controls/index.ts'),
      '@agent-ui/components/descriptor': r('./packages/agent-ui/components/src/descriptor/index.ts'),
      // The catalog's static validator (content-family LLD-C13, ADR-0114 cl.3) is the first consumer of a
      // single-control `./controls/{name}` exports-map subpath from OUTSIDE the components package (every
      // prior cross-package import went through the whole `/components` barrel above) — mirrors the
      // package's `exports['./controls/text']` (SAFE_HREF_SCHEMES, re-exported through text.ts). Same
      // more-specific-first ordering discipline as the `/components`/`/descriptor` entries above.
      '@agent-ui/components/controls/text': r('./packages/agent-ui/components/src/controls/text/text.ts'),
      // ADR-0117 — site/lib/component-gallery.ts (a jsdom-tested module, site/gallery.test.ts) is the second
      // direct `./controls/{name}` subpath consumer from OUTSIDE the components package; same alias-ordering
      // necessity as `controls/text` above (the broad `@agent-ui/components` entry below prefix-matches ANY
      // subpath and mangles it into a path segment appended after `index.ts` unless a more-specific exact
      // entry wins first).
      '@agent-ui/components/controls/theme-provider': r('./packages/agent-ui/components/src/controls/theme-provider/theme-provider.ts'),
      // @agent-ui/code/src/markdown/render.ts (LLD-C9) is the third direct `./controls/{name}` subpath
      // consumer from OUTSIDE the components package — the fenced-code and GFM-table construct legs need
      // `ui-code`/`ui-table` self-defined without dragging the whole `/components` barrel. Same
      // alias-ordering necessity as `controls/text`/`controls/theme-provider` above.
      '@agent-ui/components/controls/code': r('./packages/agent-ui/components/src/controls/code/code.ts'),
      '@agent-ui/components/controls/table': r('./packages/agent-ui/components/src/controls/table/table.ts'),
      // app-surfaces-m4.lld.md LLD-C10 — `@agent-ui/app`'s `ui-master-detail` (master-detail.ts) is the
      // fifth direct `./controls/{name}` subpath consumer from OUTSIDE the components package: it imports
      // `ui-split`/`ui-split-pane` for their self-defining side effect, so `document.createElement('ui-split')`
      // resolves to the REAL class before it composes them. Same alias-ordering necessity as
      // `controls/text`/`controls/theme-provider`/`controls/code`/`controls/table` above.
      '@agent-ui/components/controls/split': r('./packages/agent-ui/components/src/controls/split/split.ts'),
      '@agent-ui/components/controls/split-pane': r('./packages/agent-ui/components/src/controls/split/split-pane.ts'),
      // TKT-0048 — `@agent-ui/app`'s `entry-list.ts` (composed by `ui-agent-admin`) is the next direct
      // `./controls/{name}` subpath consumer from OUTSIDE the components package: `agent-admin.ts`
      // side-effect-imports `button`/`icon` so entry-list.ts's `document.createElement('ui-button'
      // | 'ui-icon')` calls resolve to the REAL classes explicitly, not only via the incidental
      // conversation→a2ui transitive path. Same alias-ordering necessity as `controls/split`/
      // `controls/split-pane` above.
      '@agent-ui/components/controls/button': r('./packages/agent-ui/components/src/controls/button/button.ts'),
      '@agent-ui/components/controls/icon': r('./packages/agent-ui/components/src/controls/icon/icon.ts'),
      // TKT-0049 — `agent-admin.ts` also side-effect-imports `textarea` so entry-list.ts's
      // `document.createElement('ui-textarea')` calls resolve to the REAL class explicitly. Same
      // alias-ordering necessity as `controls/button`/`controls/icon` immediately above.
      '@agent-ui/components/controls/textarea': r('./packages/agent-ui/components/src/controls/textarea/textarea.ts'),
      // app-surfaces-m4.lld.md LLD-C13/C14 — `@agent-ui/app`'s `ui-settings` schema/generate.ts are the
      // sixth/seventh/etc. direct `./controls/{name}` subpath consumers from OUTSIDE the components
      // package: the field-type registry self-defines the four mapped controls (text-field/switch/
      // select/slider) for their `document.createElement` side effect, and the generator self-defines
      // the two form-coordination controls (field/form-provider) the same way — same alias-ordering
      // necessity as `controls/split`/`controls/split-pane` above.
      '@agent-ui/components/controls/text-field': r('./packages/agent-ui/components/src/controls/text-field/text-field.ts'),
      '@agent-ui/components/controls/switch': r('./packages/agent-ui/components/src/controls/switch/switch.ts'),
      '@agent-ui/components/controls/select': r('./packages/agent-ui/components/src/controls/select/select.ts'),
      '@agent-ui/components/controls/slider': r('./packages/agent-ui/components/src/controls/slider/slider.ts'),
      '@agent-ui/components/controls/field': r('./packages/agent-ui/components/src/controls/field/field.ts'),
      '@agent-ui/components/controls/form-provider': r('./packages/agent-ui/components/src/controls/form-provider/form-provider.ts'),
      // nav-rail-family.lld.md LLD-C2 (ADR-0130) — `@agent-ui/app`'s `ui-nav-rail-group` is the next direct
      // `./controls/{name}` subpath consumer from OUTSIDE the components package: `collapse="icon-popover"`
      // composes a real `ui-menu` (self-defining side effect) for its per-group flyout. Same alias-ordering
      // necessity as `controls/split`/`controls/text-field` above.
      '@agent-ui/components/controls/menu': r('./packages/agent-ui/components/src/controls/menu/menu.ts'),
      // TKT-0085 — `@agent-ui/app`'s `ui-agent-admin` is the next direct `./controls/{name}` subpath
      // consumer from OUTSIDE the components package: the responsive-collapse shell side-effect-imports
      // `tabs` so its `document.createElement('ui-tabs' | 'ui-tab' | 'ui-tab-panel')` calls resolve to the
      // REAL classes. Same alias-ordering necessity as `controls/split`/`controls/menu` above.
      '@agent-ui/components/controls/tabs': r('./packages/agent-ui/components/src/controls/tabs/tabs.ts'),
      // EXACT (not prefix) matches, `?url`-suffixed: `@agent-ui/app`'s isolated-shell connect-flow
      // (app-shell.ts, LLD-C5/ADR-0082) resolves these two package CSS assets to a real runtime URL via
      // Vite's `?url` suffix, to inject as `<link>` hrefs INSIDE a shadow root. Vite's aliasing is FIRST-
      // MATCH-WINS in array order, and a plain-string alias matches on a whole path segment (`importee ===
      // find || importee.startsWith(find + '/')`) — `@agent-ui/components/foundation-styles.css?url` DOES
      // start with the broad `@agent-ui/components` alias below, so without these two exact entries placed
      // BEFORE it, that broad alias would intercept the specifier first and mangle the `?url` suffix into its
      // replacement path. Placing the exact, query-suffixed entries earlier in this object is what makes them
      // win instead (the replacement carries the SAME `?url` suffix through, so Vite's own asset-URL
      // transform still recognizes it) — the same ordering discipline the `@agent-ui/components/components`
      // and `/descriptor` subpath entries above already rely on.
      '@agent-ui/components/foundation-styles.css?url': `${r('./packages/agent-ui/components/src/foundation-styles.css')}?url`,
      '@agent-ui/components/component-styles.css?url': `${r('./packages/agent-ui/components/src/component-styles.css')}?url`,
      // Plain (non-`?url`) exact twins of the two entries above: `site/pages/_page.ts` — the shared page
      // shell EVERY site page imports first — side-effect-imports these two CSS assets directly (no `?url`
      // suffix, just "apply this stylesheet"), which a jsdom PAGE-level test (e.g.
      // `a2ui-live.ask-lifecycle.test.ts`, driving the real `a2ui-live.ts` module rather than a hand-built
      // fixture) now transitively imports. Without these exact entries, the broad `@agent-ui/components`
      // alias below intercepts the plain specifier first (same prefix-match hazard as the `?url` pair's own
      // comment describes) and mangles it into `.../src/index.ts/foundation-styles.css` — an unresolvable
      // path. Every prior jsdom test avoided this because none imported a full page module; only the
      // browser config (no aliasing at all — real package `exports`) exercised this import before now.
      '@agent-ui/components/foundation-styles.css': r('./packages/agent-ui/components/src/foundation-styles.css'),
      '@agent-ui/components/component-styles.css': r('./packages/agent-ui/components/src/component-styles.css'),
      '@agent-ui/components': r('./packages/agent-ui/components/src/index.ts'),
      '@agent-ui/shared': r('./packages/agent-ui/shared/src/index.ts'),
      // The a2ui `./examples` subpath (the seed shelf, ADR-0055) — mirrors the package's exports map. Placed
      // BEFORE the broad `@agent-ui/a2ui` entry: a plain-string alias prefix-matches, so without this the
      // broad alias would rewrite `@agent-ui/a2ui/examples` to `.../src/index.ts/examples` (the same
      // subpath-ordering discipline `@agent-ui/components/components` above relies on). Used by the site's
      // A2UI gallery + its drift gate (site/lib/a2ui-gallery.ts / .test.ts).
      '@agent-ui/a2ui/examples': r('./packages/agent-ui/a2ui/src/examples/index.ts'),
      // The a2ui `./agent` subpath (the producer toolkit, ADR-0137/TKT-0072) — mirrors the package's
      // exports map. Placed BEFORE the broad `@agent-ui/a2ui` entry for the same prefix-match reason as
      // `./examples` above (else the broad alias rewrites `@agent-ui/a2ui/agent` → `.../src/index.ts/agent`).
      // A future cross-package TEST importing the bare `@agent-ui/a2ui/agent` specifier resolves through
      // this row (the ADR-0055 vitest-alias caveat, ADR-0137 Consequences) — today only the tools-side
      // consumer example dogfoods the bare specifier; the site's own agent-runtime shim/switcher import
      // by relative path into `src/agent/` instead (forced by the Node-first barrel, ADR-0137 clause 4).
      // Kept ready regardless, so a future site import switching to the bare specifier needs no new row.
      '@agent-ui/a2ui/agent': r('./packages/agent-ui/a2ui/src/agent/index.ts'),
      '@agent-ui/a2ui': r('./packages/agent-ui/a2ui/src/index.ts'),
      // The A2A arena's zero-dep surface (board/referee/transcript/isolation, LLD-C11) — mirrors the
      // `@agent-ui/a2ui` broad alias above; the site demo page is its first consumer.
      '@agent-ui/a2a': r('./packages/agent-ui/a2a/src/index.ts'),
    },
  },
})
