import { defineConfig, configDefaults } from 'vitest/config'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

// The `@agent-ui/components/*` jsdom aliases, one per `exports` key except `.` (see `resolve.alias` below).
const COMPONENTS_DIR = './packages/agent-ui/components/'
const componentsExports = (
  JSON.parse(readFileSync(r(`${COMPONENTS_DIR}package.json`), 'utf8')) as { exports: Record<string, string> }
).exports
const componentsSubpathAliases: Record<string, string> = Object.fromEntries(
  Object.entries(componentsExports)
    .filter(([key]) => key !== '.')
    .map(([key, target]) => [`@agent-ui/components${key.slice(1)}`, r(`${COMPONENTS_DIR}${target.slice(2)}`)]),
)

// Vitest is the behaviour runner; `tsc` (npm run check) stays the type gate.
// jsdom is the fast inner loop, split into two vitest PROJECTS (the `test.projects` array — vitest 4's inline
// replacement for the deprecated `vitest.workspace.ts`): `packages` (the framework's own *.test.ts) and `site`
// (the docs-site's own *.test.ts, e.g. site/lib/adr.ts). Both `extends: true` off this root config, inheriting
// the jsdom environment + the resolve aliases below. The browser-truth layer (@vitest/browser + Playwright, for
// @scope / light-dark() / real focus / computed geometry / the AX tree) is a SEPARATE config —
// `vitest.browser.config.ts` / `npm run test:browser` (G5), itself split the same way. The `*.browser.test.ts`
// glob is excluded from both jsdom projects so those real-engine tests never run under jsdom (where computed
// geometry isn't true). Workspace packages resolve via the aliases below.
// Worktree-aware worker cap (Kim ruling 2026-08-20, the load-108 postmortem): a run whose cwd sits
// under an agent worktree (`.claude/worktrees/`) defaults to 4 workers — N parallel lanes at
// workers-per-core is exactly the N×cores thread explosion that saturated the host — while the
// primary checkout keeps vitest's full-speed default. An explicit VITEST_MAX_WORKERS env var wins
// over both (set it to a number, or leave unset for the location-based default).
const WORKER_CAP = process.env['VITEST_MAX_WORKERS']
  ? Number(process.env['VITEST_MAX_WORKERS'])
  : process.cwd().includes('/.claude/worktrees/')
    ? 4
    : undefined

export default defineConfig({
  test: {
    environment: 'jsdom',
    ...(WORKER_CAP ? { maxWorkers: WORKER_CAP, minWorkers: 1 } : {}),
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
          // runtime (e.g. `@cloudflare/vitest-pool-workers`), not this project; `worker/worker-bundle.test.ts`
          // is the module-load slice of that, evaluating the `wrangler deploy --dry-run` bundle in a child
          // process so the shim's global override never reaches this one. GH #335 widened it to
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
            // GH #1584 (genui-b3-judged-eval.lld.md LLD-C7 n7b) — the GenUI B3 judged-eval CLI's own
            // tests. Explicit, never a wildcard (the GH #112 rule this whole `tools` project already
            // documents above): a new leg's test file must land its OWN line here to be armed.
            'packages/agent-ui/a2ui/tools/corpus-genui/*.test.ts',
            // GH #1737 (the a2ui-basic corpus pipeline) - the Node-side catalog registry and the
            // compose-verify CLI's `--catalog` map. Exact files, not a directory glob, the same rule:
            // `validate-payload.ts` has NO CLI-entry guard (it runs `main()` on import), so its test
            // only ever spawns it and a wildcard here would arm any future importer of it by accident.
            'packages/agent-ui/a2ui/tools/catalog-files.test.ts',
            'packages/agent-ui/a2ui/tools/harness/validate-payload.test.ts',
            // GH #1810 - the agent-behavior eval CLI's own tests; `eval-agent-behavior.ts` carries the
            // CLI-entry guard, so importing `runCli` here is safe. Explicit, never a wildcard (GH #112).
            'packages/agent-ui/a2ui/tools/agent-eval/*.test.ts',
            // GH #1807 - the capability-registry loader and its committed-projection drift gate.
            // `generate.ts` carries the CLI-entry guard, so importing `projectionText` here never writes.
            // Explicit, never a wildcard (GH #112).
            'packages/agent-ui/a2ui/tools/registry/*.test.ts',
            // T-0011 - the A2UI test kit's Node-only tests (the loaders and the CLI); its jsdom legs live
            // under `a2ui/src/testkit/` in the `packages` project. `kit.ts` carries the CLI-entry guard
            // (`process.argv[1]?.endsWith('kit.ts')`), so importing `runCli` here is safe (GH #112).
            'packages/agent-ui/a2ui/tools/testkit/*.test.ts',
          ],
        },
      },
    ],
  },
  resolve: {
    alias: {
      // EXACT, `?url`-suffixed twin of one CSS subpath. No source in the repo carries a `?url` specifier for
      // this asset today (GH #278: the original consumer, `app-shell.ts`, left with `ui-app-shell`, ADR-0156);
      // kept rather than removed, because deleting live resolver config is a separate deliberate change. A
      // plain-string alias matches a whole path segment (`importee === find || importee.startsWith(find + '/')`),
      // so the broad `@agent-ui/components` alias below would otherwise take the specifier and mangle the
      // suffix; the replacement carries the same `?url` through for Vite's own asset-URL transform.
      '@agent-ui/components/foundation-styles.css?url': `${r('./packages/agent-ui/components/src/foundation-styles.css')}?url`,
      // Every other `@agent-ui/components/*` subpath, DERIVED at config load from the package `exports` map
      // (ADR-0233): one exact alias per key except `.`, mapped to its package-relative target. They sit BEFORE
      // the broad `@agent-ui/components` alias because that alias prefix-matches any subpath and mangles it
      // into a path segment after `index.ts`. A new subpath (a control added by
      // `node scripts/generate-controls.mjs`, or a hand-owned key) needs no edit here.
      ...componentsSubpathAliases,
      '@agent-ui/components': r('./packages/agent-ui/components/src/index.ts'),
      // GH #1006 — the shared jsdom `<dialog>` stub (`exports['./testing/dialog-polyfill']`), test-only. Placed
      // BEFORE the broad `@agent-ui/shared` entry for the same prefix-match reason as every subpath above.
      '@agent-ui/shared/testing/dialog-polyfill': r('./packages/agent-ui/shared/src/testing/dialog-polyfill.ts'),
      '@agent-ui/shared': r('./packages/agent-ui/shared/src/index.ts'),
      // The a2ui `./examples` subpath (the seed shelf, ADR-0055) — mirrors the package's exports map. Placed
      // BEFORE the broad `@agent-ui/a2ui` entry: a plain-string alias prefix-matches, so without this the
      // broad alias would rewrite `@agent-ui/a2ui/examples` to `.../src/index.ts/examples` (the same
      // subpath-ordering discipline the derived `@agent-ui/components/*` subpath aliases above rely on). Used by the site's
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
      // The a2ui `./agent/meta-line` subpath (ADR-0088's envelope + guard) — mirrors the package's exports
      // map, placed BEFORE the broader `./agent` entry for the same prefix-match reason as `genui-line`
      // above: this is the ZERO-DEP, browser-safe module. `@agent-ui/devtools` (ADR-0200) is its first
      // cross-package VALUE consumer (`readMetaLine`/`formatErrorLine` — the replay exhausted-idiom and
      // recordTurn's meta-vs-line routing) and must not drag in the Node-first `./agent` barrel
      // (system-prompt.ts/mini-skills.ts `readFileSync` at load).
      '@agent-ui/a2ui/agent/meta-line': r('./packages/agent-ui/a2ui/src/agent/meta-line.ts'),
      // The a2ui `./agent/agent-transport` subpath (ADR-0137's seam file, browser-safe pure types +
      // zero node imports) — mirrors the package's exports map, placed BEFORE the broader `./agent`
      // entry for the same prefix-match reason as `meta-line`/`genui-line` above. `@agent-ui/devtools`
      // (ADR-0200) type-imports the seam from HERE so a site page importing devtools (the harness page,
      // GH #1122 S4) never drags the Node-first `./agent` barrel into the site type program
      // (site/tsconfig.json deliberately carries no node types).
      '@agent-ui/a2ui/agent/agent-transport': r('./packages/agent-ui/a2ui/src/agent/agent-transport.ts'),
      '@agent-ui/a2ui/agent': r('./packages/agent-ui/a2ui/src/agent/index.ts'),
      // The a2ui `./registry` subpath (the capability registry, GH #1807), mirrors the package's exports map,
      // placed BEFORE the broad `@agent-ui/a2ui` entry for the same prefix-match reason as `./agent`. Pure and
      // browser-safe (no `node:*`): the docs site's Capability Registry page imports it directly.
      '@agent-ui/a2ui/registry': r('./packages/agent-ui/a2ui/src/registry/index.ts'),
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
      // @agent-ui/devtools (ADR-0200) — the dev/debug harness package. Subpath entries BEFORE the broad
      // entry (the same prefix-match ordering discipline as every subpath row above); mirrors the
      // package's exports map (`.` · `./server` · `./playwright`).
      '@agent-ui/devtools/server': r('./packages/agent-ui/devtools/src/server/index.ts'),
      '@agent-ui/devtools/playwright': r('./packages/agent-ui/devtools/src/playwright/index.ts'),
      '@agent-ui/devtools': r('./packages/agent-ui/devtools/src/index.ts'),
    },
  },
})
