import { describe, it, expect } from 'vitest'
import { validateCatalogConformance, SAFE_HREF_SCHEMES, MEDIA_SRC_SCHEMES } from './conformance.ts'
import { demoCatalog } from '../fixtures.ts'
import { loadCatalog } from './catalog.ts'
import { defaultCatalog } from './default/index.ts'
import { a2uiBasicCatalog } from './a2ui-basic/index.ts'
import { validateA2ui } from '../renderer/validate.ts'
import type { A2uiComponent } from '../protocol.ts'
import { SAFE_HREF_SCHEMES as COMPONENTS_SAFE_HREF_SCHEMES, MEDIA_SRC_SCHEMES as COMPONENTS_MEDIA_SRC_SCHEMES } from '@agent-ui/components/controls/text'

const comp = (c: Record<string, unknown>): A2uiComponent => c as A2uiComponent

describe('validateCatalogConformance (catalog LLD-C6, SPEC-R7/R9/N3)', () => {
  it('passes a conformant component', () => {
    const f = validateCatalogConformance(comp({ id: 'b1', component: 'Button', label: 'Save', disabled: false }), demoCatalog)
    expect(f).toEqual([])
  })

  it('flags an unknown component type with CATALOG at the component id', () => {
    const f = validateCatalogConformance(comp({ id: 'x', component: 'Doohickey' }), demoCatalog)
    expect(f).toEqual([{ code: 'CATALOG', path: 'x' }])
  })

  it('flags an unknown property with CATALOG at id.prop', () => {
    const f = validateCatalogConformance(comp({ id: 'b1', component: 'Button', nope: 1 }), demoCatalog)
    expect(f).toEqual([{ code: 'CATALOG', path: 'b1.nope' }])
  })

  it('flags a type mismatch (boolean prop given a string)', () => {
    const f = validateCatalogConformance(comp({ id: 'b1', component: 'Button', disabled: 'yes' }), demoCatalog)
    expect(f).toEqual([{ code: 'CATALOG', path: 'b1.disabled' }])
  })

  it('enforces integer vs number', () => {
    const ok = validateCatalogConformance(comp({ id: 't', component: 'TextField', maxLength: 10 }), demoCatalog)
    expect(ok).toEqual([])
    const bad = validateCatalogConformance(comp({ id: 't', component: 'TextField', maxLength: 10.5 }), demoCatalog)
    expect(bad).toEqual([{ code: 'CATALOG', path: 't.maxLength' }])
  })

  it('accepts a {path} binding on a bindable property', () => {
    const f = validateCatalogConformance(comp({ id: 't', component: 'Text', text: { path: '/user/name' } }), demoCatalog)
    expect(f).toEqual([])
  })

  it('rejects a {path} binding on a non-bindable property', () => {
    // `variant` is not bindable → a binding object is not a string literal → CATALOG
    const f = validateCatalogConformance(comp({ id: 't', component: 'Text', variant: { path: '/v' } }), demoCatalog)
    expect(f).toEqual([{ code: 'CATALOG', path: 't.variant' }])
  })

  it('ignores reserved adjacency keys (id/component/child/children)', () => {
    const f = validateCatalogConformance(
      comp({ id: 'col', component: 'Column', children: ['a', 'b'], child: 'a' }),
      demoCatalog,
    )
    expect(f).toEqual([])
  })

  it('reports every failure (totality, not short-circuit)', () => {
    const f = validateCatalogConformance(comp({ id: 'b', component: 'Button', nope: 1, disabled: 'x' }), demoCatalog)
    expect(f).toEqual([
      { code: 'CATALOG', path: 'b.nope' },
      { code: 'CATALOG', path: 'b.disabled' },
    ])
  })

  it('accepts a DynamicString template on a bindable string prop — no false CATALOG (ADR-0027 proof point 8)', () => {
    // A `${…}` template is a plain string literal at the wire level (typeof === 'string'), so
    // conformance.ts `matchesType` accepts it via the ordinary `'string'` leg — no deferred-binding
    // branch involved, zero CATALOG failures (ADR-0027 §2.7 "conformance is a no-op — confirmed").
    // NON-VACUOUS: a string on a non-bindable prop IS rejected (the test below this one proves it).
    const f = validateCatalogConformance(
      comp({ id: 't', component: 'Text', text: 'Hello ${/user/firstName}! You are ${/user/age} years old.' }),
      demoCatalog,
    )
    expect(f).toEqual([])
  })

  it('negative control: a {path} binding on a non-bindable string prop still raises CATALOG', () => {
    // `Text.variant` is a non-bindable string — a binding object is not a string literal → CATALOG.
    // Confirms the template test above is non-vacuous (the string-type leg would pass a plain string,
    // but only bindable props accept binding objects).
    const f = validateCatalogConformance(comp({ id: 't', component: 'Text', variant: { path: '/v' } }), demoCatalog)
    expect(f).toEqual([{ code: 'CATALOG', path: 't.variant' }])
  })

  it('rejects a comma-joined STRING on an array-typed prop — the untested `case \'array\'` branch (conformance.ts matchesPrimitive, M1-d review follow-up)', () => {
    // A model can plausibly emit "3,5,4" (a stringified series) where the row declares `values: number[]`
    // (the real Sparkline row, ADR-0107). `Array.isArray('3,5,4')` is false, so this must fail CATALOG
    // rather than being silently coerced or accepted — proving the array leg of `matchesPrimitive`
    // (conformance.ts:84-85) actually REJECTS, not just that its accept path (already covered by the
    // Sparkline/BarChart suite in default/index.test.ts) works.
    const f = validateCatalogConformance(comp({ id: 'sp', component: 'Sparkline', values: '3,5,4' }), defaultCatalog)
    expect(f).toEqual([{ code: 'CATALOG', path: 'sp.values' }])
  })

  it('LineChart (ADR-0205) — same array-typed `values` shape as Sparkline: a comma-joined STRING still fails CATALOG', () => {
    // The chart family's newest member (`LineChart`, ADR-0205) shares Sparkline's `values: number[]` row —
    // the SAME parity proof, on the new type, so the array leg keeps biting after the catalog wave lands.
    const f = validateCatalogConformance(comp({ id: 'lc', component: 'LineChart', values: '3,5,4' }), defaultCatalog)
    expect(f).toEqual([{ code: 'CATALOG', path: 'lc.values' }])
  })

  it('ColumnChart (ADR-0229, GH #1568) — same array-typed `data`/`series` shape: a comma-joined STRING on either still fails CATALOG', () => {
    // The chart family's fifth member (`ColumnChart`, svg-charts wave 4) carries TWO array-typed props
    // (`data`/`series`, ADR-0229 cl.2's "both bindable" wire contract) — the SAME parity proof on both.
    const fData = validateCatalogConformance(comp({ id: 'cc', component: 'ColumnChart', data: 'Mar,Apr' }), defaultCatalog)
    expect(fData).toEqual([{ code: 'CATALOG', path: 'cc.data' }])
    const fSeries = validateCatalogConformance(comp({ id: 'cc2', component: 'ColumnChart', series: 'Product,Services' }), defaultCatalog)
    expect(fSeries).toEqual([{ code: 'CATALOG', path: 'cc2.series' }])
  })
})

describe('validateCatalogConformance — enum membership (ADR-0098)', () => {
  // A stub catalog with a closed string enum (`size`), a BINDABLE closed string enum (`mode` —
  // mirrors the Calendar.mode shape ADR-0098 names), an enum-less string (`note`), and a boolean
  // (`flag`) — proving the new clause is scoped to schemas that actually declare `enum`.
  const enumCatalog = loadCatalog({
    catalogId: 'enum-demo',
    protocolVersion: 'v1.0',
    components: {
      Widget: {
        properties: {
          size: { type: { type: 'string', enum: ['sm', 'md', 'lg'] }, mapsTo: 'size' },
          mode: { type: { type: 'string', enum: ['single', 'range'] }, bindable: true, mapsTo: 'mode' },
          note: { type: { type: 'string' }, mapsTo: 'note' },
          flag: { type: { type: 'boolean' }, mapsTo: 'flag' },
        },
      },
    },
    functions: {},
  })

  it('rejects a non-member literal with CATALOG at <id>.<prop>', () => {
    const f = validateCatalogConformance(comp({ id: 'w', component: 'Widget', size: 'xl' }), enumCatalog)
    expect(f).toEqual([{ code: 'CATALOG', path: 'w.size' }])
  })

  it('accepts a declared member — clean', () => {
    const f = validateCatalogConformance(comp({ id: 'w', component: 'Widget', size: 'md' }), enumCatalog)
    expect(f).toEqual([])
  })

  it('is case-sensitive — no coercion (JSON-Schema §6.1.2): "MD" ∉ {sm,md,lg}', () => {
    const f = validateCatalogConformance(comp({ id: 'w', component: 'Widget', size: 'MD' }), enumCatalog)
    expect(f).toEqual([{ code: 'CATALOG', path: 'w.size' }])
  })

  it('does NOT statically judge a {path} binding on a bindable enum prop — stays ADR-0076\'s render-gate charter', () => {
    const f = validateCatalogConformance(comp({ id: 'w', component: 'Widget', mode: { path: '/mode' } }), enumCatalog)
    expect(f).toEqual([])
  })

  it('leaves an enum-less string prop unconstrained (negative control — the clause does not over-reject)', () => {
    const f = validateCatalogConformance(comp({ id: 'w', component: 'Widget', note: 'anything at all' }), enumCatalog)
    expect(f).toEqual([])
  })

  it('leaves a boolean (enum-less, non-string) schema unaffected', () => {
    const f = validateCatalogConformance(comp({ id: 'w', component: 'Widget', flag: true }), enumCatalog)
    expect(f).toEqual([])
  })
})

// ── rejectFunctionCall — the GH #429 / ADR-0169 E7 narrow gate ──────────────────────────────────────────
describe('validateCatalogConformance — PropDef.rejectFunctionCall (ADR-0169 E7 / GH #429)', () => {
  // A stub catalog with a `functionCall`-rejecting action prop AND a plain, un-opted-in object prop —
  // proving the clause is scoped to the declaring PropDef, not object-typed props in general.
  const actionCatalog = loadCatalog({
    catalogId: 'action-demo',
    protocolVersion: 'v1.0',
    components: {
      Widget: {
        properties: {
          action: { type: { type: 'object' }, mapsTo: 'action', rejectFunctionCall: true },
          payload: { type: { type: 'object' }, mapsTo: 'payload' }, // no opt-in
        },
      },
    },
    functions: {},
  })

  it('rejects an object carrying an own functionCall key on an opted-in prop', () => {
    const f = validateCatalogConformance(comp({ id: 'w', component: 'Widget', action: { functionCall: { name: 'x' } } }), actionCatalog)
    expect(f).toEqual([{ code: 'CATALOG', path: 'w.action' }])
  })

  it('accepts an object WITHOUT functionCall on the same opted-in prop (non-vacuous — not a blanket object reject)', () => {
    const f = validateCatalogConformance(comp({ id: 'w', component: 'Widget', action: { event: { name: 'x' } } }), actionCatalog)
    expect(f).toEqual([])
  })

  it('does NOT reject the same {functionCall} shape on a prop that never opted in (scoped to the declaring PropDef, not object-typed props in general)', () => {
    const f = validateCatalogConformance(comp({ id: 'w', component: 'Widget', payload: { functionCall: { name: 'x' } } }), actionCatalog)
    expect(f).toEqual([])
  })
})

// ── PropDef.requires — the ADR-0226 cl.3 cross-prop presence check ─────────────────────────────────────
describe('validateCatalogConformance — PropDef.requires (ADR-0226 cl.3)', () => {
  // A stub catalog mirroring the real Button.icon/Button.iconOnly shape (icon requires label; iconOnly
  // requires icon) without depending on the default catalog's exact wording — the enumCatalog/actionCatalog
  // precedent above, applied to the new opt-in mechanism.
  const requiresCatalog = loadCatalog({
    catalogId: 'requires-demo',
    protocolVersion: 'v1.0',
    components: {
      Widget: {
        properties: {
          icon: { type: { type: 'string' }, bindable: true, mapsTo: 'icon', requires: ['label'] },
          iconOnly: { type: { type: 'boolean' }, mapsTo: 'iconOnly', requires: ['icon'] },
          label: { type: { type: 'string' }, bindable: true, mapsTo: 'label' },
        },
      },
    },
    functions: {},
  })

  it("a declaring key present without its required sibling fails CATALOG at the missing sibling's own path", () => {
    const f = validateCatalogConformance(comp({ id: 'w', component: 'Widget', icon: 'plus' }), requiresCatalog)
    expect(f).toEqual([{ code: 'CATALOG', path: 'w.label' }])
  })

  it('both the declaring key and its required sibling present conforms (no failure)', () => {
    const f = validateCatalogConformance(comp({ id: 'w', component: 'Widget', icon: 'plus', label: 'Add' }), requiresCatalog)
    expect(f).toEqual([])
  })

  it('a {path} binding on the required sibling satisfies presence (ADR-0026 — presence, never the eventual value)', () => {
    const f = validateCatalogConformance(
      comp({ id: 'w', component: 'Widget', icon: 'plus', label: { path: '/labelText' } }),
      requiresCatalog,
    )
    expect(f).toEqual([])
  })

  it('a {path}-bound declaring key still enforces its requires (presence of the KEY, not a literal-only check)', () => {
    const f = validateCatalogConformance(comp({ id: 'w', component: 'Widget', icon: { path: '/iconName' } }), requiresCatalog)
    expect(f).toEqual([{ code: 'CATALOG', path: 'w.label' }])
  })

  it("iconOnly without icon fails CATALOG at icon's own path (the reverse pair)", () => {
    const f = validateCatalogConformance(comp({ id: 'w', component: 'Widget', iconOnly: true, label: 'Dismiss' }), requiresCatalog)
    expect(f).toEqual([{ code: 'CATALOG', path: 'w.icon' }])
  })

  it('a requires declaration on a key the node never carries never fires (scoped to keys actually present)', () => {
    const f = validateCatalogConformance(comp({ id: 'w', component: 'Widget', label: 'Just a label' }), requiresCatalog)
    expect(f).toEqual([])
  })

  it('a property that does not declare requires is unaffected (byte-identical negative control — every non-opted-in prop)', () => {
    const f = validateCatalogConformance(comp({ id: 'w', component: 'Widget', label: 'Solo label' }), requiresCatalog)
    expect(f).toEqual([])
  })
})

// ── the children-model check — the ADR-0226 cl.4 leniency close ────────────────────────────────────────
describe('validateCatalogConformance — the children-model check (ADR-0226 cl.4, closes the RESERVED leniency)', () => {
  it('a node carrying `children` whose def declares NO children model fails CATALOG (the Icon-under-Button exploit this closes, high-frequency-patterns.ts\'s own former jsdoc)', () => {
    const f = validateCatalogConformance(comp({ id: 'b', component: 'Button', label: 'Save', children: ['icon1'] }), demoCatalog)
    expect(f).toContainEqual({ code: 'CATALOG', path: 'b.children' })
  })

  it('a node carrying `child` whose def declares NO children model ALSO fails CATALOG (both structural keys covered)', () => {
    const f = validateCatalogConformance(comp({ id: 'b', component: 'Button', label: 'Save', child: 'icon1' }), demoCatalog)
    expect(f).toContainEqual({ code: 'CATALOG', path: 'b.child' })
  })

  it('negative control: a Column carrying `children` still passes — its def DECLARES a children model', () => {
    const f = validateCatalogConformance(comp({ id: 'col', component: 'Column', children: ['a', 'b'] }), demoCatalog)
    expect(f).toEqual([])
  })

  it('negative control: a Card carrying `child` still passes — the singular-key declaring-def case', () => {
    const f = validateCatalogConformance(comp({ id: 'c', component: 'Card', child: 'a' }), demoCatalog)
    expect(f).toEqual([])
  })

  it("presence-vs-none only — a Card (children:'child') carrying `children` (the OTHER structural key) is NOT judged a kind mismatch (cl.4's deliberately minimal floor)", () => {
    const f = validateCatalogConformance(comp({ id: 'c', component: 'Card', children: ['a', 'b'] }), demoCatalog)
    expect(f).toEqual([])
  })
})

// ── SAFE_HREF_SCHEMES sync — the two-literal duplication stays honest ────────────────────────────────────
//
// conformance.ts keeps a LOCAL copy of this constant rather than importing `@agent-ui/components`'s real
// one, because this module is reachable from vite.config.ts's own Node-native-loaded plugin graph
// (dev-proxy-plugin.ts → catalog.ts's loadCatalog → here), where a bare `@agent-ui/components/*` import
// resolves to raw TypeScript source Node cannot load without a type-stripping flag this repo doesn't set
// (confirmed: it broke `npm run build`/`npm run dev` with ERR_UNKNOWN_FILE_EXTENSION). This test is the
// only thing keeping the two literals honest — vitest's transform pipeline CAN resolve the real
// cross-package import, so drift is caught here even though the two runtime arrays never share a reference.
describe('conformance.ts\'s SAFE_HREF_SCHEMES stays in sync with the canonical text/href.ts source', () => {
  it('the local copy is value-identical to @agent-ui/components/controls/text\'s real export', () => {
    expect([...SAFE_HREF_SCHEMES]).toEqual([...COMPONENTS_SAFE_HREF_SCHEMES])
  })
})

// ── PropDef.format: 'media-src', the static twin of the render-time media gate (T-0563) ─────────────────
//
// The default catalog's media props declare `format: 'media-src'`, so an ABSOLUTE literal outside the media
// scheme allowlist fails CATALOG here, ahead of `safeMediaSrc` (controls/text/media-src.ts) at render. A
// relative literal defers to that gate, and the host origin allowlist stays a render-time concern.
describe('validateCatalogConformance: PropDef.format media-src (T-0563)', () => {
  const MEDIA_PROPS: readonly (readonly [string, string, Record<string, unknown>])[] = [
    ['Image', 'src', { alt: 'A photo' }],
    ['Avatar', 'src', {}],
    ['Video', 'src', {}],
    ['Video', 'poster', {}],
    ['AudioPlayer', 'src', {}],
    ['ProductCard', 'image', {}],
  ]
  const propFailures = (component: string, prop: string, extra: Record<string, unknown>, value: unknown) =>
    validateCatalogConformance(comp({ id: 'm', component, ...extra, [prop]: value }), defaultCatalog)
      .filter((f) => f.path === `m.${prop}`)

  for (const [component, prop, extra] of MEDIA_PROPS) {
    it(`${component}.${prop} declares format media-src`, () => {
      expect(defaultCatalog.components[component]?.properties[prop]?.format).toBe('media-src')
    })

    it(`${component}.${prop}: an absolute literal outside the media scheme allowlist fails CATALOG`, () => {
      expect(propFailures(component, prop, extra, 'ftp://example.com/a.png')).toEqual([{ code: 'CATALOG', path: `m.${prop}` }])
      expect(propFailures(component, prop, extra, 'mailto:someone@example.com')).toEqual([{ code: 'CATALOG', path: `m.${prop}` }])
    })

    it(`${component}.${prop}: allowed schemes, relative literals and bindings pass (non-vacuous)`, () => {
      for (const ok of ['https://example.com/a.png', 'http://example.com/a.png', 'data:image/png;base64,AAAA', 'blob:https://example.com/0f1e', '/media/a.png', 'a.png']) {
        expect(propFailures(component, prop, extra, ok), ok).toEqual([])
      }
      expect(propFailures(component, prop, extra, { path: '/media/src' })).toEqual([])
    })
  }

  it('is scoped to the declaring PropDef: safe-href still admits mailto: and rejects data:', () => {
    const fmtCatalog = loadCatalog({
      catalogId: 'format-demo',
      protocolVersion: 'v1.0',
      components: {
        Widget: {
          properties: {
            media: { type: { type: 'string' }, mapsTo: 'media', format: 'media-src' },
            link: { type: { type: 'string' }, mapsTo: 'link', format: 'safe-href' },
          },
        },
      },
      functions: {},
    })
    const run = (props: Record<string, unknown>) => validateCatalogConformance(comp({ id: 'w', component: 'Widget', ...props }), fmtCatalog)
    expect(run({ link: 'mailto:someone@example.com', media: 'data:image/png;base64,AAAA' })).toEqual([])
    expect(run({ link: 'data:image/png;base64,AAAA', media: 'mailto:someone@example.com' })).toEqual([
      { code: 'CATALOG', path: 'w.link' },
      { code: 'CATALOG', path: 'w.media' },
    ])
  })
})

describe('validateCatalogConformance: a2ui-basic Image.url declares format media-src (T-0565)', () => {
  const urlFailures = (value: unknown) =>
    validateCatalogConformance(comp({ id: 'b', component: 'Image', description: 'A photo', url: value }), a2uiBasicCatalog)
      .filter((f) => f.path === 'b.url')

  it('Image.url declares format media-src', () => {
    expect(a2uiBasicCatalog.components['Image']?.properties['url']?.format).toBe('media-src')
  })

  it('data: image literals pass and schemes outside the media allowlist fail CATALOG', () => {
    expect(urlFailures('data:image/png;base64,AAAA')).toEqual([])
    expect(urlFailures('https://example.com/a.png')).toEqual([])
    expect(urlFailures('/media/a.png')).toEqual([])
    expect(urlFailures({ path: '/media/url' })).toEqual([])
    expect(urlFailures('ftp://example.com/a.png')).toEqual([{ code: 'CATALOG', path: 'b.url' }])
    expect(urlFailures('mailto:someone@example.com')).toEqual([{ code: 'CATALOG', path: 'b.url' }])
  })
})

describe('conformance.ts\'s MEDIA_SRC_SCHEMES stays in sync with the canonical text/media-src.ts source', () => {
  it('the local copy is value-identical to @agent-ui/components/controls/text\'s real export', () => {
    expect(COMPONENTS_MEDIA_SRC_SCHEMES).toBeDefined()
    expect([...MEDIA_SRC_SCHEMES]).toEqual([...COMPONENTS_MEDIA_SRC_SCHEMES])
  })
})

// ── ProductCard.actionLabel binds like title and price (T-0587, round 20 cluster S) ─────────────────────
//
// A templated Grid of ProductCards carries a per-item action word ("Book", "Request") in the data model, so
// `actionLabel` takes a `{path}` binding the way its bindable siblings do. The payload below is the
// regress-concierge-facilities-then-tour-haiku-3 round 3 reply (r20 trace :98), trimmed to two items.
describe('ProductCard.actionLabel binds in a templated Grid (T-0587)', () => {
  const services = [
    { id: 'swedish-massage', title: 'Swedish massage', subtitle: 'Full-body relaxation massage', price: '\u20ac120', priceNote: '60 min', actionLabel: 'Book' },
    { id: 'late-check-out', title: 'Late check-out', subtitle: 'Until 14:00, subject to availability', actionLabel: 'Request' },
  ]
  const card = {
    id: 'service-card', component: 'ProductCard',
    title: { path: 'title' }, subtitle: { path: 'subtitle' }, price: { path: 'price' }, priceNote: { path: 'priceNote' },
    actionLabel: { path: 'actionLabel' },
    action: { action: 'select_service', context: { serviceId: { path: 'id' } } },
  }
  const payload = [
    { version: 'v1.0', createSurface: { surfaceId: 'stay-services', catalogId: 'agent-ui', sendDataModel: true } },
    { version: 'v1.0', updateDataModel: { surfaceId: 'stay-services', value: { services } } },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: 'stay-services',
        components: [{ id: 'root', component: 'Grid', gap: 'md', min: '16rem', children: { path: '/services', componentId: 'service-card' } }, card],
      },
    },
  ]

  it('the default catalog marks actionLabel bindable, like title and price', () => {
    const props = defaultCatalog.components.ProductCard.properties
    expect(props.title?.bindable).toBe(true)
    expect(props.price?.bindable).toBe(true)
    expect(props.actionLabel?.bindable).toBe(true)
  })

  it('a {path}-bound actionLabel on the templated card conforms', () => {
    expect(validateCatalogConformance(comp(card), defaultCatalog)).toEqual([])
  })

  it('the whole templated-Grid payload validates', () => {
    expect(validateA2ui(payload, defaultCatalog)).toEqual({ valid: true, failures: [] })
  })

  it('negative control: a literal actionLabel of the wrong type still fails CATALOG', () => {
    expect(validateCatalogConformance(comp({ ...card, actionLabel: 7 }), defaultCatalog)).toEqual([{ code: 'CATALOG', path: 'service-card.actionLabel' }])
  })

  it('negative control: ServiceCard.actionLabel and AmountPicker.actionLabel stay set-once and still reject a {path} binding', () => {
    expect(
      validateCatalogConformance(comp({ id: 'amt', component: 'AmountPicker', actionLabel: { path: 'label' } }), defaultCatalog),
    ).toEqual([{ code: 'CATALOG', path: 'amt.actionLabel' }])
    expect(
      validateCatalogConformance(comp({ id: 'svc', component: 'ServiceCard', name: 'Claims', path: '/claims', actionLabel: { path: 'label' } }), defaultCatalog),
    ).toEqual([{ code: 'CATALOG', path: 'svc.actionLabel' }])
  })
})
