// glyph-usage-coverage.test.ts — the GH #1508 fleet gate: every `glyph` value a real consumer under
// `site/` or `packages/agent-ui/app/src/` actually asks `ui-icon` to resolve must exist in the vendored
// Phosphor pack roster (`phosphor/icons.gen.ts`'s own exported keys, not just the `ICON_NAMES` type
// list — the two CAN drift, exactly `sign-out`/`share`'s bug class: a name gets typed but the vendor
// script never runs). Same reverse-coupling fs-read pattern + walk()/derived-SET shape as
// `@agent-ui/components`'s `site-coverage.test.ts` (the derived-inventory precedent this file follows).
//
// Extraction is grep-derived, in two tiers:
//   (1) DIRECT literals — `glyph: 'name'` (object-property call sites, the `el()` specimen idiom) and
//       `glyph="name"` (template/HTML-string call sites). `data-glyph` (an unrelated CSS-hook attribute
//       some controls use, e.g. ui-super-shell's toggle) is explicitly excluded.
//   (2) INDIRECT literals — a local per-page helper (e.g. command-modal-demo.ts's `commandOption`)
//       often forwards a NAMED PARAMETER into `glyph: paramName`. This tier locates the parameter's
//       index in the enclosing function's declaration, then reads the string-literal argument at that
//       same index from every call site of that function in the same file. This is exactly the shape
//       `/command-modal-demo` uses for its Actions row (`el('ui-icon', { glyph: icon, ... })` inside
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

declare const process: { cwd(): string }

const ROOT = process.cwd()
const SCAN_ROOTS = [`${ROOT}/site`, `${ROOT}/packages/agent-ui/app/src`]

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
    else if (e.isFile() && /\.tsx?$/.test(e.name)) files.push(full)
  }
  return files
}

/** DIRECT `glyph: 'name'` / `glyph="name"` literals — excludes the unrelated `data-glyph` attribute. */
export function directGlyphLiterals(src: string): string[] {
  const out: string[] = []
  const reColon = /(?<!data-)\bglyph:\s*['"]([\w-]+)['"]/g
  const reAttr = /(?<!data-)\bglyph=['"]([\w-]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = reColon.exec(src))) out.push(m[1])
  while ((m = reAttr.exec(src))) out.push(m[1])
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

/** INDIRECT literals: a local helper forwards a named parameter into `glyph: paramName`; resolve every
 *  string-literal argument at that parameter's index from every call site of the helper in `src`. */
export function indirectGlyphLiterals(src: string): string[] {
  const out: string[] = []
  const identRe = /\bglyph:\s*([a-zA-Z_$][\w$]*)\b/g
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

function scan(roots: readonly string[]): Usage[] {
  const out: Usage[] = []
  for (const root of roots) {
    for (const file of walk(root)) {
      const rel = file.slice(ROOT.length + 1)
      for (const glyph of glyphLiteralsIn(read(file))) out.push({ file: rel, glyph })
    }
  }
  return out
}

const USAGES = scan(SCAN_ROOTS)
const unresolved = (usages: readonly Usage[]): Usage[] =>
  usages.filter((u) => !ROSTER.has(u.glyph) && !KNOWN_GAP.has(`${u.file}::${u.glyph}`))

describe('glyph-usage coverage (GH #1508) — every glyph a site/app consumer asks for resolves', () => {
  it('anti-vacuous: the scan actually finds real glyph usages under site/ and app/src', () => {
    expect(USAGES.length).toBeGreaterThan(0)
    expect(USAGES.some((u) => u.glyph === 'house')).toBe(true) // command-modal-demo's Navigation row
    expect(USAGES.some((u) => u.glyph === 'check')).toBe(true) // component-preview.ts's generic swatch
  })

  it('the INDIRECT tier resolves command-modal-demo.ts\'s commandOption(value, icon, …) forwarding', () => {
    const found = USAGES.filter((u) => u.file === 'site/pages/command-modal-demo.ts').map((u) => u.glyph)
    expect(found.sort()).toEqual(['gear', 'house', 'share', 'sign-out'].sort())
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
    expect(directGlyphLiterals(`el('ui-icon', { glyph: 'house' })`)).toEqual(['house'])
    expect(directGlyphLiterals(`<ui-icon glyph="paperclip">`)).toEqual(['paperclip'])
  })

  it('directGlyphLiterals does NOT count the unrelated data-glyph attribute', () => {
    expect(directGlyphLiterals(`el('span', { 'data-glyph': 'menu' })`)).toEqual([])
    expect(directGlyphLiterals(`<span data-glyph="close">`)).toEqual([])
  })

  it('indirectGlyphLiterals resolves a bare-identifier glyph forwarded through a named function parameter', () => {
    const src = [
      'function commandOption(value, icon, label) {',
      "  return el('ui-icon', { glyph: icon })",
      '}',
      "commandOption('logout', 'sign-out', 'Log out')",
      "commandOption('share', 'share', 'Share file')",
    ].join('\n')
    expect(indirectGlyphLiterals(src).sort()).toEqual(['share', 'sign-out'])
  })

  it('indirectGlyphLiterals ignores a non-literal (dynamic) call argument rather than crashing', () => {
    const src = [
      'function opt(icon) { return el("ui-icon", { glyph: icon }) }',
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
