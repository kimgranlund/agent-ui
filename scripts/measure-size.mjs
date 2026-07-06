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

import { rolldown } from 'rolldown'
import { gzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

const KB = 1024
const targets = [
  // [label, entry (relative to this script), budget in gz bytes]
  ['@agent-ui/components . (reactive+dom barrel)', '../packages/agent-ui/components/src/index.ts', 7 * KB],
  // family-total = the WORST-CASE ceiling (every control defined at once), NOT the eventual distributed size:
  // a real consumer imports a subset and ships ~5–14 KB (single control ~5 KB incl. the shared dom+reactive+
  // traits+base foundation dragged in once; each extra control ~0.5–2 KB marginal — measured 2026-07-05).
  // 23 KB re-based at the container box-model + scroll-fade wave (ADR-0049 Amendment 1): the scroll-fade trait
  // pushed the all-controls bundle past 22 KB (~155 B of SHARED scroll infra). The per-control marginal ≤~2 KB
  // stays the REAL cap; the per-control leg below (T5, ADR-0080) measures it directly through the public API.
  ['@agent-ui/components/components (self-defining ui-* family)', '../packages/agent-ui/components/src/controls/index.ts', 23 * KB],
]

let over = false
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

if (over || marginalOver) {
  if (over) console.error('size: a barrel exceeds its budget')
  if (marginalOver) console.error('size: a control exceeds its per-control marginal budget')
  process.exit(1)
}
