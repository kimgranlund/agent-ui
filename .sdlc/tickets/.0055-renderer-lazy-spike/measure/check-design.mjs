// Acceptance check for T-0055 (read-only). Exit 0 when:
//  1. design.md has its required sections and ends with a recommendation;
//  2. every headline figure in it appears in a saved harness output, and the derived arithmetic holds;
//  3. every repo path it names exists (or is marked `(new)` with an existing parent folder);
//  4. children 0, A, B and C have pairwise disjoint file sets;
//  5. the churn outputs say what section 5 says, and the real-engine file list in section 5 is exactly the repo's set of
//     browser tests that mount a surface host, a conversation or the admin chat (35 listed + 3 run = 38);
//  6. no em dash in any text file of the task folder (the conductor's handoff.md quotes the grep and is skipped), and
//     nothing is edited outside .sdlc/.
// Usage (from the repo root): node .sdlc/0055-renderer-lazy-spike/measure/check-design.mjs
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const HERE = fileURLToPath(new URL('.', import.meta.url)).replace(/\/$/, '')
const TASK = dirname(HERE)
const ROOT = dirname(dirname(TASK))
const fails = []
const need = (ok, msg) => { if (!ok) fails.push(msg) }
const read = (f) => readFileSync(f, 'utf8')

const design = read(`${TASK}/design.md`)

// 1. sections
for (const h of ['## 0. Answer first', '## 1. Premise check', '## 2. Re-measure', '## 3. The import graph and the exact async seam', '### 3.1 Import graph', '### 3.2 What a lazy ui-surface-host loads', '### 3.3 Composition with settled()', '### 3.4 Warm rules', '### 3.5 First-use cost', '## 4. Who benefits', '## 5. Every consumer and test', '## 6. Risks', '## 7. Decomposition', '### Child 0', '### Child A', '### Child B', '### Child C', '## 8. What needs Kim', '## 9. The ADR route', '## 10. Recommendation', '## 11. Rejected alternatives'])
  need(design.includes(h), `design.md missing section "${h}"`)
need(/^## 10\. Recommendation: (build|defer|reject)\b/m.test(design), 'section 10 must open with a one-word verdict: build, defer or reject')
need(/ADR-0242/.test(design) && /Not run \(35 real-engine files/.test(design), 'design.md must name ADR-0242 and the 35 unrun real-engine files')

// 2. figures must come from saved outputs
const outFiles = ['prototype.out.txt', 'waterfall.out.txt', 'remaining.out.txt', 'size-app-rows.out.txt', 'churn-v0.out.txt', 'churn-v1.out.txt', 'churn-v2.out.txt', 'churn-v3.out.txt', 'churn-browser.out.txt', 'probe-cold.out.txt']
const out = outFiles.map((f) => read(`${HERE}/${f}`)).join('\n')
const fmt = (n) => n.toLocaleString('en-US')
for (const n of [57878, 59925, 44680, 45292, 45293, 45267, 45268, 45269, 45270, 12011, 12012, 12782, 26901, 31935, 13606, 27213, 27218, 27989, 22890, 9288, 88584, 87667, 78379, 65694, 1099, 1598, 3452, 2649, 688486, 547962, 110695, 30919, 1592, 2145, 2139, 81]) {
  need(out.includes(String(n)), `figure ${n} is not in the saved outputs`)
  need(design.includes(fmt(n)) || design.includes(String(n)), `figure ${n} is not in design.md`)
}
// the delta column is arithmetic on the saved marginals
const base = 57878
for (const [row, marginal, delta] of [['S0', 44680, -13198], ['Da', 45269, -12609], ['Dc', 45270, -12608], ['Dd', 45268, -12610], ['Db', 45267, -12611], ['Dx', 45293, -12585], ['Dy', 45292, -12586]]) {
  need(marginal - base === delta, `row ${row}: ${marginal} - ${base} must be ${delta}`)
  need(out.includes(`marginal  ${marginal}  delta  ${delta}`) || out.includes(`marginal ${marginal}  delta ${delta}`) || new RegExp(`marginal\\s+${marginal}\\s+delta\\s+${delta}`).test(out), `row ${row}: "marginal ${marginal} delta ${delta}" is not in prototype.out.txt`)
  need(design.includes(fmt(marginal)) && design.includes(fmt(delta)), `row ${row}: ${fmt(marginal)} or ${fmt(delta)} is not in design.md`)
}
need(45292 - 44680 === 612, 'facade cost: Dy minus S0 must be 612')
need(59925 - 45292 === 14633, 'headroom bought: 59,925 - 45,292 must be 14,633')
need(45292 + 2047 === 47339, 'provisional budget: 45,292 + 2,047 must be 47,339')
need(59925 - 57878 === 2047, 'today headroom: 59,925 - 57,878 must be 2,047')
need(88584 - 87667 === 917, 'first-surface net: 88,584 - 87,667 must be 917')
need(65694 + 22890 === 88584, 'Dd first-surface set: 65,694 + 22,890 must be 88,584')
need(78379 + 9288 === 87667, 'baseline first-surface set: 78,379 + 9,288 must be 87,667')
need(110695 + 30919 + 1592 === 143206, 'a2ui eager rendered bytes: 110,695 + 30,919 + 1,592 must be 143,206')
need(27218 - 13606 === 13612 && 31935 - 13606 === 18329 && 27989 - 13606 === 14383, 'lazy a2ui deltas against 13,606 must be 13,612, 18,329 and 14,383')
need(design.includes('14,633') && design.includes('47,339') && design.includes('917') && design.includes('143,206') && design.includes('612'), 'derived figures 14,633 / 47,339 / 917 / 143,206 / 612 must appear in design.md')

// 3. every named repo path exists. Only tokens rooted at a known top-level folder are checked.
const ROOTS = ['packages/', 'site/', 'scripts/', '.claude/', '.sdlc/', 'docs/', 'vitest.browser.config.ts', 'vite.config.ts', 'wrangler.jsonc']
const pathTok = /^[\w.@/-]+\.(?:ts|mjs|md|json|jsonc|css|html|txt)(?::\d+)?$/
let named = 0
// fenced blocks are dropped first: a triple backtick would shift the inline pairing for everything after it
const prose = design.replace(/```[\s\S]*?```/g, '')
for (const m of prose.matchAll(/`([^`]+)`(\s*\(new\b)?/g)) {
  const tok = m[1].replace(/:\d+$/, '')
  if (!pathTok.test(m[1])) continue
  let abs
  if (tok.startsWith('measure/')) abs = join(TASK, tok)
  else if (ROOTS.some((r) => tok.startsWith(r))) abs = join(ROOT, tok)
  else continue
  named++
  if (m[2]) need(existsSync(dirname(abs)), `parent folder of new file missing: ${tok}`)
  else need(existsSync(abs), `named path does not exist: ${tok}`)
}
need(named >= 90, `expected at least 90 resolvable named paths, resolved ${named}`)

// 4. child file sets
const childFiles = (name) => {
  const sec = design.split(new RegExp(`^### Child ${name} `, 'm'))[1]?.split(/^### |^## /m)[0] ?? ''
  const idx = sec.indexOf('Files:')
  need(idx >= 0, `child ${name} has no Files: list`)
  return new Set([...sec.slice(idx).matchAll(/^- `([^`]+)`/gm)].map((m) => m[1]))
}
const kids = Object.fromEntries(['0', 'A', 'B', 'C'].map((n) => [n, childFiles(n)]))
for (const [n, s] of Object.entries(kids)) need(s.size > 0, `child ${n} lists no files`)
const names = Object.keys(kids)
for (let i = 0; i < names.length; i++)
  for (let j = i + 1; j < names.length; j++) {
    const shared = [...kids[names[i]]].filter((f) => kids[names[j]].has(f))
    need(shared.length === 0, `children ${names[i]} and ${names[j]} share files: ${shared.join(', ')}`)
  }

// 5. churn outputs say what section 5 says
const failing = (f) => Number(read(`${HERE}/${f}`).match(/failing (\d+)/)?.[1])
const filesRun = (f) => Number(read(`${HERE}/${f}`).match(/test files run (\d+)/)?.[1])
need(failing('churn-v0.out.txt') === 0 && failing('churn-v2.out.txt') === 0 && failing('churn-v3.out.txt') === 0, 'V0, V2 and V3 must record 0 failing files')
need(failing('churn-v1.out.txt') === 1 && /conversation\.test\.ts/.test(read(`${HERE}/churn-v1.out.txt`)), 'V1 must record exactly 1 failing file, conversation.test.ts')
for (const f of ['churn-v0.out.txt', 'churn-v1.out.txt', 'churn-v2.out.txt', 'churn-v3.out.txt']) need(filesRun(f) === 101, `${f} must record 101 test files run`)
const cand = read(`${HERE}/candidate-tests.txt`).split('\n').filter(Boolean)
need(cand.length === 101 && new Set(cand).size === 101, `candidate-tests.txt must list 101 distinct files, found ${cand.length}`)
for (const c of cand) need(existsSync(join(ROOT, c)), `candidate test does not exist: ${c}`)
need(/0 failing/.test(read(`${HERE}/churn-browser.out.txt`)) && /3 distinct test files/.test(read(`${HERE}/churn-browser.out.txt`)), 'churn-browser.out.txt must record 3 distinct files, 0 failing')

// the real-engine list in section 5 equals the repo's set of browser tests that mount a surface host, a conversation or the admin chat
const sec5 = design.split('## 5. Every consumer and test')[1]?.split('## 6. Risks')[0] ?? ''
const ran = new Set([...sec5.split('Production code that creates')[0].matchAll(/^- `([^`]+\.browser\.test\.ts)`/gm)].map((m) => m[1]))
const unrunBlock = sec5.split('Not run (35 real-engine files')[1]?.split('New tests the build adds')[0] ?? ''
const unrun = new Set([...unrunBlock.matchAll(/`([^`]+\.browser\.test\.ts)`/g)].map((m) => m[1]))
need(ran.size === 3, `section 5 must list the 3 browser files that ran, found ${ran.size}`)
need(unrun.size === 35, `section 5 must list 35 unrun browser files, found ${unrun.size}`)
for (const f of ran) need(!unrun.has(f), `browser file listed as both run and unrun: ${f}`)
let repoSet = new Set()
try {
  const hits = execFileSync('grep', ['-rlE', 'ui-surface-host|ui-conversation|ui-agent-admin|createLazyRenderer|createRenderer', 'packages', 'site', '--include=*.browser.test.ts'], { cwd: ROOT, encoding: 'utf8' })
  repoSet = new Set(hits.split('\n').filter((l) => l && !l.includes('node_modules')))
} catch (e) { fails.push(`grep for browser files failed: ${e.message}`) }
need(repoSet.size === 38, `the repo has ${repoSet.size} matching browser test files, expected 38`)
for (const f of repoSet) need(ran.has(f) || unrun.has(f), `browser test not accounted for in section 5: ${f}`)
for (const f of [...ran, ...unrun]) need(repoSet.has(f), `section 5 lists a browser file that does not match the pattern: ${f}`)

// 6. no em dash; nothing outside .sdlc/ edited
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p] })
const dash = String.fromCharCode(0x2014)
for (const f of walk(TASK)) if (/\.(md|mjs|txt|ts|json|jsonl)$/.test(f) && !/(handoff\.md|dispatch\.json|runs\.jsonl)$/.test(f)) need(!read(f).includes(dash), `em dash in ${f.replace(`${ROOT}/`, '')}`)
try {
  const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean).filter((l) => !l.slice(3).startsWith('.sdlc/'))
  need(dirty.length === 0, `edits outside .sdlc/: ${dirty.join('; ')}`)
} catch (e) { fails.push(`git status failed: ${e.message}`) }

if (fails.length) { console.error(`FAIL (${fails.length})\n- ${fails.join('\n- ')}`); process.exit(1) }
console.log(`ok: sections, figures and derived arithmetic, ${named} named paths exist, children 0/A/B/C pairwise disjoint, churn outputs match section 5 (V0 0, V1 1, V2 0, V3 0 of 101), 38 browser files accounted for (3 run + 35 listed), no em dash, no edits outside .sdlc/`)
