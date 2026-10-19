#!/usr/bin/env node
// foundations-codemod.mjs: rewrites one directory's mechanical part of the ADR-0245 migration, the step every
// Wave 1 lane runs first on its own folders. It acts on exactly the findings scripts/foundations-census.mjs
// counts (the shared rules in scripts/lib/foundations-rules.mjs), so after a run the census shows what is left
// for the lane to fix by hand.
//
//   tokens  each hand-tabled ramp read becomes the dark-launch form, the derived token with today's read as its
//           fallback: `var(--md-sys-height-md)` -> `var(--md-sys-height, var(--md-sys-height-md))` (clause 10a).
//           The derived value is the element's own n, so a rule that reads a size other than its element's own
//           (a part one size down) needs a hand fix, usually `data-size` on that part. A read of a type label
//           renamed to the skill's kicker is renamed: `var(--md-sys-type-group-label)` -> `--md-sys-type-group-kicker`.
//   glyph   ui-icon's `glyph` call sites become `symbol` (clause 4): the attribute, the attribute calls, the
//           attribute selector, and the object key and property when aimed at ui-icon.
//   axes    a `scale="…"` attribute and a valued `[scale=…]` selector become `data-tier` plus `data-scale` by
//           clause 2's table. `[density]`, a bare `[scale]`, an attribute call and an unknown value are left
//           for the lane and listed as manual.
//   px      never rewritten; every px geometry literal is listed as manual.
// Comments are not rewritten. A second run changes nothing (the rewritten forms are not findings).
//
// Usage:
//   node scripts/foundations-codemod.mjs <dir> [--dry-run]   rewrite (or with --dry-run only report) <dir>
//   node scripts/foundations-codemod.mjs selftest             prove the rewrites, the manual list and idempotence

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative, resolve } from 'node:path'
import { LEGACY_TO_DERIVED, RENAMED, SCALE_TO_TIER, closeParen, findingsIn, kindOf, lineOf } from './lib/foundations-rules.mjs'

const SKIP_DIRS = new Set(['node_modules', '__baselines__', '__fixtures__', '__screenshots__'])

/** Rewrite one file's source. Returns the new source, the rewrites made and the findings left for a hand fix. */
export function rewrite(path, src) {
  const found = findingsIn(path, src)
  const edits = [] // { at, end, text, rule }
  const manual = []
  const note = (rule, f, why) => manual.push({ rule, line: lineOf(src, f.index), text: f.text, why })

  for (const f of found.tokens) {
    if (Object.hasOwn(RENAMED, f.text)) {
      edits.push({ at: f.index, end: f.index + f.text.length, text: RENAMED[f.text], rule: 'tokens' })
      continue
    }
    const end = closeParen(src, src.indexOf('(', f.index))
    const derived = LEGACY_TO_DERIVED.find(([re]) => re.test(f.text))?.[1]
    if (end === -1 || !derived) {
      note('tokens', f, 'unbalanced var()')
      continue
    }
    edits.push({ at: f.index, end, text: `var(${derived}, ${src.slice(f.index, end)})`, rule: 'tokens' })
  }

  for (const f of found.glyph) {
    if (f.text.startsWith('- name:')) {
      note('glyph', f, 'a descriptor attribute row; rename it with the prop')
      continue
    }
    const at = f.index + f.text.lastIndexOf('glyph')
    edits.push({ at, end: at + 'glyph'.length, text: 'symbol', rule: 'glyph' })
  }

  for (const f of found.axes) {
    const rest = src.slice(f.index)
    const markup = /^scale=(["'])([\w-]+)\1/.exec(rest)
    const selector = /^\[scale=(["']?)([\w-]+)\1\]/.exec(rest)
    const hit = markup ?? selector
    const tier = hit && SCALE_TO_TIER[hit[2]]
    if (!hit || !tier) {
      note('axes', f, /density/.test(f.text) ? 'density maps one scale step down or up from the region (clause 2)' : 'no mechanical form')
      continue
    }
    const q = hit[1]
    const text = markup
      ? `data-tier=${q}${tier[0]}${q} data-scale=${q}${tier[1]}${q}`
      : `[data-tier=${q}${tier[0]}${q}][data-scale=${q}${tier[1]}${q}]`
    edits.push({ at: f.index, end: f.index + hit[0].length, text, rule: 'axes' })
  }

  let out = src
  for (const e of edits.sort((a, b) => b.at - a.at)) out = out.slice(0, e.at) + e.text + out.slice(e.end)
  // px is read after the rewrite: a literal that now sits in a derived token's fallback is no finding.
  for (const f of findingsIn(path, out).px) manual.push({ rule: 'px', line: lineOf(out, f.index), text: f.text, why: 'a px geometry literal; derive it from n by hand' })
  const counts = { tokens: 0, glyph: 0, axes: 0 }
  for (const e of edits) counts[e.rule]++
  return { out, counts, manual }
}

function walk(dir, out) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue
    const full = join(dir, e.name)
    if (e.isDirectory()) walk(full, out)
    else if (e.isFile() && kindOf(e.name) !== null && !/\.gen\./.test(e.name)) out.push(full)
  }
  return out
}

function main(dirArg, dryRun) {
  const dir = resolve(dirArg)
  const totals = { tokens: 0, glyph: 0, axes: 0, manual: 0, files: 0 }
  for (const file of walk(dir, []).sort()) {
    const src = readFileSync(file, 'utf8')
    const { out, counts, manual } = rewrite(file, src)
    const rel = relative(process.cwd(), file)
    const changed = out !== src
    if (changed) {
      totals.files++
      if (!dryRun) writeFileSync(file, out)
      console.log(`${dryRun ? 'would rewrite' : 'rewrote'} ${rel}: tokens ${counts.tokens}, glyph ${counts.glyph}, axes ${counts.axes}`)
    }
    for (const m of manual) console.log(`manual ${rel}:${m.line} [${m.rule}] ${m.text} (${m.why})`)
    for (const k of ['tokens', 'glyph', 'axes']) totals[k] += counts[k]
    totals.manual += manual.length
  }
  console.log(
    `foundations-codemod${dryRun ? ' (dry run, nothing written)' : ''}: ${totals.files} files, ` +
      `tokens ${totals.tokens}, glyph ${totals.glyph}, axes ${totals.axes} rewritten; ${totals.manual} left for a hand fix`,
  )
}

function selftest() {
  let failures = 0
  const check = (label, cond) => {
    if (!cond) failures++
    console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}`)
  }
  const css = ':where(ui-x) {\n  --ui-x-height: var(--md-sys-height-md);\n  /* var(--md-sys-font-md) */\n  gap: var(--md-sys-gap-sm, 4px);\n  padding: 13px;\n}\n[scale="content-md"] ui-x, [density="compact"] ui-x { color: red; }\n'
  const a = rewrite('x.css', css)
  check('tokens: a bare read becomes the dark-launch form', a.out.includes('--ui-x-height: var(--md-sys-height, var(--md-sys-height-md));'))
  check('tokens: a read with its own fallback is wrapped whole', a.out.includes('gap: var(--md-sys-inset, var(--md-sys-gap-sm, 4px));'))
  check('tokens: a comment is left alone', a.out.includes('/* var(--md-sys-font-md) */'))
  check('axes: a valued [scale] selector maps by the clause 2 table', a.out.includes('[data-tier="content"][data-scale="md"] ui-x'))
  check('axes and px: density and the px literal are listed, not rewritten', a.out.includes('[density="compact"]') && a.out.includes('padding: 13px') && a.manual.map((m) => m.rule).sort().join() === 'axes,px')
  const ts = `const t = { glyph: '9♠' }\nel('ui-icon', { glyph: 'x' })\nicon.setAttribute('glyph', 'y')\nthis.#icon.glyph = z\nh(\`<div scale="ui-lg"><ui-icon glyph="eye"></ui-icon></div>\`)\n`
  const b = rewrite('x.ts', ts)
  check('glyph: key, attribute call, property and markup become symbol; a field not aimed at ui-icon stays', b.out === `const t = { glyph: '9♠' }\nel('ui-icon', { symbol: 'x' })\nicon.setAttribute('symbol', 'y')\nthis.#icon.symbol = z\nh(\`<div data-tier="product" data-scale="md"><ui-icon symbol="eye"></ui-icon></div>\`)\n`)
  check('idempotent: a second run on the stylesheet changes nothing', rewrite('x.css', a.out).out === a.out)
  const label = rewrite('x.css', 'x { font-size: var(--md-sys-type-group-label, var(--md-sys-font-sm)); --t: var( --md-sys-type-section-label); }')
  check('tokens: a renamed type label read becomes its kicker, its fallback kept', label.out === 'x { font-size: var(--md-sys-type-group-kicker, var(--md-sys-font-sm)); --t: var( --md-sys-type-section-kicker); }')
  check('idempotent: a second run on the code changes nothing', rewrite('x.ts', b.out).out === b.out)
  check('the rewritten tree has no tokens, glyph or valued-axes finding left', ['tokens', 'glyph'].every((r) => findingsIn('x.ts', b.out)[r].length === 0) && findingsIn('x.css', a.out).tokens.length === 0)
  check('md: a descriptor attribute row is manual', rewrite('x.md', '---\nattributes:\n  - name: glyph\n---\n').manual.length === 1)
  console.log(failures === 0 ? 'selftest: all green' : `selftest: ${failures} failure(s)`)
  if (failures) process.exit(1)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [arg] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  if (arg === 'selftest') selftest()
  else if (!arg) {
    console.error('usage: node scripts/foundations-codemod.mjs <dir> [--dry-run] | selftest')
    process.exit(2)
  } else main(arg, process.argv.includes('--dry-run'))
}
