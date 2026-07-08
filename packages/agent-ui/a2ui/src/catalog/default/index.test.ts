import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { defaultCatalog } from './index.ts'
import { defaultFactories } from './factories.ts'
import { validateCatalogConformance } from '../conformance.ts'
import { validateA2ui } from '../../renderer/validate.ts'
import { createSurface, disposeSurface } from '../../renderer/surface.ts'
import { installInputBinding } from '../../renderer/input.ts'
import type { A2uiComponent } from '../../protocol.ts'
import { splitFrontmatter, parseDescriptor } from '@agent-ui/components/descriptor'
// Raw-text fs read — same reverse-coupling fs-read pattern
// components/src/descriptor/site-coverage.test.ts uses.
import { readFileSync, readdirSync } from 'node:fs'
declare const process: { cwd(): string }

// jsdom reality (the examples.test.ts precedent, ADR-0055 clause 4): `ElementInternals.setFormValue`/
// `setValidity` are ABSENT in jsdom — every form-associated control (RadioGroup included) calls both
// unconditionally in its own `connectedCallback`, which throws. The RadioGroup round-trip test below
// mounts a REAL `ui-radio-group`/`ui-radio` built via `factory.create()`/`document.createElement`, with
// no per-instance hook to stub — so the stub is applied ONCE at the shared `ElementInternals.prototype`,
// scoped to this file's `beforeAll`/`afterAll` (saved + restored), exactly like `examples.test.ts`.
let savedSetFormValue: unknown
let savedSetValidity: unknown
beforeAll(() => {
  savedSetFormValue = ElementInternals.prototype.setFormValue
  savedSetValidity = ElementInternals.prototype.setValidity
  if (typeof ElementInternals.prototype.setFormValue !== 'function') {
    ElementInternals.prototype.setFormValue = function (): void {}
  }
  if (typeof ElementInternals.prototype.setValidity !== 'function') {
    ElementInternals.prototype.setValidity = function (): void {}
  }
})
afterAll(() => {
  ElementInternals.prototype.setFormValue = savedSetFormValue as typeof ElementInternals.prototype.setFormValue
  ElementInternals.prototype.setValidity = savedSetValidity as typeof ElementInternals.prototype.setValidity
})

// The catalog loaded at import via `loadCatalog` (catalog LLD-C1) — so its mere presence already proves
// SPEC-R1 (well-formed) + SPEC-R2 (every component/property name is a valid UAX-31, non-`@` identifier:
// an invalid name throws CATALOG_NAME_INVALID at load, which would fail this module's import). These
// assertions pin the G9 container declarations + the two-way binds + the conformance verdicts on top.

describe('default catalog (catalog LLD-C4, SPEC-R1/R3/R8/N2)', () => {
  it('loads + exposes the typed Catalog', () => {
    expect(defaultCatalog.catalogId).toBe('agent-ui')
    expect(defaultCatalog.protocolVersion).toBe('v1.0')
  })

  it('declares the shipped family — Text + Button + TextField + the form family + the G9 containers (SPEC-N2: no silent dead types)', () => {
    // Shipped: Text (ADR-0025 Display display type), Button (G5), TextField (G6, widened Wave-5 reach),
    // the ADR-0053 form family (Field/FormProvider/Checkbox/Switch/Select/Option — G7), the G9 containers
    // (Row/Column/Card + regions, Tabs + tab/panel, Modal). The full-fleet coverage gate (below) supersedes
    // this hand-frozen enumeration (ADR-0087 Wave 0) — this assertion pins only the composite/superseded
    // names that never enter the fleet-derived set (parent-declared sub-types + the dead `ChoicePicker`).
    for (const key of ['CardContent', 'CardFooter', 'CardHeader', 'Option', 'Tab', 'TabPanel']) {
      expect(defaultCatalog.components[key], key).toBeDefined()
    }
    expect(defaultCatalog.components.ChoicePicker).toBeUndefined() // superseded by Select (ADR-0053)
  })

  it('does NOT declare the deliberately-absent types (Image/Video — no shipped ui-image/ui-video control)', () => {
    for (const absent of ['Image', 'Video']) {
      expect(defaultCatalog.components[absent], absent).toBeUndefined()
    }
  })

  it('every component name defaults to its declaring key (type identity payloads reference)', () => {
    for (const [key, def] of Object.entries(defaultCatalog.components)) {
      expect(def.name).toBe(key)
    }
  })
})

// ── the fleet-derived coverage gate (ADR-0087 Wave 0) ─────────────────────────────────────────────────────
//
// Replaces the CI-silent hand-frozen `.toEqual([...19 names])` assertion that used to sit above: it could
// never fail when a shipped-but-uncatalogued control landed (a live SPEC-N2 violation — ui-icon/ui-menu/
// ui-popover/ui-tooltip shipped uncatalogued and this file said nothing). This gate DERIVES the expected
// primary-type set from the shipped descriptor fleet itself (mirrors
// `components/src/descriptor/site-coverage.test.ts`'s walk/glob idiom — the SAME source of truth SPEC-N2
// already trusts), subtracts a seeded exclusion allowlist (drained wave-by-wave as ADR-0087 lands each
// type's catalog row), and asserts the remainder is covered by BOTH the catalog and the factory table.

const ROOT = process.cwd()
const CONTROLS_ROOT = `${ROOT}/packages/agent-ui/components/src/controls`

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

/** `ui-{kebab}` → PascalCase (e.g. `ui-text-field` → `TextField`, `ui-radio-group` → `RadioGroup`). */
const pascal = (tag: string): string =>
  tag
    .slice('ui-'.length)
    .split('-')
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join('')

/** Walk every control's `.md` descriptor under `controls/`, read its `tag:` frontmatter scalar, and map
 *  it to its catalog PascalCase name — the fleet-derived "what SHOULD have a catalog row" set (SPEC-N2). */
function fleetPrimaryTypes(): string[] {
  const types: string[] = []
  for (const file of walk(CONTROLS_ROOT)) {
    if (!file.endsWith('.md')) continue
    let parsed
    try {
      parsed = parseDescriptor(splitFrontmatter(read(file)).fence)
    } catch {
      continue // a .md with no frontmatter fence is not a descriptor
    }
    const tag = parsed.scalars.get('tag')
    if (typeof tag !== 'string' || !tag.startsWith('ui-')) continue
    types.push(pascal(tag))
  }
  return types
}

/** The exclusion allowlist — type → reason. Landed EMPTY: all four ADR-0087 forks resolved INCLUDE (Kim,
 *  2026-07-06) and every fork-deferred type drained across Waves A/B/C (a2ui-whole-fleet-catalog.decomp.md
 *  §1/§2); Wave D confirms the residue is exactly empty — no fork-deferred row remains. `Image`/`Video`
 *  are deliberately NOT here — no `ui-image`/`ui-video` descriptor exists, so they never enter the
 *  derived set to begin with (they stay a documentary-only note in SPEC §5.2.1, never code-derived). A
 *  future undispositioned control re-seeds this map with a reason + citation, same as Wave 0's seed. */
const EXCLUSION_ALLOWLIST = new Map<string, string>([])

/** The types in `expected` covered by neither `catalogKeys` nor `allowlist` — the drift this gate exists
 *  to catch. A pure predicate so the negative controls can drive it with synthetic inputs (site-coverage's
 *  `missingPages` precedent). */
function typesMissingCatalog(
  expected: readonly string[],
  catalogKeys: ReadonlySet<string>,
  allowlist: ReadonlyMap<string, string>,
): string[] {
  return expected.filter((t) => !catalogKeys.has(t) && !allowlist.has(t))
}

describe('default catalog — the fleet-derived coverage gate (SPEC-N2, ADR-0087 Wave 0)', () => {
  const FLEET_TYPES = fleetPrimaryTypes()
  const CATALOG_KEYS = new Set(Object.keys(defaultCatalog.components))
  const FACTORY_KEYS = new Set(Object.keys(defaultFactories))

  it('derived the fleet primary-type set (anti-vacuous — a broken scan cannot pass silently)', () => {
    expect(FLEET_TYPES.length).toBeGreaterThan(0)
    expect(FLEET_TYPES).toContain('Button')
    expect(FLEET_TYPES).toContain('TextField')
  })

  it('every fleet type minus the seeded allowlist is covered by the catalog (a shipped, uncatalogued, unallowlisted control FAILS)', () => {
    expect(typesMissingCatalog(FLEET_TYPES, CATALOG_KEYS, EXCLUSION_ALLOWLIST)).toEqual([])
  })

  it('every fleet type minus the seeded allowlist is covered by the factory table too (SPEC-R4/LLD-C5 parity)', () => {
    expect(typesMissingCatalog(FLEET_TYPES, FACTORY_KEYS, EXCLUSION_ALLOWLIST)).toEqual([])
  })

  it('NEGATIVE: the gate predicate actually BITES (synthetic negative controls, not a vacuous pass)', () => {
    // No catalog, no allowlist ⇒ everything is missing.
    expect(typesMissingCatalog(['ZzFake'], new Set(), new Map())).toEqual(['ZzFake'])
    // A real, catalogued type ⇒ nothing missing.
    expect(typesMissingCatalog(['Button'], CATALOG_KEYS, new Map())).toEqual([])
    // A synthetic uncatalogued, unallowlisted type mixed into a real fleet-derived run ⇒ caught.
    expect(typesMissingCatalog([...FLEET_TYPES, 'ZzFake'], CATALOG_KEYS, EXCLUSION_ALLOWLIST)).toEqual(['ZzFake'])
  })
})

describe('default catalog — G9 container declarations (SPEC-R3/R4/R8)', () => {
  it('Row/Column declare the surface + flex grammar mapped 1:1 + a ChildList child model', () => {
    for (const type of ['Row', 'Column']) {
      const def = defaultCatalog.components[type]
      expect(def.children).toBe('ChildList')
      for (const p of ['elevation', 'brightness', 'align', 'justify', 'gap', 'wrap']) {
        expect(def.properties[p]?.mapsTo, `${type}.${p}`).toBe(p) // SPEC-R8 1:1 reflection
      }
    }
  })

  it('Row/Column declare `reflow` with PER-TAG default-first enum ordering (ADR-0096 cl.1/2/4)', () => {
    const asRecord = (schema: unknown): Record<string, unknown> => (typeof schema === 'object' && schema !== null ? schema as Record<string, unknown> : {})
    const row = asRecord(defaultCatalog.components.Row!.properties.reflow!.type)
    expect(row.enum).toEqual(['auto', 'locked']) // ui-row: auto LEADS (default + snap target) — UNCHANGED behavior
    expect(defaultCatalog.components.Row!.properties.reflow?.mapsTo).toBe('reflow')

    const column = asRecord(defaultCatalog.components.Column!.properties.reflow!.type)
    expect(column.enum).toEqual(['locked', 'auto']) // ui-column: locked LEADS — the deliberate default flip
    expect(defaultCatalog.components.Column!.properties.reflow?.mapsTo).toBe('reflow')
  })

  it('Card carries surface axes + a ChildList model; its regions are component-native ChildList children', () => {
    expect(defaultCatalog.components.Card.properties.elevation?.mapsTo).toBe('elevation')
    expect(defaultCatalog.components.Card.children).toBe('ChildList')
    for (const region of ['CardHeader', 'CardContent', 'CardFooter']) {
      expect(defaultCatalog.components[region].children, region).toBe('ChildList')
    }
    expect(defaultCatalog.components.CardContent.properties.scrollable?.mapsTo).toBe('scrollable')
  })

  it('Tabs is two-way bound on selected via the select event; Tab/TabPanel are ChildList sub-types', () => {
    const tabs = defaultCatalog.components.Tabs
    expect(tabs.value).toEqual({ prop: 'selected', event: 'select' }) // ADR-0019 cl.2
    expect(tabs.properties.selected?.bindable).toBe(true)
    expect(tabs.children).toBe('ChildList')
    expect(defaultCatalog.components.Tab.children).toBe('ChildList')
    expect(defaultCatalog.components.TabPanel.children).toBe('ChildList')
  })

  it('Modal is two-way bound on open via the toggle event (ADR-0019 cl.2)', () => {
    const modal = defaultCatalog.components.Modal
    expect(modal.value).toEqual({ prop: 'open', event: 'toggle' })
    expect(modal.properties.open?.bindable).toBe(true)
    expect(modal.properties.persistent?.mapsTo).toBe('persistent')
  })

  it('TextField is value-bound on the change event — the deferred bind, now live (ADR-0019 cl.3)', () => {
    const tf = defaultCatalog.components.TextField
    expect(tf.value).toEqual({ prop: 'value', event: 'change' })
    expect(tf.properties.value?.bindable).toBe(true)
  })
})

describe('default catalog — conformance (SPEC-R7/R9)', () => {
  it('a container payload using declared props yields 0 CATALOG errors (SPEC-R3 AC2 / R7)', () => {
    const nodes: A2uiComponent[] = [
      { id: 'card', component: 'Card', elevation: '1', children: ['hd', 'body'] },
      { id: 'hd', component: 'CardHeader', children: ['title'] },
      { id: 'body', component: 'CardContent', scrollable: true },
      { id: 'row', component: 'Row', align: 'center', gap: 'md', wrap: true },
      { id: 'tabs', component: 'Tabs', selected: 0, children: ['t1', 'p1'] },
      { id: 't1', component: 'Tab', children: ['t1label'] },
      { id: 'p1', component: 'TabPanel' },
      { id: 'modal', component: 'Modal', open: false, persistent: false },
      { id: 'tf', component: 'TextField', value: 'hi', label: 'Name', required: true },
    ]
    for (const node of nodes) {
      expect(validateCatalogConformance(node, defaultCatalog), node.component).toEqual([])
    }
  })

  it('Text.truncate (ADR-0106) is declared boolean + non-bindable, and a truncated Text conforms', () => {
    expect(defaultCatalog.components.Text.properties.truncate?.mapsTo).toBe('truncate')
    expect(defaultCatalog.components.Text.properties.truncate?.bindable).toBeFalsy()
    const node: A2uiComponent = { id: 'txt', component: 'Text', text: 'A clipped title', truncate: true }
    expect(validateCatalogConformance(node, defaultCatalog)).toEqual([])
  })

  it('Text.emphasis (ADR-0109) is declared boolean + non-bindable, and an emphasized Text conforms', () => {
    expect(defaultCatalog.components.Text.properties.emphasis?.mapsTo).toBe('emphasis')
    expect(defaultCatalog.components.Text.properties.emphasis?.bindable).toBeFalsy()
    const node: A2uiComponent = { id: 'txt', component: 'Text', text: 'A key value', emphasis: true }
    expect(validateCatalogConformance(node, defaultCatalog)).toEqual([])
  })

  it('accepts a {path} binding for a bindable prop (selected / open / value)', () => {
    const tabs: A2uiComponent = { id: 'tb', component: 'Tabs', selected: { path: '/active' } }
    const modal: A2uiComponent = { id: 'md', component: 'Modal', open: { path: '/shown' } }
    expect(validateCatalogConformance(tabs, defaultCatalog)).toEqual([])
    expect(validateCatalogConformance(modal, defaultCatalog)).toEqual([])
  })

  it('NEGATIVE: a malformed Modal payload FAILS conformance with CATALOG (security allowlist, SPEC-R9)', () => {
    // The conformance validator (LLD-C6) verdicts PRESENT props (unknown / type-mismatch), not
    // required-presence — so the malformed-payload control is a type mismatch on `open` (declared boolean)
    // plus an undeclared property; both are `CATALOG`, the renderer's not-rendered verdict.
    const typeMismatch: A2uiComponent = { id: 'm1', component: 'Modal', open: 'yes' }
    expect(validateCatalogConformance(typeMismatch, defaultCatalog)).toContainEqual({ code: 'CATALOG', path: 'm1.open' })

    const unknownProp: A2uiComponent = { id: 'm2', component: 'Modal', bogus: 1 }
    expect(validateCatalogConformance(unknownProp, defaultCatalog)).toContainEqual({ code: 'CATALOG', path: 'm2.bogus' })
  })
})

describe('default catalog — form-family rows via the shared validator (ADR-0053, SPEC-R3 AC2/R7)', () => {
  it('a full coordinated form — Field/FormProvider/Checkbox/Switch/Select/Option + the widened TextField reach — validates 0 failures via validateA2ui', () => {
    // ONE complete, valid id-graph exercising every new row in the same shape a real agent payload would
    // (the decomp's Generative Form sketch) — including the Wave-5 numeric reach (type=currency + step/
    // min/max) on the SAME TextField node the n2a accept criterion asks for.
    const message = {
      version: 'v1.0',
      updateComponents: {
        surfaceId: 's1',
        components: [
          { id: 'root', component: 'Card', children: ['form'] },
          { id: 'form', component: 'FormProvider', children: ['f_name', 'f_plan', 'row'] },
          { id: 'f_name', component: 'Field', label: 'Budget', child: 'in_budget' },
          {
            id: 'in_budget', component: 'TextField', name: 'budget',
            type: 'currency', currency: 'EUR', step: 50, min: '0', max: '500', value: '120',
          },
          { id: 'f_plan', component: 'Field', label: 'Plan', child: 'in_plan' },
          {
            id: 'in_plan', component: 'Select', name: 'plan', placeholder: 'Choose…',
            value: 'pro', children: ['opt_a', 'opt_b'],
          },
          { id: 'opt_a', component: 'Option', value: 'starter', label: 'Starter' },
          { id: 'opt_b', component: 'Option', value: 'pro', label: 'Pro' },
          { id: 'row', component: 'Row', children: ['cb', 'sw'] },
          { id: 'cb', component: 'Checkbox', name: 'terms', label: 'I accept the terms', checked: true, required: true },
          { id: 'sw', component: 'Switch', name: 'notify', label: 'Notify me', checked: false },
        ],
      },
    }
    expect(validateA2ui(message, defaultCatalog)).toEqual({ valid: true, failures: [] })
  })

  it('NEGATIVE: an unknown prop on Field still fails CATALOG (SPEC-R9 security allowlist)', () => {
    const bogus: A2uiComponent = { id: 'f1', component: 'Field', label: 'Name', bogus: 1 }
    expect(validateCatalogConformance(bogus, defaultCatalog)).toContainEqual({ code: 'CATALOG', path: 'f1.bogus' })
  })
})

describe('default catalog — Icon/Menu/MenuItem/Popover/Tooltip via the shared validator (ADR-0087 Wave A, SPEC-R3 AC2/R7)', () => {
  it('a full coordinated surface — Icon + Menu/MenuItem + Popover + Tooltip — validates 0 failures via validateA2ui', () => {
    // ONE complete, valid id-graph exercising every Wave A row. Menu/Popover/Tooltip all use the plain
    // positional ChildList (Fork D/d2, builder-resolved): the FIRST child is the trigger/anchor (a
    // Button here), remaining children are the panel content — verified against menu.ts/popover.ts/
    // tooltip.ts, none of which has a named-slot DOM mechanism to bind a *Trigger/*Content sub-type pair to.
    const message = {
      version: 'v1.0',
      updateComponents: {
        surfaceId: 's1',
        components: [
          { id: 'root', component: 'Row', children: ['ic', 'menu', 'pop', 'tip'] },
          { id: 'ic', component: 'Icon', name: 'caret-down', label: 'Expand' },
          { id: 'menu', component: 'Menu', open: false, placement: 'bottom-start', children: ['menu_trigger', 'item_a', 'item_b'] },
          { id: 'menu_trigger', component: 'Button', label: 'Open menu' },
          { id: 'item_a', component: 'MenuItem', value: 'a', label: 'Option A' },
          { id: 'item_b', component: 'MenuItem', value: 'b', label: 'Option B' },
          { id: 'pop', component: 'Popover', open: { path: '/popOpen' }, placement: 'top-start', children: ['pop_trigger', 'pop_content'] },
          { id: 'pop_trigger', component: 'Button', label: 'Open settings' },
          { id: 'pop_content', component: 'Text', text: 'Panel content', variant: 'body' },
          { id: 'tip', component: 'Tooltip', open: false, placement: 'right-start', delay: 300, children: ['tip_anchor', 'tip_content'] },
          { id: 'tip_anchor', component: 'Icon', name: 'x', label: 'Dismiss' },
          { id: 'tip_content', component: 'Text', text: 'Helpful hint', variant: 'caption' },
        ],
      },
    }
    expect(validateA2ui(message, defaultCatalog)).toEqual({ valid: true, failures: [] })
  })

  it('NEGATIVE: an unknown prop fails CATALOG for each of the four Wave A types', () => {
    const icon: A2uiComponent = { id: 'ic1', component: 'Icon', name: 'x', bogus: 1 }
    expect(validateCatalogConformance(icon, defaultCatalog)).toContainEqual({ code: 'CATALOG', path: 'ic1.bogus' })

    const menu: A2uiComponent = { id: 'm1', component: 'Menu', open: false, bogus: 1 }
    expect(validateCatalogConformance(menu, defaultCatalog)).toContainEqual({ code: 'CATALOG', path: 'm1.bogus' })

    const menuItem: A2uiComponent = { id: 'mi1', component: 'MenuItem', value: 'a', bogus: 1 }
    expect(validateCatalogConformance(menuItem, defaultCatalog)).toContainEqual({ code: 'CATALOG', path: 'mi1.bogus' })

    const popover: A2uiComponent = { id: 'p1', component: 'Popover', open: false, bogus: 1 }
    expect(validateCatalogConformance(popover, defaultCatalog)).toContainEqual({ code: 'CATALOG', path: 'p1.bogus' })

    const tooltip: A2uiComponent = { id: 't1', component: 'Tooltip', open: false, bogus: 1 }
    expect(validateCatalogConformance(tooltip, defaultCatalog)).toContainEqual({ code: 'CATALOG', path: 't1.bogus' })
  })

  it('accepts a {path} binding for a bindable prop (Icon.name/label, Menu/Popover/Tooltip.open)', () => {
    const icon: A2uiComponent = { id: 'ic2', component: 'Icon', name: { path: '/iconName' }, label: { path: '/iconLabel' } }
    const menu: A2uiComponent = { id: 'm2', component: 'Menu', open: { path: '/menuOpen' } }
    const popover: A2uiComponent = { id: 'p2', component: 'Popover', open: { path: '/popOpen' } }
    const tooltip: A2uiComponent = { id: 't2', component: 'Tooltip', open: { path: '/tipOpen' } }
    expect(validateCatalogConformance(icon, defaultCatalog)).toEqual([])
    expect(validateCatalogConformance(menu, defaultCatalog)).toEqual([])
    expect(validateCatalogConformance(popover, defaultCatalog)).toEqual([])
    expect(validateCatalogConformance(tooltip, defaultCatalog)).toEqual([])
  })
})

describe('default catalog — RadioGroup/Radio, Slider, SliderMulti, Calendar, ComboBox via the shared validator (ADR-0087 Wave B, SPEC-R3 AC2/R7)', () => {
  it('a full coordinated surface — RadioGroup+Radio, Slider, SliderMulti, Calendar, ComboBox+Option — validates 0 failures via validateA2ui', () => {
    // ONE complete, valid id-graph exercising every Wave B row (the ADR-0053 form-family test's
    // template). RadioGroup carries a data-bound `{path}` on BOTH `disabled` (its bindable prop) and
    // `value` (the follow-up fix — a real `value:{prop:'value',event:'change'}` mark, closing the
    // formerly-verified component-side gap); Slider/Calendar/ComboBox each carry a {path} bind on
    // their real `value:{prop,event}` mark; SliderMulti binds `valueLo`/`valueHi` one-way (Fork C's
    // documented seam limitation — literals here, {path} below).
    const message = {
      version: 'v1.0',
      updateComponents: {
        surfaceId: 's1',
        components: [
          { id: 'root', component: 'Column', children: ['rg', 'sl', 'sm', 'cal', 'cb'] },
          {
            id: 'rg', component: 'RadioGroup', name: 'theme', required: true,
            orientation: 'horizontal', disabled: { path: '/formDisabled' }, value: { path: '/theme' },
            children: ['r1', 'r2'],
          },
          { id: 'r1', component: 'Radio', value: 'light', label: 'Light', checked: true },
          { id: 'r2', component: 'Radio', value: 'dark', label: { path: '/darkLabel' }, checked: false },
          { id: 'sl', component: 'Slider', name: 'volume', min: 0, max: 100, step: 5, value: { path: '/volume' } },
          { id: 'sm', component: 'SliderMulti', name: 'range', min: 0, max: 100, step: 10, valueLo: { path: '/rangeLo' }, valueHi: { path: '/rangeHi' } },
          { id: 'cal', component: 'Calendar', name: 'appt', required: true, min: '2026-01-01', max: '2026-12-31', value: { path: '/apptDate' } },
          {
            id: 'cb', component: 'ComboBox', name: 'plan', label: 'Plan', placeholder: 'Choose…',
            strict: true, value: { path: '/plan' }, children: ['opt_a', 'opt_b'],
          },
          { id: 'opt_a', component: 'Option', value: 'starter', label: 'Starter' },
          { id: 'opt_b', component: 'Option', value: 'pro', label: 'Pro' },
        ],
      },
    }
    expect(validateA2ui(message, defaultCatalog)).toEqual({ valid: true, failures: [] })
  })

  it('NEGATIVE: an unknown prop fails CATALOG for each of the five Wave B types', () => {
    const radioGroup: A2uiComponent = { id: 'rg1', component: 'RadioGroup', name: 'x', bogus: 1 }
    expect(validateCatalogConformance(radioGroup, defaultCatalog)).toContainEqual({ code: 'CATALOG', path: 'rg1.bogus' })

    const radio: A2uiComponent = { id: 'r1', component: 'Radio', value: 'a', bogus: 1 }
    expect(validateCatalogConformance(radio, defaultCatalog)).toContainEqual({ code: 'CATALOG', path: 'r1.bogus' })

    const slider: A2uiComponent = { id: 's1', component: 'Slider', value: 1, bogus: 1 }
    expect(validateCatalogConformance(slider, defaultCatalog)).toContainEqual({ code: 'CATALOG', path: 's1.bogus' })

    const sliderMulti: A2uiComponent = { id: 'sm1', component: 'SliderMulti', valueLo: 1, bogus: 1 }
    expect(validateCatalogConformance(sliderMulti, defaultCatalog)).toContainEqual({ code: 'CATALOG', path: 'sm1.bogus' })

    const calendar: A2uiComponent = { id: 'c1', component: 'Calendar', value: '2026-01-01', bogus: 1 }
    expect(validateCatalogConformance(calendar, defaultCatalog)).toContainEqual({ code: 'CATALOG', path: 'c1.bogus' })

    const comboBox: A2uiComponent = { id: 'cb1', component: 'ComboBox', value: 'a', bogus: 1 }
    expect(validateCatalogConformance(comboBox, defaultCatalog)).toContainEqual({ code: 'CATALOG', path: 'cb1.bogus' })
  })

  it('NEGATIVE: a type-mismatch on a Wave B bindable prop FAILS conformance with CATALOG (security allowlist, SPEC-R9)', () => {
    const slider: A2uiComponent = { id: 's2', component: 'Slider', value: 'not-a-number' }
    expect(validateCatalogConformance(slider, defaultCatalog)).toContainEqual({ code: 'CATALOG', path: 's2.value' })

    const calendar: A2uiComponent = { id: 'c2', component: 'Calendar', value: 42 }
    expect(validateCatalogConformance(calendar, defaultCatalog)).toContainEqual({ code: 'CATALOG', path: 'c2.value' })
  })

  it('accepts a {path} binding for each Wave B bindable prop (RadioGroup.disabled, Radio.checked/label, Slider.value, SliderMulti.valueLo/valueHi, Calendar.value, ComboBox.value/label)', () => {
    const radioGroup: A2uiComponent = { id: 'rg2', component: 'RadioGroup', disabled: { path: '/d' } }
    const radio: A2uiComponent = { id: 'r2', component: 'Radio', checked: { path: '/checked' }, label: { path: '/label' } }
    const slider: A2uiComponent = { id: 's3', component: 'Slider', value: { path: '/volume' } }
    const sliderMulti: A2uiComponent = { id: 'sm2', component: 'SliderMulti', valueLo: { path: '/lo' }, valueHi: { path: '/hi' } }
    const calendar: A2uiComponent = { id: 'c3', component: 'Calendar', value: { path: '/date' } }
    const comboBox: A2uiComponent = { id: 'cb2', component: 'ComboBox', value: { path: '/plan' }, label: { path: '/label' } }
    expect(validateCatalogConformance(radioGroup, defaultCatalog)).toEqual([])
    expect(validateCatalogConformance(radio, defaultCatalog)).toEqual([])
    expect(validateCatalogConformance(slider, defaultCatalog)).toEqual([])
    expect(validateCatalogConformance(sliderMulti, defaultCatalog)).toEqual([])
    expect(validateCatalogConformance(calendar, defaultCatalog)).toEqual([])
    expect(validateCatalogConformance(comboBox, defaultCatalog)).toEqual([])
  })

  it('RadioGroup declares a REAL value prop/mark now — the follow-up fix closing the formerly-verified component-side gap (UIRadioGroupElement gained a public value accessor)', () => {
    expect(defaultCatalog.components.RadioGroup.properties.value).toEqual({
      type: { type: 'string' },
      bindable: true,
      mapsTo: 'value',
    })
    expect(defaultCatalog.components.RadioGroup.value).toEqual({ prop: 'value', event: 'change' })
  })

  it('RadioGroup value is a LIVE two-way bind: a real click on a ui-radio child commits the group selection, and the renderer\'s generic LLD-C8 controller writes it back into surface.data at the bound path (mirrors the Slider/Calendar value:{prop,event} round trip)', () => {
    const surface = createSurface({ id: 's1', catalogId: 'agent-ui', version: 'v1.0' })
    surface.data.value = { theme: 'light' }

    // The real ui-radio-group control + two real ui-radio children (defaultFactories self-defines the
    // whole family on import, catalog/default/factories.ts:1) — no mocks, no stub factory.
    const group = defaultFactories.RadioGroup.create() as HTMLElement & { value: string | null }
    const light = document.createElement('ui-radio')
    light.setAttribute('value', 'light')
    light.setAttribute('checked', '')
    const dark = document.createElement('ui-radio')
    dark.setAttribute('value', 'dark')
    group.append(light, dark)
    // The radios connect BEFORE the group (radio-group.ts's own connected() comment) — appending the
    // whole subtree to the document in one shot preserves that order, so the group seeds
    // `#selectedValue` from the already-checked 'light' radio, matching the payload above.
    document.body.append(group)

    const node: A2uiComponent = { id: 'rg', component: 'RadioGroup', value: { path: '/theme' } }
    installInputBinding(group, defaultFactories.RadioGroup, node, surface)

    // The user gesture: a real click on the unchecked 'dark' radio. Base toggle (unchecked → checked)
    // emits `change`; the group's delegated listener commits the selection (exclusivity + form value)
    // and re-emits exactly ONE `change` on the group itself — the event `installInputBinding` listens for.
    dark.click()

    expect(group.value).toBe('dark') // the new accessor reflects the committed selection
    expect((surface.data.peek() as { theme: unknown }).theme).toBe('dark') // LLD-C8 wrote it back (SPEC-R7)

    group.remove()
    disposeSurface(surface)
  })

  it('SegmentedControl value is a LIVE two-way bind (ADR-0095): a real click on a ui-segment child commits the selection, and the renderer\'s generic LLD-C8 controller writes it back into surface.data', () => {
    const surface = createSurface({ id: 's2', catalogId: 'agent-ui', version: 'v1.0' })
    surface.data.value = { density: 'compact' }

    // The real ui-segmented-control + two real ui-segment children — no mocks, no stub factory.
    const control = defaultFactories.SegmentedControl.create() as HTMLElement & { value: string | null }
    const compact = document.createElement('ui-segment')
    compact.setAttribute('value', 'compact')
    compact.setAttribute('checked', '')
    const spacious = document.createElement('ui-segment')
    spacious.setAttribute('value', 'spacious')
    control.append(compact, spacious)
    // The segments connect BEFORE the control (inherited from radio-group.ts's own connected() comment) —
    // appending the whole subtree to the document in one shot preserves that order.
    document.body.append(control)

    const node: A2uiComponent = { id: 'sc', component: 'SegmentedControl', value: { path: '/density' } }
    installInputBinding(control, defaultFactories.SegmentedControl, node, surface)

    // The user gesture: a real click on the unchecked 'spacious' segment.
    spacious.click()

    expect(control.value).toBe('spacious') // the inherited accessor reflects the committed selection
    expect((surface.data.peek() as { density: unknown }).density).toBe('spacious') // LLD-C8 wrote it back (SPEC-R7)

    control.remove()
    disposeSurface(surface)
  })

  it('SliderMulti declares NO top-level value mark (Fork C — one two-way slot per component; valueLo/valueHi are bindable one-way)', () => {
    expect(defaultCatalog.components.SliderMulti.value).toBeUndefined()
    expect(defaultCatalog.components.SliderMulti.properties.valueLo?.bindable).toBe(true)
    expect(defaultCatalog.components.SliderMulti.properties.valueHi?.bindable).toBe(true)
  })

  it('ComboBox binds value/change, not open/toggle (Fork D/combobox resolution — open carries no catalog property at all)', () => {
    expect(defaultCatalog.components.ComboBox.value).toEqual({ prop: 'value', event: 'change' })
    expect(defaultCatalog.components.ComboBox.properties.open).toBeUndefined()
  })
})

describe('default catalog — Calendar range mode (ADR-0093 clause 7 follow-up): mode + valueStart/valueEnd', () => {
  it('Calendar keeps ITS existing value:{prop:value,event:change} two-way mark (inert-but-harmless in mode=range, per ADR-0093 — the SliderMulti limitation: only one two-way slot per component)', () => {
    expect(defaultCatalog.components.Calendar.value).toEqual({ prop: 'value', event: 'change' })
  })

  it('Calendar declares a non-bindable `mode` enum (single/range) — a structural flag, the orientation/placement precedent, not a second value mark', () => {
    expect(defaultCatalog.components.Calendar.properties.mode).toEqual({
      type: { type: 'string', enum: ['single', 'range'] },
      mapsTo: 'mode',
    })
  })

  it('Calendar declares valueStart/valueEnd as bindable ONE-WAY 1:1 accessors (mirrors SliderMulti.valueLo/valueHi — no top-level value mark of their own)', () => {
    expect(defaultCatalog.components.Calendar.properties.valueStart).toEqual({
      type: { type: 'string' },
      bindable: true,
      mapsTo: 'valueStart',
    })
    expect(defaultCatalog.components.Calendar.properties.valueEnd).toEqual({
      type: { type: 'string' },
      bindable: true,
      mapsTo: 'valueEnd',
    })
  })

  it('a range-mode Calendar payload — mode literal + valueStart/valueEnd {path} binds — validates 0 failures via validateA2ui', () => {
    const message = {
      version: 'v1.0',
      updateComponents: {
        surfaceId: 's1',
        components: [
          {
            id: 'root', component: 'Calendar', mode: 'range', name: 'stay',
            min: '2026-01-01', max: '2026-12-31',
            valueStart: { path: '/checkIn' }, valueEnd: { path: '/checkOut' },
          },
        ],
      },
    }
    expect(validateA2ui(message, defaultCatalog)).toEqual({ valid: true, failures: [] })
  })

  it("NEGATIVE: a type-mismatch on `mode` (non-string) fails CATALOG — the shared validator checks JSON-Schema `type` only, not `enum` membership (matches the fleet's other enum props, e.g. orientation/placement — a documented validator scope limit, not new for this row)", () => {
    const calendar: A2uiComponent = { id: 'c4', component: 'Calendar', mode: 42 }
    expect(validateCatalogConformance(calendar, defaultCatalog)).toContainEqual({ code: 'CATALOG', path: 'c4.mode' })
  })

  it('NEGATIVE: a type-mismatch on valueStart/valueEnd fails CATALOG', () => {
    const calendar: A2uiComponent = { id: 'c5', component: 'Calendar', mode: 'range', valueStart: 42 }
    expect(validateCatalogConformance(calendar, defaultCatalog)).toContainEqual({ code: 'CATALOG', path: 'c5.valueStart' })
  })
})

describe('default catalog — List/Grid via the shared validator (ADR-0087 Wave C, Fork A RESOLVED INCLUDE, SPEC-R3 AC2/R7)', () => {
  it('a List(align/gap)+ChildList payload validates 0 failures via validateA2ui', () => {
    const message = {
      version: 'v1.0',
      updateComponents: {
        surfaceId: 's1',
        components: [
          { id: 'root', component: 'List', align: 'start', justify: 'center', gap: 'md', wrap: false, elevation: '1', children: ['li1', 'li2'] },
          { id: 'li1', component: 'Text', text: 'First result', variant: 'body' },
          { id: 'li2', component: 'Text', text: 'Second result', variant: 'body' },
        ],
      },
    }
    expect(validateA2ui(message, defaultCatalog)).toEqual({ valid: true, failures: [] })
  })

  it('a Grid(gap/min)+ChildList payload validates 0 failures via validateA2ui', () => {
    const message = {
      version: 'v1.0',
      updateComponents: {
        surfaceId: 's1',
        components: [
          { id: 'root', component: 'Grid', gap: 'lg', min: '12rem', brightness: '1', children: ['c1', 'c2'] },
          { id: 'c1', component: 'Card', children: [] },
          { id: 'c2', component: 'Card', children: [] },
        ],
      },
    }
    expect(validateA2ui(message, defaultCatalog)).toEqual({ valid: true, failures: [] })
  })

  it('NEGATIVE: an unknown prop fails CATALOG for both List and Grid', () => {
    const list: A2uiComponent = { id: 'l2', component: 'List', gap: 'sm', bogus: 1 }
    expect(validateCatalogConformance(list, defaultCatalog)).toContainEqual({ code: 'CATALOG', path: 'l2.bogus' })

    const grid: A2uiComponent = { id: 'g2', component: 'Grid', min: '10rem', bogus: 1 }
    expect(validateCatalogConformance(grid, defaultCatalog)).toContainEqual({ code: 'CATALOG', path: 'g2.bogus' })
  })

  it('List/Grid declare no value mark (structural containers, not bindable components)', () => {
    expect(defaultCatalog.components.List.value).toBeUndefined()
    expect(defaultCatalog.components.Grid.value).toBeUndefined()
  })
})
