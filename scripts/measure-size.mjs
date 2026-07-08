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
  ['@agent-ui/components/components (self-defining ui-* family)', '../packages/agent-ui/components/src/controls/index.ts', 26 * KB],
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

if (over || marginalOver || appOver) {
  if (over) console.error('size: a barrel exceeds its budget')
  if (marginalOver) console.error('size: a control exceeds its per-control marginal budget')
  if (appOver) console.error('size: @agent-ui/app exceeds its marginal budget')
  process.exit(1)
}
