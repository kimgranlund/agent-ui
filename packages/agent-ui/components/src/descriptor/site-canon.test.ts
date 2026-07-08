import { describe, it, expect } from 'vitest'
import { splitFrontmatter, parseDescriptor, collectStyledRoles } from './component-descriptor.ts'
// Raw-text fs read — same reverse-coupling fs-read pattern as
// controls/button/button-descriptor.test.ts; vitest/node resolves it at runtime.
import { readFileSync, readdirSync } from 'node:fs'
declare const process: { cwd(): string }

// site-canon.test.ts — slice s12, the #4 /site dead-slot/role-name GUARD (decomp action a18). A STATIC
// migration lint, NOT a render smoke: the failure mode it catches is a stale NAME, and after a slot/role
// rename the only proof a call site missed the migration is the dead string itself (jsdom never evaluates the
// `:has()` host-grid, so a jsdom smoke would not see the visual break, and a browser smoke is specimen-coupled
// and costly). This is the guard that would have caught the `slot="icon"` that shipped on main.ts after the
// `icon` → `leading` rename (ADR-0012).
//
// The contract: every slot/role NAME used anywhere in site/ must be a CANONICAL name, sourced from the same
// source-of-truth the components are checked against — the descriptors (slots) and the control CSS (roles):
//   • canonical SLOT vocab = the union of every {name}.md descriptor's `slots[].name` (includes `label`).
//   • canonical ROLE vocab = the union of `collectStyledRoles({name}.css)` over every control css (icon/caret).
// Both are read through the SAME parser/extractor the trip-wires use (parseDescriptor + collectStyledRoles),
// so the guard and the components can never disagree about what a canonical name is.
//
// COMMENTS ARE NOT CODE. The guard scans the shipped names, so it strips `//`+`/* */` (.ts) and `<!-- -->`
// (.html) before matching — a historical note in a comment is not a live usage. This is load-bearing here:
// main.ts STILL documents the pre-rename `slot="icon"` in a `//` comment, yet the page is clean. Scanning raw
// text would flag that comment (the exact NC-anchor trap system-decompose warns about — a dead literal that
// survives in a comment); the live bug it replaced lived in CODE (`setAttribute('slot','icon')`) and IS caught.

const ROOT = process.cwd()
const COMPONENTS_SRC = `${ROOT}/packages/agent-ui/components/src`
const SITE = `${ROOT}/site`

const read = (p: string): string => readFileSync(p, 'utf8') as string
const rel = (p: string): string => (p.startsWith(ROOT) ? p.slice(ROOT.length + 1) : p)

type Dirent = { name: string; isDirectory(): boolean; isFile(): boolean }

/** Recursively list every file under `dir` (absolute paths); a missing dir yields []. */
function walk(dir: string): string[] {
  let entries: Dirent[]
  try {
    entries = readdirSync(dir, { withFileTypes: true }) as Dirent[]
  } catch {
    return [] // an absent dir (e.g. controls' future `components/` sibling) contributes nothing
  }
  const files: string[] = []
  for (const e of entries) {
    const full = `${dir}/${e.name}`
    if (e.isDirectory()) files.push(...walk(full))
    else if (e.isFile()) files.push(full)
  }
  return files
}

// The component family roots the canonical vocab is sourced from (controls today; components is future-proof).
const FAMILY_ROOTS = [`${COMPONENTS_SRC}/controls`, `${COMPONENTS_SRC}/components`]

/** Canonical SLOT vocab — the union of every descriptor's `slots[].name` (a position name; includes `label`). */
function canonicalSlots(): Set<string> {
  const slots = new Set<string>()
  for (const base of FAMILY_ROOTS) {
    for (const file of walk(base)) {
      if (!file.endsWith('.md')) continue
      let parsed
      try {
        parsed = parseDescriptor(splitFrontmatter(read(file)).fence)
      } catch {
        continue // a .md with no frontmatter fence is not a descriptor
      }
      for (const item of parsed.sequences.get('slots') ?? []) {
        const name = item.get('name')
        if (typeof name === 'string' && name !== '') slots.add(name)
      }
    }
  }
  return slots
}

/** Canonical ROLE vocab — the union of `collectStyledRoles()` over every control css (`[data-role='X']`). */
function canonicalRoles(): Set<string> {
  const roles = new Set<string>()
  for (const base of FAMILY_ROOTS) {
    for (const file of walk(base)) {
      if (file.endsWith('.css')) for (const r of collectStyledRoles(read(file))) roles.add(r)
    }
  }
  return roles
}

// ── the name scanner ──────────────────────────────────────────────────────────────────────────────────────

/** One slot/role NAME usage found in a source file. */
interface NameUse {
  kind: 'slot' | 'role'
  name: string
  file: string
}

/** Strip comments from .ts source — block comments then `//` line comments (sparing `://` so URLs survive). */
const stripCode = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*$/gm, '$1')

/** Strip `<!-- -->` comments from .html source. */
const stripHtml = (src: string): string => src.replace(/<!--[\s\S]*?-->/g, ' ')

/**
 * Scan already comment-stripped source for slot/role NAME usages in BOTH spellings:
 *   • declarative — `slot="X"` / `slot='X'`, `data-role="X"` / `data-role='X'`
 *   • imperative  — `setAttribute('slot','X')`, `setAttribute('data-role','X')`
 * Only quoted-literal names are collected; a variable (`setAttribute('slot', slot)`) is not statically resolvable
 * and is skipped (its values flow through the typed SlotName union, not a stale literal).
 */
function collectUses(code: string, file: string): NameUse[] {
  const uses: NameUse[] = []
  for (const m of code.matchAll(/\bslot\s*=\s*['"]([A-Za-z][\w-]*)['"]/g)) uses.push({ kind: 'slot', name: m[1], file })
  for (const m of code.matchAll(/setAttribute\(\s*['"]slot['"]\s*,\s*['"]([A-Za-z][\w-]*)['"]/g)) uses.push({ kind: 'slot', name: m[1], file })
  for (const m of code.matchAll(/\bdata-role\s*=\s*['"]([A-Za-z][\w-]*)['"]/g)) uses.push({ kind: 'role', name: m[1], file })
  for (const m of code.matchAll(/setAttribute\(\s*['"]data-role['"]\s*,\s*['"]([A-Za-z][\w-]*)['"]/g)) uses.push({ kind: 'role', name: m[1], file })
  return uses
}

/** Every usage whose NAME is not in its canonical vocab — a dead/stale name a rename left behind. */
function violationsOf(uses: NameUse[], slots: Set<string>, roles: Set<string>): NameUse[] {
  return uses.filter((u) => (u.kind === 'slot' ? !slots.has(u.name) : !roles.has(u.name)))
}

/** Scan a site file by extension (.ts is comment-stripped as code, .html as markup). */
function usesInFile(file: string): NameUse[] {
  if (file.endsWith('.ts')) return collectUses(stripCode(read(file)), rel(file))
  if (file.endsWith('.html')) return collectUses(stripHtml(read(file)), rel(file))
  return []
}

const SLOTS = canonicalSlots()
const ROLES = canonicalRoles()
const siteUses = walk(SITE).flatMap(usesInFile)

// ── the guard ─────────────────────────────────────────────────────────────────────────────────────────────

describe('site dead-name guard — canonical vocab (s12)', () => {
  it('sources the SLOT vocab from every {name}.md descriptor (includes the default `label` cell)', () => {
    expect(SLOTS.size).toBeGreaterThan(0)
    for (const s of ['leading', 'label', 'trailing']) expect(SLOTS.has(s), `missing canonical slot: ${s}`).toBe(true)
  })

  it('sources the ROLE vocab from every control css via collectStyledRoles', () => {
    expect(ROLES.size).toBeGreaterThan(0)
    for (const r of ['icon', 'caret']) expect(ROLES.has(r), `missing canonical role: ${r}`).toBe(true)
  })
})

describe('site dead-name guard — real site/ is clean (a18 / improvement #4)', () => {
  it('found real slot tokens (anti-vacuous — an empty/broken scan cannot pass silently)', () => {
    expect(siteUses.filter((u) => u.kind === 'slot').length).toBeGreaterThanOrEqual(1)
  })

  it('every slot/role NAME used in site/ is a canonical name — no dead/stale name survives a rename', () => {
    expect(violationsOf(siteUses, SLOTS, ROLES)).toEqual([])
  })
})

describe('site dead-name guard — the guard bites (synthetic negative controls; #3b)', () => {
  // Each NC anchors on a UNIQUE dead token (`icn`/`badg`, NOT `icon`/`label`, which are real names) run through
  // the SAME scanner the real site/ goes through — proving the check is non-vacuous without writing a dead name
  // into a committed site file.
  it('flags a dead slot name in the declarative spelling (`slot="icn"`)', () => {
    const uses = collectUses(stripCode(`const tpl = '<svg slot="icn"></svg>'`), 'fixture')
    expect(violationsOf(uses, SLOTS, ROLES)).toEqual([{ kind: 'slot', name: 'icn', file: 'fixture' }])
  })

  it('flags a dead slot name in the imperative spelling (`setAttribute(\'slot\',\'icn\')`)', () => {
    const uses = collectUses(stripCode(`el.setAttribute('slot', 'icn')`), 'fixture')
    expect(violationsOf(uses, SLOTS, ROLES)).toEqual([{ kind: 'slot', name: 'icn', file: 'fixture' }])
  })

  it('flags a dead role name (`data-role="badg"`)', () => {
    const uses = collectUses(stripCode(`el.setAttribute('data-role', 'badg')`), 'fixture')
    expect(violationsOf(uses, SLOTS, ROLES)).toEqual([{ kind: 'role', name: 'badg', file: 'fixture' }])
  })

  it('does NOT flag a dead name that lives only in a comment — why main.ts\'s historical `slot="icon"` is clean', () => {
    const uses = collectUses(stripCode(`// the pre-rename slot="icn" name no longer matches\nconst t = 1`), 'fixture')
    expect(violationsOf(uses, SLOTS, ROLES)).toEqual([])
  })
})
