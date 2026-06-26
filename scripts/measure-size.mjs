// measure-size — the consumer-budget gate (rubric D8 / plan §10). Bundles the `@agent-ui/components`
// public barrel (the full reactive+dom surface a consumer pulls) with the project's own bundler
// (Rolldown, the engine under Vite 8), minified, and reports minified + gzipped byte counts. Run via
// `npm run size`. Reproducible companion to G1's one-off (esbuild) figure; Rolldown is what the library
// actually ships through, so this is the representative measure.

import { rolldown } from 'rolldown'
import { gzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

const BUDGET_GZ = 6 * 1024 // plan §10 provisional reactive+dom consumer budget (~6 kB gz)

const targets = [
  ['@agent-ui/components (reactive+dom barrel)', '../packages/agent-ui/components/src/index.ts'],
]

let over = false
for (const [label, rel] of targets) {
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
  const status = gz <= BUDGET_GZ ? 'within' : 'OVER'
  if (gz > BUDGET_GZ) over = true
  console.log(`${label}: ${gz} B gz (${min} B min) — ${status} budget (${BUDGET_GZ} B gz)`)
}

if (over) {
  console.error('size: a barrel exceeds its budget')
  process.exit(1)
}
