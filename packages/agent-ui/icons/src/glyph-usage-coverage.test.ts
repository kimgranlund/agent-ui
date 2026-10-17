// glyph-usage-coverage.test.ts: the GH #1508 fleet gate: every icon name a real consumer under `site/` or
// any `packages/agent-ui/*/src/` actually asks `ui-icon` to resolve must exist in the vendored
// Phosphor pack roster (`phosphor/icons.gen.ts`'s own exported keys, not just the `ICON_NAMES` type
// list — the two CAN drift, exactly `sign-out`/`share`'s bug class: a name gets typed but the vendor
// script never runs). Same reverse-coupling fs-read pattern + walk()/derived-SET shape as
// `@agent-ui/components`'s `site-coverage.test.ts` (the derived-inventory precedent this file follows).
//
// ADR-0245 cl.4 follow-through (T-0093): the icon-name prop is now `symbol` (the deprecated `glyph` alias
// retired in T-0169, so only `symbol` is read); the scan covers every package's src, not only app/; and
// the two forms the first version missed, `setAttribute('symbol', 'name')` and `.symbol = 'name'`, are
// read too. A `symbol` aimed at `ui-glyph` (the nearest preceding element name is
// ui-glyph) names a functional mark and resolves against the closed mark set, not the Phosphor roster.
// Test files are not consumers (they plant unresolvable names on purpose) and are skipped.
//
// Extraction is grep-derived, in two tiers:
//   (1) DIRECT literals: `symbol: 'name'` (object-property call sites, the `el()` specimen idiom),
//       `symbol="name"` (template/HTML-string call sites), `setAttribute('symbol', 'name')` and
//       `.symbol = 'name'`. `data-glyph` (an unrelated CSS-hook attribute some
//       controls use, e.g. ui-super-shell's toggle) is explicitly excluded.
//   (2) INDIRECT literals — a local per-page helper (e.g. command-modal-demo.ts's `commandOption`)
//       often forwards a NAMED PARAMETER into `symbol: paramName`. This tier locates the parameter's
//       index in the enclosing function's declaration, then reads the string-literal argument at that
//       same index from every call site of that function in the same file. This is exactly the shape
//       `/command-modal-demo` uses for its Actions row (`el('ui-icon', { symbol: icon, ... })` inside
//       `commandOption(value, icon, label, shortcut, keywords)`) — without this tier the gate could not
//       see `sign-out`/`share` at all and would not "bite" on a revert of the vendoring step.
//
// KNOWN_GAP is the explicit, deliberate, PRE-EXISTING exception (the KNOWN_UNDOCUMENTED precedent,
// site-coverage.test.ts): `card-demo.ts`'s structured-header specimen (GH #807/#817, ADR-0186) passes
// `glyph: 'calendar'` — not a real Phosphor name (the pack has `calendar-blank`/`calendar-check`, not
// bare `calendar`). This predates #1508 and is unrelated to the sign-out/share vendoring gap; reported
// in the #1508 Findings rather than silently fixed here (component-build seat: one component/gap per
// dispatch). It SHRINKS the moment that page is corrected — a real new drift anywhere else still fails
// the build.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import type { Dirent } from 'node:fs'
import { phosphorIcons } from './phosphor/icons.gen.ts'
import { GLYPH_SYMBOLS } from '../../components/src/controls/glyph/glyph-paths.ts'

declare const process: { cwd(): string }

const ROOT = process.cwd()
const PACKAGES = readdirSync(`${ROOT}/packages/agent-ui`, { withFileTypes: true }).filter((e) => e.isDirectory())
const SCAN_ROOTS = [`${ROOT}/site`, ...PACKAGES.map((e) => `${ROOT}/packages/agent-ui/${e.name}/src`)]

const read = (p: string): string => readFileSync(p, 'utf8') as string

/** Recursively list every `.ts`/`.tsx` file under `dir` (absolute paths); skips dotdirs (incl. the
 *  `.fixture-scratch` build output) and `node_modules`. A missing dir yields []. */
function walk(dir: string): string[] {
  let entries: Dirent[]
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const files: string[] = []
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue
    const full = `${dir}/${e.name}`
    if (e.isDirectory()) files.push(...walk(full))
    else if (e.isFile() && /\.tsx?$/.test(e.name) && !/\.(test|gen)\.tsx?$/.test(e.name)) files.push(full)
  }
  return files
}

const DIRECT_FORMS = [
  /(?<![\w-])symbol:\s*['"]([\w-]+)['"]/g, // { symbol: 'x' }
  /(?<![\w-])symbol=['"]([\w-]+)['"]/g, // symbol="x"
  /\bsetAttribute\(\s*['"]symbol['"]\s*,\s*['"]([\w-]+)['"]/g, // setAttribute('symbol', 'x')
  /\.symbol\s*=\s*['"]([\w-]+)['"]/g, // el.symbol = 'x'
]

/** The element a literal at `index` is aimed at: the nearest `ui-icon` / `ui-glyph` mention before it. */
function targetOf(src: string, index: number): 'icon' | 'glyph' {
  const before = src.slice(Math.max(0, index - 160), index)
  const hits = [...before.matchAll(/ui-(icon|glyph)\b/g)]
  return hits.at(-1)?.[1] === 'glyph' ? 'glyph' : 'icon'
}

/** DIRECT literals aimed at ui-icon (every form above, both spellings); excludes `data-glyph` and marks. */
export function directGlyphLiterals(src: string): string[] {
  return directLiterals(src).filter((l) => l.target === 'icon').map((l) => l.name)
}

/** Every DIRECT literal with the element it targets. */
export function directLiterals(src: string): { name: string; target: 'icon' | 'glyph' }[] {
  const out: { name: string; target: 'icon' | 'glyph' }[] = []
  for (const re of DIRECT_FORMS) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(src))) out.push({ name: m[1] as string, target: targetOf(src, m.index) })
  }
  return out
}

/** Split a comma-joined argument list at TOP-LEVEL commas only (parens/brackets/braces/quotes nested). */
function splitTopLevelArgs(s: string): string[] {
  const args: string[] = []
  let depth = 0
  let cur = ''
  let quote: string | null = null
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (quote) {
      cur += c
      if (c === quote && s[i - 1] !== '\\') quote = null
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c
      cur += c
      continue
    }
    if (c === '(' || c === '[' || c === '{') {
      depth++
      cur += c
      continue
    }
    if (c === ')' || c === ']' || c === '}') {
      depth--
      cur += c
      continue
    }
    if (c === ',' && depth === 0) {
      args.push(cur)
      cur = ''
      continue
    }
    cur += c
  }
  if (cur.trim() !== '') args.push(cur)
  return args
}

/** The balanced-paren argument-list text for a call whose `(` sits at `openIdx`. */
function extractCallArgs(src: string, openIdx: number): string {
  let depth = 0
  let i = openIdx
  for (; i < src.length; i++) {
    if (src[i] === '(') depth++
    else if (src[i] === ')') {
      depth--
      if (depth === 0) break
    }
  }
  return src.slice(openIdx + 1, i)
}

/** INDIRECT literals: a local helper forwards a named parameter into `symbol: paramName`; resolve every
 *  string-literal argument at that parameter's index from every call site of the helper in `src`. */
export function indirectGlyphLiterals(src: string): string[] {
  const out: string[] = []
  const identRe = /(?<![\w-])symbol:\s*([a-zA-Z_$][\w$]*)\b/g
  const idents = new Set<string>()
  let im: RegExpExecArray | null
  while ((im = identRe.exec(src))) idents.add(im[1])
  if (idents.size === 0) return out

  const fnRe = /function\s+(\w+)\s*\(([^)]*)\)|const\s+(\w+)\s*=\s*\(([^)]*)\)\s*(?::[^=]+)?=>/g
  let fm: RegExpExecArray | null
  while ((fm = fnRe.exec(src))) {
    const name = fm[1] ?? fm[3]
    const paramsRaw = fm[2] ?? fm[4]
    if (!name || paramsRaw === undefined) continue
    const params = paramsRaw
      .split(',')
      .map((p) => p.trim().split(/[:=]/)[0]?.trim().replace(/^\?/, ''))
      .filter((p): p is string => Boolean(p))

    for (const ident of idents) {
      const idx = params.indexOf(ident)
      if (idx === -1) continue
      const callRe = new RegExp(`\\b${name}\\s*\\(`, 'g')
      let cm: RegExpExecArray | null
      while ((cm = callRe.exec(src))) {
        const before = src.slice(Math.max(0, cm.index - 12), cm.index)
        if (/\b(function|const)\s*$/.test(before)) continue // skip the declaration head itself
        const openIdx = cm.index + cm[0].length - 1
        const args = splitTopLevelArgs(extractCallArgs(src, openIdx))
        const lit = args[idx]?.trim().match(/^['"]([\w-]+)['"]$/)
        if (lit) out.push(lit[1])
      }
    }
  }
  return out
}

/** Every glyph literal (direct + indirect, deduped) a file's source asks `ui-icon` to resolve. */
function glyphLiteralsIn(src: string): string[] {
  return [...new Set([...directGlyphLiterals(src), ...indirectGlyphLiterals(src)])]
}

/** Every literal a file's source asks `ui-glyph` to draw (a functional mark, ADR-0245 cl.5). */
function markLiteralsIn(src: string): string[] {
  return [...new Set(directLiterals(src).filter((l) => l.target === 'glyph').map((l) => l.name))]
}
const MARKS = new Set<string>(GLYPH_SYMBOLS)

// ── the KNOWN_GAP allowlist (KNOWN_UNDOCUMENTED precedent, site-coverage.test.ts) ──────────────────────
// A pre-existing, unrelated glyph-vocabulary bug this gate's addition surfaced (GH #807/#817, ADR-0186):
// card-demo.ts's structured-header specimen passes `glyph: 'calendar'`, which is not a real Phosphor
// name (`calendar-blank`/`calendar-check` are). Reported in #1508's Findings; not fixed here (one
// component/gap per component-build dispatch). Keyed by `relative/path.ts::glyphName` so it can only
// ever mask THIS exact known instance, never a future unrelated drift in the same file.
const KNOWN_GAP = new Set<string>(['site/pages/card-demo.ts::calendar'])

const ROSTER = new Set(Object.keys(phosphorIcons))

interface Usage {
  readonly file: string // path relative to repo root
  readonly glyph: string
}

function scan(roots: readonly string[]): { icons: Usage[]; marks: Usage[] } {
  const icons: Usage[] = []
  const marks: Usage[] = []
  for (const root of roots) {
    for (const file of walk(root)) {
      const rel = file.slice(ROOT.length + 1)
      const src = read(file)
      for (const glyph of glyphLiteralsIn(src)) icons.push({ file: rel, glyph })
      for (const glyph of markLiteralsIn(src)) marks.push({ file: rel, glyph })
    }
  }
  return { icons, marks }
}

const { icons: USAGES, marks: MARK_USAGES } = scan(SCAN_ROOTS)
const unresolved = (usages: readonly Usage[]): Usage[] =>
  usages.filter((u) => !ROSTER.has(u.glyph) && !KNOWN_GAP.has(`${u.file}::${u.glyph}`))

describe('glyph-usage coverage (GH #1508) — every glyph a site/app consumer asks for resolves', () => {
  it('anti-vacuous: the scan actually finds real glyph usages under site/ and app/src', () => {
    expect(USAGES.length).toBeGreaterThan(0)
    expect(USAGES.some((u) => u.glyph === 'house')).toBe(true) // command-modal-demo's Navigation row
    expect(USAGES.some((u) => u.glyph === 'check')).toBe(true) // component-preview.ts's generic swatch
    // T-0169: agent-admin's PANE_IDENTITY table keys its pane icons as `symbol:`, so the scan still sees them
    const admin = USAGES.filter((u) => u.file.endsWith('agent-admin/agent-admin.ts')).map((u) => u.glyph)
    expect(admin).toEqual(expect.arrayContaining(['chats-circle', 'gear-six', 'robot']))
  })

  it('the INDIRECT tier resolves command-modal-demo.ts\'s commandOption(value, icon, …) forwarding', () => {
    const found = USAGES.filter((u) => u.file === 'site/pages/command-modal-demo.ts').map((u) => u.glyph)
    expect(found.sort()).toEqual(['gear', 'house', 'share', 'sign-out'].sort())
  })

  it('ADR-0245 cl.4: the scan reaches every package src, not only app/src', () => {
    expect(USAGES).toContainEqual({ file: 'packages/agent-ui/components/src/controls/toast/toast.ts', glyph: 'x' }) // setAttribute form
    expect(USAGES).toContainEqual({ file: 'packages/agent-ui/components/src/controls/avatar/avatar.ts', glyph: 'user' }) // .glyph = form
  })

  it('every scanned ui-glyph literal is one of the twelve marks (ADR-0245 cl.5)', () => {
    const bad = MARK_USAGES.filter((u) => !MARKS.has(u.glyph))
    expect(bad, JSON.stringify(bad)).toEqual([])
  })

  it('every scanned glyph literal resolves in the vendored Phosphor pack roster (KNOWN_GAP excepted)', () => {
    const bad = unresolved(USAGES)
    expect(bad, JSON.stringify(bad)).toEqual([])
  })

  it('KNOWN_GAP lists exactly the real unresolved usages (no stale entry, no silent new one)', () => {
    const reallyUnresolved = USAGES.filter((u) => !ROSTER.has(u.glyph)).map((u) => `${u.file}::${u.glyph}`).sort()
    expect(reallyUnresolved).toEqual([...KNOWN_GAP].sort())
  })
})

describe('glyph-usage coverage — the bite proof (synthetic revert of the GH #1508 vendoring)', () => {
  it('reverting sign-out/share from the roster makes the gate FAIL on the real command-modal-demo usages', () => {
    const revertedRoster = new Set(ROSTER)
    revertedRoster.delete('sign-out')
    revertedRoster.delete('share')
    const found = USAGES.filter((u) => u.file === 'site/pages/command-modal-demo.ts' && !revertedRoster.has(u.glyph))
    expect(found.map((u) => u.glyph).sort()).toEqual(['share', 'sign-out'])
  })
})

describe('glyph-usage coverage — the extraction predicates BITE (synthetic negative controls)', () => {
  it('directGlyphLiterals reads both the object-property and HTML-attribute spellings', () => {
    expect(directGlyphLiterals(`el('ui-icon', { symbol: 'house' })`)).toEqual(['house'])
    expect(directGlyphLiterals(`<ui-icon symbol="paperclip">`)).toEqual(['paperclip'])
  })

  it('ADR-0245 cl.4: directGlyphLiterals reads the symbol spelling and the setAttribute and property forms', () => {
    expect(directGlyphLiterals(`el('ui-icon', { symbol: 'house' })`)).toEqual(['house'])
    expect(directGlyphLiterals(`<ui-icon symbol="paperclip">`)).toEqual(['paperclip'])
    expect(directGlyphLiterals(`icon.setAttribute('symbol', 'gear')`)).toEqual(['gear'])
    expect(directGlyphLiterals(`icon.setAttribute("symbol", "bell")`)).toEqual(['bell'])
    expect(directGlyphLiterals(`icon.symbol = 'x'; other.symbol = 'eye'`).sort()).toEqual(['eye', 'x'])
  })

  it('ADR-0245 cl.5: a symbol aimed at ui-glyph is a mark, not an icon name', () => {
    const src = `<ui-glyph symbol="more"></ui-glyph><ui-icon symbol="eye"></ui-icon>`
    expect(directGlyphLiterals(src)).toEqual(['eye'])
    expect(directLiterals(src)).toContainEqual({ name: 'more', target: 'glyph' })
    expect(directLiterals(`el('ui-glyph', { symbol: 'not-a-mark' })`).filter((l) => !MARKS.has(l.name))).toHaveLength(1)
  })

  it('directGlyphLiterals does NOT count the unrelated data-glyph attribute', () => {
    expect(directGlyphLiterals(`el('span', { 'data-glyph': 'menu' })`)).toEqual([])
    expect(directGlyphLiterals(`<span data-glyph="close">`)).toEqual([])
  })

  it('indirectGlyphLiterals resolves a bare-identifier glyph forwarded through a named function parameter', () => {
    const src = [
      'function commandOption(value, icon, label) {',
      "  return el('ui-icon', { symbol: icon })",
      '}',
      "commandOption('logout', 'sign-out', 'Log out')",
      "commandOption('share', 'share', 'Share file')",
    ].join('\n')
    expect(indirectGlyphLiterals(src).sort()).toEqual(['share', 'sign-out'])
  })

  it('indirectGlyphLiterals ignores a non-literal (dynamic) call argument rather than crashing', () => {
    const src = [
      'function opt(icon) { return el("ui-icon", { symbol: icon }) }',
      'const dynamicName = computeIt()',
      'opt(dynamicName)',
      "opt('house')",
    ].join('\n')
    expect(indirectGlyphLiterals(src)).toEqual(['house'])
  })

  it('a synthetic unresolvable glyph name IS caught by the roster check (the predicate is not vacuously true)', () => {
    const usages: Usage[] = [{ file: 'site/pages/zzfake-demo.ts', glyph: 'not-a-real-glyph' }]
    expect(unresolved(usages)).toEqual(usages)
  })

  it('a KNOWN_GAP entry is excepted, but ONLY for its own exact file+glyph pair', () => {
    const matchingGap: Usage[] = [{ file: 'site/pages/card-demo.ts', glyph: 'calendar' }]
    const sameGlyphOtherFile: Usage[] = [{ file: 'site/pages/other-demo.ts', glyph: 'calendar' }]
    expect(unresolved(matchingGap)).toEqual([])
    expect(unresolved(sameGlyphOtherFile)).toEqual(sameGlyphOtherFile)
  })
})
