import { describe, it, expect } from 'vitest'
import { splitFrontmatter, parseDescriptor } from './component-descriptor.ts'
// node:fs is untyped here (no @types/node devDep) — same reverse-coupling fs-read pattern as site-canon.test.ts.
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readFileSync, readdirSync } from 'node:fs'
declare const process: { cwd(): string }

// site-coverage.test.ts — the /site COVERAGE-ENUMERATION drift gate (companion to site-canon.test.ts's
// dead-name guard). Where site-canon catches a stale NAME, this catches a MISSING PAGE: every shipped control
// descriptor must have its required per-type doc pages, so a doc set cannot silently fall behind the component
// fleet. It walks the descriptors (the source of truth for "what is shipped") and asserts each maps to its
// pages under site/ — a missing required page FAILS the build.
//
// The contract:
//   • The page-naming convention is the ONE rule `{name}-{page-type}.html` (name = the descriptor tag minus
//     `ui-`), so the required page set is DERIVED from the descriptor, not a hand-list. button conforms
//     (button-permutations / button-states / button-doc); text-field conforms; every future control follows it.
//   • A control's REQUIRED page set is keyed off its geometry `tier`:
//       - tier `control`  → a form/interactive CONTROL: {permutations, states, doc}  (RATIFIED — ui-button G5
//         established it; ui-text-field G6 follows). This is the live coverage that BITES today.
//       - else (container/layout/pattern/…) → a STRUCTURAL container: {permutations, doc}, NO interaction-states
//         page (a container has no per-control interaction state). This set is the steward's RECOMMENDATION for
//         the G9 container fan-out; it does not bite until a container leaves the known-gap list below.
//   • The G9 containers have no pages yet — that gap is made EXPLICIT as KNOWN_UNDOCUMENTED. The gate asserts a
//     descriptor is documented IFF it is NOT in that list, so (a) a surprise undocumented component fails, and
//     (b) the list must SHRINK as pages land (a container that gains its pages must be removed, or the gate
//     flags it as documented-yet-still-listed). When the list is empty, every shipped component is documented.

const ROOT = process.cwd()
const COMPONENTS_SRC = `${ROOT}/packages/agent-ui/components/src`
const SITE = `${ROOT}/site`

const read = (p: string): string => readFileSync(p, 'utf8') as string

type Dirent = { name: string; isDirectory(): boolean; isFile(): boolean }

/** Recursively list every file under `dir` (absolute paths); a missing dir yields []. */
function walk(dir: string): string[] {
  let entries: Dirent[]
  try {
    entries = readdirSync(dir, { withFileTypes: true }) as Dirent[]
  } catch {
    return []
  }
  const files: string[] = []
  for (const e of entries) {
    const full = `${dir}/${e.name}`
    if (e.isDirectory()) files.push(...walk(full))
    else if (e.isFile()) files.push(full)
  }
  return files
}

// The component family roots the shipped descriptors are sourced from (controls today; components is future-proof).
const FAMILY_ROOTS = [`${COMPONENTS_SRC}/controls`, `${COMPONENTS_SRC}/components`]

/** One shipped component, read from its `{name}.md` descriptor: the tag-derived name + the geometry tier. */
interface ShippedComponent {
  /** The page-name stem — the descriptor `tag` minus `ui-` (e.g. `ui-text-field` → `text-field`). */
  readonly name: string
  readonly tag: string
  readonly tier: string
}

/** Walk the family roots and read every `{name}.md` descriptor into a ShippedComponent (tag + tier). */
function shippedComponents(): ShippedComponent[] {
  const components: ShippedComponent[] = []
  for (const base of FAMILY_ROOTS) {
    for (const file of walk(base)) {
      if (!file.endsWith('.md')) continue
      let parsed
      try {
        parsed = parseDescriptor(splitFrontmatter(read(file)).fence)
      } catch {
        continue // a .md with no frontmatter fence is not a descriptor
      }
      const tag = parsed.scalars.get('tag')
      const tier = parsed.scalars.get('tier')
      if (typeof tag !== 'string' || !tag.startsWith('ui-') || typeof tier !== 'string') continue
      components.push({ name: tag.slice('ui-'.length), tag, tier })
    }
  }
  return components
}

// ── the required-page sets (derived from the convention) ────────────────────────────────────────────────────

const CONTROL_PAGES = ['permutations', 'states', 'doc'] as const // tier `control` — RATIFIED (G5)
const STRUCTURAL_PAGES = ['permutations', 'doc'] as const // container/layout/pattern — recommended (no states page)

/** The page-types a component must ship, keyed off its geometry tier (control vs structural container). */
const requiredPages = (tier: string): readonly string[] => (tier === 'control' ? CONTROL_PAGES : STRUCTURAL_PAGES)

/** The required page FILENAMES for a component (the convention `{name}-{type}.html`). */
const requiredFiles = (name: string, tier: string): string[] =>
  requiredPages(tier).map((type) => `${name}-${type}.html`)

/**
 * The required page files MISSING from `htmlSet` (a pure predicate over a filename set, so the negative controls
 * can exercise it with synthetic inputs). `documented` = no missing files.
 */
function missingPages(name: string, tier: string, htmlSet: ReadonlySet<string>): string[] {
  return requiredFiles(name, tier).filter((f) => !htmlSet.has(f))
}

// ── the known G9 container gap (explicit; SHRINKS as pages land) ──────────────────────────────────────────────
// The shipped G9 container descriptors that have no /site pages YET. Each entry is removed when its pages land
// (the gate forces it: a documented component must NOT be listed here). When this set is empty, the fleet is
// fully documented.
const KNOWN_UNDOCUMENTED = new Set<string>(['card', 'column', 'grid', 'list', 'modal', 'row', 'tabs'])

// ── the live site state ───────────────────────────────────────────────────────────────────────────────────────
const COMPONENTS = shippedComponents()
const HTML = new Set<string>(
  readdirSync(SITE, { withFileTypes: true } as never)
    .filter((e: Dirent) => e.isFile() && e.name.endsWith('.html'))
    .map((e: Dirent) => e.name),
)
const isDocumented = (c: ShippedComponent): boolean => missingPages(c.name, c.tier, HTML).length === 0

// ── the guard ─────────────────────────────────────────────────────────────────────────────────────────────────

describe('site coverage — the descriptor fleet is enumerable (anti-vacuous)', () => {
  it('found the shipped descriptors (button + text-field + the G9 containers)', () => {
    const names = COMPONENTS.map((c) => c.name)
    expect(names).toContain('button')
    expect(names).toContain('text-field')
    expect(COMPONENTS.length).toBeGreaterThanOrEqual(9) // 2 controls + 7 container descriptors
  })

  it('discovered the real site/ html shells (an empty/broken scan cannot pass silently)', () => {
    expect(HTML.has('button-permutations.html')).toBe(true)
    expect(HTML.has('text-field-doc.html')).toBe(true)
    expect(HTML.size).toBeGreaterThanOrEqual(6)
  })
})

describe('site coverage — every shipped CONTROL has its required page set', () => {
  // The live bite: a tier-`control` descriptor (button, text-field) MUST have {permutations, states, doc}. Drop
  // or rename one of those pages and this fails — the gate that keeps the control docs in lock-step with the fleet.
  const controls = COMPONENTS.filter((c) => c.tier === 'control')

  it('sourced the controls (button + text-field today)', () => {
    expect(controls.map((c) => c.name).sort()).toEqual(['button', 'text-field'])
  })

  for (const c of controls) {
    it(`${c.tag} has all of {${CONTROL_PAGES.join(', ')}} pages`, () => {
      expect(missingPages(c.name, c.tier, HTML)).toEqual([])
    })
    it(`${c.tag} is not parked in the known-undocumented gap (a control must be documented now)`, () => {
      expect(KNOWN_UNDOCUMENTED.has(c.name)).toBe(false)
    })
  }
})

describe('site coverage — every descriptor is documented XOR a known gap (the gap shrinks as pages land)', () => {
  for (const c of COMPONENTS) {
    it(`${c.tag} — documented(${isDocumented(c)}) === not-in-known-gap`, () => {
      // documented IFF not listed: a fully-documented component must be removed from KNOWN_UNDOCUMENTED (shrink),
      // and a not-yet-documented one must be listed (no surprise gap slips through).
      expect(isDocumented(c)).toBe(!KNOWN_UNDOCUMENTED.has(c.name))
    })
  }

  it('KNOWN_UNDOCUMENTED lists only real, still-undocumented shipped descriptors (no stale name lingers)', () => {
    const undocumentedNames = COMPONENTS.filter((c) => !isDocumented(c)).map((c) => c.name).sort()
    expect([...KNOWN_UNDOCUMENTED].sort()).toEqual(undocumentedNames)
  })
})

describe('site coverage — the page-existence check BITES (synthetic negative controls)', () => {
  // Each NC drives the SAME missingPages predicate the real gate uses, with synthetic inputs — proving a missing
  // required page IS caught, without writing a broken state into the committed site.
  it('reports a control with NO pages as fully missing (the check is not vacuously true)', () => {
    expect(missingPages('zzfake', 'control', new Set())).toEqual([
      'zzfake-permutations.html',
      'zzfake-states.html',
      'zzfake-doc.html',
    ])
  })

  it('catches a SINGLE dropped required page (simulate a deleted button-states.html)', () => {
    const dropped = new Set(HTML)
    dropped.delete('button-states.html')
    expect(missingPages('button', 'control', dropped)).toEqual(['button-states.html'])
  })

  it('passes when every required page is present (the predicate can go true)', () => {
    const complete = new Set(['demo-permutations.html', 'demo-states.html', 'demo-doc.html'])
    expect(missingPages('demo', 'control', complete)).toEqual([])
  })

  it('a STRUCTURAL container requires {permutations, doc} but NOT a states page', () => {
    const docOnly = new Set(['row-doc.html', 'row-permutations.html'])
    expect(missingPages('row', 'layout', docOnly)).toEqual([]) // no row-states.html required
    expect(missingPages('row', 'control', docOnly)).toEqual(['row-states.html']) // …unless it were a control
  })
})
