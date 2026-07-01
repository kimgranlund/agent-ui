// measure-size — the consumer-budget + tree-shake gate (rubric D8 / plan §10 / decomp s17). Bundles each
// public barrel of `@agent-ui/components` with the project's own bundler (Rolldown, the engine under Vite 8),
// minified, and reports minified + gzipped byte counts against a per-barrel budget. Run via `npm run size`.
// Reproducible companion to G1's one-off (esbuild) figure; Rolldown is what the library actually ships
// through, so this is the representative measure.
//
// Two targets:
//   • the `.` barrel (src/index.ts) — the FULL reactive+dom surface a foundation consumer pulls.
//   • the `components` barrel (controls/index.ts) — the self-defining ui-* family (ADR-0003 s17). This is the
//     BUNDLE leg of the tree-shake proof: importing the family drags only the controls + their real deps
//     (dom + reactive + traits), so the family barrel lands in the SAME ballpark as the foundation surface —
//     it does NOT pull "the whole package" twice. The deterministic import-graph SHAPE proof lives in
//     controls/tree-shake.test.ts; this script pins the realised BYTES.

import { rolldown } from 'rolldown'
import { gzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

const KB = 1024
const targets = [
  // [label, entry (relative to this script), budget in gz bytes]
  ['@agent-ui/components . (reactive+dom barrel)', '../packages/agent-ui/components/src/index.ts', 7 * KB],
  // family-total re-based for the control suite; the per-control marginal ≤~2KB is the real cap,
  // real consumers tree-shake. 22 KB re-based at Wave 5B (ADR-0049): the suite now holds the full
  // control family incl. ui-calendar + the date/time picker paths (19889 B gz actual; ~13% headroom).
  ['@agent-ui/components/components (self-defining ui-* family)', '../packages/agent-ui/components/src/controls/index.ts', 22 * KB],
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

if (over) {
  console.error('size: a barrel exceeds its budget')
  process.exit(1)
}
