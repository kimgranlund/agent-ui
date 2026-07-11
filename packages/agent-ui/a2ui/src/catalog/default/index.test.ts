import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { defaultCatalog } from './index.ts'
import { defaultFactories } from './factories.ts'
import { validateCatalogConformance } from '../conformance.ts'
import { validateA2ui } from '../../renderer/validate.ts'
import { createSurface, disposeSurface } from '../../renderer/surface.ts'
import { installInputBinding } from '../../renderer/input.ts'
import { createRenderer } from '../../renderer/renderer.ts'
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

/** The exclusion allowlist — type → reason. Landed EMPTY after Wave D (all ADR-0087 forks resolved INCLUDE,
 *  Kim 2026-07-06) and stayed empty through the M1 chart-family drain (`BarChart`/`Sparkline`, ADR-0107,
 *  LLD-C10). The Wave M1 report/content/feed catalog pass (ADR-0111/0113/0112) DRAINED all eight temporary
 *  "shipped ahead of its catalog row" seeds it had accumulated (`Table`/`Stat`/`Badge`,
 *  report-family.lld.md LLD-C12; `Code`/`Disclosure`, content-family.lld.md LLD-C13;
 *  `Progress`/`Avatar`/`Attachment`, feed-family.lld.md LLD-C13) — their catalog rows now exist, so their
 *  seeds are REMOVED, not left as residue (the residue-guard test below would fail if they weren't). The
 *  token-surface family (ADR-0118, `Swatch`/`Ramp`/`Ladder`) re-seeded this SAME "shipped ahead of its
 *  catalog row" shape at M1 (token-surfaces.lld.md LLD-C10) — deliberately split from M1 (controls +
 *  allowlist seed) into a separate M2 wave (rows + exemplar + guidance, LLD-C13/C14/C15, ADR-0118 fork
 *  F4); the M2 wave lands the three rows below and DRAINS that seed too, the same way the report/content/
 *  feed seeds above were drained. `Image`/`Video` are deliberately NOT here — no `ui-image`/`ui-video`
 *  descriptor exists, so they never enter the derived set to begin with (they stay a documentary-only note
 *  in SPEC §5.2.1, never code-derived). A future undispositioned control re-seeds this map with a reason +
 *  citation, same as Wave 0's seed. */
// ADR-0123 (color-picker.lld.md) M1 wave: `ColorPicker` ships its control here but NOT its catalog row —
// the M1/M2 discipline (ADR-0118 precedent) splits control-ship from catalog-row+exemplar+guidance into a
// separate, one-context-sized M2 wave. This is a TEMPORARY "shipped ahead of its catalog row" seed (the
// report/content/feed/token-surface precedent above) — M2 lands the `ColorPicker` row + a validator-clean
// exemplar + §5.2 guidance and DRAINS this entry, the same way those families' seeds were drained.
//
// `Toast`/`ToastRegion`/`ThemeProvider`/`StatusStream`/`SwiperPagination`/`SwiperPaddles`/`SwiperLabel`/`CommandModal` are
// the only PERMANENT entries — NOT catalogue-bound AT ALL (app-surface/theming/live-streaming/chrome-anchor
// content) — never drained.
const EXCLUSION_ALLOWLIST = new Map<string, string>([
  ['ColorPicker',
    'ADR-0123 / color-picker.lld.md — TEMPORARY, M1-seeded: the control ships in this wave, the catalog ' +
    'row + exemplar + §5.2 guidance land in a follow-on M2 wave (the ADR-0118 M1/M2 discipline). Drains ' +
    'at M2, not permanent.'],
  ['Toast', 'ADR-0112 cl.6 — PERMANENT exclusion, never catalogue-bound: app-surface chrome driven by show(), not agent-emittable (rejected explicitly: history-must-not-lie · payload↔DOM traceability · teaching a forbidden type).'],
  ['ToastRegion', 'ADR-0112 cl.6 — PERMANENT exclusion, same reasoning as Toast: app-surface chrome, never a catalog row.'],
  ['ThemeProvider',
    'ADR-0117 / theme-provider.spec.md SPEC-R8 — PERMANENT exclusion, never catalogue-bound: ' +
    'page/app-owner theming chrome establishing a color-scheme subtree, not agent-emittable content ' +
    '(the ADR-0112 cl.6 Toast/ToastRegion reasoning applied verbatim).'],
  ['StatusStream',
    'ADR-0122 F5 / timeline-family.lld.md §4 — PERMANENT exclusion, never catalogue-bound: a live "what the ' +
    'system is doing now" strip driven entirely by a consumer-owned imperative API (appendEntry/update/' +
    'finalize) over a stream the consumer holds — not a one-shot serializable component tree (the ADR-0112 ' +
    'cl.6 Toast/ToastRegion reasoning applied verbatim: an agent emits a durable Timeline snapshot instead).'],
  ['SwiperPagination',
    'ADR-0124 F5 / swiper-family.lld.md LLD-C9 — PERMANENT exclusion, never catalogue-bound: an author-' +
    'placed chrome anchor the owning ui-swiper fills/wires wherever it is written; an agent reaches the ' +
    'same dots UI via the [pagination] boolean stamp on Swiper itself (F3) — an agent-emitted anchor node ' +
    'would carry no content of its own (the coordinator renders every dot), pure noise (the ADR-0112 cl.6 ' +
    'Toast/ToastRegion reasoning applied verbatim).'],
  ['SwiperPaddles',
    'ADR-0124 F5 / swiper-family.lld.md LLD-C10 — PERMANENT exclusion, same reasoning as SwiperPagination: ' +
    'an author-placed anchor the coordinator fills with two composed prev/next ui-buttons; the [paddles] ' +
    'boolean stamp is the agent-reachable fallback (F3).'],
  ['SwiperLabel',
    'ADR-0124 F5 / swiper-family.lld.md LLD-C11 — PERMANENT exclusion, same reasoning: an author-placed ' +
    'anchor whose light-DOM text becomes the owning ui-swiper\'s accessible name; an agent-emitted empty ' +
    'marker node carries no catalog-visible content, and the region already falls back to "Carousel" absent one.'],
  ['CommandModal',
    'ADR-0125 F8 / command-modal.lld.md LLD-C16 — PERMANENT exclusion: the CMD-K palette is app-owner ' +
    'launcher chrome (the Toast/ThemeProvider/StatusStream class, ADR-0112 cl.6 reasoning) — an agent ' +
    'emitting an app\'s command palette is the wrong trust shape; its items are the consumer\'s actions.'],
])

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

/** The allowlist keys that ALSO appear in `catalogKeys` — a drained-but-not-removed seed (chart-family.lld.md
 *  §4 M1-b footprint). Same predicate-extraction shape as `typesMissingCatalog` (the M1-d review follow-up:
 *  the standing residue-guard test below iterates the REAL `EXCLUSION_ALLOWLIST`, which as of the feed-family
 *  wave permanently holds Toast/ToastRegion (ADR-0112 cl.6) — the standing gate passes NON-vacuously, since
 *  neither is ever catalogued. Extracted here so a synthetic, non-empty allowlist can ALSO drive it directly
 *  with a real bite, independent of whatever the real map happens to hold at any given time). */
function allowlistResidue(catalogKeys: ReadonlySet<string>, allowlist: ReadonlyMap<string, string>): string[] {
  return [...allowlist.keys()].filter((type) => catalogKeys.has(type))
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

  it('the allowlist carries NO residue — every seeded key is ABSENT from the catalog (a drained entry can never stay silently green, chart-family.lld.md §4 M1-b footprint)', () => {
    // A future wave that seeds an allowlist entry and then lands the row WITHOUT draining the seed would
    // otherwise pass the two checks above (the type is now catalog-covered) while the stale allowlist
    // entry sits there inert forever — this assertion makes that residue a hard failure instead. The
    // standing gate calls the SAME predicate the negative control below proves (the typesMissingCatalog
    // shape — one assertion form, review-mandated: two parallel forms drift).
    expect(allowlistResidue(CATALOG_KEYS, EXCLUSION_ALLOWLIST)).toEqual([])
  })

  it('NEGATIVE: the residue-guard assertion form actually BITES (synthetic control — M1-d review follow-up)', () => {
    // The real `EXCLUSION_ALLOWLIST` now permanently holds Toast/ToastRegion (ADR-0112 cl.6), so the
    // standing gate above already exercises the predicate non-vacuously. This test drives the SAME
    // predicate with a SYNTHETIC allowlist that deliberately collides with a real catalog key — independent
    // proof the check catches residue when residue actually exists, not dependent on the real map's shape.
    expect(allowlistResidue(CATALOG_KEYS, new Map([['Button', 'planted residue']]))).toEqual(['Button']) // bites
    expect(allowlistResidue(CATALOG_KEYS, new Map([['ZzNeverCatalogued', 'still deferred']]))).toEqual([]) // stays clean
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

// ── the ADR-0107 chart family (Sparkline / BarChart), catalog LLD-C10, chart-family.lld.md §5 ─────────
//
// SPEC-R13 AC1 (fleet-derived coverage, zero allowlist residue) is proven by the two describe blocks
// above (the drained `EXCLUSION_ALLOWLIST` + the residue guard). This block proves SPEC-R13 AC2: the
// ADR-0107 clause-2 example payloads (verbatim) validate 0-`CATALOG` via `validateA2ui`, AND a `values`
// bound as `{ "path": "/trend" }` renders the series and re-renders on `updateDataModel` — the live,
// end-to-end proof (not just a static conformance check), mirroring renderer.test.ts's bound-prop
// integration pattern (the `{path}`-bound Button.label / updateDataModel round trip).
describe('default catalog — Sparkline/BarChart via the shared validator (ADR-0107, chart-family.spec.md SPEC-R13)', () => {
  it('the ADR-0107 clause-2 example payloads (verbatim) validate 0 failures via validateA2ui', () => {
    const message = {
      version: 'v1.0',
      updateComponents: {
        surfaceId: 's1',
        components: [
          { id: 'root', component: 'Row', children: ['spark', 'bars'] },
          { id: 'spark', component: 'Sparkline', values: [3, 5, 4, 8, 7] },
          {
            id: 'bars', component: 'BarChart',
            data: [
              { label: 'EMEA', value: 42 },
              { label: 'APAC', value: 31 },
            ],
          },
        ],
      },
    }
    expect(validateA2ui(message, defaultCatalog)).toEqual({ valid: true, failures: [] })
  })

  it('Sparkline/BarChart declare display-only rows: no value mark, no children (SPEC-R13, ADR-0107 cl.6)', () => {
    expect(defaultCatalog.components.Sparkline.value).toBeUndefined()
    expect(defaultCatalog.components.Sparkline.children).toBeUndefined()
    expect(defaultCatalog.components.BarChart.value).toBeUndefined()
    expect(defaultCatalog.components.BarChart.children).toBeUndefined()
  })

  it('Sparkline.values/label and BarChart.data/label are bindable; Sparkline.variant is a non-bindable structural enum', () => {
    expect(defaultCatalog.components.Sparkline.properties.values?.bindable).toBe(true)
    expect(defaultCatalog.components.Sparkline.properties.label?.bindable).toBe(true)
    expect(defaultCatalog.components.Sparkline.properties.variant?.bindable).toBeFalsy()
    expect(defaultCatalog.components.BarChart.properties.data?.bindable).toBe(true)
    expect(defaultCatalog.components.BarChart.properties.label?.bindable).toBe(true)
  })

  it('accepts a {path} binding for values/data (bindable array props)', () => {
    const spark: A2uiComponent = { id: 'sp1', component: 'Sparkline', values: { path: '/trend' } }
    const bars: A2uiComponent = { id: 'bc1', component: 'BarChart', data: { path: '/regions' } }
    expect(validateCatalogConformance(spark, defaultCatalog)).toEqual([])
    expect(validateCatalogConformance(bars, defaultCatalog)).toEqual([])
  })

  it('NEGATIVE: an unknown prop fails CATALOG for both Sparkline and BarChart', () => {
    const spark: A2uiComponent = { id: 'sp2', component: 'Sparkline', values: [1, 2], bogus: 1 }
    expect(validateCatalogConformance(spark, defaultCatalog)).toContainEqual({ code: 'CATALOG', path: 'sp2.bogus' })

    const bars: A2uiComponent = { id: 'bc2', component: 'BarChart', data: [], bogus: 1 }
    expect(validateCatalogConformance(bars, defaultCatalog)).toContainEqual({ code: 'CATALOG', path: 'bc2.bogus' })
  })

  it('a {path}-bound Sparkline.values renders the series (real ui-sparkline, no mocks) and re-renders on updateDataModel (SPEC-R13 AC2, the live round trip)', async () => {
    const r = createRenderer({ newId: () => 'act-1', now: () => '2026-07-08T00:00:00.000Z' })
    const mount = document.createElement('div')
    document.body.appendChild(mount)
    r.mount(mount)

    const line = (message: unknown): string => JSON.stringify(message)
    r.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 'sc', catalogId: 'agent-ui' } }))
    r.ingest(
      line({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'sc',
          components: [{ id: 'root', component: 'Sparkline', values: { path: '/trend' }, label: 'Revenue trend' }],
        },
      }),
    )

    const el = mount.querySelector('ui-sparkline') as HTMLElement & { values?: unknown }
    expect(el).toBeTruthy() // the REAL upgraded control, not a placeholder

    // No data yet — the bound-prop effect started on an unresolved path (SPEC-R4 AC2: still no throw).
    expect(el.querySelector('svg')).toBeNull() // an empty rendered set clears the host (LLD-C2 mark effect)

    r.ingest(line({ version: 'v1.0', updateDataModel: { surfaceId: 'sc', path: '/trend', value: [3, 5, 4, 8, 7] } }))
    await whenFlushed()
    expect(el.values).toEqual([3, 5, 4, 8, 7]) // the data→control bound prop applied
    const line1 = el.querySelector('svg polyline[data-part="line"]')
    expect(line1).toBeTruthy() // the mark rendered from the bound path

    // A second updateDataModel re-renders the mark (whole-array swap semantics, SPEC-R2).
    r.ingest(line({ version: 'v1.0', updateDataModel: { surfaceId: 'sc', path: '/trend', value: [1, 2] } }))
    await whenFlushed()
    expect(el.values).toEqual([1, 2])
    const line2 = el.querySelector('svg polyline[data-part="line"]')
    expect(line2).toBeTruthy()
    expect(line2!.getAttribute('points')).not.toBe(line1!.getAttribute('points')) // a genuinely different mark, not a stale re-paint

    r.dispose()
    mount.remove()
  })

  it('a {path}-bound BarChart.data renders the rows (real ui-bar-chart, no mocks) and re-renders on updateDataModel (SPEC-R13 AC2, M1-d review follow-up: the BarChart sibling of the Sparkline live leg above)', async () => {
    const r = createRenderer({ newId: () => 'act-1', now: () => '2026-07-08T00:00:00.000Z' })
    const mount = document.createElement('div')
    document.body.appendChild(mount)
    r.mount(mount)

    const line = (message: unknown): string => JSON.stringify(message)
    r.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 'bc', catalogId: 'agent-ui' } }))
    r.ingest(
      line({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'bc',
          components: [{ id: 'root', component: 'BarChart', data: { path: '/regions' }, label: 'Revenue by region' }],
        },
      }),
    )

    const el = mount.querySelector('ui-bar-chart') as HTMLElement & { data?: unknown }
    expect(el).toBeTruthy() // the REAL upgraded control, not a placeholder

    // No data yet — the bound-prop effect started on an unresolved path (no throw); zero rows painted.
    expect(el.querySelectorAll('[role="listitem"]')).toHaveLength(0)

    r.ingest(
      line({
        version: 'v1.0',
        updateDataModel: {
          surfaceId: 'bc',
          path: '/regions',
          value: [
            { label: 'EMEA', value: 42 },
            { label: 'APAC', value: 31 },
          ],
        },
      }),
    )
    await whenFlushed()
    expect(el.data).toEqual([
      { label: 'EMEA', value: 42 },
      { label: 'APAC', value: 31 },
    ]) // the data→control bound prop applied
    const rows1 = [...el.querySelectorAll('[role="listitem"]')]
    expect(rows1).toHaveLength(2) // one row per datum — the mark rendered from the bound path
    expect(rows1.map((row) => row.querySelector('[data-part="label"]')?.textContent)).toEqual(['EMEA', 'APAC'])

    // A second updateDataModel re-renders the rows (whole-array swap semantics, SPEC-R7).
    r.ingest(
      line({
        version: 'v1.0',
        updateDataModel: {
          surfaceId: 'bc',
          path: '/regions',
          value: [
            { label: 'EMEA', value: 42 },
            { label: 'APAC', value: 31 },
            { label: 'Americas', value: 12 },
          ],
        },
      }),
    )
    await whenFlushed()
    const rows2 = [...el.querySelectorAll('[role="listitem"]')]
    expect(rows2).toHaveLength(3) // a genuinely different row set, not a stale re-paint
    expect(rows2.map((row) => row.querySelector('[data-part="label"]')?.textContent)).toEqual(['EMEA', 'APAC', 'Americas'])

    r.dispose()
    mount.remove()
  })
})

// ── the ADR-0118 token-surface family (Swatch / Ramp / Ladder), catalog LLD-C13, token-surfaces.lld.md §6 ──
//
// SPEC-R18 AC1 (fleet-derived coverage, zero allowlist residue) is proven by the two describe blocks near
// the top of this file (the drained `EXCLUSION_ALLOWLIST` + the residue guard — `Swatch`/`Ramp`/`Ladder`
// no longer appear there). This block proves the rows themselves: a representative payload validates
// 0-`CATALOG` via `validateA2ui`, each row is display-only (no `value` mark, no children), the bindable/
// non-bindable split matches the shipped controls (`value`/`label`/`steps`/`tiers` bindable — the
// Sparkline.values/BarChart.data array-prop precedent; `scheme` a non-bindable structural enum — the
// Sparkline.variant/Avatar.size precedent), and an unknown property still fails CATALOG for all three.
describe('default catalog — Swatch/Ramp/Ladder via the shared validator (ADR-0118, token-surfaces.spec.md SPEC-R18)', () => {
  it('a representative Swatch/Ramp/Ladder payload validates 0 failures via validateA2ui', () => {
    const message = {
      version: 'v1.0',
      updateComponents: {
        surfaceId: 's1',
        components: [
          { id: 'root', component: 'Column', children: ['sw', 'rp', 'ld'] },
          { id: 'sw', component: 'Swatch', value: 'oklch(0.6 0.03 225)', label: 'primary-500', scheme: 'dark' },
          {
            id: 'rp', component: 'Ramp', label: 'Primary tonal range',
            steps: [
              { label: '100', value: '--md-sys-color-primary-100' },
              { label: '900', value: '--md-sys-color-primary-900' },
            ],
          },
          {
            id: 'ld', component: 'Ladder', label: 'Control heights',
            tiers: [
              { label: 'sm', value: '24px' },
              { label: 'lg', value: '36px' },
            ],
          },
        ],
      },
    }
    expect(validateA2ui(message, defaultCatalog)).toEqual({ valid: true, failures: [] })
  })

  it('Swatch/Ramp/Ladder declare display-only rows: no value mark, no children (ADR-0118 cl.6)', () => {
    expect(defaultCatalog.components.Swatch.value).toBeUndefined()
    expect(defaultCatalog.components.Swatch.children).toBeUndefined()
    expect(defaultCatalog.components.Ramp.value).toBeUndefined()
    expect(defaultCatalog.components.Ramp.children).toBeUndefined()
    expect(defaultCatalog.components.Ladder.value).toBeUndefined()
    expect(defaultCatalog.components.Ladder.children).toBeUndefined()
  })

  it('value/label/steps/tiers are bindable; scheme is a non-bindable structural enum (the Sparkline.variant precedent)', () => {
    expect(defaultCatalog.components.Swatch.properties.value?.bindable).toBe(true)
    expect(defaultCatalog.components.Swatch.properties.label?.bindable).toBe(true)
    expect(defaultCatalog.components.Swatch.properties.scheme?.bindable).toBeFalsy()
    expect(defaultCatalog.components.Ramp.properties.steps?.bindable).toBe(true)
    expect(defaultCatalog.components.Ramp.properties.label?.bindable).toBe(true)
    expect(defaultCatalog.components.Ramp.properties.scheme?.bindable).toBeFalsy()
    expect(defaultCatalog.components.Ladder.properties.tiers?.bindable).toBe(true)
    expect(defaultCatalog.components.Ladder.properties.label?.bindable).toBe(true)
  })

  it('accepts a {path} binding for value/steps/tiers (bindable props)', () => {
    const sw: A2uiComponent = { id: 'sw1', component: 'Swatch', value: { path: '/brand/primary' } }
    const rp: A2uiComponent = { id: 'rp1', component: 'Ramp', steps: { path: '/brand/steps' } }
    const ld: A2uiComponent = { id: 'ld1', component: 'Ladder', tiers: { path: '/dims/tiers' } }
    expect(validateCatalogConformance(sw, defaultCatalog)).toEqual([])
    expect(validateCatalogConformance(rp, defaultCatalog)).toEqual([])
    expect(validateCatalogConformance(ld, defaultCatalog)).toEqual([])
  })

  it('NEGATIVE: an unknown prop fails CATALOG for Swatch, Ramp, and Ladder', () => {
    const sw: A2uiComponent = { id: 'sw2', component: 'Swatch', value: '#fff', bogus: 1 }
    expect(validateCatalogConformance(sw, defaultCatalog)).toContainEqual({ code: 'CATALOG', path: 'sw2.bogus' })

    const rp: A2uiComponent = { id: 'rp2', component: 'Ramp', steps: [], bogus: 1 }
    expect(validateCatalogConformance(rp, defaultCatalog)).toContainEqual({ code: 'CATALOG', path: 'rp2.bogus' })

    const ld: A2uiComponent = { id: 'ld2', component: 'Ladder', tiers: [], bogus: 1 }
    expect(validateCatalogConformance(ld, defaultCatalog)).toContainEqual({ code: 'CATALOG', path: 'ld2.bogus' })
  })

  it('NEGATIVE: a wrong-primitive literal fails CATALOG for this family (the reviewer F1 plant)', () => {
    // Swatch.value is a string prop — a number literal must fail the type check, not coerce.
    const sw: A2uiComponent = { id: 'sw3', component: 'Swatch', value: 1 }
    expect(validateCatalogConformance(sw, defaultCatalog)).toContainEqual(expect.objectContaining({ code: 'CATALOG', path: 'sw3.value' }))

    // Ramp.steps is an array-of-{label,value} prop — a bare string must fail, never iterate.
    const rp: A2uiComponent = { id: 'rp3', component: 'Ramp', steps: 'nope' }
    expect(validateCatalogConformance(rp, defaultCatalog)).toContainEqual(expect.objectContaining({ code: 'CATALOG', path: 'rp3.steps' }))
  })

  it('a {path}-bound Ramp.steps renders the strip (real ui-ramp, no mocks) and re-renders on updateDataModel', async () => {
    const r = createRenderer({ newId: () => 'act-1', now: () => '2026-07-10T00:00:00.000Z' })
    const mount = document.createElement('div')
    document.body.appendChild(mount)
    r.mount(mount)

    const line = (message: unknown): string => JSON.stringify(message)
    r.ingest(line({ version: 'v1.0', createSurface: { surfaceId: 'ts', catalogId: 'agent-ui' } }))
    r.ingest(
      line({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'ts',
          components: [{ id: 'root', component: 'Ramp', steps: { path: '/palette' }, label: 'Primary' }],
        },
      }),
    )

    const el = mount.querySelector('ui-ramp') as HTMLElement & { steps?: unknown }
    expect(el).toBeTruthy() // the REAL upgraded control, not a placeholder
    expect(el.querySelectorAll('[data-part="cell"]')).toHaveLength(0) // no data yet — no throw

    r.ingest(
      line({
        version: 'v1.0',
        updateDataModel: {
          surfaceId: 'ts',
          path: '/palette',
          value: [
            { label: '100', value: '#eef' },
            { label: '900', value: '#003' },
          ],
        },
      }),
    )
    await whenFlushed()
    expect(el.steps).toEqual([
      { label: '100', value: '#eef' },
      { label: '900', value: '#003' },
    ])
    const cells = [...el.querySelectorAll('[data-part="cell"]')]
    expect(cells).toHaveLength(2) // the mark rendered from the bound path
    expect(cells.map((c) => c.querySelector('[data-part="step-label"]')?.textContent)).toEqual(['100', '900'])

    r.dispose()
    mount.remove()
  })
})

// ── the ADR-0124 swiper family (Swiper / SwiperItem), catalog rows per swiper-family.lld.md §2/§3 ──────
//
// jsdom has NO scroll layout (swiper-family.lld.md / ADR-0124 Consequences) — the real settle-triggered
// `select` emit is a browser-only proof (components/src/controls/swiper/swiper.browser.test.ts; jsdom's
// own swiper.test.ts header documents the same boundary). This block proves the CATALOG-LEVEL contract:
// a representative payload validates 0-CATALOG, the row shapes (bindable `active` + its `value` mark, the
// structural non-bindable axes, the diverging `slidesInView`/`slides-in-view` name), unknown/wrong-
// primitive props still fail CATALOG, and the generic LLD-C8 input controller writes a committed `active`
// back into `surface.data` off a REAL `ui-swiper`'s `select` event — the commit is synthesized at the
// DOM-event level (set `active`, dispatch `select`) since the scroll-settle that would normally fire it
// cannot run under jsdom; this proves the renderer/catalog wiring, not the component-internal settle
// mechanism (already proven, real-engine, in swiper.browser.test.ts).
describe('default catalog — Swiper/SwiperItem via the shared validator (ADR-0124 F5, swiper-family.spec.md)', () => {
  it('a representative Swiper+SwiperItem payload validates 0 failures via validateA2ui', () => {
    const message = {
      version: 'v1.0',
      updateComponents: {
        surfaceId: 's1',
        components: [
          {
            id: 'root', component: 'Swiper', loop: true, pagination: true, paddles: true,
            active: { path: '/slide' }, children: ['s1', 's2', 's3'],
          },
          { id: 's1', component: 'SwiperItem', children: ['t1'] },
          { id: 't1', component: 'Text', text: 'Slide one', variant: 'body' },
          { id: 's2', component: 'SwiperItem', children: ['t2'] },
          { id: 't2', component: 'Text', text: 'Slide two', variant: 'body' },
          { id: 's3', component: 'SwiperItem', children: ['t3'] },
          { id: 't3', component: 'Text', text: 'Slide three', variant: 'body' },
        ],
      },
    }
    expect(validateA2ui(message, defaultCatalog)).toEqual({ valid: true, failures: [] })
  })

  it('Swiper is two-way bound on active via the select event; SwiperItem is a ChildList sub-type with NO properties (the Tab.value precedent — ADR-0024 positional addressing)', () => {
    const swiper = defaultCatalog.components.Swiper
    expect(swiper.value).toEqual({ prop: 'active', event: 'select' })
    expect(swiper.properties.active?.bindable).toBe(true)
    expect(swiper.children).toBe('ChildList')
    expect(defaultCatalog.components.SwiperItem.children).toBe('ChildList')
    expect(defaultCatalog.components.SwiperItem.properties).toEqual({})
  })

  it('orientation/slidesInView/align/loop/duration/easing/pagination/paddles are structural, non-bindable axes (the Toolbar arrangement-axis precedent)', () => {
    for (const p of ['orientation', 'slidesInView', 'align', 'loop', 'duration', 'easing', 'pagination', 'paddles']) {
      expect(defaultCatalog.components.Swiper.properties[p]?.bindable, p).toBeFalsy()
    }
  })

  it("slidesInView's catalog key diverges from its mapsTo ('slides-in-view') — the fleet's first hyphenated accessor name, UAX-31-invalid as a bare identifier (catalog SPEC-R2)", () => {
    expect(defaultCatalog.components.Swiper.properties.slidesInView?.mapsTo).toBe('slides-in-view')
  })

  it('NEGATIVE: an unknown prop fails CATALOG for both Swiper and SwiperItem', () => {
    const swiper: A2uiComponent = { id: 'sw1', component: 'Swiper', bogus: 1 }
    expect(validateCatalogConformance(swiper, defaultCatalog)).toContainEqual({ code: 'CATALOG', path: 'sw1.bogus' })

    const item: A2uiComponent = { id: 'si1', component: 'SwiperItem', bogus: 1 }
    expect(validateCatalogConformance(item, defaultCatalog)).toContainEqual({ code: 'CATALOG', path: 'si1.bogus' })
  })

  it('NEGATIVE: a wrong-primitive literal fails CATALOG for a structural boolean (loop)', () => {
    const swiper: A2uiComponent = { id: 'sw2', component: 'Swiper', loop: 'yes' }
    expect(validateCatalogConformance(swiper, defaultCatalog)).toContainEqual(expect.objectContaining({ code: 'CATALOG', path: 'sw2.loop' }))
  })

  it('accepts a {path} binding OR a literal number for active (the Tabs.selected precedent — a numeric index crosses the wire as a JS number)', () => {
    const byPath: A2uiComponent = { id: 'sw3', component: 'Swiper', active: { path: '/slide' } }
    const byNumber: A2uiComponent = { id: 'sw4', component: 'Swiper', active: 1 }
    expect(validateCatalogConformance(byPath, defaultCatalog)).toEqual([])
    expect(validateCatalogConformance(byNumber, defaultCatalog)).toEqual([])
  })

  it("a REAL ui-swiper's user-driven select commit writes back into surface.data via the generic LLD-C8 controller", () => {
    const surface = createSurface({ id: 's1', catalogId: 'agent-ui', version: 'v1.0' })
    surface.data.value = { slide: '' }

    // The real family (defaultFactories self-defines it on import, catalog/default/factories.ts:1) — no
    // mocks, no stub factory.
    const swiper = defaultFactories.Swiper.create() as HTMLElement & { active: string }
    const s1 = document.createElement('ui-swiper-item')
    s1.setAttribute('value', 'intro')
    const s2 = document.createElement('ui-swiper-item')
    s2.setAttribute('value', 'pricing')
    swiper.append(s1, s2)
    document.body.append(swiper)

    const node: A2uiComponent = { id: 'sw', component: 'Swiper', active: { path: '/slide' } }
    installInputBinding(swiper, defaultFactories.Swiper, node, surface)

    // ui-swiper's OWN #commit (swiper.ts) sets `active` then emits `select` — but ONLY off a real
    // scroll-snap settle (browser-only, ADR-0124 Consequences: jsdom has no scroll layout). Reproduced at
    // the DOM-event level here to prove the catalog/renderer wiring around that commit, not the settle
    // mechanism itself (real-engine-proven in swiper.browser.test.ts).
    swiper.active = 'pricing'
    swiper.dispatchEvent(new Event('select'))

    expect((surface.data.peek() as { slide: unknown }).slide).toBe('pricing') // LLD-C8 wrote it back (SPEC-R7)

    swiper.remove()
    disposeSurface(surface)
  })
})
