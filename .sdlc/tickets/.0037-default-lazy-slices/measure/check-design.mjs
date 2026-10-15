// Acceptance check for T-0037 (read-only). Exit 0 when:
//  1. design.md has its required sections;
//  2. every headline figure in it appears in a saved harness output (prototype, churn, size rows);
//  3. every repo path it names exists (or is marked `(new)` with an existing parent folder);
//  4. children A, B and C have pairwise disjoint file sets, and D overlaps only A's renderer.ts and the two runtime docs;
//  5. the file lists in section 3.5 equal the failing sets saved in churn-v1.out.txt (17) and churn-v2/v3.out.txt (2);
//  6. no em dash in any text file of the task folder, and nothing is edited outside .sdlc/.
// Usage (from the repo root): node .sdlc/0037-default-lazy-slices/measure/check-design.mjs
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const HERE = fileURLToPath(new URL('.', import.meta.url)).replace(/\/$/, '')
const TASK = dirname(HERE)
const ROOT = dirname(dirname(TASK))
const fails = []
const need = (ok, msg) => { if (!ok) fails.push(msg) }

const design = readFileSync(`${TASK}/design.md`, 'utf8')

// 1. sections
for (const h of ['## 0. Answer first', '## 1. Premise check', '## 2. Re-measure', '## 3. The exact async seam', '### 3.4 Non-test callers', '### 3.5 Tests', '## 4. Decomposition', '### Child A', '### Child B', '### Child C', '### Child D', '## 5. Risk list', '## 7. What needs Kim', '## 8. The ADR'])
  need(design.includes(h), `design.md missing section "${h}"`)

// 2. figures must come from saved outputs
const out = ['prototype.out.txt', 'churn-v1.out.txt', 'churn-v2.out.txt', 'churn-v3.out.txt', 'churn-extra.out.txt', 'size-app-rows.out.txt'].map((f) => readFileSync(`${HERE}/${f}`, 'utf8')).join('\n')
for (const n of [67203, 69250, 57751, 57710, 57686, 9452, 9493, 9517, 3452, 2648, 4553, 4528, 2780, 13603, 7478, 33645, 33648, 6986, 72, 17, 102, 2183, 775, 385, 31]) {
  need(out.includes(String(n)), `figure ${n} is not in the saved outputs`)
  need(design.includes(n.toLocaleString('en-US')) || design.includes(String(n)), `figure ${n} is not in design.md`)
}
need(69250 - 67203 === 2047, 'headroom arithmetic: 69,250 - 67,203 must be 2,047')
need(3452 + 2648 === 6100, 'default-only lazy fetch arithmetic: 3,452 + 2,648 must be 6,100')
need(13603 - 7478 === 6125, 'lazy delta arithmetic: 13,603 - 7,478 must be 6,125')
need(67203 - 57751 === 9452, 'eager delta arithmetic: 67,203 - 57,751 must be 9,452')
need(57751 + 2048 === 59799, 'provisional budget arithmetic: 57,751 + 2,048 must be 59,799')

// 3. every named repo path exists. Only tokens rooted at a known top-level folder are checked; a bare file name or a short
//    prose abbreviation such as `records.ts` is a mention, not a path claim.
const ROOTS = ['packages/', 'site/', 'scripts/', '.claude/', '.sdlc/', 'docs/']
const pathTok = /^[\w.@/-]+\.(?:ts|mjs|md|json|css|html|txt)(?::\d+)?$/
const named = []
for (const m of design.matchAll(/`([^`]+)`(\s*\(new\b)?/g)) {
  const tok = m[1].replace(/:\d+$/, '')
  if (!pathTok.test(m[1])) continue
  let abs
  if (tok.startsWith('measure/')) abs = join(TASK, tok)
  else if (tok.startsWith('proto/')) abs = join(HERE, tok)
  else if (ROOTS.some((r) => tok.startsWith(r))) abs = join(ROOT, tok)
  else continue
  named.push(abs)
  if (m[2]) need(existsSync(dirname(abs)), `parent folder of new file missing: ${tok}`)
  else need(existsSync(abs), `named path does not exist: ${tok}`)
}
need(named.length >= 65, `expected at least 65 resolvable named paths, resolved ${named.length}`)

// 4. child file sets
const childFiles = (name) => {
  const sec = design.split(new RegExp(`^### Child ${name} `, 'm'))[1]?.split(/^### |^## /m)[0] ?? ''
  const idx = sec.indexOf('Files:')
  need(idx >= 0, `child ${name} has no Files: list`)
  return new Set([...sec.slice(idx).matchAll(/^- `([^`]+)`/gm)].map((m) => m[1]))
}
const [A, B, C, D] = ['A', 'B', 'C', 'D'].map(childFiles)
for (const [n, s] of Object.entries({ A, B, C, D })) need(s.size > 0, `child ${n} lists no files`)
const inter = (x, y) => [...x].filter((f) => y.has(f))
for (const [n1, s1, n2, s2] of [['A', A, 'B', B], ['A', A, 'C', C], ['B', B, 'C', C]]) need(inter(s1, s2).length === 0, `children ${n1} and ${n2} share files: ${inter(s1, s2).join(', ')}`)
for (const [n, s] of [['B', B], ['C', C]]) need(inter(D, s).length === 0, `child D shares files with ${n}: ${inter(D, s).join(', ')}`)
const allowedDA = new Set(['packages/agent-ui/a2ui/src/renderer/renderer.ts', '.claude/docs/spec/a2ui-runtime.spec.md', '.claude/docs/lld/a2ui-renderer.lld.md'])
for (const f of inter(D, A)) need(allowedDA.has(f), `child D overlaps child A on an unexpected file: ${f}`)

// 5. section 3.5 lists equal the saved failing sets
const failSet = (file) => new Set([...readFileSync(`${HERE}/${file}`, 'utf8').matchAll(/^ {2}FAIL (\S+)/gm)].map((m) => m[1]))
const v1 = failSet('churn-v1.out.txt')
const v2 = failSet('churn-v2.out.txt')
const v3 = failSet('churn-v3.out.txt')
const sec35 = design.split('### 3.5 Tests')[1]?.split('Not run (real-engine shards')[0] ?? ''
const norm = (p) => p.replace('packages/agent-ui/', '')
const listed = [...sec35.matchAll(/^- `([^`]+\.test\.ts)`/gm)].map((m) => norm(m[1]))
need(v1.size === 17, `churn-v1 must record 17 failing files, found ${v1.size}`)
need(v2.size === 2, `churn-v2 must record 2 failing files, found ${v2.size}`)
need(v3.size === 2 && [...v3].every((f) => v2.has(f)), 'churn-v3 must record the same 2 failing files as churn-v2')
need(listed.length === 17 && new Set(listed).size === 17, `section 3.5 must list 17 distinct failing files, found ${listed.length}`)
for (const f of v1) need(listed.includes(f), `churn-v1 failing file not listed in section 3.5: ${f}`)
for (const f of listed) need(v1.has(f), `section 3.5 lists a file that did not fail in churn-v1: ${f}`)
const dList = [...(sec35.split('Child D (semantic')[1] ?? '').matchAll(/^- `([^`]+\.test\.ts)`/gm)].map((m) => norm(m[1]))
need(dList.length === v2.size && dList.every((f) => v2.has(f)), 'the files listed under child D in section 3.5 must equal churn-v2 failing set')
// every V1 failing file is in exactly one child's list (A, B, C or D)
const union = new Set([...A, ...B, ...C, ...D].map(norm))
for (const f of v1) need(union.has(f), `V1 failing file is not in any child's Files list: ${f}`)

// 6. no em dash; nothing outside .sdlc/ edited
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p] })
for (const f of walk(TASK)) if (/\.(md|mjs|txt|ts|json)$/.test(f) && !/dispatch\.json$/.test(f)) need(!readFileSync(f, 'utf8').includes(String.fromCharCode(0x2014)), `em dash in ${f.replace(`${ROOT}/`, '')}`)
try {
  const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean).filter((l) => !l.slice(3).startsWith('.sdlc/'))
  need(dirty.length === 0, `edits outside .sdlc/: ${dirty.join('; ')}`)
} catch (e) { fails.push(`git status failed: ${e.message}`) }

if (fails.length) { console.error(`FAIL (${fails.length})\n- ${fails.join('\n- ')}`); process.exit(1) }
console.log(`ok: sections, figures, ${named.length} named paths exist, A/B/C disjoint, D overlaps A only on renderer.ts and the two runtime docs, 17 + 2 churn files match the saved runs, no em dash, no edits outside .sdlc/`)
