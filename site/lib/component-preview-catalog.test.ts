import { describe, it, expect } from 'vitest'
import { defaultCatalog } from '@agent-ui/a2ui'
// Real side-effect import — registers <component-preview> (GH #978's own runtime-probe block below mounts it).
import './component-preview.ts'
import { sampleFor } from './component-preview.ts'
import { browsableNames } from './a2ui-catalog-tiers.ts'
// Raw-text fs read — the same reverse-coupling fs-read pattern the site drift
// gates use (descriptor/site-coverage.test.ts), resolved by vitest/node at runtime.
// @ts-expect-error - node:fs is typed via @types/node; vitest/node resolves it at runtime
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// jsdom reality (the gallery.test.ts precedent — see its own header comment): the ElementInternals
// form-association surface (setFormValue/setValidity) and the native Popover API (showPopover/hidePopover)
// are both absent in jsdom. The runtime-probe block below (GH #978) mounts EVERY browsable a2ui-catalog type
// live (mode="a2ui"), including form-associated + overlay-owning types (TextField, Checkbox, ComboBox,
// Select, Tooltip, Popover, Menu, …) — the same additive, guarded, prototype-level stubs gallery.test.ts
// already established, reapplied here since this is a separate test file/module graph.
if (typeof ElementInternals.prototype.setFormValue !== 'function') {
  ;(ElementInternals.prototype as unknown as Record<string, unknown>).setFormValue = function (): void {}
  ;(ElementInternals.prototype as unknown as Record<string, unknown>).setValidity = function (): void {}
}
if (typeof (HTMLElement.prototype as unknown as { showPopover?: () => void }).showPopover !== 'function') {
  const proto = HTMLElement.prototype as unknown as { showPopover?: () => void; hidePopover?: () => void }
  proto.showPopover = function (): void {}
  proto.hidePopover = function (): void {}
}

// component-preview-catalog.test.ts — the drift gate for the <component-preview> element's TWO hand-authored maps
// (site/lib/component-preview.ts, its sibling here). The element's knobs + variant chips + the catalog page's
// component list are all DERIVED from the shipped default catalog, so they cannot drift; but two small maps are
// hand-keyed by catalog COMPONENT NAME and are exactly where the hand-authored half can fall behind the catalog:
//   • A2UI_INITIAL   — per-component seed props (so a bare specimen renders legibly)
//   • SAMPLE_TREES   — per-container sample children (so a container renders WITH content)
// Rename or drop a catalog component and its map key becomes an orphan that silently seeds/nests nothing. This
// gate reads those keys straight from the site source (fs + regex, the site-coverage idiom) and asserts each is a
// real catalog component name — so an orphaned key FAILS the build rather than degrading a preview in silence.
// Runs under the `site` vitest project; the catalog is imported from the package's public surface (`@agent-ui/a2ui`).

const ROOT = process.cwd()
const PREVIEW_SRC = `${ROOT}/site/lib/component-preview.ts`
const read = (p: string): string => readFileSync(p, 'utf8') as string

/** Strip block + `//` line comments (sparing `://`) so a component name mentioned in a comment is not a live key. */
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*$/gm, '$1')

/**
 * The top-level (2-space-indent) Capitalised keys of a `const <name> ... = { … }` object literal in `src`,
 * scoped to that block (up to the column-0 `\n}`), comment-stripped first — so a commented-out entry does not
 * count. Mirrors site-coverage.test.ts's `sampleKeys` extractor.
 */
function objectKeys(src: string, constName: string): Set<string> {
  const code = stripComments(src)
  const start = code.indexOf(`const ${constName}`)
  const keys = new Set<string>()
  if (start < 0) return keys
  const block = code.slice(start, code.indexOf('\n}', start))
  for (const m of block.matchAll(/\n\s{2}([A-Z][A-Za-z0-9]*):/g)) keys.add(m[1])
  return keys
}

/** The map keys that are NOT real catalog component names — the drift a renamed/removed component introduces. */
const orphans = (keys: Iterable<string>, catalogNames: ReadonlySet<string>): string[] =>
  [...keys].filter((k) => !catalogNames.has(k))

const CATALOG_NAMES = new Set(Object.keys(defaultCatalog.components))
const SRC = read(PREVIEW_SRC)
const INITIAL_KEYS = objectKeys(SRC, 'A2UI_INITIAL')
const SAMPLE_KEYS = objectKeys(SRC, 'SAMPLE_TREES')

describe('component-preview seed/sample maps — anti-vacuous (the extractor found real keys)', () => {
  it('the catalog is enumerable and the maps parsed non-empty', () => {
    expect(CATALOG_NAMES.size).toBeGreaterThanOrEqual(10)
    expect(INITIAL_KEYS.has('Button')).toBe(true) // a known seed
    expect(SAMPLE_KEYS.has('Card')).toBe(true) // a known container sample
    expect(INITIAL_KEYS.size).toBeGreaterThanOrEqual(5)
    expect(SAMPLE_KEYS.size).toBeGreaterThanOrEqual(5)
  })
})

describe('component-preview seed/sample maps — every key is a real catalog component (no orphan)', () => {
  it('A2UI_INITIAL keys ⊆ catalog components', () => {
    expect(orphans(INITIAL_KEYS, CATALOG_NAMES)).toEqual([])
  })
  it('SAMPLE_TREES keys ⊆ catalog components', () => {
    expect(orphans(SAMPLE_KEYS, CATALOG_NAMES)).toEqual([])
  })
})

describe('component-preview seed/sample maps — the orphan check BITES (synthetic negative controls)', () => {
  it('flags a key that is not a catalog component (the check is not vacuously true)', () => {
    expect(orphans(['Button', 'ZzRenamed'], CATALOG_NAMES)).toEqual(['ZzRenamed'])
  })
  it('a key present in the catalog is NOT flagged', () => {
    expect(orphans(['Card'], CATALOG_NAMES)).toEqual([])
  })
})

// ── GH #978 — the runtime probe: no browsable a2ui-catalog type falls through sampleFor()'s generic
// "Sample content" single-Text stub (site/lib/component-preview.ts's `sampleFor`, the fallback branch a
// children-bearing catalog type hits when it has NO explicit SAMPLE_TREES entry). Where the orphan checks
// above are a STATIC regex probe over the source text, this block is a REAL RUNTIME one — the same approach
// #971's own (uncommitted) throwaway vitest probe used, now committed so the acceptance bullet "no catalog
// type renders the generic fallback" stays enforced going forward: a future catalog type with real children
// and no SAMPLE_TREES entry fails THIS test loudly, rather than silently degrading to lorem text on the live
// page. Mounts every name `browsableNames()` yields (the SAME derivation the real a2ui-catalog page itself
// renders from, ../pages/a2ui-catalog.ts) through a REAL <component-preview mode="a2ui"> — not a hand-built
// fixture — so this exercises the actual render pipeline (createRenderer/factories), not a re-implementation
// of it.
describe('component-preview — no browsable catalog type renders the generic "Sample content" fallback (GH #978)', () => {
  const names = browsableNames()

  it('found real browsable catalog names (anti-vacuous — a broken derivation cannot pass silently)', () => {
    expect(names.length).toBeGreaterThan(20)
  })

  /** Mount `<component-preview mode="a2ui" target={name}>`, read back its rendered canvas text, and clean up. */
  function renderedText(name: string): string {
    const preview = document.createElement('component-preview')
    preview.setAttribute('mode', 'a2ui')
    preview.setAttribute('target', name)
    document.body.append(preview)
    const text = preview.querySelector('.canvas-surface')?.textContent ?? ''
    preview.remove()
    return text
  }

  for (const name of names) {
    it(`${name}: does not render the generic "Sample content" fallback text`, () => {
      expect(renderedText(name)).not.toContain('Sample content')
    })
  }

  // Anti-vacuous negative control: `sampleFor` (component-preview.ts's own fallback selector) called with a
  // synthetic children-bearing def under a name that is DELIBERATELY not a SAMPLE_TREES key DOES hit the
  // generic fallback — proving the per-name loop above actually bites rather than passing vacuously (e.g. an
  // empty `.canvas-surface` read). Exercises `sampleFor` directly (not the full renderer/registry — a
  // synthetic catalog name has no registered factory to render through) — see that export's own comment.
  it('the check BITES: sampleFor() falls back to "Sample content" for a children-bearing type with no SAMPLE_TREES entry', () => {
    const zzDef = { children: 'ChildList', properties: {} } as unknown as Parameters<typeof sampleFor>[1]
    const sample = sampleFor('ZzNoSampleTree', zzDef)
    expect(sample.extras.some((c) => c['text'] === 'Sample content')).toBe(true)
  })
})

// ── #readBackA2ui preserves ONLY user-committed live values (the 2026-08-18 sweep's C2 finding) ─────────────
// Without the #armLiveDirty tripwire, ANY knob edit re-read the rendered control's live value slot — its own
// DEFAULT, or a min/max CLAMP — into knob state as if the user had chosen it: editing Slider's `min` knob
// resurrected a `value` the user never set, permanently (scripts/eval-a2ui-catalog.mjs caught it as a C2 red;
// the value knob then visibly showed the phantom). These probes pin both directions in jsdom with the REAL
// renderer: an untouched slot never lands in state on unrelated knob edits; a canvas-committed one survives.
describe('component-preview a2ui mode — readBack preserves only user-committed values (2026-08-18)', () => {
  const mount = (target: string): HTMLElement => {
    const el = document.createElement('component-preview')
    el.setAttribute('mode', 'a2ui')
    el.setAttribute('target', target)
    document.body.append(el)
    return el
  }
  const knobField = (preview: HTMLElement, name: string): HTMLElement & { value: string } => {
    const row = [...preview.querySelectorAll('.knob')].find((r) => r.querySelector('.knob-label')?.textContent === name)
    return row?.querySelector('ui-text-field') as HTMLElement & { value: string }
  }
  const canvasRoot = (preview: HTMLElement): HTMLElement => preview.querySelector('.canvas-surface')?.firstElementChild as HTMLElement

  it('an unrelated knob edit does NOT bake the slider default/clamp into `value` state (negative control)', () => {
    // NB the assertion is on STATE (the value KNOB field), not the canvas attribute: ui-slider itself
    // legitimately reflects its clamped effective value to the attr (min=2 ⇒ value="2" by the control's own
    // reflection). The defect this pins was the phantom landing in KNOB STATE — visible in the value knob,
    // and re-emitted into every later rebuild.
    const preview = mount('Slider')
    expect(canvasRoot(preview).tagName.toLowerCase()).toBe('ui-slider')
    const min = knobField(preview, 'min')
    min.value = '2'
    min.dispatchEvent(new Event('input'))
    expect(knobField(preview, 'value').value ?? '', 'phantom `value` baked into knob state by a min-knob edit').toBe('')
    // and a SECOND unrelated edit (the old failure needed two: clamp → readBack) still leaves state clean
    const step = knobField(preview, 'step')
    step.value = '1'
    step.dispatchEvent(new Event('input'))
    expect(knobField(preview, 'value').value ?? '', 'phantom `value` baked on the second edit').toBe('')
    preview.remove()
  })

  it('a value the user COMMITS on the canvas survives an unrelated knob edit (the preserve leg still works)', () => {
    const preview = mount('Slider')
    const root = canvasRoot(preview) as HTMLElement & { value: number }
    root.value = 5
    root.dispatchEvent(new Event('change')) // the Slider slot's own commit event, from the rendered root
    const step = knobField(preview, 'step')
    step.value = '1'
    step.dispatchEvent(new Event('input'))
    expect(canvasRoot(preview).getAttribute('value'), 'user-committed value lost across the rebuild').toBe('5')
    preview.remove()
  })

  it('an explicit knob edit to the slot itself CLEARS the dirty mark (a knob-reverted value stays reverted)', () => {
    const preview = mount('Slider')
    const root = canvasRoot(preview) as HTMLElement & { value: number }
    root.value = 5
    root.dispatchEvent(new Event('change'))
    const valueKnob = knobField(preview, 'value')
    valueKnob.value = ''
    valueKnob.dispatchEvent(new Event('input')) // the user reverts via the knob — their explicit intent
    const min = knobField(preview, 'min')
    min.value = '2'
    min.dispatchEvent(new Event('input'))
    expect(knobField(preview, 'value').value ?? '', 'knob-reverted value resurrected in state by a later edit').toBe('')
    preview.remove()
  })
})
