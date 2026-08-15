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
      {
        extends: true,
        test: {
          // GH #69 item 3 — direct, cheap regression coverage for scripts/publish/publish-packages.mjs's
          // `rewriteSpecifiers` (a plain Node .mjs CLI script — root-level `scripts/` sits outside every
          // tsconfig's `include` today, so this is its first automated gate of any kind). `environment:
          // 'node'` OVERRIDES the inherited jsdom default: the module resolves its own repo-root path via
          // `new URL('../..', import.meta.url)` unconditionally at load time, and vitest's jsdom environment
          // does not hand modules a real `file://` `import.meta.url` (measured: `TypeError: The URL must be
          // of scheme file` importing under the inherited jsdom default).
          name: 'scripts',
          environment: 'node',
          include: ['scripts/**/*.test.mjs'],
        },
      },
      {
        extends: true,
        // fs-shim-content.ts imports `.md`/`.jsonl` files as plain TEXT — a real behavior ONLY under
        // Wrangler's own "Text" module rule (wrangler.jsonc `rules`), which vitest/Vite has no notion of.
        // Vite treats an unrecognized extension as a hard parse error unless declared an asset here —
        // `assetsInclude` is a Vite top-level option (a sibling of `test`, not nested inside it), scoped to
        // THIS project only (never the fleet's other projects, which have no reason to touch prompt
        // markdown). This project only inspects `fs-shim-content.ts`'s KEY SET (the drift gate, GH #110) —
        // the asset-URL string Vite returns for the VALUE is irrelevant; real content correctness is
        // Wrangler's own build, not this gate's job.
        assetsInclude: ['**/*.md', '**/*.jsonl'],
        test: {
          // GH #112 — the per-package `tools/` trees (Node-side CLIs, dev-proxy plugins, the Cloudflare
          // Worker) sit outside every OTHER project's `include` glob, same gap `tsconfig.tools.json` closes
          // for TYPES only (CLAUDE.md) — this is their first BEHAVIOR gate. `environment: 'node'`: these
          // are server-side modules (Workers/Node), never meant to run under jsdom. Started narrow to
          // `worker/` (route-guards.ts, fs-shim.ts + fs-shim-content.ts's drift gate) — `index.ts` and
          // `process-shim.ts` are NOT safe to import here (process-shim.ts globally overrides
          // `process.cwd()`, a side effect that must never leak into a shared test process; see both
          // files' own header comments) — a future full-Worker integration test needs its own isolated
          // runtime (e.g. `@cloudflare/vitest-pool-workers`), not this project. GH #335 widened it to
          // `a2ui/tools/corpus/` and GH #343 to `a2a/tools/corpus/` — BOTH `import-seeds.ts` modules now
          // carry the same CLI-entry guard (`process.argv[1]?.endsWith('import-seeds.ts')`) keeping
          // `main()` from firing on import, so each is exactly as safe to import here as `route-guards.ts`/
          // `fs-shim.ts`. (#335 originally scoped to `a2ui` ONLY because a2a's tool then called `main()`
          // UNCONDITIONALLY with real `writeFileSync`s; #343 fixed that, which is what earns a2a its entry.)
          // Both are scoped by package NAME — never a `*/tools/corpus/*.test.ts` wildcard. A wildcard would
          // silently arm the FIRST test anyone adds under any future unguarded `tools/corpus/` tree to fire
          // a real mutating import inside the test process the moment it's created (the hazard GH #335's
          // review named, and GH #343's own root cause). A new package earns a line here once its tool is
          // guarded — it never inherits one.
          //
          // GH #476 (SPEC-R5) adds `a2ui/tools/conformance/` — `run.ts` carries the identical CLI-entry
          // guard (`process.argv[1]?.endsWith('run.ts')`), so importing its pure `runSuite`/`readFixtures`
          // exports here is exactly as safe as the corpus entries above; its own test also spawns the real
          // script as a subprocess (the AC1 exit-code proof), the same tier-2 shape as `import-seeds.test.ts`.
          //
          // GH #567 (S1, mcp-manifest-registry.decomp.md) adds `a2ui/tools/agent/integrations/mcp/` — the
          // MCP connector's OWN sibling folder one level below `integrations/`. The existing
          // `integrations/*.test.ts` line above is a single-segment glob (`*` never crosses a `/`), so it
          // does NOT pick up `integrations/mcp/*.test.ts` — measured empirically (a probe test file there
          // ran 0 times under `npm test` while still exiting 0, a false-green gate). This explicit sibling
          // line closes that gap for servers-config.test.ts (S1) and every later mcp/ slice's test file
          // (client.test.ts/map-tool.test.ts/discover.test.ts, S2-S4) — no further edits needed as they land.
          name: 'tools',
          environment: 'node',
          include: [
            'packages/agent-ui/*/tools/agent/worker/*.test.ts',
            'packages/agent-ui/a2ui/tools/agent/integrations/*.test.ts',
            'packages/agent-ui/a2ui/tools/agent/integrations/mcp/*.test.ts',
            'packages/agent-ui/a2ui/tools/corpus/*.test.ts',
            'packages/agent-ui/a2ui/tools/conformance/*.test.ts',
            'packages/agent-ui/a2a/tools/corpus/*.test.ts',
          ],
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
      // GH #368 — the Overlay controller's own declared subpath (`exports["./traits/overlay"]`). It is NOT
      // on the root barrel on purpose: re-exporting it there measured +945 B gz on that barrel's budgeted
      // reactive+dom row (7442 → 8387 against a 7680 B gz budget), a cost every consumer would pay so that
      // `@agent-ui/app`'s ui-nav-rail could reach one trait. Same more-specific-first ordering necessity as
      // `/components` + `/descriptor` above. (vitest.browser.config.ts needs no entry — it carries no
      // aliases at all and resolves this through the package `exports` map directly.)
      '@agent-ui/components/traits/overlay': r('./packages/agent-ui/components/src/traits/overlay.ts'),
      // genui-surface.spec.md v0.5 §11 (SPEC-R12, GH #316/ADR-0162) — `@agent-ui/app`'s `agent-admin.ts`
      // is the dogfood asset pair's first consumer from OUTSIDE the components package: it imports
      // `DOGFOOD_CSS`/`DOGFOOD_JS` (the generated, committed pair) to pass into a mounted `ui-sandbox-
      // frame` when the dogfood toggle is on. Same more-specific-first ordering necessity as `/components`/
      // `/descriptor` above.
      '@agent-ui/components/dogfood-frame': r('./packages/agent-ui/components/src/controls/sandbox-frame/dogfood/dogfood-assets.ts'),
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
      // The Model GRID (2026-07-19 rev.3) — `agent-admin.ts` side-effect-imports `radio` so the grid's
      // `document.createElement('ui-radio')` default-position column resolves to the REAL class. Same
      // alias-ordering necessity as `controls/button`/`controls/icon`/`controls/textarea` above.
      '@agent-ui/components/controls/radio': r('./packages/agent-ui/components/src/controls/radio/radio.ts'),
      // Vision rev.5 (Kim's Figma frame 33:1693) — `agent-admin.ts` side-effect-imports `disclosure` so
      // the Context tab's `document.createElement('ui-disclosure')` accordions resolve to the REAL class.
      '@agent-ui/components/controls/disclosure': r('./packages/agent-ui/components/src/controls/disclosure/disclosure.ts'),
      // GH #844 — `@agent-ui/app`'s `agent-admin/admin-help.ts` side-effect-imports `tooltip` so the
      // Surface tab's help icons resolve `document.createElement('ui-tooltip')` to the REAL class (the
      // focusin/Escape/aria-describedby contract is the whole point of reusing the primitive). Same
      // alias-ordering necessity as `controls/disclosure` immediately above.
      '@agent-ui/components/controls/tooltip': r('./packages/agent-ui/components/src/controls/tooltip/tooltip.ts'),
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
      // ADR-0179 GH #686 Amendment S7-c (admin-three-pane-ia.lld.md §16.1/§16.3) — `@agent-ui/app`'s
      // `ui-agent-admin` unified header bar is the first direct `./controls/{name}` subpath consumer of
      // `toggle`/`segmented-control`/`segment` from OUTSIDE the components package (the wide pane pills /
      // narrow single-select rendering): it side-effect-imports all three so
      // `document.createElement('ui-toggle' | 'ui-segmented-control' | 'ui-segment')` resolve to the REAL
      // classes. Same alias-ordering necessity as `controls/tabs`/`controls/menu` above — `segment` must
      // sit ahead of the broad `@agent-ui/components` entry below for the identical reason every other
      // `./controls/{name}` entry in this list does.
      '@agent-ui/components/controls/toggle': r('./packages/agent-ui/components/src/controls/toggle/toggle.ts'),
      '@agent-ui/components/controls/segmented-control': r('./packages/agent-ui/components/src/controls/segmented-control/segmented-control.ts'),
      '@agent-ui/components/controls/segment': r('./packages/agent-ui/components/src/controls/segment/segment.ts'),
      // TKT-0085 — `@agent-ui/app`'s `ui-agent-admin` is the next direct `./controls/{name}` subpath
      // consumer from OUTSIDE the components package: the responsive-collapse shell side-effect-imports
      // `tabs` so its `document.createElement('ui-tabs' | 'ui-tab' | 'ui-tab-panel')` calls resolve to the
      // REAL classes. Same alias-ordering necessity as `controls/split`/`controls/menu` above.
      '@agent-ui/components/controls/tabs': r('./packages/agent-ui/components/src/controls/tabs/tabs.ts'),
      // GH #917 — `@agent-ui/app`'s `ui-agent-admin` side-effect-imports `drawer` so `entry-list.ts`'s
      // `document.createElement('ui-drawer')` (the per-entry Edit/Add CRUD drawer, ADR-0188) resolves to the
      // REAL class in jsdom. Same alias-ordering necessity as `controls/tabs` immediately above.
      '@agent-ui/components/controls/drawer': r('./packages/agent-ui/components/src/controls/drawer/drawer.ts'),
      // genui-surface.spec.md SPEC-R8/PRD-G8 — `@agent-ui/app`'s `conversation.ts` is the next direct
      // `./controls/{name}` subpath consumer from OUTSIDE the components package: it side-effect-imports
      // `sandbox-frame` so its `document.createElement('ui-sandbox-frame')` (the genui parallel mount
      // path, `mountGenui`) resolves to the REAL class. Same alias-ordering necessity as `controls/tabs`.
      '@agent-ui/components/controls/sandbox-frame': r('./packages/agent-ui/components/src/controls/sandbox-frame/sandbox-frame.ts'),
      // EXACT (not prefix) matches, `?url`-suffixed. ORIGINAL consumer: `@agent-ui/app`'s isolated-shell
      // connect-flow (`app-shell.ts`, LLD-C5/ADR-0082) resolved these two package CSS assets to a real
      // runtime URL via Vite's `?url` suffix, to inject as `<link>` hrefs INSIDE a shadow root. That file was
      // REMOVED with `ui-app-shell` (ADR-0156), and no source in the repo carries a `?url` specifier for
      // either asset today — so this `?url` PAIR is currently unexercised (GH #278 diagnosed it; retained
      // rather than removed, because deleting live resolver config is a separate deliberate change). The
      // PLAIN twins below are NOT dead — `site/pages/_page.ts` imports both. Vite's aliasing is FIRST-
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
      // GH #810 — `workbench.ts`/`dashboard.ts` (the third/fourth full page modules to gain jsdom coverage,
      // `workbench.summary-fail-arm.test.ts`/`dashboard.summary-fail-arm.test.ts`) import this THIRD
      // foundation asset `a2ui-live.ts` never needed — the same unresolvable-path hazard the pair above
      // already documents, just for the one additional CSS file these two pages' own `[1b]` import step adds.
      '@agent-ui/components/base-styles.css': r('./packages/agent-ui/components/src/base-styles.css'),
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
      // The a2ui `./agent/genui-line` subpath (genui-surface.spec.md SPEC-R1/R2, B2) — mirrors the package's
      // exports map. Placed BEFORE the broader `./agent` entry for the same prefix-match reason as `./agent`
      // itself is placed before the broad `@agent-ui/a2ui` entry: this is the ZERO-DEP, browser-safe module
      // (no `node:fs`), the reason `site/lib/genui-line.ts` (a real, non-type-only re-export, unlike the
      // type-only `./agent/meta-line` imports elsewhere) needs to resolve it WITHOUT dragging in the Node-first
      // `./agent` barrel (system-prompt.ts/mini-skills.ts `readFileSync` at load).
      '@agent-ui/a2ui/agent/genui-line': r('./packages/agent-ui/a2ui/src/agent/genui-line.ts'),
      '@agent-ui/a2ui/agent': r('./packages/agent-ui/a2ui/src/agent/index.ts'),
      '@agent-ui/a2ui': r('./packages/agent-ui/a2ui/src/index.ts'),
      // ADR-0139 — the `./editor` subpath (ui-code-editor). `@agent-ui/app`'s entry-list.ts/agent-admin.ts are
      // the first cross-package consumers of `@agent-ui/code/editor` (the CM editor); a jsdom test driving
      // agent-admin transitively imports it, so it resolves through this row. Placed as an exact entry (there
      // is no broad `@agent-ui/code` alias to prefix-collide with; mirrors the package's `exports['./editor']`).
      '@agent-ui/code/editor': r('./packages/agent-ui/code/src/editor/index.ts'),
      // Vision rev.6 (Surface Options) — `agent-admin.ts` side-effect-imports `markdown` so the Markdown
      // modality's `document.createElement('ui-markdown')` renderer resolves to the REAL class in jsdom.
      '@agent-ui/code/markdown': r('./packages/agent-ui/code/src/markdown/index.ts'),
      // The A2A arena's zero-dep surface (board/referee/transcript/isolation, LLD-C11) — mirrors the
      // `@agent-ui/a2ui` broad alias above; the site demo page is its first consumer.
      '@agent-ui/a2a': r('./packages/agent-ui/a2a/src/index.ts'),
    },
  },
})
