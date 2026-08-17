import"./super-shell-D76CLu9A.js";import{n as e,r as t}from"./_page-DIBN49D1.js";import{t as n}from"./code-block-DEt2Scp8.js";import{a as r,g as i,h as a,m as o,n as s}from"./doc-page-H_CmxYv1.js";import{i as c}from"./specimens-BSFejhGR.js";var l=`{
  "name": "agent-ui",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "workspaces": [
    "packages/agent-ui/*"
  ],
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "check": "tsc && npm run check:site && npm run check:tools && npm run check:scripts",
    "check:site": "tsc -p site/tsconfig.json",
    "check:tools": "tsc -p tsconfig.tools.json",
    "check:scripts": "python3 scripts/adr_ratify_test.py && python3 scripts/hook_selftests.py && python3 scripts/claude_wiring_check.py && node scripts/reap-branches.mjs selftest",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:browser": "npm run test:browser:packages && npm run test:browser:site && npm run test:browser:focus-timing && npm run test:visual",
    "test:browser:packages": "npm run test:browser:packages:components && npm run test:browser:packages:app && npm run test:browser:packages:rest",
    "test:browser:packages:components": "vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/components",
    "test:browser:packages:app": "vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/app",
    "test:browser:packages:rest": "vitest run --config vitest.browser.config.ts --project packages-rest",
    "test:browser:site": "vitest run --config vitest.browser.config.ts --project site",
    "test:browser:focus-timing": "vitest run --config vitest.browser.config.ts --project focus-timing",
    "test:visual": "vitest run --config vitest.browser.config.ts --project visual",
    "test:visual:update": "vitest run --config vitest.browser.config.ts --project visual --update",
    "size": "node scripts/measure-size.mjs",
    "ops:reap-branches": "node scripts/reap-branches.mjs",
    "publish:packages": "node scripts/publish/publish-packages.mjs",
    "deploy:docs": "npm run build && wrangler deploy"
  },
  "devDependencies": {
    "@types/node": "^26.1.1",
    "@vitest/browser": "^4.1.9",
    "@vitest/browser-playwright": "^4.1.9",
    "jsdom": "^29.1.1",
    "lightningcss": "^1.32.0",
    "playwright": "^1.61.1",
    "typescript": "~6.0.2",
    "vite": "^8.1.0",
    "vitest": "^4.1.9",
    "wrangler": "^4.112.0"
  }
}
`,u=`{
  "name": "@agent-ui/shared",
  "description": "Design tokens and foundation stylesheets for the agent-ui family: the \`--md-sys-*\` color/dimension token system (an extension of Material Design 3), the typographic scale, and loadable theme packs.",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./tokens.css": "./src/tokens/tokens.css",
    "./dimensions.css": "./src/tokens/dimensions.css",
    "./base.css": "./src/tokens/base.css",
    "./themes/*": "./src/tokens/themes/*",
    "./testing/dialog-polyfill": "./src/testing/dialog-polyfill.ts"
  }
}
`,d=`// @agent-ui/shared/testing/dialog-polyfill — the ONE sanctioned jsdom \`<dialog>\` modal-surface stub (GH #1006).
//
// jsdom reality (verified — node_modules/jsdom's HTMLDialogElement-impl.js is a BARE \`class extends
// HTMLElement {}\`): the native \`<dialog>\` modal surface is ABSENT — \`showModal\`/\`close\` are undefined, there
// is no \`open\` IDL accessor, and the \`cancel\`/\`close\` events never auto-fire. Every jsdom suite that drives a
// \`ui-modal\`/\`ui-drawer\`/\`ui-command-modal\` (or a page composing one) used to re-declare this stub inline;
// this module is that stub lifted once, so \`open = true\` actually reaches the DOM under jsdom while the REAL
// top-layer / focus-trap / Escape / backdrop behaviour stays proven in the \`*.browser.test.ts\` legs.
//
// Contract mirrored (minimal, platform-parity where it matters):
//   - \`open\` getter/setter backed by a per-instance WeakMap
//   - \`showModal()\` → open (and counts the call — see \`dialogCallsOf\`)
//   - \`close()\` → close + a \`close\` event; already-closed → a no-op, no event (platform parity)
//
// Idempotent + engine-safe: a REAL engine (the browser harness) already has \`showModal\`, so the install
// returns without touching the platform; a second install under jsdom is a no-op too (the first install
// made \`showModal\` a function). Test-only: this subpath is never imported by a shipping module.

/** Per-dialog call counters, for suites that pin HOW MANY times the platform surface was driven. */
export interface DialogCalls {
  showModal: number
  close: number
}

const dialogOpen = new WeakMap<HTMLDialogElement, boolean>()
const dialogCalls = new WeakMap<HTMLDialogElement, DialogCalls>()

/** The \`showModal()\`/\`close()\` call counts recorded for \`dialog\` by the installed stub (zeros before any call). */
export function dialogCallsOf(dialog: HTMLDialogElement): DialogCalls {
  let c = dialogCalls.get(dialog)
  if (!c) {
    c = { showModal: 0, close: 0 }
    dialogCalls.set(dialog, c)
  }
  return c
}

/**
 * Install the jsdom \`<dialog>\` modal-surface stub on \`HTMLDialogElement.prototype\`. Call from \`beforeAll\`
 * (or at module top before a page module boots). Returns \`true\` when the stub was installed, \`false\` when
 * the engine already carries a real \`showModal\` (browser harness, or a prior install) — the platform is
 * then left alone.
 */
export function installDialogPolyfill(): boolean {
  if (typeof HTMLDialogElement === 'undefined') return false
  const proto = HTMLDialogElement.prototype as unknown as { showModal?: () => void; close?: () => void }
  if (typeof proto.showModal === 'function') return false // a real engine (or already installed) — leave it alone
  Object.defineProperty(HTMLDialogElement.prototype, 'open', {
    configurable: true,
    get(this: HTMLDialogElement): boolean {
      return dialogOpen.get(this) ?? false
    },
    set(this: HTMLDialogElement, v: boolean): void {
      dialogOpen.set(this, Boolean(v))
    },
  })
  proto.showModal = function (this: HTMLDialogElement): void {
    dialogCallsOf(this).showModal++
    dialogOpen.set(this, true)
  }
  proto.close = function (this: HTMLDialogElement): void {
    dialogCallsOf(this).close++
    if (!(dialogOpen.get(this) ?? false)) return // already closed — a no-op, no event (platform parity)
    dialogOpen.set(this, false)
    this.dispatchEvent(new Event('close'))
  }
  return true
}
`,f="import { defineConfig, configDefaults } from 'vitest/config'\nimport { fileURLToPath } from 'node:url'\n\nconst r = (p: string) => fileURLToPath(new URL(p, import.meta.url))\n\n// Vitest is the behaviour runner; `tsc` (npm run check) stays the type gate.\n// jsdom is the fast inner loop, split into two vitest PROJECTS (the `test.projects` array — vitest 4's inline\n// replacement for the deprecated `vitest.workspace.ts`): `packages` (the framework's own *.test.ts) and `site`\n// (the docs-site's own *.test.ts, e.g. site/lib/adr.ts). Both `extends: true` off this root config, inheriting\n// the jsdom environment + the resolve aliases below. The browser-truth layer (@vitest/browser + Playwright, for\n// @scope / light-dark() / real focus / computed geometry / the AX tree) is a SEPARATE config —\n// `vitest.browser.config.ts` / `npm run test:browser` (G5), itself split the same way. The `*.browser.test.ts`\n// glob is excluded from both jsdom projects so those real-engine tests never run under jsdom (where computed\n// geometry isn't true). Workspace packages resolve via the aliases below.\nexport default defineConfig({\n  test: {\n    environment: 'jsdom',\n    projects: [\n      {\n        extends: true,\n        test: {\n          name: 'packages',\n          include: ['packages/agent-ui/*/src/**/*.test.ts'],\n          exclude: [...configDefaults.exclude, '**/*.browser.test.ts'],\n        },\n      },\n      {\n        extends: true,\n        test: {\n          name: 'site',\n          include: ['site/**/*.test.ts'],\n          exclude: [...configDefaults.exclude, '**/*.browser.test.ts'],\n        },\n      },\n      {\n        extends: true,\n        test: {\n          // GH #69 item 3 — direct, cheap regression coverage for scripts/publish/publish-packages.mjs's\n          // `rewriteSpecifiers` (a plain Node .mjs CLI script — root-level `scripts/` sits outside every\n          // tsconfig's `include` today, so this is its first automated gate of any kind). `environment:\n          // 'node'` OVERRIDES the inherited jsdom default: the module resolves its own repo-root path via\n          // `new URL('../..', import.meta.url)` unconditionally at load time, and vitest's jsdom environment\n          // does not hand modules a real `file://` `import.meta.url` (measured: `TypeError: The URL must be\n          // of scheme file` importing under the inherited jsdom default).\n          name: 'scripts',\n          environment: 'node',\n          include: ['scripts/**/*.test.mjs'],\n        },\n      },\n      {\n        extends: true,\n        // fs-shim-content.ts imports `.md`/`.jsonl` files as plain TEXT — a real behavior ONLY under\n        // Wrangler's own \"Text\" module rule (wrangler.jsonc `rules`), which vitest/Vite has no notion of.\n        // Vite treats an unrecognized extension as a hard parse error unless declared an asset here —\n        // `assetsInclude` is a Vite top-level option (a sibling of `test`, not nested inside it), scoped to\n        // THIS project only (never the fleet's other projects, which have no reason to touch prompt\n        // markdown). This project only inspects `fs-shim-content.ts`'s KEY SET (the drift gate, GH #110) —\n        // the asset-URL string Vite returns for the VALUE is irrelevant; real content correctness is\n        // Wrangler's own build, not this gate's job.\n        assetsInclude: ['**/*.md', '**/*.jsonl'],\n        test: {\n          // GH #112 — the per-package `tools/` trees (Node-side CLIs, dev-proxy plugins, the Cloudflare\n          // Worker) sit outside every OTHER project's `include` glob, same gap `tsconfig.tools.json` closes\n          // for TYPES only (CLAUDE.md) — this is their first BEHAVIOR gate. `environment: 'node'`: these\n          // are server-side modules (Workers/Node), never meant to run under jsdom. Started narrow to\n          // `worker/` (route-guards.ts, fs-shim.ts + fs-shim-content.ts's drift gate) — `index.ts` and\n          // `process-shim.ts` are NOT safe to import here (process-shim.ts globally overrides\n          // `process.cwd()`, a side effect that must never leak into a shared test process; see both\n          // files' own header comments) — a future full-Worker integration test needs its own isolated\n          // runtime (e.g. `@cloudflare/vitest-pool-workers`), not this project. GH #335 widened it to\n          // `a2ui/tools/corpus/` and GH #343 to `a2a/tools/corpus/` — BOTH `import-seeds.ts` modules now\n          // carry the same CLI-entry guard (`process.argv[1]?.endsWith('import-seeds.ts')`) keeping\n          // `main()` from firing on import, so each is exactly as safe to import here as `route-guards.ts`/\n          // `fs-shim.ts`. (#335 originally scoped to `a2ui` ONLY because a2a's tool then called `main()`\n          // UNCONDITIONALLY with real `writeFileSync`s; #343 fixed that, which is what earns a2a its entry.)\n          // Both are scoped by package NAME — never a `*/tools/corpus/*.test.ts` wildcard. A wildcard would\n          // silently arm the FIRST test anyone adds under any future unguarded `tools/corpus/` tree to fire\n          // a real mutating import inside the test process the moment it's created (the hazard GH #335's\n          // review named, and GH #343's own root cause). A new package earns a line here once its tool is\n          // guarded — it never inherits one.\n          //\n          // GH #476 (SPEC-R5) adds `a2ui/tools/conformance/` — `run.ts` carries the identical CLI-entry\n          // guard (`process.argv[1]?.endsWith('run.ts')`), so importing its pure `runSuite`/`readFixtures`\n          // exports here is exactly as safe as the corpus entries above; its own test also spawns the real\n          // script as a subprocess (the AC1 exit-code proof), the same tier-2 shape as `import-seeds.test.ts`.\n          //\n          // GH #567 (S1, mcp-manifest-registry.decomp.md) adds `a2ui/tools/agent/integrations/mcp/` — the\n          // MCP connector's OWN sibling folder one level below `integrations/`. The existing\n          // `integrations/*.test.ts` line above is a single-segment glob (`*` never crosses a `/`), so it\n          // does NOT pick up `integrations/mcp/*.test.ts` — measured empirically (a probe test file there\n          // ran 0 times under `npm test` while still exiting 0, a false-green gate). This explicit sibling\n          // line closes that gap for servers-config.test.ts (S1) and every later mcp/ slice's test file\n          // (client.test.ts/map-tool.test.ts/discover.test.ts, S2-S4) — no further edits needed as they land.\n          name: 'tools',\n          environment: 'node',\n          include: [\n            'packages/agent-ui/*/tools/agent/worker/*.test.ts',\n            'packages/agent-ui/a2ui/tools/agent/integrations/*.test.ts',\n            'packages/agent-ui/a2ui/tools/agent/integrations/mcp/*.test.ts',\n            'packages/agent-ui/a2ui/tools/corpus/*.test.ts',\n            'packages/agent-ui/a2ui/tools/conformance/*.test.ts',\n            'packages/agent-ui/a2a/tools/corpus/*.test.ts',\n          ],\n        },\n      },\n    ],\n  },\n  resolve: {\n    alias: {\n      // More-specific subpaths FIRST (string aliases prefix-match in order): the controls barrel —\n      // `@agent-ui/components/components` mirrors the package's `exports[\"./components\"]` (the self-defining\n      // ui-* family). Without it, the broad alias below mangles the subpath and a2ui tests can't load a\n      // real control (e.g. the default catalog's ui-button factory).\n      '@agent-ui/components/components': r('./packages/agent-ui/components/src/controls/index.ts'),\n      '@agent-ui/components/descriptor': r('./packages/agent-ui/components/src/descriptor/index.ts'),\n      // GH #368 — the Overlay controller's own declared subpath (`exports[\"./traits/overlay\"]`). It is NOT\n      // on the root barrel on purpose: re-exporting it there measured +945 B gz on that barrel's budgeted\n      // reactive+dom row (7442 → 8387 against a 7680 B gz budget), a cost every consumer would pay so that\n      // `@agent-ui/app`'s ui-nav-rail could reach one trait. Same more-specific-first ordering necessity as\n      // `/components` + `/descriptor` above. (vitest.browser.config.ts needs no entry — it carries no\n      // aliases at all and resolves this through the package `exports` map directly.)\n      '@agent-ui/components/traits/overlay': r('./packages/agent-ui/components/src/traits/overlay.ts'),\n      // GH #952 — the reorder-mode trait's own declared subpath (`exports[\"./traits/list-reorder\"]`), same\n      // not-on-the-root-barrel rationale as `/traits/overlay` above: `site/pages/agent-admin-app.ts` (the\n      // dogfood-migrated Edit Agents drawer) is its first consumer from OUTSIDE the components package. Same\n      // more-specific-first ordering necessity as `/components`/`/descriptor` above.\n      '@agent-ui/components/traits/list-reorder': r('./packages/agent-ui/components/src/traits/list-reorder.ts'),\n      // genui-surface.spec.md v0.5 §11 (SPEC-R12, GH #316/ADR-0162) — `@agent-ui/app`'s `agent-admin.ts`\n      // is the dogfood asset pair's first consumer from OUTSIDE the components package: it imports\n      // `DOGFOOD_CSS`/`DOGFOOD_JS` (the generated, committed pair) to pass into a mounted `ui-sandbox-\n      // frame` when the dogfood toggle is on. Same more-specific-first ordering necessity as `/components`/\n      // `/descriptor` above.\n      '@agent-ui/components/dogfood-frame': r('./packages/agent-ui/components/src/controls/sandbox-frame/dogfood/dogfood-assets.ts'),\n      // The catalog's static validator (content-family LLD-C13, ADR-0114 cl.3) is the first consumer of a\n      // single-control `./controls/{name}` exports-map subpath from OUTSIDE the components package (every\n      // prior cross-package import went through the whole `/components` barrel above) — mirrors the\n      // package's `exports['./controls/text']` (SAFE_HREF_SCHEMES, re-exported through text.ts). Same\n      // more-specific-first ordering discipline as the `/components`/`/descriptor` entries above.\n      '@agent-ui/components/controls/text': r('./packages/agent-ui/components/src/controls/text/text.ts'),\n      // ADR-0117 — site/lib/component-gallery.ts (a jsdom-tested module, site/gallery.test.ts) is the second\n      // direct `./controls/{name}` subpath consumer from OUTSIDE the components package; same alias-ordering\n      // necessity as `controls/text` above (the broad `@agent-ui/components` entry below prefix-matches ANY\n      // subpath and mangles it into a path segment appended after `index.ts` unless a more-specific exact\n      // entry wins first).\n      '@agent-ui/components/controls/theme-provider': r('./packages/agent-ui/components/src/controls/theme-provider/theme-provider.ts'),\n      // @agent-ui/code/src/markdown/render.ts (LLD-C9) is the third direct `./controls/{name}` subpath\n      // consumer from OUTSIDE the components package — the fenced-code and GFM-table construct legs need\n      // `ui-code`/`ui-table` self-defined without dragging the whole `/components` barrel. Same\n      // alias-ordering necessity as `controls/text`/`controls/theme-provider` above.\n      '@agent-ui/components/controls/code': r('./packages/agent-ui/components/src/controls/code/code.ts'),\n      '@agent-ui/components/controls/table': r('./packages/agent-ui/components/src/controls/table/table.ts'),\n      // app-surfaces-m4.lld.md LLD-C10 — `@agent-ui/app`'s `ui-master-detail` (master-detail.ts) is the\n      // fifth direct `./controls/{name}` subpath consumer from OUTSIDE the components package: it imports\n      // `ui-split`/`ui-split-pane` for their self-defining side effect, so `document.createElement('ui-split')`\n      // resolves to the REAL class before it composes them. Same alias-ordering necessity as\n      // `controls/text`/`controls/theme-provider`/`controls/code`/`controls/table` above.\n      '@agent-ui/components/controls/split': r('./packages/agent-ui/components/src/controls/split/split.ts'),\n      '@agent-ui/components/controls/split-pane': r('./packages/agent-ui/components/src/controls/split/split-pane.ts'),\n      // TKT-0048 — `@agent-ui/app`'s `entry-list.ts` (composed by `ui-agent-admin`) is the next direct\n      // `./controls/{name}` subpath consumer from OUTSIDE the components package: `agent-admin.ts`\n      // side-effect-imports `button`/`icon` so entry-list.ts's `document.createElement('ui-button'\n      // | 'ui-icon')` calls resolve to the REAL classes explicitly, not only via the incidental\n      // conversation→a2ui transitive path. Same alias-ordering necessity as `controls/split`/\n      // `controls/split-pane` above.\n      '@agent-ui/components/controls/button': r('./packages/agent-ui/components/src/controls/button/button.ts'),\n      '@agent-ui/components/controls/icon': r('./packages/agent-ui/components/src/controls/icon/icon.ts'),\n      // TKT-0049 — `agent-admin.ts` also side-effect-imports `textarea` so entry-list.ts's\n      // `document.createElement('ui-textarea')` calls resolve to the REAL class explicitly. Same\n      // alias-ordering necessity as `controls/button`/`controls/icon` immediately above.\n      '@agent-ui/components/controls/textarea': r('./packages/agent-ui/components/src/controls/textarea/textarea.ts'),\n      // The Model GRID (2026-07-19 rev.3) — `agent-admin.ts` side-effect-imports `radio` so the grid's\n      // `document.createElement('ui-radio')` default-position column resolves to the REAL class. Same\n      // alias-ordering necessity as `controls/button`/`controls/icon`/`controls/textarea` above.\n      '@agent-ui/components/controls/radio': r('./packages/agent-ui/components/src/controls/radio/radio.ts'),\n      // Vision rev.5 (Kim's Figma frame 33:1693) — `agent-admin.ts` side-effect-imports `disclosure` so\n      // the Context tab's `document.createElement('ui-disclosure')` accordions resolve to the REAL class.\n      '@agent-ui/components/controls/disclosure': r('./packages/agent-ui/components/src/controls/disclosure/disclosure.ts'),\n      // GH #844 — `@agent-ui/app`'s `agent-admin/admin-help.ts` side-effect-imports `tooltip` so the\n      // Surface tab's help icons resolve `document.createElement('ui-tooltip')` to the REAL class (the\n      // focusin/Escape/aria-describedby contract is the whole point of reusing the primitive). Same\n      // alias-ordering necessity as `controls/disclosure` immediately above.\n      '@agent-ui/components/controls/tooltip': r('./packages/agent-ui/components/src/controls/tooltip/tooltip.ts'),\n      // app-surfaces-m4.lld.md LLD-C13/C14 — `@agent-ui/app`'s `ui-settings` schema/generate.ts are the\n      // sixth/seventh/etc. direct `./controls/{name}` subpath consumers from OUTSIDE the components\n      // package: the field-type registry self-defines the four mapped controls (text-field/switch/\n      // select/slider) for their `document.createElement` side effect, and the generator self-defines\n      // the two form-coordination controls (field/form-provider) the same way — same alias-ordering\n      // necessity as `controls/split`/`controls/split-pane` above.\n      '@agent-ui/components/controls/text-field': r('./packages/agent-ui/components/src/controls/text-field/text-field.ts'),\n      '@agent-ui/components/controls/switch': r('./packages/agent-ui/components/src/controls/switch/switch.ts'),\n      '@agent-ui/components/controls/select': r('./packages/agent-ui/components/src/controls/select/select.ts'),\n      '@agent-ui/components/controls/slider': r('./packages/agent-ui/components/src/controls/slider/slider.ts'),\n      '@agent-ui/components/controls/field': r('./packages/agent-ui/components/src/controls/field/field.ts'),\n      '@agent-ui/components/controls/form-provider': r('./packages/agent-ui/components/src/controls/form-provider/form-provider.ts'),\n      // nav-rail-family.lld.md LLD-C2 (ADR-0130) — `@agent-ui/app`'s `ui-nav-rail-group` is the next direct\n      // `./controls/{name}` subpath consumer from OUTSIDE the components package: `collapse=\"icon-popover\"`\n      // composes a real `ui-menu` (self-defining side effect) for its per-group flyout. Same alias-ordering\n      // necessity as `controls/split`/`controls/text-field` above.\n      '@agent-ui/components/controls/menu': r('./packages/agent-ui/components/src/controls/menu/menu.ts'),\n      // ADR-0179 GH #686 Amendment S7-c (admin-three-pane-ia.lld.md §16.1/§16.3) — `@agent-ui/app`'s\n      // `ui-agent-admin` unified header bar is the first direct `./controls/{name}` subpath consumer of\n      // `toggle`/`segmented-control`/`segment` from OUTSIDE the components package (the wide pane pills /\n      // narrow single-select rendering): it side-effect-imports all three so\n      // `document.createElement('ui-toggle' | 'ui-segmented-control' | 'ui-segment')` resolve to the REAL\n      // classes. Same alias-ordering necessity as `controls/tabs`/`controls/menu` above — `segment` must\n      // sit ahead of the broad `@agent-ui/components` entry below for the identical reason every other\n      // `./controls/{name}` entry in this list does.\n      '@agent-ui/components/controls/toggle': r('./packages/agent-ui/components/src/controls/toggle/toggle.ts'),\n      '@agent-ui/components/controls/segmented-control': r('./packages/agent-ui/components/src/controls/segmented-control/segmented-control.ts'),\n      '@agent-ui/components/controls/segment': r('./packages/agent-ui/components/src/controls/segment/segment.ts'),\n      // TKT-0085 — `@agent-ui/app`'s `ui-agent-admin` is the next direct `./controls/{name}` subpath\n      // consumer from OUTSIDE the components package: the responsive-collapse shell side-effect-imports\n      // `tabs` so its `document.createElement('ui-tabs' | 'ui-tab' | 'ui-tab-panel')` calls resolve to the\n      // REAL classes. Same alias-ordering necessity as `controls/split`/`controls/menu` above.\n      '@agent-ui/components/controls/tabs': r('./packages/agent-ui/components/src/controls/tabs/tabs.ts'),\n      // GH #917 — `@agent-ui/app`'s `ui-agent-admin` side-effect-imports `drawer` so `entry-list.ts`'s\n      // `document.createElement('ui-drawer')` (the per-entry Edit/Add CRUD drawer, ADR-0188) resolves to the\n      // REAL class in jsdom. Same alias-ordering necessity as `controls/tabs` immediately above.\n      '@agent-ui/components/controls/drawer': r('./packages/agent-ui/components/src/controls/drawer/drawer.ts'),\n      // genui-surface.spec.md SPEC-R8/PRD-G8 — `@agent-ui/app`'s `conversation.ts` is the next direct\n      // `./controls/{name}` subpath consumer from OUTSIDE the components package: it side-effect-imports\n      // `sandbox-frame` so its `document.createElement('ui-sandbox-frame')` (the genui parallel mount\n      // path, `mountGenui`) resolves to the REAL class. Same alias-ordering necessity as `controls/tabs`.\n      '@agent-ui/components/controls/sandbox-frame': r('./packages/agent-ui/components/src/controls/sandbox-frame/sandbox-frame.ts'),\n      // EXACT (not prefix) matches, `?url`-suffixed. ORIGINAL consumer: `@agent-ui/app`'s isolated-shell\n      // connect-flow (`app-shell.ts`, LLD-C5/ADR-0082) resolved these two package CSS assets to a real\n      // runtime URL via Vite's `?url` suffix, to inject as `<link>` hrefs INSIDE a shadow root. That file was\n      // REMOVED with `ui-app-shell` (ADR-0156), and no source in the repo carries a `?url` specifier for\n      // either asset today — so this `?url` PAIR is currently unexercised (GH #278 diagnosed it; retained\n      // rather than removed, because deleting live resolver config is a separate deliberate change). The\n      // PLAIN twins below are NOT dead — `site/pages/_page.ts` imports both. Vite's aliasing is FIRST-\n      // MATCH-WINS in array order, and a plain-string alias matches on a whole path segment (`importee ===\n      // find || importee.startsWith(find + '/')`) — `@agent-ui/components/foundation-styles.css?url` DOES\n      // start with the broad `@agent-ui/components` alias below, so without these two exact entries placed\n      // BEFORE it, that broad alias would intercept the specifier first and mangle the `?url` suffix into its\n      // replacement path. Placing the exact, query-suffixed entries earlier in this object is what makes them\n      // win instead (the replacement carries the SAME `?url` suffix through, so Vite's own asset-URL\n      // transform still recognizes it) — the same ordering discipline the `@agent-ui/components/components`\n      // and `/descriptor` subpath entries above already rely on.\n      '@agent-ui/components/foundation-styles.css?url': `${r('./packages/agent-ui/components/src/foundation-styles.css')}?url`,\n      '@agent-ui/components/component-styles.css?url': `${r('./packages/agent-ui/components/src/component-styles.css')}?url`,\n      // Plain (non-`?url`) exact twins of the two entries above: `site/pages/_page.ts` — the shared page\n      // shell EVERY site page imports first — side-effect-imports these two CSS assets directly (no `?url`\n      // suffix, just \"apply this stylesheet\"), which a jsdom PAGE-level test (e.g.\n      // `a2ui-live.ask-lifecycle.test.ts`, driving the real `a2ui-live.ts` module rather than a hand-built\n      // fixture) now transitively imports. Without these exact entries, the broad `@agent-ui/components`\n      // alias below intercepts the plain specifier first (same prefix-match hazard as the `?url` pair's own\n      // comment describes) and mangles it into `.../src/index.ts/foundation-styles.css` — an unresolvable\n      // path. Every prior jsdom test avoided this because none imported a full page module; only the\n      // browser config (no aliasing at all — real package `exports`) exercised this import before now.\n      '@agent-ui/components/foundation-styles.css': r('./packages/agent-ui/components/src/foundation-styles.css'),\n      '@agent-ui/components/component-styles.css': r('./packages/agent-ui/components/src/component-styles.css'),\n      // GH #810 — `workbench.ts`/`dashboard.ts` (the third/fourth full page modules to gain jsdom coverage,\n      // `workbench.summary-fail-arm.test.ts`/`dashboard.summary-fail-arm.test.ts`) import this THIRD\n      // foundation asset `a2ui-live.ts` never needed — the same unresolvable-path hazard the pair above\n      // already documents, just for the one additional CSS file these two pages' own `[1b]` import step adds.\n      '@agent-ui/components/base-styles.css': r('./packages/agent-ui/components/src/base-styles.css'),\n      '@agent-ui/components': r('./packages/agent-ui/components/src/index.ts'),\n      // GH #1006 — the shared jsdom `<dialog>` stub (`exports['./testing/dialog-polyfill']`), test-only. Placed\n      // BEFORE the broad `@agent-ui/shared` entry for the same prefix-match reason as every subpath above.\n      '@agent-ui/shared/testing/dialog-polyfill': r('./packages/agent-ui/shared/src/testing/dialog-polyfill.ts'),\n      '@agent-ui/shared': r('./packages/agent-ui/shared/src/index.ts'),\n      // The a2ui `./examples` subpath (the seed shelf, ADR-0055) — mirrors the package's exports map. Placed\n      // BEFORE the broad `@agent-ui/a2ui` entry: a plain-string alias prefix-matches, so without this the\n      // broad alias would rewrite `@agent-ui/a2ui/examples` to `.../src/index.ts/examples` (the same\n      // subpath-ordering discipline `@agent-ui/components/components` above relies on). Used by the site's\n      // A2UI gallery + its drift gate (site/lib/a2ui-gallery.ts / .test.ts).\n      '@agent-ui/a2ui/examples': r('./packages/agent-ui/a2ui/src/examples/index.ts'),\n      // The a2ui `./agent` subpath (the producer toolkit, ADR-0137/TKT-0072) — mirrors the package's\n      // exports map. Placed BEFORE the broad `@agent-ui/a2ui` entry for the same prefix-match reason as\n      // `./examples` above (else the broad alias rewrites `@agent-ui/a2ui/agent` → `.../src/index.ts/agent`).\n      // A future cross-package TEST importing the bare `@agent-ui/a2ui/agent` specifier resolves through\n      // this row (the ADR-0055 vitest-alias caveat, ADR-0137 Consequences) — today only the tools-side\n      // consumer example dogfoods the bare specifier; the site's own agent-runtime shim/switcher import\n      // by relative path into `src/agent/` instead (forced by the Node-first barrel, ADR-0137 clause 4).\n      // Kept ready regardless, so a future site import switching to the bare specifier needs no new row.\n      // The a2ui `./agent/genui-line` subpath (genui-surface.spec.md SPEC-R1/R2, B2) — mirrors the package's\n      // exports map. Placed BEFORE the broader `./agent` entry for the same prefix-match reason as `./agent`\n      // itself is placed before the broad `@agent-ui/a2ui` entry: this is the ZERO-DEP, browser-safe module\n      // (no `node:fs`), the reason `site/lib/genui-line.ts` (a real, non-type-only re-export, unlike the\n      // type-only `./agent/meta-line` imports elsewhere) needs to resolve it WITHOUT dragging in the Node-first\n      // `./agent` barrel (system-prompt.ts/mini-skills.ts `readFileSync` at load).\n      '@agent-ui/a2ui/agent/genui-line': r('./packages/agent-ui/a2ui/src/agent/genui-line.ts'),\n      // The a2ui `./agent/meta-line` subpath (ADR-0088's envelope + guard) — mirrors the package's exports\n      // map, placed BEFORE the broader `./agent` entry for the same prefix-match reason as `genui-line`\n      // above: this is the ZERO-DEP, browser-safe module. `@agent-ui/devtools` (ADR-0200) is its first\n      // cross-package VALUE consumer (`readMetaLine`/`formatErrorLine` — the replay exhausted-idiom and\n      // recordTurn's meta-vs-line routing) and must not drag in the Node-first `./agent` barrel\n      // (system-prompt.ts/mini-skills.ts `readFileSync` at load).\n      '@agent-ui/a2ui/agent/meta-line': r('./packages/agent-ui/a2ui/src/agent/meta-line.ts'),\n      // The a2ui `./agent/agent-transport` subpath (ADR-0137's seam file, browser-safe pure types +\n      // zero node imports) — mirrors the package's exports map, placed BEFORE the broader `./agent`\n      // entry for the same prefix-match reason as `meta-line`/`genui-line` above. `@agent-ui/devtools`\n      // (ADR-0200) type-imports the seam from HERE so a site page importing devtools (the harness page,\n      // GH #1122 S4) never drags the Node-first `./agent` barrel into the site type program\n      // (site/tsconfig.json deliberately carries no node types).\n      '@agent-ui/a2ui/agent/agent-transport': r('./packages/agent-ui/a2ui/src/agent/agent-transport.ts'),\n      '@agent-ui/a2ui/agent': r('./packages/agent-ui/a2ui/src/agent/index.ts'),\n      '@agent-ui/a2ui': r('./packages/agent-ui/a2ui/src/index.ts'),\n      // ADR-0139 — the `./editor` subpath (ui-code-editor). `@agent-ui/app`'s entry-list.ts/agent-admin.ts are\n      // the first cross-package consumers of `@agent-ui/code/editor` (the CM editor); a jsdom test driving\n      // agent-admin transitively imports it, so it resolves through this row. Placed as an exact entry (there\n      // is no broad `@agent-ui/code` alias to prefix-collide with; mirrors the package's `exports['./editor']`).\n      '@agent-ui/code/editor': r('./packages/agent-ui/code/src/editor/index.ts'),\n      // Vision rev.6 (Surface Options) — `agent-admin.ts` side-effect-imports `markdown` so the Markdown\n      // modality's `document.createElement('ui-markdown')` renderer resolves to the REAL class in jsdom.\n      '@agent-ui/code/markdown': r('./packages/agent-ui/code/src/markdown/index.ts'),\n      // The A2A arena's zero-dep surface (board/referee/transcript/isolation, LLD-C11) — mirrors the\n      // `@agent-ui/a2ui` broad alias above; the site demo page is its first consumer.\n      '@agent-ui/a2a': r('./packages/agent-ui/a2a/src/index.ts'),\n      // @agent-ui/devtools (ADR-0200) — the dev/debug harness package. Subpath entries BEFORE the broad\n      // entry (the same prefix-match ordering discipline as every subpath row above); mirrors the\n      // package's exports map (`.` · `./server` · `./playwright`).\n      '@agent-ui/devtools/server': r('./packages/agent-ui/devtools/src/server/index.ts'),\n      '@agent-ui/devtools/playwright': r('./packages/agent-ui/devtools/src/playwright/index.ts'),\n      '@agent-ui/devtools': r('./packages/agent-ui/devtools/src/index.ts'),\n    },\n  },\n})\n",p=`import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'

// The browser-truth runner (decomp s12) — a SEPARATE vitest config from the jsdom inner loop
// (\`vitest.config.ts\`). Real engines (Playwright-driven Chromium + WebKit) are where @scope, the
// dimensional ramp, real computed geometry and the AX tree are actually true; jsdom can't resolve them.
// Run with \`npm run test:browser\`. Split into FOUR vitest PROJECTS (the \`test.projects\` array — vitest 4's
// inline replacement for \`vitest.workspace.ts\`): \`packages\` (the framework's own *.browser.test.ts), \`site\`
// (the docs-site's own *.browser.test.ts, e.g. site/lib/component-preview.browser.test.ts), \`focus-timing\`
// (GH #56 — a small, named set of focus/keyboard/scroll-timing files pulled out of \`packages\`/\`site\` and
// run with zero file parallelism, since they flake under concurrent-page focus contention; see that
// project's own comment below), and \`visual\` (ADR-0110 — the pixel-diff harness, opt-in by filename). All
// four \`extends: true\` off this root config, inheriting the browser instances below (the jsdom config
// excludes the \`*.browser.test.ts\` glob entirely, so these suites never collide with it). No resolve
// aliases: the workspace packages are symlinked under
// node_modules and Vite resolves the bare \`@agent-ui/*\` specifiers (incl. the \`./components\` + CSS
// subpaths, and the barrels' inner \`@import '@agent-ui/shared/...'\`) through their package \`exports\` map.
// vitest 4.1 takes the provider as a factory from \`@vitest/browser-playwright\` (no longer a string).
//
// HEAP (resolved 2026-07-19, GH #41): the full suite in ONE vitest process holds the whole Vite module
// graph (framework + a2ui + site) PLUS every collected task tree/result for ~190 file×engine runs, and
// that footprint OUTGREW the raised 8 GB ceiling as the suite grew — two crash specimens on 2026-07-19
// carried the plain "Ineffective mark-compacts near heap limit" signature and ZERO "Unknown event" lines,
// retiring #22-era theory that an a2ui-live fetch-interception error cascade was the dominant driver (no
// raw \`fetch =\` assignment exists in site/ or a2ui today; command-palette's stub is per-test scoped). The
// durable fix is STRUCTURAL, not a bigger number: \`npm run test:browser\` now runs the three projects as
// SEQUENTIAL SHARDS (packages → site → focus-timing → visual), each its own process whose peak sits far under node's
// default ceiling — the crash class is gone regardless of future suite growth, and no NODE_OPTIONS
// override is needed. Do not re-monolith the script or re-add a ceiling bump; if a single SHARD ever
// approaches the default ceiling, split that project further instead. Known cost: full-shard concurrency
// surfaces a focus/timing flake class in ~6 interaction files (each passes solo — GH #56 tracks granting
// those files isolation or hardening them).
//
// SECOND SPLIT (2026-07-19, vision-rev.5 wave): the \`packages\` shard itself crossed the ceiling —
// measured exit 134 ("Ineffective mark-compacts near heap limit") on origin/main @ 38a46a5 BEFORE the
// rev.5 diff (the admin PR streak #64–#78 only ever ran filtered suites, so the growth went unmeasured).
// Per this file's own law the SCRIPT split again: \`test:browser:packages\` now runs
// \`:components\` (packages/agent-ui/components — 71 of the 85 browser files) then \`:rest\` (everything
// else via \`--exclude 'packages/agent-ui/components/**'\` — complementary BY CONSTRUCTION, a new package's
// browser tests land in \`:rest\` automatically, nothing silently drops). Same one-project config here;
// only package.json's invocation sharding changed. THIRD SPLIT (same day): \`:rest\` itself flipped 134
// under load once the M5 super-shell wave grew the app package — \`:app\` (packages/agent-ui/app) now runs
// alone and \`:rest\` excludes components+app (still complementary by construction via --exclude).
//
// FOURTH FIX (2026-07-20, GH #87): the THIRD SPLIT's \`:rest\` invocation
// (\`vitest run --project packages --exclude 'packages/agent-ui/components/**' --exclude
// 'packages/agent-ui/app/**'\`) never actually excluded anything — verified with \`-t
// '____no_such_test____' --reporter=verbose\`, which still listed every \`components/\` and \`app/\` file.
// Vitest 4.1's CLI \`--exclude\` sets ROOT-level \`test.exclude\`; each \`projects[]\` entry here declares its
// OWN \`test.exclude\` (even under \`extends: true\`), and the project's own array WINS outright rather than
// merging with the CLI-supplied one — so \`:rest\` was silently running the full ~85-file \`packages\`
// project (components + app + everything else) every time, the exact unsharded scale the SECOND SPLIT
// existed to avoid. That — not the a2ui-live e2e's screenshot-timeout cascade the crash log seemed to
// implicate (screenshot timeouts precede failures fleet-wide under heap pressure; they are a symptom of
// the OOM, not its cause) — is why \`:rest\` OOM'd. Positional directory arguments (as \`:components\` and
// \`:app\` already use) DO scope correctly — verified the same way — so the fix moves \`:rest\`'s exclusion
// into the config, the one place proven to actually filter, as its own \`packages-rest\` project below,
// and \`:rest\`'s package.json invocation now just selects that project (no more CLI \`--exclude\`, nothing
// to silently no-op).

// GH #56 — the named, closed set of files pulled out of \`packages\`/\`site\` into the \`focus-timing\` project
// below. Absolute repo-relative paths (not globs) so they match EXACTLY these files, never a same-named
// file added later elsewhere; append here (never edit the individual file's own test code first) when a
// new focus/keyboard/scroll-timing leg joins the flaky-under-concurrency class.
//
// GH #87 addendum (2026-07-20): \`markdown.browser.test.ts\`'s forced-colors token-degrade leg joined this
// class once \`packages-rest\` started running its OWN correctly-scoped ~6-file group — it timed out on
// \`toMatchScreenshot\` under that shard's concurrency twice in a row (measured), then passed 3/3 solo on
// both engines. Same signature as the rest of this list: a screenshot-capture race under concurrent-page
// load, not a component regression — this is very likely the "screenshot-timeout cascade" the GH #87
// crash log itself flagged, previously indistinguishable from the OOM it rode alongside.
const FOCUS_TIMING_FILES = [
  // GH #170 (2026-07-20) — the shell-responsive suite's AC16 legs assert document.activeElement after an
  // overlay open/close (focus moves to the pane, returns to the toggle); the same concurrent-page focus-
  // contention class — passes solo, races when a sibling shard steals focus.
  'packages/agent-ui/app/src/controls/super-shell/super-shell-responsive.browser.test.ts',
  'packages/agent-ui/code/src/editor/editor.browser.test.ts',
  'packages/agent-ui/code/src/markdown/markdown.browser.test.ts',
  'packages/agent-ui/components/src/controls/swiper/swiper.browser.test.ts',
  'packages/agent-ui/components/src/controls/textarea/textarea.browser.test.ts',
  // code-entry-control.lld.md (GH #490 S2-a) — the focus-order probe asserts document.activeElement after
  // real Tab/refocus (one tab stop, active-cell parking) — the SAME concurrent-page focus-contention class
  // as every other file in this list; added at build time per the LLD's own §11 instruction, not found flaky.
  'packages/agent-ui/components/src/controls/otp-field/otp-field.browser.test.ts',
  // 2026-07-20 append (the GH #56 one-line-append law): the real-timer pause-on-hover leg timed out
  // repeatedly across the day's PR gate runs whenever a SIBLING worktree's suite ran concurrently on the
  // same machine (measured at least 3 independent runs), then passed solo every time (20/20 both engines)
  // — the class signature exactly (real-duration wall-clock timing under concurrent-page contention, not
  // a component regression).
  'packages/agent-ui/components/src/controls/toast/toast.browser.test.ts',
  'packages/agent-ui/components/src/controls/toolbar/toolbar.browser.test.ts',
  'packages/agent-ui/components/src/controls/tooltip/tooltip.browser.test.ts',
  'site/pages/a2ui-chat.browser.test.ts',
  // 2026-07-20 append: both timed out under shard contention in PR #175's independent-reviewer gate run
  // (the PR's own body flagged them as GH #56-class candidates) and in multiple other same-day gate runs;
  // both pass solo every time. command-palette drives real mod+K focus + typed narrowing; adr-index
  // drives a real click-to-focus + real keystrokes into the dogfooded ui-text-field — real-input
  // focus/timing races under concurrent-page load, the class this project exists for.
  'site/lib/command-palette.browser.test.ts',
  'site/pages/adr-index.browser.test.ts',
  // 2026-07-25 append (GH #262): the SPEC-R6 live-theme-bridge leg flips the site's OWN real header
  // scheme control (Auto->Light->Dark) and waits on a real postMessage round trip back through a
  // page-mounted, opaque-origin \`ui-sandbox-frame\` — that render/handshake settle races past its
  // \`waitFor\` budget ONLY under full \`test:browser:site\` shard concurrency (two independent review
  // passes measured the timeout; passes 100% solo every time). The class signature exactly — a real
  // page working correctly, flaking under concurrent-page focus/render contention, not a defect. The
  // theme-flip leg reads the surface card the file's earlier containment leg mounts (shared module
  // state), so the whole file — not one describe block — takes the isolation.
  'site/pages/gen-ui-live.browser.test.ts',
  // 2026-08-05 append (GH #461, MA-3) — the SAME click-to-focus-a-top-layer-panel shape as
  // command-palette.browser.test.ts/adr-index.browser.test.ts just above: \`clickStatusFacet\` opens a
  // \`ui-form-popover\` trigger (Popover API, a JS positioning controller settle) before clicking a facet
  // checkbox inside its panel. Passes 20/20 solo both engines; reproduced failing ONLY under full
  // \`test:browser:site\` shard concurrency — a Chromium trigger-click timeout in
  // \`workbench — SPEC-R7\`'s \`clickStatusFacet\` call, cascading into a WebKit whole-test timeout and a
  // stale-state SPEC-R9 assertion (the SAME test's own cleanup never running past its timeout). The class
  // signature exactly — a real page working correctly, flaking under concurrent-page focus/render
  // contention, not a defect.
  'site/pages/workbench.browser.test.ts',
  // 2026-08-06 append (GH #499, M-F) — the SAME class as the workbench.browser.test.ts append just above,
  // reproduced the identical way: passes 12/12 solo both engines every time (verified via \`git stash\` +
  // a solo run to rule out this being caused by the new page's own content), fails ONLY under full
  // \`test:browser:site\` shard concurrency — a real \`userEvent.click\` on the \`ui-segmented-control\`
  // priority filter (\`Urgent narrows...\` test) either times out or resolves late enough that its effect
  // bleeds into the NEXT test's read (a stale-filter \`tbody\` row count in the sortable-header test right
  // after it, the SAME "cleanup never running past its timeout" shape workbench's own append names).
  // Raising the per-test timeout (GH #347's REAL-TIMING HEADROOM class) was tried first and did NOT fix
  // it — confirming this is the concurrent-page focus/render contention class, not raw slowness, so it
  // takes THIS remedy (isolation) rather than that one.
  'site/pages/dashboard.browser.test.ts',
]

// ─── REAL-TIMING HEADROOM (GH #347) ────────────────────────────────────────────────────────────────
// NO CODE LIVES HERE ON PURPOSE. This is the canonical rationale for a per-FILE timeout raise that each
// member declares in its own source (\`vi.setConfig({ testTimeout: 30_000 })\` at module scope, tagged
// \`GH #347\`). \`grep -rn 'GH #347' site packages\` lists the class's exact current membership; adding a
// member is that one line in the new file, with NO edit to this config.
// SCOPE NOTE: this covers the per-TEST bound only. HOOKS are untouched, deliberately — browser mode
// already resolves \`hookTimeout\` to 30000ms by default (vitest's own \`resolved.hookTimeout ??=
// resolved.browser.enabled ? 3e4 : 1e4\`, and this repo sets no override), so declaring it here would be
// a no-op dressed as a remedy. A hook that needs MORE than 30s must say so itself, above that number.
//
// THE DEFECT. GH #347: \`test:browser:site\` fails a DIFFERENT, non-overlapping set of files on each
// full-sweep run, and every failing file passes solo. Its investigation comment (2026-07-28) ran three
// independent trials with zero file overlap between any pair, reproduced it only under genuinely
// concurrent shard execution (three plain sequential replays came back clean), and captured one real
// failure: \`Test timed out in 15000ms\` in \`site/pages/agent-admin-app-scroll.browser.test.ts\`. It also
// observed an unrelated worktree's vitest workers running on the same machine at that moment — load this
// repo's own shard sequencing can neither see nor control.
//
// WHY NOT GH #56's REMEDY. That list above is a CLOSED set with one identified mechanism (OS-level
// document focus, which only one page can hold). #347's set is OPEN: the failing identity keeps moving,
// so naming today's observed files would just surface an unnamed one next time. The cause is a resource
// budget, not an interaction between specific files.
//
// THE CLASS, BY MECHANISM (not by observed failure). A file belongs if any of its tests AWAIT something
// whose completion time is set by the browser's own scheduling rather than by a synchronous read: an
// awaited rAF/frame settle · a real-duration \`setTimeout\` wait · a retry poll (\`waitFor\`/\`expect.poll\`) ·
// observer delivery · animation/transition completion · a real-input or viewport driver round trip to the
// Playwright server · a mid-test dynamic \`import()\` of a page module. Each of those stretches with host
// load; a test built out of them can therefore cross a fixed bound while asserting nothing different.
// DELIBERATELY EXCLUDED: synchronous layout reads (\`getBoundingClientRect\`, \`getComputedStyle\`, a
// \`scrollTop\` write). They force a reflow but do not wait on the scheduler, so they do not stretch — and
// including them would have swept ~90 of the 112 browser files in, i.e. a global raise wearing a costume.
// Six \`site\` files carry no such await and deliberately KEEP the 15s bound (theme-pack-apply,
// theme-provider-build, _page-scheme, a2ui-live — it awaits only \`updateComplete\`, a microtask —
// text-field-permutations, tokens); they are the standing proof that this raise stayed scoped.
// OUT OF SCOPE BY PROJECT, not by mechanism: four \`site\` files qualify but live in \`focus-timing\`
// (a2ui-chat, adr-index, command-palette, gen-ui-live) and two in \`visual\` (\`*.visual.browser.test.ts\`).
// Both projects already carry their own remedy — zero file parallelism above, and the visual block's own
// raised \`toMatchScreenshot\` timeout below — so they were left alone rather than given a second one.
//
// WHY NOT A GLOBAL RAISE (Kim's ruling, 2026-07-29). A blanket raise makes every genuine hang take twice
// as long to surface in suites with no timing dependency at all. Kim accepted that cost for this class
// only. Kim also explicitly REJECTED the investigation's other candidate — capping \`site\`'s
// \`fileParallelism\` — because it slows a standing gate everyone runs.
//
// WHAT WAS MEASURED HERE, not assumed (2026-07-29, both engines):
//   · vitest browser mode's default per-test bound is 15000ms — a 20s stall with no headroom failed with
//     exactly \`Test timed out in 15000ms\`, the captured #347 signature.
//   · \`vi.setConfig\` at module scope does raise it: the same 20s stall passed at 30_000ms.
//   · The raise is genuinely per-file: both ran in the SAME \`site\` project in the SAME run, and the file
//     without the call still failed at 15000ms.
// WHY 30_000 (2× the default), derived rather than picked: \`agent-admin-app-scroll\`'s single test was
// measured at 485-712ms solo, 1728-1751ms inside a full \`site\` shard here, and 2458ms in-shard on a
// reviewer's machine — that 5× spread across idle runs IS the load sensitivity this raise exists for.
// #347 saw it cross 15000ms, which against the SLOWEST of those baselines still implies a ~6× slowdown;
// 30_000 tolerates ~12×. (A timeout only proves the test exceeded the bound, never by how much — the
// multiplier comes from the baseline, not from the failure.)
// A genuine hang in a member file still surfaces in 30s. Before "cleaning up" a 30s timeout here: it is
// load-tolerance for a reproduced, open-set contention defect, not a slow test.
// ───────────────────────────────────────────────────────────────────────────────────────────────────

// GH #204 — update-mode's own gap: \`toMatchScreenshot\`'s stability loop (inside \`@vitest/browser\`) seeds
// its "is the page done rendering" comparison with the STALE reference as the first baseline, using this
// SAME \`comparatorOptions\`. When a fresh capture already falls within \`allowedMismatchedPixelRatio\` of
// that stale reference on its very first attempt, the loop calls it "stable" at \`retries === 0\` and
// short-circuits straight to a pass — the real reference-vs-screenshot comparator (the one that would
// gate \`--update\`'s rewrite) never runs at all, so \`updateSnapshot === "all"\` never gets a chance to fire.
// A real, sub-tolerance rendered change (e.g. a footer text edit under ~1% of pixels) therefore survives
// \`test:visual:update\` untouched — reproduced concretely (GH #204) and confirmed against this exact
// mechanism by reading \`determineOutcome\`/\`getStableScreenshot\` in \`@vitest/browser/dist/index.js\`.
// The 1% tolerance is correct for the CHECK direction (anti-flake across machines/font-rendering runs);
// the gap is only that UPDATE mode inherits the same number. Fix: in update mode the ratio drops to 0, so
// ANY pixel delta (down to sub-tolerance) forces the stability loop past its first attempt and into the
// real comparator, which then always finds a mismatch and rewrites. Two back-to-back captures of the
// SAME already-rendered, non-animating page are pixel-identical in headless Chromium, so a real "nothing
// changed" run still settles immediately and writes nothing new — only a genuine change (of any size)
// causes a rewrite. Detected from the CLI flag itself (\`test:visual:update\`'s own \`--update\`), not an env
// var, so the two npm scripts stay the only two switches.
const isUpdatingVisualBaselines = process.argv.includes('--update') || process.argv.includes('-u')

export default defineConfig({
  test: {
    // Teardown force-kill window. The default 10s manifested as a ~10s "close timed out after 10000ms /
    // something prevents the main process from exiting" hang on every standalone \`test:visual\` run — a
    // generic dangling node handle AFTER the browsers close, NOT the WebKit shell (measured 2026-07-08:
    // the hang persisted chromium-only; 1s teardown was clean; full \`test:browser\` never hangs). 2s
    // leaves headroom over the measured-fine 1s.
    teardownTimeout: 2000,
    // "ResizeObserver loop completed with undelivered notifications." is the SPEC'S OWN benign signal —
    // an observed element resized again in the same frame the callback ran (ui-agent-admin's rev.5 shell:
    // the RO callback reparents content whose open Context accordions change the shell's own height), so
    // delivery defers to the NEXT frame and layout settles there. Real browsers surface it as a window
    // error but explicitly non-fatal (WHATWG resize-observer §3.1 "loop limit"); vitest's error-catcher
    // would otherwise fail whatever test happens to be running. Filter EXACTLY this message — every other
    // unhandled error stays fatal.
    onUnhandledError(error: unknown): boolean | void {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('ResizeObserver loop completed with undelivered notifications')) return false
    },
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      // The fleet default viewport, now EXPLICIT (it was vitest's own 414×896 default, silently). Made a
      // documented contract by ADR-0150: 414px sits BELOW the 52.5rem/840px compact-window body line, so at
      // this default every document-typography assertion sees the COMPACT body register (13/15/11px), not
      // the M3-verbatim base (14/16/12px). Any browser test pinning an absolute body-role px MUST pin its
      // viewport to the intended side of the line first (text.browser.test.ts is the worked example — its
      // file-level beforeAll pins 1024×768 for the M3-base legs, one describe drops to 800×600 for the
      // compact legs). Interaction suites that assert no body-role px run here unchanged.
      viewport: { width: 414, height: 896 },
      instances: [{ browser: 'chromium' }, { browser: 'webkit' }],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'packages',
          include: ['packages/agent-ui/*/src/**/*.browser.test.ts'],
          // *.visual.browser.test.ts ends with .browser.test.ts too (glob \`*\` crosses \`.\`) — exclude it
          // explicitly so a visual file is routed to the \`visual\` project ONLY, never double-run here.
          // GH #56's known flaky-under-concurrency files are ALSO excluded here — routed instead to the
          // \`focus-timing\` project below, which runs them with zero file parallelism.
          //
          // This project stays the full (components + app + rest) superset — \`:components\` and \`:app\`
          // filter it down via a positional directory ARGUMENT at invocation (proven to scope correctly,
          // GH #87), not a project-level exclude. \`:rest\` used to filter the SAME way via CLI \`--exclude\`
          // flags, which silently do nothing against a project that declares its own \`test.exclude\` (GH
          // #87) — it now runs the dedicated \`packages-rest\` project below instead, which excludes
          // components/app at the config level where filtering actually works.
          exclude: ['**/*.visual.browser.test.ts', ...FOCUS_TIMING_FILES],
        },
      },
      {
        // GH #87 — \`packages\` minus components/app, realized as its OWN project (not a CLI \`--exclude\`
        // against the \`packages\` project above, which vitest 4.1 silently ignores: a project's own
        // declared \`test.exclude\` wins outright over anything the CLI supplies, verified with
        // \`-t '____no_such_test____' --reporter=verbose\` showing every components/app file still
        // collected). Complementary BY CONSTRUCTION exactly like the old CLI-flag intent claimed to be —
        // a new package's browser tests land here automatically — except now it's actually true.
        extends: true,
        test: {
          name: 'packages-rest',
          include: ['packages/agent-ui/*/src/**/*.browser.test.ts'],
          exclude: [
            '**/*.visual.browser.test.ts',
            ...FOCUS_TIMING_FILES,
            'packages/agent-ui/components/**',
            'packages/agent-ui/app/**',
          ],
        },
      },
      {
        extends: true,
        test: {
          name: 'site',
          include: ['site/**/*.browser.test.ts'],
          exclude: ['**/*.visual.browser.test.ts', ...FOCUS_TIMING_FILES],
        },
      },
      {
        // GH #56 — a stable CLASS of focus/keyboard/scroll-timing interaction legs (editor mode-toggle
        // keydown, swiper keyboard-scroll, textarea focus-vs-filled, toolbar roving Tab, tooltip focusin,
        // a2ui-chat tail-follow scroll) flake ONLY under full-project-shard concurrency — every one passes
        // 100% solo (verified 2026-07-19, both engines). Root cause: multiple Playwright pages/iframes
        // sharing OS-level document focus while running concurrently within the SAME \`packages\`/\`site\`
        // project — a real document can only be focused ONE page at a time, so a \`:focus\`/\`:focus-visible\`
        // assertion in one file can observe another concurrently-running file's page stealing focus.
        // FIX: pull exactly these files into their OWN project with \`fileParallelism: false\` (serial
        // within this project — each file still runs BOTH engines, but never beside a SIBLING file from
        // this list) while \`packages\`/\`site\` keep full concurrency for everything else. A future flaky
        // addition to this class is a one-line append to \`FOCUS_TIMING_FILES\` below, not a per-file fix.
        extends: true,
        test: {
          name: 'focus-timing',
          include: FOCUS_TIMING_FILES,
          fileParallelism: false,
        },
      },
      {
        // \`extends: false\` — the ONE project that does NOT inherit the root browser block. Under
        // \`extends: true\` the parent's \`instances\` array CONCATENATES (re-pinning chromium collides:
        // "Cannot define a nested project for a chromium browser … already defined", verified against
        // the installed vitest 4.1.9 merge), so the first realization carried BOTH engines and skipIf'd
        // WebKit — 4 phantom skips per run. Standalone duplication of the browser block with a
        // chromium-only instance eliminates the WebKit shell and the skips outright (measured
        // 2026-07-08); \`it.skipIf(server.browser !== 'chromium')\` in the visual legs stays as a cheap
        // belt-and-braces guard. COST: edits to the ROOT browser block do not propagate here — keep the
        // enabled/provider/headless trio in sync by hand.
        extends: false,
        test: {
          name: 'visual',
          include: ['**/*.visual.browser.test.ts'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: 'chromium' }],
            // The fleet's default viewport (414×896, a mobile-sized default meant for the interaction
            // suites) clips a wide/stretched fixture's screenshot before the layout does — a real capture
            // constraint, not a CSS bug (verified: the SAME 600px \`mountStretched\` helper's
            // \`getBoundingClientRect()\` assertions pass fine at the default viewport in
            // calendar.browser.test.ts; only the PIXEL CAPTURE was truncated to ~483px). Visual legs get
            // a wider viewport so a wide-panel gestalt captures whole.
            viewport: { width: 900, height: 900 },
            // Chromium-only pixel truth (Decision 2) — realized as the \`extends: false\` chromium-only
            // instance above (see the project-level comment for the instances-concat history). WebKit
            // keeps the computed-style/whole-shape legs as its sanctioned proof.
            expect: {
              toMatchScreenshot: {
                comparatorName: 'pixelmatch',
                comparatorOptions: {
                  includeAA: false,
                  threshold: 0.1,
                  // GH #204 — 0 under \`--update\` (rewrite on ANY delta), 0.01 otherwise (the CHECK
                  // direction's anti-flake tolerance, unchanged). See the \`isUpdatingVisualBaselines\`
                  // comment above for the mechanism this closes.
                  allowedMismatchedPixelRatio: isUpdatingVisualBaselines ? 0 : 0.01,
                },
                // The full \`npm run test:browser\` gate (Decision 8) runs ALL THREE projects × both
                // engines concurrently — real CPU contention that the standalone \`test:visual\` run never
                // sees. The bundled comparator's retry-until-stable capture needs more than its 5s
                // default under that load (observed: "Could not capture a stable screenshot within
                // 5000ms" on an otherwise-passing leg, reproduced twice under \`test:browser\`, never under
                // isolated \`test:visual\`) — raised, not the pixel tolerance.
                timeout: 20_000,
                // ADR-0110 — pins committed pixel baselines to a co-located, TRACKED \`__baselines__/\`
                // folder (vs. the default \`__screenshots__/\`, which \`.gitignore\` blankets as on-failure
                // debris). Only the REFERENCE image path moves; \`resolveDiffPath\` stays the vitest
                // default (\`.vitest-attachments/\`, already gitignored) — committed truth and run debris
                // never share a folder (Decision 3).
                resolveScreenshotPath: ({ root, testFileDirectory, testFileName, arg, browserName, platform, ext }) =>
                  resolve(root, testFileDirectory, '__baselines__', testFileName, \`\${arg}-\${browserName}-\${platform}\${ext}\`),
              },
            },
          },
        },
      },
    ],
  },
})
`;function m(e,t){return e.split(`
`).slice(0,t).map(e=>e.replace(/^\/\/ ?/,``)).join(`
`)}function h(e,t){let n=`export interface ${t} {`,r=e.indexOf(n);if(r===-1)throw Error(`testing-guide: interface "${t}" not found — renamed or removed?`);let i=e.lastIndexOf(`/**`,r),a=0,o=r;for(;o<e.length;o++)if(e[o]===`{`)a++;else if(e[o]===`}`&&(a--,a===0)){o++;break}return e.slice(i===-1?r:i,o).trim()}function g(e,t){let n=`export function ${t}(`,r=e.indexOf(n);if(r===-1)throw Error(`testing-guide: function "${t}" not found — renamed or removed?`);let i=e.lastIndexOf(`/**`,r),a=e.indexOf(`{`,r);return e.slice(i===-1?r:i,a).trim()}function _(e){let t=[...e.matchAll(/name:\s*'([\w-]+)'/g)].map(e=>e[1]);if(t.length===0)throw Error(`testing-guide: 0 vitest project names found — config shape changed?`);return t}function v(e){let t=e.indexOf(`const FOCUS_TIMING_FILES = [`);if(t===-1)throw Error(`testing-guide: FOCUS_TIMING_FILES marker not found — renamed or removed?`);let n=0,r=t+28-1;for(;r<e.length;r++)if(e[r]===`[`)n++;else if(e[r]===`]`&&(n--,n===0)){r++;break}return e.slice(t,r).split(`
`).filter(e=>/^\s*'[^']+',?\s*$/.test(e)).length}function y(...e){let t=document.createElement(`p`);for(let n of e)t.append(typeof n==`string`?document.createTextNode(n):n);return t}function b(e){let t=document.createElement(`code`);return t.textContent=e,t}function x(e,t){let n=document.createElement(`a`);return n.href=e,n.textContent=t,n}function S(e){let t=document.createElement(`ul`);for(let n of e){let e=document.createElement(`li`);e.append(n),t.append(e)}return t}var{content:C}=e({title:`Testing guide`,intro:"How to test code that mounts agent-ui controls: the two-layer harness (jsdom fast-loop vs. real-engine browser truth), the shared jsdom `<dialog>` stub every modal-surface control needs, when jsdom is not enough, and the ElementInternals/ARIA assertion idiom FACE controls require."});C.append(t(`agent-ui wires ARIA through `,b(`ElementInternals`),` rather than host attributes, and its modal surfaces (`,b(`ui-modal`),` / `,b(`ui-drawer`),` / `,b(`ui-command-modal`),`) sit on a real `,b(`<dialog>`),`. Both of those choices mean jsdom — absent a small, shared stub — cannot fully exercise a page that mounts them. This page is that stub, plus the rest of the harness this repo’s own test suite runs, documented for a consumer testing their OWN code against the fleet.`)),C.append(r(2,`The harness at a glance`)),C.append(y(`Read straight from the workspace root’s own `,b(`package.json`),` `,b(`scripts`),` map — a script renamed, added, or removed there updates this table with zero edits to this page.`));{let e=JSON.parse(l),t=Object.entries(e.scripts).filter(([e])=>e===`test`||e.startsWith(`test:`));if(t.length===0)throw Error(`testing-guide: 0 "test"/"test:*" npm scripts found in package.json`);let n=document.createElement(`table`);n.append(o(`npm run …`,`Runs`));let r=document.createElement(`tbody`);for(let[e,n]of t)r.append(a(s(e),i(n)));n.append(r),C.append(n)}C.append(c(`p`,{class:`gs-note`},[document.createTextNode(`Two SEPARATE vitest configs back this table: vitest.config.ts (jsdom, the "test"/"test:watch" rows — the fast inner loop) and vitest.browser.config.ts (real Chromium + WebKit via Playwright, every "test:browser:*"/"test:visual*" row). Both sections below read straight from those two files.`)])),C.append(r(2,`jsdom — the fast inner loop`)),C.append(y(`Verbatim from `,b(`vitest.config.ts`),`’s own banner comment:`)),C.append(n(m(f,8)));{let e=_(f);C.append(y(`${e.length} vitest projects share that one jsdom environment today (`,b(e.join(`, `)),`), split by WHAT they test — the framework’s own suites, the docs site’s, plain-Node CLI scripts, and the site’s Worker-side tools — never by consumer vs. framework code. A consumer’s own test suite is exactly this shape: plain jsdom, no special config, run through the plain vitest CLI.`))}C.append(y(`A minimal example — mounting a real control and asserting on it, the same shape every `,b(`*.test.ts`),` file in this repo opens with (illustrative — the props-and-events probes in `,x(`./checkbox-doc.html`,`ui-checkbox`),`’s own suite are the fuller reference):`)),C.append(n([`import { describe, it, expect } from 'vitest'`,`import '@agent-ui/components/components' // registers ui-button (and every other ui-*)`,``,`describe('my app renders a save button', () => {`,`  it('mounts and reflects its label', () => {`,`    const button = document.createElement('ui-button')`,`    button.setAttribute('variant', 'solid')`,`    button.textContent = 'Save'`,`    document.body.append(button)`,``,`    expect(button.textContent).toBe('Save')`,`    expect(button.getAttribute('variant')).toBe('solid')`,`  })`,`})`].join(`
`),`ts`)),C.append(r(2,`The dialog polyfill — @agent-ui/shared/testing/dialog-polyfill`));{let e=JSON.parse(u),t=Object.entries(e.exports).filter(([e])=>e.startsWith(`./testing/`));if(t.length===0)throw Error(`testing-guide: 0 "./testing/*" exports found in @agent-ui/shared/package.json`);let n=document.createElement(`table`);n.append(o(`Subpath`,`Source`));let r=document.createElement(`tbody`);for(let[e,n]of t)r.append(a(s(`@agent-ui/shared${e.slice(1)}`),s(n.replace(/^\.\//,``))));n.append(r),C.append(n)}C.append(y(`Verbatim from the module’s own header comment — why it exists:`)),C.append(n(m(d,17))),C.append(r(3,`The API — derived from source`)),C.append(n(h(d,`DialogCalls`),`ts`)),C.append(n(g(d,`installDialogPolyfill`),`ts`)),C.append(n(g(d,`dialogCallsOf`),`ts`)),C.append(y(`Usage (illustrative — mirrors the real call at `,b(`packages/agent-ui/components/src/controls/modal/modal.test.ts:21-23`),`):`)),C.append(n([`import { describe, it, expect, beforeAll } from 'vitest'`,`import { installDialogPolyfill, dialogCallsOf } from '@agent-ui/shared/testing/dialog-polyfill'`,``,`beforeAll(() => {`,`  installDialogPolyfill() // no-op under a real engine — safe to call unconditionally`,`})`].join(`
`),`ts`)),C.append(y(`Needed by any jsdom suite driving a control that opens a real `,b(`<dialog>`),` — `,x(`./modal-doc.html`,`ui-modal`),` · `,x(`./drawer-doc.html`,`ui-drawer`),` · `,x(`./command-modal-doc.html`,`ui-command-modal`),` — or any page/composition that mounts one. Repo-wide consumers today (grepped 2026-08-17, no build-time "who imports this test-only module" derivation exists for a page Vite bundles):`)),C.append(S([y(b(`packages/agent-ui/components/src/controls/modal/modal.test.ts`)),y(b(`packages/agent-ui/components/src/controls/drawer/drawer.test.ts`)),y(b(`packages/agent-ui/components/src/controls/command-modal/command-modal.test.ts`)),y(b(`packages/agent-ui/app/src/controls/agent-admin/agent-admin.test.ts`),` and `,b(`agent-admin-authoring.test.ts`)),y(b(`site/lib/command-palette.test.ts`)),y(b(`site/pages/agent-admin-app.test.ts`),` and `,b(`agent-admin-app-drawer.test.ts`))])),C.append(y(`It never proves the REAL top-layer / focus-trap / Escape / backdrop behaviour — that stays the job of each control’s own `,b(`*.browser.test.ts`),` leg, next.`)),C.append(r(2,`When jsdom isn’t enough — the real-engine browser harness`)),C.append(y(`jsdom computes no real layout, has no `,b(`@scope`),` or `,b(`light-dark()`),` resolution, no real focus/keyboard timing, and no accessibility tree — a control’s per-part checks can all pass in jsdom while the rendered geometry, computed colour, or AX role is wrong. The full layer-by-layer bar (what each layer proves, which exemplar to pattern from) is this repo’s own `,b(`.claude/skills/component-testing/SKILL.md`),` — cited here rather than restated, since it is internal contributor guidance this page is not the owner of.`));{let e=_(p),t=v(p);C.append(y(`The real-engine config (`,b(`vitest.browser.config.ts`),`) splits into ${e.length} vitest projects today (`,b(e.join(`, `)),`), run as sequential shards (`,b(`npm run test:browser`),`, the table above) so no single process holds the whole module graph at once — never re-monolithed, per that config’s own load-bearing HEAP comment. One of those, `,b(`focus-timing`),`, runs with ZERO file parallelism: ${t} files today (a live count, read the same way as every other derived fact on this page) whose focus/keyboard/scroll-timing assertions flake under concurrent-page contention, not under a component regression.`))}C.append(y(`A control-touching suite of your own that asserts real rendered geometry, real focus movement, or a real accessibility role belongs in a `,b(`.browser.test.ts`),` file, run through `,b(`npm run test:browser`),` (or your own equivalent real-engine harness) — never simulated in jsdom.`)),C.append(r(2,`The ElementInternals / ARIA assertion idiom`)),C.append(y(`Every FACE control wires ARIA through a protected `,b(`internals`),` getter on the shared base class (`,b(`packages/agent-ui/components/src/dom/element.ts:285`),`) — never a host `,b(`role`),`/`,b(`aria-*`),` attribute. That is correct at runtime (the AX tree reads it either way) but means a jsdom assertion that only checks host attributes will find nothing: there is nothing there to find, by design.`)),C.append(y(`To assert on it in jsdom, reach the protected field with a small probe subclass (illustrative — the real pattern this is lifted from: `,b(`packages/agent-ui/components/src/controls/checkbox/checkbox.test.ts:33-41,94-100`),`):`)),C.append(n([`import { describe, it, expect } from 'vitest'`,`import { UIButtonElement } from '@agent-ui/components/controls/button'`,``,`class ProbeButton extends UIButtonElement {`,"  /** Re-expose the protected `internals` so a probe can read role / aria-* state. */",`  get probeInternals(): ElementInternals {`,`    return this.internals`,`  }`,`}`,`customElements.define('ui-button-probe', ProbeButton)`,``,`describe('my button carries the right accessible role', () => {`,`  it('exposes role via internals, never a host attribute', () => {`,`    const el = new ProbeButton()`,`    document.body.append(el)`,``,`    expect(el.probeInternals.role).toBe('button')`,`    expect(el.getAttribute('role')).toBeNull() // FACE — ARIA via internals only`,`  })`,`})`].join(`
`),`ts`)),C.append(y(`jsdom’s `,b(`ElementInternals`),` surface is itself partial — form-association methods (`,b(`setFormValue`),` / `,b(`setValidity`),`) are absent, the same gap the dialog surface has, each control’s own suite stubs the same way (`,b(`checkbox.test.ts`),`’s `,b(`stubFormAssoc`),`). The real, full `,b(`ElementInternals`),` contract — and the real computed AX role a screen reader sees — is only ever true in the browser harness above.`));