import { describe, it, expect } from 'vitest'
import {
  buttonFactory,
  textFactory,
  textFieldFactory,
  fieldFactory,
  formProviderFactory,
  checkboxFactory,
  switchFactory,
  selectFactory,
  optionFactory,
  rowFactory,
  columnFactory,
  cardFactory,
  cardContentFactory,
  tabsFactory,
  modalFactory,
  iconFactory,
  menuFactory,
  menuItemFactory,
  popoverFactory,
  formPopoverFactory,
  tooltipFactory,
  radioGroupFactory,
  radioFactory,
  segmentedControlFactory,
  segmentFactory,
  sliderFactory,
  sliderMultiFactory,
  calendarFactory,
  comboBoxFactory,
  listFactory,
  gridFactory,
  sparklineFactory,
  barChartFactory,
  lineChartFactory,
  tableFactory,
  paginationFactory,
  multiSelectFactory,
  badgeFactory,
  toggleFactory,
  defaultFactories,
} from './factories.ts'
import { defaultCatalog } from './index.ts'
import { Registry, RegistryError, RegistryErrorCode } from '../registry.ts'
import { validateCatalogConformance } from '../conformance.ts'
import type { A2uiComponent } from '../../protocol.ts'

// factories.ts imports the @agent-ui/components controls barrel, so the SHIPPED tags self-define on load
// (ui-button G5, ui-text-field G6; the G9 container tags self-define once their folders + the s12 barrel
// land). This slice proves the factory CONTRACT — table parity, the ui-* tag, the accessor mapping, the
// two-way `value` bind. The live render-integration (a payload → an upgraded ui-* control) is the standing
// gate's job AFTER s12, per the decomp; here `create()` may yield an un-upgraded element for a G9 tag and
// the accessor mapping is asserted as the own-property set the upgrade dance will adopt.

describe('default catalog factories — table parity (catalog LLD-C5, SPEC-R3 AC1 / R7 AC1)', () => {
  it('declares exactly one factory per catalog component type — no gap, no extra', () => {
    expect(Object.keys(defaultFactories).sort()).toEqual(Object.keys(defaultCatalog.components).sort())
  })

  it('every declared component resolves to a ui-* factory (Option/MenuItem are the sanctioned-primitive exceptions, SPEC-R3 AC1)', () => {
    for (const type of Object.keys(defaultCatalog.components)) {
      const factory = defaultFactories[type]
      expect(factory, `factory for ${type}`).toBeDefined()
      if (type === 'Option') {
        expect(factory.tag).toBe('div[role=option]') // the pre-ui-text Text precedent — not a custom element
        continue
      }
      if (type === 'MenuItem') {
        expect(factory.tag).toBe('div[role=menuitem]') // ADR-0087 Wave A — the same sanctioned-primitive shape
        continue
      }
      expect(factory.tag).toMatch(/^ui-/)
    }
  })

  it('registers cleanly against the real Registry (0 CATALOG_FACTORY_MISSING)', () => {
    const reg = new Registry()
    expect(() => reg.register(defaultCatalog, defaultFactories)).not.toThrow()
    expect(reg.supportedCatalogIds()).toContain('agent-ui')
  })

  it('NEGATIVE: a catalog type with no factory throws CATALOG_FACTORY_MISSING (SPEC-R6/R7)', () => {
    const reg = new Registry()
    const { Card: _omitted, ...factoriesMissingCard } = defaultFactories // drop Card's factory
    let thrown: unknown
    try {
      reg.register(defaultCatalog, factoriesMissingCard)
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(RegistryError)
    expect((thrown as RegistryError).code).toBe(RegistryErrorCode.FACTORY_MISSING)
  })
})

describe('default catalog factories — Text (ADR-0078, catalog LLD-C5)', () => {
  it('Text → ui-text maps text (textContent); not an input (no value bind)', () => {
    expect(textFactory.tag).toBe('ui-text')
    expect(textFactory.value).toBeUndefined() // Text is a display leaf — no two-way binding
    const el = textFactory.create()
    textFactory.applyProp(el, 'text', 'Hello world')
    expect(el.textContent).toBe('Hello world')
  })

  it('null/undefined text coerces to empty string (the value == null guard)', () => {
    const el = textFactory.create()
    textFactory.applyProp(el, 'text', null)
    expect(el.textContent).toBe('')
    textFactory.applyProp(el, 'text', undefined)
    expect(el.textContent).toBe('')
  })

  // The ADR-0078 cl.5 fan-out table (amended, TKT-0082/ADR-0142; widened by ONE member under the GH #808
  // S1 amendment): the wire's `variant` enum translates to the control's three-axis triple
  // (as/variant/size) at apply-time — one row per wire value. Rows are compact/card-scale (headline/title
  // only, never display) — the catalog's own mapping choice for a generative-UI surface, shifted one M3
  // tier down from the original table, not `ui-text`'s document type scale. Strictly decreasing
  // 28/24/22/16/14px across h1-h5. `label` (GH #808 S1, catalog SPEC-R4) is a straight pass-through — the
  // wire register name IS the `ui-text` M3 role name, no translation, unlike every heading row above.
  // The four ADR-0207 editorial registers (ratified 2026-08-19, GH #1321): `kicker`/`overline` are
  // straight pass-throughs of `label`'s class; `quote`/`lead` are the first NON-heading rows to stamp a
  // semantic element (`blockquote`/`p`) — the heading rows' own precedent, role AND semantics one dial.
  it.each([
    ['h1', { as: 'h1', variant: 'headline', size: 'md' }],
    ['h2', { as: 'h2', variant: 'headline', size: 'sm' }],
    ['h3', { as: 'h3', variant: 'title', size: 'lg' }],
    ['h4', { as: 'h4', variant: 'title', size: 'md' }],
    ['h5', { as: 'h5', variant: 'title', size: 'sm' }],
    ['body', { as: 'none', variant: 'body', size: 'md' }],
    ['caption', { as: 'none', variant: 'body', size: 'sm' }],
    ['label', { as: 'none', variant: 'label', size: 'md' }],
    ['kicker', { as: 'none', variant: 'kicker', size: 'md' }],
    ['overline', { as: 'none', variant: 'overline', size: 'md' }],
    ['quote', { as: 'blockquote', variant: 'quote', size: 'md' }],
    ['lead', { as: 'p', variant: 'lead', size: 'md' }],
  ] as const)('wire variant %s fans out to the ui-text triple', (wire, triple) => {
    const el = textFactory.create()
    textFactory.applyProp(el, 'variant', wire)
    const target = el as unknown as Record<string, unknown>
    expect(target.as).toBe(triple.as)
    expect(target.variant).toBe(triple.variant)
    expect(target.size).toBe(triple.size)
  })

  it('an unrecognized wire variant value falls back to the body triple', () => {
    const el = textFactory.create()
    textFactory.applyProp(el, 'variant', 'nonsense')
    const target = el as unknown as Record<string, unknown>
    expect(target.as).toBe('none')
    expect(target.variant).toBe('body')
    expect(target.size).toBe('md')
  })

  it('Text → ui-text conformance payload yields 0 CATALOG errors', () => {
    const textNode: A2uiComponent = { id: 'txt1', component: 'Text', text: 'Hello', variant: 'h1' }
    expect(validateCatalogConformance(textNode, defaultCatalog)).toEqual([])
  })

  it('Text with a {path} binding for text is accepted (bindable: true)', () => {
    const bound: A2uiComponent = { id: 'txt2', component: 'Text', text: { path: '/name' }, variant: 'body' }
    expect(validateCatalogConformance(bound, defaultCatalog)).toEqual([])
  })

  // SPEC-R4 AC1 (GH #808 S1): the widened enum member validates like every other literal — no new code,
  // the existing ADR-0098 enum gate already covers an added member for free.
  it('Text.variant "label" (GH #808 S1) validates — the widened enum member', () => {
    const labelRow: A2uiComponent = { id: 'txt5', component: 'Text', text: 'Status', variant: 'label' }
    expect(validateCatalogConformance(labelRow, defaultCatalog)).toEqual([])
  })

  // ADR-0207's own leg of the same claim: the four editorial registers validate with ZERO validator
  // code — the ADR-0098 generic enum gate reads the widened `catalog.json` enum directly.
  it.each(['kicker', 'overline', 'quote', 'lead'] as const)(
    'Text.variant "%s" (ADR-0207) validates — the widened editorial register',
    (register) => {
      const node: A2uiComponent = { id: 'txt7', component: 'Text', text: 'Editorial', variant: register }
      expect(validateCatalogConformance(node, defaultCatalog)).toEqual([])
    },
  )

  // SPEC-R4 AC1's negative control (held through ADR-0207): an out-of-enum value still fails CATALOG —
  // the widenings appended exact members, not an open-ended string. `display`/`h6` are the ADR-0207
  // D1 exclusions (component-only registers/semantics), `subtitle` was never a member at all.
  it.each(['subtitle', 'display', 'h6'] as const)('NEGATIVE: out-of-enum Text.variant "%s" still fails CATALOG', (bad) => {
    const bogus: A2uiComponent = { id: 'txt6', component: 'Text', text: 'x', variant: bad }
    expect(validateCatalogConformance(bogus, defaultCatalog)).toEqual([{ code: 'CATALOG', path: 'txt6.variant' }])
  })

  // ADR-0106 — `truncate` is not `text`/`variant`, so it falls to the `default:` arm's `setAttr`, the SAME
  // generic path every other catalog boolean (Modal.persistent, TextField.readonly, …) already rides —
  // confirms the ADR-0106 clause 5 claim ("already setAttrs unknown props — verified boolean handling").
  it('Text.truncate (boolean, non-bindable) passes through the default setAttr arm onto [truncate]', () => {
    const el = textFactory.create()
    textFactory.applyProp(el, 'truncate', true)
    expect(el.hasAttribute('truncate')).toBe(true)
    textFactory.applyProp(el, 'truncate', false)
    expect(el.hasAttribute('truncate')).toBe(false)
  })

  it('Text.truncate conformance payload yields 0 CATALOG errors', () => {
    const truncated: A2uiComponent = { id: 'txt3', component: 'Text', text: 'A long clipped title', truncate: true }
    expect(validateCatalogConformance(truncated, defaultCatalog)).toEqual([])
  })

  // ADR-0109 — `emphasis` is not `text`/`variant` either, so it rides the SAME `default:` arm's `setAttr`
  // as `truncate` (factories.ts:126-127 → :56-60) — no bespoke factory code, the ADR's own claim, verified.
  it('Text.emphasis (boolean, non-bindable) passes through the default setAttr arm onto [emphasis]', () => {
    const el = textFactory.create()
    textFactory.applyProp(el, 'emphasis', true)
    expect(el.hasAttribute('emphasis')).toBe(true)
    // The full chain in one place: the barrel-upgraded control's reflecting prop reads the attribute back.
    expect((el as HTMLElement & { emphasis?: boolean }).emphasis).toBe(true)
    textFactory.applyProp(el, 'emphasis', false)
    expect(el.hasAttribute('emphasis')).toBe(false)
  })

  it('Text.emphasis conformance payload yields 0 CATALOG errors', () => {
    const emphasized: A2uiComponent = { id: 'txt4', component: 'Text', text: 'A key value', emphasis: true }
    expect(validateCatalogConformance(emphasized, defaultCatalog)).toEqual([])
  })
})

describe('default catalog factories — Button + TextField (catalog LLD-C5, SPEC-R4)', () => {
  it('Button → ui-button maps variant (prop) + label (textContent); not an input (no value bind)', () => {
    expect(buttonFactory.tag).toBe('ui-button')
    expect(buttonFactory.value).toBeUndefined() // Button is not an input — LLD-C8 wires no two-way binding
    const el = buttonFactory.create()
    buttonFactory.applyProp(el, 'variant', 'soft')
    expect((el as { variant?: unknown }).variant).toBe('soft')
    buttonFactory.applyProp(el, 'label', 'Hi')
    expect(el.textContent).toBe('Hi')
  })

  it('TextField → ui-text-field is value-bound on the change event (the LLD-C8 back-fill, ADR-0019 cl.3)', () => {
    expect(textFieldFactory.tag).toBe('ui-text-field')
    expect(textFieldFactory.value).toEqual({ prop: 'value', event: 'change' })
    const el = textFieldFactory.create()
    textFieldFactory.applyProp(el, 'value', 'hello')
    textFieldFactory.applyProp(el, 'label', 'Name')
    expect((el as unknown as Record<string, unknown>).value).toBe('hello')
    expect((el as unknown as Record<string, unknown>).label).toBe('Name')
  })
})

describe('default catalog factories — G9 container family (catalog LLD-C5, SPEC-R4/R8)', () => {
  it('Row → ui-row maps the surface + flex grammar onto accessors', () => {
    expect(rowFactory.tag).toBe('ui-row')
    expect(rowFactory.value).toBeUndefined() // layout primitive, not an input
    const el = rowFactory.create()
    expect(el.tagName.toLowerCase()).toBe('ui-row')
    rowFactory.applyProp(el, 'elevation', '2')
    rowFactory.applyProp(el, 'align', 'center')
    rowFactory.applyProp(el, 'gap', 'md')
    rowFactory.applyProp(el, 'wrap', true)
    expect((el as unknown as Record<string, unknown>).elevation).toBe('2')
    expect((el as unknown as Record<string, unknown>).align).toBe('center')
    expect((el as unknown as Record<string, unknown>).gap).toBe('md')
    expect((el as unknown as Record<string, unknown>).wrap).toBe(true)
  })

  it('Column → ui-column shares the same accessor grammar', () => {
    expect(columnFactory.tag).toBe('ui-column')
    const el = columnFactory.create()
    columnFactory.applyProp(el, 'justify', 'between')
    expect((el as unknown as Record<string, unknown>).justify).toBe('between')
  })

  it('ADR-0096: `reflow` flows through the SAME plain accessorFactory pass-through, zero factory change (cl.4)', () => {
    // verifies the ADR-0096 cl.4 claim directly: rowFactory/columnFactory are bare accessorFactory('ui-row'/
    // 'ui-column') calls with no bespoke property list, so a reflecting accessor prop added to the ELEMENT
    // flows 1:1 through the SAME generic setProp — no factories.ts edit was needed to reach it.
    const row = rowFactory.create()
    rowFactory.applyProp(row, 'reflow', 'locked')
    expect((row as unknown as Record<string, unknown>).reflow).toBe('locked')

    const col = columnFactory.create()
    columnFactory.applyProp(col, 'reflow', 'auto')
    expect((col as unknown as Record<string, unknown>).reflow).toBe('auto')
  })

  it('Card → ui-card maps the surface axes; CardContent → ui-card-content maps scrollable', () => {
    expect(cardFactory.tag).toBe('ui-card')
    const card = cardFactory.create()
    cardFactory.applyProp(card, 'brightness', '1')
    expect((card as unknown as Record<string, unknown>).brightness).toBe('1')

    expect(cardContentFactory.tag).toBe('ui-card-content')
    const content = cardContentFactory.create()
    cardContentFactory.applyProp(content, 'scrollable', true) // renamed from `scroll` — collides with Element.scroll()
    expect((content as unknown as Record<string, unknown>).scrollable).toBe(true)
  })

  it('Tabs → ui-tabs is two-way bound on selected via the select event (ADR-0019 cl.2)', () => {
    expect(tabsFactory.tag).toBe('ui-tabs')
    expect(tabsFactory.value).toEqual({ prop: 'selected', event: 'select' })
    const el = tabsFactory.create()
    tabsFactory.applyProp(el, 'selected', 1)
    expect((el as unknown as Record<string, unknown>).selected).toBe(1)
  })

  it('Tabs.fill maps 1:1 to ui-tabs.fill (ADR-0144 Q1 cl.4 — the SplitPane.collapsible structural-boolean precedent)', () => {
    expect(defaultCatalog.components['Tabs']?.properties['fill']).toEqual({ type: { type: 'boolean' }, mapsTo: 'fill' })
    const el = tabsFactory.create()
    tabsFactory.applyProp(el, 'fill', true)
    expect((el as unknown as Record<string, unknown>).fill).toBe(true)
  })

  it('Modal → ui-modal is two-way bound on open via the toggle event (ADR-0019 cl.2)', () => {
    expect(modalFactory.tag).toBe('ui-modal')
    expect(modalFactory.value).toEqual({ prop: 'open', event: 'toggle' })
    const el = modalFactory.create()
    modalFactory.applyProp(el, 'open', true)
    modalFactory.applyProp(el, 'persistent', true)
    expect((el as unknown as Record<string, unknown>).open).toBe(true)
    expect((el as unknown as Record<string, unknown>).persistent).toBe(true)
  })

  it('applyProp honours every declared accessor prop for each container/input factory (mapsTo == name)', () => {
    // The container family + text-field + the ADR-0053 Field/FormProvider/Select rows declare `mapsTo`
    // equal to the property name (the SPEC-R8 1:1 reflection), so `applyProp(el, name, v)` must land `v`
    // on `el[mapsTo]`. Walk the catalog and assert it for every accessor-mapped type — skip the bespoke
    // non-identity-`mapsTo` factories (Button.label, Checkbox/Switch.label, Option.label all → textContent;
    // Option.value → an attribute, not a prop; Text.variant → the ADR-0078 cl.5 triple fan-out, not a
    // straight pass-through; MenuItem.value → the `data-value` attribute, MenuItem.label → textContent,
    // the ADR-0087 Wave A Option-shape twin; MultiSelect.options → a full-rebuild [role=option] children
    // set, applyMultiSelectOptions, the ChoicePicker.options precedent — no matching JS accessor at all),
    // each covered by its own dedicated describe block below.
    for (const [type, def] of Object.entries(defaultCatalog.components)) {
      if (
        type === 'Button' ||
        type === 'Checkbox' ||
        type === 'Switch' ||
        type === 'Option' ||
        type === 'Text' ||
        type === 'MenuItem' ||
        type === 'Radio' || // bespoke non-identity mapsTo (label → textContent), the Checkbox/Switch precedent
        type === 'Segment' || // the SAME bespoke non-identity mapsTo as Radio (ADR-0095 clause 3 — no new prop of its own)
        // RadioGroup.value / SegmentedControl.value: `mapsTo` names the property, but the accessor is NOT
        // a raw reflecting prop (no `static props` entry) — it's DERIVED from child Radio/Segment state
        // (radio-group.ts's `get value()`/`set value()`, inherited unchanged by SegmentedControl), so a
        // sentinel string with no matching child clears to `null` by design (the `HTMLSelectElement.value`-
        // no-match precedent). Covered by its own dedicated round trip in index.test.ts (a real committed
        // value against real Radio/Segment children), not this walker.
        type === 'RadioGroup' ||
        type === 'SegmentedControl' ||
        type === 'MultiSelect' // bespoke `options` mapping (no matching JS accessor) — its own describe block below
      )
        continue
      const factory = defaultFactories[type]
      const el = factory.create()
      for (const [name, pd] of Object.entries(def.properties)) {
        const sentinel = `sentinel-${name}`
        factory.applyProp(el, name, sentinel)
        expect((el as unknown as Record<string, unknown>)[pd.mapsTo], `${type}.${name} → ${pd.mapsTo}`).toBe(sentinel)
      }
    }
  })
})

describe('default catalog factories — Field / FormProvider (ADR-0053, catalog LLD-C5)', () => {
  it('Field → ui-field maps label + description via accessorFactory (1:1 reflecting props); no value bind', () => {
    expect(fieldFactory.tag).toBe('ui-field')
    expect(fieldFactory.value).toBeUndefined() // not an input — no two-way commit event
    const el = fieldFactory.create()
    fieldFactory.applyProp(el, 'label', 'Name')
    fieldFactory.applyProp(el, 'description', 'Your full name')
    expect((el as unknown as Record<string, unknown>).label).toBe('Name')
    expect((el as unknown as Record<string, unknown>).description).toBe('Your full name')
  })

  it('FormProvider → ui-form-provider carries zero properties + the ADR-0054 submitGate mark', () => {
    expect(formProviderFactory.tag).toBe('ui-form-provider')
    expect(formProviderFactory.value).toBeUndefined() // no bindable prop of its own — the aggregate rides the data model
    expect(formProviderFactory.submitGate).toBe(true)
    expect(Object.keys(defaultCatalog.components.FormProvider.properties)).toEqual([])
  })
})

describe('default catalog factories — Checkbox / Switch (ADR-0053, the Indicator naming law)', () => {
  it('Checkbox → ui-checkbox: checked/disabled/required/name are 1:1 accessors; label is bespoke textContent', () => {
    expect(checkboxFactory.tag).toBe('ui-checkbox')
    expect(checkboxFactory.value).toEqual({ prop: 'checked', event: 'change' }) // the naming law: bindable = the control's own prop
    const el = checkboxFactory.create()
    checkboxFactory.applyProp(el, 'checked', true)
    checkboxFactory.applyProp(el, 'disabled', true)
    checkboxFactory.applyProp(el, 'required', true)
    checkboxFactory.applyProp(el, 'name', 'terms')
    checkboxFactory.applyProp(el, 'label', 'I accept the terms')
    const box = el as unknown as Record<string, unknown>
    expect(box.checked).toBe(true)
    expect(box.disabled).toBe(true)
    expect(box.required).toBe(true)
    expect(box.name).toBe('terms')
    expect(el.textContent).toBe('I accept the terms') // bespoke — ui-checkbox has no `label` prop
  })

  it('Switch → ui-switch: checked/disabled/name are 1:1 accessors; label is bespoke textContent (no required row)', () => {
    expect(switchFactory.tag).toBe('ui-switch')
    expect(switchFactory.value).toEqual({ prop: 'checked', event: 'change' })
    const el = switchFactory.create()
    switchFactory.applyProp(el, 'checked', true)
    switchFactory.applyProp(el, 'label', 'Email me updates')
    expect((el as unknown as Record<string, unknown>).checked).toBe(true)
    expect(el.textContent).toBe('Email me updates')
    expect(defaultCatalog.components.Switch.properties.required).toBeUndefined() // deliberately no required row
  })

  it('null/undefined label coerces to empty string on both (the value == null guard, the buttonFactory precedent)', () => {
    const cb = checkboxFactory.create()
    checkboxFactory.applyProp(cb, 'label', null)
    expect(cb.textContent).toBe('')
    const sw = switchFactory.create()
    switchFactory.applyProp(sw, 'label', undefined)
    expect(sw.textContent).toBe('')
  })
})

describe('default catalog factories — Select / Option (ADR-0053, ChoicePicker → Select rename)', () => {
  it('Select → ui-select is two-way bound on value via the select event; value/disabled bindable, no open row', () => {
    expect(selectFactory.tag).toBe('ui-select')
    expect(selectFactory.value).toEqual({ prop: 'value', event: 'select' })
    const el = selectFactory.create()
    selectFactory.applyProp(el, 'value', 'pro')
    selectFactory.applyProp(el, 'placeholder', 'Choose a plan…')
    expect((el as unknown as Record<string, unknown>).value).toBe('pro')
    expect((el as unknown as Record<string, unknown>).placeholder).toBe('Choose a plan…')
    expect(defaultCatalog.components.Select.properties.open).toBeUndefined() // one value mark per component
  })

  it('Option → div[role=option] (the sanctioned-primitive exception, SPEC-R3 AC1): value→attribute, label→textContent', () => {
    expect(optionFactory.tag).toBe('div[role=option]')
    expect(optionFactory.value).toBeUndefined() // a passive list item, not a bindable component
    const el = optionFactory.create()
    expect(el.tagName.toLowerCase()).toBe('div')
    expect(el.getAttribute('role')).toBe('option')
    optionFactory.applyProp(el, 'value', 'starter')
    optionFactory.applyProp(el, 'label', 'Starter')
    expect(el.getAttribute('value')).toBe('starter')
    expect(el.textContent).toBe('Starter')
  })
})

describe('default catalog factories — Icon (ADR-0087 Wave A, ADR-0065/0066)', () => {
  it('Icon → ui-icon: wire `name` maps to the `glyph` prop (TKT-0069 item 1); label 1:1; not an input (no value bind)', () => {
    expect(iconFactory.tag).toBe('ui-icon')
    expect(iconFactory.value).toBeUndefined() // a display leaf — no two-way binding
    const el = iconFactory.create()
    iconFactory.applyProp(el, 'name', 'caret-down')
    iconFactory.applyProp(el, 'label', 'Expand')
    const target = el as unknown as Record<string, unknown>
    expect(target.glyph).toBe('caret-down') // the wire field lands on the RENAMED prop
    expect(target.name).toBeUndefined() // and never on a stale `name` expando
    expect(target.label).toBe('Expand')
  })

  // GH #808 S1 (catalog SPEC-R2): `slot` rides the mapping's default arm onto the native reflecting
  // `HTMLElement.slot` accessor — zero factory code, verified end-to-end (prop write → attribute
  // reflection), the SAME platform mechanism `ui-card-header`'s `:has([slot='leading'])` grid reads.
  it('Icon `slot` (GH #808 S1) reflects onto the native `slot` attribute — zero factory code', () => {
    const el = iconFactory.create()
    iconFactory.applyProp(el, 'slot', 'leading')
    expect(el.slot).toBe('leading')
    expect(el.getAttribute('slot')).toBe('leading')
  })

  it('Icon `slot` (GH #808 S1) conformance: enum values pass, an out-of-enum value fails CATALOG', () => {
    const leading: A2uiComponent = { id: 'ic1', component: 'Icon', name: 'check', slot: 'leading' }
    expect(validateCatalogConformance(leading, defaultCatalog)).toEqual([])
    const bogus: A2uiComponent = { id: 'ic2', component: 'Icon', name: 'check', slot: 'center' }
    expect(validateCatalogConformance(bogus, defaultCatalog)).toEqual([{ code: 'CATALOG', path: 'ic2.slot' }])
  })
})

describe('default catalog factories — Badge (SPEC-R11..R13)', () => {
  it('Badge → ui-badge: label/intent are 1:1 reflecting accessors; not an input (no value bind)', () => {
    expect(badgeFactory.tag).toBe('ui-badge')
    expect(badgeFactory.value).toBeUndefined() // a display leaf — no two-way binding
    const el = badgeFactory.create()
    badgeFactory.applyProp(el, 'label', 'Confirmed')
    badgeFactory.applyProp(el, 'intent', 'success')
    const target = el as unknown as Record<string, unknown>
    expect(target.label).toBe('Confirmed')
    expect(target.intent).toBe('success')
  })

  // GH #808 S1 (catalog SPEC-R2): the SAME zero-factory-code `slot` reflection as Icon, riding plain
  // `accessorFactory`'s identity `setProp` this time (Badge carries no renamed props).
  it('Badge `slot` (GH #808 S1) reflects onto the native `slot` attribute — zero factory code', () => {
    const el = badgeFactory.create()
    badgeFactory.applyProp(el, 'slot', 'trailing')
    expect(el.slot).toBe('trailing')
    expect(el.getAttribute('slot')).toBe('trailing')
  })

  it('Badge `slot` (GH #808 S1) conformance: enum values pass, an out-of-enum value fails CATALOG', () => {
    const trailing: A2uiComponent = { id: 'bd1', component: 'Badge', label: 'Done', slot: 'trailing' }
    expect(validateCatalogConformance(trailing, defaultCatalog)).toEqual([])
    const bogus: A2uiComponent = { id: 'bd2', component: 'Badge', label: 'Done', slot: 'top' }
    expect(validateCatalogConformance(bogus, defaultCatalog)).toEqual([{ code: 'CATALOG', path: 'bd2.slot' }])
  })

  // GH #1151: a danger Badge's ×-shaped mark is the INTENT GLYPH (a decorative status mark, SPEC-R12),
  // NOT a close affordance — the live "× Dealer wins" report mistook it for an inert close button. Pin
  // the mechanism: the catalog's Badge renders NO interactive affordance at all (nothing focusable, no
  // button part, no close event to wire), and the glyph stays aria-hidden so nothing announces "×".
  // The affordance-never-inert law is upheld by there being no affordance — if a closeable tag/chip ever
  // enters this catalog, it must ship WITH its close wiring (self-dismiss at minimum) and retire this pin.
  it('Badge (GH #1151): danger × is the decorative intent glyph, never a close affordance — no interactive parts', () => {
    const el = badgeFactory.create()
    badgeFactory.applyProp(el, 'label', 'Dealer wins')
    badgeFactory.applyProp(el, 'intent', 'danger')
    document.body.append(el) // connect — the one-time glyph+label build runs in connected()
    try {
      const glyph = el.querySelector('[data-part="glyph"]')
      expect(glyph, 'the × mark is the constant glyph part').not.toBeNull()
      expect(glyph!.getAttribute('aria-hidden')).toBe('true')
      // No close affordance exists anywhere in the badge: nothing focusable, no button, no close part.
      expect(el.querySelector('button, [role="button"], [tabindex], [data-part="close"]')).toBeNull()
      expect((el as HTMLElement).tabIndex).toBeLessThan(0) // the host itself is not focusable either
    } finally {
      el.remove()
    }
  })
})

describe('default catalog factories — Menu / MenuItem (ADR-0087 Wave A, overlay-controller.lld)', () => {
  it('Menu → ui-menu is two-way bound on open via the toggle event (ADR-0019); placement is a 1:1 accessor', () => {
    expect(menuFactory.tag).toBe('ui-menu')
    expect(menuFactory.value).toEqual({ prop: 'open', event: 'toggle' })
    const el = menuFactory.create()
    menuFactory.applyProp(el, 'open', true)
    menuFactory.applyProp(el, 'placement', 'top-end')
    const target = el as unknown as Record<string, unknown>
    expect(target.open).toBe(true)
    expect(target.placement).toBe('top-end')
  })

  it('MenuItem → div[role=menuitem] (the Option-shape sanctioned-primitive twin): value→data-value attribute, label→textContent', () => {
    expect(menuItemFactory.tag).toBe('div[role=menuitem]')
    expect(menuItemFactory.value).toBeUndefined() // a passive list item, not a bindable component
    const el = menuItemFactory.create()
    expect(el.tagName.toLowerCase()).toBe('div')
    expect(el.getAttribute('role')).toBe('menuitem')
    menuItemFactory.applyProp(el, 'value', 'a')
    menuItemFactory.applyProp(el, 'label', 'Option A')
    // verified against menu.ts #commit: `item.dataset['value'] ?? item.textContent?.trim()` — the
    // committed value reads the `data-value` ATTRIBUTE, not a plain `value` attribute (Option's shape).
    expect(el.getAttribute('data-value')).toBe('a')
    expect(el.getAttribute('value')).toBeNull()
    expect(el.textContent).toBe('Option A')
  })

  it('null/undefined label coerces to empty string (the value == null guard, the Option precedent)', () => {
    const el = menuItemFactory.create()
    menuItemFactory.applyProp(el, 'label', null)
    expect(el.textContent).toBe('')
  })
})

describe('default catalog factories — Popover (ADR-0087 Wave A, overlay-controller.lld)', () => {
  it('Popover → ui-popover is two-way bound on open via the toggle event (ADR-0019); placement is a 1:1 accessor', () => {
    expect(popoverFactory.tag).toBe('ui-popover')
    expect(popoverFactory.value).toEqual({ prop: 'open', event: 'toggle' })
    const el = popoverFactory.create()
    popoverFactory.applyProp(el, 'open', true)
    popoverFactory.applyProp(el, 'placement', 'left-start')
    const target = el as unknown as Record<string, unknown>
    expect(target.open).toBe(true)
    expect(target.placement).toBe('left-start')
  })
})

describe('default catalog factories — FormPopover (GH #294 F4, form-popover.lld.md)', () => {
  it('FormPopover → ui-form-popover is two-way bound on open via the toggle event (the Menu/Popover/Tooltip overlay precedent); label/placement/size are 1:1 accessors', () => {
    expect(formPopoverFactory.tag).toBe('ui-form-popover')
    expect(formPopoverFactory.value).toEqual({ prop: 'open', event: 'toggle' })
    const el = formPopoverFactory.create()
    formPopoverFactory.applyProp(el, 'open', true)
    formPopoverFactory.applyProp(el, 'label', 'Filters')
    formPopoverFactory.applyProp(el, 'placement', 'bottom-end')
    formPopoverFactory.applyProp(el, 'size', 'lg')
    const target = el as unknown as Record<string, unknown>
    expect(target.open).toBe(true)
    expect(target.label).toBe('Filters')
    expect(target.placement).toBe('bottom-end')
    expect(target.size).toBe('lg')
  })
})

describe('default catalog factories — Tooltip (ADR-0087 Wave A, overlay-controller.lld)', () => {
  it('Tooltip → ui-tooltip is two-way bound on open via the toggle event (ADR-0019); placement/delay are 1:1 accessors', () => {
    expect(tooltipFactory.tag).toBe('ui-tooltip')
    expect(tooltipFactory.value).toEqual({ prop: 'open', event: 'toggle' })
    const el = tooltipFactory.create()
    tooltipFactory.applyProp(el, 'open', true)
    tooltipFactory.applyProp(el, 'placement', 'right-end')
    tooltipFactory.applyProp(el, 'delay', 300)
    const target = el as unknown as Record<string, unknown>
    expect(target.open).toBe(true)
    expect(target.placement).toBe('right-end')
    expect(target.delay).toBe(300)
  })
})

describe('default catalog factories — RadioGroup / Radio (ADR-0087 Wave B, closes the ADR-0053 deferral / Fork B)', () => {
  it('RadioGroup → ui-radio-group: name/disabled/required/orientation are 1:1 accessors (variant RETIRED, ADR-0095); value is a REAL two-way bind (the closed component-side gap)', () => {
    expect(radioGroupFactory.tag).toBe('ui-radio-group')
    // VERIFIED against radio-group.ts: `UIRadioGroupElement` gained a public `value` getter/setter
    // (delegating to its private `#selectedValue` signal — the `UICheckboxElement.checked` precedent) —
    // this closes the formerly-verified gap where a `value:{prop:'value',event:'change'}` mark would
    // have read `el.value` as `undefined` on every commit. `change` is the real commit event
    // (`this.emit('change')` in `#commit()`).
    expect(radioGroupFactory.value).toEqual({ prop: 'value', event: 'change' })
    const el = radioGroupFactory.create()
    radioGroupFactory.applyProp(el, 'name', 'theme')
    radioGroupFactory.applyProp(el, 'disabled', true)
    radioGroupFactory.applyProp(el, 'required', true)
    radioGroupFactory.applyProp(el, 'orientation', 'horizontal')
    const target = el as unknown as Record<string, unknown>
    expect(target.name).toBe('theme')
    expect(target.disabled).toBe(true)
    expect(target.required).toBe(true)
    expect(target.orientation).toBe('horizontal')
    expect(defaultCatalog.components.RadioGroup.properties.variant, 'variant retired by ADR-0095').toBeUndefined()
    expect(defaultCatalog.components.RadioGroup.properties.value).toEqual({
      type: { type: 'string' },
      bindable: true,
      mapsTo: 'value',
    })
  })

  it('Radio → ui-radio (the Wave A reviewer correction — a REAL row, not a gate-exempt sub-type): value/checked are 1:1 accessors; label is bespoke textContent; no value mark of its own', () => {
    expect(radioFactory.tag).toBe('ui-radio') // a real ui-* control, unlike Option/MenuItem
    expect(radioFactory.value).toBeUndefined() // the GROUP owns the selection commit, not the individual radio
    const el = radioFactory.create()
    radioFactory.applyProp(el, 'value', 'dark')
    radioFactory.applyProp(el, 'checked', true)
    radioFactory.applyProp(el, 'label', 'Dark')
    const target = el as unknown as Record<string, unknown>
    expect(target.value).toBe('dark')
    expect(target.checked).toBe(true)
    expect(el.textContent).toBe('Dark')
  })

  it('null/undefined Radio label coerces to empty string (the value == null guard, the Checkbox/Option precedent)', () => {
    const el = radioFactory.create()
    radioFactory.applyProp(el, 'label', null)
    expect(el.textContent).toBe('')
  })
})

describe('default catalog factories — SegmentedControl / Segment (ADR-0095, supersedes ADR-0086)', () => {
  it('SegmentedControl → ui-segmented-control: name/disabled/required/orientation are 1:1 accessors (inherited from UIRadioGroupElement, unchanged); value is a REAL two-way bind', () => {
    expect(segmentedControlFactory.tag).toBe('ui-segmented-control')
    expect(segmentedControlFactory.value).toEqual({ prop: 'value', event: 'change' })
    const el = segmentedControlFactory.create()
    segmentedControlFactory.applyProp(el, 'name', 'density')
    segmentedControlFactory.applyProp(el, 'disabled', true)
    segmentedControlFactory.applyProp(el, 'required', true)
    segmentedControlFactory.applyProp(el, 'orientation', 'vertical')
    const target = el as unknown as Record<string, unknown>
    expect(target.name).toBe('density')
    expect(target.disabled).toBe(true)
    expect(target.required).toBe(true)
    expect(target.orientation).toBe('vertical')
    expect(defaultCatalog.components.SegmentedControl.properties.variant, 'SegmentedControl never had a variant prop').toBeUndefined()
    expect(defaultCatalog.components.SegmentedControl.properties.value).toEqual({
      type: { type: 'string' },
      bindable: true,
      mapsTo: 'value',
    })
  })

  it('Segment → ui-segment (ADR-0095 clause 3 — the SAME shape as Radio): value/checked are 1:1 accessors; label is bespoke textContent; no value mark of its own', () => {
    expect(segmentFactory.tag).toBe('ui-segment') // a real ui-* control, unlike Option/MenuItem
    expect(segmentFactory.value).toBeUndefined() // the HOST owns the selection commit, not the individual segment
    const el = segmentFactory.create()
    segmentFactory.applyProp(el, 'value', 'spacious')
    segmentFactory.applyProp(el, 'checked', true)
    segmentFactory.applyProp(el, 'label', 'Spacious')
    const target = el as unknown as Record<string, unknown>
    expect(target.value).toBe('spacious')
    expect(target.checked).toBe(true)
    expect(el.textContent).toBe('Spacious')
  })

  it('null/undefined Segment label coerces to empty string (the value == null guard, the Radio/Checkbox/Option precedent)', () => {
    const el = segmentFactory.create()
    segmentFactory.applyProp(el, 'label', null)
    expect(el.textContent).toBe('')
  })
})

describe('default catalog factories — Slider (ADR-0087 Wave B, closes the ADR-0053 deferral / Fork C)', () => {
  it('Slider → ui-slider is two-way bound on value via the VERIFIED change event (not input — the committed, not the live, event); min/max/step/name/disabled/required are 1:1 accessors', () => {
    expect(sliderFactory.tag).toBe('ui-slider')
    // Verified against slider.ts + range-element.ts: `input` fires on every live drag/keyboard step,
    // `change` fires only on blur when the value moved since focus — the commit event, bound here.
    expect(sliderFactory.value).toEqual({ prop: 'value', event: 'change' })
    const el = sliderFactory.create()
    sliderFactory.applyProp(el, 'value', 42)
    sliderFactory.applyProp(el, 'min', 0)
    sliderFactory.applyProp(el, 'max', 100)
    sliderFactory.applyProp(el, 'step', 5)
    sliderFactory.applyProp(el, 'name', 'volume')
    sliderFactory.applyProp(el, 'disabled', true)
    sliderFactory.applyProp(el, 'required', true)
    const target = el as unknown as Record<string, unknown>
    expect(target.value).toBe(42)
    expect(target.min).toBe(0)
    expect(target.max).toBe(100)
    expect(target.step).toBe(5)
    expect(target.name).toBe('volume')
    expect(target.disabled).toBe(true)
    expect(target.required).toBe(true)
  })

  it('GH #1141 — label/layout are 1:1 reflecting accessors (the blackjack-bet-slider GenUI case)', () => {
    const el = sliderFactory.create()
    sliderFactory.applyProp(el, 'label', 'Bet')
    sliderFactory.applyProp(el, 'layout', 'inline')
    const target = el as unknown as Record<string, unknown>
    expect(target.label).toBe('Bet')
    expect(target.layout).toBe('inline')
  })
})

describe('default catalog factories — SliderMulti (ADR-0087 Wave B, Fork C RESOLVED two-types; ADR-0161 write-back)', () => {
  it('SliderMulti → ui-slider-multi: valueLo/valueHi/min/max/step/name/disabled are 1:1 accessors; a two-slot value mark (ADR-0161) closes the prior one-slot-per-component seam limitation', () => {
    expect(sliderMultiFactory.tag).toBe('ui-slider-multi')
    expect(sliderMultiFactory.value).toEqual([
      { prop: 'valueLo', event: 'change' },
      { prop: 'valueHi', event: 'change' },
    ])
    const el = sliderMultiFactory.create()
    sliderMultiFactory.applyProp(el, 'valueLo', 20)
    sliderMultiFactory.applyProp(el, 'valueHi', 80)
    sliderMultiFactory.applyProp(el, 'min', 0)
    sliderMultiFactory.applyProp(el, 'max', 100)
    sliderMultiFactory.applyProp(el, 'step', 10)
    sliderMultiFactory.applyProp(el, 'name', 'range')
    sliderMultiFactory.applyProp(el, 'disabled', true)
    const target = el as unknown as Record<string, unknown>
    expect(target.valueLo).toBe(20)
    expect(target.valueHi).toBe(80)
    expect(target.min).toBe(0)
    expect(target.max).toBe(100)
    expect(target.step).toBe(10)
    expect(target.name).toBe('range')
    expect(target.disabled).toBe(true)
    expect(defaultCatalog.components.SliderMulti.value).toEqual([
      { prop: 'valueLo', event: 'change' },
      { prop: 'valueHi', event: 'change' },
    ])
  })

  it('GH #1141 — label/layout are 1:1 reflecting accessors (matches the Slider row)', () => {
    const el = sliderMultiFactory.create()
    sliderMultiFactory.applyProp(el, 'label', 'Price')
    sliderMultiFactory.applyProp(el, 'layout', 'block')
    const target = el as unknown as Record<string, unknown>
    expect(target.label).toBe('Price')
    expect(target.layout).toBe('block')
  })
})

describe('default catalog factories — Calendar (ADR-0087 Wave B, closes the ADR-0053 deferral; ADR-0161 range write-back)', () => {
  it('Calendar → ui-calendar is two-way bound on value/valueStart/valueEnd via the change event (calendar.md\'s own declared bind, confirmed against calendar.ts #commit; ADR-0161 widens the mark to the range pair); min/max/name/required/disabled are 1:1 accessors', () => {
    expect(calendarFactory.tag).toBe('ui-calendar')
    expect(calendarFactory.value).toEqual([
      { prop: 'value', event: 'change' },
      { prop: 'valueStart', event: 'change' },
      { prop: 'valueEnd', event: 'change' },
    ])
    const el = calendarFactory.create()
    calendarFactory.applyProp(el, 'value', '2026-07-06')
    calendarFactory.applyProp(el, 'min', '2026-01-01')
    calendarFactory.applyProp(el, 'max', '2026-12-31')
    calendarFactory.applyProp(el, 'name', 'appt-date')
    calendarFactory.applyProp(el, 'required', true)
    calendarFactory.applyProp(el, 'disabled', true)
    const target = el as unknown as Record<string, unknown>
    expect(target.value).toBe('2026-07-06')
    expect(target.min).toBe('2026-01-01')
    expect(target.max).toBe('2026-12-31')
    expect(target.name).toBe('appt-date')
    expect(target.required).toBe(true)
    expect(target.disabled).toBe(true)
  })

  it('Calendar → ui-calendar range mode (ADR-0093 clause 7 follow-up, ADR-0161 closes it): mode/valueStart/valueEnd apply 1:1 through the SAME generic accessorFactory — no bespoke factory code needed', () => {
    expect(calendarFactory.value).toEqual([
      { prop: 'value', event: 'change' },
      { prop: 'valueStart', event: 'change' },
      { prop: 'valueEnd', event: 'change' },
    ]) // value stays inert-but-harmless in mode=range; valueStart/valueEnd are now real two-way slots
    const el = calendarFactory.create()
    calendarFactory.applyProp(el, 'mode', 'range')
    calendarFactory.applyProp(el, 'valueStart', '2026-07-05')
    calendarFactory.applyProp(el, 'valueEnd', '2026-07-20')
    const target = el as unknown as Record<string, unknown>
    expect(target.mode).toBe('range')
    expect(target.valueStart).toBe('2026-07-05')
    expect(target.valueEnd).toBe('2026-07-20')
  })
})

describe('default catalog factories — ComboBox (ADR-0087 Wave B, Fork D/combobox — resolves the two-way slot)', () => {
  it('ComboBox → ui-combo-box is two-way bound on the FORM value via change — NOT open/toggle (corrects the stale combo-box.md comment); label/placeholder/strict/name/disabled are 1:1 accessors', () => {
    expect(comboBoxFactory.tag).toBe('ui-combo-box')
    // Verified against combo-box.ts: `value` is the committed option key / free-text string
    // (formValue() source); `change` fires on commit with `this.value` already updated. `open` remains
    // a real, independently settable prop (drives the overlay) but carries no catalog value mark here.
    expect(comboBoxFactory.value).toEqual({ prop: 'value', event: 'change' })
    const el = comboBoxFactory.create()
    comboBoxFactory.applyProp(el, 'value', 'pro')
    comboBoxFactory.applyProp(el, 'label', 'Plan')
    comboBoxFactory.applyProp(el, 'placeholder', 'Choose…')
    comboBoxFactory.applyProp(el, 'strict', true)
    comboBoxFactory.applyProp(el, 'name', 'plan')
    comboBoxFactory.applyProp(el, 'disabled', true)
    const target = el as unknown as Record<string, unknown>
    expect(target.value).toBe('pro')
    expect(target.label).toBe('Plan')
    expect(target.placeholder).toBe('Choose…')
    expect(target.strict).toBe(true)
    expect(target.name).toBe('plan')
    expect(target.disabled).toBe(true)
    expect(defaultCatalog.components.ComboBox.properties.open).toBeUndefined() // one value mark per component
  })
})

describe('default catalog factories — List / Grid (ADR-0087 Wave C, Fork A RESOLVED INCLUDE)', () => {
  it('List → ui-list maps the surface + flex grammar onto accessors (the Row/Column idiom); not an input', () => {
    expect(listFactory.tag).toBe('ui-list')
    expect(listFactory.value).toBeUndefined() // a structural container, not a bindable component
    const el = listFactory.create()
    expect(el.tagName.toLowerCase()).toBe('ui-list')
    listFactory.applyProp(el, 'elevation', '1')
    listFactory.applyProp(el, 'align', 'center')
    listFactory.applyProp(el, 'justify', 'between')
    listFactory.applyProp(el, 'gap', 'sm')
    listFactory.applyProp(el, 'wrap', true)
    const target = el as unknown as Record<string, unknown>
    expect(target.elevation).toBe('1')
    expect(target.align).toBe('center')
    expect(target.justify).toBe('between')
    expect(target.gap).toBe('sm')
    expect(target.wrap).toBe(true)
  })

  it('Grid → ui-grid maps the surface axes + gap + the minmax() min floor onto accessors; not an input', () => {
    expect(gridFactory.tag).toBe('ui-grid')
    expect(gridFactory.value).toBeUndefined() // a structural container, not a bindable component
    const el = gridFactory.create()
    expect(el.tagName.toLowerCase()).toBe('ui-grid')
    gridFactory.applyProp(el, 'elevation', '2')
    gridFactory.applyProp(el, 'brightness', '-1')
    gridFactory.applyProp(el, 'gap', 'lg')
    gridFactory.applyProp(el, 'min', '12rem')
    const target = el as unknown as Record<string, unknown>
    expect(target.elevation).toBe('2')
    expect(target.brightness).toBe('-1')
    expect(target.gap).toBe('lg')
    expect(target.min).toBe('12rem')
  })
})

describe('default catalog factories — Sparkline / BarChart (ADR-0107, chart-family.lld.md LLD-C10)', () => {
  it('Sparkline → ui-sparkline maps values/label/variant onto accessors; not an input, no children', () => {
    expect(sparklineFactory.tag).toBe('ui-sparkline')
    expect(sparklineFactory.value).toBeUndefined() // a display leaf — no two-way binding
    expect(sparklineFactory.submitGate).toBeUndefined()
    const el = sparklineFactory.create()
    expect(el.tagName.toLowerCase()).toBe('ui-sparkline')
    sparklineFactory.applyProp(el, 'values', [3, 5, 4, 8, 7])
    sparklineFactory.applyProp(el, 'label', 'Revenue trend')
    sparklineFactory.applyProp(el, 'variant', 'area')
    const target = el as unknown as Record<string, unknown>
    expect(target.values).toEqual([3, 5, 4, 8, 7])
    expect(target.label).toBe('Revenue trend')
    expect(target.variant).toBe('area')
  })

  it('BarChart → ui-bar-chart maps data/label onto accessors; not an input, no children', () => {
    expect(barChartFactory.tag).toBe('ui-bar-chart')
    expect(barChartFactory.value).toBeUndefined() // a display leaf — no two-way binding
    expect(barChartFactory.submitGate).toBeUndefined()
    const el = barChartFactory.create()
    expect(el.tagName.toLowerCase()).toBe('ui-bar-chart')
    const data = [
      { label: 'EMEA', value: 42 },
      { label: 'APAC', value: 31 },
    ]
    barChartFactory.applyProp(el, 'data', data)
    barChartFactory.applyProp(el, 'label', 'Revenue by region')
    const target = el as unknown as Record<string, unknown>
    expect(target.data).toEqual(data)
    expect(target.label).toBe('Revenue by region')
  })

  it('LineChart → ui-line-chart maps values/label/variant onto accessors; not an input, no children (ADR-0205)', () => {
    expect(lineChartFactory.tag).toBe('ui-line-chart')
    expect(lineChartFactory.value).toBeUndefined() // a display leaf — no two-way binding
    expect(lineChartFactory.submitGate).toBeUndefined()
    const el = lineChartFactory.create()
    expect(el.tagName.toLowerCase()).toBe('ui-line-chart')
    lineChartFactory.applyProp(el, 'values', [3, 5, 4, 8, 7])
    lineChartFactory.applyProp(el, 'label', 'Revenue trend')
    lineChartFactory.applyProp(el, 'variant', 'area')
    const target = el as unknown as Record<string, unknown>
    expect(target.values).toEqual([3, 5, 4, 8, 7])
    expect(target.label).toBe('Revenue trend')
    expect(target.variant).toBe('area')
  })
})

describe('default catalog factories — Table / Pagination (ADR-0163 cl.9, report-family.lld.md §6 widened)', () => {
  it('Table → ui-table carries the three-slot value mark (selected/select, sort/change, page/change); columns/rows/label + the widened set are 1:1 accessors, incl. the safe-JSON-codec props', () => {
    expect(tableFactory.tag).toBe('ui-table')
    expect(tableFactory.value).toEqual([
      { prop: 'selected', event: 'select' },
      { prop: 'sort', event: 'change' },
      { prop: 'page', event: 'change' },
    ])
    const el = tableFactory.create()
    const columns = [
      { key: 'region', label: 'Region' },
      { key: 'revenue', label: 'Revenue', type: 'number' },
    ]
    const rows = [{ region: 'EMEA', revenue: 42000 }]
    // columns/rows/selected/sort/filter are ALL safe-JSON-codec props on the control (table-model.ts) —
    // `accessorFactory`'s generic `setProp` (`el[prop] = value`) writes the JS array/object DIRECTLY, the
    // SAME shape `sparklineFactory.values`/`barChartFactory.data` already prove above; the codec's
    // `from`/`to` pair only governs ATTRIBUTE string round-tripping, never a live property write.
    tableFactory.applyProp(el, 'columns', columns)
    tableFactory.applyProp(el, 'rows', rows)
    tableFactory.applyProp(el, 'label', 'Regions')
    tableFactory.applyProp(el, 'selectable', 'multi')
    tableFactory.applyProp(el, 'rowKey', 'region')
    tableFactory.applyProp(el, 'selected', ['EMEA'])
    tableFactory.applyProp(el, 'sort', { key: 'revenue', direction: 'ascending' })
    tableFactory.applyProp(el, 'search', 'EMEA')
    tableFactory.applyProp(el, 'filter', [{ key: 'region', values: ['EMEA'] }])
    tableFactory.applyProp(el, 'pageSize', 10)
    tableFactory.applyProp(el, 'page', 2)
    const target = el as unknown as Record<string, unknown>
    expect(target.columns).toEqual(columns)
    expect(target.rows).toEqual(rows)
    expect(target.label).toBe('Regions')
    expect(target.selectable).toBe('multi')
    expect(target.rowKey).toBe('region')
    expect(target.selected).toEqual(['EMEA'])
    expect(target.sort).toEqual({ key: 'revenue', direction: 'ascending' })
    expect(target.search).toBe('EMEA')
    expect(target.filter).toEqual([{ key: 'region', values: ['EMEA'] }])
    expect(target.pageSize).toBe(10)
    expect(target.page).toBe(2)
  })

  it('Pagination → ui-pagination carries a single-slot value mark on page/change; pages/label are 1:1 accessors', () => {
    expect(paginationFactory.tag).toBe('ui-pagination')
    expect(paginationFactory.value).toEqual({ prop: 'page', event: 'change' })
    const el = paginationFactory.create()
    paginationFactory.applyProp(el, 'page', 3)
    paginationFactory.applyProp(el, 'pages', 10)
    paginationFactory.applyProp(el, 'label', 'Results pagination')
    const target = el as unknown as Record<string, unknown>
    expect(target.page).toBe(3)
    expect(target.pages).toBe(10)
    expect(target.label).toBe('Results pagination')
  })
})

describe('default catalog factories — MultiSelect (M-F, multi-select-field.lld.md §9, SPEC-R9, ADR-0175)', () => {
  it('MultiSelect → ui-multi-select is two-way bound on value via the select event, no marshal; value/label/disabled bindable', () => {
    expect(multiSelectFactory.tag).toBe('ui-multi-select')
    expect(multiSelectFactory.value).toEqual({ prop: 'value', event: 'select' })
    expect(defaultCatalog.components.MultiSelect.value).toEqual({ prop: 'value', event: 'select' })
    expect((defaultCatalog.components.MultiSelect.value as { marshal?: unknown }).marshal).toBeUndefined()
    const el = multiSelectFactory.create()
    multiSelectFactory.applyProp(el, 'value', ['a', 'b'])
    multiSelectFactory.applyProp(el, 'label', 'Skills')
    multiSelectFactory.applyProp(el, 'name', 'skills')
    multiSelectFactory.applyProp(el, 'disabled', true)
    multiSelectFactory.applyProp(el, 'required', true)
    multiSelectFactory.applyProp(el, 'size', 'lg')
    const target = el as unknown as Record<string, unknown>
    expect(target.value).toEqual(['a', 'b'])
    expect(target.label).toBe('Skills')
    expect(target.name).toBe('skills')
    expect(target.disabled).toBe(true)
    expect(target.required).toBe(true)
    expect(target.size).toBe('lg')
  })

  it('options → a full-rebuild [role=option] children set (OF3, the applyChoicePickerOptions precedent — a whole-array bindable prop, never a per-item bind)', () => {
    const el = multiSelectFactory.create()
    multiSelectFactory.applyProp(el, 'options', [
      { label: 'JavaScript', value: 'js' },
      { label: 'CSS', value: 'css' },
    ])
    const options = [...el.querySelectorAll<HTMLElement>('[role=option]')]
    expect(options).toHaveLength(2)
    expect(options[0].getAttribute('value')).toBe('js')
    expect(options[0].textContent).toBe('JavaScript')
    expect(options[1].getAttribute('value')).toBe('css')
    expect(options[1].textContent).toBe('CSS')

    // A second apply REPLACES the whole set (full rebuild), never appending.
    multiSelectFactory.applyProp(el, 'options', [{ label: 'HTML', value: 'html' }])
    const rebuilt = [...el.querySelectorAll<HTMLElement>('[role=option]')]
    expect(rebuilt).toHaveLength(1)
    expect(rebuilt[0].getAttribute('value')).toBe('html')
  })

  it('a non-array/malformed options value hardens to zero children (never throws)', () => {
    const el = multiSelectFactory.create()
    expect(() => multiSelectFactory.applyProp(el, 'options', 'not-an-array')).not.toThrow()
    expect(el.querySelectorAll('[role=option]')).toHaveLength(0)

    expect(() => multiSelectFactory.applyProp(el, 'options', [{ label: 'Only label' }])).not.toThrow()
    const options = [...el.querySelectorAll<HTMLElement>('[role=option]')]
    expect(options).toHaveLength(1)
    expect(options[0].getAttribute('value')).toBe('') // a missing `value` hardens to '', never dropped
  })
})

describe('default catalog factories — Toggle (GH #1352, ADR-0179 GH #686 Amendment S7-a)', () => {
  it('Toggle → ui-toggle: pressed/disabled/size are 1:1 accessors; label is bespoke textContent; NO value mark (Fork T1)', () => {
    expect(toggleFactory.tag).toBe('ui-toggle')
    expect(toggleFactory.value).toBeUndefined() // Fork T1 — see the factory's own doc comment
    const el = toggleFactory.create()
    toggleFactory.applyProp(el, 'pressed', true)
    toggleFactory.applyProp(el, 'disabled', true)
    toggleFactory.applyProp(el, 'size', 'lg')
    toggleFactory.applyProp(el, 'label', 'Settings')
    const box = el as unknown as Record<string, unknown>
    expect(box.pressed).toBe(true)
    expect(box.disabled).toBe(true)
    expect(box.size).toBe('lg')
    expect(el.textContent).toBe('Settings') // bespoke — ui-toggle has no `label` prop
  })

  it('null/undefined label coerces to empty string (the buttonFactory/checkboxFactory precedent)', () => {
    const el = toggleFactory.create()
    toggleFactory.applyProp(el, 'label', null)
    expect(el.textContent).toBe('')
    toggleFactory.applyProp(el, 'label', undefined)
    expect(el.textContent).toBe('')
  })
})
