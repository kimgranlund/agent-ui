// measure-size — the consumer-budget + tree-shake gate (rubric D8 / plan §10 / decomp s17). Bundles each
// public barrel of `@agent-ui/components` with the project's own bundler (Rolldown, the engine under Vite 8),
// minified, and reports minified + gzipped byte counts against a per-barrel budget. Run via `npm run size`.
// Reproducible companion to G1's one-off (esbuild) figure; Rolldown is what the library actually ships
// through, so this is the representative measure.
//
// Two barrel-level targets:
//   • the `.` barrel (src/index.ts) — the FULL reactive+dom surface a foundation consumer pulls.
//   • the `components` barrel (controls/index.ts) — the self-defining ui-* family (ADR-0003 s17). This is the
//     BUNDLE leg of the tree-shake proof: importing the family drags only the controls + their real deps
//     (dom + reactive + traits), so the family barrel lands in the SAME ballpark as the foundation surface —
//     it does NOT pull "the whole package" twice. The deterministic import-graph SHAPE proof lives in
//     controls/tree-shake.test.ts; this script pins the realised BYTES.
//
// A third, per-control leg (T5, ADR-0080): the barrel legs above measure the WORST-CASE (foundation alone /
// every control at once), not what a real consumer distributes. The per-control leg bundles each public
// `./controls/{name}` entry (package.json's exports map — the T4 three-way drift gate keeps this set honest)
// through a LEAVE-ONE-OUT marginal: `marginal(c) = gz(bundle(ALL entries)) − gz(bundle(ALL ∖ {c}))`. This
// attributes shared infrastructure (bases, traits, the reactive kernel) to NO single control — exactly the
// "what does adding this control cost an app already using others" semantics the ≤2048 B cap means (ADR-0080
// clause 3, rejecting the pairwise-delta alternative). Each entry's SOLO absolute (foundation-inclusive, the
// ~5 KB figure) is also reported, informationally only (clause 3 — regressions in a control's own code would
// hide inside the dominant foundation figure if solo were gated).
//
// A fourth leg — `@agent-ui/app` (LLD-C8, SPEC-R7 AC4): a package ABOVE components on the DAG, so its cost
// to a consumer is what `ui-app-shell` adds ON TOP OF the components foundation a consumer already pays for
// (the first target above), not its solo absolute (which necessarily also carries that foundation). Same
// marginal semantics as T5, one level up: `marginal = gz(bundle(app .)) − gz(bundle(components .))`.

import { rolldown } from 'rolldown'
import { gzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { dirname, resolve as resolvePath } from 'node:path'

const KB = 1024
const targets = [
  // [label, entry (relative to this script), budget in gz bytes]
  ['@agent-ui/components . (reactive+dom barrel)', '../packages/agent-ui/components/src/index.ts', 7 * KB],
  // family-total = the WORST-CASE ceiling (every control defined at once), NOT the eventual distributed size:
  // a real consumer imports a subset and ships ~5–14 KB (single control ~5 KB incl. the shared dom+reactive+
  // traits+base foundation dragged in once; each extra control ~0.5–2 KB marginal — measured 2026-07-05).
  // 23 KB re-based at the container box-model + scroll-fade wave (ADR-0049 Amendment 1): the scroll-fade trait
  // pushed the all-controls bundle past 22 KB (~155 B of SHARED scroll infra). 25 KB re-based at the ADR-0095
  // wave (ui-segmented-control + ui-segment supersede ui-radio-group[variant=segmented]): two NEW tags (each
  // with its own descriptor/CSS text baked into the bundle) land alongside radio-group.css's segmented-block
  // removal — net +~950 B gz to the worst-case ceiling (measured 24499 B gz 2026-07-07). The per-control
  // marginal ≤~2 KB stays the REAL cap; the per-control leg below (T5, ADR-0080) measures it directly through
  // the public API (both new controls land at 0–62 B gz marginal — trivial, since almost all their shared cost
  // rides the radio/radio-group foundation every other Indicator/Pattern control already pays).
  // 26 KB re-based at the chart wave (ADR-0107 ## Amendment, the Consequences-anticipated re-base): TWO new
  // Display controls with hand-rolled mark code (ui-sparkline's SVG path-building + ui-bar-chart's diverging
  // bar math) — measured 25847 B gz 2026-07-08; per-control marginals stay trivial vs the ~2 KB cap
  // (bar-chart 447 B gz · sparkline 715 B gz through the T5 public-API leg).
  // 28 KB re-based at the report+content-family wave (ADR-0111/ADR-0113 Amendment, SPEC-N4, the same
  // Consequences-anticipated re-base precedent): FIVE new controls (ui-table/ui-stat/ui-badge/ui-code/
  // ui-disclosure) landed in one integration slice — measured 27533 B gz 2026-07-09; per-control marginals
  // stay trivial vs the ~2 KB cap (table 659 B gz · stat 484 B gz · badge 117 B gz · code 51 B gz ·
  // disclosure 384 B gz — the worst-case ceiling moves, the real per-control gate does not).
  // 30 KB re-based at the feed-family wave (ADR-0112 cl.8, the same Consequences-anticipated re-base
  // precedent — the ADR named this re-base as EXPECTED, never guessed): FIVE new tags
  // (ui-progress/ui-avatar/ui-attachment/ui-toast/ui-toast-region) landed in one integration slice —
  // measured 29463 B gz 2026-07-09; per-control marginals stay trivial vs the ~2 KB cap (progress 301 B gz ·
  // avatar 307 B gz · attachment 544 B gz · toast 0 B gz · toast-region 235 B gz — the worst-case ceiling
  // moves, the real per-control gate does not).
  // 32 KB re-based at the M4 Phase 1 wave (ADR-0120 cl.2, app-surfaces-m4.lld.md LLD-C9, the SAME
  // Consequences-anticipated re-base precedent — SPEC-R14 named this re-base EXPECTED, not guessed): the
  // split primitive (ui-split's drag/keyboard/ARIA machinery + ui-split-pane) — measured 32689 B gz
  // 2026-07-10; the per-control marginal stays the real gate (split 1966 B gz — within the ≤2048 B cap;
  // split-pane 0 B gz, trivial — the worst-case ceiling moves, the real per-control gate does not).
  // 34 KB re-based at the ui-toolbar wave (ADR-0121, Consequences amendment — the same Consequences-
  // anticipated re-base precedent): measured 33017 B gz post-toolbar (toolbar's own per-control marginal
  // 318 B gz, trivial vs the ≤2048 B cap — the worst-case ceiling moved, the real per-control gate did
  // not). The bump to 34816 B gz is sized ahead, not guessed at per-control: it covers the three QUEUED,
  // already-frozen control families (timeline / swiper / command-modal) so the ceiling is not re-based
  // again on the very next wave — recorded here, not silently absorbed.
  ['@agent-ui/components/components (self-defining ui-* family)', '../packages/agent-ui/components/src/controls/index.ts', 34 * KB],
]

let over = false
const gzByLabel = new Map() // captured so the @agent-ui/app section below can compute its marginal against the foundation figure without re-bundling it
for (const [label, rel, budget] of targets) {
  const input = fileURLToPath(new URL(rel, import.meta.url))
  const bundle = await rolldown({ input })
  const { output } = await bundle.generate({ format: 'esm', minify: true })
  await bundle.close()
  const code = output
    .filter((c) => c.type === 'chunk')
    .map((c) => c.code)
    .join('')
  const min = Buffer.byteLength(code)
  const gz = gzipSync(code, { level: 9 }).length
  const status = gz <= budget ? 'within' : 'OVER'
  if (gz > budget) over = true
  gzByLabel.set(label, gz)
  console.log(`${label}: ${gz} B gz (${min} B min) — ${status} budget (${budget} B gz)`)
}

// ── T5 (ADR-0080 clauses 3–4) — per-control leave-one-out marginal + informational solo absolute ──

const PKG_DIR = fileURLToPath(new URL('../packages/agent-ui/components', import.meta.url))
const pkg = JSON.parse(readFileSync(`${PKG_DIR}/package.json`, 'utf8'))

// Every public per-control entry (name → absolute path of its target module), read straight off the exports
// map T4 wrote and keeps honest via the three-way drift gate (barrels.test.ts) — no separate control list to
// drift out of sync here.
const CONTROL_ENTRIES = Object.entries(pkg.exports)
  .filter(([key]) => key.startsWith('./controls/'))
  .map(([key, rel]) => [key.slice('./controls/'.length), `${PKG_DIR}/${rel.slice(2)}`])

/** Bundle a synthetic virtual entry `import`ing each of `paths` (via a resolveId/load plugin — no temp file
 * on disk), minified; return the gz byte size. Rolldown supports one `input`, so a multi-entry measurement
 * (the leave-one-out set, the ALL set) goes through this one synthetic module rather than N real entries. */
const gzOfEntries = async (paths) => {
  const VIRTUAL_ID = '\0virtual:measure-size-entry'
  const src = paths.map((p) => `import ${JSON.stringify(p)}`).join('\n') + '\n'
  const plugin = {
    name: 'measure-size-virtual-entry',
    resolveId(id) {
      if (id === 'virtual:measure-size-entry') return VIRTUAL_ID
    },
    load(id) {
      if (id === VIRTUAL_ID) return src
    },
  }
  const bundle = await rolldown({ input: 'virtual:measure-size-entry', plugins: [plugin] })
  const { output } = await bundle.generate({ format: 'esm', minify: true })
  await bundle.close()
  const code = output
    .filter((c) => c.type === 'chunk')
    .map((c) => c.code)
    .join('')
  return gzipSync(code, { level: 9 }).length
}

// Default per-control marginal budget (ADR-0080 clause 4). Override rows carry a cited reason and are
// measured FIRST, then pinned — not guessed ahead of the measurement. `calendar` was measured too (ADR-0080
// flagged it as a candidate) but needs NO override: text-field's `import('../calendar/calendar.ts')` is
// static-in-practice here (rolldown's INEFFECTIVE_DYNAMIC_IMPORT warning — calendar is ALSO a top-level entry
// in the same bundle), so calendar's bytes land inside text-field's marginal, not its own; calendar's solo
// leave-one-out measures only ~60 B gz, well inside the default.
const MARGINAL_BUDGET_DEFAULT = 2048 // B gz
const MARGINAL_OVERRIDES = {
  // name: [budget in B gz, reason]
  'text-field': [4352, 'the 12-type value-codec family (ADR-0044/0047), which absorbs the calendar picker bytes above — measured 4021 B gz 2026-07-05, ~8% headroom'],
  'split': [2176, 'gzip measurement-frame drift as the family bundle crossed 33 KB (leave-one-out deltas shift with the shared dictionary; toolbar added similar roving/flex/enum code) — split source byte-identical that wave; measured 2082 B gz 2026-07-10'],
}

console.log('\nper-control marginal (leave-one-out through the public `./controls/{name}` entries, ADR-0080):')
const allPaths = CONTROL_ENTRIES.map(([, p]) => p)
const gzAll = await gzOfEntries(allPaths)
let marginalOver = false
for (const [name, path] of CONTROL_ENTRIES) {
  const gzWithout = await gzOfEntries(allPaths.filter((p) => p !== path))
  const marginal = gzAll - gzWithout
  const solo = await gzOfEntries([path])
  const [budget, reason] = MARGINAL_OVERRIDES[name] ?? [MARGINAL_BUDGET_DEFAULT, undefined]
  const status = marginal <= budget ? 'within' : 'OVER'
  if (marginal > budget) marginalOver = true
  const reasonNote = reason ? ` (override: ${reason})` : ''
  console.log(
    `  ${name.padEnd(14)} marginal ${String(marginal).padStart(5)} B gz — ${status.padEnd(6)} budget ${budget} B${reasonNote}   solo ${solo} B gz (informational)`,
  )
}

// ── @agent-ui/app (LLD-C8, SPEC-R7 AC4) — the ui-app-shell primitive, one package UP the DAG from
// components. `app-shell.ts` is the fleet's first `?url`/`?raw` consumer (the isolation-mode fleet-CSS
// injection, LLD-C5): a bare `rolldown()` call can't load those Vite query-suffixed specifiers (Vite's own
// asset pipeline resolves them; raw Rolldown has no such plugin), so this section carries a small stub
// plugin — `?raw` inlines the real file's text (a real byte cost: this IS the CSS the shell injects at
// runtime); `?url` returns a short placeholder path (the real Vite build emits a hashed asset URL of similar
// length — this approximates the byte contribution, not the runtime value, which the script has no need of).
const APP_QUERY_RE = /^(.*)\?(url|raw)$/
const appCssQuerySuffixPlugin = {
  name: 'app-css-query-suffix-stub',
  resolveId(source, importer) {
    const m = source.match(APP_QUERY_RE)
    if (!m) return null
    const [, bare, kind] = m
    let target
    if (bare.startsWith('.')) {
      target = resolvePath(dirname(importer), bare)
    } else if (bare.startsWith('@agent-ui/')) {
      const [, pkgName, ...rest] = bare.split('/')
      const pkgDir = fileURLToPath(new URL(`../packages/agent-ui/${pkgName}`, import.meta.url))
      const pkgExports = JSON.parse(readFileSync(`${pkgDir}/package.json`, 'utf8')).exports
      const subpath = `./${rest.join('/')}`
      const mapped = pkgExports[subpath]
      if (!mapped) throw new Error(`app-css-query-suffix-stub: no "${subpath}" export in @agent-ui/${pkgName}`)
      target = `${pkgDir}/${mapped.slice(2)}`
    } else {
      throw new Error(`app-css-query-suffix-stub: cannot resolve "${bare}"`)
    }
    return { id: `${target}?${kind}`, moduleSideEffects: false }
  },
  load(id) {
    const m = id.match(APP_QUERY_RE)
    if (!m) return null
    const [, filePath, kind] = m
    if (kind === 'raw') return `export default ${JSON.stringify(readFileSync(filePath, 'utf8'))}`
    return `export default ${JSON.stringify(`/${filePath.split('/').pop()}`)}`
  },
}

const APP_MARGINAL_BUDGET = 3 * KB // provisional, recorded at M1 kickoff (LLD-C8) — pending confirmation the real number lands inside it
const appInput = fileURLToPath(new URL('../packages/agent-ui/app/src/index.ts', import.meta.url))
const appBundle = await rolldown({ input: appInput, plugins: [appCssQuerySuffixPlugin] })
const { output: appOutput } = await appBundle.generate({ format: 'esm', minify: true })
await appBundle.close()
const appCode = appOutput
  .filter((c) => c.type === 'chunk')
  .map((c) => c.code)
  .join('')
const appMin = Buffer.byteLength(appCode)
const appGz = gzipSync(appCode, { level: 9 }).length
const foundationGz = gzByLabel.get('@agent-ui/components . (reactive+dom barrel)')
const appMarginal = appGz - foundationGz
const appStatus = appMarginal <= APP_MARGINAL_BUDGET ? 'within' : 'OVER'
const appOver = appMarginal > APP_MARGINAL_BUDGET
console.log(
  `\n@agent-ui/app . (ui-app-shell): marginal ${appMarginal} B gz — ${appStatus} budget (${APP_MARGINAL_BUDGET} B gz)   solo ${appGz} B gz (${appMin} B min, informational — includes the ${foundationGz} B gz components foundation)`,
)

// ── @agent-ui/router (LLD-C9, SPEC-R7 AC4) — the SPA router family, ANOTHER package above components on
// the DAG (`shared ← components ← {a2ui, router} ← app`). Same marginal semantics as the @agent-ui/app
// section above, one row: what does a consumer who ALREADY has the components foundation pay to add the
// WHOLE router surface — the headless core barrel (`.`) PLUS both elements (`./router-outlet`,
// `./router-link`), the realistic "a consumer using the family" shape, not the core-alone figure (which
// would understate what most consumers actually ship, since the elements are the reason to reach for
// this package). A synthetic virtual entry (the same no-temp-file plugin pattern as the T5 per-control
// section) imports all three public subpaths; router-link.css is a stylesheet asset, not JS, so it is
// intentionally excluded (no bundler-measurable byte cost through this JS pipeline).
const ROUTER_MARGINAL_BUDGET = 4 * KB // provisional, recorded at LLD-C9 kickoff (SPEC-R7 AC4) — first measurement, no re-base expected
const routerPkgDir = fileURLToPath(new URL('../packages/agent-ui/router', import.meta.url))
const routerVirtualSrc = [
  `import ${JSON.stringify(`${routerPkgDir}/src/index.ts`)}`,
  `import ${JSON.stringify(`${routerPkgDir}/src/controls/router-outlet/router-outlet.ts`)}`,
  `import ${JSON.stringify(`${routerPkgDir}/src/controls/router-link/router-link.ts`)}`,
].join('\n') + '\n'
const routerVirtualId = '\0virtual:measure-size-router-entry'
const routerBundle = await rolldown({
  input: 'virtual:measure-size-router-entry',
  plugins: [
    {
      name: 'measure-size-router-virtual-entry',
      resolveId(id) {
        if (id === 'virtual:measure-size-router-entry') return routerVirtualId
      },
      load(id) {
        if (id === routerVirtualId) return routerVirtualSrc
      },
    },
  ],
})
const { output: routerOutput } = await routerBundle.generate({ format: 'esm', minify: true })
await routerBundle.close()
const routerCode = routerOutput
  .filter((c) => c.type === 'chunk')
  .map((c) => c.code)
  .join('')
const routerMin = Buffer.byteLength(routerCode)
const routerGz = gzipSync(routerCode, { level: 9 }).length
const routerMarginal = routerGz - foundationGz
const routerStatus = routerMarginal <= ROUTER_MARGINAL_BUDGET ? 'within' : 'OVER'
const routerOver = routerMarginal > ROUTER_MARGINAL_BUDGET
console.log(
  `\n@agent-ui/router (core + ui-router-outlet + ui-router-link): marginal ${routerMarginal} B gz — ${routerStatus} budget (${ROUTER_MARGINAL_BUDGET} B gz)   solo ${routerGz} B gz (${routerMin} B min, informational — includes the ${foundationGz} B gz components foundation)`,
)

// ── @agent-ui/code (LLD-C10, SPEC-C9 AC2) — the code+prose family: a THIRD sibling branch off components
// (`shared ← components ← {a2ui, router, code} ← app`). Three per-pack line-items, not one combined figure
// (SPEC-C9's per-pack budget discipline):
//   • the core `.` barrel and `./highlight` neither import @agent-ui/components at ALL (the no-kernel gate,
//     core/no-kernel.test.ts) — their ABSOLUTE bundled size carries zero foundation cost, so it IS the
//     tree-shake byte proof directly (SPEC-C1 AC3/SPEC-C9: "the core row proves no pack mass" — an absolute
//     near-zero figure demonstrates this more directly than a marginal-over-foundation frame would).
//   • `./markdown` DOES pull real fleet controls (ui-text/ui-code/ui-table via
//     @agent-ui/components/controls/*), so it is measured the SAME marginal-over-foundation way as
//     @agent-ui/app/@agent-ui/router above: what a consumer who already pays for the components foundation
//     pays ON TOP to add ui-markdown.
const codePkgDir = fileURLToPath(new URL('../packages/agent-ui/code', import.meta.url))

/** Bundle a single real entry file (no synthetic virtual wrapper needed — one target each) and return its
 *  gz byte size. Mirrors the T5/router/app sections' minify+gzip pipeline. */
const gzOfEntry = async (entryPath) => {
  const bundle = await rolldown({ input: entryPath })
  const { output } = await bundle.generate({ format: 'esm', minify: true })
  await bundle.close()
  const code = output
    .filter((c) => c.type === 'chunk')
    .map((c) => c.code)
    .join('')
  return { gz: gzipSync(code, { level: 9 }).length, min: Buffer.byteLength(code) }
}

// core `.` — the ABSOLUTE tree-shake proof (no components import exists to make "marginal" meaningful).
const CODE_CORE_BUDGET = 1.5 * KB // measured 534 B gz at M1 kickoff (LLD-C10, ADR-0080 discipline) — pinned with headroom
const codeCore = await gzOfEntry(`${codePkgDir}/src/index.ts`)
const codeCoreOver = codeCore.gz > CODE_CORE_BUDGET
console.log(
  `\n@agent-ui/code . (core — token types + registry + projection seam): ${codeCore.gz} B gz (${codeCore.min} B min) — ${codeCoreOver ? 'OVER' : 'within'} budget (${CODE_CORE_BUDGET} B gz); zero @agent-ui/components import exists (the no-kernel gate) — this figure IS the tree-shake proof, not a marginal`,
)

// ./highlight — ABSOLUTE (same no-components-import reasoning; seven hand-rolled tokenizers + the shared
// scan.ts lexer core, self-registering on import).
const CODE_HIGHLIGHT_BUDGET = 6 * KB // measured 2454 B gz at M1 kickoff (LLD-C10, ADR-0080 discipline) — pinned with headroom
const codeHighlight = await gzOfEntry(`${codePkgDir}/src/highlight/index.ts`)
const codeHighlightOver = codeHighlight.gz > CODE_HIGHLIGHT_BUDGET
console.log(
  `@agent-ui/code/highlight (seven tokenizers, self-registering): ${codeHighlight.gz} B gz (${codeHighlight.min} B min) — ${codeHighlightOver ? 'OVER' : 'within'} budget (${CODE_HIGHLIGHT_BUDGET} B gz)`,
)

// ./markdown — MARGINAL over the components foundation (it pulls real ui-text/ui-code/ui-table).
const CODE_MARKDOWN_BUDGET = 5 * KB // measured marginal 1033 B gz at M1 kickoff (LLD-C10, ADR-0080 discipline) — pinned with headroom
const codeMarkdown = await gzOfEntry(`${codePkgDir}/src/markdown/index.ts`)
const codeMarkdownMarginal = codeMarkdown.gz - foundationGz
const codeMarkdownOver = codeMarkdownMarginal > CODE_MARKDOWN_BUDGET
console.log(
  `@agent-ui/code/markdown (ui-markdown; pulls ui-text/ui-code/ui-table): marginal ${codeMarkdownMarginal} B gz — ${codeMarkdownOver ? 'OVER' : 'within'} budget (${CODE_MARKDOWN_BUDGET} B gz)   solo ${codeMarkdown.gz} B gz (${codeMarkdown.min} B min, informational — includes the ${foundationGz} B gz components foundation)`,
)

if (over || marginalOver || appOver || routerOver || codeCoreOver || codeHighlightOver || codeMarkdownOver) {
  if (over) console.error('size: a barrel exceeds its budget')
  if (marginalOver) console.error('size: a control exceeds its per-control marginal budget')
  if (appOver) console.error('size: @agent-ui/app exceeds its marginal budget')
  if (routerOver) console.error('size: @agent-ui/router exceeds its marginal budget')
  if (codeCoreOver) console.error('size: @agent-ui/code . (core) exceeds its budget')
  if (codeHighlightOver) console.error('size: @agent-ui/code/highlight exceeds its budget')
  if (codeMarkdownOver) console.error('size: @agent-ui/code/markdown exceeds its marginal budget')
  process.exit(1)
}
