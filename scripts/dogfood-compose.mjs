#!/usr/bin/env node
// dogfood-compose.mjs: the composition lint (T-0136, layer 2 of .claude/docs/references/dogfood-lint.md). It
// reads the A2UI factories, the A2UI example payloads (the seeds), the agent-admin presets and the site demos,
// and finds a composition the library already has a control for: the "use X, not Y" table is the `compose`
// array of scripts/dogfood-rules.json (date-field, board-grid, inline-geometry). Detection is textual over
// source with comments blanked, like foundations-census.mjs; the payload rules read the `{ id, component }`
// objects of a file and resolve child ids within that file.
//
// The gate reads scripts/dogfood-compose-allowlist.json: one `"<path>#<rule>": "<why>"` entry per line in
// sorted order. It fails on a finding whose key is not listed and on a listed key that finds nothing (stale).
//
// Usage:
//   node scripts/dogfood-compose.mjs                    print every finding
//   node scripts/dogfood-compose.mjs --gate             exit 1 on any unlisted finding or stale entry
//   node scripts/dogfood-compose.mjs --write-allowlist  rewrite the allowlist to the current findings, keeping reasons
//   node scripts/dogfood-compose.mjs selftest           prove every rule and the gate diff bite
//   --root <dir>        scan another tree (a scratch copy for a negative control); default: this repo
//   --allowlist <file>  read another allowlist; default: <root>/scripts/dogfood-compose-allowlist.json

import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { join, relative } from 'node:path'
import { formatAllowlist, gateDiff, readAllowlist } from './foundations-census.mjs'

const REPO = fileURLToPath(new URL('..', import.meta.url))
const RULES = JSON.parse(readFileSync(new URL('./dogfood-rules.json', import.meta.url), 'utf8')).compose.map((r) => r.id)

/** The scan set: [directory, file predicate]. Tests, generated files and fixtures are never composition. */
const SCAN = [
  ['packages/agent-ui/a2ui/src/catalog', (p) => p.endsWith('/factories.ts')],
  ['packages/agent-ui/a2ui/src/examples', (p) => p.endsWith('.ts')],
  ['site/pages', (p) => p.endsWith('-demo.ts') || p.endsWith('/agent-admin-presets.ts')],
]
const SKIP_FILE = /\.test\.ts$|\.gen\.|__fixtures__/

/** Blank every comment to spaces (indices and line numbers survive), leaving strings intact. */
export function stripComments(src) {
  const out = src.split('')
  const stack = [] // open template literals; a `${` inside one pushes 'expr'
  let i = 0
  const blank = (from, to) => {
    for (let k = from; k < to; k++) if (out[k] !== '\n') out[k] = ' '
  }
  while (i < src.length) {
    const ch = src[i]
    const top = stack[stack.length - 1]
    if (top === 'tpl') {
      if (ch === '\\') i += 2
      else if (ch === '`') { stack.pop(); i++ }
      else if (ch === '$' && src[i + 1] === '{') { stack.push('expr'); i += 2 }
      else i++
      continue
    }
    if (ch === '/' && src[i + 1] === '/') {
      const end = src.indexOf('\n', i)
      const stop = end === -1 ? src.length : end
      blank(i, stop)
      i = stop
    } else if (ch === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2)
      const stop = end === -1 ? src.length : end + 2
      blank(i, stop)
      i = stop
    } else if (ch === "'" || ch === '"') {
      i++
      while (i < src.length && src[i] !== ch && src[i] !== '\n') i += src[i] === '\\' ? 2 : 1
      i++
    } else if (ch === '`') {
      stack.push('tpl')
      i++
    } else if (ch === '{' && top === 'expr') {
      stack.push('expr')
      i++
    } else if (ch === '}' && top === 'expr') {
      stack.pop()
      i++
    } else i++
  }
  return out.join('')
}

/** Every `{ ... }` span of the (comment-free) source, outside strings: [open, close] index pairs. */
export function braceSpans(src) {
  const spans = []
  const open = []
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    if (ch === "'" || ch === '"') {
      i++
      while (i < src.length && src[i] !== ch && src[i] !== '\n') i += src[i] === '\\' ? 2 : 1
    } else if (ch === '`') {
      // a template literal's `${ }` holes count as code; its text does not
      i++
      let depth = 0
      while (i < src.length) {
        if (src[i] === '\\') i++
        else if (depth === 0 && src[i] === '`') break
        else if (src[i] === '$' && src[i + 1] === '{') { depth++; open.push(i + 1); i++ }
        else if (depth > 0 && src[i] === '{') open.push(i)
        else if (depth > 0 && src[i] === '}') {
          const from = open.pop()
          if (from !== undefined) spans.push([from, i])
          if (src[from] === '{' && src[from - 1] === '$') depth--
        }
        i++
      }
    } else if (ch === '{') open.push(i)
    else if (ch === '}') {
      const from = open.pop()
      if (from !== undefined) spans.push([from, i])
    }
    i++
  }
  return spans
}

/** Every `ui-*` element the source creates: createElement / el / h calls and `<ui-x` markup, with indices. */
export function createdTags(src) {
  const out = []
  const re = /(?:createElement|\bel|\bh)\(\s*['"`](ui-[a-z0-9-]+)['"`]|<(ui-[a-z0-9-]+)[\s>/]/g
  for (const m of src.matchAll(re)) out.push({ tag: m[1] ?? m[2], index: m.index })
  return out
}

const CALENDAR_ICON = /\b(?:icon|name)['"]?\s*(?:[:=]|,)\s*\\?['"]calendar[\w-]*\\?['"]/g
const LOOP = /\bfor\s*\(|\.forEach\(|\.map\(|Array\.from\(/

/** The payload components of a source: `{ id, component }` objects with the child ids they reference. */
export function payloadComponents(src, spans = braceSpans(src)) {
  const comps = []
  for (const m of src.matchAll(/['"]?\bcomponent['"]?\s*:\s*['"]([A-Z]\w*)['"]/g)) {
    // the innermost object around the `component` key is the component
    let span = null
    for (const s of spans) if (s[0] < m.index && m.index < s[1] && (!span || s[0] > span[0])) span = s
    if (!span) continue
    const text = src.slice(span[0], span[1] + 1)
    // blank nested objects so an `id` inside an action or a template does not read as the component's
    let flat = text.split('')
    for (const s of spans) if (s[0] > span[0] && s[1] < span[1]) for (let k = s[0] - span[0]; k <= s[1] - span[0]; k++) flat[k] = ' '
    flat = flat.join('')
    const id = flat.match(/['"]?\bid['"]?\s*:\s*['"]([^'"]+)['"]/)?.[1]
    if (!id) continue
    const refs = [...flat.matchAll(/['"]([\w-]+)['"]/g)].map((r) => r[1])
    const template = text.match(/['"]?componentId['"]?\s*:\s*['"]([^'"]+)['"]/)?.[1] ?? null
    const explicit = flat.match(/['"]?\bchildren['"]?\s*:\s*\[([^\]]*)\]/)?.[1]
    const children = explicit ? [...explicit.matchAll(/['"]([^'"]+)['"]/g)].map((r) => r[1]) : []
    comps.push({ id, component: m[1], index: m.index, refs, template, children })
  }
  return comps
}

/** Every finding of every compose rule in one file: { rule: [{ index, text }] }. */
export function findingsIn(path, raw) {
  const src = stripComments(raw)
  const res = Object.fromEntries(RULES.map((r) => [r, []]))
  const spans = braceSpans(src)
  if (path.startsWith('site/')) spans.push([-1, src.length]) // a site page is a top-level script
  const tags = createdTags(src)
  const inSpan = (s, i) => s[0] < i && i < s[1]
  const snippet = (i) => {
    const end = src.indexOf('\n', i)
    return src.slice(src.lastIndexOf('\n', i) + 1, end === -1 ? src.length : end).trim().slice(0, 120)
  }

  // date-field: a ui-calendar composed with a popover or a calendar-icon trigger, in one block
  const calendars = tags.filter((t) => t.tag === 'ui-calendar')
  const triggers = [...tags.filter((t) => t.tag === 'ui-popover' || t.tag === 'ui-form-popover').map((t) => t.index), ...[...src.matchAll(CALENDAR_ICON)].map((m) => m.index)]
  for (const cal of calendars) {
    if (spans.some((s) => inSpan(s, cal.index) && triggers.some((t) => inSpan(s, t)))) res['date-field'].push({ index: cal.index, text: snippet(cal.index) })
  }

  // board-grid: ui-buttons made in a loop in the block that makes the ui-grid
  const grids = tags.filter((t) => t.tag === 'ui-grid')
  const buttons = tags.filter((t) => t.tag === 'ui-button')
  for (const g of grids) {
    const hit = spans.some((s) => inSpan(s, g.index) && LOOP.test(src.slice(Math.max(0, s[0]), s[1])) && buttons.some((b) => inSpan(s, b.index)))
    if (hit) res['board-grid'].push({ index: g.index, text: snippet(g.index) })
  }

  // the payload forms of both
  const comps = payloadComponents(src, spans)
  const byId = new Map(comps.map((c) => [c.id, c]))
  for (const c of comps) {
    if ((c.component === 'Popover' || c.component === 'FormPopover') && c.refs.some((r) => r !== c.id && byId.get(r)?.component === 'Calendar')) {
      res['date-field'].push({ index: c.index, text: snippet(c.index) })
    }
    if (c.component === 'Grid') {
      const kids = c.children.map((k) => byId.get(k)?.component)
      const allButtons = kids.length >= 3 && kids.every((k) => k === 'Button')
      const templateButton = c.template !== null && byId.get(c.template)?.component === 'Button'
      if (allButtons || templateButton) res['board-grid'].push({ index: c.index, text: snippet(c.index) })
    }
  }

  // inline-geometry
  for (const f of inlineGeometry(src)) res['inline-geometry'].push({ index: f.index, text: snippet(f.index) })
  for (const r of RULES) res[r].sort((a, b) => a.index - b.index)
  return res
}

const GEOMETRY = /^(?:padding|margin|gap|row-gap|column-gap|border(?:-[a-z]+)*-radius|height|min-height|max-height|block-size|min-block-size|max-block-size|font-size|line-height)(?:-(?:top|right|bottom|left|block|inline|start|end))*(?:-(?:start|end))?$/
const LENGTH = /(?<![\w.-])(\d*\.?\d+)(px|rem|em)\b/g

/** True when a declaration value carries a literal length other than 0 and the 1px hairline. */
function literalLength(value) {
  for (const m of value.replace(/\$\{[^}]*\}/g, '').matchAll(LENGTH)) {
    const n = Number(m[1])
    if (n !== 0 && !(n === 1 && m[2] === 'px')) return true
  }
  return false
}

const kebab = (prop) => prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)

/** Every inline style write of a geometry property to a literal length. */
export function inlineGeometry(src) {
  const out = []
  // a quoted string whose quote is capture group `g` and whose body is group `g + 1`
  const str = (g) => `(['"\`])((?:\\\\.|(?!\\${g})[^\\\\])*)\\${g}`
  const declarations = (body, index) => {
    for (const decl of body.split(';')) {
      const [prop, ...rest] = decl.split(':')
      if (rest.length && GEOMETRY.test(prop.trim().toLowerCase()) && literalLength(rest.join(':'))) { out.push({ index }); return }
    }
  }
  for (const m of src.matchAll(new RegExp(String.raw`\.style\.([a-zA-Z]+)\s*=\s*${str(2)}`, 'g'))) {
    if (m[1] === 'cssText') declarations(m[3], m.index)
    else if (GEOMETRY.test(kebab(m[1])) && literalLength(m[3])) out.push({ index: m.index })
  }
  for (const m of src.matchAll(new RegExp(String.raw`\.style\.setProperty\(\s*['"]([a-z-]+)['"]\s*,\s*${str(2)}`, 'g'))) {
    if (GEOMETRY.test(m[1]) && literalLength(m[3])) out.push({ index: m.index })
  }
  for (const m of src.matchAll(/\bstyle\s*=\s*\\?(["'])([^"'\\]*)\\?\1/g)) declarations(m[2], m.index)
  for (const m of src.matchAll(new RegExp(String.raw`[{,]\s*['"]?style['"]?\s*:\s*${str(1)}`, 'g'))) declarations(m[2], m.index)
  for (const m of src.matchAll(new RegExp(String.raw`setAttribute\(\s*['"]style['"]\s*,\s*${str(1)}`, 'g'))) declarations(m[2], m.index)
  return out.sort((a, b) => a.index - b.index).filter((f, i, all) => i === 0 || all[i - 1].index !== f.index)
}

const lineOf = (src, index) => src.slice(0, index).split('\n').length

function walk(dir, root, keep, out) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue
    const full = join(dir, e.name)
    const rel = relative(root, full)
    if (e.isDirectory()) walk(full, root, keep, out)
    else if (e.isFile() && keep(rel) && !SKIP_FILE.test(rel)) out.push(rel)
  }
  return out
}

/** Every finding under `root`, keyed `<path>#<rule>`, with its count and first line. */
export function compose(root) {
  const found = new Map()
  for (const [dir, keep] of SCAN) {
    for (const path of walk(join(root, dir), root, keep, [])) {
      const src = readFileSync(join(root, path), 'utf8')
      const res = findingsIn(path, src)
      for (const rule of RULES) {
        if (res[rule].length) found.set(`${path}#${rule}`, { count: res[rule].length, line: lineOf(src, res[rule][0].index), text: res[rule][0].text })
      }
    }
  }
  return new Map([...found].sort(([a], [b]) => (a < b ? -1 : 1)))
}

function argValue(flag) {
  const i = process.argv.indexOf(flag)
  return i === -1 ? undefined : process.argv[i + 1]
}

function main() {
  const root = argValue('--root') ?? REPO
  const allowFile = argValue('--allowlist') ?? join(root, 'scripts/dogfood-compose-allowlist.json')
  const found = compose(root)

  if (process.argv.includes('--write-allowlist')) {
    const old = readAllowlist(allowFile)
    const next = Object.fromEntries([...found.keys()].map((k) => [k, old[k] ?? 'TODO: why this composition stays']))
    writeFileSync(allowFile, formatAllowlist(next))
    console.log(`dogfood-compose: wrote ${Object.keys(next).length} entries to ${relative(root, allowFile)}`)
    return
  }

  if (process.argv.includes('--gate')) {
    const allow = readAllowlist(allowFile)
    const { unlisted, stale } = gateDiff(found.keys(), Object.keys(allow))
    const unreasoned = Object.entries(allow).filter(([, why]) => typeof why !== 'string' || why.trim() === '' || why.startsWith('TODO'))
    for (const k of unlisted) {
      const f = found.get(k)
      console.error(`unlisted: ${k} (${f.count}) line ${f.line}: ${f.text}`)
    }
    for (const k of stale) console.error(`stale: ${k} no longer finds anything; delete its allowlist line`)
    for (const [k] of unreasoned) console.error(`no reason: ${k} needs a reason in the allowlist`)
    if (unlisted.length || stale.length || unreasoned.length) {
      console.error(`dogfood-compose --gate: ${unlisted.length} unlisted, ${stale.length} stale, ${unreasoned.length} without a reason (scripts/dogfood-rules.json; fix the composition or the allowlist line)`)
      process.exit(1)
    }
    console.log(`dogfood-compose --gate: green, ${found.size} allowlisted findings`)
    return
  }

  for (const [k, f] of found) console.log(`${k} (${f.count}) line ${f.line}: ${f.text}`)
  console.log(`dogfood-compose: ${found.size} findings`)
}

function selftest() {
  let failures = 0
  const check = (label, cond) => {
    if (!cond) failures++
    console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}`)
  }
  const n = (path, src, r) => findingsIn(path, src)[r].length
  const F = 'packages/agent-ui/a2ui/src/catalog/x/factories.ts'
  const tested = new Set()
  const rule = (r, label, cond) => {
    tested.add(r)
    check(`${r}: ${label}`, cond)
  }

  // date-field: the pre-T-0135 BookingForm shape, and what stays legal
  rule('date-field', 'a ui-calendar in a ui-popover in one factory is found', n(F, `function f() { const p = el('ui-popover'); const c = document.createElement('ui-calendar'); p.append(c) }`, 'date-field') === 1)
  rule('date-field', 'a ui-calendar beside a calendar-icon ui-button is found', n(F, `function f() { const b = el('ui-button', { icon: 'calendar' }); const c = el('ui-calendar') }`, 'date-field') === 1)
  rule('date-field', 'a payload Popover holding a Calendar is found', n(F, `const p = [{ id: 'pop', component: 'Popover', trigger: 'go', content: 'cal' }, { id: 'cal', component: 'Calendar' }, { id: 'go', component: 'Button' }]`, 'date-field') === 1)
  rule('date-field', 'a lone ui-calendar, and two factories in separate top-level calls, pass', n(F, `const a = accessorFactory('ui-calendar', []); const b = accessorFactory('ui-popover', [])`, 'date-field') === 0 && n(F, `function f() { return el('ui-calendar') }`, 'date-field') === 0)
  rule('date-field', 'a site page is one block: calendar plus popover at top level is found', n('site/pages/x-demo.ts', `const c = el('ui-calendar')\nconst p = el('ui-popover')`, 'date-field') === 1)
  rule('date-field', 'a comment naming the old shape passes', n(F, `function f() { // ui-calendar in a <ui-popover>\n return el('ui-text-field', { type: 'date' }) }`, 'date-field') === 0)

  // board-grid
  rule('board-grid', 'a Grid of three Buttons is found', n(F, `const p = [{ id: 'g', component: 'Grid', children: ['a', 'b', 'c'] }, { id: 'a', component: 'Button' }, { id: 'b', component: 'Button' }, { id: 'c', component: 'Button' }]`, 'board-grid') === 1)
  rule('board-grid', 'a Grid templated over a Button is found', n(F, `const p = [{ id: 'g', component: 'Grid', children: { path: '/cells', componentId: 'cell' } }, { id: 'cell', component: 'Button', label: 'x' }]`, 'board-grid') === 1)
  rule('board-grid', 'a Grid of cards and one button passes', n(F, `const p = [{ id: 'g', component: 'Grid', children: ['a', 'b', 'c'] }, { id: 'a', component: 'Card' }, { id: 'b', component: 'Button' }, { id: 'c', component: 'Card' }]`, 'board-grid') === 0)
  rule('board-grid', 'ui-buttons made in a loop into a ui-grid are found', n(F, `function f() { const g = el('ui-grid'); for (let i = 0; i < 9; i++) g.append(el('ui-button')) }`, 'board-grid') === 1)
  rule('board-grid', 'a ui-grid beside one ui-button with no loop passes', n(F, `function f() { const g = el('ui-grid'); const b = el('ui-button') }`, 'board-grid') === 0)

  // inline-geometry
  rule('inline-geometry', 'style.padding = 12px is found', n(F, `function f() { x.style.padding = '12px' }`, 'inline-geometry') === 1)
  rule('inline-geometry', 'cssText with a gap literal is found', n(F, `x.style.cssText = 'display:flex; gap:0.75rem;'`, 'inline-geometry') === 1)
  rule('inline-geometry', 'setProperty border-radius and a style="" attribute are found', n(F, `x.style.setProperty('border-radius', '4px'); h('<div style="margin: 8px">')`, 'inline-geometry') === 2)
  rule('inline-geometry', 'a style: key in an element helper is found', n(F, `el('div', { style: 'font-size: 11px' })`, 'inline-geometry') === 1)
  rule('inline-geometry', 'widths, flex, 0, the 1px hairline, tokens and custom properties pass', n(F, `x.style.maxInlineSize = '28rem'; x.style.flex = '1 1 8rem'; x.style.margin = '0'; x.style.blockSize = '1px'; x.style.gap = 'var(--md-sys-gap)'; x.style.setProperty('--ui-x-min-block-size', '11em')`, 'inline-geometry') === 0)

  // the parsers the rules stand on
  check('strip: comments blank to spaces, strings and lines survive', stripComments(`a // b\n'//c' /* d */ e`) === `a     \n'//c'         e`)
  check('strip: a // inside a template hole string stays', stripComments('`x ${"//y"} z` // w') === '`x ${"//y"} z`     ')
  check('spans: nested objects nest, braces in strings do not count', JSON.stringify(braceSpans(`{ a: { b: '{' } }`)) === '[[5,14],[0,16]]')
  check('payload: an id in a nested action is not the component id', payloadComponents(`[{ component: 'Button', action: { id: 'evt' }, id: 'btn' }]`)[0]?.id === 'btn')

  // the walk: a violation planted in a scratch tree is found under its own key, and a test file is skipped
  const scratch = mkdtempSync(join(tmpdir(), 'dogfood-compose-'))
  try {
    mkdirSync(join(scratch, 'site/pages'), { recursive: true })
    writeFileSync(join(scratch, 'site/pages/x-demo.ts'), `row.style.gap = '12px'\n`)
    writeFileSync(join(scratch, 'site/pages/x-demo.test.ts'), `row.style.gap = '12px'\n`)
    check('walk: a planted demo finding is keyed <path>#<rule>, its test twin is skipped', [...compose(scratch).keys()].join() === 'site/pages/x-demo.ts#inline-geometry')
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }

  // the gate diff is shared with the census (its selftest proves it); the rule table is covered here
  const d = gateDiff(['a#date-field', 'b#board-grid'], ['a#date-field', 'c#inline-geometry'])
  check('gate: an unlisted finding and a stale entry are both reported', d.unlisted.join() === 'b#board-grid' && d.stale.join() === 'c#inline-geometry')
  check(`rules: every compose rule in dogfood-rules.json has a selftest case (${RULES.join(', ')})`, RULES.length > 0 && RULES.every((r) => tested.has(r)))
  check('rules: every compose rule carries id, adr, use, not and detect', JSON.parse(readFileSync(new URL('./dogfood-rules.json', import.meta.url), 'utf8')).compose.every((r) => ['id', 'adr', 'use', 'not', 'detect'].every((k) => typeof r[k] === 'string' && r[k] !== '')))
  console.log(failures === 0 ? 'selftest: all green' : `selftest: ${failures} failure(s)`)
  if (failures) process.exit(1)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv[2] === 'selftest') selftest()
  else main()
}
