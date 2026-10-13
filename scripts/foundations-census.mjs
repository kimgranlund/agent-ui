#!/usr/bin/env node
// foundations-census.mjs: how much of packages/ and site/ is still on the old foundations (ADR-0245), and
// the blocking gate that keeps it from growing. The rules live in scripts/lib/foundations-rules.mjs (shared
// with the codemod): hand-tabled ramp reads (`tokens`), px geometry literals in stylesheets (`px`), ui-icon's
// renamed `glyph` prop (`glyph`) and the retired `[scale]` / `[density]` axes (`axes`).
//
// The gate reads scripts/foundations-allowlist.json: a flat object, one `"<path>#<rule>": "<why>"` entry per
// line in sorted order, so each Wave 1 lane deletes only its own lines. It fails on a finding whose key is not
// listed (new drift) and on a listed key that no longer finds anything (a stale entry: the lane fixed the file
// and must delete the line). The allowlist starts as every violator on day one, so the gate starts green.
//
// Usage:
//   node scripts/foundations-census.mjs                    print the count per rule and per lane
//   node scripts/foundations-census.mjs --list             also print every <path>#<rule> with its first line
//   node scripts/foundations-census.mjs --gate             exit 1 on any unlisted finding or stale entry
//   node scripts/foundations-census.mjs --write-allowlist  rewrite the allowlist to the current findings,
//                                                          keeping existing reasons (day one and the cut only)
//   node scripts/foundations-census.mjs selftest           prove the rules and the gate diff bite
//   --root <dir>        scan another tree (a scratch copy for a negative control); default: this repo
//   --allowlist <file>  read another allowlist; default: <root>/scripts/foundations-allowlist.json

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative } from 'node:path'
import { RULES, findingsIn, kindOf, lineOf } from './lib/foundations-rules.mjs'

const REPO = fileURLToPath(new URL('..', import.meta.url))
const SCAN_DIRS = ['packages', 'site']
const SKIP_DIRS = new Set(['node_modules', '__baselines__', '__fixtures__', '__screenshots__', 'public'])
const SKIP_FILE = /\.gen\.|(?:^|\/)dogfood-assets\.ts$/

// The Wave 1 partition (.sdlc/foundations-campaign-plan.md); a path outside it names no lane.
const CONTROLS = 'packages/agent-ui/components/src/controls/'
const LANES = {
  a01: 'text-field textarea select combo-box multi-select otp-field field suggestions button toggle segmented-control segment pagination toolbar split rating',
  a02: 'checkbox radio switch slider slider-multi progress gauge choice-card choice-group color-picker',
  a03: 'badge avatar icon stat swatch image video audio attachment file-drop sparkline text',
  a04: 'menu tabs breadcrumb tree list source-list drill ladder swiper calendar table description-list timeline timeline-item status-stream grid row column',
  a05: 'card modal drawer popover tooltip toast form-popover form-provider command-modal disclosure sandbox-frame',
  a06: 'product-card board-grid game-hud playing-card service-card _chart bar-chart column-chart line-chart pie-chart',
}
const PACKAGE_LANES = { a07: 'packages/agent-ui/app/', a08: 'packages/agent-ui/a2ui/', a09: 'packages/agent-ui/code/', a10: 'site/' }

export function laneOf(path) {
  if (path.startsWith(CONTROLS)) {
    const folder = path.slice(CONTROLS.length).split('/')[0]
    for (const [lane, folders] of Object.entries(LANES)) if (folders.split(' ').includes(folder)) return lane
    return null
  }
  for (const [lane, prefix] of Object.entries(PACKAGE_LANES)) if (path.startsWith(prefix)) return lane
  return null
}

const ALIAS = new Set([
  'packages/agent-ui/components/src/controls/icon/icon.md#glyph',
  'packages/agent-ui/components/src/controls/icon/icon.test.ts#glyph',
  'packages/agent-ui/icons/src/glyph-usage-coverage.test.ts#glyph',
])

/** The day-one reason for a key (an existing reason is always kept). */
export function reasonFor(key) {
  const [path, rule] = key.split('#')
  if (ALIAS.has(key)) return 'the deprecated glyph alias, its descriptor row and the proofs that it still resolves; they stay until the W7 cleanup (ADR-0245 cl.10d)'
  if (path.startsWith('packages/agent-ui/shared/src/tokens/')) return `the hand-tabled source the cut (W6) and cleanup (W7) retire (ADR-0245 cl.10b), ${rule}`
  const lane = laneOf(path)
  if (lane) return `lane ${lane} migrates it in Wave 1 (${rule})`
  return `outside the Wave 1 lane partition; the lane-plan step assigns it before dispatch (ADR-0245 cl.10b), ${rule}`
}

function walk(dir, root, out) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    if (e.name.startsWith('.') || SKIP_DIRS.has(e.name) || e.name.startsWith('dist')) continue
    const full = join(dir, e.name)
    if (e.isDirectory()) walk(full, root, out)
    else if (e.isFile() && kindOf(e.name) !== null && !SKIP_FILE.test(full)) out.push(relative(root, full))
  }
  return out
}

/** Every finding under `root`, keyed `<path>#<rule>`, with its count and first line. */
export function census(root) {
  const found = new Map()
  for (const dir of SCAN_DIRS) {
    for (const path of walk(join(root, dir), root, [])) {
      const src = readFileSync(join(root, path), 'utf8')
      const res = findingsIn(path, src)
      for (const rule of RULES) {
        if (res[rule].length) found.set(`${path}#${rule}`, { count: res[rule].length, line: lineOf(src, res[rule][0].index), text: res[rule][0].text })
      }
    }
  }
  return new Map([...found].sort(([a], [b]) => (a < b ? -1 : 1)))
}

/** The gate's diff: findings with no entry, and entries with no finding. */
export function gateDiff(foundKeys, allowKeys) {
  const found = new Set(foundKeys)
  const allow = new Set(allowKeys)
  return { unlisted: [...found].filter((k) => !allow.has(k)), stale: [...allow].filter((k) => !found.has(k)) }
}

export function readAllowlist(file) {
  if (!existsSync(file)) return {}
  return JSON.parse(readFileSync(file, 'utf8'))
}

/** One entry per line, sorted, so lanes delete lines without touching a neighbour. */
export function formatAllowlist(entries) {
  const keys = Object.keys(entries).sort()
  if (keys.length === 0) return '{}\n'
  return `{\n${keys.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(entries[k])}`).join(',\n')}\n}\n`
}

function argValue(flag) {
  const i = process.argv.indexOf(flag)
  return i === -1 ? undefined : process.argv[i + 1]
}

function main() {
  const root = argValue('--root') ?? REPO
  const allowFile = argValue('--allowlist') ?? join(root, 'scripts/foundations-allowlist.json')
  const found = census(root)
  const files = new Set([...found.keys()].map((k) => k.split('#')[0]))

  if (process.argv.includes('--write-allowlist')) {
    const old = readAllowlist(allowFile)
    const next = Object.fromEntries([...found.keys()].map((k) => [k, old[k] ?? reasonFor(k)]))
    writeFileSync(allowFile, formatAllowlist(next))
    console.log(`foundations-census: wrote ${Object.keys(next).length} entries to ${relative(root, allowFile)}`)
    return
  }

  if (process.argv.includes('--gate')) {
    const { unlisted, stale } = gateDiff(found.keys(), Object.keys(readAllowlist(allowFile)))
    for (const k of unlisted) {
      const f = found.get(k)
      console.error(`unlisted: ${k} (${f.count}) line ${f.line}: ${f.text}`)
    }
    for (const k of stale) console.error(`stale: ${k} no longer finds anything; delete its allowlist line`)
    if (unlisted.length || stale.length) {
      console.error(`foundations-census --gate: ${unlisted.length} unlisted, ${stale.length} stale (ADR-0245; fix the file or the allowlist line)`)
      process.exit(1)
    }
    console.log(`foundations-census --gate: green, ${found.size} allowlisted findings in ${files.size} files`)
    return
  }

  const byRule = Object.fromEntries(RULES.map((r) => [r, 0]))
  const byLane = {}
  for (const key of found.keys()) {
    const [path, rule] = key.split('#')
    byRule[rule]++
    const lane = laneOf(path) ?? 'none'
    byLane[lane] = (byLane[lane] ?? new Set()).add(path)
  }
  console.log(`foundations census: ${files.size} files still on the old foundations`)
  for (const r of RULES) console.log(`  ${r.padEnd(6)} ${byRule[r]} files`)
  console.log('  by lane:')
  for (const lane of Object.keys(byLane).sort()) console.log(`    ${lane.padEnd(4)} ${byLane[lane].size} files`)
  if (process.argv.includes('--list')) for (const [k, f] of found) console.log(`${k} (${f.count}) line ${f.line}: ${f.text}`)
}

function selftest() {
  let failures = 0
  const check = (label, cond) => {
    if (!cond) failures++
    console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}`)
  }
  const rule = (path, src, r) => findingsIn(path, src)[r].length
  check('px: a planted padding: 13px is found', rule('a.css', ':where(x) { padding: 13px; }', 'px') === 1)
  check('px: 0, the 1px hairline and a derived fallback pass', rule('a.css', 'x { border-width: 1px; margin: 0px; padding: var(--md-sys-inset, 7px); }', 'px') === 0)
  check('px: a px in a comment or a non-geometry property passes', rule('a.css', '/* padding: 13px */ x { outline-offset: 2px; box-shadow: 0 2px 4px red; }', 'px') === 0)
  check('px: a --ui-*-height token literal is found', rule('a.css', ':where(x) { --ui-x-height: 36px; }', 'px') === 1)
  check('tokens: a bare ramp read is found', rule('a.css', 'x { block-size: var(--md-sys-height-md); }', 'tokens') === 1)
  check('tokens: the dark-launch form passes', rule('a.css', 'x { block-size: var(--md-sys-height, var(--md-sys-height-md)); }', 'tokens') === 0)
  check('tokens: a fallback of a non-derived token is still found', rule('a.css', 'x { block-size: var(--ui-x-h, var(--md-sys-height-md)); }', 'tokens') === 1)
  check('tokens: --md-sys-icon-size (ui-icon 1em) is not a ramp read', rule('a.css', 'x { inline-size: var(--md-sys-icon-size); }', 'tokens') === 0)
  check('glyph: attribute, key, property and attribute call are found', rule('a.ts', `h('<ui-icon glyph="x">'); el('ui-icon', { glyph: 'x' }); icon.glyph = 'y'; i.setAttribute('glyph', 'z')`, 'glyph') === 4)
  check('glyph: data-glyph, ui-glyph, glyph-box, a ternary and a comment pass', rule('a.ts', `// icon.glyph = 'x'\nh('<ui-glyph symbol="x" data-glyph="y">'); const v = ok ? glyph : none; s('--md-sys-glyph-box')`, 'glyph') === 0)
  check('glyph: a descriptor attribute row is found, a part named glyph is not', rule('a.md', '---\nattributes:\n  - name: glyph\n    type: string\nparts:\n  - name: glyph\n---', 'glyph') === 1)
  check('glyph: a glyph field not aimed at ui-icon passes', rule('a.ts', `const s = { glyph: '9♠' }; r.glyph; this.#part.glyph = el`, 'glyph') === 0)
  check('axes: selector, markup and attribute call are found', rule('a.ts', `q('[scale="ui-lg"]'); h('<div density="compact">'); e.setAttribute('scale', 'x')`, 'axes') === 3)
  check('axes: a css selector is found', rule('a.css', ':is([scale="ui-lg"]) x { color: red; }', 'axes') === 1)
  check('axes: data-scale, transform scale() and --md-sys-scale pass', rule('a.css', 'x[data-scale="sm"] { transform: scale(2); font-size: calc(1px * var(--md-sys-scale)); }', 'axes') === 0)
  check('axes: a test title or comment naming [scale] passes', rule('a.ts', `it('no [size]/[scale] selector', () => {}) // [density]`, 'axes') === 0)
  const d = gateDiff(['a#px', 'b#px'], ['a#px', 'c#glyph'])
  check('gate: an unlisted finding and a stale entry are both reported', d.unlisted.join() === 'b#px' && d.stale.join() === 'c#glyph')
  check('gate: a listed finding is green', gateDiff(['a#px'], ['a#px']).unlisted.length + gateDiff(['a#px'], ['a#px']).stale.length === 0)
  check('allowlist: one entry per line, sorted, valid JSON', formatAllowlist({ 'b#px': 'y', 'a#px': 'x' }) === '{\n  "a#px": "x",\n  "b#px": "y"\n}\n' && JSON.parse(formatAllowlist({ a: 'b' })).a === 'b')
  check('lanes: a control folder, a package and an unassigned folder', laneOf(`${CONTROLS}button/button.css`) === 'a01' && laneOf('site/x.ts') === 'a10' && laneOf(`${CONTROLS}_surface/x.css`) === null)
  console.log(failures === 0 ? 'selftest: all green' : `selftest: ${failures} failure(s)`)
  if (failures) process.exit(1)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv[2] === 'selftest') selftest()
  else main()
}
