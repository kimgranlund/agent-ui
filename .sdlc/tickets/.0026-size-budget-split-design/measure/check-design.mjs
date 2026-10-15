// Acceptance check for T-0026 (read-only). Exit 0 when: design.md has the required sections; every figure it leans on
// appears in the saved harness output; every slice names its files and each path exists (or is marked `(new)` with an
// existing parent folder); no em dash anywhere in the task folder's text; no edit outside the task folder.
// Usage (from the repo root): node .sdlc/0026-size-budget-split-design/measure/check-design.mjs
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
for (const h of ['## 1. Premise check', '## 2. Current import graph', '## 4. Options', '## 6. Recommendation', '## 7. Decomposition', '## 8. The ADR', '## 9. Rejected alternatives'])
  need(design.includes(h), `design.md missing section "${h}"`)

// 1. figures in the write-up must come from the saved outputs
const out = ['stubs.out.txt', 'prototype.out.txt', 'size-app-rows.out.txt'].map((f) => readFileSync(`${HERE}/${f}`, 'utf8')).join('\n')
const fmt = (n) => String(n)
for (const n of [71231, 72027, 66214, 57167, 56261, 44536, 4794, 11564, 11268, 5798, 5590, 3099, 889, 312, 1885, 2473, 1450, 4544, 3442, 2648, 2809, 33616, 33642, 14970, 14064, 5017, 26695]) {
  need(out.includes(fmt(n)), `figure ${n} is not in the saved harness outputs`)
  const withComma = n.toLocaleString('en-US')
  need(design.includes(withComma) || design.includes(fmt(n)), `figure ${withComma} is not in design.md`)
}

// 2. each slice names its files
const slices = design.split(/^### Slice /m).slice(1)
need(slices.length >= 5, `expected at least 5 slices, found ${slices.length}`)
for (const sl of slices) {
  const title = sl.split('\n')[0]
  const files = [...sl.matchAll(/^- `([^`]+)`( \(new\b)?/gm)].filter((m) => !m[1].startsWith('SPEC') && /[./]/.test(m[1]))
  const idx = sl.indexOf('Files:')
  need(idx >= 0, `slice "${title}" has no Files: list`)
  const listed = idx >= 0 ? [...sl.slice(idx).matchAll(/^- `([^`]+)`( \(new\b)?/gm)] : []
  need(listed.length > 0, `slice "${title}" lists no files`)
  for (const [, path, isNew] of listed) {
    if (isNew) need(existsSync(dirname(join(ROOT, path))), `slice "${title}": parent folder of new file missing: ${path}`)
    else need(existsSync(join(ROOT, path)), `slice "${title}": file does not exist: ${path}`)
  }
}

// 3. no em dash in the task folder's own text (the generated proto/ sources are included)
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p] })
for (const f of walk(TASK)) if (/\.(md|mjs|txt|ts|json|jsonl)$/.test(f) && !/dispatch\.json$|runs\.jsonl$/.test(f))
  need(!readFileSync(f, 'utf8').includes(String.fromCharCode(0x2014)), `em dash in ${f.replace(ROOT + '/', '')}`)

// 4. nothing outside the task folder is modified or added
try {
  const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)
    .filter((l) => !l.slice(3).startsWith('.sdlc/'))
  need(dirty.length === 0, `edits outside .sdlc/: ${dirty.join('; ')}`)
} catch (e) { fails.push(`git status failed: ${e.message}`) }

if (fails.length) { console.error('FAIL\n- ' + fails.join('\n- ')); process.exit(1) }
console.log('ok: sections, figures, slice file lists, no em dash, no edits outside the task folder')
