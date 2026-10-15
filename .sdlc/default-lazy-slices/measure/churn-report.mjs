// Turns a vitest --reporter=json file from a scratch-clone run into the saved churn report (failing files + first message).
// Usage: node churn-report.mjs <json> <clone-root> <label>
import { readFileSync } from 'node:fs'
const [file, root, label] = process.argv.slice(2)
const j = JSON.parse(readFileSync(file, 'utf8'))
const short = (n) => n.replace(`${root}/`, '').replace('packages/agent-ui/', '')
const bad = j.testResults.filter((r) => r.status !== 'passed')
console.log(`${label}: test files run ${j.testResults.length}, failing ${bad.length}; tests ${j.numTotalTests}, passed ${j.numPassedTests}, failed ${j.numFailedTests}`)
for (const r of bad) {
  const f = r.assertionResults.filter((a) => a.status === 'failed')
  console.log(`  FAIL ${short(r.name)}  ${f.length}/${r.assertionResults.length}`)
  for (const m of [...new Set(f.map((a) => (a.failureMessages[0] ?? '').split('\n')[0].slice(0, 110)))].slice(0, 2)) console.log(`       ${m}`)
}
