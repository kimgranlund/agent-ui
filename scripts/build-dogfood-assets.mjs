// scripts/build-dogfood-assets.mjs — LLD-C1 (genui-dogfood.lld.md), GH #316/ADR-0162. Shells ONE real
// Vite (Rolldown) build of the docs-page load-bearing cascade — site/pages/_page.ts's own [1][2][3][3b]
// comment names the order verbatim: foundation CSS -> per-component CSS -> the self-defining ui-*
// controls -> the Phosphor icon pack — into a single-file, self-contained IIFE bundle + one flattened CSS
// text (`build.lib`, IIFE format, minified, `cssCodeSplit:false`), then emits the COMMITTED generated
// module `dogfood-assets.ts` (DOGFOOD_CSS/DOGFOOD_JS/DOGFOOD_TAGS + a measured-size header). Deliberately
// EXCLUDES the app/site chrome members of `_page.ts`'s own cascade ([3a] ui-nav-rail, [3c] ui-super-shell)
// — ADR-0162's Consequences: router/code/app-level chrome stay out of the dogfood set by construction
// (catalog-invisibility extends naturally; the dogfood set is the components fleet, not the app shell).
//
// CLI run: `node scripts/build-dogfood-assets.mjs` (writes the committed module). The generation itself is
// exported as `buildDogfoodAssets()` (write-free — returns the module source as a string) so
// `dogfood-assets-freshness.test.ts` can re-run the IDENTICAL routine into scratch and compare against the
// committed file, rather than forking a second copy of this build logic (the build-css.ts/buildSiteCss
// precedent: one real-build function, imported by both the generator and its own freshness gate).
//
// Idempotent by construction — a fixed source tree yields a deterministic minified IIFE (Rolldown), so
// running this twice produces byte-identical output; that rebuild-and-compare IS the freshness gate's
// proof, not asserted here.
//
// Scratch discipline (site/lib/build-css.ts's own convention, reused verbatim): builds into `dist-*`-
// prefixed scratch directories (gitignored), never the real `dist/`; removed before AND after each run so
// a stale prior run can never leak into a fresh one. Each CALLER passes its own scratch dir names so two
// concurrent callers (the CLI + a test run) never collide (the build-css.ts "each caller owns its own
// scratch dir name" convention).
import { build } from 'vite'
import { Features } from 'lightningcss'
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'

// `process.cwd()`-relative, NOT `import.meta.url` (the ADR-0135/TKT-0044 mechanics, LLD-C1's own cited
// convention): a jsdom-environment vitest test importing this module does not hand it a real `file://`
// `import.meta.url` (measured — vitest.config.ts's "scripts" project comment names the identical gap),
// so `new URL('..', import.meta.url)` throws there even though plain `node:fs`/`vite` resolve fine.
// `process.cwd()` is always the repo root for every consumer of this module (the CLI run below, and
// `npm test`/`vitest run`, both invoked from the repo root per CLAUDE.md's standing gate convention).
export const ROOT = process.cwd()
export const OUT_MODULE = `${ROOT}/packages/agent-ui/components/src/controls/sandbox-frame/dogfood/dogfood-assets.ts`

// The four cascade imports (site/pages/_page.ts [1][2][3][3b], verbatim, in that order) — a tiny
// generated entry file (LLD-C1's "virtual entry"; a real scratch file rather than a Rollup virtual
// module, since Vite's `build.lib.entry` needs a resolvable path).
const ENTRY_SOURCE = `import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '@agent-ui/components/components'
import '@agent-ui/icons/phosphor'
`

/** DOGFOOD_TAGS — scan the built JS for \`.define("ui-…"\` / \`.define('ui-…'\` / \`.define(\`ui-…\`\` call
 *  sites (LLD-C1: the METHOD-CALL form, deliberately not the full `customElements.define(` literal a
 *  minifier may alias away, e.g. `const c=customElements;c.define("ui-…")`) — a static-analysis
 *  derivation over committed data, never a runtime bundle execution. The installed minifier (Rolldown,
 *  measured) rewrites the tag literal to a template string (backtick), not just a quote-style swap — all
 *  three quote characters are scanned so a future minifier version change doesn't silently zero this out. */
export function extractTags(js) {
  const tagRe = /\.define\((["'`])(ui-[a-z0-9-]+)\1/g
  const tags = new Set()
  let m
  while ((m = tagRe.exec(js)) !== null) tags.add(m[2])
  return [...tags].sort()
}

/** buildDogfoodAssets — run the real Vite build into `scratchOutDir`/`scratchEntryDir` (caller-owned scratch
 *  names) and return `{ css, js, tags, moduleSource }`. Write-free: the CALLER decides whether to persist
 *  `moduleSource` (the CLI does; the freshness test does not). */
export async function buildDogfoodAssets(scratchOutDir, scratchEntryDir) {
  rmSync(scratchOutDir, { recursive: true, force: true })
  rmSync(scratchEntryDir, { recursive: true, force: true })
  mkdirSync(scratchEntryDir, { recursive: true })
  const entryFile = `${scratchEntryDir}/dogfood-entry.mjs`
  writeFileSync(entryFile, ENTRY_SOURCE)

  try {
    await build({
      configFile: false,
      root: ROOT,
      logLevel: 'silent',
      // Match the real site build's one deliberate CSS-minify carve-out (vite.config.ts's own comment):
      // never downlevel `light-dark()` — a downleveled pair would silently discard the per-subtree
      // `color-scheme` override <ui-theme-provider scheme> relies on.
      css: { lightningcss: { exclude: Features.LightDark } },
      build: {
        outDir: scratchOutDir,
        emptyOutDir: true,
        cssCodeSplit: false,
        minify: true,
        lib: {
          entry: entryFile,
          formats: ['iife'],
          name: 'AgentUIDogfood',
          fileName: () => 'dogfood-bundle.js',
        },
      },
    })

    const files = readdirSync(scratchOutDir)
    const jsFile = files.find((f) => f.endsWith('.js'))
    const cssFile = files.find((f) => f.endsWith('.css'))
    if (!jsFile) throw new Error(`build-dogfood-assets: no .js asset emitted under ${scratchOutDir} (found: ${files.join(', ')})`)
    if (!cssFile) throw new Error(`build-dogfood-assets: no .css asset emitted under ${scratchOutDir} (found: ${files.join(', ')})`)
    const js = readFileSync(`${scratchOutDir}/${jsFile}`, 'utf8')
    const css = readFileSync(`${scratchOutDir}/${cssFile}`, 'utf8')

    const tags = extractTags(js)
    if (tags.length === 0) {
      throw new Error('build-dogfood-assets: zero ui-* tags found in the built bundle — the .define(...) scan regressed (see LLD-C1 recorded fallback)')
    }

    const header = `// dogfood-assets.ts — GENERATED by scripts/build-dogfood-assets.mjs — DO NOT EDIT.
// Source: the docs-page load-bearing cascade (site/pages/_page.ts's own [1][2][3][3b] order, minus the
// app/site chrome members [3a]/[3c] — ADR-0162 Consequences):
//   @agent-ui/components/foundation-styles.css -> component-styles.css -> components -> @agent-ui/icons/phosphor
// Built: a real Vite (Rolldown) IIFE build, minified, cssCodeSplit:false (LLD-C1, genui-dogfood.lld.md).
// Measured: DOGFOOD_CSS ${css.length} B (${tags.length} self-defined tags) · DOGFOOD_JS ${js.length} B.
// Regenerate: \`node scripts/build-dogfood-assets.mjs\` — a fixed source tree yields byte-identical output
// (dogfood-assets-freshness.test.ts's own rebuild-and-compare gate).
`
    const moduleSource = `${header}
export const DOGFOOD_CSS: string = ${JSON.stringify(css)}

export const DOGFOOD_JS: string = ${JSON.stringify(js)}

export const DOGFOOD_TAGS: readonly string[] = ${JSON.stringify(tags)}
`
    return { css, js, tags, moduleSource }
  } finally {
    rmSync(scratchOutDir, { recursive: true, force: true })
    rmSync(scratchEntryDir, { recursive: true, force: true })
  }
}

// ── CLI entry — only runs when this file is executed directly (`node scripts/build-dogfood-assets.mjs`),
// never when a test imports `buildDogfoodAssets` from it (the build-css.ts module-vs-CLI split). Checked
// against `process.argv[1]`'s basename rather than an `import.meta.url`/`file://` URL comparison — the
// SAME jsdom-environment gap ROOT's own comment above documents. ──
if (process.argv[1]?.endsWith('build-dogfood-assets.mjs')) {
  const { css, js, tags, moduleSource } = await buildDogfoodAssets(`${ROOT}/dist-dogfood-assets-scratch`, `${ROOT}/dist-dogfood-assets-entry-scratch`)
  writeFileSync(OUT_MODULE, moduleSource)
  console.log(`build-dogfood-assets: wrote ${OUT_MODULE}`)
  console.log(`  DOGFOOD_CSS: ${css.length} B   DOGFOOD_JS: ${js.length} B   tags: ${tags.length}`)
}
