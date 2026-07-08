import { describe, it, expect } from 'vitest'
import { splitFrontmatter, parseDescriptor } from './component-descriptor.ts'
// Raw-text fs read — same reverse-coupling fs-read pattern as site-coverage.test.ts.
import { readFileSync, readdirSync } from 'node:fs'
declare const process: { cwd(): string }

// site-toc.test.ts — the /site DUAL-TOC drift gate. The site hand-maintains TWO tables of contents — the nav rail
// (`NAV` in site/pages/_page.ts) and the landing card grid (`CARD_GROUPS` in site/main.ts) — "one table of
// contents, two renderings" (the comment both files carry). Nothing structural forces them to agree with each
// other OR with the shipped fleet; this gate does. It derives the EXPECTED per-component group set from the
// descriptors and asserts BOTH TOCs enumerate exactly it, so shipping a component (or renaming / dropping one)
// without updating both renderings FAILS the build. Companion to site-coverage (the required pages exist) and
// site-canon (no dead slot/role name); this one pins the TOCs ≡ fleet.
//
// COMPONENT GROUPING (the one editorial rule, encoded so the gate enforces it): the per-component tiers
// (control / container / pattern) get ONE group each, labelled by tag (`ui-button` …); the layout tier BUNDLES
// into a single 'Layout primitives' group (the four primitives share one tier showcase, not four near-identical
// nav clusters). A new control/container/pattern descriptor ⇒ a new expected `ui-{name}` group both TOCs must add;
// a new layout primitive folds into the existing bundle (its page coverage is site-coverage's concern).
//
// Like site-canon/site-coverage this is a STATIC text scan (the TOCs are TypeScript consts in browser modules
// that mount the shell on import — too heavy to import here), scoped to each const's array block so other
// `href:`/`label:` in the file cannot leak in. The label regex keys off the GROUP's child key (links:/cards:),
// which the per-link `label:` entries never carry — so a link label is never mistaken for a group label.

const ROOT = process.cwd()
const COMPONENTS_SRC = `${ROOT}/packages/agent-ui/components/src`
const SITE = `${ROOT}/site`
const read = (p: string): string => readFileSync(p, 'utf8') as string

import type { Dirent } from 'node:fs'

/** Recursively list every file under `dir` (absolute paths); a missing dir yields []. */
function walk(dir: string): string[] {
  let entries: Dirent[]
  try {
    entries = readdirSync(dir, { withFileTypes: true })
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

// The bundled label the whole layout tier shares (the editorial rule — see the header).
const LAYOUT_GROUP_LABEL = 'Layout primitives'

/**
 * The per-component group labels the TOCs MUST enumerate, DERIVED from the fleet: one `ui-{tag}` group per
 * control/container/pattern component, plus the single bundled 'Layout primitives' group whenever any layout
 * primitive ships. (A Set, so the four layout descriptors collapse to one label.)
 */
function expectedGroupLabels(components: readonly ShippedComponent[]): Set<string> {
  const labels = new Set<string>()
  for (const c of components) labels.add(c.tier === 'layout' ? LAYOUT_GROUP_LABEL : c.tag)
  return labels
}

// ── TOC source scanning ─────────────────────────────────────────────────────────────────────────────────────

/** Scope a scan to a top-level `const NAME … = [ … ]` array block (so `href:`/`label:` elsewhere don't leak in). */
function constBlock(src: string, name: string): string {
  const start = src.indexOf(`const ${name}`)
  if (start < 0) return ''
  const rest = src.slice(start)
  const end = rest.indexOf('\n]') // the outer array's closing bracket at column 0 (inner arrays close indented)
  return end < 0 ? rest : rest.slice(0, end)
}

/**
 * The GROUP labels in a TOC block — a `label: '…'` immediately followed by the group's CHILD key (`links:` for the
 * nav, `cards:` for the landing). This excludes the per-link `label:` entries: those are followed by `}`/`href`,
 * never `links:`/`cards:`, so a link label is never counted as a group label.
 */
function groupLabels(block: string, childKey: 'links' | 'cards'): Set<string> {
  const labels = new Set<string>()
  for (const m of block.matchAll(new RegExp(`label:\\s*'([^']+)'\\s*,\\s*${childKey}:`, 'g'))) labels.add(m[1])
  return labels
}

/** The sibling-relative page hrefs (`href: './X.html'` → `X.html`) referenced in a TOC block. */
function hrefs(block: string): string[] {
  const out: string[] = []
  for (const m of block.matchAll(/href:\s*'\.\/([^']+\.html)'/g)) out.push(m[1])
  return out
}

/** Symmetric diff of two label sets — `missing` (expected, absent from the TOC) + `extra` (in the TOC, unexpected). */
function diffLabels(expected: Set<string>, toc: Set<string>): { missing: string[]; extra: string[] } {
  return {
    missing: [...expected].filter((l) => !toc.has(l)).sort(),
    extra: [...toc].filter((l) => !expected.has(l)).sort(),
  }
}

/** The TOC hrefs that point at a non-existent site page (a dead link). */
function deadHrefs(refs: readonly string[], htmlSet: ReadonlySet<string>): string[] {
  return [...new Set(refs)].filter((f) => !htmlSet.has(f)).sort()
}

// NOTE: through wave M1-b a `PENDING_TOC_GROUPS` stopgap parked `ui-sparkline`/`ui-bar-chart` here (their
// descriptors shipped in M1-b, LLD-C8, before their site pages). Wave M1-c (LLD-C9) added both nav/landing TOC
// rows alongside their `*-doc.html` pages, so the stopgap was drained entirely — EXPECTED is now the raw
// fleet-derived set again, and shipping a control without wiring both TOCs fails the build with no exemption.

// ── the live site state ───────────────────────────────────────────────────────────────────────────────────────
const COMPONENTS = shippedComponents()
const EXPECTED = expectedGroupLabels(COMPONENTS)
const NAV_BLOCK = constBlock(read(`${SITE}/pages/_page.ts`), 'NAV')
const CARD_BLOCK = constBlock(read(`${SITE}/main.ts`), 'CARD_GROUPS')
const NAV_LABELS = groupLabels(NAV_BLOCK, 'links')
const CARD_LABELS = groupLabels(CARD_BLOCK, 'cards')
const HTML = new Set<string>(
  readdirSync(SITE, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.html'))
    .map((e) => e.name),
)

// ── the guard ─────────────────────────────────────────────────────────────────────────────────────────────────

describe('site TOC — the fleet-derived expectation + the scans are non-vacuous', () => {
  it('derived per-component group labels from the descriptors (button + the layout bundle)', () => {
    expect(EXPECTED.size).toBeGreaterThanOrEqual(5)
    expect(EXPECTED.has('ui-button')).toBe(true)
    expect(EXPECTED.has(LAYOUT_GROUP_LABEL)).toBe(true)
  })

  it('parsed real GROUP labels out of both TOC blocks (an empty/broken scan cannot pass silently)', () => {
    expect(NAV_LABELS.size).toBeGreaterThanOrEqual(5)
    expect(CARD_LABELS.size).toBeGreaterThanOrEqual(5)
    expect(NAV_LABELS.has('ui-button')).toBe(true)
    expect(CARD_LABELS.has('ui-button')).toBe(true)
  })
})

describe('site TOC — both hand-maintained TOCs enumerate exactly the shipped fleet', () => {
  it('the nav rail (_page.ts NAV) lists every shipped component group and no stale one', () => {
    expect(diffLabels(EXPECTED, NAV_LABELS)).toEqual({ missing: [], extra: [] })
  })

  it('the landing (main.ts CARD_GROUPS) lists every shipped component group and no stale one', () => {
    expect(diffLabels(EXPECTED, CARD_LABELS)).toEqual({ missing: [], extra: [] })
  })

  it('the two renderings agree (nav ≡ landing) — one table of contents, two renderings', () => {
    expect([...NAV_LABELS].sort()).toEqual([...CARD_LABELS].sort())
  })
})

describe('site TOC — no TOC links to a missing page', () => {
  it('found real hrefs in each TOC block (anti-vacuous)', () => {
    expect(hrefs(NAV_BLOCK).length).toBeGreaterThanOrEqual(5)
    expect(hrefs(CARD_BLOCK).length).toBeGreaterThanOrEqual(5)
  })

  it('every nav href resolves to an existing site/*.html', () => {
    expect(deadHrefs(hrefs(NAV_BLOCK), HTML)).toEqual([])
  })

  it('every landing href resolves to an existing site/*.html', () => {
    expect(deadHrefs(hrefs(CARD_BLOCK), HTML)).toEqual([])
  })
})

describe('site TOC — the gate BITES (synthetic negative controls; the pure predicates with synthetic inputs)', () => {
  it('flags a shipped component MISSING from a TOC (a new ui-zzfake never added to the rail)', () => {
    expect(diffLabels(new Set(['ui-button', 'ui-zzfake']), new Set(['ui-button']))).toEqual({ missing: ['ui-zzfake'], extra: [] })
  })

  it('flags a STALE TOC group with no shipped component (a removed component left in the landing)', () => {
    expect(diffLabels(new Set(['ui-button']), new Set(['ui-button', 'ui-ghost']))).toEqual({ missing: [], extra: ['ui-ghost'] })
  })

  it('flags a DEAD TOC href (a typo\'d / removed page)', () => {
    expect(deadHrefs(['button-permutations.html', 'zzfake-doc.html'], HTML)).toEqual(['zzfake-doc.html'])
  })

  it('the group-label scan ignores per-link labels (only a label followed by links:/cards: is a group label)', () => {
    const navish = "label: 'ui-x',\n    links: [\n      { href: './x.html', label: 'Permutations' },\n    ],"
    expect([...groupLabels(navish, 'links')]).toEqual(['ui-x']) // NOT 'Permutations'
  })

  it('the layout tier BUNDLES (4 layout descriptors → 1 expected label), other tiers are per-component', () => {
    const synthetic: ShippedComponent[] = [
      { name: 'button', tag: 'ui-button', tier: 'control' },
      { name: 'row', tag: 'ui-row', tier: 'layout' },
      { name: 'column', tag: 'ui-column', tier: 'layout' },
      { name: 'card', tag: 'ui-card', tier: 'container' },
    ]
    expect([...expectedGroupLabels(synthetic)].sort()).toEqual(['Layout primitives', 'ui-button', 'ui-card'])
  })
})
