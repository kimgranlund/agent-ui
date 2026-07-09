import { describe, it, expect } from 'vitest'
import { splitFrontmatter, parseDescriptor } from './component-descriptor.ts'
// Raw-text fs read — same reverse-coupling fs-read pattern as site-canon.test.ts.
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
//     `ui-`), so the required page set is DERIVED from the descriptor, not a hand-list.
//   • A control's REQUIRED page set is keyed off its geometry `tier` (the RATIFIED per-tier sets):
//       - control   (button, text-field)     → {permutations, states, doc}   — per-component (G5 established it)
//       - display   (text)                    → {doc}                         — API doc only (a non-interactive display
//         leaf has no states/permutations matrix; tier=display, ADR-0025)
//       - layout    (row, column, list, grid) → {doc}                         — per-component API doc each, PLUS the
//         shared LAYOUT_SHOWCASE (one overview + one surface×layout demo) required once at the TIER level (not 4
//         near-identical permutation pages)
//       - container (card)                    → {doc, demo}                   — API doc + a composition demo
//       - pattern   (tabs, modal)             → {doc, demo}                   — API doc + an interaction demo
//   • KNOWN_UNDOCUMENTED is the explicit gap of shipped descriptors with no pages yet. It SHRINKS as pages land
//     (a documented component must NOT be listed; an undocumented one MUST be) — empty here: the whole G9 fleet
//     is documented, so a missing required page on ANY shipped component now fails the build.

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

// ── the RATIFIED per-tier required-page sets (derived from the convention) ────────────────────────────────────

const PAGES_BY_TIER: Record<string, readonly string[]> = {
  control: ['permutations', 'states', 'doc'], // form/interactive control (button, text-field)
  display: ['doc'], // a non-interactive display leaf (text) — API doc only (tier=display, ADR-0025; no states/permutations)
  indicator: ['doc'], // an Indicator-class widget control (checkbox, switch, radio — Wave 1, ADR-0041/0042) — API doc
  range: ['doc'], // a Range-class widget control (slider, slider-multi — Wave 2, ADR-0042) — API doc
  layout: ['doc'], // a layout primitive — API doc per-component; the rich matrix is the shared tier showcase
  container: ['doc', 'demo'], // a surface container (card) / form container (radio-group) — API doc + a demo
  pattern: ['doc', 'demo'], // an interactive pattern (tabs, modal) — API doc + an interaction demo
}

/** The page-types a component must ship, keyed off its geometry tier (fallback: at least a `doc`). */
const requiredPages = (tier: string): readonly string[] => PAGES_BY_TIER[tier] ?? ['doc']

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

// The TIER-LEVEL pages the layout family shares (required ONCE, not per layout primitive): the family overview
// (T7) + the shared surface×layout showcase. Required whenever any layout primitive is shipped.
const LAYOUT_SHOWCASE = ['layout-overview.html', 'layout-permutations.html'] as const

// ── the explicit gap (SHRINKS as pages land; empty = the whole fleet is documented) ──────────────────────────
// Wave 1 Indicator family shipped (checkbox, switch, radio, radio-group) without site pages — tracked here.
// Empty = the whole fleet is documented. The Wave-1 Indicator pages (checkbox/switch/radio doc + radio-group
// doc & demo) landed, so their stopgap entries were removed — a missing required page on ANY shipped component
// now fails the build again (not silently parked here).
//
// The Wave M1 chart family (ADR-0107, chart-family.lld.md) parked HERE through wave M1-b: `ui-sparkline` +
// `ui-bar-chart` shipped their descriptors in M1-b (LLD-C7/C8) before their site pages existed. Wave M1-c
// (LLD-C9) shipped `sparkline-doc.html` / `bar-chart-doc.html`, so BOTH entries were drained — the whole fleet
// is documented again, and a missing required page on ANY shipped component (chart family included) now fails
// the build rather than sitting silently parked here.
//
// The Wave M1 report family (ADR-0111, report-family.lld.md LLD-C11) + content family (ADR-0113,
// content-family.lld.md LLD-C12) + feed family (ADR-0112, feed-family.lld.md LLD-C12) all landed their
// required site pages (table-doc/stat-doc/badge-doc, code-doc/disclosure-doc+demo,
// progress-doc/avatar-doc/attachment-doc/toast-region-doc/toast-doc+demo) — the stopgap DRAINED entirely, the
// same way the M1-b chart-family stopgap drained at M1-c. Empty again = the whole fleet is documented; a
// missing required page on ANY shipped component now fails the build.
const KNOWN_UNDOCUMENTED = new Set<string>([])

// ── the live site state ───────────────────────────────────────────────────────────────────────────────────────
const COMPONENTS = shippedComponents()
const HTML = new Set<string>(
  readdirSync(SITE, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.html'))
    .map((e) => e.name),
)
const isDocumented = (c: ShippedComponent): boolean => missingPages(c.name, c.tier, HTML).length === 0

// ── the guard ─────────────────────────────────────────────────────────────────────────────────────────────────

describe('site coverage — the descriptor fleet is enumerable (anti-vacuous)', () => {
  it('found the shipped descriptors (button + text-field + the G9 containers)', () => {
    const names = COMPONENTS.map((c) => c.name)
    expect(names).toContain('button')
    expect(names).toContain('text-field')
    expect(names).toContain('text') // the display leaf (ADR-0025)
    expect(COMPONENTS.length).toBeGreaterThanOrEqual(14) // 2 controls + 1 display leaf + 3 indicators + 7 G9 descriptors + radio-group
  })

  it('discovered the real site/ html shells (an empty/broken scan cannot pass silently)', () => {
    expect(HTML.has('button-permutations.html')).toBe(true)
    expect(HTML.has('text-field-doc.html')).toBe(true)
    expect(HTML.size).toBeGreaterThanOrEqual(20) // 8 control/site pages + 7 container docs + 2 layout-showcase + 3 demos
  })
})

describe('site coverage — every shipped component has its required per-tier page set', () => {
  // The live bite: every descriptor (control + container) must have all its tier-required `{name}-{type}.html`
  // pages. Drop or rename one and this fails — the gate that keeps the docs in lock-step with the fleet.
  // A component listed in KNOWN_UNDOCUMENTED (the explicit, deliberate parking gap above) is exempted HERE too
  // — `it.skip` keeps the test node visible (not silently dropped) while it is legitimately pending its wave.
  for (const c of COMPONENTS) {
    const title = `${c.tag} (tier=${c.tier}) has all of {${requiredPages(c.tier).join(', ')}} pages`
    if (KNOWN_UNDOCUMENTED.has(c.name)) {
      it.skip(`${title} — SKIPPED (KNOWN_UNDOCUMENTED, not yet built)`, () => {})
      continue
    }
    it(title, () => {
      expect(missingPages(c.name, c.tier, HTML)).toEqual([])
    })
  }

  it('sourced the controls, the display leaf, the Wave 1 indicators, the Wave 2 Range controls, and the G9 containers/patterns/layout', () => {
    expect(COMPONENTS.filter((c) => c.tier === 'control').map((c) => c.name).sort()).toEqual(['button', 'text-field'])
    // Display tier: ui-text (ADR-0025) + ui-icon (ADR-0065/0066, the icon-adapter's declarative consumer) +
    // the Wave M1 chart family (ADR-0107): ui-sparkline + ui-bar-chart + the Wave M1 report family (ADR-0111):
    // ui-table + ui-stat + ui-badge + the Wave M1 content family (ADR-0113): ui-code + the Wave M1 feed
    // family (ADR-0112): ui-progress (a rail, not a widget box) + ui-attachment (a compact file card).
    expect(COMPONENTS.filter((c) => c.tier === 'display').map((c) => c.name).sort()).toEqual(
      ['attachment', 'badge', 'bar-chart', 'code', 'icon', 'progress', 'sparkline', 'stat', 'table', 'text'],
    )
    // Wave 1 Indicator family (checkbox, switch, radio, radio-group) + ui-segment (ADR-0095 clause 3 —
    // the SAME real ancestor, UIIndicatorElement, as ui-radio) + the Wave M1 feed family (ADR-0112): ui-avatar
    // (fork F3 — the same widget-box class as checkbox/switch/tag): tier=indicator/container (not control/display)
    expect(COMPONENTS.filter((c) => c.tier === 'indicator').map((c) => c.name).sort()).toEqual(
      ['avatar', 'checkbox', 'radio', 'segment', 'slider', 'switch'],
    )
    // Wave 2 Range family (slider, slider-multi — ADR-0042): tier=range
    expect(COMPONENTS.filter((c) => c.tier === 'range').map((c) => c.name).sort()).toEqual(['slider-multi'])
    // Container tier = the G9 surface/form containers (card, radio-group) + the G7 form-composition family
    // (field, form-provider — both tier=container, ADR-0050/0051). Each requires its {doc, demo} pages.
    expect(COMPONENTS.filter((c) => c.tier === 'container').map((c) => c.name).sort()).toEqual(
      ['card', 'field', 'form-provider', 'radio-group'],
    )
    // Layout tier + the Wave M1 feed family's ui-toast-region (ADR-0112, LLD-C8 — a pure inset/gap host,
    // no surface paint of its own).
    expect(COMPONENTS.filter((c) => c.tier === 'layout').map((c) => c.name).sort()).toEqual(
      ['column', 'grid', 'list', 'row', 'toast-region'],
    )
    // Pattern tier = the G9 patterns (modal, tabs) + the Wave 4 Overlay family (popover, tooltip, menu, select,
    // combo-box — all tier=pattern on the overlay controller, ADR-0043) + the Wave 5B date picker (calendar,
    // ADR-0048) + ui-segmented-control (ADR-0095 — geometry.md's own named Pattern example) + the Wave M1
    // content family (ADR-0113): ui-disclosure (native details/summary fold) + the Wave M1 feed family
    // (ADR-0112): ui-toast (a fixed-width notification card — Container/surface geometry, not a control
    // height). Each requires its {doc, demo} pages.
    expect(COMPONENTS.filter((c) => c.tier === 'pattern').map((c) => c.name).sort()).toEqual(
      ['calendar', 'combo-box', 'disclosure', 'menu', 'modal', 'popover', 'segmented-control', 'select', 'tabs', 'toast', 'tooltip'],
    )
  })
})

describe('site coverage — the shared layout-tier showcase exists (T7 overview + surface×layout demo)', () => {
  const layoutShipped = COMPONENTS.some((c) => c.tier === 'layout')

  it('a layout primitive is shipped (anti-vacuous — the showcase requirement is live)', () => {
    expect(layoutShipped).toBe(true)
  })

  for (const file of LAYOUT_SHOWCASE) {
    it(`${file} exists (the layout family's required tier-level page)`, () => {
      expect(HTML.has(file)).toBe(true)
    })
  }
})

describe('site coverage — every descriptor is documented XOR a known, deliberate gap', () => {
  for (const c of COMPONENTS) {
    it(`${c.tag} — documented(${isDocumented(c)}) === not-in-known-gap`, () => {
      // documented IFF not listed: a documented component must NOT be in KNOWN_UNDOCUMENTED, an undocumented one
      // MUST be. The gap is non-empty again (the report/content family's M1-a/b shared-file slice shipped
      // descriptors before their site pages — report-family LLD-C11 / content-family LLD-C12 drains it).
      expect(isDocumented(c)).toBe(!KNOWN_UNDOCUMENTED.has(c.name))
    })
  }

  it('KNOWN_UNDOCUMENTED lists exactly the real undocumented descriptors (no stale name lingers, no surprise gap)', () => {
    const undocumentedNames = COMPONENTS.filter((c) => !isDocumented(c)).map((c) => c.name).sort()
    expect([...KNOWN_UNDOCUMENTED].sort()).toEqual(undocumentedNames)
    // empty again — the report-family LLD-C11 / content-family LLD-C12 / feed-family LLD-C12 site pages all
    // landed, draining the gap the same way the M1-b chart-family stopgap drained at M1-c.
    expect([...KNOWN_UNDOCUMENTED].sort()).toEqual([])
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

  it('catches a dropped CONTAINER demo page (simulate a deleted card-demo.html)', () => {
    const dropped = new Set(HTML)
    dropped.delete('card-demo.html')
    expect(missingPages('card', 'container', dropped)).toEqual(['card-demo.html'])
  })

  it('applies the RATIFIED per-tier sets: display→{doc}, layout→{doc}, container/pattern→{doc,demo}, control→{perm,states,doc}', () => {
    expect(missingPages('row', 'layout', new Set(['row-doc.html']))).toEqual([]) // layout needs only its doc
    expect(missingPages('text', 'display', new Set())).toEqual(['text-doc.html']) // display needs only its doc — and BITES when absent
    expect(missingPages('text', 'display', new Set(['text-doc.html']))).toEqual([]) // …present ⇒ clean
    expect(missingPages('card', 'container', new Set(['card-doc.html']))).toEqual(['card-demo.html']) // …+ a demo
    expect(missingPages('tabs', 'pattern', new Set(['tabs-doc.html', 'tabs-demo.html']))).toEqual([])
    expect(missingPages('demo', 'control', new Set())).toEqual(['demo-permutations.html', 'demo-states.html', 'demo-doc.html'])
  })

  it('the layout-showcase membership predicate can fail (an absent showcase page is caught)', () => {
    expect(new Set<string>().has('layout-overview.html')).toBe(false)
  })
})

// ── the ui-text-field [type] → representative-sample coverage gate (Wave 5A/5B) ───────────────────────────────
// The text-field permutations page DERIVES the SET of type specimens from the parsed `type` enum (a new type
// renders automatically), but the per-type editorial seed + caption (its TYPE_SAMPLES map) is HAND-AUTHORED. That
// seam is exactly where the hand-authored half can fall behind the descriptor: Wave 5 grew the enum 8 → 12
// (unit/percent/date/time) while the samples sat at 8, so the four new types rendered with a bare fallback
// caption. This gate closes it — every parsed `type` MUST have a TYPE_SAMPLES entry, so a future type addition
// either ships a representative sample or FAILS the build rather than a silent bare caption.

const TEXT_FIELD_MD = `${COMPONENTS_SRC}/controls/text-field/text-field.md`
const PERMUTATIONS_PAGE = `${SITE}/pages/text-field-permutations.ts`

/** The parsed `type` enum members from text-field.md — the derived SET the permutations page iterates over. */
function textFieldTypes(): string[] {
  const parsed = parseDescriptor(splitFrontmatter(read(TEXT_FIELD_MD)).fence)
  return parsed.attributes.find((a) => a.name === 'type')?.values ?? []
}

/**
 * The TYPE_SAMPLES object-literal keys in `src` (a permutations-page source). Comment-stripped first (a
 * commented-out key does NOT count), then scoped to the `const TYPE_SAMPLES = { … }` block so no unrelated
 * 2-space-indented `key: {` elsewhere in the file is mistaken for a sample. Each entry is a `\n  <name>: {` line.
 */
function sampleKeys(src: string): Set<string> {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*$/gm, '$1')
  const start = code.indexOf('const TYPE_SAMPLES')
  const keys = new Set<string>()
  if (start < 0) return keys
  const block = code.slice(start, code.indexOf('\n}', start))
  for (const m of block.matchAll(/\n\s{2}([a-z][\w-]*):\s*\{/g)) keys.add(m[1])
  return keys
}

/** The parsed types with NO representative sample in `keys` — the drift a new type addition would introduce. */
function typesMissingSample(types: readonly string[], keys: ReadonlySet<string>): string[] {
  return types.filter((t) => !keys.has(t))
}

describe('site coverage — every ui-text-field [type] has a representative permutations sample', () => {
  const TYPES = textFieldTypes()
  const KEYS = sampleKeys(read(PERMUTATIONS_PAGE))

  it('parsed the type enum (anti-vacuous — the 12 Wave-5 types are present)', () => {
    expect(TYPES.length).toBeGreaterThanOrEqual(12)
    for (const t of ['unit', 'percent', 'date', 'time']) expect(TYPES, `missing parsed type: ${t}`).toContain(t)
  })

  it('found the TYPE_SAMPLES keys (anti-vacuous — a broken scan cannot pass silently)', () => {
    expect(KEYS.size).toBeGreaterThanOrEqual(12)
  })

  it('every parsed type has a TYPE_SAMPLES entry (a new type cannot ship a bare fallback caption)', () => {
    expect(typesMissingSample(TYPES, KEYS)).toEqual([])
  })
})

describe('site coverage — the type-sample check BITES (synthetic negative controls)', () => {
  const KEYS = sampleKeys(read(PERMUTATIONS_PAGE))

  it('flags a synthetic type with no sample (the check is not vacuously true)', () => {
    expect(typesMissingSample(['text', 'zzdatetime'], KEYS)).toEqual(['zzdatetime'])
  })

  it('does NOT count a sample key that lives only in a comment (comment-stripped scan)', () => {
    const keys = sampleKeys(
      "const TYPE_SAMPLES: Record<string, TypeSample> = {\n  // zzcmt: { value: 'x' },\n  zzreal: { value: 'y' },\n}",
    )
    expect(keys.has('zzcmt')).toBe(false)
    expect(keys.has('zzreal')).toBe(true)
  })
})
