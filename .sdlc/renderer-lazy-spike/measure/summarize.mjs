// Usage: node summarize.mjs <vitest-json> <label> [root-to-strip]
import { readFileSync } from 'node:fs'
const [file, label, root = ''] = process.argv.slice(2)
const j = JSON.parse(readFileSync(file, 'utf8'))
const rel = (p) => p.replace(root, '').replace(/^\/+/, '')
const files = j.testResults
const failing = files.filter((f) => f.status !== 'passed' || f.assertionResults.some((a) => a.status === 'failed'))
console.log(`${label}: test files run ${files.length}, failing ${failing.length}; tests ${j.numTotalTests}, passed ${j.numPassedTests}, failed ${j.numFailedTests}`)
for (const f of failing.sort((a, b) => a.name.localeCompare(b.name))) {
  const bad = f.assertionResults.filter((a) => a.status === 'failed')
  console.log(`  FAIL ${rel(f.name)}  ${bad.length}/${f.assertionResults.length}${bad.length === 0 ? '  (file-level: ' + String(f.message).split('\n')[0].slice(0, 100) + ')' : ''}`)
  const msgs = new Set(bad.map((a) => String(a.failureMessages?.[0] ?? '').split('\n')[0].slice(0, 110)))
  for (const m of [...msgs].slice(0, 2)) console.log(`       ${m}`)
}
