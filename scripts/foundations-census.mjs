#!/usr/bin/env node
// foundations-census.mjs: how much of packages/ and site/ is still on the old foundations (ADR-0245), and
// the blocking gate that keeps it from growing. The rules live in scripts/lib/foundations-rules.mjs (shared
// with the codemod): hand-tabled ramp reads (`tokens`), px geometry literals in stylesheets (`px`), ui-icon's
// renamed `glyph` prop (`glyph`) and the retired `[scale]` / `[density]` axes (`axes`).
//
// The gate reads scripts/foundations-allowlist.json: a flat object, one `"<path>#<rule>": "<why>"` entry per
// line in sorted order, so a lane deletes only its own lines. It fails on a finding whose key is not
// listed (new drift) and on a listed key that no longer finds anything (a stale entry: the lane fixed the file
// and must delete the line). The allowlist starts as every violator on day one, so the gate starts green.
//
// Usage:
//   node scripts/foundations-census.mjs                    print the count per rule
//   node scripts/foundations-census.mjs --list             also print every <path>#<rule> with its first line
//   node scripts/foundations-census.mjs --gate             exit 1 on any unlisted finding, stale entry or
//                                                          reason that names no owner
//   node scripts/foundations-census.mjs --write-allowlist  rewrite the allowlist to the current findings,
//                                                          keeping existing reasons; new keys need
//                                                          --reason naming an owner (hasOwner)
//   node scripts/foundations-census.mjs selftest           prove the rules and the gate diff bite
//   --root <dir>        scan another tree (a scratch copy for a negative control); default: this repo
//   --allowlist <file>  read another allowlist; default: <root>/scripts/foundations-allowlist.json

import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { join, relative } from 'node:path'
import { RULES, findingsIn, hasOwner, kindOf, lineOf } from './lib/foundations-rules.mjs'

const REPO = fileURLToPath(new URL('..', import.meta.url))
const SCAN_DIRS = ['packages', 'site']
const SKIP_DIRS = new Set(['node_modules', '__baselines__', '__fixtures__', '__screenshots__', 'public'])
// The two vendored modules (T-0372) are byte copies of their source: no rule applies, nothing there is edited. The
// match runs on the repo-relative path and names the two files only, so a repo-authored file beside them (the
// `.d.mts` type surfaces) or under any other vendor-named folder is still scanned.
export const SKIP_FILE = /\.gen\.|(?:^|\/)dogfood-assets\.ts$|(?:^|\/)tokens\/vendor\/mathematical-design-system\/(?:scale|curvature)\.mjs$/

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
    else if (e.isFile() && kindOf(e.name) !== null && !SKIP_FILE.test(relative(root, full))) out.push(relative(root, full))
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

/** The allowlist --write-allowlist writes: existing reasons kept, each new key given `reason`, which must name an
 *  owner (hasOwner, the dogfood gates' check: a T-NNNN ticket, an ADR-NNNN or a ruling). Returns null when a new key
 *  needs a reason and `reason` names no owner, so nothing is written. */
export function nextAllowlist(foundKeys, old, reason) {
  const keys = [...foundKeys]
  if (keys.some((k) => !(k in old)) && !hasOwner(reason)) return null
  return Object.fromEntries(keys.map((k) => [k, old[k] ?? reason]))
}

/** Allowlist keys whose reason names no owner. */
export const unreasoned = (allow) => Object.keys(allow).filter((k) => !hasOwner(allow[k]))

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
    const next = nextAllowlist(found.keys(), readAllowlist(allowFile), argValue('--reason'))
    if (next === null) {
      console.error('foundations-census --write-allowlist: a new key needs --reason "<why>" naming its owner (T-NNNN, ADR-NNNN or a ruling)')
      process.exit(1)
    }
    writeFileSync(allowFile, formatAllowlist(next))
    console.log(`foundations-census: wrote ${Object.keys(next).length} entries to ${relative(root, allowFile)}`)
    return
  }

  if (process.argv.includes('--gate')) {
    const allow = readAllowlist(allowFile)
    const { unlisted, stale } = gateDiff(found.keys(), Object.keys(allow))
    const noOwner = unreasoned(allow)
    for (const k of noOwner) console.error(`unreasoned: ${k} names no owner (T-NNNN, ADR-NNNN or a ruling)`)
    for (const k of unlisted) {
      const f = found.get(k)
      console.error(`unlisted: ${k} (${f.count}) line ${f.line}: ${f.text}`)
    }
    for (const k of stale) console.error(`stale: ${k} no longer finds anything; delete its allowlist line`)
    if (unlisted.length || stale.length || noOwner.length) {
      console.error(`foundations-census --gate: ${unlisted.length} unlisted, ${stale.length} stale, ${noOwner.length} unreasoned (ADR-0245; fix the file or the allowlist line)`)
      process.exit(1)
    }
    console.log(`foundations-census --gate: green, ${found.size} allowlisted findings in ${files.size} files`)
    return
  }

  const byRule = Object.fromEntries(RULES.map((r) => [r, 0]))
  for (const key of found.keys()) byRule[key.split('#')[1]]++
  console.log(`foundations census: ${files.size} files still on the old foundations`)
  for (const r of RULES) console.log(`  ${r.padEnd(6)} ${byRule[r]} files`)
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
  check('tokens: a read of a renamed type label is found, bare or with a fallback (T-0373)', rule('a.css', 'x { font-size: var(--md-sys-type-group-label); --t: var(--md-sys-type-section-label, 12px); }', 'tokens') === 2)
  check('tokens: the kicker it was renamed to passes, and so does a ramp read in its fallback', rule('a.css', 'x { font-size: var(--md-sys-type-group-kicker, var(--md-sys-font-sm)); }', 'tokens') === 0)
  check('tokens: a renamed label in code is found', rule('a.ts', "el.style.fontSize = 'var(--md-sys-type-group-label)'", 'tokens') === 1)
  check('glyph: attribute, key, property and attribute call are found', rule('a.ts', `h('<ui-icon glyph="x">'); el('ui-icon', { glyph: 'x' }); icon.glyph = 'y'; i.setAttribute('glyph', 'z')`, 'glyph') === 4)
  check('glyph: data-glyph, ui-glyph, glyph-box, a ternary and a comment pass', rule('a.ts', `// icon.glyph = 'x'\nh('<ui-glyph symbol="x" data-glyph="y">'); const v = ok ? glyph : none; s('--md-sys-glyph-box')`, 'glyph') === 0)
  check('glyph: a descriptor attribute row is found, a part named glyph is not', rule('a.md', '---\nattributes:\n  - name: glyph\n    type: string\nparts:\n  - name: glyph\n---', 'glyph') === 1)
  check('glyph: a marked alias line passes, an unmarked one beside it is still found', rule('a.ts', `icon.glyph = 'x' // foundations-alias\nicon.glyph = 'y'`, 'glyph') === 1)
  check('glyph: a marker in a descriptor entry exempts that entry only', rule('a.md', '---\nattributes:\n  - name: glyph\n    type: string # foundations-alias\n  - name: label\n---', 'glyph') === 0 && rule('a.md', '---\nattributes:\n  - name: label # foundations-alias\n  - name: glyph\n---', 'glyph') === 1)
  check('axes: a marked deprecated carrier line passes, an unmarked one is still found', rule('a.ts', `el.setAttribute('scale', 'ui-lg') // foundations-alias\nel.setAttribute('density', 'compact')`, 'axes') === 1)
  check('glyph: a glyph field not aimed at ui-icon passes', rule('a.ts', `const s = { glyph: '9♠' }; r.glyph; this.#part.glyph = el`, 'glyph') === 0)
  check('axes: selector, markup and attribute call are found', rule('a.ts', `q('[scale="ui-lg"]'); h('<div density="compact">'); e.setAttribute('scale', 'x')`, 'axes') === 3)
  check('axes: an attribute name union fed to setAttribute through a variable is found', rule('a.ts', `function row(attr: 'scale' | 'density', v: string) { el.setAttribute(attr, v) }`, 'axes') === 2)
  check('axes: a union of other names and a string array of the names pass', rule('a.ts', `type T = 'rotate' | 'translate'; const names = ['scale', 'density']`, 'axes') === 0)
  check('axes: a css selector is found', rule('a.css', ':is([scale="ui-lg"]) x { color: red; }', 'axes') === 1)
  check('axes: data-scale, transform scale() and --md-sys-scale pass', rule('a.css', 'x[data-scale="sm"] { transform: scale(2); font-size: calc(1px * var(--md-sys-scale)); }', 'axes') === 0)
  check('axes: a test title or comment naming [scale] passes', rule('a.ts', `it('no [size]/[scale] selector', () => {}) // [density]`, 'axes') === 0)
  const VENDOR = 'packages/agent-ui/shared/src/tokens/vendor/mathematical-design-system'
  check('skip: the two vendored modules are not scanned, a sibling of them is', SKIP_FILE.test(`${VENDOR}/scale.mjs`) && SKIP_FILE.test(`${VENDOR}/curvature.mjs`) && !SKIP_FILE.test('packages/agent-ui/shared/src/tokens/scale.mjs'))
  check('skip: a repo-authored .d.mts beside the vendored modules and a file under another vendor folder are scanned', !SKIP_FILE.test(`${VENDOR}/scale.d.mts`) && !SKIP_FILE.test('packages/agent-ui/x/src/vendor/a.ts'))
  const tree = mkdtempSync(join(tmpdir(), 'census-vendor-'))
  try {
    const planted = "el.style.fontSize = 'var(--md-sys-type-group-label)'\n"
    for (const rel of [`${VENDOR}/scale.mjs`, `${VENDOR}/planted.ts`, 'packages/agent-ui/x/src/vendor/a.ts']) {
      mkdirSync(join(tree, rel, '..'), { recursive: true })
      writeFileSync(join(tree, rel), planted)
    }
    const keys = [...census(tree).keys()]
    check('skip: a finding planted in a vendor-named folder is found, the vendored copy is not scanned', keys.includes(`${VENDOR}/planted.ts#tokens`) && keys.includes('packages/agent-ui/x/src/vendor/a.ts#tokens') && !keys.some((k) => k.startsWith(`${VENDOR}/scale.mjs#`)))
  } finally {
    rmSync(tree, { recursive: true, force: true })
  }
  const d = gateDiff(['a#px', 'b#px'], ['a#px', 'c#glyph'])
  check('gate: an unlisted finding and a stale entry are both reported', d.unlisted.join() === 'b#px' && d.stale.join() === 'c#glyph')
  check('gate: a listed finding is green', gateDiff(['a#px'], ['a#px']).unlisted.length + gateDiff(['a#px'], ['a#px']).stale.length === 0)
  check('allowlist: a new key with no owner in --reason writes nothing; a TODO reason is refused', nextAllowlist(['a#px'], {}, undefined) === null && nextAllowlist(['a#px'], {}, 'TODO: name the owning ticket') === null)
  check('allowlist: a new key takes an owned --reason, an existing reason is kept', JSON.stringify(nextAllowlist(['a#px', 'b#px'], { 'a#px': 'T-0001 keeps it' }, 'T-0169 ruling')) === JSON.stringify({ 'a#px': 'T-0001 keeps it', 'b#px': 'T-0169 ruling' }))
  check('gate: an allowlist reason that names no owner is reported', unreasoned({ 'a#px': 'TODO', 'b#px': 'T-0169' }).join() === 'a#px')
  check('allowlist: one entry per line, sorted, valid JSON', formatAllowlist({ 'b#px': 'y', 'a#px': 'x' }) === '{\n  "a#px": "x",\n  "b#px": "y"\n}\n' && JSON.parse(formatAllowlist({ a: 'b' })).a === 'b')
  console.log(failures === 0 ? 'selftest: all green' : `selftest: ${failures} failure(s)`)
  if (failures) process.exit(1)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv[2] === 'selftest') selftest()
  else main()
}
